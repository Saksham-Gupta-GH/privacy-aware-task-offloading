import json
from pathlib import Path
import unittest

from privacydrive.structured_summary import build_summary_units, select_structured_summary


class StructuredSummaryTests(unittest.TestCase):
    def test_shared_cases(self):
        cases = json.loads(Path(__file__).with_name("structured_summary_cases.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]):
                units = build_summary_units(case["content"])
                self.assertEqual([u["context"] for u in units], case["expectedContexts"])
                for vectors in (None, [[1, 0]] * len(units)):
                    result = select_structured_summary(units, vectors, 180)
                    for text in case["required"]:
                        self.assertIn(text, result)
                    for text in case["forbidden"]:
                        self.assertNotIn(text, result)
                    self.assertLessEqual(len(result.split()), 180)

    def test_tail_section_is_eligible(self):
        source = "BACKGROUND\n" + "\n".join(f"Routine update {i}." for i in range(65)) + "\nCONCLUSION\nCancel deployment because customer data is exposed."
        units = build_summary_units(source)
        self.assertEqual(len(units), 66)
        self.assertIn("Cancel deployment", select_structured_summary(units, [[1, 0]] * 66, 80))

    def test_bad_vectors_duplicates_and_budget(self):
        units = build_summary_units("Repeated observation. Repeated observation. A distinct result.")
        for vectors in (None, [[1, 0]], [[float("nan")], [1], [1]]):
            result = select_structured_summary(units, vectors, 20)
            self.assertEqual(result.count("Repeated observation"), 1)
            self.assertLessEqual(len(result.split()), 20)

    def test_empty_and_oversized_input(self):
        self.assertEqual(select_structured_summary([]), "")
        units = build_summary_units(" ".join(f"word{i}" for i in range(100)))
        result = select_structured_summary(units, word_budget=20)
        self.assertTrue(result.endswith("…"))
        self.assertEqual(len(result.split()), 20)
