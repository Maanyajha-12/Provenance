// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAuthoritySnapshot} from "./IAuthoritySnapshot.sol";

import {IAgentAuthority} from "./IAgentAuthority.sol";

/// @notice Fail-closed authority and mandate engine used by the execution adapter.
contract AgentAuthorityManager is IAgentAuthority {
    error Unauthorized();
    error InvalidMandate();
    error AgentNotActive();

    bytes32 public constant REASON_INACTIVE = keccak256("INACTIVE");
    bytes32 public constant REASON_EXPIRED = keccak256("EXPIRED");
    bytes32 public constant REASON_NOTIONAL = keccak256("NOTIONAL_CAP");
    bytes32 public constant REASON_SLIPPAGE = keccak256("SLIPPAGE_CAP");
    bytes32 public constant REASON_INSTRUMENT = keccak256("INSTRUMENT_NOT_ALLOWED");
    bytes32 public constant REASON_OK = keccak256("OK");

    struct Mandate {
        bool active;
        uint48 validUntil;
        uint128 maxNotional;
        uint16 maxSlippageBps;
        mapping(bytes32 => bool) allowedInstrument;
    }

    address public immutable allocator;
    mapping(bytes32 => Mandate) private mandates;

    event AuthorityChanged(bytes32 indexed agentNode, bool active, uint48 validUntil, address indexed actor);
    event MandateChanged(bytes32 indexed agentNode, uint128 maxNotional, uint16 maxSlippageBps);
    event InstrumentPermissionChanged(bytes32 indexed agentNode, bytes32 indexed instrumentId, bool allowed);
    event AgentHired(bytes32 indexed agentNode, uint48 validUntil, address indexed allocator);
    event AgentPromoted(bytes32 indexed agentNode, uint128 maxNotional, uint16 maxSlippageBps);
    event AgentFired(bytes32 indexed agentNode, address indexed allocator);

    constructor(address allocator_) {
        allocator = allocator_;
    }

    modifier onlyAllocator() {
        if (msg.sender != allocator) revert Unauthorized();
        _;
    }

    function setMandate(bytes32 node, uint48 validUntil, uint128 maxNotional, uint16 maxSlippageBps)
        external
        onlyAllocator
    {
        if (validUntil <= block.timestamp || maxNotional == 0 || maxSlippageBps > 10_000) {
            revert InvalidMandate();
        }
        Mandate storage mandate = mandates[node];
        mandate.validUntil = validUntil;
        mandate.maxNotional = maxNotional;
        mandate.maxSlippageBps = maxSlippageBps;
        emit MandateChanged(node, maxNotional, maxSlippageBps);
    }

    function setInstrument(bytes32 node, bytes32 instrumentId, bool allowed) external onlyAllocator {
        mandates[node].allowedInstrument[instrumentId] = allowed;
        emit InstrumentPermissionChanged(node, instrumentId, allowed);
    }

    function setActive(bytes32 node, bool active) external onlyAllocator {
        mandates[node].active = active;
        emit AuthorityChanged(node, active, mandates[node].validUntil, msg.sender);
    }

    /// @notice Grants an active trade mandate with one initial instrument. Additional instruments use setInstrument.
    function hire(bytes32 node, uint48 validUntil, uint128 maxNotional, uint16 maxSlippageBps, bytes32 instrumentId)
        external
        onlyAllocator
    {
        if (validUntil <= block.timestamp || maxNotional == 0 || maxSlippageBps > 10_000) revert InvalidMandate();
        Mandate storage mandate = mandates[node];
        mandate.validUntil = validUntil;
        mandate.maxNotional = maxNotional;
        mandate.maxSlippageBps = maxSlippageBps;
        mandate.allowedInstrument[instrumentId] = true;
        mandate.active = true;
        emit MandateChanged(node, maxNotional, maxSlippageBps);
        emit InstrumentPermissionChanged(node, instrumentId, true);
        emit AuthorityChanged(node, true, validUntil, msg.sender);
        emit AgentHired(node, validUntil, msg.sender);
    }

    /// @notice Widens or narrows a live agent's mandate without changing its identity.
    function promote(bytes32 node, uint48 validUntil, uint128 maxNotional, uint16 maxSlippageBps)
        external
        onlyAllocator
    {
        if (!mandates[node].active) revert AgentNotActive();
        if (validUntil <= block.timestamp || maxNotional == 0 || maxSlippageBps > 10_000) {
            revert InvalidMandate();
        }
        Mandate storage mandate = mandates[node];
        mandate.validUntil = validUntil;
        mandate.maxNotional = maxNotional;
        mandate.maxSlippageBps = maxSlippageBps;
        emit MandateChanged(node, maxNotional, maxSlippageBps);
        emit AgentPromoted(node, maxNotional, maxSlippageBps);
    }

    /// @notice Immediately removes active trade authority while retaining the audit trail and mandate configuration.
    function fire(bytes32 node) external onlyAllocator {
        mandates[node].active = false;
        emit AuthorityChanged(node, false, mandates[node].validUntil, msg.sender);
        emit AgentFired(node, msg.sender);
    }

    function mandateSummary(bytes32 node)
        external
        view
        returns (bool active, uint48 validUntil, uint128 maxNotional, uint16 maxSlippageBps)
    {
        Mandate storage mandate = mandates[node];
        return (mandate.active, mandate.validUntil, mandate.maxNotional, mandate.maxSlippageBps);
    }

    function mandateSnapshot(bytes32 node, bytes32 instrument)
        external
        view
        returns (IAuthoritySnapshot.Snapshot memory)
    {
        Mandate storage m = mandates[node];
        return IAuthoritySnapshot.Snapshot(
            m.active, m.validUntil, m.maxNotional, m.maxSlippageBps, m.allowedInstrument[instrument]
        );
    }

    function checkTrade(TradeRequest calldata request) external view returns (bool, bytes32) {
        Mandate storage mandate = mandates[request.agentNode];
        if (!mandate.active) return (false, REASON_INACTIVE);
        if (block.timestamp > mandate.validUntil) return (false, REASON_EXPIRED);
        if (request.notional > mandate.maxNotional) return (false, REASON_NOTIONAL);
        if (request.maxSlippageBps > mandate.maxSlippageBps) return (false, REASON_SLIPPAGE);
        if (!mandate.allowedInstrument[request.instrumentId]) return (false, REASON_INSTRUMENT);
        return (true, REASON_OK);
    }
}
