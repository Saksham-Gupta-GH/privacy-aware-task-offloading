"""Shared sentence segmentation utility for PrivacyDrive workers.

summarize_extractively and summarize_semantically were removed (A006).
The active summarization path is privacydrive.structured_summary.
split_sentences is kept as a shared segmentation utility used by that module.
"""

from __future__ import annotations

import re


SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")


def split_sentences(content: str) -> list[str]:
    """Preserve structural lines and protect common abbreviations (also in TS)."""
    abbreviation = re.compile(
        r"(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|e\.g|i\.e)|\b(?:[A-Za-z]\.)*[A-Za-z])\.$",
        re.I,
    )
    units: list[str] = []
    for line in content.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        normalized = " ".join(line.split())
        if not normalized:
            continue
        pending = ""
        for part in SENTENCE_BOUNDARY.split(normalized):
            pending += (" " if pending else "") + part
            if abbreviation.search(pending) or re.fullmatch(r"\d+\.", pending):
                continue
            units.append(pending)
            pending = ""
        if pending:
            units.append(pending)
    return units
