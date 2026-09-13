import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime, type AgentConfig, type Reward } from "../src/runtime.js";
import type { StateStore } from "../src/store.js";
import { namehash, keccak256, toHex, zeroAddress } from "viem";
import { providerRewards } from "../src/stream.js";
class MemoryStore implements StateStore {
  value: unknown = null;
  async load<T>() {
    return this.value as T | null;
  }
  async save(v: unknown) {
    this.value = structuredClone(v);
  }
  async close() {}
}
const node = namehash("atlas.momentum.veriprocess.eth");
const agent: AgentConfig = {
  node,
  name: "atlas.momentum.veriprocess.eth",
  signer: zeroAddress,
  registry: zeroAddress,
  resolver: zeroAddress,
  labelId: "0",
  signerKey: "unused",
  maxNotional: "100",
  maxSlippageBps: 100,
};
const reward = (i: number, score = 1000): Reward => ({
  id: keccak256(toHex(`fill${i}`)),
  agentNode: node,
  instrumentId: keccak256(toHex("pBASE/pUSD")),
  block: String(i),
  blockHash: "hash",
  txHash: "tx",
  verified: score,
  hedge: 0,
  slippage: 10000,
  mandate: 10000,
  staleness: 10000,
  position: "1",
  mark: "1000000000000000000",
  routeRegretStub: true,
});
test("restart deduplicates fills and keeps retirement final", async () => {
  const store = new MemoryStore();
  const first = new Runtime([agent], store, "demo", 10000);
  await first.init();
  for (let i = 1; i <= 4; i++) await first.ingest(reward(i));
  assert.equal(
    first.state.lifecycle.filter((d) => d.action === "retire").length,
    1,
  );
  assert.equal(first.state.lifecycle[0].status, "confirmed");
  const second = new Runtime([agent], store, "demo", 10000);
  await second.init();
  await second.ingest(reward(4));
  assert.equal(second.state.rewards.length, 4);
  assert.equal(second.state.allocator.arms[0].allocation, 0);
  assert.equal(
    second.state.lifecycle.filter((d) => d.action === "retire").length,
    1,
  );
});
test("invalid rewards do not advance checkpoint", async () => {
  const r = new Runtime([agent], new MemoryStore(), "demo", 10000);
  await r.init();
  await assert.rejects(r.ingest({ ...reward(1), verified: NaN }));
  assert.equal(r.state.lastBlock, "0");
});
test("provider JSON defaults zero-valued omitted protobuf scores", () => {
  const [r] = providerRewards(
    JSON.stringify({
      "@module": "map_rewards",
      "@data": { rewards: [{ ...reward(1), verified: undefined }] },
    }),
  );
  assert.equal(r.verified, 0);
  assert.throws(() => providerRewards("{broken"));
});
