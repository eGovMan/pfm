# PFM Stack Demo – API Specs (v1)

All APIs are under `/v1`. Base URLs use host ports: directory 8081, works 8082, vendor 8083, rulebook 8084, checks 8085, budget 8086, audit 8087, exceptions 8089, ifms-dummy 8090, connector 8091.

Error responses: `{ "error": { "code": "STRING", "message": "STRING", "details": optional } }`.

---

## Directory (8081)

| Method | Path | Description |
|--------|------|-------------|
| GET | /v1/participants/:id | Get participant (keys, endpoints) |
| GET | /v1/participants?role=&proofType= | List participants |
| GET | /v1/participants/:id/keys | Get keys |
| GET | /v1/permissions/:id | Get permission |
| GET | /v1/permissions/isAllowed?participantId=&action=&proofType= | Check allowed (boolean) |
| POST | /v1/admin/participants/bulk | Bulk upsert participants (X-Seed-Secret or Bearer) |
| POST | /v1/admin/permissions/bulk | Bulk upsert permissions |

---

## Works Proof Issuer (8082)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/proofs/issue | Issue WorkCompletionProof. Body: `{ "workId", "milestoneId", "completionDate" }` → 201 + proof envelope |
| GET | /v1/proofs/:proofId/status | → `{ "status": "VALID" \| "REVOKED" }` |
| GET | /v1/proofs/:proofId | Get full proof |

---

## Vendor Proof Issuer (8083)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/proofs/issue | Issue VendorEligibilityProof. Body: `{ "canonicalVendorId", "bankValidated", "blacklisted" }` → 201 |
| GET | /v1/proofs/:proofId/status | Status |
| GET | /v1/proofs/:proofId | Get full proof |

---

## Rulebook (8084)

| Method | Path | Description |
|--------|------|-------------|
| GET | /v1/rulebooks/:id/versions | List versions |
| GET | /v1/rulebooks/:id?version= | Get rulebook by version |
| GET | /v1/rulebooks/:id/reasonCodes?version= | Get reason codes (code, message, severity, overrideAllowed) |
| POST | /v1/admin/rulebooks | Create/update rulebook (X-Seed-Secret or Bearer). Body: rulebookId, version, rulesJson, reasonCodesJson |

---

## Checks Engine (8085)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/checks/evaluate | Evaluate case. Body: `caseId, vendorId, workId, milestoneId, amount, budgetHead, proofRefs[], rulebookId, rulebookVersion`. Response: `decision` (APPROVE|HOLD|DENY), `reasons[]`, `proofChecks[]`, `evaluatedAt` |

---

## Budget Lock (8086)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/admin/budget/heads | Body: `{ "budgetHead", "total" }` → 201 |
| POST | /v1/budget/reserve | Body: `{ "caseId", "budgetHead", "amount", "ttlSeconds?" }` → reservationId (idempotent by caseId) |
| POST | /v1/budget/confirm | Body: `{ "reservationId" }` |
| POST | /v1/budget/release | Body: `{ "reservationId" }` |
| GET | /v1/budget/reservations/:reservationId | Get reservation status |
| GET | /v1/budget/:budgetHead | Debug: head + reservations list |

---

## Audit (8087)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/audit/decisionRecords | Body: caseId, rulebookId, rulebookVersion, evaluatedAt, decision, reasons[], proofRefs[], proofChecks[], reservationId? → 201 |
| POST | /v1/audit/statusEvents | Body: caseId, source, eventType, eventTime, refs? → 201 |
| GET | /v1/audit/cases/:caseId | Timeline (decisions + events chronological) |
| GET | /v1/audit/cases/:caseId/validate | → integrity OK/FAIL, results[] |

---

## Exceptions (8089)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/exceptions/appeal | Body: `{ "caseId", "reason", "raisedBy" }` → 201 |
| POST | /v1/exceptions/override | Bearer required (redressal_authority). Body: caseId, reasonCodesOverridden[], justification. 403 if any code has overrideAllowed false |
| GET | /v1/exceptions/cases/:caseId | → appeals[], overrides[] |

---

## IFMS Dummy (8090)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/ifms/voucher | Body: caseId, amount, budgetHead, vendorId, description?. Delay 2s; optional forceFail → 201 voucherNo, status |
| POST | /v1/ifms/pay | Body: voucherNo. Delay 3s → 200 paid |
| GET | /v1/ifms/status/:caseId | → status, voucherNo?, paidAt? |

---

## IFMS Connector (8091)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/connector/submitPayment | Body: PaymentPassport (caseId, amount, budgetHead, vendorId, workId, milestoneId, rulebookId, rulebookVersion, proofRefs[], reservationId, decision APPROVE, decisionHash, issuedAt). Validates reservation RESERVED + decisionHash from audit; calls IFMS voucher then pay; on success confirm + audit events; on failure release + payment_failed event |
