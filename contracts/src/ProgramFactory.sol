// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ISwapVM} from "@1inch/swap-vm/contracts/interfaces/ISwapVM.sol";
import {MakerTraitsLib} from "@1inch/swap-vm/contracts/libs/MakerTraits.sol";
import {RequireMinRate} from "@1inch/swap-vm/contracts/instructions/MinRate.sol";
import {StaticBalances} from "@1inch/swap-vm/contracts/instructions/Balances.sol";
import {XYCSwap} from "@1inch/swap-vm/contracts/instructions/XYCSwap.sol";

/// @notice Uses the pinned official instruction builders, avoiding SDK opcode-version drift.
contract ProgramFactory {
    function build(address maker, address tokenA, address tokenB, uint64 rateA, uint64 rateB)
        external
        pure
        returns (ISwapVM.Order memory order, bytes memory strategy)
    {
        require(tokenA < tokenB && rateA > 0 && rateB > 0, "invalid market");
        MakerTraitsLib.Args memory args;
        args.maker = maker;
        args.tokenA = tokenA;
        args.tokenB = tokenB;
        args.useAquaInsteadOfSignature = true;
        args.program = bytes.concat(hex"fa00", RequireMinRate.build(rateA, rateB), XYCSwap.build());
        order = MakerTraitsLib.build(args);
        strategy = abi.encode(order);
    }

    function buildSigned(
        address maker,
        address tokenA,
        address tokenB,
        uint256 balanceA,
        uint256 balanceB,
        uint64 rateA,
        uint64 rateB
    ) external pure returns (ISwapVM.Order memory order) {
        require(tokenA < tokenB && balanceA > 0 && balanceB > 0 && rateA > 0 && rateB > 0, "invalid market");
        MakerTraitsLib.Args memory args;
        args.maker = maker;
        args.tokenA = tokenA;
        args.tokenB = tokenB;
        args.program = bytes.concat(
            hex"fa00", StaticBalances.build(balanceA, balanceB), RequireMinRate.build(rateA, rateB), XYCSwap.build()
        );
        return MakerTraitsLib.build(args);
    }

    function validateProgram(bytes calldata program, bool aqua) external pure returns (bool) {
        if (program.length != (aqua ? 22 : 88) || program[0] != 0xfa || program[1] != 0) return false;
        uint256 offset = 2;
        if (!aqua) {
            if (uint8(program[offset]) != StaticBalances.opcode.asU8() || uint8(program[offset + 1]) != 64) return false;
            offset += 66;
        }
        return uint8(program[offset]) == RequireMinRate.opcode.asU8() && uint8(program[offset + 1]) == 16
            && uint8(program[offset + 18]) == XYCSwap.opcode.asU8() && program[offset + 19] == 0;
    }
}
