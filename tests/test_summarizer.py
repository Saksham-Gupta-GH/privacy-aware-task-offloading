import unittest

import numpy as np

from privacydrive.summarizer import split_sentences, summarize_extractively, summarize_semantically


class ExtractiveSummarizerTests(unittest.TestCase):
    def test_short_text_is_not_invented(self):
        source = "First sentence. Second sentence."
        self.assertEqual(summarize_extractively(source, 3), source)

    def test_summary_uses_original_sentences(self):
        source = (
            "The cloud workshop begins Monday. Students may bring lunch. "
            "Cloud workshop registration closes Friday. "
            "The cloud workshop includes an Azure demonstration. Parking is available."
        )
        summary = summarize_extractively(source, 2)
        sentences = split_sentences(summary)
        self.assertEqual(len(sentences), 2)
        for sentence in sentences:
            self.assertIn(sentence, source)

    def test_semantic_summary_avoids_near_duplicate_sentences(self):
        source = (
            "Cloud systems reduce latency. Edge systems reduce latency. "
            "Privacy rules keep sensitive data local. Registration closes Friday."
        )
        vectors = np.asarray([[1, 0], [0.99, 0.01], [0, 1], [-1, 0]], dtype=np.float32)
        summary = summarize_semantically(source, vectors, 2)
        self.assertIn("Cloud systems reduce latency.", summary)
        self.assertIn("Privacy rules keep sensitive data local.", summary)
        self.assertNotIn("Edge systems reduce latency.", summary)


if __name__ == "__main__":
    unittest.main()
