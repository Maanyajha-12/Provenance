import { readFile } from "node:fs/promises";
import { executeIntent } from "../packages/execution/src/execute.js";
import { parseIntent } from "../packages/backend/src/policy.js";
const { order, signature } = JSON.parse(
  await readFile(process.argv[3] ?? "data/maker-order.json", "utf8"),
);
const intent = parseIntent(
  JSON.parse(await readFile(process.argv[2] ?? "data/intent.json", "utf8")),
);
console.log(
  (
    await executeIntent(
      intent,
      { ...order, traits: BigInt(order.traits) },
      signature ?? "0x",
    )
  ).transactionHash,
);
