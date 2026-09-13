// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IAgentAuthority} from "../src/IAgentAuthority.sol";
import {ENSv2Authority} from "../src/ENSv2Authority.sol";
import {AgentAuthorityManager} from "../src/AgentAuthorityManager.sol";
import {AgentDesk} from "../src/AgentDesk.sol";
import {AuthoritySwapVMRouter} from "../src/AuthoritySwapVMRouter.sol";
import {ProgramFactory} from "../src/ProgramFactory.sol";
import {PriceMarks} from "../src/PriceMarks.sol";
import {ISwapVM} from "@1inch/swap-vm/contracts/interfaces/ISwapVM.sol";

contract DeployFund is Script {
    function run() external {
        require(block.chainid == 11155111, "Sepolia required");
        uint256 deployer = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(deployer);
        address allocator = vm.envAddress("ALLOCATOR_ADDRESS");
        address aqua = vm.envAddress("AQUA_ADDRESS");
        address base = vm.envAddress("TOKEN_BASE");
        address quote = vm.envAddress("TOKEN_QUOTE");
        require(
            aqua.code.length > 0 && base.code.length > 0 && quote.code.length > 0,
            "Deploy or configure Aqua and test tokens first"
        );
        vm.startBroadcast(deployer);
        IAgentAuthority authority;
        if (keccak256(bytes(vm.envString("AUTHORITY_MODE"))) == keccak256("ensv2")) {
            authority = new ENSv2Authority(allocator, vm.envUint("ENS_ACTIVE_ROLE"));
        } else {
            require(keccak256(bytes(vm.envString("AUTHORITY_MODE"))) == keccak256("local"), "invalid mode");
            authority = new AgentAuthorityManager(allocator);
        }
        // Desk setup is by deployer; authority lifecycle remains exclusively with allocator.
        AgentDesk desk = new AgentDesk(admin, authority);
        AuthoritySwapVMRouter router =
            new AuthoritySwapVMRouter(aqua, vm.envAddress("WETH_ADDRESS"), admin, authority, address(desk));
        desk.setRouter(ISwapVM(address(router)));
        desk.setInstrument(vm.envBytes32("LIVE_INSTRUMENT_ID"), base, quote);
        ProgramFactory factory = new ProgramFactory();
        PriceMarks marks = new PriceMarks(vm.envAddress("PRICE_REPORTER_ADDRESS"));
        vm.stopBroadcast();
        console2.log(keccak256(bytes(vm.envString("AUTHORITY_MODE"))) == keccak256("ensv2") ? "ENS_AUTHORITY_ADAPTER" : "AUTHORITY_MANAGER_ADDRESS", address(authority));
        console2.log("AGENT_DESK_ADDRESS", address(desk));
        console2.log("SWAPVM_ROUTER_ADDRESS", address(router));
        console2.log("PROGRAM_FACTORY_ADDRESS", address(factory));
        console2.log("PRICE_MARKS_ADDRESS", address(marks));
    }
}
