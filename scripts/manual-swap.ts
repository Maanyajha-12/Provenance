import { readFile, writeFile } from "node:fs/promises";
import { executeIntent } from "../packages/execution/src/execute.js";
import { parseIntent } from "../packages/backend/src/policy.js";
const { order, signature } = JSON.parse(
  await readFile(process.argv[3] ?? "data/maker-order.json", "utf8"),
);
const intent = parseIntent(
  JSON.parse(await readFile(process.argv[2] ?? "data/intent.json", "utf8")),
);
const receipt = await executeIntent(
  intent,
  { ...order, traits: BigInt(order.traits) },
  signature ?? "0x",
);
await writeFile(
  "data/manual-swap-receipt.json",
  JSON.stringify(
    receipt,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
console.log(receipt.transactionHash);
