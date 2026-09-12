// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAgentAuthority} from "./IAgentAuthority.sol";

/// @notice Stable execution-facing interface; swap the manager for ENSv2 EAC in production.
contract AgentAuthorityAdapter {
    IAgentAuthority public immutable authority;

    constructor(IAgentAuthority authority_) {
        authority = authority_;
    }

    function isAuthorized(IAgentAuthority.TradeRequest calldata request)
        external
        view
        returns (bool)
    {
        (bool authorized,) = authority.checkTrade(request);
        return authorized;
    }

    function checkTrade(IAgentAuthority.TradeRequest calldata request)
        external
        view
        returns (bool, bytes32)
    {
        return authority.checkTrade(request);
    }
}
