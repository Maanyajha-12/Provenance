import "dotenv/config";
import { spawn } from "node:child_process";
import { required } from "../packages/config/src/index.js";
const bin = process.env.SUBSTREAMS_BIN || "substreams";
const mode = process.argv[2] || "pack";
const manifest = "packages/oracle/substreams.live.yaml";
let args: string[];
if (mode === "pack")
  args = ["pack", manifest, "-o", "packages/oracle/provenance.spkg"];
else if (mode === "publish")
  args = ["publish", "packages/oracle/provenance.spkg"];
else if (mode === "stream") {
  required("SUBSTREAMS_API_TOKEN");
  args = [
    "run",
    manifest,
    "map_rewards",
    "-e",
    required("SUBSTREAMS_ENDPOINT"),
    "--final-blocks-only",
    "-o",
    "jsonl",
    "--limit-processed-blocks",
    "0",
  ];
} else throw new Error("Use pack, publish, or stream");
const child = spawn(bin, args, { stdio: "inherit", env: process.env });
child.on("error", () => {
  console.error("Substreams CLI unavailable");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
