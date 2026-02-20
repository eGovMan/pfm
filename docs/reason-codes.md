# Reason Codes – Vendor Payment Rulebook v0.1

Rulebook: `vendor-payment`, version `v0.1`. Decision logic: any DENY → DENY; else any HOLD → HOLD; else APPROVE.

| Code | Severity | Override allowed | Description |
|------|----------|------------------|-------------|
| MISSING_WORK_COMPLETION_PROOF | DENY | No | Work completion proof required |
| MISSING_VENDOR_ELIGIBILITY_PROOF | DENY | No | Vendor eligibility proof required |
| INVALID_PROOF_SIGNATURE | DENY | No | Proof signature invalid |
| UNAUTHORIZED_PROOF_ISSUER | DENY | No | Proof issuer not authorized |
| PROOF_EXPIRED | DENY | Yes | Proof has expired |
| PROOF_REVOKED | DENY | Yes | Proof has been revoked |
| VENDOR_BLACKLISTED | DENY | Yes | Vendor is blacklisted |
| VENDOR_BANK_NOT_VALIDATED | HOLD | Yes | Vendor bank account not validated |
| MISSING_WORK_EVIDENCE | HOLD | Yes | Work evidence missing |
| INVALID_BUDGET_HEAD | DENY | Yes | Invalid budget head |
| INVALID_AMOUNT | DENY | Yes | Invalid amount |
| INSUFFICIENT_BUDGET_HEADROOM | DENY | Yes | Insufficient budget headroom |

Override: only codes with `overrideAllowed: true` can be overridden by a user with `redressal_authority`. Signature and issuer codes cannot be overridden.
