import { test } from "node:test";
import assert from "node:assert/strict";
import { agentIdentityRecords } from "../src/identity.js";

test("identity exposes only the two ENSIP-26 record keys", () => {
  const records = agentIdentityRecords(
    "atlas.hedge.fund.eth",
    "https://agent.example.com/",
  );
  assert.deepEqual(Object.keys(records), [
    "agent-context",
    "agent-endpoint[web]",
  ]);
  assert.equal(
    JSON.parse(records["agent-context"]).name,
    "atlas.hedge.fund.eth",
  );
  assert.equal(records["agent-endpoint[web]"], "https://agent.example.com/");
});
test("invalid endpoint fails before onboarding writes", () => {
  for (const endpoint of [
    "",
    "/relative",
    "service metadata",
    "javascript:alert(1)",
  ])
    assert.throws(
      () => agentIdentityRecords("agent.fund.eth", endpoint),
      /AGENT_SERVICE_URL/,
    );
  assert.equal(
    agentIdentityRecords("agent.fund.eth", "ipfs://bafyexample")[
      "agent-endpoint[web]"
    ],
    "ipfs://bafyexample",
  );
});
