# Provenance

A Sepolia-first agent fund with process rewards that can be recomputed from public execution events. ENSv2 controls agent authority, official-source Aqua and SwapVM execute trades, and a Rust Substreams oracle produces deterministic reward vectors. A backend allocates capital and submits lifecycle decisions; Next.js makes the loop visible.

Local execution tests use real pinned Aqua/SwapVM contracts. **No live deployment or sponsor qualification is claimed.** Credentials and deployment addresses remain placeholders.

## Start the credential-free demo

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env
pnpm backend
# In a second terminal:
pnpm dev
```

Open http://localhost:3000. Synthetic rewards, allocation changes and retirements are explicitly labeled demo data. The reproducibility panel stays pending until a real provider replay is recorded.

## Validate

```bash
pnpm check
pnpm test:backend
forge test --root contracts
pnpm oracle:test
pnpm oracle:build
pnpm build:frontend
```

Rust requires `wasm32-unknown-unknown`. Protobuf compiler binaries are supplied by the build dependency. Substreams CLI is needed for packing/streaming, not unit tests. The live ENS fork test skips without configured addresses.

## Continue to Sepolia

Follow [the runbook](docs/RUNBOOK.md) in order. Keep all external values in `.env` and [the agent binding configuration](config/agents.example.json); never commit secrets.

- [External requirements](docs/EXTERNAL_REQUIREMENTS.md): every configuration key, its purpose and source.
- [Implementation status](docs/IMPLEMENTATION_STATUS.md): tested local code versus outstanding live evidence.
- [Shared data model](docs/SHARED_DATA_MODEL.md): exact intent/fill schema, units and reward semantics.
- [Dependency pins](docs/DEPENDENCY_PINS.md): official source revisions and compatibility details.
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md): evidence links, sponsor checks and video outline.

## Layout

| Directory          | Purpose                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| contracts          | ENS adapter, execution desk, custom official SwapVM router, market and Foundry tests |
| packages/ens       | Deterministic onboarding, factory deployments and EAC lifecycle operations           |
| packages/execution | Aqua SDK shipping and typed desk execution                                           |
| packages/oracle    | Rust predicates, protobuf, Substreams DAG and entity sink                            |
| packages/subgraph  | Substreams-powered subgraph schema/manifest                                          |
| packages/backend   | LLM policy/judge, persistent allocator, live stream, API and demo                    |
| packages/frontend  | Dashboard, wallet connection, history and replay view                                |

The verifiable score excludes the LLM judge and the explicit route-regret stub. Public reporter marks describe faucet tokens; they do not claim an economically authoritative price. Offline improvement selects positive-advantage examples for future policy context, rather than claiming model-weight training.
