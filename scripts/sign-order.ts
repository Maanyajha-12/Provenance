import { readFile, writeFile } from "node:fs/promises";
import { hashTypedData, parseAbi, type Hex } from "viem";
import {
  address,
  clients,
  assertSepolia,
} from "../packages/config/src/index.js";
const path = process.argv[2];
if (!path) throw new Error("Usage: order:sign ORDER_JSON");
const source = JSON.parse(await readFile(path, "utf8"));
const order = { ...source.order, traits: BigInt(source.order.traits) };
if ((order.traits & (1n << 254n)) !== 0n)
  throw new Error(
    "Aqua orders are authorized by ship(), not EIP-712 signatures",
  );
const { account, publicClient } = clients("MAKER_PRIVATE_KEY");
await assertSepolia(publicClient);
if (order.maker.toLowerCase() !== account.address.toLowerCase())
  throw new Error("Maker mismatch");
const typed = {
  domain: {
    name: "Provenance SwapVM",
    version: "1",
    chainId: 11155111,
    verifyingContract: address("SWAPVM_ROUTER_ADDRESS"),
  },
  types: {
    Order: [
      { name: "maker", type: "address" },
      { name: "traits", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
  },
  primaryType: "Order" as const,
  message: order,
};
const localHash = hashTypedData(typed);
const chainHash = await publicClient.readContract({
  address: address("SWAPVM_ROUTER_ADDRESS"),
  abi: parseAbi([
    "function hash((address maker,uint256 traits,bytes data) order) view returns(bytes32)",
  ]),
  functionName: "hash",
  args: [order],
});
if (localHash !== chainHash)
  throw new Error("Order/domain mismatch with deployed router");
const signature: Hex = await account.signTypedData(typed);
await writeFile(
  path,
  JSON.stringify({ ...source, signature, orderHash: chainHash }, null, 2),
);
console.log(`Signed order ${chainHash}`);
