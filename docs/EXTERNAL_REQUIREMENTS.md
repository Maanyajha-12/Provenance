# External requirements for a live Phase 1–3 Sepolia deployment

Do not commit these values and do not paste private keys into chat. Put secrets in `.env` on the deployment machine.

## Required for Phase 1

| Value | Purpose | Proof of completion |
| --- | --- | --- |
| `SEPOLIA_RPC_URL` | Read chain state and broadcast transactions | `pnpm provider:gate` reports `11155111` and a current block |
| Deployer wallet + Sepolia ETH | Deploy contracts and pay gas | explorer shows wallet balance and deployment transaction |
| `SUBSTREAMS_ENDPOINT` and `SUBSTREAMS_API_TOKEN` | Confirm the project can consume a hosted Sepolia stream later | provider returns a Sepolia block with a minimal Substreams command |

## Required for Phase 2

| Value | Purpose | Proof of completion |
| --- | --- | --- |
| ENSv2 Permissioned Registry address | Create the fund/strategy/agent hierarchy | fund and child names resolve on Sepolia |
| ENSv2 Permissioned Resolver address | Write identity metadata | agent name returns `name`, `role`, `service`, and `agentId` records |
| Fund namespace and controller authority | Own and administer the subname tree | allocator can mint an agent name in one transaction |

## Required for Phase 3

| Value | Purpose | Proof of completion |
| --- | --- | --- |
| ENSv2 EAC address and allocator role | Grant/revoke active authority and protect mandate writes | non-allocator update reverts; allocator update succeeds |
| Agent controller addresses | Bind each identity to its agent signer | adapter reflects grant, expiry, and revoke state |
| Mandate policy | allowed instruments, caps, slippage, expiry | resolver records and authority adapter return the same values |

## Deployment procedure after credentials are available

1. Copy `.env.example` to `.env` and fill the Phase 1 values.
2. Run `pnpm provider:gate`; stop if it is not Sepolia.
3. Verify current ENSv2 beta addresses from official documentation and set the three ENS variables.
4. Deploy/configure the ENSv2 integration adapter under the fund controller.
5. Register the fund, strategy, and agent names; write ENSIP-26 metadata records.
6. Grant allocator authority, set mandates, and run the grant/revoke proof on Sepolia.

The local `FundIdentityRegistry` and `AgentAuthorityManager` deliberately mirror this behavior for deterministic tests. They are not substitutes for verified ENSv2 beta contracts.
