# Shared event and mandate contract

Every layer joins on `agentNode`, the ENS namehash (not DNS wire encoding) of the agent's ENS name. IDs are `bytes32` hashes and monetary values are base units of the configured token.

| Record           | Required fields                                                                                              | Producer          | Consumer                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------ |
| Intent           | `intentId`, `agentNode`, `instrumentId`, `side`, `notional`, `limitPrice`, `maxSlippageBps`, `deadline`      | AgentDesk         | execution/indexing layer |
| Fill             | `intentId`, `fillId`, `agentNode`, `instrumentId`, `executedNotional`, `executedPrice`, `fee`, `blockNumber` | AgentDesk         | Substreams oracle        |
| Mandate          | `agentNode`, `maxNotional`, `maxSlippageBps`, `instrumentRoot`, `validUntil`                                 | allocator         | authority adapter        |
| Authority change | `agentNode`, `active`, `validUntil`, `actor`                                                                 | authority manager | Substreams               |

These records are frozen in Phase 1 so later layers can safely compose with them. The implemented Phase 1–3 invariant is that authority decisions are made from the active mandate at the current block.

## Exact execution event signatures

```solidity
event Intent(bytes32 indexed intentId, bytes32 indexed agentNode, bytes32 indexed instrumentId,
    uint8 side, uint256 notional, uint256 limitPrice, uint16 maxSlippageBps, uint48 deadline);
event Fill(bytes32 indexed intentId, bytes32 indexed fillId, bytes32 indexed agentNode,
    bytes32 instrumentId, uint256 executedNotional, uint256 executedPrice, uint256 fee, uint256 blockNumber);
```

`side` is 0 for buy, 1 for sell. Intent is emitted before swap execution in the same atomic transaction; reverted transactions leave neither intent nor fill logs. This is a pre-execution declaration, not a separate-transaction anti-front-running commitment. IDs are unique per desk and replay-protected. Fill IDs bind chain ID, desk address and intent ID.

Both test tokens use 18 decimals. Price is quote raw units per base raw unit scaled by 1e18. Notional is input-token raw units: quote for buy, base for sell. Buy minimum output is ceil(floor(notional × 1e18 / limitPrice) × (10000−slippage)/10000); sell uses floor(notional × limitPrice / 1e18) before the same cap. Caps are per-trade input-token caps, not a standardized USD risk measure. Execution price is derived from measured token settlement, never caller-reported fills.

Auxiliary events preserve the frozen Intent/Fill fields:

- `Settlement(intentId, baseAmount, quoteAmount)` records exact integer token amounts, avoiding position drift from rounded price calculations.
- `MandateSnapshot(agentNode, instrumentId, active, validUntil, maxNotional, maxSlippageBps, instrumentAllowed)` captures authority/resolver reads immediately before the trade.
- `PriceMark(instrumentId, price, observedAt)` publishes reporter prices for the faucet-token MVP.

The oracle pairs events within a transaction and checks node, instrument and notional identity. It reads stores at fill ordinals to avoid using later events from the same block. Position is cumulative signed base-token trade exposure from desk inception. Hedge score measures reduction of its absolute value toward zero. Mandate respect independently compares fill declarations to the emitted authority snapshot; the correctness of that snapshot relies on the pinned deployed adapter code. Original ENS events are retained for audit, not used to duplicate all EAC inheritance semantics.

All oracle math is integer-only. Predicate basis points: hedge −10000…10000; slippage/mandate/freshness 0 or 10000. Verified reward averages `(hedge+10000)/2`, slippage, mandate and freshness. Route regret is an explicitly flagged zero stub, excluded from the average. Off-chain fusion is 90% verified score plus 10% bounded normalized judge score. Only verified rewards update allocator weights.

Drift monitoring counts scores below 0.8 and retires after four degrading observations (healthy observations reduce the counter). The threshold deliberately detects deterioration among otherwise valid successful fills.
