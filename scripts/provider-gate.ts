import "dotenv/config";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const rpcUrl = process.env.SEPOLIA_RPC_URL;
if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL is required for the provider gate");
const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const [chainId, block] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
if (chainId !== 11155111) throw new Error(`Expected Sepolia (11155111), received ${chainId}`);
console.log(`PASS: Sepolia RPC reachable at block ${block}.`);
if (!process.env.SUBSTREAMS_ENDPOINT || !process.env.SUBSTREAMS_API_TOKEN) {
  console.log("PENDING: configure SUBSTREAMS_ENDPOINT and SUBSTREAMS_API_TOKEN to close the Phase 1 provider gate.");
} else {
  console.log("CONFIGURED: Substreams credentials present; validate with `substreams run` before Phase 6.");
}
