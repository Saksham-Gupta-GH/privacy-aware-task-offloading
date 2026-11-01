#!/usr/bin/env python3
"""Exercise the running PrivacyDrive API through its real public endpoints."""

from __future__ import annotations

import httpx


BASE = "http://127.0.0.1:8000"


def main() -> None:
    with httpx.Client(base_url=BASE, timeout=60.0) as client:
        status = client.get("/api/status").raise_for_status().json()
        documents = client.get("/api/documents").raise_for_status().json()
        restricted = next(item for item in documents if item["sensitivity"] == "restricted")
        processed = client.post(
            f"/api/documents/{restricted['id']}/process",
            json={"latency_weight": 0.65, "scenario": "live", "workload_profile": "actual"},
        ).raise_for_status().json()
        assert processed["decision"]["selected_tier"] == "local"
        assert processed["receipt"]["tier"] == "local"
        search = client.post("/api/search", json={"query": "payment information"}).raise_for_status().json()
        assert search["query_processed_at"] == "local"
        experiments = client.get("/api/experiments").raise_for_status().json()
        proposed = next(item for item in experiments["results"] if item["method"] == "privacy_aware")
        assert proposed["policy_violations"] == 0
        frontend = client.get("/").raise_for_status()
        assert "PrivacyDrive" in frontend.text
        print(f"workers={status['workers']}")
        print(f"documents={len(documents)}")
        print(f"restricted_selected={processed['decision']['selected_tier']}")
        print(f"receipt_worker={processed['receipt']['worker_id']}")
        print(f"search_results={len(search['results'])}")
        print(f"proposed_policy_violations={proposed['policy_violations']}")
        print("frontend=served")


if __name__ == "__main__":
    main()
