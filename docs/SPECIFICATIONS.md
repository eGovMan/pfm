# PFM Stack Demo - Technical Specifications

## Adopted Defaults (v0.1)

The following are explicit defaults for implementation. No further clarifications needed.

### Architecture & Technology
- **Language**: Node.js + TypeScript for all backend services.
- **UI**: React SPA for bill-processing-ui and audit-viewer-ui.
- **Service comms**: REST over HTTP with JSON. No gRPC. Service discovery via Docker Compose service names only.

### Data & Schemas
- **Proof status**: Checks-engine calls issuer status endpoint directly. In-memory cache 30s; always re-check if proof is near expiry (within 5 minutes) or if decision is APPROVE.
- **Budget lock TTL**: Default 15 minutes. Expired reservations auto-release via background job in budget-lock (every 60s). Also release on explicit failure paths.
- **Hash chaining**: SHA-256. Formula: `SHA256(previousHash + "|" + caseId + "|" + RFC8785_canonical_json(record_without_hash_fields))`. Validate on read; audit UI shows "integrity OK/FAIL".
- **Vendor duplicates**: Allow both IFMS codes. Always display canonicalVendorId prominently. UI shows both mapped codes and canonical ID. Checks-engine treats any mapped ID as same canonical vendor once resolved via directory mapping.

### Rulebook & Logic
- **Evaluation order**: Evaluate all checks and return all failures. Do not stop on first DENY. Decision: if any DENY → DENY; else if any HOLD → HOLD; else APPROVE.
- **Reason codes**: Include both code and user-friendly English message. No i18n in v0.1.
- **Overrides**: Never replace original decision. Record OverrideRecord referencing original DecisionRecord. Mandatory justification text. Audit UI shows "Original decision" and "Override decision" clearly.

### IFMS Integration
- **Passport validation**: Connector validates structure; checks reservationId exists and is RESERVED; checks decision=APPROVE; verifies decisionHash against DecisionRecord from audit-service. Connector does not re-verify proofs in v0.1.
- **IFMS dummy**: Voucher delay 2s, payment delay 3s. Failure configurable per request (flag in payload) plus global env `FAIL_RATE` for random failures.

### UI & UX
- **Bill UI**: Auto-fetch proofs from vendorId and workId/milestoneId; "Refresh proofs" button. Show proof summary (issuer, issuedAt, validUntil, status) and expandable "details" (signatureOk, authorizedIssuer).
- **Audit UI**: No raw hashes by default. Show integrity indicator. "Advanced" toggle to reveal raw hashes. Timeline chronological.

### Bootstrap & Setup
- **Keycloak**: Realm JSON import for realm + clients + roles; Admin REST API for demo users and passwords.
- **Key generation**: Fresh Ed25519 on each setup. Store in Docker volume; reuse unless `RESET_KEYS=1`.
- **Seed data**: JSON files in `infra/seed/`. Setup loads via admin seeding endpoints. No SQL scripts.
- **Smoke tests**: Run automatically at end of setup. `SKIP_SMOKE_TESTS=1` to skip. Output to console and write `docs/smoke-test-report.md`.

### Error Handling & Logging
- **Error format**: `{ "error": { "code": "STRING", "message": "STRING", "details": any } }`. No stack traces in responses; stacks only in logs.
- **Logging**: INFO default, structured JSON. `LOG_LEVEL` override.

### Demo Script & Data
- **demo-script.md**: Short narrative plus step-by-step commands/clicks.
- **Demo scenarios**: Pre-seed 3–4 cases: happy path; HOLD bank not validated; HOLD missing work evidence; parallel reserve double-commit. Optional: override scenario. Allow creating new cases in UI.

### Infrastructure
- **Health**: `GET /health` → 200, `{ "status": "ok" }`. `GET /health/detailed` checks DB and Keycloak where relevant.
- **Ports**: All internal services 8080. UIs 3000, 3001. Keycloak 8088. Document in docker-compose comments.
- **DB migrations**: Prisma or TypeORM; run automatically on startup.
- **Config**: Environment variables in docker-compose.yml with .env support.
- **Proof canonicalization**: RFC 8785 for signing and hashing.

---

## Architecture Overview

### System Components

