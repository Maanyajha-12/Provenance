import { AquaProtocolContract, Address, HexString } from "@1inch/aqua-sdk";
import { erc20Abi, parseAbi, type Hex } from "viem";
import { writeFile, mkdir } from "node:fs/promises";
import {
  address,
  clients,
  assertSepolia,
  required,
} from "../../config/src/index.js";
const factoryAbi = parseAbi([
  "function build(address maker,address tokenA,address tokenB,uint64 rateA,uint64 rateB) pure returns ((address maker,uint256 traits,bytes data) order,bytes strategy)",
]);
export async function seed() {
  const { account, publicClient, wallet } = clients("MAKER_PRIVATE_KEY");
  await assertSepolia(publicClient);
  const tokens = [address("TOKEN_BASE"), address("TOKEN_QUOTE")].sort((a, b) =>
    BigInt(a) < BigInt(b) ? -1 : 1,
  );
  const amount = BigInt(required("MAKER_SEED_AMOUNT"));
  if (amount <= 0n) throw new Error("Positive seed required");
  const [order, strategy] = await publicClient.readContract({
    address: address("PROGRAM_FACTORY_ADDRESS"),
    abi: factoryAbi,
    functionName: "build",
    args: [account.address, tokens[0], tokens[1], 1n, 1n],
  });
  for (const token of tokens) {
    if (
      (await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      })) !== 18
    )
      throw new Error("MVP instruments must use 18 decimals");
    if (
      (await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      })) < amount
    )
      throw new Error("Fund maker with both test tokens before seeding");
    const hash = await wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [address("AQUA_ADDRESS"), amount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Approval failed");
  }
  const tx = new AquaProtocolContract(
    new Address(address("AQUA_ADDRESS")),
  ).ship({
    app: new Address(address("SWAPVM_ROUTER_ADDRESS")),
    strategy: new HexString(strategy),
    amountsAndTokens: tokens.map((token) => ({
      token: new Address(token),
      amount,
    })),
  });
  const hash = await wallet.sendTransaction({
    to: address("AQUA_ADDRESS"),
    data: tx.data.toString() as Hex,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Ship failed");
  await mkdir("data", { recursive: true });
  await writeFile(
    "data/maker-order.json",
    JSON.stringify(
      { order, strategy, hash },
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );
  console.log(`Shipped Aqua strategy: ${hash}`);
}
