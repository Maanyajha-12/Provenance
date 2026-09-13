import { readFile, writeFile } from "node:fs/promises";
import { address, required } from "../packages/config/src/index.js";
const start = required("AGENT_DESK_START_BLOCK");
if (!/^\d+$/.test(start) || BigInt(start) <= 0n)
  throw new Error("Deployment start block required");
const authorities = required("ORACLE_AUTHORITY_ADDRESSES").split(",");
if (authorities.some((a) => !/^0x[\da-f]{40}$/i.test(a)))
  throw new Error("Invalid oracle authority addresses");
const source = await readFile("packages/oracle/substreams.yaml", "utf8");
const params = `desk=${address("AGENT_DESK_ADDRESS")}&marks=${address("PRICE_MARKS_ADDRESS")}&authority=${authorities.join(",")}`;
await writeFile(
  "packages/oracle/substreams.live.yaml",
  source
    .replace("initialBlock: 0", `initialBlock: ${start}`)
    .replace("desk=PLACEHOLDER&marks=PLACEHOLDER&authority=", params),
);
console.log(
  "Generated live manifest with configured deployment block and addresses.",
);
