import { createRequire } from "node:module";
import { dirname } from "node:path";
import { run } from "@graphprotocol/graph-cli";
import { required } from "../packages/config/src/index.js";
// Invoke Graph CLI in-process: deployment credentials never enter OS process arguments.
const require = createRequire(import.meta.url);
await run(
  [
    "deploy",
    required("SUBGRAPH_SLUG"),
    "packages/subgraph/subgraph.yaml",
    "--node",
    required("SUBGRAPH_DEPLOY_URL"),
    "--ipfs",
    required("SUBGRAPH_IPFS_URL"),
    "--version-label",
    "v0.1.0",
    "--deploy-key",
    required("SUBGRAPH_DEPLOY_KEY"),
  ],
  dirname(require.resolve("@graphprotocol/graph-cli/package.json")),
);
