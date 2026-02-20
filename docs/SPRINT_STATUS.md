# Sprint Status

## Sprint 0: Foundation and one-command bootstrap

### Goal
One command brings up the full stack, initializes Keycloak, seeds data, and validates via smoke tests.

### Completed
- [x] Monorepo scaffolding: `apps/*` (10 services + 2 UIs), `packages/*` (shared-config, shared-db, shared-crypto, shared-http, shared-types)
- [x] TypeScript build order and npm workspaces
- [x] Docker Compose: Postgres, Keycloak, all services, UIs (nginx); health checks; internal network
- [x] Service stubs: GET /health, /v1/info, DB connectivity on /health when DATABASE_URL set, error envelope via shared-http
- [x] UI stubs: bill-processing-ui, audit-viewer-ui ("App booted" + auth placeholder), served via nginx
- [x] Scripts: setup.sh, init-keycloak.sh, generate-keys.sh, seed-directory.sh, seed-permissions.sh, seed-rulebook.sh, seed-domain-data.sh, smoke-tests.sh
- [x] Setup prints credentials and URLs at end

### How to validate
```bash
# One-command setup (build, up, init Keycloak, seed placeholders, smoke tests)
./scripts/setup.sh

# Or manually:
docker compose up -d
# Wait for healthy, then:
./scripts/init-keycloak.sh
./scripts/generate-keys.sh
./scripts/seed-directory.sh
./scripts/seed-permissions.sh
./scripts/seed-rulebook.sh
./scripts/seed-domain-data.sh
./scripts/smoke-tests.sh
```

**Key endpoints**
- Keycloak: http://127.0.0.1:8088
- Bill UI: http://127.0.0.1:3000
- Audit UI: http://127.0.0.1:3001
- Service health (from host, via proxy or exec): each service exposes GET /health and GET /v1/info on port 8080 inside the network

**Commands**
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Smoke tests: `./scripts/smoke-tests.sh` (run after `docker compose up -d`)

### Known gaps / tech debt
- Keycloak realm created via API; no realm JSON file import
- generate-keys.sh uses Node to create Ed25519 keys when available; otherwise placeholder JSON
- Smoke tests require Docker; no unit tests yet

---

## Sprint 1: Directory, keys, permissions

### Goal
A working participant directory and authorization model for "who can issue what" and "who can override what".

### Completed
- [x] Directory data model: Prisma schema (Participant, Endpoint, Key, Permission); migrations via `prisma db push` on startup
- [x] Directory API v1: GET /v1/participants/:id, GET /v1/participants?role=&proofType=, GET /v1/participants/:id/keys, GET /v1/permissions/:id, GET /v1/permissions/isAllowed
- [x] Admin bulk: POST /v1/admin/participants/bulk, POST /v1/admin/permissions/bulk (Keycloak-protected or X-Seed-Secret for bootstrap)
- [x] Key management: keyId standard; public keys in directory; seed scripts merge generate-keys output into participants bulk
- [x] Seed scripts call directory-service (token or DIRECTORY_SEED_SECRET); init-keycloak creates pfm-setup client
- [x] Smoke tests: directory returns keys/endpoints, isAllowed allows/denies correctly, admin without token returns 401

### How to validate
```bash
docker compose up -d
# Wait for healthy, then:
./scripts/init-keycloak.sh   # optional if using seed secret
./scripts/generate-keys.sh
./scripts/seed-directory.sh
./scripts/seed-permissions.sh
./scripts/smoke-tests.sh
```

**Key endpoints**
- Directory (exposed 8081 for setup): GET /v1/participants/did:web:works.demo.gov, GET /v1/permissions/isAllowed?participantId=...&action=issue_proof&proofType=WorkCompletionProof

### Known gaps / tech debt
- Admin auth: Keycloak JWT (finance_admin/system_service) or X-Seed-Secret for bootstrap; Keycloak token may require realm client setup

---

## Sprint 2: Proof issuance and verification

### Goal
Works and vendor proof issuers issue signed proofs; verifiers use directory public keys and shared-crypto to verify.

### Completed
- [x] shared-crypto: RFC 8785 canonical JSON, sha256Hex, Ed25519 sign/verify (one-shot crypto.sign/verify), getProofPayloadToSign, verifyProofSignature, publicKeyPemFromBase64
- [x] shared-types: ProofStatus, ProofSignature, ProofEnvelope
- [x] works-proof-issuer: POST /v1/proofs/issue, GET /v1/proofs/:proofId/status, GET /v1/proofs/:proofId, POST /v1/admin/proofs/:proofId/revoke; key from ISSUER_PRIVATE_KEY_PATH
- [x] vendor-proof-issuer: same API for VendorEligibilityProof
- [x] Docker: infra/keys mounted for both issuers; ISSUER_PRIVATE_KEY_PATH, ISSUER_ID, STATUS_BASE_URL set; ports 8082 (works), 8083 (vendor) for smoke tests
- [x] Smoke tests: issue work + vendor proof, GET status VALID, verify signature via directory public key (scripts/verify-proof-smoke.js)

