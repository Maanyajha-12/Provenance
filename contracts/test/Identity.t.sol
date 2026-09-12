// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {FundIdentityRegistry} from "../src/FundIdentityRegistry.sol";

contract IdentityTest {
    error AssertionFailed();

    function assertEq(string memory left, string memory right) internal pure {
        if (keccak256(bytes(left)) != keccak256(bytes(right))) revert AssertionFailed();
    }

    function testFundStrategyAgentTreeAndAgentControlledRecords() public {
        FundIdentityRegistry registry = new FundIdentityRegistry(address(this));
        bytes32 fund = registry.register(bytes32(0), keccak256("veriprocess"), address(this));
        bytes32 strategy = registry.register(fund, keccak256("momentum"), address(this));
        address agentController = address(0xA11CE);
        bytes32 agent = registry.register(strategy, keccak256("agent-01"), agentController);

        // The agent's resolver-equivalent records are controlled by its own account.
        vm.prank(agentController);
        registry.setText(agent, "role", "trading-agent");
        assertEq(registry.text(agent, "role"), "trading-agent");
    }
}

interface Vm {
    function prank(address) external;
}

address constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
Vm constant vm = Vm(VM_ADDRESS);
