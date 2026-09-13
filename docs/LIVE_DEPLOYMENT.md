# Live Sepolia deployment progress

## 2026-09-13 — fund-name registration

- Fund: `veriprocess.eth`
- Registration signer: `0xb70177Cab65B7e5c8d896269AE209FE382E914C2`
- Registered owner: allocator `0xAf857298e9124D0989483Ec259ef3b222F8c2a6f`
- Parent: ETHRegistry `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2`
- Term: 31,536,000 seconds; quoted payment 8,000,021 raw MockUSDC units; no premium.
- Payment token: official Sepolia MockUSDC `0x768f42455a2d082e23ceef7d51e5787c82d67a39`.

Confirmed transactions:

| Action | Transaction |
| --- | --- |
| Mint registration payment | `0x554ee1064cad24858428d4c61c2e923b8d6f49403a1c66a7c6b86fa3ee36cbb2` |
| Approve registrar | `0x3c9b374cf9caa411ca5c6c276830b9afced5f50e75a9c605e5ee4c8940a68e35` |
| Commit registration | `0x8a0458624067346dfeb60701bb0fcc36c78a6885c77defd7954f398e8c7e9b02` |
| Register veriprocess.eth | `0xffbe16cefa23544b5402f7a48b60b433fcbeba2890a95429bc23a8caca66212e` |

Onboarding now grants the active role before binding its token-ID snapshot.
Promotions refresh the binding after their final grant. The regression test
`testRoleChangesRequireBindingAfterFinalGrant` and TypeScript check passed.

Deployment paused after registration: `AGENT_SERVICE_URL` remains blank and the
allocator, maker, agents and reporter had zero Sepolia ETH at preflight. The
three previously approved values for ENS_ACTIVE_ROLE, WETH_ADDRESS and
LIVE_INSTRUMENT_ID were restored to local configuration. No fund subregistry,
market, desk/router, agent enrollment, live swap or live revoke/revert has yet
been executed in this sequence.
