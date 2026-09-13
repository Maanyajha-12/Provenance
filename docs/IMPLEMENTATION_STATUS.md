# Implementation status

The local MVP implementation is complete and validated across the phase sequence. An authenticated hosted Substreams probe has now returned three finalized Sepolia blocks, with a block hash cross-checked against RPC. The fund name veriprocess.eth has now been registered on Sepolia; see [live deployment progress](LIVE_DEPLOYMENT.md). No live fund reward stream, registry publication, Studio deployment, public repository publication, or video upload has been performed by this build.

| Phase | Implemented                                                                                                                                                      | External evidence still required                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1     | Workspace, config validation, RPC/provider scripts, canonical data model                                                                                         | Wallet funding verification; RPC and hosted provider gate now passed                                                        |
| 2–3   | Local model preserved; actual ENSv2 registry/resolver/EAC ABI adapter; factory-based agent onboarding; record-scoped identity permission grants; fork-gated test | Deploy ENS tree and adapter, attach fund registry to owned name, prove role and resolution paths on beta |
| 4     | Pinned official Aqua source; test-token deployment; Aqua SDK ship script; real local token settlement                                                            | Fund maker and agents; ship on Sepolia                                                                   |
| 5     | Official SwapVMRouter subclass; custom opcode 250; official minimum-rate builder; desk with exact intent/fill schema and settlement event                        | Deploy router/desk, enroll agents, execute and revoke on Sepolia                                         |
| 6     | Rust protobuf oracle; event/mark/position/authority stores; bounded integer predicates; deterministic sorted entity output; WASM build and local tests           | Replay deployed desk blocks through hosted Sepolia provider                                              |
| 7     | Package manifest, pack/publish commands, JWT CLI stream, finalized-block backend consumer, Substreams-powered subgraph schema                                    | Hosted provider access; package publication; Studio support/deployment and GraphQL endpoint              |
| 8     | Structured LLM intents, relative ranking, normalized advantages, 90/10 fusion, trajectory logging and offline example-selection update                           | LLM provider configuration; completed on-chain trajectories                                              |
| 9     | Discounted EXP3-style allocator, verified-score drift, drawdown halt, durable Postgres state, pending ENS actions, agent execution scheduler                     | Allocator privileges, database, funded individual signers, live loop exercise                            |
| 10    | Next.js dashboard, streaming vectors/allocation/lifecycle, wallet connection, history query, replay evidence view                                                | Public links, recorded live replay, video, sponsor feedback                                              |

## Deliberate MVP boundaries

- Route regret is zero with an explicit stub flag and excluded from the verified score.
- Hedge efficacy measures reduction in absolute accumulated base-token trade exposure toward zero. It is not a portfolio beta or derivatives hedge model.
- Marks are public reporter transactions for faucet tokens. Recomputability does not make the reporter's price economically authoritative.
- Mandate respect compares each fill to the actual authority snapshot emitted immediately before execution. ENS events are also retained in a scoped store; the snapshot relies on the pinned adapter code rather than an independent reconstruction of every ENS inheritance rule.
- The offline improvement updates policy context by selecting positive-advantage examples. It does not claim to update model weights.
- Finalized-only streaming avoids acting on reversible head blocks, with a corresponding finality delay.
- Live actions remain unavailable until configuration is supplied; demo mode never submits transactions.

## Recorded validation

- TypeScript check passed for backend, ENS and execution scripts.
- Foundry: 12 passing tests, including 256 token-conservation fuzz cases, signed-order settlement, direct opcode revocation, desk revoke/replay/slippage tests, and preserved original tests. One real ENS fork test skipped because credentials/addresses are absent.
- Rust: 6 passing tests, including ABI log decoding, exclusion of failed transactions, bounded predicates and byte-identical protobuf entity output.
- Oracle builds to wasm32; Substreams CLI v1.22.0 packs the package successfully. Public package URL intentionally awaits publication.
- Graph CLI v0.98.1 builds the Substreams-powered subgraph manifest/schema successfully. Deployment helper argument parsing was checked without sending a deployment.
- Backend: 8 passing tests for allocation, drawdown, drift despite rising equity, judge normalization, input rejection, restart deduplication and provider JSON decoding.
- Next.js production build passed. Desktop and 390px mobile browser checks found no runtime errors or document overflow; SSE data renders correctly; a mock injected wallet successfully connected and switched from another chain to Sepolia.
- All detected runtime configuration keys are present in .env.example and EXTERNAL_REQUIREMENTS.md.
- PostgreSQL hosting, real LLM calls, real ENSv2 beta deployment, Sepolia streaming/replay, registry publication, Studio deployment, and the live closed-loop demonstration remain external validation steps. Docker files are provided but were not exercised here.

The local dashboard can be started with `corepack pnpm backend` and `corepack pnpm dev`. Live publication, videos and sponsor qualification remain unchecked until the recorded evidence exists.

## Phase 1 provider gate — verified 2026-09-13

- `corepack pnpm provider:gate` passed; RPC chain ID independently confirmed as **11155111** (head at gate: **11695649**).
- Authenticated `.tools/substreams run` returned finalized blocks **11695565–11695567**, exited **0**, and reported 3 processed / 3 received blocks.
- Block 11695567 hash `0x97737a1cd285fc0cfef9af73514f2c04a587b7179ff5350de1cee578863c9607` matched the Sepolia RPC.
- The probe used `map_events` with sentinel address filters and a ten-block processing limit. It proves hosted Sepolia block access, not deployed fund fills or live reward vectors.
- The configured CLI executable was unavailable; the successful run used the installed `.tools/substreams` binary. Set `SUBSTREAMS_BIN=.tools/substreams` for repository-root commands. No credentials were changed or recorded.
