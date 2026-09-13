import { parseAbi } from "viem";
import {
  address,
  clients,
  required,
  assertSepolia,
} from "../packages/config/src/index.js";
const price = BigInt(process.argv[2] ?? "0");
if (price <= 0n) throw new Error("Usage: price:mark PRICE_SCALED_1E18");
const { publicClient, wallet } = clients("PRICE_REPORTER_PRIVATE_KEY");
await assertSepolia(publicClient);
const hash = await wallet.writeContract({
  address: address("PRICE_MARKS_ADDRESS"),
  abi: parseAbi([
    "function mark(bytes32 instrumentId,uint256 price,uint48 observedAt)",
  ]),
  functionName: "mark",
  args: [
    required("LIVE_INSTRUMENT_ID") as `0x${string}`,
    price,
    Math.floor(Date.now() / 1000),
  ],
});
if (
  (await publicClient.waitForTransactionReceipt({ hash })).status !== "success"
)
  throw new Error("Mark reverted");
console.log(hash);
