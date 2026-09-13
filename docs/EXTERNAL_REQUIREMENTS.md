# External requirements

Copy `.env.example` to `.env`. Blank values are intentional. Never paste keys or tokens into chat. Live commands validate their inputs; demo mode needs no credentials.

## Phase 1 — chain and provider gate

| Variable               | Purpose and source                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `SEPOLIA_RPC_URL`      | Sepolia RPC with historical balance reads; obtain from an RPC provider.                                      |
| `SEPOLIA_CHAIN_ID`     | Fixed Sepolia chain ID; clients reject other chains.                                                         |
| `DEPLOYER_PRIVATE_KEY` | Local funded deployment/setup signer; generate locally and use a Sepolia faucet.                             |
| `SUBSTREAMS_ENDPOINT`  | Hosted Sepolia endpoint from The Graph Market or Pinax; confirm availability and record a successful stream. |
| `SUBSTREAMS_API_TOKEN` | Hosted provider JWT; obtain from the provider account, passed through environment only.                      |
| `SUBSTREAMS_BIN`       | Installed Substreams CLI path; local validation used .tools/substreams v1.22.0.                              |

## Phases 2–3 — ENSv2 identity and authority

| Variable                                   | Purpose and source                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTHORITY_MODE`                           | local selects the existing manager; ensv2 selects actual registry/resolver/EAC calls.                                                   |
| `ENS_PERMISSIONED_REGISTRY`                | Official beta registry address from ENSv2 Sepolia docs; deployment inventory.                                                           |
| `ENS_PERMISSIONED_RESOLVER`                | Official configured resolver instance from ENSv2 docs; agents get individual proxies.                                                   |
| `ENS_EAC`                                  | EAC-capable contract for deployment inventory; EAC is inherited by registries and resolvers.                                            |
| `ENS_VERIFIABLE_FACTORY`                   | Official factory address from ENSv2 deployment docs; creates registry/resolver proxies.                                                 |
| `ENS_USER_REGISTRY_IMPLEMENTATION`         | Official UserRegistry implementation from ENSv2 docs.                                                                                   |
| `ENS_PERMISSIONED_RESOLVER_IMPLEMENTATION` | Official PermissionedResolver implementation from ENSv2 docs.                                                                           |
| `ENS_UNIVERSAL_RESOLVER`                   | Official Universal Resolver V2 for end-to-end name resolution checks.                                                                   |
| `ENS_ETH_REGISTRAR`                        | Official ETH Registrar used to obtain your root name; deployment inventory.                                                             |
| `ENS_FUND_PARENT_REGISTRY`                 | The parent Permissioned Registry containing your owned fund label; obtain from ENSv2 name ownership resolution. Used by ens:setup-root. |
| `ENS_FUND_REGISTRY`                        | Your UserRegistry attached to the owned fund root name; obtain from root setup.                                                         |
| `ENS_AUTHORITY_ADAPTER`                    | ENSv2Authority deployed by DeployFund; enrollment and optional fork test target.                                                        |
| `ENS_ACTIVE_ROLE`                          | Unused low-half EAC nybble role bit reserved for trading; choose against pinned role constants and grant its admin bit to allocator.    |
| `AUTHORITY_MANAGER_ADDRESS`                | Deployed local AgentAuthorityManager, used only in local authority mode.                                                                |
| `FUND_NAME`                                | Your registered root name; ownership must be established for live resolution.                                                           |
| `ALLOCATOR_ADDRESS`                        | Address derived locally from allocator private key; authority administrator.                                                            |
| `AGENT_SERVICE_URL`                        | Public agent service or dashboard URL for ENSIP-26 discovery records.                                                                   |
| `AGENT_INITIAL_NOTIONAL`                   | Initial raw input-token cap, default 100 tokens at 18 decimals.                                                                         |
| `AGENT_INITIAL_SLIPPAGE_BPS`               | Initial mandate slippage cap in basis points.                                                                                           |
| `LIVE_AGENT_NODE`                          | ENS namehash of active enrolled agent for optional live fork tests.                                                                     |
| `LIVE_INSTRUMENT_ID`                       | keccak256("pBASE/pUSD"), generated locally; shared by desk, marks, mandate, and agent policy.                                           |

## Phase 4 — market and custody

| Variable            | Purpose and source                                                                      |
| ------------------- | --------------------------------------------------------------------------------------- |
| `AQUA_ADDRESS`      | Verified official-source Aqua on Sepolia, or deploy pinned Aqua using DeployTestMarket. |
| `TOKEN_BASE`        | Sepolia pBASE faucet-token deployment; 18 decimals required.                            |
| `TOKEN_QUOTE`       | Sepolia pUSD faucet-token deployment; 18 decimals required.                             |
| `WETH_ADDRESS`      | Valid Sepolia WETH required by upstream router constructor; unwrap is not used.         |
| `MAKER_ADDRESS`     | Maker address funded by DeployTestMarket.                                               |
| `MAKER_PRIVATE_KEY` | Locally generated maker key funded with Sepolia ETH and both tokens.                    |
| `MAKER_SEED_AMOUNT` | Per-token Aqua virtual balance; default 10,000 tokens at 18 decimals.                   |
| `AGENT_PRIVATE_KEY` | Default individual agent signer, funded with ETH and input tokens; create locally.      |

## Phase 5 — programmable execution

| Variable                  | Purpose and source                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SWAPVM_ROUTER_ADDRESS`   | AuthoritySwapVMRouter deployment printed by DeployFund; pinned official implementation plus opcode 250. |
| `PROGRAM_FACTORY_ADDRESS` | ProgramFactory deployment printed by DeployFund; official instruction builder compatibility boundary.   |
| `AGENT_DESK_ADDRESS`      | AgentDesk deployment address printed by DeployFund; archive receipt and verify code.                    |

