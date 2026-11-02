import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

from privacydrive.public_gateway import app, auth

user = auth.store.register("Gateway Tester", "gateway-tester@example.com", "password123")
token = auth.store.create_session(user["id"])

client = TestClient(app, headers={"Authorization": f"Bearer {token}"})


class PublicGatewayTests(unittest.TestCase):
    @patch("privacydrive.public_gateway.httpx.AsyncClient")
    @patch("privacydrive.public_gateway.check_worker_health", new_callable=AsyncMock)
    def test_summary_budget_and_grouped_text_survive_proxy(self, mock_health, mock_client):
        mock_health.return_value = {"available": True, "ready": True}
        grouped = "## Results\n- Latency fell by 35%.\n\n## Conclusion\n- Keep caching enabled."
        response = Mock()
        response.json.return_value = {"summary": grouped, "word_budget": 140, "operation": "structured_minilm_mmr_summary"}
        remote = AsyncMock()
        remote.post.return_value = response
        mock_client.return_value.__aenter__.return_value = remote
        result = client.post("/api/browser/summarize", json={
            "document_id": "budget-test", "document_name": "public.txt",
            "content": "Public cloud workshop on Monday for university students.",
            "selected_tier": "cloud", "reported_sensitivity": "public", "word_budget": 140,
        })
        self.assertEqual(result.status_code, 200)
        self.assertEqual(remote.post.call_args.kwargs["json"]["word_budget"], 140)
        self.assertEqual(result.json()["summary"], grouped)

    def test_summary_budget_rejects_out_of_range_values(self):
        for budget in (0, 501):
            result = client.post("/api/browser/summarize", json={
                "document_id": "budget-invalid", "document_name": "public.txt",
                "content": "Public workshop.", "selected_tier": "cloud",
                "reported_sensitivity": "public", "word_budget": budget,
            })
            self.assertEqual(result.status_code, 422)

    def test_health_check(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["service"], "privacydrive-public-gateway")

    @patch("privacydrive.public_gateway.check_worker_health")
    def test_status_returns_all_tiers(self, mock_health):
        async def fake_health(tier, url):
            return {
                "tier": tier,
                "available": tier == "cloud",
                "ready": tier == "cloud",
                "queue_depth": 0,
                "detail": "ready" if tier == "cloud" else "offline",
            }
        mock_health.side_effect = fake_health
        response = client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("workers", data)
        self.assertTrue(data["workers"]["local"]["available"])
        self.assertTrue(data["workers"]["cloud"]["available"])
        self.assertFalse(data["workers"]["edge"]["available"])

    def test_browser_summarize_rejects_label_mismatch(self):
        response = client.post(
            "/api/browser/summarize",
            json={
                "document_id": "doc-1",
                "document_name": "test.txt",
                "content": "Public event about cloud computing festival.",
                "selected_tier": "cloud",
                "reported_sensitivity": "personal",  # mismatch!
                "sentence_count": 3,
            },
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("privacy labels differ", response.json()["detail"])

    def test_browser_summarize_blocks_restricted_data(self):
        restricted_content = "Credit card 4111 1111 1111 1111 expiry 12/28 cvv 123"
        response = client.post(
            "/api/browser/summarize",
            json={
                "document_id": "doc-2",
                "document_name": "card.txt",
                "content": restricted_content,
                "selected_tier": "cloud",
                "reported_sensitivity": "restricted",
                "sentence_count": 3,
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("Privacy policy blocks cloud for restricted data", response.json()["detail"])

    def test_browser_summarize_blocks_personal_data_on_cloud(self):
        personal_content = "Personal contact information: email aarya@example.com phone 555-123-4567"
        response = client.post(
            "/api/browser/summarize",
            json={
                "document_id": "doc-3",
                "document_name": "contact.txt",
                "content": personal_content,
                "selected_tier": "cloud",
                "reported_sensitivity": "personal",
                "sentence_count": 3,
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("Privacy policy blocks cloud for personal data", response.json()["detail"])

    @patch("privacydrive.public_gateway.check_worker_health")
    def test_browser_summarize_checks_worker_availability(self, mock_health):
        async def fake_health(tier, url):
            return {"tier": tier, "available": False, "ready": False, "queue_depth": 0, "detail": "offline"}
        mock_health.side_effect = fake_health
        response = client.post(
            "/api/browser/summarize",
            json={
                "document_id": "doc-4",
                "document_name": "public.txt",
                "content": "Public cloud workshop on Monday for university students.",
                "selected_tier": "cloud",
                "reported_sensitivity": "public",
                "sentence_count": 3,
            },
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("Cloud worker is unavailable", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()

