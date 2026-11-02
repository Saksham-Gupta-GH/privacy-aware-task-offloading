from __future__ import annotations

import json
import unittest
from pathlib import Path

from privacydrive.classifier import PrivacyClassifier


ROOT = Path(__file__).resolve().parents[1]


class PrivacyClassifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.classifier = PrivacyClassifier()
        cls.manifest = json.loads(
            (ROOT / "data" / "synthetic" / "manifest.json").read_text(encoding="utf-8")
        )
        cls.adversarial_cases = json.loads(
            (ROOT / "data" / "synthetic" / "privacy-adversarial-cases.json").read_text(
                encoding="utf-8"
            )
        )

    def test_labelled_synthetic_corpus(self) -> None:
        for case in self.manifest:
            with self.subTest(case=case["id"]):
                text = (
                    ROOT / "data" / "synthetic" / "documents" / case["file"]
                ).read_text(encoding="utf-8")
                result = self.classifier.classify(text)
                self.assertEqual(case["expected"], result.sensitivity)

    def test_adversarial_synthetic_corpus(self) -> None:
        for case in self.adversarial_cases:
            with self.subTest(case=case["id"]):
                result = self.classifier.classify(case["content"])
                self.assertEqual(case["expected"], result.sensitivity)

    def test_restricted_policy_is_local_only(self) -> None:
        result = self.classifier.classify("Confidential document. Do not distribute.")
        self.assertEqual(("local",), result.allowed_destinations)

    def test_uncertain_requires_manual_review(self) -> None:
        result = self.classifier.classify("")
        self.assertEqual("uncertain", result.sensitivity)
        self.assertTrue(result.manual_review_required)
        self.assertEqual(("local",), result.allowed_destinations)

    def test_card_evidence_is_masked(self) -> None:
        card = "4111 1111 1111 1111"
        result = self.classifier.classify(f"Credit card number: {card}")
        serialized = json.dumps(result.to_dict())
        self.assertNotIn(card, serialized)
        self.assertIn("ending in 1111", serialized)

    def test_policy_version_is_recorded(self) -> None:
        result = self.classifier.classify("Public workshop agenda")
        self.assertEqual("privacy-policy-v1", result.policy_version)


if __name__ == "__main__":
    unittest.main()