## Phases 6–7 — oracle and live data

| Variable                     | Purpose and source                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `AGENT_DESK_START_BLOCK`     | Desk deployment block; must precede every fill being indexed.                                 |
| `ORACLE_AUTHORITY_ADDRESSES` | Comma-separated actual registry/resolver/authority emitters; derive from deployment bindings. |
| `PRICE_MARKS_ADDRESS`        | Deployed PriceMarks address; public test-token mark event source.                             |
| `PRICE_REPORTER_ADDRESS`     | Account authorized in PriceMarks constructor.                                                 |
| `PRICE_REPORTER_PRIVATE_KEY` | Funded reporter signer; publish fresh public marks using price:mark.                          |
| `SUBGRAPH_QUERY_URL`         | GraphQL URL from the deployed Substreams-powered subgraph.                                    |
| `SUBGRAPH_DEPLOY_KEY`        | Subgraph Studio deployment credential; store locally.                                         |
| `SUBGRAPH_SLUG`              | Slug created in Subgraph Studio.                                                              |

## Phases 8–9 — intelligence and allocation

| Variable                 | Purpose and source                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `LLM_BASE_URL`           | OpenAI-compatible provider API base including version path; select an actual provider.           |
| `LLM_API_KEY`            | Provider-issued LLM API credential; server only.                                                 |
| `LLM_MODEL`              | Provider model identifier supporting JSON object responses.                                      |
| `ALLOCATOR_PRIVATE_KEY`  | Funded allocator signer with registry role-admin and resolver mandate permissions.               |
| `DATABASE_URL`           | Postgres connection string for durable live allocator state; provision local or hosted Postgres. |
| `AGENTS_CONFIG_PATH`     | Agent binding array; combine outputs of ens:deploy-agent.                                        |
| `FUND_INITIAL_CAPITAL`   | Initial NAV in whole pUSD matching funded wallets at the stream start.                           |
| `DATA_MODE`              | demo uses explicit synthetic data; live uses actual hosted stream and configured signers.        |
| `ENABLE_AGENT_EXECUTION` | Set true after setup to let the 30-second scheduler submit agent intents.                        |

## Phase 10 — dashboard

| Variable                      | Purpose and source                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `BACKEND_HOST`                | Backend bind address; use 0.0.0.0 inside Docker.                                    |
| `BACKEND_PORT`                | Read-only API and event-stream port.                                                |
| `FRONTEND_ORIGIN`             | Allowed browser origin for API CORS.                                                |
| `NEXT_PUBLIC_BACKEND_URL`     | Public browser-facing backend URL; set before Next build.                           |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Browser-safe RPC for wallet connection; never expose privileged server credentials. |

## Agent configuration file

Each entry has `node` (namehash), `name` (full ENS name), `registry`, `resolver`, `labelId` (decimal label hash), `signer` (funded address), `signerKey` (name of its private-key environment variable), `maxNotional` (decimal raw input-token cap), and `maxSlippageBps` (integer). Use distinct signers. Additional names such as `AGENT_02_PRIVATE_KEY` follow the same requirements as `AGENT_PRIVATE_KEY`; each is explicitly referenced by `signerKey`. No signer keys are returned by the API.

## Accounts and qualification evidence

- Obtain hosted access from [The Graph Market](https://thegraph.market/) or [Pinax](https://pinax.network/). A successful RPC check alone does not satisfy the provider gate.
- Pin ENSv2 Sepolia addresses against [official docs](https://docs.ens.domains/ensv2/) and DEPENDENCY_PINS.md. The root name must own its configured subregistry. Agents receive record-scoped identity permissions, never root resolver administration that could override mandates.
- Run `substreams login` for registry publication; CLI-managed registry credentials are separate from the streaming JWT.
- Confirm [Studio](https://thegraph.com/studio/) supports your Sepolia Substreams-powered subgraph deployment. A compatible Graph Node is the fallback sink, retaining the hosted live provider.
- Default instrument universe is one pBASE/pUSD pair, both faucet tokens with 18 decimals. Aqua ship assigns virtual balances; balances stay in maker wallet. Public reporter marks are reproducible test data, not trustless market prices.
- Injected-wallet connection requires no WalletConnect account. Public repository URL, video URL, and feedback artifacts are tracked in SUBMISSION_CHECKLIST.md; none is fabricated.

## Optional Docker database

`POSTGRES_PASSWORD`: locally chosen Postgres password for compose.yaml. Set DATABASE_URL to the matching `postgresql://provenance:<password>@postgres:5432/provenance` connection inside Docker. Compose requires a configured package and Substreams binary for the backend mounts; use the two-process local demo when these have not been generated.

`SUBGRAPH_DEPLOY_URL` and `SUBGRAPH_IPFS_URL`: Studio (or compatible Graph Node) deployment and IPFS endpoints; defaults in .env.example come from Graph CLI. The deployment script reads both from configuration and invokes Graph CLI in-process to keep credentials out of OS arguments.

Optional agent JSON `enrollmentTx` is the successful EAC active-role grant transaction emitted by ens:deploy-agent. The backend verifies its receipt and displays the hire in the lifecycle feed.