```
┌─────────────────┐     ┌─────────────────┐
│  Bill Processing│     │  Audit Viewer   │
│       UI        │     │       UI         │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
    ┌────────────────┴────────────────┐
    │         Keycloak (Auth)          │
    └────────────────┬────────────────┘
                     │
    ┌────────────────┴────────────────┐
    │                                 │
┌───┴────────┐              ┌─────────┴────┐
│ Directory │              │  Rulebook    │
│  Service  │              │   Service    │
└───┬───────┘              └──────┬───────┘
    │                             │
┌───┴────────┐              ┌─────┴────────┐
│  Works     │              │   Vendor    │
│  Proof     │              │   Proof     │
│  Issuer    │              │   Issuer    │
└───┬────────┘              └─────┬───────┘
    │                             │
    └──────────┬──────────────────┘
               │
         ┌─────┴─────┐
         │  Checks   │
         │  Engine   │
         └─────┬─────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───┴──────┐      ┌───────┴──────┐
│  Budget  │      │    Audit     │
│   Lock   │      │   Service    │
└───┬──────┘      └───────┬──────┘
    │                     │
┌───┴──────────┐  ┌───────┴──────┐
│  Exceptions  │  │   IFMS       │
│   Service    │  │  Connector   │
└───┬──────────┘  └───────┬───────┘
    │                     │
    └──────────┬──────────┘
               │
         ┌─────┴─────┐
         │  IFMS     │
         │  Dummy    │
         └───────────┘
```

## Service Specifications

### 1. Directory Service

**Purpose**: Manage participants, their public keys, endpoints, and permissions

**Endpoints**:
- `GET /participants/{participantId}` - Get participant details
- `GET /participants?role={role}&proofType={proofType}` - List participants by role/proof type
- `GET /participants/{participantId}/keys` - Get public keys for participant
- `GET /permissions/{participantId}` - Get all permissions for participant
- `GET /permissions/isAllowed?participantId={id}&action={action}&proofType={type}` - Check permission
- `POST /admin/participants/bulk` - Bulk seed participants (bootstrap only)
- `POST /admin/permissions/bulk` - Bulk seed permissions (bootstrap only)

**Data Models**:
```json
{
  "participantId": "did:web:works.demo.gov",
  "role": "proof_issuer",
  "endpoints": {
    "proofIssue": "http://works-proof-issuer:8080/proofs/issue",
    "proofStatus": "http://works-proof-issuer:8080/proofs/{proofId}/status"
  },
  "keys": [
    {
      "keyId": "key-1",
      "publicKey": "base64-encoded-ed25519-public-key",
      "algorithm": "Ed25519"
    }
  ]
}
```

**Permissions Model**:
```json
{
  "participantId": "did:web:works.demo.gov",
  "action": "issue_proof",
  "proofType": "WorkCompletionProof",
  "conditions": {}
}
```

**Technology**: Node.js + TypeScript, Postgres

---

### 2. Rulebook Service

**Purpose**: Store and serve versioned rulebooks with reason codes

**Endpoints**:
- `GET /rulebooks/{rulebookId}/versions` - List all versions
- `GET /rulebooks/{rulebookId}?version={v}` - Get specific version
- `GET /rulebooks/{rulebookId}/reasonCodes?version={v}` - Get reason codes for version
- `POST /admin/rulebooks` - Publish new rulebook version

**Data Models**:
```json
{
  "rulebookId": "vendor-payment",
  "version": "v0.1",
  "publishedAt": "2024-01-01T00:00:00Z",
  "rules": [
    {
      "checkId": "check-1",
      "name": "WorkCompletionProofRequired",
      "type": "proof_check",
      "proofType": "WorkCompletionProof",
      "required": true,
      "reasonCode": "MISSING_WORK_COMPLETION_PROOF",
      "severity": "DENY"
    }
  ],
  "reasonCodes": {
    "MISSING_WORK_COMPLETION_PROOF": {
      "code": "MISSING_WORK_COMPLETION_PROOF",
      "message": "Work completion proof is required",
      "severity": "DENY",
      "overrideAllowed": false
    }
  }
}
```
All reason codes include both `code` and user-friendly English `message`. No i18n in v0.1.

**Technology**: Node.js + TypeScript, Postgres

---

### 3. Works Proof Issuer

**Purpose**: Issue and verify WorkCompletionProof (mock SoR)

