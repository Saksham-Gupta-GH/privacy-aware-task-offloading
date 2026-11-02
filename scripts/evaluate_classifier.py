#!/usr/bin/env python3
"""Evaluate the classifier against the labelled synthetic manifest."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from privacydrive.classifier import PrivacyClassifier  # noqa: E402


MANIFEST = ROOT / "data" / "synthetic" / "manifest.json"
DOCUMENTS = MANIFEST.parent / "documents"
ADVERSARIAL_CASES = MANIFEST.parent / "privacy-adversarial-cases.json"


def main() -> None:
    cases = json.loads(MANIFEST.read_text(encoding="utf-8"))
    cases.extend(json.loads(ADVERSARIAL_CASES.read_text(encoding="utf-8")))
    classifier = PrivacyClassifier()
    confusion: Counter[tuple[str, str]] = Counter()
    uncertain_count = 0
    correct = 0

    print(f"Policy: {classifier.policy['version']}")
    print("case                         expected     predicted    result")
    print("-" * 68)
    for case in cases:
        text = case.get("content")
        if text is None:
            text = (DOCUMENTS / case["file"]).read_text(encoding="utf-8")
        predicted = classifier.classify(text).sensitivity
        expected = case["expected"]
        confusion[(expected, predicted)] += 1
        uncertain_count += predicted == "uncertain"
        is_correct = predicted == expected
        correct += is_correct
        print(f"{case['id']:<28} {expected:<12} {predicted:<12} {'PASS' if is_correct else 'FAIL'}")

    total = len(cases)
    print()
    print(f"Accuracy: {correct}/{total} ({correct / total:.1%})")
    print(f"Uncertain rate: {uncertain_count}/{total} ({uncertain_count / total:.1%})")
    print("Confusion counts:")
    for (expected, predicted), count in sorted(confusion.items()):
        print(f"  expected={expected:<10} predicted={predicted:<10} count={count}")
    if correct != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

