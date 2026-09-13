// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {SwapVMRouter} from "@1inch/swap-vm/contracts/routers/SwapVMRouter.sol";
import {StaticBalances} from "@1inch/swap-vm/contracts/instructions/Balances.sol";
import {RequireMinRate} from "@1inch/swap-vm/contracts/instructions/MinRate.sol";
import {XYCSwap} from "@1inch/swap-vm/contracts/instructions/XYCSwap.sol";
import {Context} from "@1inch/swap-vm/contracts/libs/VM.sol";
import {IAgentAuthority} from "./IAgentAuthority.sol";

interface IExecutionContext {
    function executionContext() external view returns (IAgentAuthority.TradeRequest memory request, uint256 minOutput);
}

/// @notice Official router with only the canonical fund program instructions enabled.
/// @dev Opcode IDs/builders are unchanged. Unsupported programs fail closed.
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
            // Dispatch directly so unused upstream instruction implementations are eliminated.
            // These are the exact official handlers used by ProgramFactory; do not renumber.
            if (opcode == StaticBalances.opcode.asU8()) StaticBalances.exec(ctx, args);
            else if (opcode == RequireMinRate.opcode.asU8()) RequireMinRate.exec(ctx, args);
            else if (opcode == XYCSwap.opcode.asU8()) XYCSwap.exec(ctx, args);
            else revert UnknownOpcode(opcode);
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
