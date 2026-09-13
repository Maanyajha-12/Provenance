import { agentIdentityRecords } from "./identity.js";
import { isAddress, namehash } from "viem";

const [strategy, rootName, agentLabel, controller] = process.argv.slice(2);
if (!strategy || !rootName || !agentLabel || !controller) {
  throw new Error(
    "Usage: pnpm agent:onboard <strategy> <fund-name> <agent-label> <controller-address>",
  );
}
if (!isAddress(controller))
  throw new Error("controller must be a checksummed or valid EVM address");
if (!/^[a-z0-9-]+$/.test(strategy) || !/^[a-z0-9-]+$/.test(agentLabel)) {
  throw new Error(
    "strategy and agent label may only use lowercase letters, digits, and hyphens",
  );
}

const strategyName = `${strategy}.${rootName}`;
const agentName = `${agentLabel}.${strategyName}`;
const plan = {
  names: { root: rootName, strategy: strategyName, agent: agentName },
  nodes: {
    root: namehash(rootName),
    strategy: namehash(strategyName),
    agent: namehash(agentName),
  },
  controller,
  ensip26TextRecords: agentIdentityRecords(
    agentName,
    process.env.AGENT_SERVICE_URL ||
      "https://replace-with-agent-service.example",
  ),
  nextStep:
    "Submit these names and records through the verified ENSv2 Permissioned Registry/Resolver deployment.",
};
console.log(JSON.stringify(plan, null, 2));
