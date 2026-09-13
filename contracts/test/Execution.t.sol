// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {CoreInvariants} from "../vendor/swap-vm/test/solidity/invariants/CoreInvariants.t.sol";
import {SwapVM} from "@1inch/swap-vm/contracts/SwapVM.sol";
import {ISwapVM} from "@1inch/swap-vm/contracts/interfaces/ISwapVM.sol";
import {Aqua} from "@1inch/aqua/src/Aqua.sol";
import {AgentAuthorityManager} from "../src/AgentAuthorityManager.sol";
import {AgentDesk} from "../src/AgentDesk.sol";
import {RequireMinRate} from "@1inch/swap-vm/contracts/instructions/MinRate.sol";
import {Context} from "@1inch/swap-vm/contracts/libs/VM.sol";
import {IAgentAuthority} from "../src/IAgentAuthority.sol";
import {AuthoritySwapVMRouter} from "../src/AuthoritySwapVMRouter.sol";
import {ProgramFactory} from "../src/ProgramFactory.sol";
import {TestToken} from "../src/TestToken.sol";

contract OpcodeContext {
    function executionContext() external pure returns (IAgentAuthority.TradeRequest memory, uint256) {
        return (IAgentAuthority.TradeRequest(keccak256("agent"), keccak256("BASE/QUOTE"), 1 ether, 100), 1);
    }
}
contract OpcodeProbe is AuthoritySwapVMRouter {
    constructor(address aqua, address weth, IAgentAuthority authority_, address desk_)
        AuthoritySwapVMRouter(aqua, weth, msg.sender, authority_, desk_) {}
    function probeUnsupported(uint256 opcode, bytes calldata args) external {
        Context memory ctx;
        _runOpcode(ctx, opcode, args);
    }
    function probe(address taker, bytes calldata args) external {
        Context memory ctx;
        ctx.query.taker = taker;
        _runOpcode(ctx, 250, args);
    }
}

