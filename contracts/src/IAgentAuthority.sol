// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IAgentAuthority {
    struct TradeRequest {
        bytes32 agentNode;
        bytes32 instrumentId;
        uint256 notional;
        uint256 maxSlippageBps;
    }

    function checkTrade(TradeRequest calldata request) external view returns (bool authorized, bytes32 reason);
}
