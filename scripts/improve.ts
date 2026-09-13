import { readFile, writeFile } from "node:fs/promises";
import { normalizedAdvantages } from "../packages/backend/src/policy.js";
const rows = (await readFile("data/trajectories.jsonl", "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const complete = rows.filter(
  (r) => Number.isFinite(r.fusedReward) && r.rationale && r.intent,
);
if (complete.length < 2)
  throw new Error("Log at least two completed judged trajectories first");
const advantages = normalizedAdvantages(complete.map((r) => r.fusedReward));
const examples = complete
  .map((r, i) => ({ ...r, advantage: advantages[i] }))
  .filter((r) => r.advantage > 0)
  .sort((a, b) => b.advantage - a.advantage)
  .slice(0, 3);
if (!examples.length)
  throw new Error("No relative advantage; no update produced");
await writeFile(
  "data/policy-update.json",
  JSON.stringify(
    {
      kind: "offline-positive-advantage-example-selection",
      version: 1,
      createdAt: new Date().toISOString(),
      examples,
    },
    null,
    2,
  ),
);
console.log(
  "Saved an offline policy-context update in data/policy-update.json (not model-weight training).",
);
