// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ProgramFactory} from "./ProgramFactory.sol";
import {IAuthoritySnapshot} from "./IAuthoritySnapshot.sol";
import {IAgentAuthority} from "./IAgentAuthority.sol";
import {ISwapVM} from "@1inch/swap-vm/contracts/interfaces/ISwapVM.sol";
import {MakerTraitsLib} from "@1inch/swap-vm/contracts/libs/MakerTraits.sol";
import {TakerTraitsLib} from "@1inch/swap-vm/contracts/libs/TakerTraits.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract AgentDesk {
    using SafeERC20 for IERC20;

    struct TradeIntent {
        bytes32 intentId;
        bytes32 agentNode;
        bytes32 instrumentId;
        uint8 side;
        uint256 notional;
        uint256 limitPrice;
        uint16 maxSlippageBps;
        uint48 deadline;
    }

    struct Instrument {
        address base;
        address quote;
    }
    address public immutable allocator;
    IAgentAuthority public immutable authority;
    ISwapVM public router;
    ProgramFactory public immutable programValidator;
    mapping(bytes32 => address) public signer;
    mapping(bytes32 => Instrument) public instruments;
    mapping(bytes32 => bool) public used;
    bool private entered;
    IAgentAuthority.TradeRequest private current;
    uint256 private minimum;
    event Intent(
        bytes32 indexed intentId,
        bytes32 indexed agentNode,
        bytes32 indexed instrumentId,
        uint8 side,
        uint256 notional,
        uint256 limitPrice,
        uint16 maxSlippageBps,
        uint48 deadline
    );
    event MandateSnapshot(
        bytes32 indexed agentNode,
        bytes32 indexed instrumentId,
        bool active,
        uint48 validUntil,
        uint256 maxNotional,
        uint256 maxSlippageBps,
        bool instrumentAllowed
    );
    event Settlement(bytes32 indexed intentId, uint256 baseAmount, uint256 quoteAmount);
    event Fill(
        bytes32 indexed intentId,
        bytes32 indexed fillId,
        bytes32 indexed agentNode,
        bytes32 instrumentId,
        uint256 executedNotional,
        uint256 executedPrice,
        uint256 fee,
        uint256 blockNumber
    );

    constructor(address allocator_, IAgentAuthority authority_) {
        allocator = allocator_;
        authority = authority_;
        programValidator = new ProgramFactory();
    }
    modifier onlyAllocator() {
        require(msg.sender == allocator, "allocator only");
        _;
    }

    function setRouter(ISwapVM router_) external onlyAllocator {
        require(address(router) == address(0) && address(router_).code.length > 0, "router locked");
        router = router_;
    }

    function setAgent(bytes32 node, address account) external onlyAllocator {
        signer[node] = account;
    }

    function setInstrument(bytes32 id, address base, address quote) external onlyAllocator {
        require(base != quote && base.code.length > 0 && quote.code.length > 0, "invalid tokens");
        instruments[id] = Instrument(base, quote);
    }

    function executionContext() external view returns (IAgentAuthority.TradeRequest memory, uint256) {
        require(entered && msg.sender == address(router), "no execution");
        return (current, minimum);
    }

    function execute(TradeIntent calldata i, ISwapVM.Order calldata order, bytes calldata signature)
        external
        returns (bytes32 fillId)
    {
        require(!entered && msg.sender == signer[i.agentNode], "unauthorized");
        require(
            !used[i.intentId] && i.notional > 0 && i.limitPrice > 0 && i.side < 2 && i.maxSlippageBps < 10000
                && i.deadline >= block.timestamp,
            "invalid intent"
        );
        entered = true;
        used[i.intentId] = true;
        current = IAgentAuthority.TradeRequest(i.agentNode, i.instrumentId, i.notional, i.maxSlippageBps);
        (bool ok,) = authority.checkTrade(current);
        require(ok, "authority denied");
        Instrument memory pair = instruments[i.instrumentId];
        require(pair.base != address(0), "unknown instrument");
        address tokenIn = i.side == 0 ? pair.quote : pair.base;
        address tokenOut = i.side == 0 ? pair.base : pair.quote;
        (address tokenA, address tokenB) = order.traits.tokens(order.data);
        require((tokenIn == tokenA && tokenOut == tokenB) || (tokenIn == tokenB && tokenOut == tokenA), "wrong market");
        bytes calldata program = order.traits.program(order.data);
        require(program.length >= 2 && uint8(program[0]) == 250 && program[1] == 0, "authority prefix required");
        require(
            programValidator.validateProgram(program, order.traits.useAquaInsteadOfSignature()), "unsupported program"
        );
        uint256 expected =
            i.side == 0 ? Math.mulDiv(i.notional, 1e18, i.limitPrice) : Math.mulDiv(i.notional, i.limitPrice, 1e18);
        minimum = Math.mulDiv(expected, 10000 - i.maxSlippageBps, 10000, Math.Rounding.Ceil);
        require(minimum > 0, "zero minimum");
        IAuthoritySnapshot.Snapshot memory snapshot =
            IAuthoritySnapshot(address(authority)).mandateSnapshot(i.agentNode, i.instrumentId);
        emit MandateSnapshot(
            i.agentNode,
            i.instrumentId,
            snapshot.active,
            snapshot.validUntil,
            snapshot.maxNotional,
            snapshot.maxSlippageBps,
            snapshot.instrumentAllowed
        );
        emit Intent(
            i.intentId, i.agentNode, i.instrumentId, i.side, i.notional, i.limitPrice, i.maxSlippageBps, i.deadline
        );
        uint256 beforeIn = IERC20(tokenIn).balanceOf(address(this));
        uint256 beforeOut = IERC20(tokenOut).balanceOf(address(this));
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), i.notional);
        require(IERC20(tokenIn).balanceOf(address(this)) == beforeIn + i.notional, "unsupported transfer fee");
        IERC20(tokenIn).forceApprove(address(router), i.notional);
        TakerTraitsLib.Args memory args;
        args.taker = address(this);
        args.isExactIn = true;
        args.isAToB = tokenIn == tokenA;
        args.threshold = abi.encode(minimum);
        args.deadline = uint40(i.deadline);
        args.useTransferFromAndAquaPush = true;
        args.signature = signature;
        (uint256 amountIn, uint256 amountOut,) = router.swap(order, i.notional, TakerTraitsLib.build(args));
        IERC20(tokenIn).forceApprove(address(router), 0);
        require(amountIn == i.notional && IERC20(tokenIn).balanceOf(address(this)) == beforeIn, "input mismatch");
        require(
            amountOut >= minimum && IERC20(tokenOut).balanceOf(address(this)) == beforeOut + amountOut,
            "output mismatch"
        );
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        uint256 price = i.side == 0 ? Math.mulDiv(amountIn, 1e18, amountOut) : Math.mulDiv(amountOut, 1e18, amountIn);
        fillId = keccak256(abi.encode(block.chainid, address(this), i.intentId));
        // MVP program has no fee opcodes; execution price includes any embedded spread.
        emit Settlement(i.intentId, i.side == 0 ? amountOut : amountIn, i.side == 0 ? amountIn : amountOut);
        emit Fill(i.intentId, fillId, i.agentNode, i.instrumentId, amountIn, price, 0, block.number);
        delete current;
        delete minimum;
        entered = false;
    }
}
