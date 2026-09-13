// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAuthoritySnapshot} from "./IAuthoritySnapshot.sol";
import {IAgentAuthority} from "./IAgentAuthority.sol";

interface IENSRegistry {
    function getResource(uint256 id) external view returns (uint256);
    function getTokenId(uint256 id) external view returns (uint256);
    function getExpiry(uint256 id) external view returns (uint64);
    function getOwner(uint256 id) external view returns (address);
    function hasRoles(uint256 id, uint256 roles, address account) external view returns (bool);
}

interface IENSResolver {
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

/// @notice Pins a name's current resource and token generation at enrollment. Transfers,
/// expiry and resource changes fail closed until the allocator explicitly re-enrolls it.
contract ENSv2Authority is IAgentAuthority {
    struct Binding {
        IENSRegistry registry;
        IENSResolver resolver;
        uint256 labelId;
        uint256 resource;
        uint256 tokenId;
        address owner;
        address signer;
    }
    address public immutable allocator;
    uint256 public immutable activeRole;
    mapping(bytes32 => Binding) public bindings;
    event AgentBound(bytes32 indexed node, address registry, address resolver, uint256 labelId, address signer);

    constructor(address allocator_, uint256 activeRole_) {
        require(allocator_ != address(0) && activeRole_ != 0, "invalid config");
        allocator = allocator_;
        activeRole = activeRole_;
    }

    function bind(bytes32 node, IENSRegistry registry, IENSResolver resolver, uint256 labelId, address signer)
        external
    {
        require(msg.sender == allocator && signer != address(0), "unauthorized");
        require(registry.getOwner(labelId) != address(0), "unregistered");
        bindings[node] = Binding(
            registry,
            resolver,
            labelId,
            registry.getResource(labelId),
            registry.getTokenId(labelId),
            registry.getOwner(labelId),
            signer
        );
        emit AgentBound(node, address(registry), address(resolver), labelId, signer);
    }

    function checkTrade(TradeRequest calldata request) external view returns (bool, bytes32) {
        // External beta contracts may revert; never interpret that as authorization.
        try this.validate(request) returns (bool ok) {
            return (ok, ok ? keccak256("OK") : keccak256("ENS_DENIED"));
        } catch {
            return (false, keccak256("ENS_UNAVAILABLE"));
        }
    }

    function validate(TradeRequest calldata r) external view returns (bool) {
        Binding storage b = bindings[r.agentNode];
        if (address(b.registry) == address(0)) return false;
        if (b.registry.getExpiry(b.labelId) <= block.timestamp || b.registry.getOwner(b.labelId) != b.owner) {
            return false;
        }
        if (b.registry.getResource(b.labelId) != b.resource || b.registry.getTokenId(b.labelId) != b.tokenId) {
            return false;
        }
        if (!b.registry.hasRoles(b.labelId, activeRole, b.signer)) return false;
        uint256 cap = number(b.resolver.text(r.agentNode, "fund.maxNotional"));
        uint256 slip = number(b.resolver.text(r.agentNode, "fund.maxSlippageBps"));
        return cap > 0 && slip <= 10000 && r.notional <= cap && r.maxSlippageBps <= slip
            && number(b.resolver.text(r.agentNode, "fund.validUntil")) > block.timestamp
            && keccak256(bytes(b.resolver.text(r.agentNode, string.concat("fund.instrument.", hex32(r.instrumentId)))))
                == keccak256("true");
    }

    function mandateSnapshot(bytes32 node, bytes32 instrument)
        external
        view
        returns (IAuthoritySnapshot.Snapshot memory s)
    {
        try this.snapshotUnsafe(node, instrument) returns (IAuthoritySnapshot.Snapshot memory value) {
            return value;
        }
            catch {
            return s;
        }
    }

    function snapshotUnsafe(bytes32 node, bytes32 instrument)
        external
        view
        returns (IAuthoritySnapshot.Snapshot memory s)
    {
        Binding storage b = bindings[node];
        s.active = b.registry.getExpiry(b.labelId) > block.timestamp && b.registry.getOwner(b.labelId) == b.owner
            && b.registry.getResource(b.labelId) == b.resource && b.registry.getTokenId(b.labelId) == b.tokenId
            && b.registry.hasRoles(b.labelId, activeRole, b.signer);
        uint256 expiry = number(b.resolver.text(node, "fund.validUntil"));
        require(expiry <= type(uint48).max, "invalid expiry");
        s.validUntil = uint48(expiry);
        s.maxNotional = number(b.resolver.text(node, "fund.maxNotional"));
        s.maxSlippageBps = number(b.resolver.text(node, "fund.maxSlippageBps"));
        s.instrumentAllowed = keccak256(
            bytes(b.resolver.text(node, string.concat("fund.instrument.", hex32(instrument))))
        ) == keccak256("true");
    }

    function number(string memory value) internal pure returns (uint256 n) {
        bytes memory s = bytes(value);
        require(s.length > 0 && s.length <= 78, "invalid decimal");
        for (uint256 i; i < s.length; i++) {
            uint8 c = uint8(s[i]);
            require(c >= 48 && c <= 57, "invalid decimal");
            n = n * 10 + c - 48;
        }
    }

    function hex32(bytes32 value) internal pure returns (string memory) {
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        bytes memory alphabet = "0123456789abcdef";
        for (uint256 i; i < 32; i++) {
            out[2 + i * 2] = alphabet[uint8(value[i]) >> 4];
            out[3 + i * 2] = alphabet[uint8(value[i]) & 15];
        }
        return string(out);
    }
}
