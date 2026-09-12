# Shared event and mandate contract

Every layer joins on `agentNode`, the DNS-encoded node of the agent's ENS name. IDs are `bytes32` hashes and monetary values are base units of the configured token.

| Record | Required fields | Producer | Consumer |
| --- | --- | --- | --- |
| Intent | `intentId`, `agentNode`, `instrumentId`, `side`, `notional`, `limitPrice`, `maxSlippageBps`, `deadline` | future execution desk | future execution/indexing layer |
| Fill | `intentId`, `fillId`, `agentNode`, `instrumentId`, `executedNotional`, `executedPrice`, `fee`, `blockNumber` | future execution desk | future indexing layer |
| Mandate | `agentNode`, `maxNotional`, `maxSlippageBps`, `instrumentRoot`, `validUntil` | allocator | authority adapter |
| Authority change | `agentNode`, `active`, `validUntil`, `actor` | authority manager | Substreams |

These records are frozen in Phase 1 so later layers can safely compose with them. The implemented Phase 1–3 invariant is that authority decisions are made from the active mandate at the current block.
