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

## Funding and fund root setup

Five transfers of 0.005 Sepolia ETH each confirmed (0.025 ETH total):

| Recipient | Transaction |
| --- | --- |
| Allocator | `0x2505fa77a96b9c3ba57b3b6f6643d0f32331b1f82e0b67cee7cc380b93714e55` |
| Maker | `0x462ab5c451743b691a59642b8e27e5d0ce887e23e95684928280b1ef5d741751` |
| Agent 1 | `0x0d1490ddfe04215b07248d3451128145757372f0358f851b8432cabe90c74dbb` |
| Agent 2 | `0x71c2062716672a6c44cef4625e0809f02d6990a1a1cf5b9f007fe61a4d803cac` |
| Price reporter | `0xb1d64f38759c42a67e94643ddacb3bf045cfdbf7ddbb634899222fb183270d5b` |

Fund UserRegistry: `0xA9Fc6A471024E7Caf9f57Fc6D970924b3eF32175`.

- Factory deployment: `0xa0949c8e80f0179c5047b26a13697bfa3f79289db90d3fea6436b338627f9178`
- ETHRegistry setSubregistry: `0x4a4142fe8031c92e62f7872d8d40358d9ca4af20548ceb8846ad5e5260cffca1`
- Fund registry setParent: `0x57072edf90d89e57a88ced88c55fc566276944ef51f9ee06c9739164fd766a6a`

All three root setup transactions confirmed. ENS_FUND_REGISTRY was saved locally.
The previous funding/configuration pause is superseded by this progress.

Market deployment then stopped before broadcast: the Forge launcher omitted an
explicit RPC selection and DeployTestMarket's local simulation reverted with
`Sepolia required`. No market deployment transaction was sent. Resume by explicitly
passing the configured Sepolia RPC to Forge; do not redeploy the existing root.

## Market deployment confirmed; fund stack blocked

The explicit Sepolia RPC retry succeeded.

| Contract / operation | Address | Confirmed transaction |
| --- | --- | --- |
| Aqua | `0x393eb5b87a05a20b3aa2838b98988d5f536d1d9e` | `0xdd4541a102feab86a82b2bf3426748b87526b237ca80e34d8a1ce2dc9efdf037` |
| pBASE | `0x559b4509763456a6034e20e1a5e331812c7c516b` | `0x08c63b79ed52d9336acd48e8b9df6c6ec6b15bccca1b77661fa995fe553340b2` |
| pUSD | `0x108ae6238c26125520fb927a97f87bcb2cc707dd` | `0x959b46b7b3fd1872cd0b2d5780af5931fed43e6f27c4af9bcd988daec62feb0f` |
| Mint 10,000 pBASE to maker | `0x559b4509763456a6034e20e1a5e331812c7c516b` | `0x7e9d647ba0c1af9046c592f6b03a396dbe29e791ef1ba20e6405f78febb95c3b` |
| Mint 10,000 pUSD to maker | `0x108ae6238c26125520fb927a97f87bcb2cc707dd` | `0x1a0c3fbfe41b1cffef526adf81342300f87ff5863bdca98a5769b3b0709f75cd` |

Confirmed market addresses were saved to local configuration. DeployFund then
failed its pre-broadcast contract-size check, reporting 28,137 bytes for
`Unknown2`, above the 24,576-byte EIP-170 limit. The local build artifact
identifies AuthoritySwapVMRouter as the oversized contract (28,040 runtime
bytes); the other four fund contracts are below the limit. No fund-stack transactions
were broadcast; the addresses printed by simulation are predictions only and
were not saved as deployed addresses. The router must be reduced below the
limit before retrying; bypassing a local check would not make Sepolia accept it.
Agent enrollment, fork test, agent token funding, Aqua shipping, the live swap
and mined revoke/revert demonstration remain pending.

## Trimmed fund stack deployed successfully

