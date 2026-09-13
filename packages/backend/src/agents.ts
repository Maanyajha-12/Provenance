import { randomInt } from "node:crypto";
import { sampleArm } from "./allocator.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createPublicClient, http, parseAbi, erc20Abi, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { policy, judge, fuse } from "./policy.js";
import { Runtime, logTrajectory } from "./runtime.js";
import { executeIntent } from "../../execution/src/execute.js";
import { address, required } from "../../config/src/index.js";
const markAbi = parseAbi([
  "function latest(bytes32 instrument) view returns(uint256 price,uint48 observedAt)",
]);
export async function agentRound(runtime: Runtime) {
  if (
    runtime.mode !== "live" ||
    runtime.state.allocator.halted ||
    runtime.state.error ||
    runtime.state.lifecycle.some((d) => d.status === "pending")
  )
    return;
  const client = createPublicClient({
    chain: sepolia,
    transport: http(required("SEPOLIA_RPC_URL")),
  });
  const instrument = required("LIVE_INSTRUMENT_ID") as Hex;
  const [price, observedAt] = await client.readContract({
    address: address("PRICE_MARKS_ADDRESS"),
    abi: markAbi,
    functionName: "latest",
    args: [instrument],
  });
  if (price <= 0n || Math.floor(Date.now() / 1000) - observedAt > 60)
    throw new Error("Publish a fresh public mark before agent actions");
  const { order } = JSON.parse(await readFile("data/maker-order.json", "utf8"));
  let examples: unknown[] = [];
  try {
    examples = JSON.parse(
      await readFile("data/policy-update.json", "utf8"),
    ).examples;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const selected = sampleArm(
    runtime.state.allocator,
    randomInt(2 ** 32) / 2 ** 32,
  );
  const selectionProbability = selected
    ? selected.allocation / runtime.state.allocator.equity
    : undefined;
  for (const agent of runtime.agents.filter((a) => a.node === selected?.node)) {
    const arm = runtime.state.allocator.arms.find(
      (a) => a.node === agent.node,
    )!;
    if (arm.retired || arm.allocation <= 0) continue;
    const secret = required(agent.signerKey) as Hex;
    if (
      privateKeyToAccount(secret).address.toLowerCase() !==
      agent.signer.toLowerCase()
    )
      throw new Error("Agent signer configuration mismatch");
    const quoteBudget = BigInt(Math.floor(arm.allocation * 1e9)) * 10n ** 9n;
    const cap = BigInt(agent.maxNotional);
    const maxBudget =
      quoteBudget > (quoteBudget * 10n ** 18n) / price
        ? quoteBudget
        : (quoteBudget * 10n ** 18n) / price;
    const candidates = [];
    for (let j = 0; j < 3; j++)
      candidates.push(
        await policy({
          agentNode: agent.node,
          instrumentId: instrument,
          maxNotional: (cap < maxBudget ? cap : maxBudget).toString(),
          maxSlippageBps: agent.maxSlippageBps,
          market: {
            price: price.toString(),
            observedAt,
            allocation: arm.allocation,
            position:
              runtime.state.rewards
                .filter((r) => r.agentNode === agent.node)
                .at(-1)?.position ?? "0",
            positiveExamples: examples,
          },
        }),
      );
    const advantages = await judge(candidates);
    const best = advantages.indexOf(Math.max(...advantages));
    const chosen = candidates[best];
    const budget =
      chosen.intent.side === "buy"
        ? quoteBudget
        : (quoteBudget * 10n ** 18n) / price;
    if (chosen.intent.notional > budget)
      throw new Error("Intent exceeds assigned capital");
    const token = address(
      chosen.intent.side === "buy" ? "TOKEN_QUOTE" : "TOKEN_BASE",
    );
    const balance = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [agent.signer],
    });
    if (chosen.intent.notional > balance)
      throw new Error("Fund agent wallet with input test tokens");
    // Re-read allocator state after LLM calls; it may have retired the agent while reasoning.
    if (
      arm.retired ||
      runtime.state.allocator.halted ||
      runtime.state.lifecycle.some((d) => d.status === "pending")
    )
      continue;
    const latestQuoteBudget =
      BigInt(Math.floor(arm.allocation * 1e9)) * 10n ** 9n;
    if (
      chosen.intent.notional >
      (chosen.intent.side === "buy"
        ? latestQuoteBudget
        : (latestQuoteBudget * 10n ** 18n) / price)
    )
      continue;
    const receipt = await executeIntent(
      chosen.intent,
      { ...order, traits: BigInt(order.traits) },
      "0x",
      agent.signerKey,
    );
    const trajectory = {
      ...chosen,
      judgeAdvantage: advantages[best],
      selectionProbability,
      candidates,
      advantages,
      txHash: receipt.transactionHash,
      intentId: chosen.intent.intentId,
      judgeVerifiable: false,
    };
    await mkdir("data/pending-trajectories", { recursive: true });
    await writeFile(
      `data/pending-trajectories/${chosen.intent.intentId}.json`,
      JSON.stringify(trajectory, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    );
    await logTrajectory({ ...trajectory, status: "awaiting-finalized-reward" });
  }
}
export async function completeTrajectory(intentId: string, verified: number) {
  if (!/^0x[\da-f]{64}$/i.test(intentId)) return;
  try {
    const trajectory = JSON.parse(
      await readFile(`data/pending-trajectories/${intentId}.json`, "utf8"),
    );
    await logTrajectory({
      ...trajectory,
      status: "complete",
      verifiedReward: verified,
      fusedReward: fuse(verified, trajectory.judgeAdvantage),
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

export async function trajectoryProbability(
  intentId: string,
  txHash: string,
): Promise<number | undefined> {
  if (!/^0x[\da-f]{64}$/i.test(intentId)) return undefined;
  try {
    const r = JSON.parse(
      await readFile(`data/pending-trajectories/${intentId}.json`, "utf8"),
    );
    return r.txHash === txHash ? r.selectionProbability : undefined;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}
