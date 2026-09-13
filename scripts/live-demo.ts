import { readFile, writeFile, appendFile } from "node:fs/promises";
import {
  parseAbi,
  erc20Abi,
  keccak256,
  toHex,
  encodeFunctionData,
  type Hex,
} from "viem";
import {
  clients,
  address,
  required,
  assertSepolia,
} from "../packages/config/src/index.js";
import { deskAbi, registryAbi } from "../packages/shared/src/abi.js";

const mode = process.argv[2];
const agent = JSON.parse(await readFile("data/agent-atlas.json", "utf8"));
const publicClient = clients("DEPLOYER_PRIVATE_KEY").publicClient;
await assertSepolia(publicClient);
async function confirmed(label: string, hash: Hex, expected = "success") {
  console.log(`SUBMITTED ${label}: ${hash}`);
  await appendFile(
    "data/live-demo-transactions.jsonl",
    JSON.stringify({ label, hash }) + "\n",
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== expected)
    throw new Error(`${label}: unexpected receipt ${receipt.status} ${hash}`);
  console.log(`CONFIRMED ${label}: ${hash} status=${receipt.status}`);
  return receipt;
}
if (mode === "fund") {
  const deployer = clients("DEPLOYER_PRIVATE_KEY");
  const mintAbi = parseAbi(["function mint(address to,uint256 amount)"]);
  for (const label of ["atlas", "delta"]) {
    const binding = JSON.parse(
      await readFile(`data/agent-${label}.json`, "utf8"),
    );
    await confirmed(
      `fund ${label} with 100 pUSD`,
      await deployer.wallet.writeContract({
        address: address("TOKEN_QUOTE"),
        abi: mintAbi,
        functionName: "mint",
        args: [binding.signer, 100n * 10n ** 18n],
      }),
    );
  }
} else if (mode === "intent") {
  await writeFile(
    "data/intent.json",
    JSON.stringify(
      {
        intentId: keccak256(toHex(`live-atlas-${Date.now()}`)),
        agentNode: agent.node,
        instrumentId: required("LIVE_INSTRUMENT_ID"),
        side: "buy",
        notional: "1000000000000000000",
        limitPrice: "1000000000000000000",
        maxSlippageBps: Math.min(100, agent.maxSlippageBps),
        deadline: Math.floor(Date.now() / 1000) + 1800,
      },
      null,
      2,
    ),
  );
  console.log("Prepared 1 pUSD Atlas buy intent");
} else if (mode === "revoke") {
  const taker = clients(agent.signerKey);
  const allocator = clients("ALLOCATOR_PRIVATE_KEY");
  const { order: raw, signature = "0x" } = JSON.parse(
    await readFile("data/maker-order.json", "utf8"),
  );
  const order = { ...raw, traits: BigInt(raw.traits) };
  const intent = {
    intentId: keccak256(toHex(`negative-atlas-${Date.now()}`)),
    agentNode: agent.node as Hex,
    instrumentId: required("LIVE_INSTRUMENT_ID") as Hex,
    side: 0,
    notional: 10n ** 18n,
    limitPrice: 10n ** 18n,
    maxSlippageBps: Math.min(100, agent.maxSlippageBps),
    deadline: Math.floor(Date.now() / 1000) + 1800,
  };
  await confirmed(
    "approve negative-test input",
    await taker.wallet.writeContract({
      address: address("TOKEN_QUOTE"),
      abi: erc20Abi,
      functionName: "approve",
      args: [address("AGENT_DESK_ADDRESS"), intent.notional],
    }),
  );
  const request = {
    account: taker.account,
    address: address("AGENT_DESK_ADDRESS"),
    abi: deskAbi,
    functionName: "execute" as const,
    args: [intent, order, signature] as const,
  };
  await publicClient.simulateContract(request);
  console.log(
    "Same negative-test payload succeeds in simulation before revocation",
  );
  const revokeHash = await allocator.wallet.writeContract({
    address: agent.registry,
    abi: registryAbi,
    functionName: "revokeRoles",
    args: [
      BigInt(agent.labelId),
      BigInt(required("ENS_ACTIVE_ROLE")),
      agent.signer,
    ],
  });
  await confirmed("revoke Atlas active role", revokeHash);
  let denied = false;
  try {
    await publicClient.simulateContract(request);
  } catch (error) {
    if (String(error).includes("authority denied")) denied = true;
    else throw error;
  }
  if (!denied)
    throw new Error("Revoked agent still passes execution simulation");
  console.log("Same payload now reverts with authority denied");
  const revertHash = await taker.wallet.sendTransaction({
    to: request.address,
    data: encodeFunctionData(request),
    gas: 1_000_000n,
  });
  const receipt = await confirmed(
    "mined negative-test revert",
    revertHash,
    "reverted",
  );
  const used = await publicClient.readContract({
    address: request.address,
    abi: parseAbi(["function used(bytes32) view returns(bool)"]),
    functionName: "used",
    args: [intent.intentId],
  });
  if (used) throw new Error("Reverted intent unexpectedly persisted");
  await writeFile(
    "data/revoke-demo.json",
    JSON.stringify(
      {
        agentNode: agent.node,
        intentId: intent.intentId,
        revokeHash,
        revertHash,
        revertBlock: receipt.blockNumber.toString(),
        reason: "authority denied",
        beforeRevocationSimulation: "success",
        afterRevocationSimulation: "authority denied",
        revertedIntentPersisted: used,
      },
      null,
      2,
    ),
  );
} else throw new Error("Usage: live-demo.ts fund|intent|revoke");
