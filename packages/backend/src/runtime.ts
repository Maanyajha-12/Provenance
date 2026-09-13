import { readFile, mkdir, appendFile } from "node:fs/promises";
import { createPublicClient, http, erc20Abi, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { Allocator, type Decision } from "./allocator.js";
import type { StateStore } from "./store.js";
import { authorityPort, type AgentBinding } from "../../ens/src/authority.js";
import { completeTrajectory, trajectoryProbability } from "./agents.js";
import { address, required } from "../../config/src/index.js";
export interface AgentConfig extends AgentBinding {
  signerKey: string;
  maxNotional: string;
  maxSlippageBps: number;
}
export interface Reward {
  id: string;
  agentNode: string;
  instrumentId: string;
  block: string;
  blockHash: string;
  txHash: string;
  verified: number;
  hedge: number;
  slippage: number;
  mandate: number;
  staleness: number;
  position: string;
  mark: string;
  routeRegretStub: boolean;
  intentId?: string;
}
export interface Lifecycle extends Omit<Decision, "action"> {
  action: Decision["action"] | "hire";
  id: string;
  status: "pending" | "confirmed";
  hash?: string;
  at: string;
  targetCap?: string;
}
export interface Snapshot {
  mode: "demo" | "live";
  allocator: Allocator;
  rewards: Reward[];
  lifecycle: Lifecycle[];
  lastBlock: string;
  processed: string[];
  error?: string;
  updatedAt: string;
}
export class Runtime {
  state: Snapshot;
  constructor(
    readonly agents: AgentConfig[],
    readonly store: StateStore,
    readonly mode: "demo" | "live",
    capital: number,
  ) {
    this.state = {
      mode,
      allocator: new Allocator(agents, capital),
      rewards: [],
      lifecycle: [],
      lastBlock: "0",
      processed: [],
      updatedAt: new Date().toISOString(),
    };
  }
  async init() {
    const saved = await this.store.load<Snapshot>();
    if (saved) {
      if (saved.mode !== this.mode) throw new Error("Datastore mode mismatch");
      const allocator = Object.assign(
        new Allocator(this.agents, saved.allocator.equity),
        saved.allocator,
      );
      this.state = { ...saved, allocator };
      for (const d of this.state.lifecycle) {
        if (d.status === "confirmed" && d.action === "promote" && d.targetCap) {
          const a = this.agents.find((a) => a.node === d.node);
          if (a) a.maxNotional = d.targetCap;
        }
      }
    }
    if (!saved) {
      for (const agent of this.agents) {
        if (this.mode === "live") {
          if (!agent.enrollmentTx) continue;
          const client = createPublicClient({
            chain: sepolia,
            transport: http(required("SEPOLIA_RPC_URL")),
          });
          const receipt = await client.getTransactionReceipt({
            hash: agent.enrollmentTx,
          });
          if (
            receipt.status !== "success" ||
            receipt.to?.toLowerCase() !== agent.registry.toLowerCase()
          )
            throw new Error("Invalid enrollment receipt");
        }
        this.state.lifecycle.push({
          id: `hire:${agent.node}`,
          node: agent.node,
          action: "hire",
          reason: "Agent enrollment",
          status: "confirmed",
          hash: agent.enrollmentTx,
          at: new Date().toISOString(),
        });
      }
    }
    await this.flush();
  }
  async flush() {
    this.state.updatedAt = new Date().toISOString();
    await this.store.save(this.state);
  }
  async equity(reward: Reward): Promise<number> {
    if (this.mode === "demo") return this.state.allocator.equity;
    const price = BigInt(reward.mark);
    if (price <= 0n) throw new Error("Missing mark; allocation paused");
    const client = createPublicClient({
      chain: sepolia,
      transport: http(required("SEPOLIA_RPC_URL")),
    });
    const totals = await Promise.all(
      this.agents.map(async (agent) => {
        const [base, quote] = await Promise.all(
          [address("TOKEN_BASE"), address("TOKEN_QUOTE")].map((token) =>
            client.readContract({
              address: token,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [agent.signer],
              blockNumber: BigInt(reward.block),
            }),
          ),
        );
        return quote + (base * price) / 10n ** 18n;
      }),
    );
    return Number(totals.reduce((a, b) => a + b, 0n)) / 1e18;
  }
  async ingest(raw: Reward) {
    const r = { ...raw, agentNode: raw.agentNode?.toLowerCase() };
    if (
      !/^0x[\da-f]{64}$/i.test(r.id) ||
      !/^\d+$/.test(String(r.block)) ||
      !Number.isInteger(r.verified) ||
      r.verified < 0 ||
      r.verified > 10000
    )
      throw new Error("Invalid provider reward");
    if (
      BigInt(r.block) < BigInt(this.state.lastBlock) ||
      this.state.processed.includes(r.id)
    )
      return;
    if (!this.agents.some((a) => a.node.toLowerCase() === r.agentNode)) return;
    const equity = await this.equity(r);
    const decisions = this.state.allocator.observe(
      r.agentNode,
      r.verified / 10000,
      equity,
      r.intentId
        ? await trajectoryProbability(r.intentId, r.txHash)
        : undefined,
    );
    this.state.processed.push(r.id);
    this.state.rewards.push(r);
    this.state.rewards = this.state.rewards.slice(-500);
    this.state.lastBlock = String(r.block);
    for (const d of decisions)
      this.state.lifecycle.push({
        ...d,
        targetCap:
          d.action === "promote"
            ? (
                (BigInt(
                  this.agents.find((a) => a.node === d.node)!.maxNotional,
                ) *
                  125n) /
                100n
              ).toString()
            : undefined,
        id: `${r.id}:${d.node}:${d.action}`,
        status: "pending",
        at: new Date().toISOString(),
      });
    delete this.state.error;
    await this.flush();
    if (r.intentId) await completeTrajectory(r.intentId, r.verified / 10000);
    await this.drain();
  }
  async drain() {
    for (const decision of this.state.lifecycle.filter(
      (d) => d.status === "pending",
    )) {
      const agent = this.agents.find((a) => a.node === decision.node)!;
      if (this.mode === "live") {
        const port = authorityPort();
        decision.hash =
          decision.action === "retire"
            ? await port.retire(agent)
            : await port.promote(
                agent,
                BigInt(decision.targetCap ?? agent.maxNotional),
                agent.maxSlippageBps,
                Math.floor(Date.now() / 1000) + 86400,
              );
      }
      decision.status = "confirmed";
      if (decision.action === "promote" && decision.targetCap)
        agent.maxNotional = decision.targetCap;
      await this.flush();
    }
  }
}
export async function loadAgents(): Promise<AgentConfig[]> {
  const agents = JSON.parse(
    await readFile(required("AGENTS_CONFIG_PATH"), "utf8"),
  ) as AgentConfig[];
  if (!Array.isArray(agents) || !agents.length)
    throw new Error("Agents configuration is empty");
  for (const a of agents) {
    if (
      !/^0x[\da-f]{64}$/i.test(a.node) ||
      !/^0x[\da-f]{40}$/i.test(a.signer) ||
      !/^\d+$/.test(a.maxNotional) ||
      !Number.isInteger(a.maxSlippageBps)
    )
      throw new Error("Invalid agent binding");
    a.node = a.node.toLowerCase() as Hex;
  }
  return agents;
}
export async function logTrajectory(record: unknown) {
  await mkdir("data", { recursive: true });
  await appendFile(
    "data/trajectories.jsonl",
    JSON.stringify(record, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ) + "\n",
  );
}
