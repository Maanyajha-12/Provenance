// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Public deterministic marks for the test-token MVP; reporter prices are not a trustless market oracle.
contract PriceMarks {
    struct Mark {
        uint256 price;
        uint48 observedAt;
    }
    mapping(bytes32 => Mark) public latest;
    address public immutable reporter;
    event PriceMark(bytes32 indexed instrumentId, uint256 price, uint48 observedAt);

    constructor(address reporter_) {
        reporter = reporter_;
    }

    function mark(bytes32 instrumentId, uint256 price, uint48 observedAt) external {
        require(msg.sender == reporter && price > 0 && observedAt <= block.timestamp, "invalid mark");
        require(observedAt >= latest[instrumentId].observedAt, "older mark");
        latest[instrumentId] = Mark(price, observedAt);
        emit PriceMark(instrumentId, price, observedAt);
    }
}
