import { parseAbi } from "viem";
export const deskAbi = parseAbi([
  "function execute((bytes32 intentId,bytes32 agentNode,bytes32 instrumentId,uint8 side,uint256 notional,uint256 limitPrice,uint16 maxSlippageBps,uint48 deadline) i,(address maker,uint256 traits,bytes data) order,bytes signature) returns (bytes32)",
  "event Intent(bytes32 indexed intentId,bytes32 indexed agentNode,bytes32 indexed instrumentId,uint8 side,uint256 notional,uint256 limitPrice,uint16 maxSlippageBps,uint48 deadline)",
  "event Fill(bytes32 indexed intentId,bytes32 indexed fillId,bytes32 indexed agentNode,bytes32 instrumentId,uint256 executedNotional,uint256 executedPrice,uint256 fee,uint256 blockNumber)",
]);
export const registryAbi = parseAbi([
  "function getResource(uint256 id) view returns (uint256)",
  "function getTokenId(uint256 id) view returns (uint256)",
  "function getOwner(uint256 id) view returns (address)",
  "function getExpiry(uint256 id) view returns (uint64)",
  "function hasRoles(uint256 id,uint256 roles,address account) view returns (bool)",
  "function grantRoles(uint256 id,uint256 roles,address account) returns (bool)",
  "function revokeRoles(uint256 id,uint256 roles,address account) returns (bool)",
]);
export const resolverAbi = parseAbi([
  "function authorizeTextRoles(bytes toName,string key,address account,bool grant) returns (bool)",
  "function text(bytes32 node,string key) view returns (string)",
  "function setText(bytes32 node,string key,string value)",
]);
export const managerAbi = parseAbi([
  "function fire(bytes32 node)",
  "function promote(bytes32 node,uint48 validUntil,uint128 maxNotional,uint16 maxSlippageBps)",
  "function setActive(bytes32 node,bool active)",
]);
