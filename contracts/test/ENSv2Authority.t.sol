// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {ENSv2Authority, IENSRegistry, IENSResolver} from "../src/ENSv2Authority.sol";
import {IAgentAuthority} from "../src/IAgentAuthority.sol";

contract ENSFixture {
    uint256 public resource = 1;
    uint256 public token = 1;
    address public owner = address(0xa);
    bool public active = true;

    function getResource(uint256) external view returns (uint256) {
        return resource;
    }

    function getTokenId(uint256) external view returns (uint256) {
        return token;
    }

    function getOwner(uint256) external view returns (address) {
        return owner;
    }

    function getExpiry(uint256) external view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function hasRoles(uint256, uint256, address) external view returns (bool) {
        return active;
    }

    function revoke() external {
        active = false;
    }

    function transferName() external {
        resource++;
        token++;
        owner = address(0xb);
    }

    function text(bytes32, string calldata key) external pure returns (string memory) {
        bytes32 h = keccak256(bytes(key));
        if (h == keccak256("fund.maxNotional")) return "1000";
        if (h == keccak256("fund.maxSlippageBps")) return "100";
        if (h == keccak256("fund.validUntil")) return "9999999999";
        return "true";
    }
}

contract ENSv2AuthorityTest is Test {
    function testAdapterReadsRolesAndFailsOnTransfer() public {
        ENSFixture f = new ENSFixture();
        ENSv2Authority a = new ENSv2Authority(address(this), 1 << 80);
        a.bind(bytes32(uint256(1)), IENSRegistry(address(f)), IENSResolver(address(f)), 1, address(0xa));
        IAgentAuthority.TradeRequest memory r = IAgentAuthority.TradeRequest(bytes32(uint256(1)), bytes32(0), 100, 10);
        (bool ok,) = a.checkTrade(r);
        assertTrue(ok);
        f.transferName();
        (ok,) = a.checkTrade(r);
        assertFalse(ok);
    }

    function testLiveAdapterFork() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        address deployed = vm.envOr("ENS_AUTHORITY_ADAPTER", address(0));
        if (bytes(rpc).length == 0 || deployed == address(0)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 11155111);
        assertGt(deployed.code.length, 0);
        bytes32 node = vm.envBytes32("LIVE_AGENT_NODE");
        bytes32 instrument = vm.envBytes32("LIVE_INSTRUMENT_ID");
        IAgentAuthority.TradeRequest memory r = IAgentAuthority.TradeRequest(node, instrument, 1, 0);
        (bool ok,) = IAgentAuthority(deployed).checkTrade(r);
        assertTrue(ok, "Enroll and hire live test agent first");
        ENSv2Authority adapter = ENSv2Authority(deployed);
        (IENSRegistry registry,, uint256 id,,,, address signer) = adapter.bindings(node);
        vm.prank(adapter.allocator());
        (bool success,) = address(registry)
            .call(abi.encodeWithSignature("revokeRoles(uint256,uint256,address)", id, adapter.activeRole(), signer));
        assertTrue(success);
        (ok,) = adapter.checkTrade(r);
        assertFalse(ok);
    }
}
