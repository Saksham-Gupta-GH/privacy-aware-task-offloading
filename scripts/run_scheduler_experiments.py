#!/usr/bin/env python3
"""Generate reproducible optimizer trade-off and energy-sensitivity results."""

from __future__ import annotations

import copy
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from privacydrive.classifier import PrivacyClassifier
from privacydrive.scheduler import PlacementOptimizer, WorkerState


DOCUMENTS = [
    "public_event.txt",
    "public_contact.txt",
    "personal_contacts.txt",
    "restricted_payment.txt",
    "restricted_health.txt",
]
POWER_KEYS = ("compute_power_w", "idle_power_w", "tx_power_w", "rx_power_w")


def evaluate(
    optimizer: PlacementOptimizer, alpha: float, scenario: str = "live"
) -> dict[str, object]:
    classifier = PrivacyClassifier()
    states = {
        tier: WorkerState(tier=tier, available=True, ready=True)
        for tier in ("local", "edge", "cloud")
    }
    selections: Counter[str] = Counter()
    latencies: list[float] = []
    energies: list[float] = []
    violations = 0
    for filename in DOCUMENTS:
        content = (ROOT / "data" / "synthetic" / "documents" / filename).read_text(
            encoding="utf-8"
        )
        classification = classifier.classify(content)
        decision = optimizer.decide(
            allowed_destinations=classification.allowed_destinations,
            worker_states=states,
            input_bytes=len(content.encode("utf-8")),
            passage_count=32,
            latency_weight=alpha,
            scenario=scenario,
        )
        selected = next(item for item in decision.candidates if item.selected)
        selections[selected.tier] += 1
        latencies.append(float(selected.predicted_latency_ms))
        energies.append(float(selected.estimated_device_energy_j))
        violations += int(selected.tier not in classification.allowed_destinations)
    return {
        "alpha_latency": alpha,
        "average_predicted_latency_ms": round(sum(latencies) / len(latencies), 3),
        "average_estimated_device_energy_j": round(sum(energies) / len(energies), 4),
        "policy_violations": violations,
        "tier_counts": dict(sorted(selections.items())),
    }


def main() -> None:
    base = PlacementOptimizer()
    alpha_sweep = [evaluate(base, alpha) for alpha in (0.0, 0.25, 0.5, 0.65, 0.75, 1.0)]
    sensitivity = []
    for factor in (0.7, 1.0, 1.3):
        candidate = PlacementOptimizer()
        candidate.calibration = copy.deepcopy(base.calibration)
        for tier in candidate.calibration["tiers"].values():
            for key in POWER_KEYS:
                if key in tier:
                    tier[key] *= factor
        sensitivity.append({"power_factor": factor, **evaluate(candidate, 0.65)})
    result = {
        "schema_version": 1,
        "calibration_version": base.calibration["version"],
        "scenario": "live all-ready worker state",
        "documents": DOCUMENTS,
        "alpha_sweep": alpha_sweep,
        "power_sensitivity": sensitivity,
    }
    output = ROOT / "validation" / "results" / "scheduler-experiments.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
