// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Development harness for the ENSv2 fund/strategy/agent hierarchy.
/// @dev Production replaces this with ENSv2 Permissioned Registry/Resolver calls.
contract FundIdentityRegistry {
    error Unauthorized();
    error UnknownNode();
    error AlreadyRegistered();

    address public immutable fundAdmin;
    mapping(bytes32 => address) public controllerOf;
    mapping(bytes32 => bytes32) public parentOf;
    mapping(bytes32 => mapping(bytes32 => string)) private records;

    event NameRegistered(
        bytes32 indexed node, bytes32 indexed parentNode, address indexed controller
    );
    event TextRecordChanged(bytes32 indexed node, bytes32 indexed key, string value);

    constructor(address admin) {
        fundAdmin = admin;
        controllerOf[bytes32(0)] = admin;
    }

    function register(bytes32 parentNode, bytes32 label, address controller)
        external
        returns (bytes32 node)
    {
        if (controllerOf[parentNode] == address(0) && parentNode != bytes32(0)) {
            revert UnknownNode();
        }
        if (msg.sender != controllerOf[parentNode] && msg.sender != fundAdmin) {
            revert Unauthorized();
        }
        node = keccak256(abi.encodePacked(parentNode, label));
        if (controllerOf[node] != address(0)) revert AlreadyRegistered();
        controllerOf[node] = controller;
        parentOf[node] = parentNode;
        emit NameRegistered(node, parentNode, controller);
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        if (msg.sender != controllerOf[node]) revert Unauthorized();
        bytes32 keyHash = keccak256(bytes(key));
        records[node][keyHash] = value;
        emit TextRecordChanged(node, keyHash, value);
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return records[node][keccak256(bytes(key))];
    }
}