**Endpoints**:
- `POST /proofs/issue` - Issue new proof
- `GET /proofs/{proofId}/status` - Get proof status (valid/revoked/expired)

**Request**:
```json
{
  "workId": "work-123",
  "milestoneId": "milestone-1",
  "completionDate": "2024-01-15",
  "evidenceRef": "evidence-url-or-hash"
}
```

**Response (Proof)**:
```json
{
  "proofId": "proof-abc123",
  "proofType": "WorkCompletionProof",
  "issuerId": "did:web:works.demo.gov",
  "issuedAt": "2024-01-15T10:00:00Z",
  "validFrom": "2024-01-15T10:00:00Z",
  "validUntil": "2025-01-15T10:00:00Z",
  "statusEndpoint": "http://works-proof-issuer:8080/proofs/proof-abc123/status",
  "claims": {
    "workId": "work-123",
    "milestoneId": "milestone-1",
    "completionDate": "2024-01-15",
    "evidenceRef": "evidence-url-or-hash"
  },
  "signature": {
    "alg": "Ed25519",
    "keyId": "key-1",
    "value": "base64-encoded-signature"
  }
}
```

**Technology**: Node.js + TypeScript, Postgres, Ed25519 signing

---

### 4. Vendor Proof Issuer

**Purpose**: Issue and verify VendorEligibilityProof (mock SoR)

**Endpoints**:
- `POST /proofs/issue` - Issue new proof
- `GET /proofs/{proofId}/status` - Get proof status

**Request**:
```json
{
  "canonicalVendorId": "vendor-xyz",
  "mappedIds": {
    "ifmsVendorCode": "IFMS-001",
    "eprocVendorId": "EPROC-001"
  },
  "bankValidated": true,
  "blacklisted": false
}
```

**Response**: Similar structure to WorkCompletionProof with VendorEligibilityProof type

**Technology**: Node.js + TypeScript, Postgres, Ed25519 signing

---

### 5. Checks Engine

**Purpose**: Deterministic rule evaluation with proof verification

**Endpoints**:
- `POST /checks/evaluate` - Evaluate case against rulebook

**Request**:
```json
{
  "caseId": "case-123",
  "rulebookId": "vendor-payment",
  "rulebookVersion": "v0.1",
  "paymentDetails": {
    "amount": 50000,
    "budgetHead": "head-001",
    "vendorId": "vendor-xyz",
    "workId": "work-123",
    "milestoneId": "milestone-1"
  },
  "proofs": [
    {
      "proofId": "proof-abc123",
      "proofType": "WorkCompletionProof",
      "issuerId": "did:web:works.demo.gov",
      "proof": { /* full proof object */ }
    }
  ]
}
```

**Response**:
```json
{
  "caseId": "case-123",
  "decision": "APPROVE",
  "reasons": [],
  "requiredActions": [],
  "proofChecks": [
    {
      "proofType": "WorkCompletionProof",
      "proofId": "proof-abc123",
      "status": "valid",
      "checks": {
        "signature": "valid",
        "issuer": "authorized",
        "expiry": "not_expired",
        "revocation": "not_revoked"
      }
    }
  ],
  "evaluatedAt": "2024-01-15T10:05:00Z"
}
```

**Decision Types**: `APPROVE`, `HOLD`, `DENY`

**Technology**: Node.js + TypeScript, integrates with Directory, Rulebook, Proof Issuers. Proof status: call issuer directly; cache 30s; re-check if near expiry (5 min) or decision is APPROVE.

---

### 6. Budget Lock Service

**Purpose**: Atomic budget reservation with concurrency safety

**Endpoints**:
- `POST /budget/reserve` - Reserve budget
- `POST /budget/confirm` - Confirm reservation
- `POST /budget/release` - Release reservation
- `GET /budget/{budgetHead}` - Get budget status (debug)

**Reserve Request**:
```json
{
  "caseId": "case-123",
  "budgetHead": "head-001",
  "amount": 50000,
  "ttlSeconds": 3600
}
```

**Reserve Response**:
```json
{
  "reservationId": "reserve-abc123",
  "caseId": "case-123",
  "budgetHead": "head-001",
  "amount": 50000,
  "reservedAt": "2024-01-15T10:00:00Z",
  "expiresAt": "2024-01-15T11:00:00Z",
  "status": "reserved"
}
```

