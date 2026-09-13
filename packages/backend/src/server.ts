import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { namehash, keccak256, toHex, zeroAddress } from "viem";
import { required } from "../../config/src/index.js";
import { FileStore, PostgresStore } from "./store.js";
import { Runtime, loadAgents, type AgentConfig } from "./runtime.js";
import { agentRound } from "./agents.js";
import { stream } from "./stream.js";
if (process.env.DATA_MODE && !["live", "demo"].includes(process.env.DATA_MODE))
  throw new Error("DATA_MODE must be live or demo");
const mode = process.env.DATA_MODE === "live" ? "live" : "demo";
const agents: AgentConfig[] =
  mode === "live"
    ? await loadAgents()
    : ["atlas", "delta", "echo"].map((name) => ({
        node: namehash(`${name}.momentum.veriprocess.eth`),
        name: `${name}.momentum.veriprocess.eth`,
        signer: zeroAddress,
        registry: zeroAddress,
        resolver: zeroAddress,
        labelId: "0",
        signerKey: "",
        maxNotional: "100000000000000000000",
        maxSlippageBps: 100,
      }));
const runtime = new Runtime(
  agents,
  mode === "live"
    ? new PostgresStore(required("DATABASE_URL"))
    : new FileStore(),
  mode,
  Number(process.env.FUND_INITIAL_CAPITAL || 10000),
);
await runtime.init();
const abort = new AbortController();
let tick = 0;
let interval: NodeJS.Timeout | undefined;
let agentTimer: NodeJS.Timeout | undefined;
let agentBusy = false;
if (mode === "live") {
  void stream(runtime, abort.signal);
  if (process.env.ENABLE_AGENT_EXECUTION === "true")
    agentTimer = setInterval(() => {
      if (agentBusy) return;
      agentBusy = true;
      void agentRound(runtime)
        .catch((e) => console.error("Agent round paused:", e.message))
        .finally(() => {
          agentBusy = false;
        });
    }, 30000);
} else
  interval = setInterval(() => {
    void (async () => {
      const active = agents.filter(
        (a) =>
          !runtime.state.allocator.arms.find((arm) => arm.node === a.node)
            ?.retired,
      );
      if (!active.length) return;
      const agent = active[tick % active.length];
      const index = agents.indexOf(agent);
      const score = index === 2 ? 7500 : index === 1 ? 8750 : 9750;
      tick++;
      await runtime.ingest({
        id: keccak256(
          toHex(
            `demo-${runtime.state.rewards.length}-${tick}-${runtime.state.lastBlock}`,
          ),
        ),
        agentNode: agent.node,
        instrumentId: keccak256(toHex("pBASE/pUSD")),
        block: String(BigInt(runtime.state.lastBlock) + 1n),
        blockHash: "DEMO",
        txHash: "DEMO",
        verified: score,
        hedge: index === 2 ? -10000 : index === 1 ? 0 : 8000,
        slippage: 10000,
        mandate: 10000,
        staleness: 10000,
        position: String(tick),
        mark: "1000000000000000000",
        routeRegretStub: true,
      });
    })().catch((e) => {
      runtime.state.error = e.message;
    });
  }, 2500);
const server = createServer(async (req, res) => {
  const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Cache-Control", "no-store");
  const json = (data: unknown, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (req.method !== "GET") {
    json({ error: "Read-only API" }, 405);
    return;
  }
  if (req.url === "/api/state") {
    json(runtime.state);
    return;
  }
  if (req.url === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    });
    const send = () => res.write(`data: ${JSON.stringify(runtime.state)}\n\n`);
    send();
    const timer = setInterval(send, 2000);
    req.on("close", () => clearInterval(timer));
    return;
  }
  if (req.url === "/api/repro") {
    try {
      json(JSON.parse(await readFile("data/repro/proof.json", "utf8")));
    } catch {
      json({
        identical: null,
        mode,
        status:
          "No live replay has been recorded. Run pnpm oracle:reproduce START STOP.",
      });
    }
    return;
  }
  if (req.url === "/api/history") {
    if (mode === "demo") {
      json({ source: "demo", rewards: runtime.state.rewards });
      return;
    }
    try {
      const response = await fetch(required("SUBGRAPH_QUERY_URL"), {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query:
            "{ rewards(first: 100, orderBy: block, orderDirection: desc) { id agentNode block verified hedge slippage mandate staleness txHash } }",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error("GraphQL unavailable");
      json({ source: "subgraph", ...result });
    } catch {
      json({ error: "Subgraph query failed" }, 502);
    }
    return;
  }
  json({ error: "Not found" }, 404);
});
server.listen(
  Number(process.env.BACKEND_PORT || 3001),
  process.env.BACKEND_HOST || "127.0.0.1",
  () => console.log(`Provenance backend running (${mode})`),
);
async function shutdown() {
  abort.abort();
  if (interval) clearInterval(interval);
  if (agentTimer) clearInterval(agentTimer);
  server.close();
  await runtime.store.close();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
