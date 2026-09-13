// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {FundIdentityRegistry} from "../src/FundIdentityRegistry.sol";
import {AgentAuthorityManager} from "../src/AgentAuthorityManager.sol";
import {AgentAuthorityAdapter} from "../src/AgentAuthorityAdapter.sol";

/// @notice Local/testnet harness deployment. ENSv2 and Aqua production wiring is documented separately.
contract DeployLocalHarness {
    function deploy(address allocator)
        external
        returns (FundIdentityRegistry identities, AgentAuthorityManager authority, AgentAuthorityAdapter adapter)
    {
        identities = new FundIdentityRegistry(msg.sender);
        authority = new AgentAuthorityManager(allocator);
        adapter = new AgentAuthorityAdapter(authority);
    }
}
