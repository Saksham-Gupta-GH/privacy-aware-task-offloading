"""Exercise the real summary HTTP route with model inference replaced by a stub."""
import importlib.util
from pathlib import Path
from types import ModuleType
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient


class SummaryWorkerTests(unittest.TestCase):
    def setUp(self):
        # Isolate native model dependencies; parser, selector and API remain real.
        dependency = ModuleType("privacydrive.embedding_onnx")
        dependency.MODEL_ID = "test-model"
        dependency.MODEL_REVISION = "test-revision"
        dependency.OnnxEmbedder = Mock
        spec = importlib.util.spec_from_file_location("privacydrive._summary_worker_test", Path(__file__).parents[1] / "privacydrive" / "worker_api.py")
        self.worker = importlib.util.module_from_spec(spec)
        with patch.dict("sys.modules", {"privacydrive.embedding_onnx": dependency}):
            spec.loader.exec_module(self.worker)
        self.worker.runtime.load = lambda: None  # Suppress model download in lifespan.
        self.client = TestClient(self.worker.app)

    def request(self, content, budget=80):
        return self.client.post("/summarize", json={
            "task_id": "test", "document_id": "synthetic", "content": content,
            "word_budget": budget, "privacy_label": "public", "policy_version": "test",
        })

    def test_all_units_reach_model_and_grouped_output_survives(self):
        model = Mock()
        model.embed.side_effect = lambda texts: [[1, 0] for _ in texts]
        self.worker.runtime.embedder = model
        content = "BACKGROUND\n" + "\n".join(f"Routine fact {i}." for i in range(65)) + "\nCONCLUSION\nCancel the release because the test failed."
        response = self.request(content)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(model.embed.call_args.args[0]), 66)
        result = response.json()
        self.assertIn("## CONCLUSION\n- Cancel the release", result["summary"])
        self.assertEqual(result["candidate_units"], 66)
        self.assertEqual(result["word_budget"], 80)
        self.assertLessEqual(len(result["summary"].split()), 80)

    def test_no_model_uses_structured_fallback(self):
        response = self.request("PROJECTS\nAtlas\nBuilt a caching service.")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["operation"], "structured_fallback_summary")
        self.assertIn("- Atlas: Built a caching service.", response.json()["summary"])

    def test_budget_is_validated(self):
        self.assertEqual(self.request("Public news.", 501).status_code, 422)
