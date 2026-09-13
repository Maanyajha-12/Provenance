# ENSv2 ABI compatibility review

Reviewed 2026-09-13 against the official
[Sepolia deployment page](https://docs.ens.domains/learn/deployments/).
Its source and ABI links point to the target revision below.

- Previous pin: `48b3e2d39513b9dd32ef1850877a29009bc807b9`
- Deployment revision: `97a57293f3b4279d94b571e678edb53ce62638f4`
- Repository: [ensdomains/contracts-v2](https://github.com/ensdomains/contracts-v2)

## Result

All five requested contract source files are byte-identical between the two
commits. Their checked-in Sepolia deployment ABIs are also identical after
sorting JSON object keys and ABI entries. This includes functions, inputs,
outputs, mutability, events, indexed flags, constructors and errors.

| Contract             | Source under `contracts/src/`               | ABI under `contracts/deployments/sepolia/` | Functions | Events | Difference |
| -------------------- | ------------------------------------------- | ------------------------------------------ | --------: | -----: | ---------- |
| PermissionedRegistry | `registry/PermissionedRegistry.sol`         | `RootRegistry.json`                        |        42 |     16 | None       |
| PermissionedResolver | `resolver/PermissionedResolver.sol`         | `PermissionedResolverImpl.json`            |        49 |     18 | None       |
| ETHRegistrar         | `registrar/ETHRegistrar.sol`                | `ETHRegistrar.json`                        |        23 |      5 | None       |
| UniversalResolverV2  | `universalResolver/UniversalResolverV2.sol` | `UniversalResolverV2.json`                 |        27 |      0 | None       |
| UserRegistry         | `registry/UserRegistry.sol`                 | `UserRegistryImpl.json`                    |        47 |     18 | None       |

The four corresponding `interfaces/I<Contract>.sol` files are also identical.
There is no separate `IUserRegistry.sol`; its inherited interface is covered by
the UserRegistry deployment ABI. The access-control source directory and
`PermissionedResolverLib.sol` have no differences. As an additional onboarding
check, the VerifiableFactory deployment ABI is unchanged (3 functions, 1 event).
This is an interface review, not a claim that the entire upstream repository or
all contract behavior is unchanged.

## Local call surface

The minimal Solidity interfaces in `contracts/src/ENSv2Authority.sol` and the
TypeScript ABI fragments in `packages/shared/src/abi.ts`,
`packages/ens/src/deploy-tree.ts`, and `scripts/ens-root.ts` match the target
revision for the following used signatures:

```solidity
// Registry authority reads and EAC lifecycle writes
getResource(uint256) view returns (uint256)
getTokenId(uint256) view returns (uint256)
getOwner(uint256) view returns (address)
getExpiry(uint256) view returns (uint64)
hasRoles(uint256,uint256,address) view returns (bool)
grantRoles(uint256,uint256,address) returns (bool)
revokeRoles(uint256,uint256,address) returns (bool)

// Resolver identity and mandate records
text(bytes32,string) view returns (string)
setText(bytes32,string,string)
setAddr(bytes32,address)
initialize(address,uint256,bytes[])

// UserRegistry creation and tree wiring
initialize(address,uint256)
register(string,address,address,address,uint256,uint64) returns (uint256)
setParent(address,string)
setSubregistry(uint256,address)
getSubregistry(string) view returns (address)

// VerifiableFactory deployment and receipt decoding
deployProxy(address,uint256,bytes) returns (address)
event ProxyDeployed(address indexed sender,address indexed proxyAddress,
                    uint256 salt,address implementation)
```

Our code does not directly call ETHRegistrar or UniversalResolverV2; their
addresses are deployment configuration inventory. Both were compared as
requested, but no full local ABI for either is vendored. ENS authority logs in
the Rust oracle are preserved as raw topics/data rather than decoded against
hardcoded ENS event signatures. ProxyDeployed is the ENS factory event decoded
by onboarding; both its signature and indexed layout match.

Three pre-existing omissions were corrected during this review: local
`grantRoles`/`revokeRoles` fragments omitted `returns (bool)`, and the factory
fragment in both deployment scripts omitted `returns (address)`. These omissions
were present against **both** upstream revisions, not introduced by the target
revision. Their calldata selectors were already correct and transaction writes
did not consume the returned values. The corrected fragments now also describe
return data exactly. No on-chain adapter selector change is needed.

## Reproduce the source and ABI comparison

In a local clone of the official repository:

```bash
git fetch origin 48b3e2d39513b9dd32ef1850877a29009bc807b9 97a57293f3b4279d94b571e678edb53ce62638f4
git diff 48b3e2d39513b9dd32ef1850877a29009bc807b9 97a57293f3b4279d94b571e678edb53ce62638f4 -- \
  contracts/src/registry/PermissionedRegistry.sol \
  contracts/src/registry/interfaces/IPermissionedRegistry.sol \
  contracts/src/registry/UserRegistry.sol \
  contracts/src/resolver/PermissionedResolver.sol \
  contracts/src/resolver/interfaces/IPermissionedResolver.sol \
  contracts/src/registrar/ETHRegistrar.sol \
  contracts/src/registrar/interfaces/IETHRegistrar.sol \
  contracts/src/universalResolver/UniversalResolverV2.sol \
  contracts/src/universalResolver/interfaces/IUniversalResolverV2.sol \
  contracts/src/access-control \
  contracts/src/resolver/libraries/PermissionedResolverLib.sol
```

The source diff is empty. To compare the ABI payloads independently of deployment
addresses and transaction metadata, run this Python in that same clone:

```python
import json
import subprocess

commits = [
    "48b3e2d39513b9dd32ef1850877a29009bc807b9",
    "97a57293f3b4279d94b571e678edb53ce62638f4",
]
for name in ["RootRegistry", "PermissionedResolverImpl", "ETHRegistrar",
             "UniversalResolverV2", "UserRegistryImpl", "VerifiableFactory"]:
    versions = []
    for commit in commits:
        path = f"contracts/deployments/sepolia/{name}.json"
        artifact = json.loads(subprocess.check_output(["git", "show", f"{commit}:{path}"]))
        versions.append(sorted(json.dumps(item, sort_keys=True) for item in artifact["abi"]))
    assert versions[0] == versions[1], name
    print(name, "ABI identical")
```

## ENSIP-26 identity and scope

The shared `agentIdentityRecords` helper writes exactly `agent-context` and
`agent-endpoint[web]`. JSON inside the context record is application content,
not a set of additional standardized record keys. The live deployment command
validates the endpoint before submitting transactions; the offline onboarding
plan uses the same helper. Mandate fields remain separate `fund.*` records.

This follows the current [ENSIP-26 draft](https://docs.ens.domains/ensip/26/).
ENSIP-25 external registry association is not implemented or claimed. Existing
previously written legacy records are not deleted by this source change.

Validation: TypeScript check and identity-record tests pass. No live transaction
or bytecode/address verification was performed. At the ABI level it is safe to
use the target revision; actual configured deployments, roles and resolution
still need the live checks in the runbook.
