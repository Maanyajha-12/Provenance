# Sponsor source pins

- SwapVM: [1inch/swap-vm](https://github.com/1inch/swap-vm/tree/afd99c408b4ed610027f4426c6f98650acac9f5f), commit `afd99c408b4ed610027f4426c6f98650acac9f5f`, source package version 0.0.6. Vendored contracts and two upstream invariant test helpers; original licenses retained.
- Aqua: [1inch/aqua](https://github.com/1inch/aqua/tree/81c26e4619ce21556ab02b3284ee2685de21fb18), release v1.0.0, commit `81c26e4619ce21556ab02b3284ee2685de21fb18`. Official source, deployed locally in execution tests.
- forge-std: v1.11.0, commit `8e40513d678f392f398620b3ef2b418648b33e89`.
- ENSv2 ABI review: [ensdomains/contracts-v2](https://github.com/ensdomains/contracts-v2/tree/97a57293f3b4279d94b571e678edb53ce62638f4), commit `97a57293f3b4279d94b571e678edb53ce62638f4`. Contracts are not substituted with the local identity harness in ENS mode.
- JavaScript and Rust transitive versions are pinned in pnpm-lock.yaml and packages/oracle/Cargo.lock.
- Substreams CLI used for local validation: v1.22.0. `.tools/` contains a downloaded binary ignored by git.

The source SwapVM package is not published under `@1inch/swap-vm` in npm at validation time. Its Solidity imports use a Foundry remapping to vendored official source. The published SwapVM TypeScript SDK has a different order/program layout from this source revision; ProgramFactory uses this revision's official Solidity instruction builders to avoid mixing wire formats. Aqua SDK ship encoding is compatible with the pinned Aqua contract.

Current [ENSIP-26](https://docs.ens.domains/ensip/26/) uses `agent-context` and `agent-endpoint[web]`. [ENSIP-25](https://docs.ens.domains/ensip/25/) concerns an external agent-registry association, which requires a registry-specific registration record; it is not implied by an ENS name alone.

ENSv2 was compared against the previous pin `48b3e2d39513b9dd32ef1850877a29009bc807b9`: all five requested contract sources and deployment ABIs match. The current local ABI fragments include the upstream return values for EAC grant/revoke and factory deployment. See [the detailed ABI review](ENSV2_ABI_REVIEW.md) for scope, signatures, evidence, and validation limits. ENS interfaces are handwritten minimal fragments, not a full vendored ENS contract package.

The deployed fund router retains the official SwapVMRouter base but overrides
its dispatcher with only ProgramFactory's canonical instruction set:
StaticBalances (0x90), XYCSwap (0x50), RequireMinRate (0xb0), and our ENS authority
opcode (250 / 0xfa). Other opcodes revert with UnknownOpcode. No opcode IDs,
canonical builders, settlement logic, or authority/minimum-output checks changed.
The trimmed local runtime is 16,331 bytes. The upstream untrimmed SwapVMRouter
artifact still exceeds EIP-170 but is not deployed by DeployFund. Minimum-rate
is the upstream maker-rate guard; the existing authority opcode and taker data
continue to enforce the agent's minimum output/slippage constraint.
