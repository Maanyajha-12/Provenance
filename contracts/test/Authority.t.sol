// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AgentAuthorityManager} from "../src/AgentAuthorityManager.sol";
import {AgentAuthorityAdapter} from "../src/AgentAuthorityAdapter.sol";
import {IAgentAuthority} from "../src/IAgentAuthority.sol";

contract AuthorityTest {
    AgentAuthorityManager manager;
    AgentAuthorityAdapter adapter;
    bytes32 agent = keccak256("agent-01");
    bytes32 instrument = keccak256("ETH/USD");

    error AssertionFailed();

    function assertTrue(bool value) internal pure {
        if (!value) revert AssertionFailed();
    }

    function assertFalse(bool value) internal pure {
        if (value) revert AssertionFailed();
    }

    function assertEq(bytes32 left, bytes32 right) internal pure {
        if (left != right) revert AssertionFailed();
    }

    function setUp() public {
        manager = new AgentAuthorityManager(address(this));
        adapter = new AgentAuthorityAdapter(manager);
        manager.setMandate(agent, uint48(block.timestamp + 1 days), 1_000 ether, 50);
        manager.setInstrument(agent, instrument, true);
        manager.setActive(agent, true);
    }

    function request(uint256 notional, uint256 slippage)
        internal
        view
        returns (IAgentAuthority.TradeRequest memory)
    {
        return IAgentAuthority.TradeRequest(agent, instrument, notional, slippage);
    }

    function testActiveAuthorizedAgentPasses() public view {
        assertTrue(adapter.isAuthorized(request(100 ether, 25)));
    }

    function testRevokedAgentFailsClosed() public {
        manager.setActive(agent, false);
        (bool ok, bytes32 reason) = adapter.checkTrade(request(100 ether, 25));
        assertFalse(ok);
        assertEq(reason, manager.REASON_INACTIVE());
    }

    function testCapAndWhitelistAreEnforced() public view {
        assertFalse(adapter.isAuthorized(request(1_001 ether, 25)));
        assertFalse(adapter.isAuthorized(request(100 ether, 51)));
    }

    function testHirePromoteAndFireLifecycle() public {
        bytes32 newAgent = keccak256("agent-02");
        manager.hire(newAgent, uint48(block.timestamp + 1 days), 100 ether, 25, instrument);
        assertTrue(
            adapter.isAuthorized(IAgentAuthority.TradeRequest(newAgent, instrument, 100 ether, 25))
        );

        manager.promote(newAgent, uint48(block.timestamp + 2 days), 500 ether, 75);
        assertTrue(
            adapter.isAuthorized(IAgentAuthority.TradeRequest(newAgent, instrument, 500 ether, 75))
        );

        manager.fire(newAgent);
        assertFalse(
            adapter.isAuthorized(IAgentAuthority.TradeRequest(newAgent, instrument, 1 ether, 1))
        );
    }
}
