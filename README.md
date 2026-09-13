# Provenance

**A fund that rewards how agents trade, with evidence anyone can recompute.**

Provenance is a Sepolia-first research application that connects agent identity,
programmable execution, deterministic process rewards, and adaptive capital
allocation. ENSv2 controls who may trade, Aqua and SwapVM execute trades, and a
Substreams oracle turns public execution events into reward vectors.

The repository includes a working local demo and configurable live integrations.
**Sepolia deployments, hosted-provider verification, package publication, and
live reproducibility evidence are still pending external setup.** See the
[implementation status](docs/IMPLEMENTATION_STATUS.md) for the precise boundaries.

## What the app does

- **Fund dashboard:** equity, verified process scores, agent allocations, reward
  history, and hire/promote/retire activity, with agents identified by ENS names.
- **Interactive presentation:** a frosted-image hero that reveals along the
  cursor path, Framer Motion entrances and allocation updates, responsive layouts,
  and static fallbacks for reduced motion and unavailable WebGL.
- **Enforced execution:** an agent desk and custom SwapVM opcode check authority
  and trade limits; revoking authority blocks the next fill.
- **Recomputable rewards:** bounded Rust predicates score hedge efficacy,
  slippage, mandate respect, and price freshness from indexed execution evidence.
- **Adaptive agents:** structured LLM intents, a relative-ranking judge,
  discounted EXP3-style allocation, drift retirement, and drawdown controls.
- **Replay evidence:** a dashboard panel compares two runs over the same block
  range, showing payload previews and hashes when a live replay is available.
- **Wallet connection:** an injected browser wallet can connect and switch to
  Sepolia. A wallet is optional for viewing the demo.

## Run the local demo

### Requirements

- Node.js 22 and Corepack.
- pnpm 9.15.4, selected by the repository's `packageManager` setting.

The dashboard demo does not require RPC credentials, funded wallets, an LLM key,
Postgres, Foundry, or Rust.

```bash
corepack pnpm install --frozen-lockfile
```

For optional local settings, copy `.env.example` to `.env` **only if you do not
already have a local `.env`**. Keep `DATA_MODE=demo`. The default configuration
also runs without this file.

Start the backend:

```bash
corepack pnpm backend
```

In a second terminal, start the frontend:

```bash
corepack pnpm dev
```

Open **http://localhost:3000**. The backend listens on **http://localhost:3001**.
Keep both processes running. Demo rewards and lifecycle decisions are synthetic
and labeled accordingly; demo mode does not submit blockchain transactions.
The replay panel remains pending until real replay evidence is recorded.

### Build the frontend

```bash
corepack pnpm build:frontend
corepack pnpm exec next start packages/frontend
```

Run the backend separately as above. Public frontend environment values are
embedded at build time, so rebuild after changing them.

## Architecture

```text
Agent policy → Agent desk → Aqua / SwapVM settlement
                    ↑                 ↓
              ENSv2 authority    Sepolia events + price marks
                    ↑                 ↓
             Lifecycle actions ← Substreams reward oracle
                    ↑                 ↓
                Allocator ← Finalized reward stream
                                      ↓
                         Backend API + subgraph history
                                      ↓
                              Next.js dashboard
```

| Layer                  | Implementation                                                                 |
| ---------------------- | ------------------------------------------------------------------------------ |
| Identity and authority | ENSv2 registry/resolver/EAC adapter; local reference implementation            |
| Execution              | Solidity 0.8.30, Foundry, pinned official Aqua and SwapVM sources              |
| Reward oracle          | Rust, protobuf, Substreams map/store modules and WASM                          |
| Data plane             | JWT-authenticated Substreams CLI consumer and a Substreams-powered subgraph    |
| Intelligence           | TypeScript policy/judge, verified-score allocator, durable live Postgres state |
| Frontend               | Next.js, React, TypeScript, Tailwind CSS, Framer Motion, wagmi and viem        |

## Repository layout