### How to validate
```bash
./scripts/generate-keys.sh
./scripts/seed-directory.sh   # re-seed so directory has public keys
docker compose up -d           # ensure 8082/8083 exposed
./scripts/smoke-tests.sh
```

### Known gaps / tech debt
- Setup order: run generate-keys before seed-directory so directory gets public keys; re-run seed-directory after generate-keys if directory was seeded earlier
- Prisma binaryTargets set for linux-musl OpenSSL 3 (Alpine); directory-service Dockerfile adds `apk add openssl`

---

## Sprint 3: Rulebook and checks-engine (deterministic decisions)

### Goal
Versioned rulebooks and deterministic evaluation returning APPROVE, HOLD, or DENY with reason codes.

### Completed
- [x] Rulebook service: Prisma model (Rulebook); GET /v1/rulebooks/:id/versions, GET /v1/rulebooks/:id?version=, GET /v1/rulebooks/:id/reasonCodes?version=; POST /v1/admin/rulebooks (Keycloak or X-Seed-Secret)
- [x] Vendor payment rulebook v0.1: 10 checks/reason codes; overrideAllowed false for signature/issuer
- [x] seed-rulebook.sh: POSTs rulebook v0.1 to rulebook-service (port 8084)
- [x] Checks-engine: POST /v1/checks/evaluate; fetches rulebook, directory, issuers; verifies proofs via shared-crypto; returns decision, reasons[], proofChecks[]
- [x] Docker: rulebook 8084, checks-engine 8085; RULEBOOK_SEED_SECRET for rulebook admin

### How to validate
```bash
docker compose up -d
./scripts/generate-keys.sh
./scripts/seed-directory.sh
./scripts/seed-permissions.sh
./scripts/seed-rulebook.sh
./scripts/smoke-tests.sh
```

### Known gaps / tech debt
- If Postgres is recreated, re-run seed-directory and seed-rulebook

---

## Sprint 4: Budget lock (atomic reservation)

### Goal
Atomic budget reservation and commit with concurrency safety and idempotency.

### Completed
- [x] BudgetHead and Reservation models (Prisma); reserve/confirm/release with SELECT FOR UPDATE
- [x] POST /v1/budget/reserve (caseId, budgetHead, amount, ttlSeconds); idempotent by caseId
- [x] POST /v1/budget/confirm, POST /v1/budget/release; GET /v1/budget/:budgetHead (debug)
- [x] POST /v1/admin/budget/heads (budgetHead, total) for seeding
- [x] Expiry job every 60s to release expired RESERVED
- [x] Smoke tests: admin head, reserve, idempotent reserve, confirm, GET committed, release, over-allocate rejected

### How to validate
```bash
docker compose up -d   # ensure budget-lock has port 8086
./scripts/smoke-tests.sh
```

### Known gaps / tech debt
- Re-run `docker compose up -d` to expose 8086 if stack was started before Sprint 4

---

## Sprint 5: Audit service (tamper-evident record)

### Goal
Write decision records and status events with hash chaining per caseId.

### Completed
- [x] DecisionRecord and StatusEvent (Prisma); POST /v1/audit/decisionRecords, POST /v1/audit/statusEvents
- [x] Hash chaining: recordHash = SHA256(previousHash + "|" + caseId + "|" + RFC8785_canonical(payload)); shared-crypto canonicalSerialize + sha256Hex
- [x] GET /v1/audit/cases/:caseId (timeline: decisions + events in chronological order)
- [x] GET /v1/audit/cases/:caseId/validate (recompute hashes, integrity OK/FAIL)
- [x] Docker: audit-service port 8087, openssl in Dockerfile

### How to validate
```bash
docker compose up -d
./scripts/smoke-tests.sh
```

### Known gaps / tech debt
- None

---

## Sprint 6: Exceptions and redressal

### Goal
Appeals and overrides with Keycloak redressal role; override policy from rulebook; audit logging of overrides.

