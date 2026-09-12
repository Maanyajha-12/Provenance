# Phase 1–3 status

| Phase | Local implementation | Verified by | Live Sepolia gate |
| --- | --- | --- | --- |
| 1 | workspace, schemas, environment checks, RPC gate, CI | TypeScript check | Sepolia RPC and hosted Substreams credentials return live blocks |
| 2 | hierarchy registry, metadata records, onboarding plan | identity contract test | verified ENSv2 registry/resolver deployment and registered namespace |
| 3 | mandate engine, lifecycle operations, authority adapter | authority contract tests | EAC grants/revokes and resolver mandate writes on Sepolia |

Phases 4–6 are intentionally out of scope and have no implementation in this repository.
