# Privacy policy v1

This policy defines how the prototype converts locally detected privacy signals into
execution constraints. It is a project policy, not a universal definition of privacy.

| Class | Example | Allowed execution |
|---|---|---|
| Public | Public notice or intentionally published contact information | Local, trusted edge, cloud |
| Personal | A private email address or phone number | Local, trusted edge |
| Restricted | Payment-card data, confidential marker, or health data tied to an identity | Local only |
| Uncertain | Ambiguous card-like digits, empty content, or unclear identifiers | Local only pending review |

## Decision rules

The classifier applies these rules in precedence order:

1. Explicit confidentiality markers are Restricted.
2. A Luhn-valid payment-card-like number with payment context is Restricted.
3. Health terms combined with a personal identifier are Restricted.
4. Ambiguous card-like content is Uncertain.
5. Private email addresses or phone numbers are Personal.
6. Contact information explicitly marked as public is treated as Public.
7. An order/reference identifier without payment context is not treated as a card.
8. Content with no blocking signal is Public.

The classifier reports masked evidence and never includes a complete detected identifier
in its output. Classification errors remain possible. The scheduler can guarantee only
compliance with the supplied label and policy; it cannot guarantee perfect privacy when
classification is wrong.