| Path                                      | Purpose                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `contracts/`                              | Authority adapters, execution desk/router, market deployment scripts and tests   |
| `packages/ens/`                           | Fund/strategy/agent onboarding and lifecycle role operations                     |
| `packages/execution/`                     | Aqua liquidity setup and desk execution                                          |
| `packages/oracle/`                        | Protobuf schemas, reward predicates and Substreams module graph                  |
| `packages/subgraph/`                      | GraphQL schema and Substreams-powered subgraph manifest                          |
| `packages/backend/`                       | Policy, judge, allocator, persistence, streaming API and demo                    |
| `packages/frontend/`                      | Dashboard, wallet, reward ledger and replay evidence                             |
| `packages/frontend/components/ui/`        | Reusable UI components in a shadcn-compatible structure                          |
| `packages/config/` and `packages/shared/` | Configuration, shared schemas and contract ABIs                                  |
| `scripts/`                                | Onboarding, liquidity, trading, oracle and deployment commands                   |
| `docs/`                                   | Setup, configuration inventory, interface specifications and submission evidence |

Frontend styles live in `packages/frontend/app/globals.css`. The `@/` alias
resolves from the frontend directory. The reveal component uses locally served
reference textures; attribution and adaptation details are in its
[component README](packages/frontend/components/ui/README.md).

## Checks and tests

```bash
corepack pnpm check
corepack pnpm test:backend
corepack pnpm test:contracts
corepack pnpm oracle:test
corepack pnpm oracle:build
corepack pnpm build:frontend
```

Contract checks require Foundry. Oracle checks require Rust; install the WASM
target with `rustup target add wasm32-unknown-unknown`. The oracle build supplies
its protobuf compiler. Substreams CLI is needed for packing, streaming, and
replay, but not for Rust unit tests. The real ENS fork test skips until its live
configuration is present.

Recorded validation includes 12 passing Solidity tests, 8 backend tests, 6 Rust
tests, frontend/oracle/subgraph builds, and desktop/mobile browser checks.
The dashboard integration was checked for cursor reveal, allocation rendering,
reduced motion, and no-WebGL fallback. See
[implementation status](docs/IMPLEMENTATION_STATUS.md) for unverified live paths.

## Configure and deploy to Sepolia

Follow the [deployment runbook](docs/RUNBOOK.md) in order. Confirm a hosted Sepolia
Substreams provider before treating the live data plane as available. Supply
external values through local environment variables and agent configuration;
never paste private keys into source files or commit local environment files.

- [External requirements](docs/EXTERNAL_REQUIREMENTS.md): every configuration key,
  why it is needed, and where to obtain it.
- [Shared data model](docs/SHARED_DATA_MODEL.md): event interfaces, units, and
  reward semantics.
- [Dependency pins](docs/DEPENDENCY_PINS.md): upstream contract revisions,
  compatibility notes, and licenses.
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md): sponsor evidence,
  publication links, and video outline.

Docker and Compose files are included for deployment preparation. They require
configured services and oracle assets and have not been validated as a deployed
stack; use the local commands above for the credential-free demo.

## Troubleshooting

- **Dashboard stays on “Connecting”:** ensure the backend is running. The defaults
  expect frontend port 3000 and backend port 3001. For different ports, align
  `NEXT_PUBLIC_BACKEND_URL`, `BACKEND_PORT`, and `FRONTEND_ORIGIN`.
- **Wallet is unavailable:** install or enable an injected browser wallet. Viewing
  the dashboard does not require one.
- **The hero is static:** reduced-motion settings or missing WebGL2 intentionally
  select the static fallback. All dashboard data remains accessible.
- **Replay proof is pending:** run the configured live oracle twice over a range
  containing real fills using the runbook; synthetic demo data is not live proof.

## Research boundaries

The verified score excludes the off-chain LLM judge. Route regret is explicitly
stubbed and excluded. Hedge efficacy measures reduction in accumulated base-token
trade exposure toward zero. Price marks come from a public reporter for faucet
tokens; recomputability does not make those prices economically authoritative.
Offline improvement selects positive examples for future policy context rather
than updating model weights. This repository is a testnet research MVP.