**Concurrency**: Use Postgres transactions with SELECT FOR UPDATE or advisory locks

**Idempotency**: Same caseId returns same reservationId if exists.

**TTL**: Default 15 minutes. Expired reservations auto-release via background job every 60 seconds; also release on explicit failure paths.

**Technology**: Node.js + TypeScript, Postgres with transactions

---

### 7. Audit Service

**Purpose**: Tamper-evident audit trail with hash chaining

**Endpoints**:
- `POST /audit/decisionRecords` - Record decision
- `POST /audit/statusEvents` - Record status event
- `GET /audit/cases/{caseId}` - Get full case timeline

**Decision Record**:
```json
{
  "caseId": "case-123",
  "rulebookId": "vendor-payment",
  "rulebookVersion": "v0.1",
  "evaluatedAt": "2024-01-15T10:05:00Z",
  "decision": "APPROVE",
  "reasons": [],
  "proofRefs": [
    {
      "proofType": "WorkCompletionProof",
      "proofId": "proof-abc123",
      "issuerId": "did:web:works.demo.gov"
    }
  ],
  "proofChecks": [ /* proof check results */ ],
  "reservationId": "reserve-abc123",
  "decisionHash": "sha256-hash-of-decision-data",
  "previousHash": "sha256-hash-of-previous-record",
  "recordHash": "sha256-hash-of-full-record"
}
```

**Status Event**:
```json
{
  "caseId": "case-123",
  "source": "ifms-connector",
  "eventType": "voucher_created",
  "eventTime": "2024-01-15T10:10:00Z",
  "refs": {
    "voucherNo": "VOUCHER-001"
  },
  "previousHash": "sha256-hash-of-previous-event",
  "eventHash": "sha256-hash-of-this-event"
}
```

**OverrideRecord** (stored by exceptions-service; audit UI shows "Original decision" and "Override decision"): references original DecisionRecord; includes newDecision, justification (mandatory), authorizedBy, overrideTime. Original decision is never replaced.

**Hash Chaining**: `recordHash = SHA256(previousHash + "|" + caseId + "|" + RFC8785_canonical_json(record_without_hash_fields))`. Validate on read; audit UI shows integrity OK/FAIL.

**Technology**: Node.js + TypeScript, Postgres

---

### 8. Exceptions Service

**Purpose**: Handle appeals and authorized overrides

**Endpoints**:
- `POST /exceptions/appeal` - Create appeal
- `POST /exceptions/override` - Override decision (authorized only)
- `GET /exceptions/cases/{caseId}` - Get exceptions for case

**Appeal Request**:
```json
{
  "caseId": "case-123",
  "reason": "Evidence was uploaded but not processed",
  "requestedBy": "user-id"
}
```

**Override Request**:
```json
{
  "caseId": "case-123",
  "newDecision": "APPROVE",
  "reason": "Executive override - evidence verified manually",
  "authorizedBy": "user-id"
}
```

**Authorization**: Check permissions service for `redressal_authority` role.

**Override Policy**: Disallow override for invalid signature and unauthorized issuer. Never replace original decision: record OverrideRecord referencing original DecisionRecord. Mandatory justification text. Audit UI shows "Original decision" and "Override decision" clearly.

**Technology**: Node.js + TypeScript, Postgres, integrates with Permissions and Audit

---

### 9. IFMS Dummy

**Purpose**: Simulate IFMS voucher and payment operations

**Endpoints**:
- `POST /ifms/voucher` - Create voucher
- `POST /ifms/pay` - Process payment
- `GET /ifms/status/{caseId}` - Get payment status

**Voucher Request**:
```json
{
  "caseId": "case-123",
  "amount": 50000,
  "budgetHead": "head-001",
  "vendorId": "vendor-xyz",
  "description": "Payment for work completion"
}
```

**Voucher Response**:
```json
{
  "voucherNo": "VOUCHER-001",
  "caseId": "case-123",
  "status": "created",
  "createdAt": "2024-01-15T10:10:00Z"
}
```

**Pay Request**:
```json
{
  "voucherNo": "VOUCHER-001"
}
```

**Simulation**: Voucher delay 2s, payment delay 3s. Failure: flag in request payload per request; global env `FAIL_RATE` for random failures.

