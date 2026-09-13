export interface Arm {
  node: string;
  name: string;
  weight: number;
  allocation: number;
  mean: number;
  observations: number;
  bad: number;
  retired: boolean;
}
export type Decision = {
  node: string;
  action: "promote" | "retire";
  reason: string;
};
export class Allocator {
  arms: Arm[];
  peak: number;
  equity: number;
  halted = false;
  constructor(
    agents: { node: string; name: string }[],
    capital = 10000,
    readonly drawdownCap = 0.15,
    readonly gamma = 0.1,
  ) {
    if (
      !agents.length ||
      new Set(agents.map((a) => a.node)).size !== agents.length ||
      !Number.isFinite(capital) ||
      capital <= 0 ||
      drawdownCap <= 0 ||
      drawdownCap >= 1
    )
      throw new Error("Invalid allocator config");
    this.peak = this.equity = capital;
    this.arms = agents.map((a) => ({
      node: a.node,
      name: a.name,
      weight: 1,
      allocation: capital / agents.length,
      mean: 0.5,
      observations: 0,
      bad: 0,
      retired: false,
    }));
  }
  observe(
    node: string,
    reward: number,
    equity: number,
    selectionProbability?: number,
  ): Decision[] {
    if (
      !Number.isFinite(reward) ||
      reward < 0 ||
      reward > 1 ||
      !Number.isFinite(equity) ||
      equity < 0 ||
      (selectionProbability !== undefined &&
        (!Number.isFinite(selectionProbability) ||
          selectionProbability <= 0 ||
          selectionProbability > 1))
    )
      throw new Error("Invalid observation");
    const arm = this.arms.find((a) => a.node === node);
    if (!arm) throw new Error("Unknown agent");
    this.peak = Math.max(this.peak, equity);
    this.equity = equity;
    if (this.halted) return [];
    if (1 - equity / this.peak >= this.drawdownCap) {
      this.halted = true;
      return this.arms
        .filter((a) => !a.retired)
        .map((a) => {
          a.retired = true;
          a.allocation = 0;
          return {
            node: a.node,
            action: "retire",
            reason: "fund drawdown cap",
          };
        });
    }
    if (arm.retired) return [];
    const active = this.arms.filter((a) => !a.retired);
    const total = active.reduce((s, a) => s + a.weight, 0);
    const probability =
      selectionProbability ??
      ((1 - this.gamma) * arm.weight) / total + this.gamma / active.length;
    for (const a of active) a.weight = Math.pow(a.weight, 0.97);
    arm.weight *= Math.exp(
      Math.min(10, (this.gamma * reward) / (active.length * probability)),
    );
    arm.mean = 0.8 * arm.mean + 0.2 * reward;
    arm.observations++;
    arm.bad = reward < 0.8 ? arm.bad + 1 : Math.max(0, arm.bad - 1);
    const decisions: Decision[] = [];
    if (arm.bad >= 4) {
      arm.retired = true;
      decisions.push({
        node,
        action: "retire",
        reason: "verified process drift",
      });
    } else if (arm.observations % 10 === 0 && arm.mean > 0.8)
      decisions.push({
        node,
        action: "promote",
        reason: "sustained verified process quality",
      });
    const survivors = this.arms.filter((a) => !a.retired);
    const max = Math.max(1, ...survivors.map((a) => a.weight));
    for (const a of survivors) a.weight /= max;
    const sum = survivors.reduce((s, a) => s + a.weight, 0);
    for (const a of this.arms)
      a.allocation = a.retired
        ? 0
        : equity *
          (((1 - this.gamma) * a.weight) / sum + this.gamma / survivors.length);
    return decisions;
  }
}

/** Sample an arm using its current EXP3 allocation probability. */
export function sampleArm(
  allocator: Allocator,
  random: number,
): Arm | undefined {
  if (!Number.isFinite(random) || random < 0 || random >= 1)
    throw new Error("Random draw must be in [0,1)");
  if (allocator.halted) return undefined;
  const active = allocator.arms.filter((a) => !a.retired && a.allocation > 0);
  const total = active.reduce((s, a) => s + a.allocation, 0);
  let draw = random * total;
  for (const arm of active) {
    draw -= arm.allocation;
    if (draw < 0) return arm;
  }
  return active.at(-1);
}
