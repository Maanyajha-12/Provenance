/** ENSIP-26 agent identity records; mandate records use a separate fund.* namespace. */
export function agentIdentityRecords(agentName: string, endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("AGENT_SERVICE_URL must be an absolute agent endpoint URL");
  }
  if (!["https:", "http:", "ipfs:"].includes(url.protocol) || !url.hostname)
    throw new Error("AGENT_SERVICE_URL must use https://, http://, or ipfs://");
  return {
    "agent-context": JSON.stringify({
      name: agentName,
      description:
        "Provenance trading agent on Sepolia. Discover its web interface through the agent-endpoint[web] text record.",
      chainId: 11155111,
    }),
    "agent-endpoint[web]": endpoint,
  };
}
