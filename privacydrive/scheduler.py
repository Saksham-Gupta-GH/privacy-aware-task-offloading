"""Privacy-constrained latency and device-energy placement optimizer."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CALIBRATION = ROOT / "config" / "calibration-v2.json"


@dataclass(frozen=True)
class WorkerState:
    tier: str
    available: bool
    ready: bool
    queue_depth: int = 0
    detail: str = ""


@dataclass(frozen=True)
class CandidateDecision:
    tier: str
    privacy_allowed: bool
    available: bool
    deadline_feasible: bool
    predicted_latency_ms: float | None
    estimated_device_energy_j: float | None
    score: float | None
    selected: bool
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PlacementDecision:
    selected_tier: str | None
    candidates: tuple[CandidateDecision, ...]
    explanation: str
    calibration_version: str
    simulated_scenario: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "selected_tier": self.selected_tier,
            "candidates": [candidate.to_dict() for candidate in self.candidates],
            "explanation": self.explanation,
            "calibration_version": self.calibration_version,
            "simulated_scenario": self.simulated_scenario,
        }


class PlacementOptimizer:
    def __init__(self, calibration_path: str | Path = DEFAULT_CALIBRATION) -> None:
        self.calibration = json.loads(Path(calibration_path).read_text(encoding="utf-8"))

    def decide(
        self,
        *,
        allowed_destinations: list[str] | tuple[str, ...],
        worker_states: dict[str, WorkerState],
        input_bytes: int,
        passage_count: int,
        latency_weight: float,
        deadline_ms: float | None = None,
        scenario: str = "live",
    ) -> PlacementDecision:
        alpha = min(1.0, max(0.0, latency_weight))
        allowed = set(allowed_destinations)
        scenario_delays = self._scenario_delays(scenario)
        references = self.calibration["references"]
        calculated: dict[str, dict[str, float]] = {}

        for tier in ("local", "edge", "cloud"):
            state = worker_states[tier]
            if tier not in allowed or not state.available or not state.ready:
                continue
            params = self.calibration["tiers"][tier]
            processing_ms = params["base_ms"] + params["per_passage_ms"] * passage_count
            queue_ms = state.queue_depth * processing_ms + scenario_delays[tier]
            output_bytes = passage_count * 384 * 4
            if tier == "local":
                transfer_up_ms = transfer_down_ms = 0.0
                latency_ms = processing_ms + queue_ms
                energy_j = params["compute_power_w"] * processing_ms / 1000.0
            else:
                transfer_up_ms = input_bytes * 8.0 / (params["bandwidth_mbps"] * 1000.0)
                transfer_down_ms = output_bytes * 8.0 / (params["bandwidth_mbps"] * 1000.0)
                latency_ms = (
                    params["rtt_ms"]
                    + transfer_up_ms
                    + processing_ms
                    + queue_ms
                    + transfer_down_ms
                )
                energy_j = (
                    params["tx_power_w"] * transfer_up_ms / 1000.0
                    + params["idle_power_w"] * (processing_ms + queue_ms) / 1000.0
                    + params["rx_power_w"] * transfer_down_ms / 1000.0
                )
            score = (
                alpha * min(latency_ms / references["latency_ms"], 2.0)
                + (1.0 - alpha) * min(energy_j / references["device_energy_j"], 2.0)
            )
            calculated[tier] = {"latency": latency_ms, "energy": energy_j, "score": score}

        feasible = {
            tier: metrics
            for tier, metrics in calculated.items()
            if deadline_ms is None or metrics["latency"] <= deadline_ms
        }
        selected = min(feasible, key=lambda tier: feasible[tier]["score"]) if feasible else None
        candidates: list[CandidateDecision] = []
        for tier in ("local", "edge", "cloud"):
            state = worker_states[tier]
            privacy_allowed = tier in allowed
            available = state.available and state.ready
            metrics = calculated.get(tier)
            deadline_feasible = bool(
                metrics is not None
                and (deadline_ms is None or metrics["latency"] <= deadline_ms)
            )
            if not privacy_allowed:
                reason = "Blocked by privacy policy"
            elif not available:
                reason = state.detail or "Worker unavailable"
            elif not deadline_feasible:
                reason = "Predicted to miss deadline"
            elif tier == selected:
                reason = "Lowest permitted latency-energy score"
            else:
                reason = "Feasible, but higher combined score"
            candidates.append(
                CandidateDecision(
                    tier=tier,
                    privacy_allowed=privacy_allowed,
                    available=available,
                    deadline_feasible=deadline_feasible,
                    predicted_latency_ms=round(metrics["latency"], 2) if metrics else None,
                    estimated_device_energy_j=round(metrics["energy"], 4) if metrics else None,
                    score=round(metrics["score"], 6) if metrics else None,
                    selected=tier == selected,
                    reason=reason,
                )
            )

        if selected is None:
            explanation = "Task deferred: no privacy-permitted, available destination meets the deadline."
        else:
            blocked = [item.tier for item in candidates if not item.privacy_allowed]
            prefix = f"{selected.title()} selected because it has the lowest permitted combined score."
            explanation = prefix + (f" Privacy policy blocks {', '.join(blocked)}." if blocked else "")
        return PlacementDecision(
            selected_tier=selected,
            candidates=tuple(candidates),
            explanation=explanation,
            calibration_version=self.calibration["version"],
            simulated_scenario=scenario,
        )

    @staticmethod
    def _scenario_delays(scenario: str) -> dict[str, float]:
        scenarios = {
            "live": {"local": 0.0, "edge": 0.0, "cloud": 0.0},
            "client_busy": {"local": 15000.0, "edge": 0.0, "cloud": 0.0},
            "edge_busy": {"local": 0.0, "edge": 20000.0, "cloud": 0.0},
            "client_and_edge_busy": {"local": 15000.0, "edge": 20000.0, "cloud": 0.0},
        }
        return scenarios.get(scenario, scenarios["live"])

