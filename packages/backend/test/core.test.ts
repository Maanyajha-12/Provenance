import { test } from "node:test";
import assert from "node:assert/strict";
import { Allocator } from "../src/allocator.js";
import { normalizedAdvantages, fuse, parseIntent } from "../src/policy.js";
test("drift retires despite rising equity and retired allocation stays zero", () => {
  const a = new Allocator([
    { node: "a", name: "a" },
    { node: "b", name: "b" },
  ]);
  let decisions: ReturnType<Allocator["observe"]> = [];
  for (let i = 0; i < 4; i++) decisions = a.observe("a", 0.75, 10000 + i);
  assert.equal(decisions[0].action, "retire");
  assert.equal(a.arms[0].allocation, 0);
  a.observe("b", 1, 10010);
  assert.equal(a.arms[0].allocation, 0);
});
test("drawdown halts all arms and cannot automatically resume", () => {
  const a = new Allocator([{ node: "a", name: "a" }]);
  assert.equal(a.observe("a", 1, 8000)[0].action, "retire");
  a.observe("a", 1, 12000);
  assert.equal(a.arms[0].allocation, 0);
  assert.ok(a.halted);
});
test("verified rewards move capital and conserve budget", () => {
  const a = new Allocator([
    { node: "a", name: "a" },
    { node: "b", name: "b" },
  ]);
  for (let i = 0; i < 20; i++) {
    a.observe("a", 1, 10000);
    a.observe("b", 0.85, 10000);
  }
  assert.ok(a.arms[0].allocation > a.arms[1].allocation);
  assert.ok(
    Math.abs(a.arms.reduce((s, x) => s + x.allocation, 0) - 10000) < 1e-8,
  );
});
test("judge normalization is bounded at fusion and handles ties", () => {
  assert.deepEqual(normalizedAdvantages([1, 1]), [0, 0]);
  assert.deepEqual(normalizedAdvantages([0, 2]), [-1, 1]);
  assert.ok(fuse(0, 100) <= 0.1);
  assert.throws(() => fuse(NaN, 0));
});
test("malformed policy output rejected before execution", () => {
  assert.throws(() => parseIntent({}));
  assert.throws(() => parseIntent({ notional: "1e18" }));
});
