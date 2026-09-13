import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { required } from "../packages/config/src/index.js";
const start = process.argv[2],
  stop = process.argv[3];
if (
  !start ||
  !stop ||
  !/^\d+$/.test(start) ||
  !/^\d+$/.test(stop) ||
  BigInt(stop) <= BigInt(start)
)
  throw new Error("Usage: reproduce START STOP (exclusive)");
required("SUBSTREAMS_API_TOKEN");
async function run(): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      process.env.SUBSTREAMS_BIN || "substreams",
      [
        "run",
        "packages/oracle/provenance.spkg",
        "map_rewards",
        "-e",
        required("SUBSTREAMS_ENDPOINT"),
        "-s",
        start,
        "-t",
        stop,
        "--final-blocks-only",
        "-o",
        "jsonl",
      ],
      { env: process.env },
    );
    let output = "";
    p.stdout.setEncoding("utf8");
    p.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 100_000_000) p.kill();
    });
    p.stderr.resume();
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`Substreams failed (${code})`)),
    );
  });
}
function payload(text: string): string {
  const data = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((x) => x["@module"] === "map_rewards" && x["@data"]);
  if (
    !data.some(
      (x) => Array.isArray(x["@data"].rewards) && x["@data"].rewards.length > 0,
    )
  )
    throw new Error("Empty output cannot prove determinism");
  // Remove transport-only metadata; retain block identity and exact emitted reward field order.
  return (
    data
      .map((x) =>
        JSON.stringify({
          block: x["@block"] ?? x.block,
          data: x["@data"] ?? x.data,
        }),
      )
      .join("\n") + "\n"
  );
}
const a = payload(await run()),
  b = payload(await run());
const hash = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
await mkdir("data/repro", { recursive: true });
await writeFile("data/repro/left.jsonl", a);
await writeFile("data/repro/right.jsonl", b);
const proof = {
  mode: "live",
  leftPreview: a.slice(0, 6000),
  rightPreview: b.slice(0, 6000),
  start,
  stop,
  packageHash: hash(await readFile("packages/oracle/provenance.spkg")),
  leftHash: hash(a),
  rightHash: hash(b),
  identical: a === b,
  createdAt: new Date().toISOString(),
};
await writeFile("data/repro/proof.json", JSON.stringify(proof, null, 2));
console.log(proof);
if (!proof.identical) process.exitCode = 1;