### Completed
- [x] Appeal and Override models (Prisma); POST /v1/exceptions/appeal; POST /v1/exceptions/override (auth: redressal_authority)
- [x] Override: last decision from audit, reason codes from rulebook; reject if any reasonCodesOverridden has overrideAllowed false (403 OVERRIDE_DISALLOWED)
- [x] POST override creates Override record and POSTs statusEvents (eventType override_applied) to audit
- [x] GET /v1/exceptions/cases/:caseId (appeals + overrides)
- [x] Docker: exceptions-service port 8089; AUDIT_BASE_URL, RULEBOOK_BASE_URL; depends_on audit-service, rulebook-service
- [x] Smoke tests: POST appeal 201, override without token 401, override disallowed code 403 (with Keycloak token), GET cases returns appeals

### How to validate
```bash
docker compose up -d
./scripts/init-keycloak.sh   # for redressal@demo.gov token
./scripts/smoke-tests.sh
```

### Known gaps / tech debt
- Smoke 403 test skipped if Keycloak token for redressal not available

---

## Sprint 7: IFMS dummy and connector

### Goal
Simulate IFMS voucher and payment; connector submits payment passports and manages budget confirm/release and audit events.

### Completed
- [x] IFMS dummy: Voucher model (Prisma); POST /v1/ifms/voucher (delay 2s), POST /v1/ifms/pay (delay 3s), GET /v1/ifms/status/:caseId; FAIL_RATE and forceFail for demo failures
- [x] IFMS connector: POST /v1/connector/submitPayment; validates passport (structure, reservation RESERVED, decision APPROVE, decisionHash matches audit); calls ifms-dummy voucher then pay; on success confirm reservation and POST voucher_created + payment_completed to audit; on failure release reservation and POST payment_failed
- [x] Budget-lock: GET /v1/budget/reservations/:reservationId for connector validation
- [x] Docker: ifms-dummy port 8090, ifms-connector port 8091; connector env IFMS_BASE_URL, BUDGET_BASE_URL, AUDIT_BASE_URL; depends_on ifms-dummy, budget-lock, audit-service
- [x] Smoke tests: IFMS dummy voucher/pay/status; connector invalid 400; connector happy path (reserve, decision, submitPayment, audit timeline)

### How to validate
```bash
docker compose up -d
./scripts/smoke-tests.sh
```

### Known gaps / tech debt
- IFMS dummy/connector smoke tests use 10–15s timeouts for delayed responses

---

## Sprint 8: Bill processing UI

### Goal
Minimal UI that drives the end-to-end bill flow with Keycloak login.

### Completed
- [x] Keycloak: bill-ui client (SPA, redirect URIs localhost:3000) in init-keycloak.sh
- [x] Bill UI: Keycloak login (keycloak-js, login-required); AuthProvider and useAuth
- [x] Create case form: workId, milestoneId, vendorId, amount, budgetHead, completionDate, bankValidated
- [x] Issue proofs: work completion and vendor eligibility via works/vendor proof issuers
- [x] Evaluate via checks-engine; show decision and reason codes
- [x] If APPROVE: reserve budget, post decision to audit, get decisionHash from timeline, submit payment via connector
- [x] If HOLD/DENY: show appeal button; show override button only when user has redressal_authority and reason has overrideAllowed
- [x] API base URLs from config (host + ports 8081–8091); env VITE_KEYCLOAK_URL, VITE_API_HOST for override

### How to validate
```bash
./scripts/init-keycloak.sh   # ensure bill-ui client exists
docker compose up -d
# Open http://localhost:3000 — redirect to Keycloak login (finance@demo.gov / demo123)
# Create case, issue proofs, evaluate, reserve & submit (APPROVE) or appeal/override (HOLD/DENY)
```

### Known gaps / tech debt
- No router; single-page stepper. Override only sends codes with overrideAllowed true
- Smoke tests only assert UI health (200); full flow is manual

---

## Sprint 9: Audit viewer UI

### Goal
Minimal UI that visualizes the case timeline and hash chain.

### Completed
- [x] Search by caseId; fetch timeline (GET /v1/audit/cases/:caseId) and validate (GET /v1/audit/cases/:caseId/validate)
- [x] Fetch appeals and overrides (GET /v1/exceptions/cases/:caseId)
- [x] Integrity indicator (OK/FAIL) from validate response
- [x] Timeline displayed chronologically (decisions + events); decision shows decision, reasons, rulebook; event shows eventType, source, eventTime, refs
- [x] Advanced toggle to show raw hashes (previousHash, decisionHash/recordHash or eventHash)
- [x] Filter by event type (All, Decisions only, or specific eventType)
- [x] Export timeline JSON (caseId, timeline, exportedAt)

### How to validate
```bash
docker compose up -d
# Open http://localhost:3001 — enter a case ID (e.g. smoke-conn-1, smoke-a1), click Search
# Check integrity, timeline, appeals/overrides; toggle Advanced; filter; Export JSON
```

### Known gaps / tech debt
- No Keycloak auth on audit viewer (view-only; optional for Sprint 10)
