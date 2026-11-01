import unittest

from privacydrive.summarizer import split_sentences, summarize_extractively


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


if __name__ == "__main__":
    unittest.main()
