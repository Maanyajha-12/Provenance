import "dotenv/config";

const optionalGates = [
  "SEPOLIA_RPC_URL",
  "SUBSTREAMS_ENDPOINT",
  "SUBSTREAMS_API_TOKEN",
  "ENS_PERMISSIONED_REGISTRY",
  "ENS_PERMISSIONED_RESOLVER",
  "ENS_EAC",
  "ALLOCATOR_ADDRESS",
];
const chainId = process.env.SEPOLIA_CHAIN_ID ?? "11155111";
if (chainId !== "11155111")
  throw new Error(`SEPOLIA_CHAIN_ID must be 11155111, received ${chainId}`);
console.log(
  JSON.stringify(
    {
      phase: 1,
      configured: Object.fromEntries(
        optionalGates.map((key) => [key, Boolean(process.env[key])]),
      ),
      nextGate:
        "Configure a Sepolia RPC and hosted Substreams credentials to close the Phase 1 provider gate.",
    },
    null,
    2,
  ),
);
