import "dotenv/config";
import {
  isAddress,
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
export function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value || /^(<|YOUR_|PLACEHOLDER)/i.test(value))
    throw new Error(`Configure ${key}; see docs/EXTERNAL_REQUIREMENTS.md`);
  return value;
}
export function address(key: string): Address {
  const value = required(key);
  if (!isAddress(value) || /^0x0{40}$/i.test(value))
    throw new Error(`Invalid ${key}`);
  return value;
}
export function clients(key: string) {
  const secret = required(key);
  if (!/^0x[0-9a-f]{64}$/i.test(secret)) throw new Error(`Invalid ${key}`);
  const account = privateKeyToAccount(secret as Hex);
  const transport = http(required("SEPOLIA_RPC_URL"));
  return {
    account,
    publicClient: createPublicClient({ chain: sepolia, transport }),
    wallet: createWalletClient({ account, chain: sepolia, transport }),
  };
}
export async function assertSepolia(
  client: ReturnType<typeof clients>["publicClient"],
) {
  if ((await client.getChainId()) !== 11155111)
    throw new Error("Sepolia required");
}