Local runtime size: 16,331 bytes. Foundry: 16 passed, one not-yet-configured live fork test skipped. Authority opcode 250 and official RequireMinRate remain enforced.

| Contract / operation | Address | Transaction |
| --- | --- | --- |
| ENSv2Authority | `0xc28477ca724df2cfbc894b98a3b3745928c65753` | `0x9560f0e9e115954af2b7a08f1782751eaba5e7555654559622627d81234903dc` |
| AgentDesk | `0x1982ccc8c5fb3f6d07e0b7790d400d57b3806608` | `0x355284ff4b47058c1d5df5656add3c5d41148da2a0b77ed87cd4e9e95d8201ba` |
| AuthoritySwapVMRouter | `0x924334f798bfe499137c65f22c6b22df062876f7` | `0xe7090a75f39cc37517cbf8e31cb934e0441a7a5816fc2075c7ebcd5fe26f5700` |
| AgentDesk setRouter(address) | `0x1982ccc8c5fb3f6d07e0b7790d400d57b3806608` | `0x536a453faacf03fe621a68836c7ed8d5ba99d0fde08a1599a2b2f21168995b77` |
| AgentDesk setInstrument(bytes32,address,address) | `0x1982ccc8c5fb3f6d07e0b7790d400d57b3806608` | `0x1d4d1a3f1445ea10d8f5e08d380feacfa3b2b0fddabb902f4570139de46c06c7` |
| ProgramFactory | `0x2c9c6478dba7a9d27ee86288e2289081e73aac0f` | `0xe5b434dd9f04e734659d44720f43bf7169041143aebdfd836192f454f26db8d0` |
| PriceMarks | `0xe35ccb912e318982d48da2a997495cd8d181b9db` | `0xf5c446f459ffb159e38a5d560253c999808185e66be978911fad94c47297f61e` |

## Atlas enrollment paused at resolver permission grant

- Name: `atlas.momentum.veriprocess.eth`
- Node: `0x541755767680e241bd7664f2f369579b7ffcdec257fdfd45e7a44fa37257643f`
- Strategy registry: `0x1A3bd508eC6E5FC66c11eA45Ca969E55ca81A167`
- Atlas resolver: `0xC213e23B8142C14E6240A67C372D67921c8029ca`

Confirmed transactions:

| Action | Transaction |
| --- | --- |
| Strategy registry proxy | `0x0c585870f6d1b11c72ae3caf66d32d0a3ca91be96ca092a38b0a7ac8b71cfedb` |
| Atlas resolver proxy | `0x2212d26bbe21ea3ba1ae9c7c2628fff273ad533198febe247e3ee6c7c38049bc` |
| Register momentum | `0x24f60f2e89d4044e44362374e338bb1c12131af856f95b10cae7953348d86932` |
| Set strategy parent | `0x60493df1a1de3b24f87a89d1cc1e3994e5c8c5346d9a453c338372f938b12a94` |
| Register Atlas | `0xccca798da4e568ef272acb4dac9cbb1e6eafbda997ae18054716763148e9b275` |
| Atlas signer address record | `0x0dc2f56d0fcfbc3f21135845ac8ad275480b8a35e7bd77b1c8d477e96068300d` |
| Atlas agent-context record | `0x9df307b77dcff673860554709031080016e14ebe06e7a2166d6e45102b9f6ceb` |

The next generic resolver `grantRoles` call failed gas estimation with selector
`0xd1a3b355` = `EACCannotGrantRoles(uint256,uint256,address)`. No transaction
was broadcast for this failed grant. The pinned PermissionedResolver disables
generic grantRoles; per-text delegation must use authorizeTextRoles with the
DNS-wire-encoded agent name. Enrollment has not reached active-role granting,
adapter binding or desk signer registration. Atlas is not yet trade-authorized;
Delta has not been enrolled. Resume using the existing registry/resolver
checkpoints after correcting the permission call, rather than redeploying them.
