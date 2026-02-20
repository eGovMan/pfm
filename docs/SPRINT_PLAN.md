# PFM Stack Demo - Sprint Plan

## Overview
Build a runnable concept demo for "DPI for Public Finance" (PFM Stack) focused on vendor payments for works, demonstrating trusted proof exchange, rule application, atomic budget commitment, IFMS interaction, audit trail, and redressal.

**Adopted stack**: Node.js + TypeScript (all services), React SPA (UIs), REST/JSON, Postgres with Prisma or TypeORM, Keycloak. All design defaults are in `docs/SPECIFICATIONS.md` (Adopted Defaults).

## Sprint Structure

### Sprint 0: Infrastructure & Bootstrap (Foundation)
**Goal**: Get all services running in Docker Compose with one-command setup

#### Tasks
1. **Docker Compose Setup**
   - [ ] Create `docker-compose.yml` with all services
   - [ ] Configure Postgres (single instance)
   - [ ] Configure Keycloak with admin credentials
   - [ ] Define service hostnames and health checks
   - [ ] Configure network isolation (internal vs exposed ports)
   - [ ] Add service dependencies and startup order

2. **Service Stubs**
   - [ ] Create directory-service (minimal HTTP server)
   - [ ] Create rulebook-service (minimal HTTP server)
   - [ ] Create works-proof-issuer (minimal HTTP server)
   - [ ] Create vendor-proof-issuer (minimal HTTP server)
   - [ ] Create checks-engine (minimal HTTP server)
   - [ ] Create budget-lock (minimal HTTP server)
   - [ ] Create audit-service (minimal HTTP server)
   - [ ] Create exceptions-service (minimal HTTP server)
   - [ ] Create ifms-dummy (minimal HTTP server)
   - [ ] Create ifms-connector (minimal HTTP server)
   - [ ] Each service: health endpoint, basic error handling, Postgres connection

3. **UI Stubs**
   - [ ] Create bill-processing-ui (minimal React/HTML)
   - [ ] Create audit-viewer-ui (minimal React/HTML)
   - [ ] Configure nginx or simple static serving

4. **Bootstrap Script**
   - [ ] Create `scripts/setup.sh` entry point
   - [ ] Create `scripts/init-keycloak.sh` (realm, clients, roles, users)
   - [ ] Create `scripts/generate-keys.sh` (Ed25519 keypairs for all participants)
   - [ ] Create `scripts/seed-directory.sh` (participants, endpoints, public keys)
   - [ ] Create `scripts/seed-permissions.sh` (allowed actions)
   - [ ] Create `scripts/seed-rulebook.sh` (vendor-payment rulebook v0.1)
   - [ ] Create `scripts/seed-domain-data.sh` (vendors, works, budgets)
   - [ ] Create `scripts/smoke-tests.sh` (automated validation)
   - [ ] Integrate all scripts into one-command flow
   - [ ] Add credential printing at end

**Deliverables**:
- `docker-compose.yml` (all services up)
- `scripts/setup.sh` (one-command bootstrap)
- All services respond to health checks
- Keycloak initialized with demo users
- Seed data loaded

**Definition of Done**:
- `make setup` or `./scripts/setup.sh` brings up entire stack
- All services healthy
- Smoke tests pass (even if minimal)
- Credentials printed

---

### Sprint 1: Trust Bootstrapping & Directory Services
**Goal**: Implement participant directory, permissions, and key management

#### Tasks
1. **Directory Service**
   - [ ] Design Postgres schema (participants, keys, endpoints)
   - [ ] Implement GET /participants/{participantId}
   - [ ] Implement GET /participants?role=&proofType=
   - [ ] Implement GET /participants/{participantId}/keys
   - [ ] Implement GET /permissions/{participantId}
   - [ ] Implement GET /permissions/isAllowed?participantId=&action=&proofType=
   - [ ] Implement POST /admin/participants/bulk (bootstrap only)
   - [ ] Implement POST /admin/permissions/bulk (bootstrap only)
   - [ ] Add Keycloak integration for admin endpoints

2. **Key Management**
   - [ ] Implement Ed25519 keypair generation
   - [ ] Implement key storage (private keys in service env/secrets)
   - [ ] Implement public key storage in directory
   - [ ] Add keyId generation and lookup

3. **Permissions Model**
   - [ ] Design permissions schema (participant, action, proofType, conditions)
   - [ ] Implement permission evaluation logic
   - [ ] Add default permissions for demo participants

**Deliverables**:
- Directory service fully functional
- All participants registered with keys
- Permissions enforced
- Admin seeding endpoints working

