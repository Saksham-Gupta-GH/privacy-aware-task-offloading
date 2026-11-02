import { BrowserClassification } from "./types";
import { buildSearchPassages } from "./semantic";

export type BrowserWorker = {
  available?: boolean;
  ready?: boolean;
  queue_depth?: number;
  detail?: string;
};

export type BrowserCandidate = {
  tier: "local" | "edge" | "cloud";
  privacyAllowed: boolean;
  available: boolean;
  predictedLatencyMs: number | null;
  estimatedDeviceEnergyJ: number | null;
  score: number | null;
  selected: boolean;
  reason: string;
};

export type BrowserPlacement = {
  selectedTier: "local" | "edge" | "cloud" | null;
  candidates: BrowserCandidate[];
  explanation: string;
  scenario: string;
};

const PARAMETERS = {
  local: {
    baseMs: 10, perPassageMs: 28.4, rttMs: 0, bandwidthMbps: 10_000,
    computePowerW: 2.5, idlePowerW: 0, txPowerW: 0, rxPowerW: 0,
  },
  edge: {
    baseMs: 40, perPassageMs: 34.4, rttMs: 8, bandwidthMbps: 50,
    computePowerW: 0, idlePowerW: 0.8, txPowerW: 1.3, rxPowerW: 1.0,
  },
  cloud: {
    baseMs: 500, perPassageMs: 116, rttMs: 55, bandwidthMbps: 10,
    computePowerW: 0, idlePowerW: 0.8, txPowerW: 1.3, rxPowerW: 1.0,
  },
} as const;

const SCENARIO_DELAY: Record<string, Record<"local" | "edge" | "cloud", number>> = {
  live: { local: 0, edge: 0, cloud: 0 },
  client_busy: { local: 15_000, edge: 0, cloud: 0 },
  edge_busy: { local: 0, edge: 20_000, cloud: 0 },
  client_and_edge_busy: { local: 15_000, edge: 20_000, cloud: 0 },
};

const REFERENCES = { latencyMs: 30_000, deviceEnergyJ: 30 };

export function decideBrowserPlacement(args: {
  classification: BrowserClassification;
  workers: Record<string, BrowserWorker>;
  content: string;
  latencyWeight: number;
  scenario: string;
}): BrowserPlacement {
  const tiers = ["local", "edge", "cloud"] as const;
  const allowed = new Set(args.classification.allowedDestinations);
  const alpha = Math.min(1, Math.max(0, args.latencyWeight));
  const passageCount = Math.max(1, buildSearchPassages(args.content).length);
  const inputBytes = new TextEncoder().encode(args.content).byteLength;
  const outputBytes = passageCount * 384 * 4;
  const delays = SCENARIO_DELAY[args.scenario] ?? SCENARIO_DELAY.live;
  const calculated = new Map<string, { latency: number; energy: number; score: number }>();

  for (const tier of tiers) {
    const available = tier === "local" || Boolean(args.workers[tier]?.available && args.workers[tier]?.ready);
    if (!allowed.has(tier) || !available) continue;
    const parameters = PARAMETERS[tier];
    const processing = parameters.baseMs + parameters.perPassageMs * passageCount;
    const queue = (args.workers[tier]?.queue_depth ?? 0) * processing + delays[tier];
    const transferUp = tier === "local" ? 0 : inputBytes * 8 / (parameters.bandwidthMbps * 1000);
    const transferDown = tier === "local" ? 0 : outputBytes * 8 / (parameters.bandwidthMbps * 1000);
    const latency = parameters.rttMs + transferUp + processing + queue + transferDown;
    const energy = tier === "local"
      ? parameters.computePowerW * processing / 1000
      : parameters.txPowerW * transferUp / 1000
        + parameters.idlePowerW * (processing + queue) / 1000
        + parameters.rxPowerW * transferDown / 1000;
    const score = alpha * Math.min(latency / REFERENCES.latencyMs, 2)
      + (1 - alpha) * Math.min(energy / REFERENCES.deviceEnergyJ, 2);
    calculated.set(tier, { latency, energy, score });
  }

  const selectedTier = calculated.size
    ? [...calculated.entries()].sort((left, right) => left[1].score - right[1].score)[0][0] as "local" | "edge" | "cloud"
    : null;
  const candidates = tiers.map((tier): BrowserCandidate => {
    const privacyAllowed = allowed.has(tier);
    const available = tier === "local" || Boolean(args.workers[tier]?.available && args.workers[tier]?.ready);
    const metrics = calculated.get(tier);
    const reason = !privacyAllowed
      ? "Blocked by browser privacy policy"
      : !available
        ? args.workers[tier]?.detail || "Worker unavailable"
        : tier === selectedTier
          ? "Lowest permitted latency-energy score"
          : "Permitted, but has a higher combined score";
    return {
      tier,
      privacyAllowed,
      available,
      predictedLatencyMs: metrics ? Math.round(metrics.latency * 100) / 100 : null,
      estimatedDeviceEnergyJ: metrics ? Math.round(metrics.energy * 10000) / 10000 : null,
      score: metrics ? Math.round(metrics.score * 1_000_000) / 1_000_000 : null,
      selected: tier === selectedTier,
      reason,
    };
  });
  const blocked = candidates.filter((candidate) => !candidate.privacyAllowed).map((candidate) => candidate.tier);
  return {
    selectedTier,
    candidates,
    scenario: args.scenario,
    explanation: selectedTier
      ? `${selectedTier[0].toUpperCase()}${selectedTier.slice(1)} selected after local privacy filtering.${blocked.length ? ` Policy blocks ${blocked.join(", ")}.` : ""}`
      : "No privacy-permitted worker is currently available.",
  };
}
