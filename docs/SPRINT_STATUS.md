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