**Definition of Done**:
- Can query participant by ID and get keys/endpoints
- Permission checks return correct allow/deny
- Unauthorized issuer blocked

---

### Sprint 2: Proof Issuance & Verification
**Goal**: Implement signed proof issuance and verification

#### Tasks
1. **Works Proof Issuer**
   - [ ] Design WorkCompletionProof schema
   - [ ] Implement POST /proofs/issue (returns signed proof)
   - [ ] Implement GET /proofs/{proofId}/status
   - [ ] Implement Ed25519 signing (canonical JSON)
   - [ ] Add proof storage (Postgres)
   - [ ] Implement revocation/expiry checks
   - [ ] Add admin seed endpoint for demo data

2. **Vendor Proof Issuer**
   - [ ] Design VendorEligibilityProof schema
   - [ ] Implement POST /proofs/issue (returns signed proof)
   - [ ] Implement GET /proofs/{proofId}/status
   - [ ] Implement Ed25519 signing (canonical JSON)
   - [ ] Add proof storage (Postgres)
   - [ ] Implement revocation/expiry checks
   - [ ] Add admin seed endpoint for demo data

3. **Proof Verification Library**
   - [ ] Implement canonical JSON serialization
   - [ ] Implement Ed25519 signature verification
   - [ ] Implement issuer lookup from directory
   - [ ] Implement status endpoint checking
   - [ ] Shared library for use by checks-engine

**Deliverables**:
- Both proof issuers functional
- Proofs are signed and verifiable
- Status endpoints work
- Demo proofs can be issued

**Definition of Done**:
- Can issue WorkCompletionProof and VendorEligibilityProof
- Proofs verify against issuer public keys
- Status checks work (valid/revoked/expired)

---

### Sprint 3: Rulebook & Checks Engine
**Goal**: Implement versioned rulebooks and deterministic rule evaluation

#### Tasks
1. **Rulebook Service**
   - [ ] Design rulebook schema (versioned, JSON rules, reason codes)
   - [ ] Implement GET /rulebooks/{rulebookId}/versions
   - [ ] Implement GET /rulebooks/{rulebookId}?version=
   - [ ] Implement GET /rulebooks/{rulebookId}/reasonCodes?version=
   - [ ] Implement POST /admin/rulebooks
   - [ ] Store rulebooks in Postgres (versioned)

2. **Vendor Payment Rulebook v0.1**
   - [ ] Define 8-12 checks with reason codes:
     - Missing proof (WorkCompletionProof, VendorEligibilityProof)
     - Invalid signature
     - Unauthorized issuer
     - Expired/revoked proof
     - Vendor blacklisted
     - Bank not validated
     - Missing evidence
     - Invalid budget head
     - Invalid amount
   - [ ] Classify reason codes as HOLD vs DENY
   - [ ] Define override policy (disallow for invalid signature, unauthorized issuer)
   - [ ] Create seed data JSON

3. **Checks Engine**
   - [ ] Design evaluation API (POST /checks/evaluate)
   - [ ] Implement deterministic rule evaluation
   - [ ] Implement proof verification integration
   - [ ] Implement issuer authorization checks
   - [ ] Implement status/expiry checks
   - [ ] Generate reason codes and required actions
   - [ ] Return APPROVE/HOLD/DENY with proofChecks
   - [ ] Ensure same inputs + version => same outcome

**Deliverables**:
- Rulebook service functional
- Vendor payment rulebook v0.1 seeded
- Checks engine returns deterministic decisions
- Reason codes properly classified

**Definition of Done**:
- Can query rulebook by version
- Checks engine evaluates cases correctly
- Returns HOLD with correct reason for broken cases
- Unauthorized issuer blocked even if signature valid

---

### Sprint 4: Budget Lock (Atomic Commitment)
**Goal**: Implement atomic budget reservation with concurrency safety

#### Tasks
1. **Budget Lock Service**
   - [ ] Design Postgres schema (reservations, budget heads, amounts)
   - [ ] Implement POST /budget/reserve (caseId, budgetHead, amount, ttlSeconds)
   - [ ] Implement POST /budget/confirm (reservationId)
   - [ ] Implement POST /budget/release (reservationId)
   - [ ] Implement GET /budget/{budgetHead} (debug view)
   - [ ] Implement idempotency (same caseId retries safe)
   - [ ] Implement concurrency safety (Postgres transactions/locks)
   - [ ] Prevent double commit beyond headroom

