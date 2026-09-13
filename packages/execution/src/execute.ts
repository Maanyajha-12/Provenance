import { erc20Abi, type Hex } from "viem";
import { address, clients, assertSepolia } from "../../config/src/index.js";
import { deskAbi } from "../../shared/src/abi.js";
import type { TradeIntent } from "../../shared/src/schema.js";
export type Order = { maker: Hex; traits: bigint; data: Hex };
export async function executeIntent(
  intent: TradeIntent,
  order: Order,
  signature: Hex = "0x",
  signerKey = "AGENT_PRIVATE_KEY",
) {
  const { publicClient, wallet } = clients(signerKey);
  await assertSepolia(publicClient);
  const token = address(intent.side === "buy" ? "TOKEN_QUOTE" : "TOKEN_BASE");
  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [address("AGENT_DESK_ADDRESS"), intent.notional],
  });
  if (
    (await publicClient.waitForTransactionReceipt({ hash })).status !==
    "success"
  )
    throw new Error("Approval failed");
  const { request } = await publicClient.simulateContract({
    account: wallet.account,
    address: address("AGENT_DESK_ADDRESS"),
    abi: deskAbi,
    functionName: "execute",
    args: [
      { ...intent, side: intent.side === "buy" ? 0 : 1 },
      order,
      signature,
    ],
  });
  const fillHash = await wallet.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: fillHash,
  });
  if (receipt.status !== "success") throw new Error("Execution reverted");
  return receipt;
}
