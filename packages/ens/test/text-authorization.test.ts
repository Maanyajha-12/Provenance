import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, decodeFunctionData, toHex } from "viem";
import { packetToBytes } from "viem/ens";
import { resolverAbi } from "../../shared/src/abi.js";

test("resolver text authorization accepts the DNS wire name and exact ENSIP-26 key", () => {
  const name = toHex(packetToBytes("atlas.momentum.veriprocess.eth"));
  assert.equal(
    name,
    "0x0561746c6173086d6f6d656e74756d0b7665726970726f636573730365746800",
  );
  const data = encodeFunctionData({
    abi: resolverAbi,
    functionName: "authorizeTextRoles",
    args: [
      name,
      "agent-endpoint[web]",
      "0x1111111111111111111111111111111111111111",
      true,
    ],
  });
  const decoded = decodeFunctionData({ abi: resolverAbi, data });
  assert.equal(decoded.functionName, "authorizeTextRoles");
  assert.deepEqual(decoded.args, [
    name,
    "agent-endpoint[web]",
    "0x1111111111111111111111111111111111111111",
    true,
  ]);
});
