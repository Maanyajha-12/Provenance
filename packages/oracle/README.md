# Provenance reward oracle

A Sepolia Substreams package for bounded integer process rewards. `map_events` decodes configured desk intent, settlement, fill, mandate-snapshot and public-mark events; it also preserves the configured ENS registry/resolver/EAC events. Stores track cumulative base-token exposure, marks and per-instrument mandate snapshots at event ordinals. `map_rewards` emits pure predicate results; `graph_out` emits canonical EntityChanges for a Substreams-powered subgraph.

Configure a deployed desk, marks contract, authority event addresses, and the deployment block with `pnpm oracle:configure`. Build and pack using the root scripts. Placeholder manifests can be packed for validation but fail closed if used for streaming.

Scores use basis points. Hedge efficacy is reduction in absolute accumulated trade exposure toward zero (bounded -10000 to 10000); slippage, mandate respect and freshness are binary (0 or 10000). Verified score is the average of the normalized hedge component and these three binary scores. Route regret is explicitly stubbed, excluded from the average. Freshness requires a public price mark no more than 60 seconds old and no later than the block timestamp.

Mandate snapshots are emitted by the desk from the adapter's actual registry/resolver reads immediately before execution. Original ENS events are retained, but the module does not independently reimplement every ENSv2 inheritance rule. Published bytecode and deployment addresses are part of the verifier's trust boundary. LLM assessments never enter this package.

All monetary arithmetic is arbitrary-precision integer math. Log ordering and output field ordering are canonicalized. A unit test checks protobuf byte identity; `oracle:reproduce` checks emitted payload identity for two independent finalized provider runs over a fixed range. The provider proof is only valid after running it on actual Sepolia fills.
