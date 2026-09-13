// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Aqua} from "@1inch/aqua/src/Aqua.sol";
import {TestToken} from "../src/TestToken.sol";

contract DeployTestMarket is Script {
    function run() external {
        require(block.chainid == 11155111, "Sepolia required");
        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        Aqua aqua = new Aqua();
        TestToken base = new TestToken("Provenance Base", "pBASE");
        TestToken quote = new TestToken("Provenance Dollar", "pUSD");
        address maker = vm.envAddress("MAKER_ADDRESS");
        base.mint(maker, 10000 ether);
        quote.mint(maker, 10000 ether);
        vm.stopBroadcast();
        console2.log("AQUA_ADDRESS", address(aqua));
        console2.log("TOKEN_BASE", address(base));
        console2.log("TOKEN_QUOTE", address(quote));
    }
}
