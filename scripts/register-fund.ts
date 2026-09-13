import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { erc20Abi, parseAbi, zeroAddress, zeroHash, type Hex } from "viem";
import {
  address,
  clients,
  required,
  assertSepolia,
} from "../packages/config/src/index.js";
const abi = parseAbi([
  "function ETH_REGISTRY() view returns(address)",
  "function isAvailable(string) view returns(bool)",
  "function MIN_REGISTER_DURATION() view returns(uint64)",
  "function MIN_COMMITMENT_AGE() view returns(uint64)",
  "function MAX_COMMITMENT_AGE() view returns(uint64)",
  "function getRegisterPrice(string,uint64,address) view returns(uint256,uint256)",
  "function makeCommitment(string,address,bytes32,address,address,uint64,bytes32) pure returns(bytes32)",
  "function commitmentAt(bytes32) view returns(uint64)",
  "function commit(bytes32)",
  "function register(string,address,bytes32,address,address,uint64,address,bytes32) returns(uint256)",
]);
const { publicClient, wallet } = clients("DEPLOYER_PRIVATE_KEY");
await assertSepolia(publicClient);
const registrar = address("ENS_ETH_REGISTRAR"),
  token = address("ENS_REGISTRATION_PAYMENT_TOKEN");
const owner = clients("ALLOCATOR_PRIVATE_KEY").account.address;
if (owner.toLowerCase() !== address("ALLOCATOR_ADDRESS").toLowerCase())
  throw Error("Allocator address mismatch");
const root = required("FUND_NAME");
if (root !== "veriprocess.eth")
  throw Error("This registration is scoped to veriprocess.eth");
const label = "veriprocess",
  duration = 31536000n;
const read = (functionName: string, args: readonly unknown[] = []) =>
  publicClient.readContract({
    address: registrar,
    abi,
    functionName,
    args,
  } as any);
if (
  String(await read("ETH_REGISTRY")).toLowerCase() !==
  address("ENS_FUND_PARENT_REGISTRY").toLowerCase()
)
  throw Error("Registrar parent mismatch");
if (!(await read("isAvailable", [label])))
  throw Error("Name not available; inspect owner before resuming");
if (duration < BigInt((await read("MIN_REGISTER_DURATION")) as bigint))
  throw Error("Duration below registrar minimum");
const [base, premium] = (await read("getRegisterPrice", [
  label,
  duration,
  token,
])) as [bigint, bigint];
const cost = base + premium;
if (premium !== 0n)
  throw Error("Registration has a premium; explicit review required");
console.log(
  "Registration owner",
  owner,
  "payment token",
  token,
  "cost (raw)",
  cost.toString(),
);
await mkdir("data", { recursive: true });
const checkpoint = "data/ens-registration.json";
let state: {
  registrar: string;
  owner: string;
  root: string;
  token: string;
  secret: Hex;
  commitHash?: Hex;
  registrationHash?: Hex;
};
try {
  state = JSON.parse(await readFile(checkpoint, "utf8"));
  if (
    state.registrar !== registrar ||
    state.owner !== owner ||
    state.root !== root ||
    state.token !== token
  )
    throw Error("Registration checkpoint mismatch");
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  state = {
    registrar,
    owner,
    root,
    token,
    secret: `0x${randomBytes(32).toString("hex")}`,
  };
}
const save = () =>
  writeFile(checkpoint, JSON.stringify(state, null, 2), { mode: 0o600 });
await save();
async function send(label: string, request: any) {
  const { request: simulated } = await publicClient.simulateContract({
    ...request,
    account: wallet.account,
  });
  const hash = await wallet.writeContract(simulated);
  console.log("SUBMITTED", label, hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw Error(`${label} reverted: ${hash}`);
  console.log("CONFIRMED", label, hash);
  return hash;
}
const phase = process.argv[2] || "prepare";
if (phase === "prepare") {
  const balance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet.account.address],
  });
  if (balance < cost)
    await send("mint registration faucet tokens", {
      address: token,
      abi: parseAbi(["function mint(address,uint256)"]),
      functionName: "mint",
      args: [wallet.account.address, cost - balance],
    });
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet.account.address, registrar],
  });
  if (allowance < cost)
    await send("approve registrar", {
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [registrar, cost],
    });
  const commitment = (await read("makeCommitment", [
    label,
    owner,
    state.secret,
    zeroAddress,
    zeroAddress,
    duration,
    zeroHash,
  ])) as Hex;
  const at = (await read("commitmentAt", [commitment])) as bigint;
  if (at === 0n) {
    state.commitHash = await send("registration commitment", {
      address: registrar,
      abi,
      functionName: "commit",
      args: [commitment],
    });
    await save();
  }
  console.log("MIN_COMMITMENT_AGE", String(await read("MIN_COMMITMENT_AGE")));
} else if (phase === "register") {
  const commitment = (await read("makeCommitment", [
    label,
    owner,
    state.secret,
    zeroAddress,
    zeroAddress,
    duration,
    zeroHash,
  ])) as Hex;
  const at = (await read("commitmentAt", [commitment])) as bigint;
  const block = await publicClient.getBlock();
  const age = block.timestamp - at;
  if (
    at === 0n ||
    age < BigInt((await read("MIN_COMMITMENT_AGE")) as bigint) ||
    age >= BigInt((await read("MAX_COMMITMENT_AGE")) as bigint)
  )
    throw Error("Commitment outside valid window");
  state.registrationHash = await send("register veriprocess.eth", {
    address: registrar,
    abi,
    functionName: "register",
    args: [
      label,
      owner,
      state.secret,
      zeroAddress,
      zeroAddress,
      duration,
      token,
      zeroHash,
    ],
  });
  await save();
} else throw Error("Use prepare or register");
