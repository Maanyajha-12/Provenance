import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  parseAbi,
  encodeFunctionData,
  parseEventLogs,
  namehash,
  keccak256,
  toHex,
  encodeAbiParameters,
  zeroAddress,
  type Hex,
  type Address,
} from "viem";
import {
  address,
  clients,
  required,
  assertSepolia,
} from "../../config/src/index.js";
import { registryAbi, resolverAbi } from "../../shared/src/abi.js";
const factoryAbi = parseAbi([
  "function deployProxy(address implementation,uint256 salt,bytes data)",
  "event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)",
]);
const userAbi = parseAbi([
  "function initialize(address rootAccount,uint256 roles)",
  "function register(string label,address owner,address registry,address resolver,uint256 roles,uint64 expiry) returns (uint256)",
  "function setParent(address parent,string label)",
  "function setSubregistry(uint256 id,address registry)",
  "function getSubregistry(string label) view returns(address)",
]);
const resolverInit = parseAbi([
  "function setAddr(bytes32 node,address account)",
  "function initialize(address admin,uint256 roles,bytes[] setters)",
]);
const bindAbi = parseAbi([
  "function bind(bytes32 node,address registry,address resolver,uint256 labelId,address signer)",
]);
const deskAbi = parseAbi(["function setAgent(bytes32 node,address account)"]);
const [strategy, agentLabel, signerArg] = process.argv.slice(2);
if (
  !strategy ||
  !agentLabel ||
  !/^0x[\da-f]{40}$/i.test(signerArg ?? "") ||
  ![strategy, agentLabel].every((x) => /^[a-z0-9-]+$/.test(x))
)
  throw new Error("Usage: ens:deploy-agent STRATEGY AGENT SIGNER_ADDRESS");
const { publicClient, wallet, account } = clients("ALLOCATOR_PRIVATE_KEY");
await assertSepolia(publicClient);
const deployer = clients("DEPLOYER_PRIVATE_KEY");
const signer = signerArg as Address;
const root = required("FUND_NAME");
const strategyName = `${strategy}.${root}`;
const agentName = `${agentLabel}.${strategyName}`;
const node = namehash(agentName);
const active = BigInt(required("ENS_ACTIVE_ROLE"));
const registrar =
  (1n << 0n) | (1n << 8n) | (1n << 16n) | (1n << 20n) | (1n << 24n);
