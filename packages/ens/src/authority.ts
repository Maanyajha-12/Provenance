import { parseAbi, type Hex } from "viem";
import {
  address,
  clients,
  required,
  assertSepolia,
} from "../../config/src/index.js";
import { registryAbi, resolverAbi, managerAbi } from "../../shared/src/abi.js";
export interface AgentBinding {
  node: Hex;
  name: string;
  registry: Hex;
  resolver: Hex;
  labelId: string;
  signer: Hex;
  enrollmentTx?: Hex;
}
export interface AuthorityPort {
  retire(agent: AgentBinding): Promise<Hex>;
  promote(
    agent: AgentBinding,
    cap: bigint,
    slippage: number,
    expiry: number,
  ): Promise<Hex>;
}
export function authorityPort(): AuthorityPort {
  const { publicClient, wallet } = clients("ALLOCATOR_PRIVATE_KEY");
  const send = async (request: Parameters<typeof wallet.writeContract>[0]) => {
    await assertSepolia(publicClient);
    const hash = await wallet.writeContract(request);
    if (
      (await publicClient.waitForTransactionReceipt({ hash })).status !==
      "success"
    )
      throw new Error("Lifecycle transaction reverted");
    return hash;
  };
  if (required("AUTHORITY_MODE") === "local")
    return {
      retire: (a) =>
        send({
          address: address("AUTHORITY_MANAGER_ADDRESS"),
          abi: managerAbi,
          functionName: "fire",
          args: [a.node],
        }),
      promote: (a, cap, slip, expiry) =>
        send({
          address: address("AUTHORITY_MANAGER_ADDRESS"),
          abi: managerAbi,
          functionName: "promote",
          args: [a.node, expiry, cap, slip],
        }),
    };
  if (required("AUTHORITY_MODE") !== "ensv2")
    throw new Error("Unknown authority mode");
  return {
    retire: (a) =>
      send({
        address: a.registry,
        abi: registryAbi,
        functionName: "revokeRoles",
        args: [
          BigInt(a.labelId),
          BigInt(required("ENS_ACTIVE_ROLE")),
          a.signer,
        ],
      }),
    async promote(a, cap, slip, expiry) {
      // Revoke first so partially applied record edits cannot authorize an intermediate mandate.
      await send({
        address: a.registry,
        abi: registryAbi,
        functionName: "revokeRoles",
        args: [
          BigInt(a.labelId),
          BigInt(required("ENS_ACTIVE_ROLE")),
          a.signer,
        ],
      });
      for (const [key, value] of Object.entries({
        "fund.maxNotional": cap.toString(),
        "fund.maxSlippageBps": String(slip),
        "fund.validUntil": String(expiry),
      }))
        await send({
          address: a.resolver,
          abi: resolverAbi,
          functionName: "setText",
          args: [a.node, key, value],
        });
      const grantHash = await send({
        address: a.registry,
        abi: registryAbi,
        functionName: "grantRoles",
        args: [
          BigInt(a.labelId),
          BigInt(required("ENS_ACTIVE_ROLE")),
          a.signer,
        ],
      });
      // Revocation and re-grant both regenerate the token ID. Refresh the snapshot
      // only after the final grant; until then the old binding remains fail-closed.
      await send({
        address: address("ENS_AUTHORITY_ADAPTER"),
        abi: parseAbi([
          "function bind(bytes32,address,address,uint256,address)",
        ]),
        functionName: "bind",
        args: [a.node, a.registry, a.resolver, BigInt(a.labelId), a.signer],
      });
      return grantHash;
    },
  };
}
