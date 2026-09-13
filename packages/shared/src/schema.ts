export type Hex = `0x${string}`;

export interface Mandate {
  agentNode: Hex;
  maxNotional: bigint;
  maxSlippageBps: number;
  allowedInstruments: Hex[];
  validUntil: number;
}

export interface TradeIntent {
  intentId: Hex;
  agentNode: Hex;
  instrumentId: Hex;
  side: "buy" | "sell";
  notional: bigint;
  limitPrice: bigint;
  maxSlippageBps: number;
  deadline: number;
}

export interface Fill {
  fillId: Hex;
  intentId: Hex;
  agentNode: Hex;
  instrumentId: Hex;
  executedNotional: bigint;
  executedPrice: bigint;
  fee: bigint;
  blockNumber: bigint;
}

export function assertMandate(mandate: Mandate): void {
  if (mandate.maxNotional <= 0n)
    throw new Error("maxNotional must be positive");
  if (
    !Number.isInteger(mandate.maxSlippageBps) ||
    mandate.maxSlippageBps < 0 ||
    mandate.maxSlippageBps > 10_000
  ) {
    throw new Error("maxSlippageBps must be an integer between 0 and 10000");
  }
  if (mandate.validUntil <= Math.floor(Date.now() / 1000))
    throw new Error("mandate must not be expired");
  if (mandate.allowedInstruments.length === 0)
    throw new Error("mandate needs an instrument whitelist");
}
