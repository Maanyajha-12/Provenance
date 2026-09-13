// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {SwapVMRouter} from "@1inch/swap-vm/contracts/routers/SwapVMRouter.sol";
import {Context} from "@1inch/swap-vm/contracts/libs/VM.sol";
import {IAgentAuthority} from "./IAgentAuthority.sol";

interface IExecutionContext {
    function executionContext() external view returns (IAgentAuthority.TradeRequest memory request, uint256 minOutput);
}

/// @notice Extends the official router's virtual instruction dispatcher.
contract AuthoritySwapVMRouter is SwapVMRouter {
    uint8 public constant AUTHORITY_OPCODE = 250;
    IAgentAuthority public immutable authority;
    address public immutable desk;

    constructor(address aqua, address weth, address owner, IAgentAuthority authority_, address desk_)
        SwapVMRouter(aqua, weth, owner, "Provenance SwapVM", "1")
    {
        authority = authority_;
        desk = desk_;
    }

    function _runOpcode(Context memory ctx, uint256 opcode, bytes calldata args) internal override {
        if (opcode != AUTHORITY_OPCODE) {
            super._runOpcode(ctx, opcode, args);
            return;
        }
        require(ctx.query.taker == desk && args.length == 0, "desk required");
        (IAgentAuthority.TradeRequest memory request, uint256 minimum) = IExecutionContext(desk).executionContext();
        (bool ok,) = authority.checkTrade(request);
        require(ok, "authority revoked");
        (uint256 amountIn, uint256 amountOut) = ctx.runLoop();
        require(amountIn == request.notional && amountOut >= minimum, "declared limits");
    }
}
