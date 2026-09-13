# Submission checklist

## Evidence links — fill after publishing

- Public repository: pending
- Sepolia desk/router/authority explorer links: pending
- Aqua ship and successful fill transaction: pending
- ENS hire/promote/retire transactions and name-resolution result: pending
- Substreams.dev published package: pending
- Live Graph-provider run and exact provider name: pending
- Subgraph GraphQL endpoint and sample history query: pending
- Replay proof, package SHA-256, block interval and two payload hashes: pending
- Two-to-four-minute video URL: pending
- Sponsor feedback files: pending; use the event's actual required forms/filenames

## Qualification checks

- [ ] The Graph: actual hosted Sepolia streaming, JWT authentication, public reusable package, reward history query, identical non-empty replay outputs.
- [ ] 1inch: pinned official Aqua and SwapVM source, Sepolia deployment, custom authority opcode, ProgramFactory instruction encoding, real token transfers, CoreInvariants-derived tests and live revoke→revert proof.
- [ ] ENSv2: actual beta UserRegistry/PermissionedResolver tree, current ENSIP-26 records, record-scoped permissions, lifecycle implemented as EAC role changes, transfers/expiry fail closed.
- [ ] Be explicit that route regret is stubbed, reporter marks concern faucet tokens, and the LLM judge cannot be recomputed from chain.
- [ ] Validate the event's current prize requirements directly before submission; this document is an implementation evidence checklist, not a claim of sponsor approval.

## Video outline (approximately 3 minutes)

1. 0:00–0:25 — Show ENS-named agents and explain process rewards versus P&L.
2. 0:25–1:00 — Show a maker Aqua position, one signed/authorized desk trade, and token movements on Sepolia.
3. 1:00–1:35 — Inspect the emitted reward vector and live provider stream; explain deterministic predicates and the route-regret stub.
4. 1:35–2:05 — Show allocation shifting and a drift retirement; inspect the EAC revocation and reverted next fill.
5. 2:05–2:35 — Replay the same finalized interval twice; compare payload and package hashes.
6. 2:35–3:00 — Show off-chain ranking/fusion and the offline positive-example update; distinguish this from chain-verifiable rewards and model-weight training.
