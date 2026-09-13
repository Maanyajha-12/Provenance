import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { required } from "../../config/src/index.js";
import { Runtime, type Reward } from "./runtime.js";
export function providerRewards(line: string): Reward[] {
  const envelope = JSON.parse(line);
  if (envelope["@undo"]) throw new Error("Unexpected undo in finalized stream");
  if (envelope["@module"] !== "map_rewards") return [];
  const data = envelope["@data"];
  if (data?.["@error"])
    throw new Error("Provider failed to decode reward output");
  if (!data) return [];
  return (data.rewards ?? []).map((r: Reward) => ({
    ...r,
    verified: r.verified ?? 0,
    hedge: r.hedge ?? 0,
    slippage: r.slippage ?? 0,
    mandate: r.mandate ?? 0,
    staleness: r.staleness ?? 0,
  }));
}
export async function stream(runtime: Runtime, signal: AbortSignal) {
  required("SUBSTREAMS_API_TOKEN");
  while (!signal.aborted) {
    let child: ReturnType<typeof spawn> | undefined;
    try {
      await runtime.drain();
      const start =
        BigInt(runtime.state.lastBlock) > 0n
          ? runtime.state.lastBlock
          : required("AGENT_DESK_START_BLOCK");
      child = spawn(
        process.env.SUBSTREAMS_BIN || "substreams",
        [
          "run",
          "packages/oracle/provenance.spkg",
          "map_rewards",
          "-e",
          required("SUBSTREAMS_ENDPOINT"),
          "--final-blocks-only",
          "--production-mode",
          "-s",
          start,
          "-o",
          "jsonl",
          "--limit-processed-blocks",
          "0",
        ],
        { env: process.env, signal },
      );
      let childError: Error | undefined;
      child.on("error", (e) => {
        childError = e;
      });
      child.stderr!.resume();
      for await (const line of createInterface({ input: child.stdout! })) {
        if (!line.trim()) continue;
        for (const reward of providerRewards(line))
          await runtime.ingest(reward);
      }
      if (childError) throw childError;
      if (!signal.aborted)
        throw new Error("Provider stream ended; reconnecting");
    } catch (e) {
      if (!signal.aborted) {
        runtime.state.error = e instanceof Error ? e.message : "Stream failed";
        await runtime.flush();
      }
    } finally {
      child?.kill();
    }
    if (!signal.aborted)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
  }
}
