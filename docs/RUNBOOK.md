# Runbook

## Credential-free local demo

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env
pnpm backend
# In another terminal:
pnpm dev
```

Open http://localhost:3000. The dashboard labels synthetic mode. No transaction is submitted. The replay panel stays pending until there is a recorded live proof.

## Validation

```bash
pnpm check
node --import tsx --test packages/backend/test/*.test.ts
forge test --root contracts
pnpm oracle:test
pnpm oracle:build
pnpm build:frontend
```

The optional live fork test skips without Sepolia RPC and ENS_AUTHORITY_ADAPTER. Populate LIVE_AGENT_NODE and LIVE_INSTRUMENT_ID for a previously hired agent to exercise real role reads/revocation on an ephemeral fork.

## Ordered live setup

1. Populate RPC/provider inputs; run `pnpm provider:gate`. Separately run Substreams against the hosted Sepolia endpoint and keep its output. RPC success alone is insufficient.
2. Obtain a fund root name, set ENS_FUND_PARENT_REGISTRY to its parent registry, then run `pnpm ens:setup-root` as the allocator owner. It deploys a UserRegistry proxy through the official factory and attaches it to the name. Set the printed ENS_FUND_REGISTRY. Pin the beta implementation addresses and EAC role bitmap.
3. Configure or deploy official-source Aqua and 18-decimal test tokens. `forge script contracts/script/DeployTestMarket.s.sol:DeployTestMarket --root contracts --rpc-url "$SEPOLIA_RPC_URL" --broadcast` deploys the pinned Aqua and faucet tokens. Fund individual agents and maker with both tokens and Sepolia ETH.
4. Set AUTHORITY_MODE=ensv2. Run DeployFund similarly with `--broadcast`. Save its printed addresses and actual deployment block into `.env`.
5. Run `pnpm ens:deploy-agent momentum atlas AGENT_ADDRESS` for each agent. This deploys the strategy registry when absent, an individual resolver, identity/mandate records, adapter binding, active role and desk signer. Combine the emitted agent binding files into AGENTS_CONFIG_PATH; assign a different signerKey per agent.
6. Run `pnpm aqua:seed`. This approves Aqua and calls the official SDK ship flow, writing `data/maker-order.json`. Maker remains self-custodial. Repeated seeding of the same immutable strategy requires docking it first.
7. Publish a current 1e18-scaled price using `pnpm price:mark 1000000000000000000`. Put a valid canonical intent in `data/intent.json` and run `pnpm swap:manual data/intent.json`. Archive the fill transaction.
8. Set oracle addresses and start block. Run `pnpm oracle:configure`, `pnpm oracle:build`, `pnpm oracle:pack`, and `pnpm oracle:stream`. Only a hosted authenticated run establishes live provider evidence.
9. Authenticate to substreams.dev with `substreams login`, then run `pnpm oracle:publish`. Create a Studio subgraph; install the Graph CLI and run `pnpm subgraph:deploy`. Verify a real GraphQL query before configuring SUBGRAPH_QUERY_URL.
10. Provision Postgres, configure individual signers and LLM, set DATA_MODE=live. Start the backend. Enable ENABLE_AGENT_EXECUTION=true to submit LLM-generated trades. Keep reporter marks fresh (at most 60 seconds old). The finality-delayed reward stream drives drift retirement, allocation and EAC lifecycle operations.
11. Run `pnpm oracle:reproduce START STOP` for a finalized range containing fills. The exclusive STOP and package hash are recorded with both payload hashes. Empty output does not qualify.
12. After at least two completed trajectory logs, run `pnpm policy:improve`. The resulting positive-example context is loaded on later policy rounds. Record the comparison in your demo.
13. Set browser-safe frontend environment at build time, build/start Next, record the submission video, and fill SUBMISSION_CHECKLIST.md.

## Operating limits

- The oracle assumes indexing begins before the first fund fill; exposure is cumulative desk-trade exposure, not arbitrary external wallet transfers.
- Use a dedicated database per deployment. The advisory lock prevents two allocators using it concurrently. Restart resumes finalized blocks and skips persisted fill IDs.
- Pending retirements are persisted before sending a transaction and retried before streaming resumes. Revoke is idempotent. Promotions revoke first, change records, then grant, so partial writes leave trading disabled.
- The current maker program uses an XYC curve with a maker minimum-rate guard. It can reject the reverse direction when the guarded rate is unfavorable; seed separate directional strategies with appropriate rates for a wider market.
- Allocations constrain future action sizes; they are not ERC20 custody transfers. Individual funded signer wallets hold assets. NAV reads those wallets at finalized reward blocks using the public mark.
- Reporter and signer services require operational monitoring. No deployment, registry publication, or public video has been claimed by local validation.

## Signed maker orders

The default market uses Aqua `ship()` authorization. For signature-mode demonstrations, use ProgramFactory.buildSigned to build a static-balance maker order, approve the router from the maker for its output token, and run `pnpm order:sign ORDER_JSON`. The signer verifies that its EIP-712 digest equals the deployed router hash before producing a signature. `pnpm swap:manual INTENT_JSON ORDER_JSON` accepts the signature from that order file. The desk only accepts the fee-free canonical Aqua/signed program shapes, so its separately attributed fee is zero; price includes the XYC curve impact.

If your shell has no pnpm shim, use `corepack pnpm` in place of `pnpm` in these commands.
