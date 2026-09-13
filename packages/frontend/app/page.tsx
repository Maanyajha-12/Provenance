"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import InteractiveBlurReveal from "@/components/ui/interactive-blur-reveal";
const Wallet = dynamic(() => import("../components/wallet"), { ssr: false });
type Arm = {
  node: string;
  name: string;
  allocation: number;
  mean: number;
  retired: boolean;
  observations: number;
};
type Reward = {
  id: string;
  agentNode: string;
  block: string;
  verified: number;
  hedge: number;
  slippage: number;
  mandate: number;
  staleness: number;
  txHash: string;
};
type State = {
  mode: string;
  allocator: { equity: number; peak: number; halted: boolean; arms: Arm[] };
  rewards: Reward[];
  lifecycle: {
    id: string;
    node: string;
    action: string;
    reason: string;
    status: string;
    hash?: string;
  }[];
  error?: string;
  updatedAt: string;
};
type Proof = {
  identical: boolean | null;
  leftPreview?: string;
  rightPreview?: string;
  leftHash?: string;
  rightHash?: string;
  packageHash?: string;
  start?: string;
  stop?: string;
  status?: string;
};
const api = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const cash = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
export default function Dashboard() {
  const reducedMotion = useReducedMotion();
  const entrance = {
    initial: { opacity: 0, y: reducedMotion ? 0 : 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: reducedMotion ? 0 : 0.65 },
  };
  const [state, setState] = useState<State | null>(null);
  const [connected, setConnected] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  const [history, setHistory] = useState<Reward[]>([]);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    const source = new EventSource(`${api}/api/events`);
    source.onmessage = (e) => {
      try {
        setState(JSON.parse(e.data));
        setConnected(true);
      } catch {
        setConnected(false);
      }
    };
    source.onerror = () => setConnected(false);
    const refresh = () => {
      void fetch(`${api}/api/repro`)
        .then((r) => r.json())
        .then(setProof)
        .catch(() => {});
      void fetch(`${api}/api/history`)
        .then((r) => r.json())
        .then((x) => {
          if (x.error || x.errors) {
            setHistoryError("History is unavailable");
            return;
          }
          setHistory(x.rewards ?? x.data?.rewards ?? []);
          setHistoryError("");
        })
        .catch(() => setHistoryError("History is unavailable"));
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      source.close();
      clearInterval(timer);
    };
  }, []);
  const arms = state?.allocator.arms ?? [];
  const rewards = state?.rewards ?? [];
  const latest = rewards.slice(-32);
  const mean = rewards.length
    ? rewards.reduce((s, r) => s + r.verified, 0) / rewards.length / 100
    : 0;
  const name = (node: string) =>
    arms.find((a) => a.node === node)?.name.split(".")[0] ?? node.slice(0, 8);
  return (
    <MotionConfig reducedMotion="user">
      <main>
        <header>
          <a className="brand" href="/" aria-label="Provenance home">
            <span className="brandmark">p</span> provenance
            <span className="beta">FUND LAB</span>
          </a>
          <div className="headerRight">
            <span className="network">◈ Sepolia · 11155111</span>
            <Wallet />
          </div>
        </header>
        <section className="intro" aria-label="Fund overview">
          <InteractiveBlurReveal mouseRadius={160} duration={0.6} />
          <div className="hero-shade" />
          <motion.div className="hero-copy" {...entrance}>
            <div className="eyebrow">VERIFIABLE PROCESS REWARD FUND</div>
            <h1>
              Good decisions.
              <br />
              <span>Public evidence.</span>
            </h1>
            <p>
              A fund that rewards how agents trade. Follow the capital,
              <br className="desktop" /> inspect each decision, and recompute
              the result.
            </p>
            <a className="hero-link" href="#reward-ledger">
              Explore the evidence <span aria-hidden="true">↗</span>
            </a>
          </motion.div>
          <motion.div className="statusbox" {...entrance}>
            <span className={`dot ${connected ? "on" : ""}`} />
            <strong>
              {!state
                ? "Connecting"
                : state.mode === "demo"
                  ? "Demonstration mode"
                  : state.rewards.length && !state.error
                    ? "Live Graph provider"
                    : "Live mode · waiting for data"}
            </strong>
            <p>
              {state?.mode === "demo"
                ? "Synthetic rewards · no on-chain execution"
                : connected
                  ? "Finalized Sepolia blocks · verified reward stream"
                  : "Waiting for the backend connection"}
            </p>
            <div className="cycle">
              Act <span>→</span> Enforce <span>→</span> Reward <span>→</span>{" "}
              Allocate
            </div>
          </motion.div>
          <div className="hero-caption">
            <span>01 / THE FUND, IN FOCUS</span>
            <span className="reveal-hint">
              Move your cursor to reveal the landscape
            </span>
          </div>
        </section>
        {state?.error && (
          <div className="alert" role="alert">
            Loop paused: {state.error}
          </div>
        )}
        <motion.section className="metrics" {...entrance}>
          <article>
            <div>
              FUND EQUITY <span>↗</span>
            </div>
            <strong>
              {state ? cash(state.allocator.equity) : "—"} <small>pUSD</small>
            </strong>
            <p>Test-token mark-to-market value</p>
          </article>
          <article>
            <div>VERIFIED PROCESS SCORE</div>
            <strong>
              {rewards.length ? mean.toFixed(1) : "—"}
              <small> / 100</small>
            </strong>
            <p>Chain-derived component only</p>
          </article>
          <article>
            <div>ACTIVE AGENTS</div>
            <strong>
              {arms.filter((a) => !a.retired).length}
              <small> / {arms.length}</small>
            </strong>
            <p>ENS identity · scoped authority</p>
          </article>
          <article>
            <div>RISK CONTROL</div>
            <strong className={state?.allocator.halted ? "danger" : "green"}>
              {state?.allocator.halted ? "Halted" : "15% cap"}
            </strong>
            <p>Fund-level drawdown protection</p>
          </article>
        </motion.section>
        <motion.section className="middle" {...entrance}>
          <article className="panel chartpanel">
            <div className="panelhead">
              <div className="eyebrow">PROCESS, OVER PROFIT</div>
              <h2>Every step leaves a signal.</h2>
              <span className="tag">{latest.length} recent fills</span>
            </div>
            <div className="chart">
              <div className="axis">
                <span>100</span>
                <span>50</span>
                <span>0</span>
              </div>
              <svg
                viewBox="0 0 800 220"
                role="img"
                aria-label="Verified reward score over the most recent fills"
              >
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b7eb79" stopOpacity=".3" />
                    <stop offset="100%" stopColor="#b7eb79" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 110, 200].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="800"
                    y1={y}
                    y2={y}
                    stroke="#28352e"
                    strokeDasharray="4 5"
                  />
                ))}
                {latest.length > 1 && (
                  <>
                    <polygon
                      fill="url(#fill)"
                      points={`0,220 ${latest.map((r, i) => `${(i * 800) / (latest.length - 1)},${200 - (r.verified / 10000) * 180}`).join(" ")} 800,220`}
                    />
                    <polyline
                      fill="none"
                      stroke="#b7eb79"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      points={latest
                        .map(
                          (r, i) =>
                            `${(i * 800) / (latest.length - 1)},${200 - (r.verified / 10000) * 180}`,
                        )
                        .join(" ")}
                    />
                  </>
                )}
              </svg>
              {!latest.length && (
                <div className="emptychart">
                  Rewards will appear when the backend produces a fill.
                </div>
              )}
            </div>
            <div className="chartfooter">
              <span>
                <i /> Verified reward
              </span>
              <span>
                {state?.mode === "demo"
                  ? "SIMULATED BLOCKS"
                  : "FINALIZED BLOCKS"}
              </span>
            </div>
          </article>
          <article className="panel allocation">
            <div className="eyebrow">CAPITAL FOLLOWS EVIDENCE</div>
            <h2>Agent allocation</h2>
            {arms.map((a, i) => (
              <div className="allocationrow" key={a.node}>
                <div>
                  <span className={`agenticon a${i}`}>
                    {a.name[0].toUpperCase()}
                  </span>
                  <strong>{name(a.node)}</strong>
                  <span>{cash(a.allocation)} pUSD</span>
                </div>
                <div className="bar">
                  <motion.span
                    initial={false}
                    transition={{ duration: reducedMotion ? 0 : 0.8 }}
                    animate={{
                      width: `${state && state.allocator.equity ? (a.allocation / state.allocator.equity) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {a.retired
                    ? "Retired · zero allocation"
                    : `${a.observations} observations · ${(a.mean * 100).toFixed(0)} process score`}
                </small>
              </div>
            ))}
            {!arms.length && <p className="muted">Awaiting agent registry…</p>}
          </article>
        </motion.section>
        <motion.section className="bottom" {...entrance}>
          <article className="panel ledger" id="reward-ledger">
            <div className="panelhead">
              <div className="eyebrow">THE DECISION LEDGER</div>
              <h2>Inspect the reward vector</h2>
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>AGENT / BLOCK</th>
                    <th>HEDGE</th>
                    <th>SLIPPAGE</th>
                    <th>MANDATE</th>
                    <th>FRESHNESS</th>
                    <th>SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards
                    .slice(-6)
                    .reverse()
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>
                            {arms.find((a) => a.node === r.agentNode)?.name ??
                              r.agentNode}
                          </strong>
                          <small>
                            #{r.block}
                            {state?.mode === "live" &&
                              /^0x[\da-f]{64}$/i.test(r.txHash) && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <a
                                    href={`https://sepolia.etherscan.io/tx/${r.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    view tx ↗
                                  </a>
                                </>
                              )}
                          </small>
                        </td>
                        {[r.hedge, r.slippage, r.mandate, r.staleness].map(
                          (v, i) => (
                            <td key={i}>{(v / 100).toFixed(0)}</td>
                          ),
                        )}
                        <td>
                          <span className="score">
                            {(r.verified / 100).toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!rewards.length && (
                <p className="empty">No fills recorded yet.</p>
              )}
            </div>
            <p className="footnote">
              Route regret is stubbed and excluded. The LLM judge is off-chain
              and excluded from this score.
            </p>
          </article>
          <article className="panel lifecycle">
            <div className="eyebrow">THE ORGANIZATION EVOLVES</div>
            <h2>Lifecycle feed</h2>
            {state?.lifecycle
              .slice(-5)
              .reverse()
              .map((d) => (
                <div className="event" key={d.id}>
                  <span
                    className={d.action === "retire" ? "retire" : "promote"}
                  >
                    {d.action === "retire" ? "↘" : "↗"}
                  </span>
                  <div>
                    <strong>
                      {name(d.node)} · {d.action}
                    </strong>
                    <p>{d.reason}</p>
                    <small>
                      {d.status}
                      {state.mode === "demo"
                        ? " · simulated"
                        : d.hash
                          ? ` · ${d.hash.slice(0, 12)}…`
                          : ""}
                    </small>
                  </div>
                </div>
              ))}
            {!state?.lifecycle.length && (
              <p className="muted">
                Promotions and retirements appear here as the allocator
                evaluates evidence.
              </p>
            )}
          </article>
        </motion.section>
        <motion.section className="proof" {...entrance}>
          <div>
            <div className="eyebrow">DON’T TRUST. RECOMPUTE.</div>
            <h2>Same blocks. Same rewards.</h2>
            <p>
              {proof?.identical === true
                ? `Independent runs over blocks ${proof.start}–${proof.stop} produced matching output.`
                : (proof?.status ??
                  "Live replay evidence has not been recorded yet.")}
            </p>
            <span
              className={`proofbadge ${proof?.identical === true ? "matched" : ""}`}
            >
              {proof?.identical === true
                ? "✓ Byte-identical payloads"
                : proof?.identical === false
                  ? "Replay mismatch"
                  : "Awaiting live proof"}
            </span>
          </div>
          <div className="hashes">
            <div>
              <small>RUN A · SHA-256</small>
              <code>{proof?.leftHash ?? "No replay recorded"}</code>
            </div>
            <div>
              <small>RUN B · SHA-256</small>
              <code>{proof?.rightHash ?? "No replay recorded"}</code>
            </div>
            {proof?.packageHash && (
              <div>
                <small>PACKAGE · SHA-256</small>
                <code>{proof.packageHash}</code>
              </div>
            )}
          </div>
        </motion.section>
        {proof?.leftPreview && (
          <details className="history">
            <summary>Inspect replay payloads side by side</summary>
            <div className="replaypayloads">
              <pre>{proof.leftPreview}</pre>
              <pre>{proof.rightPreview}</pre>
            </div>
          </details>
        )}
        <details className="history">
          <summary>
            Reward history ·{" "}
            {state?.mode === "live" ? "Subgraph GraphQL" : "demo datastore"} (
            {history.length})
          </summary>
          {historyError ? (
            <p>{historyError}</p>
          ) : (
            <pre>{JSON.stringify(history.slice(0, 10), null, 2)}</pre>
          )}
        </details>
        <footer>
          <span>provenance / Sepolia research fund</span>
          <span>The Graph · 1inch Aqua + SwapVM · ENSv2</span>
          <span>
            {state?.mode === "demo" ? "DEMO DATA" : "PUBLIC EVIDENCE"}
          </span>
        </footer>
      </main>
    </MotionConfig>
  );
}
