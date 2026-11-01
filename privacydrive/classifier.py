"""Explainable, local-only privacy classifier for synthetic text documents."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY_PATH = ROOT / "config" / "privacy-policy-v1.json"

EMAIL_RE = re.compile(r"(?<![\w.+-])([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})(?![\w.-])", re.I)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)")
LONG_DIGIT_RE = re.compile(r"(?<!\d)(?:\d[\s-]?){12,18}\d(?!\d)")

CONFIDENTIAL_TERMS = (
    "strictly confidential",
    "confidential document",
    "do not distribute",
    "restricted access",
)
PAYMENT_TERMS = (
    "credit card",
    "card number",
    "payment card",
    "debit card",
    "expiry",
    "cvv",
    "billing",
)
ORDER_TERMS = ("order number", "order id", "reference number", "tracking number", "invoice number")
HEALTH_TERMS = ("patient", "diagnosis", "medical record", "prescription", "treatment")
IDENTITY_TERMS = ("patient name", "date of birth", "dob", "email", "phone")
PUBLIC_CONTACT_TERMS = ("public contact", "published contact", "public directory", "public information")
PERSONAL_MARKERS = ("personal data", "private contact", "personal contact")


@dataclass(frozen=True)
class Signal:
    code: str
    severity: str
    reason: str
    masked_evidence: str


@dataclass(frozen=True)
class ClassificationResult:
    sensitivity: str
    display_name: str
    policy_version: str
    allowed_destinations: tuple[str, ...]
    manual_review_required: bool
    reasons: tuple[str, ...]
    signals: tuple[Signal, ...]

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["allowed_destinations"] = list(self.allowed_destinations)
        value["reasons"] = list(self.reasons)
        value["signals"] = [asdict(signal) for signal in self.signals]
        return value


def _contains_any(text: str, terms: Iterable[str]) -> bool:
    lowered = text.casefold()
    return any(term in lowered for term in terms)


def _near_public_marker(text: str, start: int, end: int, radius: int = 100) -> bool:
    window = text[max(0, start - radius) : min(len(text), end + radius)]
    return _contains_any(window, PUBLIC_CONTACT_TERMS)


def _luhn_valid(digits: str) -> bool:
    if not 13 <= len(digits) <= 19 or len(set(digits)) == 1:
        return False
    total = 0
    parity = len(digits) % 2
    for index, character in enumerate(digits):
        value = int(character)
        if index % 2 == parity:
            value *= 2
            if value > 9:
                value -= 9
        total += value
    return total % 10 == 0


def _masked_digits(digits: str) -> str:
    return f"{len(digits)} digits ending in {digits[-4:]}"


def _masked_email(match: re.Match[str]) -> str:
    local, domain = match.group(1), match.group(2)
    return f"{local[:1]}***@{domain}"


def _masked_phone(match: re.Match[str]) -> str:
    digits = re.sub(r"\D", "", match.group(0))
    return f"phone ending in {digits[-2:]}"


class PrivacyClassifier:
    def __init__(self, policy_path: Path | str = DEFAULT_POLICY_PATH) -> None:
        self.policy_path = Path(policy_path)
        self.policy = json.loads(self.policy_path.read_text(encoding="utf-8"))

    def classify(self, text: str) -> ClassificationResult:
        signals: list[Signal] = []
        stripped = text.strip()

        if not stripped:
            signals.append(
                Signal(
                    code="empty_or_unreadable",
                    severity="uncertain",
                    reason="No readable text was available for local inspection.",
                    masked_evidence="empty content",
                )
            )
            return self._result("uncertain", signals)

        lowered = stripped.casefold()

        for term in CONFIDENTIAL_TERMS:
            if term in lowered:
                signals.append(
                    Signal(
                        code="confidential_marker",
                        severity="restricted",
                        reason="An explicit confidentiality marker was detected.",
                        masked_evidence=term,
                    )
                )
                break

        has_payment_context = _contains_any(stripped, PAYMENT_TERMS)
        has_order_context = _contains_any(stripped, ORDER_TERMS)
        occupied_digit_ranges: list[tuple[int, int]] = []
        for match in LONG_DIGIT_RE.finditer(stripped):
            digits = re.sub(r"\D", "", match.group(0))
            occupied_digit_ranges.append(match.span())
            if has_order_context and not has_payment_context:
                signals.append(
                    Signal(
                        code="order_reference_excluded",
                        severity="informational",
                        reason="A long number was identified as an order/reference value, not payment data.",
                        masked_evidence=_masked_digits(digits),
                    )
                )
            elif _luhn_valid(digits) and has_payment_context:
                signals.append(
                    Signal(
                        code="payment_card",
                        severity="restricted",
                        reason="A Luhn-valid card-like number appeared with payment context.",
                        masked_evidence=_masked_digits(digits),
                    )
                )
            else:
                signals.append(
                    Signal(
                        code="ambiguous_long_number",
                        severity="uncertain",
                        reason="A long digit sequence could not be classified safely.",
                        masked_evidence=_masked_digits(digits),
                    )
                )

        email_matches = list(EMAIL_RE.finditer(stripped))
        private_identity_detected = False
        for match in email_matches:
            if _near_public_marker(stripped, *match.span()):
                signals.append(
                    Signal(
                        code="published_email_excluded",
                        severity="informational",
                        reason="The email address was explicitly marked as public contact information.",
                        masked_evidence=_masked_email(match),
                    )
                )
            else:
                private_identity_detected = True
                signals.append(
                    Signal(
                        code="email_address",
                        severity="personal",
                        reason="A private or unlabelled email address was detected.",
                        masked_evidence=_masked_email(match),
                    )
                )

        for match in PHONE_RE.finditer(stripped):
            if any(start <= match.start() and match.end() <= end for start, end in occupied_digit_ranges):
                continue
            if _near_public_marker(stripped, *match.span()):
                signals.append(
                    Signal(
                        code="published_phone_excluded",
                        severity="informational",
                        reason="The phone number was explicitly marked as public contact information.",
                        masked_evidence=_masked_phone(match),
                    )
                )
            else:
                private_identity_detected = True
                signals.append(
                    Signal(
                        code="phone_number",
                        severity="personal",
                        reason="A private or unlabelled phone number was detected.",
                        masked_evidence=_masked_phone(match),
                    )
                )

        if _contains_any(stripped, PERSONAL_MARKERS):
            private_identity_detected = True
            signals.append(
                Signal(
                    code="personal_marker",
                    severity="personal",
                    reason="The document explicitly identifies its contents as personal data.",
                    masked_evidence="personal-data marker",
                )
            )

        if _contains_any(stripped, HEALTH_TERMS) and (
            private_identity_detected or _contains_any(stripped, IDENTITY_TERMS)
        ):
            signals.append(
                Signal(
                    code="identified_health_data",
                    severity="restricted",
                    reason="Health information is linked to an identity signal.",
                    masked_evidence="health term + identity signal",
                )
            )

        severities = {signal.severity for signal in signals}
        for sensitivity in self.policy["precedence"]:
            if sensitivity in severities:
                return self._result(sensitivity, signals)
        return self._result("public", signals)

    def _result(self, sensitivity: str, signals: list[Signal]) -> ClassificationResult:
        class_policy = self.policy["classes"][sensitivity]
        blocking = [signal for signal in signals if signal.severity != "informational"]
        reasons = tuple(signal.reason for signal in blocking)
        if not reasons:
            reasons = (class_policy["description"],)
        return ClassificationResult(
            sensitivity=sensitivity,
            display_name=class_policy["display_name"],
            policy_version=self.policy["version"],
            allowed_destinations=tuple(class_policy["allowed_destinations"]),
            manual_review_required=sensitivity == "uncertain",
            reasons=reasons,
            signals=tuple(signals),
        )


def classify_text(text: str) -> ClassificationResult:
    return PrivacyClassifier().classify(text)

