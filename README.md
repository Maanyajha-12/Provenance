Provenance — Phases 1–3

This repository delivers the foundation, ENS-style organization model, and mandate authority layer for a Sepolia-first agent fund. It intentionally stops before execution, Aqua liquidity, SwapVM, and the reward oracle.

## Delivered scope

### Phase 1 — foundations and provider gate

- pnpm/TypeScript workspace and Foundry contract project
- canonical intent, fill, and mandate interface contract
- environment validation and a Sepolia RPC/provider-gate command
- CI plus reproducible local contract tests

### Phase 2 — fund, strategy, and agent identity

- deterministic `fund → strategy → agent` hierarchy
- controller-owned metadata records aligned with ENSIP-26 fields
- onboarding command that outputs names, namehashes, controller, and metadata payload

### Phase 3 — authority and mandates

- allocator-only mandates: expiry, notional cap, slippage cap, instrument whitelist
- lifecycle operations: `hire`, `promote`, and `fire`
- fail-closed `IAgentAuthority` adapter for the future execution layer

## Quick start

```bash
cp .env.example .env
corepack pnpm install
corepack pnpm check:env
corepack pnpm check
forge test --root contracts
corepack pnpm agent:onboard momentum veriprocess.eth agent-01 0x000000000000000000000000000000000000a11c
```

`pnpm provider:gate` is the Phase 1 live-RPC check. It requires `SEPOLIA_RPC_URL`; a successful result must show chain ID `11155111`.

## Production boundary

The contracts are a complete local reference implementation with passing lifecycle tests. Before calling it an ENSv2 Sepolia deployment, replace the local registry and authority manager with verified ENSv2 Permissioned Registry, Permissioned Resolver, and Enhanced Access Control calls. The exact inputs and proof steps are in [external requirements](docs/EXTERNAL_REQUIREMENTS.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `contracts/` | identity registry, authority manager, stable authority adapter, tests |
| `packages/shared/` | canonical cross-layer data contract frozen in Phase 1 |
| `packages/ens/` | deterministic onboarding-plan generator |
| `scripts/` | environment and Sepolia provider checks |
| `docs/` | data contract, external requirements, and completion status |

## Verification

```bash
corepack pnpm check
forge test --root contracts
```

The test suite proves hierarchy ownership, agent-controlled identity records, mandate caps and whitelists, adapter authorization, revocation, and the hire → promote → fire lifecycle.