2. **Concurrency Testing**
   - [ ] Create test for parallel reserves
   - [ ] Verify only one succeeds if headroom insufficient
   - [ ] Verify both succeed if headroom sufficient
   - [ ] Test idempotency on retries

**Deliverables**:
- Budget lock service functional
- Atomic reservation working
- Concurrency safe
- Idempotent retries

**Definition of Done**:
- Parallel reserves cannot both succeed beyond headroom
- Retries with same caseId are idempotent
- Confirm/release work correctly

---

### Sprint 5: Audit Trail
**Goal**: Implement tamper-evident audit records

#### Tasks
1. **Audit Service**
   - [ ] Design Postgres schema (decision_records, status_events)
   - [ ] Implement hash chaining per caseId
   - [ ] Implement POST /audit/decisionRecords
   - [ ] Implement POST /audit/statusEvents
   - [ ] Implement GET /audit/cases/{caseId}
   - [ ] Implement recordHash calculation (previousHash + current data)
   - [ ] Add tamper-evidence validation

2. **Decision Record Model**
   - [ ] caseId, rulebookId, rulebookVersion, evaluatedAt
   - [ ] decision, reasons[], proofRefs[], proofChecks[]
   - [ ] reservationId, decisionHash, previousHash, recordHash

3. **Status Event Model**
   - [ ] caseId, source, eventType, eventTime
   - [ ] refs{voucherNo, paymentRef}
   - [ ] previousHash, eventHash

**Deliverables**:
- Audit service functional
- Decision records stored with hash chaining
- Status events stored with hash chaining
- Case timeline queryable

**Definition of Done**:
- Decision records written with hash chain
- Status events written with hash chain
- Can query full case timeline
- Hash chain validates tamper-evidence

---

### Sprint 6: Exceptions & Redressal
**Goal**: Implement appeals and authorized overrides

#### Tasks
1. **Exceptions Service**
   - [ ] Design Postgres schema (appeals, overrides)
   - [ ] Implement POST /exceptions/appeal
   - [ ] Implement POST /exceptions/override (with permission check)
   - [ ] Implement GET /exceptions/cases/{caseId}
   - [ ] Integrate with permissions service (check redressal_authority role)
   - [ ] Log overrides to audit service
   - [ ] Enforce override policy (disallow for invalid signature, unauthorized issuer)

2. **Override Authorization**
   - [ ] Check permissions for override action
   - [ ] Verify redressal_authority role
   - [ ] Write override event to audit

**Deliverables**:
- Exceptions service functional
- Appeals can be created
- Overrides work only for authorized users
- Overrides logged to audit

**Definition of Done**:
- Can create appeals
- Override only works for authorized redressal authority
- Overrides logged to audit
- Unauthorized override attempts blocked

---

### Sprint 7: IFMS Integration
**Goal**: Implement dummy IFMS and connector

#### Tasks
1. **Dummy IFMS**
   - [ ] Design Postgres schema (vouchers, payments)
   - [ ] Implement POST /ifms/voucher
   - [ ] Implement POST /ifms/pay
   - [ ] Implement GET /ifms/status/{caseId}
   - [ ] Add delay simulation
   - [ ] Add optional failure mode for testing

2. **IFMS Connector**
   - [ ] Design PaymentPassport schema
   - [ ] Implement POST /connector/submitPayment
   - [ ] Implement passport validation
   - [ ] Integrate with IFMS dummy (voucher + pay)
   - [ ] On success: confirm budget reservation
   - [ ] On failure: release budget reservation
   - [ ] Write status events to audit service

3. **Payment Passport**
   - [ ] caseId, amount, budgetHead, vendorId, workId, milestoneId
   - [ ] rulebookId, rulebookVersion, proofRefs
   - [ ] reservationId, decision="APPROVE", decisionHash, issuedAt

**Deliverables**:
- Dummy IFMS functional
- Connector submits passports
- Budget confirmed/released based on IFMS result
- Status events written to audit

**Definition of Done**:
- Connector accepts payment passport
- Calls IFMS voucher and pay
- Budget confirmed on success, released on failure
- Status events in audit timeline

---

### Sprint 8: Bill Processing UI
**Goal**: Build minimal but credible UI for bill processing

#### Tasks
1. **UI Framework Setup**
   - [ ] Choose framework (React/Vue/vanilla)
   - [ ] Set up build pipeline
   - [ ] Configure API client