**Technology**: Node.js + TypeScript, Postgres

---

### 10. IFMS Connector

**Purpose**: Accept payment passport and submit to IFMS

**Endpoints**:
- `POST /connector/submitPayment` - Submit payment passport

**Payment Passport**:
```json
{
  "caseId": "case-123",
  "amount": 50000,
  "budgetHead": "head-001",
  "vendorId": "vendor-xyz",
  "workId": "work-123",
  "milestoneId": "milestone-1",
  "rulebookId": "vendor-payment",
  "rulebookVersion": "v0.1",
  "proofRefs": [
    {
      "proofType": "WorkCompletionProof",
      "proofId": "proof-abc123"
    }
  ],
  "reservationId": "reserve-abc123",
  "decision": "APPROVE",
  "decisionHash": "sha256-hash",
  "issuedAt": "2024-01-15T10:05:00Z"
}
```

**Flow**:
1. Validate passport (structure; reservationId exists and RESERVED; decision=APPROVE; decisionHash matches DecisionRecord from audit-service; no proof re-verify in v0.1)
2. Call IFMS dummy: POST /ifms/voucher, then POST /ifms/pay
3. On success: POST /budget/confirm
4. On failure: POST /budget/release
5. Write status events to audit

**Technology**: Node.js + TypeScript, integrates with IFMS Dummy, Budget Lock, Audit

---

## Data Models

### Proof Envelope (Signed JSON)

```json
{
  "proofId": "string (UUID)",
  "proofType": "WorkCompletionProof | VendorEligibilityProof",
  "issuerId": "did:web:...",
  "issuedAt": "ISO8601",
  "validFrom": "ISO8601",
  "validUntil": "ISO8601",
  "statusEndpoint": "URL",
  "claims": { /* proof-specific claims */ },
  "signature": {
    "alg": "Ed25519",
    "keyId": "string",
    "value": "base64-encoded-signature"
  }
}
```

### WorkCompletionProof Claims

```json
{
  "workId": "string",
  "milestoneId": "string",
  "completionDate": "YYYY-MM-DD",
  "evidenceRef": "URL or hash"
}
```

### VendorEligibilityProof Claims

```json
{
  "canonicalVendorId": "string",
  "mappedIds": {
    "ifmsVendorCode": "string",
    "eprocVendorId": "string"
  },
  "bankValidated": boolean,
  "blacklisted": boolean
}
```

### Payment Passport

```json
{
  "caseId": "string",
  "amount": number,
  "budgetHead": "string",
  "vendorId": "string",
  "workId": "string",
  "milestoneId": "string",
  "rulebookId": "string",
  "rulebookVersion": "string",
  "proofRefs": [
    {
      "proofType": "string",
      "proofId": "string"
    }
  ],
  "reservationId": "string",
  "decision": "APPROVE",
  "decisionHash": "string (SHA256)",
  "issuedAt": "ISO8601"
}
```

---

## Rulebook v0.1 Specification

**Rulebook ID**: `vendor-payment`  
**Version**: `v0.1`

### Checks (8-12 total)

1. **WorkCompletionProof Required**
   - Reason Code: `MISSING_WORK_COMPLETION_PROOF`
   - Severity: `DENY`
   - Override: Not allowed

2. **VendorEligibilityProof Required**
   - Reason Code: `MISSING_VENDOR_ELIGIBILITY_PROOF`
   - Severity: `DENY`
   - Override: Not allowed

3. **Proof Signature Valid**
   - Reason Code: `INVALID_PROOF_SIGNATURE`
   - Severity: `DENY`
   - Override: Not allowed

4. **Proof Issuer Authorized**
   - Reason Code: `UNAUTHORIZED_PROOF_ISSUER`
   - Severity: `DENY`
   - Override: Not allowed

5. **Proof Not Expired**
   - Reason Code: `PROOF_EXPIRED`
   - Severity: `DENY`
   - Override: Allowed

6. **Proof Not Revoked**
   - Reason Code: `PROOF_REVOKED`
   - Severity: `DENY`
   - Override: Allowed

7. **Vendor Not Blacklisted**
   - Reason Code: `VENDOR_BLACKLISTED`
   - Severity: `DENY`
   - Override: Allowed

8. **Vendor Bank Validated**
   - Reason Code: `VENDOR_BANK_NOT_VALIDATED`
   - Severity: `HOLD`
   - Override: Allowed