contract ExecutionTest is CoreInvariants {
    AgentAuthorityManager manager;
    AgentDesk desk;
    AuthoritySwapVMRouter router;
    Aqua aqua;
    TestToken base;
    TestToken quoteToken;
    ISwapVM.Order order;
    bytes32 node = keccak256("agent");
    bytes32 market = keccak256("BASE/QUOTE");
    address maker;

    function setUp() public {
        maker = vm.addr(1234);
        manager = new AgentAuthorityManager(address(this));
        desk = new AgentDesk(address(this), manager);
        aqua = new Aqua();
        base = new TestToken("Base", "BASE");
        quoteToken = new TestToken("Quote", "QUOTE");
        router = new AuthoritySwapVMRouter(address(aqua), address(base), address(this), manager, address(desk));
        desk.setRouter(ISwapVM(address(router)));
        desk.setAgent(node, address(this));
        desk.setInstrument(market, address(base), address(quoteToken));
        manager.hire(node, uint48(block.timestamp + 1 days), 100 ether, 100, market);
        base.mint(maker, 10000 ether);
        quoteToken.mint(maker, 10000 ether);
        quoteToken.mint(address(this), 1000 ether);
        quoteToken.approve(address(desk), type(uint256).max);
        address[] memory tokens = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        (tokens[0], tokens[1]) = address(base) < address(quoteToken)
            ? (address(base), address(quoteToken))
            : (address(quoteToken), address(base));
        amounts[0] = 10000 ether;
        amounts[1] = 10000 ether;
        bytes memory strategy;
        (order, strategy) = new ProgramFactory().build(maker, tokens[0], tokens[1], 1, 1);
        vm.startPrank(maker);
        base.approve(address(aqua), type(uint256).max);
        quoteToken.approve(address(aqua), type(uint256).max);
        aqua.ship(address(router), strategy, tokens, amounts);
        vm.stopPrank();
    }

    function intent(uint256 nonce) internal view returns (AgentDesk.TradeIntent memory) {
        return AgentDesk.TradeIntent(
            bytes32(nonce), node, market, 0, 1 ether, 1 ether, 100, uint48(block.timestamp + 1 hours)
        );
    }

    function testRealAquaFillThenRevokeReverts() public {
        desk.execute(intent(1), order, "");
        assertGt(base.balanceOf(address(this)), 0);
        assertEq(quoteToken.balanceOf(address(this)), 999 ether);
        manager.fire(node);
        vm.expectRevert("authority denied");
        desk.execute(intent(2), order, "");
        assertFalse(desk.used(bytes32(uint256(2))));
    }

    function testReplayAndImpersonationRejected() public {
        desk.execute(intent(1), order, "");
        vm.expectRevert("invalid intent");
        desk.execute(intent(1), order, "");
        AgentDesk.TradeIntent memory i = intent(2);
        vm.prank(address(0xbad));
        vm.expectRevert("unauthorized");
        desk.execute(i, order, "");
    }

    function testSlippageRevertRollsBackIntentAndFunds() public {
        AgentDesk.TradeIntent memory i = intent(3);
        i.limitPrice = 0.5 ether;
        vm.expectRevert();
        desk.execute(i, order, "");
        assertEq(quoteToken.balanceOf(address(this)), 1000 ether);
        assertFalse(desk.used(i.intentId));
    }

    function testFuzzFillConservesTokens(uint64 raw) public {
        AgentDesk.TradeIntent memory i = intent(4);
        i.notional = bound(uint256(raw), 1e12, 10 ether);
        uint256 beforeMaker = base.balanceOf(maker);
        desk.execute(i, order, "");
        assertEq(beforeMaker - base.balanceOf(maker), base.balanceOf(address(this)));
        assertEq(quoteToken.balanceOf(maker), 10000 ether + i.notional);
    }

    function testSignedOrderSettlesThroughDesk() public {
        (address tokenA, address tokenB) = address(base) < address(quoteToken)
            ? (address(base), address(quoteToken))
            : (address(quoteToken), address(base));
        ISwapVM.Order memory signed = new ProgramFactory()
            .buildSigned(maker, tokenA, tokenB, 10000 ether, 10000 ether, 1, 1);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1234, router.hash(signed));
        vm.prank(maker);
        base.approve(address(router), type(uint256).max);
        desk.execute(intent(10), signed, abi.encodePacked(r, s, v));
        assertGt(base.balanceOf(address(this)), 0);
    }

    function testCustomOpcodeIndependentlyRejectsRevokedAuthority() public {
        OpcodeContext context = new OpcodeContext();
        OpcodeProbe probe = new OpcodeProbe(address(aqua), address(base), manager, address(context));
        manager.fire(node);
        vm.expectRevert("authority revoked");
        probe.probe(address(context), "");
        vm.expectRevert("desk required");
        probe.probe(address(this), "");
    }

    function testRouterFitsSepoliaRuntimeLimit() public view {
        assertLe(address(router).code.length, 24576);
    }

    function testTrimmedInstructionsRevert() public {
        OpcodeProbe probe = new OpcodeProbe(address(aqua), address(base), manager, address(desk));
        vm.expectRevert(abi.encodeWithSignature("UnknownOpcode(uint256)", uint256(0x58)));
        probe.probeUnsupported(0x58, ""); // PeggedSwap is deliberately unavailable.
    }

    function testOfficialMinimumRateStillReverts() public {
        bool baseFirst = address(base) < address(quoteToken);
        (address tokenA, address tokenB) = baseFirst
            ? (address(base), address(quoteToken)) : (address(quoteToken), address(base));
        // Require the maker to receive two input units per output unit, which the
        // balanced XYC pool cannot meet. The desk's own taker limit remains permissive.
        ISwapVM.Order memory guarded = new ProgramFactory().buildSigned(
            maker, tokenA, tokenB, 10000 ether, 10000 ether,
            baseFirst ? 1 : 2, baseFirst ? 2 : 1
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1234, router.hash(guarded));
        vm.prank(maker);
        base.approve(address(router), type(uint256).max);
        AgentDesk.TradeIntent memory i = intent(99);
        vm.expectPartialRevert(RequireMinRate.RequireMinRateFailed.selector);
        desk.execute(i, guarded, abi.encodePacked(r, s, v));
        assertFalse(desk.used(i.intentId));
        assertEq(quoteToken.balanceOf(address(this)), 1000 ether);
    }

    function _executeSwap(SwapVM, ISwapVM.Order memory o, address, address, uint256 amount, bytes memory)
        internal
        override
        returns (uint256 amountIn, uint256 amountOut)
    {
        AgentDesk.TradeIntent memory i = intent(uint256(keccak256(abi.encode(amount, block.number))));
        i.notional = amount;
        uint256 before = base.balanceOf(address(this));
        desk.execute(i, o, "");
        return (amount, base.balanceOf(address(this)) - before);
    }
}
