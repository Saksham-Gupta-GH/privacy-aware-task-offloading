"""Command-line entry point for local PrivacyDrive classification."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .classifier import PrivacyClassifier


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify text files locally before offloading.")
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--json", action="store_true", help="Print structured JSON output.")
    args = parser.parse_args()

    classifier = PrivacyClassifier()
    outputs = []
    for path in args.files:
        result = classifier.classify(path.read_text(encoding="utf-8"))
        output = {"file": path.name, **result.to_dict()}
        outputs.append(output)

    if args.json:
        print(json.dumps(outputs, indent=2))
        return

    for output in outputs:
        print(f"{output['file']}: {output['display_name']}")
        print(f"  Allowed: {', '.join(output['allowed_destinations'])}")
        print(f"  Policy: {output['policy_version']}")
        for reason in output["reasons"]:
            print(f"  Reason: {reason}")


if __name__ == "__main__":
    main()

