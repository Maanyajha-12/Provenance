// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IAuthoritySnapshot {
    struct Snapshot {
        bool active;
        uint48 validUntil;
        uint256 maxNotional;
        uint256 maxSlippageBps;
        bool instrumentAllowed;
    }
    function mandateSnapshot(bytes32 node, bytes32 instrument) external view returns (Snapshot memory);
}
