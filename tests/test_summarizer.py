"""Tests for the shared split_sentences segmentation utility.

summarize_extractively and summarize_semantically were removed in A006.
Their tests are removed here accordingly. The active summarization path
is covered by tests/test_structured_summary.py and test_summary_worker.py.
"""

import json
import unittest
from pathlib import Path

from privacydrive.summarizer import split_sentences


class SentenceSplittingTests(unittest.TestCase):
    def test_shared_structural_segmentation_cases(self):
        cases = json.loads(Path(__file__).with_name("segmentation_cases.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]):
                self.assertEqual(split_sentences(case["input"]), case["expected"])

    def test_long_unpunctuated_line_is_not_cut_arbitrarily(self):
        source = " ".join(f"word{index}" for index in range(80))
        self.assertEqual(split_sentences(source), [source])


if __name__ == "__main__":
    unittest.main()