2. **Bill Processing Features**
   - [ ] Create case form (workId, milestoneId, vendorId, amount, budgetHead)
   - [ ] Fetch proofs (WorkCompletionProof, VendorEligibilityProof)
   - [ ] Evaluate case (call checks engine)
   - [ ] Display decision (APPROVE/HOLD/DENY)
   - [ ] Display reason codes and required actions
   - [ ] Submit to IFMS (via connector)
   - [ ] Appeal action (if HOLD/DENY)
   - [ ] Override action (if authorized)
   - [ ] Show case status

**Deliverables**:
- Bill processing UI functional
- Can create and process cases
- Shows decisions and reasons
- Can submit to IFMS
- Can appeal/override

**Definition of Done**:
- UI allows full bill processing flow
- Displays decisions and reasons clearly
- Can submit to IFMS
- Appeal/override actions work

---

### Sprint 9: Audit Viewer UI
**Goal**: Build minimal UI for viewing audit trails

#### Tasks
1. **Audit Viewer Features**
   - [ ] Search by caseId
   - [ ] Display decision trace (decision record with reasons)
   - [ ] Display status events timeline
   - [ ] Display exceptions (appeals, overrides)
   - [ ] Show hash chain (for tamper-evidence demo)
   - [ ] Filter by event type
   - [ ] Export case timeline

**Deliverables**:
- Audit viewer UI functional
- Can search and view cases
- Shows complete timeline
- Displays hash chain

**Definition of Done**:
- Can search by caseId
- Shows decision + status timeline
- Shows exceptions
- Hash chain visible

---

### Sprint 10: Integration, Testing & Documentation
**Goal**: End-to-end integration, smoke tests, and demo script

#### Tasks
1. **Smoke Tests**
   - [ ] Participant lookup returns keys/endpoints
   - [ ] Permission check blocks unauthorized issuer
   - [ ] Works and vendor issuers can issue and verify signed proofs
   - [ ] Checks engine returns HOLD with correct reason for broken case
   - [ ] Atomic budget lock prevents double commit under parallel reserve
   - [ ] Connector submits passport, IFMS dummy posts voucher and pays
   - [ ] Audit has decision + status timeline
   - [ ] Override path works only for authorized redressal authority and is logged

2. **End-to-End Integration**
   - [ ] Test happy path end-to-end
   - [ ] Test HOLD scenario with fix
   - [ ] Test parallel reserve atomicity
   - [ ] Test redressal override flow
   - [ ] Fix any integration issues

3. **Documentation**
   - [ ] Create `docs/api-specs.md` (all service APIs)
   - [ ] Create `docs/demo-script.md` (10-12 minute walkthrough)
   - [ ] Create `README.md` (setup instructions)
   - [ ] Document data models
   - [ ] Document reason codes

4. **Final Polish**
   - [ ] Error handling improvements
   - [ ] Logging improvements
   - [ ] Performance checks
   - [ ] Security review (demo-level)

**Deliverables**:
- All smoke tests passing
- End-to-end flows working
- Complete documentation
- Demo script ready

**Definition of Done**:
- All smoke tests pass
- Happy path works end-to-end
- Demo script documented
- README complete

---

## Dependencies & Ordering

```
Sprint 0 (Infra) → All other sprints
Sprint 1 (Directory) → Sprint 2 (Proofs), Sprint 3 (Checks), Sprint 6 (Exceptions)
Sprint 2 (Proofs) → Sprint 3 (Checks)
Sprint 3 (Checks) → Sprint 4 (Budget), Sprint 5 (Audit), Sprint 7 (IFMS)
Sprint 4 (Budget) → Sprint 7 (IFMS)
Sprint 5 (Audit) → Sprint 6 (Exceptions), Sprint 7 (IFMS), Sprint 9 (Audit UI)
Sprint 6 (Exceptions) → Sprint 8 (Bill UI)
Sprint 7 (IFMS) → Sprint 8 (Bill UI)
Sprint 8 (Bill UI) → Sprint 10 (Integration)
Sprint 9 (Audit UI) → Sprint 10 (Integration)
```

## Risk Mitigation

1. **Concurrency in Budget Lock**: Use Postgres advisory locks or SELECT FOR UPDATE
2. **Hash Chain Complexity**: Start simple, add validation later if needed
3. **Keycloak Integration**: Use admin API, test early
4. **Proof Verification**: Use well-tested Ed25519 library
5. **UI Complexity**: Keep minimal, focus on functionality over polish

## Success Criteria

- One command (`make setup` or `./scripts/setup.sh`) brings up entire demo
- All smoke tests pass
- Happy path works end-to-end
- Demo script can be followed in 10-12 minutes
- All core concepts demonstrated (proofs, rules, budget, audit, redressal)
