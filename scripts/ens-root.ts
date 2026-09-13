import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  parseAbi,
  keccak256,
  toHex,
  encodeFunctionData,
  parseEventLogs,
  type Address,
} from "viem";
import {
  address,
  required,
  clients,
  assertSepolia,
} from "../packages/config/src/index.js";
import { registryAbi } from "../packages/shared/src/abi.js";
const { publicClient, wallet, account } = clients("ALLOCATOR_PRIVATE_KEY");
await assertSepolia(publicClient);
const root = required("FUND_NAME");
const label = root.split(".")[0];
const id = BigInt(keccak256(toHex(label)));
const parent = address("ENS_FUND_PARENT_REGISTRY");
if (
  (
    await publicClient.readContract({
      address: parent,
      abi: registryAbi,
      functionName: "getOwner",
      args: [id],
    })
  ).toLowerCase() !== account.address.toLowerCase()
)
  throw new Error(
    "Allocator must own the root name in ENS_FUND_PARENT_REGISTRY",
  );
const abi = parseAbi([
  "function initialize(address account,uint256 roles)",
  "function setParent(address parent,string label)",
  "function setSubregistry(uint256 id,address registry)",
]);
const factoryAbi = parseAbi([
  "function deployProxy(address implementation,uint256 salt,bytes data) returns (address)",
  "event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)",
]);
const roles = (1n << 0n) | (1n << 8n) | (1n << 16n) | (1n << 20n) | (1n << 24n);
const all =
  roles | (roles << 128n) | (BigInt(required("ENS_ACTIVE_ROLE")) << 128n);
async function send(request: Parameters<typeof wallet.writeContract>[0]) {
  const hash = await wallet.writeContract(request);
  console.log(`SUBMITTED ${request.functionName}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Root setup reverted");
  console.log(`CONFIRMED ${request.functionName}: ${hash}`);
  return receipt;
}
await mkdir("data", { recursive: true });
let registry: Address;
try {
  const checkpoint = JSON.parse(
    await readFile("data/root-registry.json", "utf8"),
  );
  if (checkpoint.root !== root || checkpoint.parent !== parent)
    throw new Error("Root checkpoint belongs to another deployment");
  registry = checkpoint.registry;
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  const receipt = await send({
    address: address("ENS_VERIFIABLE_FACTORY"),
    abi: factoryAbi,
    functionName: "deployProxy",
    args: [
      address("ENS_USER_REGISTRY_IMPLEMENTATION"),
      BigInt(keccak256(toHex(`${root}:fund-registry`))),
      encodeFunctionData({
        abi,
        functionName: "initialize",
        args: [account.address, all],
      }),
    ],
  });
  const log = parseEventLogs({
    abi: factoryAbi,
    logs: receipt.logs,
    eventName: "ProxyDeployed",
  })[0];
  if (!log) throw new Error("Missing deployment event");
  registry = log.args.proxyAddress;
  console.log(`ENS_FUND_REGISTRY=${registry}`);
  await writeFile(
    "data/root-registry.json",
    JSON.stringify(
      { root, parent, registry, txHash: receipt.transactionHash },
      null,
      2,
    ),
  );
}
await send({
  address: parent,
  abi,
  functionName: "setSubregistry",
  args: [id, registry],
});
await send({
  address: registry,
  abi,
  functionName: "setParent",
  args: [parent, label],
});
console.log(`ENS_FUND_REGISTRY=${registry}`);