const adminRoles = registrar | (registrar << 128n) | (active << 128n);
const textRole = 1n << 4n;
const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);
await mkdir("data", { recursive: true });
let checkpoint: Record<string, Hex> = {};
try {
  checkpoint = JSON.parse(
    await readFile(`data/ens-${strategy}-${agentLabel}.json`, "utf8"),
  );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
const save = () =>
  writeFile(
    `data/ens-${strategy}-${agentLabel}.json`,
    JSON.stringify(checkpoint, null, 2),
  );
async function send(request: Parameters<typeof wallet.writeContract>[0]) {
  const hash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("ENS transaction reverted");
  return receipt;
}
async function proxy(key: string, implementation: Address, data: Hex) {
  if (checkpoint[key]) return checkpoint[key];
  const receipt = await send({
    address: address("ENS_VERIFIABLE_FACTORY"),
    abi: factoryAbi,
    functionName: "deployProxy",
    args: [
      implementation,
      BigInt(keccak256(toHex(`${agentName}:${key}`))),
      data,
    ],
  });
  const log = parseEventLogs({
    abi: factoryAbi,
    logs: receipt.logs,
    eventName: "ProxyDeployed",
  })[0];
  if (!log) throw new Error("No ProxyDeployed event");
  checkpoint[key] = log.args.proxyAddress;
  await save();
  return checkpoint[key];
}
const fundRegistry = address("ENS_FUND_REGISTRY");
const existingStrategy = await publicClient.readContract({
  address: fundRegistry,
  abi: userAbi,
  functionName: "getSubregistry",
  args: [strategy],
});
const strategyRegistry =
  existingStrategy !== zeroAddress
    ? existingStrategy
    : await proxy(
        "strategyRegistry",
        address("ENS_USER_REGISTRY_IMPLEMENTATION"),
        encodeFunctionData({
          abi: userAbi,
          functionName: "initialize",
          args: [account.address, adminRoles],
        }),
      );
const resolver = await proxy(
  "resolver",
  address("ENS_PERMISSIONED_RESOLVER_IMPLEMENTATION"),
  encodeFunctionData({
    abi: resolverInit,
    functionName: "initialize",
    args: [account.address, textRole | (textRole << 128n) | 1n, []],
  }),
);
async function register(
  parent: Address,
  label: string,
  subregistry: Address,
  resolverAddress: Address,
) {
  const id = BigInt(keccak256(toHex(label)));
  const owner = await publicClient.readContract({
    address: parent,
    abi: registryAbi,
    functionName: "getOwner",
    args: [id],
  });
  if (owner === zeroAddress)
    await send({
      address: parent,
      abi: userAbi,
      functionName: "register",
      args: [
        label,
        account.address,
        subregistry,
        resolverAddress,
        adminRoles,
        expiry,
      ],
    });
  else if (owner.toLowerCase() !== account.address.toLowerCase())
    throw new Error("Name owned by another account");
}
await register(fundRegistry, strategy, strategyRegistry, zeroAddress);
await send({
  address: strategyRegistry,
  abi: userAbi,
  functionName: "setParent",
  args: [fundRegistry, strategy],
});
await register(strategyRegistry, agentLabel, zeroAddress, resolver);
await send({
  address: resolver,
  abi: resolverInit,
  functionName: "setAddr",
  args: [node, signer],
});
const identity: Record<string, string> = {
  name: agentName,
  description: "Provenance trading agent",
  "agent-context": JSON.stringify({
    name: agentName,
    role: "trading-agent",
    chainId: 11155111,
    service: required("AGENT_SERVICE_URL"),
  }),
  "agent-endpoint[web]": required("AGENT_SERVICE_URL"),
};
for (const [key, value] of Object.entries(identity)) {
  await send({
    address: resolver,
    abi: resolverAbi,
    functionName: "setText",
    args: [node, key, value],
  });
  const resource = BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }],
        [node, keccak256(toHex(key))],
      ),
    ),
  );
  await send({
    address: resolver,
    abi: registryAbi,
    functionName: "grantRoles",
    args: [resource, textRole, signer],
  });
}
const mandate = {
  "fund.maxNotional": required("AGENT_INITIAL_NOTIONAL"),
  "fund.maxSlippageBps": required("AGENT_INITIAL_SLIPPAGE_BPS"),
  "fund.validUntil": String(Math.floor(Date.now() / 1000) + 86400),
  [`fund.instrument.${required("LIVE_INSTRUMENT_ID").toLowerCase()}`]: "true",
};
for (const [key, value] of Object.entries(mandate))
  await send({
    address: resolver,
    abi: resolverAbi,
    functionName: "setText",
    args: [node, key, value],
  });
const labelId = BigInt(keccak256(toHex(agentLabel)));
await send({
  address: address("ENS_AUTHORITY_ADAPTER"),
  abi: bindAbi,
  functionName: "bind",
  args: [node, strategyRegistry, resolver, labelId, signer],
});
const enrollmentReceipt = await send({
  address: strategyRegistry,
  abi: registryAbi,
  functionName: "grantRoles",
  args: [labelId, active, signer],
});
const hash = await deployer.wallet.writeContract({
  address: address("AGENT_DESK_ADDRESS"),
  abi: deskAbi,
  functionName: "setAgent",
  args: [node, signer],
});
if (
  (await publicClient.waitForTransactionReceipt({ hash })).status !== "success"
)
  throw new Error("Desk registration reverted");
const binding = {
  node,
  name: agentName,
  registry: strategyRegistry,
  resolver,
  labelId: labelId.toString(),
  signer,
  signerKey: "AGENT_PRIVATE_KEY",
  enrollmentTx: enrollmentReceipt.transactionHash,
  maxNotional: mandate["fund.maxNotional"],
  maxSlippageBps: Number(mandate["fund.maxSlippageBps"]),
};
await writeFile(
  `data/agent-${agentLabel}.json`,
  JSON.stringify(binding, null, 2),
);
console.log(
  `Enrolled ${agentName}; binding saved to data/agent-${agentLabel}.json`,
);
