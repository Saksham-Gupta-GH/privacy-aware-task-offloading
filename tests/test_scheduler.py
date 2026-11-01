from __future__ import annotations

import unittest

from privacydrive.scheduler import PlacementOptimizer, WorkerState


def ready_workers() -> dict[str, WorkerState]:
    return {
        tier: WorkerState(tier=tier, available=True, ready=True)
        for tier in ("local", "edge", "cloud")
    }


class PlacementOptimizerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.optimizer = PlacementOptimizer()

    def test_restricted_document_never_leaves_local(self) -> None:
        decision = self.optimizer.decide(
            allowed_destinations=["local"],
            worker_states=ready_workers(),
            input_bytes=4096,
            passage_count=32,
            latency_weight=0.5,
        )
        self.assertEqual("local", decision.selected_tier)
        cloud = next(item for item in decision.candidates if item.tier == "cloud")
        self.assertFalse(cloud.privacy_allowed)
        self.assertEqual("Blocked by privacy policy", cloud.reason)

    def test_offline_worker_is_excluded(self) -> None:
        workers = ready_workers()
        workers["edge"] = WorkerState("edge", available=False, ready=False, detail="offline")
        decision = self.optimizer.decide(
            allowed_destinations=["edge"],
            worker_states=workers,
            input_bytes=100,
            passage_count=1,
            latency_weight=1.0,
        )
        self.assertIsNone(decision.selected_tier)

    def test_privacy_is_not_overridden_by_busy_scenario(self) -> None:
        decision = self.optimizer.decide(
            allowed_destinations=["local"],
            worker_states=ready_workers(),
            input_bytes=100,
            passage_count=1,
            latency_weight=1.0,
            scenario="client_and_edge_busy",
        )
        self.assertEqual("local", decision.selected_tier)


if __name__ == "__main__":
    unittest.main()