9. **Work Evidence Present**
   - Reason Code: `MISSING_WORK_EVIDENCE`
   - Severity: `HOLD`
   - Override: Allowed

10. **Valid Budget Head**
    - Reason Code: `INVALID_BUDGET_HEAD`
    - Severity: `DENY`
    - Override: Allowed

11. **Valid Amount**
    - Reason Code: `INVALID_AMOUNT`
    - Severity: `DENY`
    - Override: Allowed

12. **Budget Headroom Available**
    - Reason Code: `INSUFFICIENT_BUDGET_HEADROOM`
    - Severity: `DENY`
    - Override: Allowed

### Decision Logic

- Evaluate all checks; return all failures (do not stop on first DENY).
- If any `DENY` reason: Decision = `DENY`
- Else if any `HOLD` reason: Decision = `HOLD`
- Else: Decision = `APPROVE`

### Reason Codes

Include both `code` and user-friendly English `message` in responses. No i18n in v0.1.

---

## Keycloak Configuration

**Realm**: `pfm-demo`

**Roles**:
- `finance_admin` - Full admin access
- `dept_operator` - Department bill processing
- `treasury_operator` - Treasury/IFMS operations
- `auditor` - Audit viewer access
- `redressal_authority` - Can override decisions
- `system_service` - Service-to-service auth

**Clients**:
- `bill-ui` - Bill processing UI
- `audit-ui` - Audit viewer UI
- `works-issuer` - Works proof issuer service
- `vendor-issuer` - Vendor proof issuer service
- `connector` - IFMS connector service
- `shared-services` - Directory, rulebook, checks, budget, audit, exceptions

**Demo Users**:
- `finance@demo.gov` (finance_admin, dept_operator)
- `treasury@demo.gov` (treasury_operator)
- `auditor@demo.gov` (auditor)
- `redressal@demo.gov` (redressal_authority)

---

## Seed Data Requirements

### Participants
- `did:web:works.demo.gov` (Works proof issuer)
- `did:web:vendor.demo.gov` (Vendor proof issuer)
- `did:web:finance.demo.gov` (Finance department)
- `did:web:redressal.demo.gov` (Redressal authority)
- `did:web:treasury.demo.gov` (Treasury/IFMS)
- `did:web:pfm.shared.demo.gov` (Shared services)

### Vendors
- Include duplicates: Two IFMS codes mapping to same canonical vendor. Allow both codes; display canonicalVendorId prominently; UI shows both mapped codes and canonical ID. Checks-engine resolves via directory mapping.

### Works
- At least one valid completion (with evidence)
- At least one missing evidence (to trigger HOLD)

### Budgets
- One budget head with 1,000,000 headroom
- Used to demo double-commit prevention

---

## Technology Stack (Adopted)

- **Backend**: Node.js + TypeScript for all services
- **Database**: Postgres (single instance); Prisma or TypeORM migrations, run on startup
- **Auth**: Keycloak (realm JSON import + Admin API for users)
- **Signing**: Ed25519 with RFC 8785 canonical JSON (e.g. `@noble/ed25519` + canonicalize)
- **UI**: React SPA (bill-processing-ui, audit-viewer-ui)
- **Containerization**: Docker Compose; config via env vars + .env
- **Scripting**: Bash for setup; keys in Docker volume, fresh unless RESET_KEYS=1

---

## Health Checks & Ports

- **Health**: Every service exposes:
  - `GET /health` → 200, `{ "status": "ok" }`
  - `GET /health/detailed` → checks DB connectivity and Keycloak reachability where relevant
- **Ports**: All internal services listen on **8080** inside containers. Expose to host: bill-processing-ui **3000**, audit-viewer-ui **3001**, Keycloak **8088**. Document in docker-compose.yml comments.

---

## Security Considerations (Demo Level)

- Private keys stored in service environment variables or mounted secrets
- Public keys only in directory
- Keycloak for authentication
- Service-to-service: API keys or service accounts
- Hash chaining for tamper-evidence (basic)
- No production-grade security (this is a demo)

---

## Performance Considerations (Demo Level)

- Single Postgres instance (fine for demo)
- No caching required
- No load balancing
- Synchronous HTTP calls between services
- Basic error handling
