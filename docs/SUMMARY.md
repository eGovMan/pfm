# PFM Stack Demo - Planning Summary

## Overview

This document summarizes the sprint plan and specifications for building a runnable concept demo for "DPI for Public Finance" (PFM Stack) focused on vendor payments for works.

## Deliverables

### Core Deliverables
1. **Docker Compose Infrastructure** - All services running with one command
2. **One-Command Bootstrap** - `make setup` or `./scripts/setup.sh` initializes everything
3. **10 Microservices** - All core services implemented
4. **2 UIs** - Bill processing and audit viewer
5. **Complete Documentation** - API specs, demo script, README

### Key Features Demonstrated
- ✅ Trust bootstrapping (participants, keys, permissions)
- ✅ Signed proof issuance and verification
- ✅ Deterministic rule evaluation
- ✅ Atomic budget commitment control
- ✅ IFMS integration (dummy + connector)
- ✅ Tamper-evident audit trail
- ✅ Redressal and override mechanisms

## Sprint Breakdown

### Sprint 0: Infrastructure & Bootstrap (Foundation)
**Goal**: Get all services running in Docker Compose with one-command setup
- Docker Compose with all services
- Service stubs with health checks
- UI stubs
- Complete bootstrap script

### Sprint 1: Trust Bootstrapping & Directory Services
**Goal**: Participant directory, permissions, and key management
- Directory service with all endpoints
- Ed25519 keypair generation and storage
- Permissions model and evaluation

### Sprint 2: Proof Issuance & Verification
**Goal**: Signed proof issuance and verification
- Works and Vendor proof issuers
- Ed25519 signing and verification
- Proof status endpoints

### Sprint 3: Rulebook & Checks Engine
**Goal**: Versioned rulebooks and deterministic rule evaluation
- Rulebook service with versioning
- Vendor payment rulebook v0.1 (8-12 checks)
- Checks engine with proof verification

### Sprint 4: Budget Lock (Atomic Commitment)
**Goal**: Atomic budget reservation with concurrency safety
- Budget lock service
- Concurrency-safe reservations
- Idempotent retries

### Sprint 5: Audit Trail
**Goal**: Tamper-evident audit records
- Audit service with hash chaining
- Decision records and status events
- Case timeline queries

### Sprint 6: Exceptions & Redressal
**Goal**: Appeals and authorized overrides
- Exceptions service
- Override authorization
- Audit integration

### Sprint 7: IFMS Integration
**Goal**: Dummy IFMS and connector
- IFMS dummy with voucher/payment
- IFMS connector with payment passport
- Budget confirmation/release

### Sprint 8: Bill Processing UI
**Goal**: Minimal but credible UI for bill processing
- Case creation and processing
- Proof fetching and evaluation
- IFMS submission
- Appeal/override actions

### Sprint 9: Audit Viewer UI
**Goal**: Minimal UI for viewing audit trails
- Case search
- Decision trace and status timeline
- Exceptions display
- Hash chain visualization

### Sprint 10: Integration, Testing & Documentation
**Goal**: End-to-end integration, smoke tests, and demo script
- Complete smoke tests
- End-to-end integration
- Full documentation
- Demo script

## Architecture

### Services (10)
1. **directory-service** - Participants, keys, permissions
2. **rulebook-service** - Versioned rulebooks
3. **works-proof-issuer** - WorkCompletionProof issuance
4. **vendor-proof-issuer** - VendorEligibilityProof issuance
5. **checks-engine** - Deterministic rule evaluation
6. **budget-lock** - Atomic budget reservations
7. **audit-service** - Tamper-evident audit trail
8. **exceptions-service** - Appeals and overrides
9. **ifms-dummy** - Mock IFMS (voucher + payment)
10. **ifms-connector** - Payment passport submission

### UIs (2)
1. **bill-processing-ui** - Bill creation and processing
2. **audit-viewer-ui** - Audit trail viewing

### Infrastructure
- **Postgres** - Single instance for all services
- **Keycloak** - Authentication and authorization

## Key Technical Decisions

### Trust Model
- **Participant IDs**: `did:web:` style (e.g., `did:web:works.demo.gov`)
- **Signing**: Ed25519 with canonical JSON
- **Key Storage**: Private keys in service env/secrets, public keys in directory

### Proof Model
- **Proof Types**: WorkCompletionProof, VendorEligibilityProof
- **Proof Format**: Signed JSON envelope with claims
- **Status**: Valid/Revoked/Expired (checked via endpoints)

### Rule Evaluation
- **Deterministic**: Same inputs + rulebook version = same outcome
- **Decision Types**: APPROVE, HOLD, DENY
- **Reason Codes**: 8-12 codes with severity classification

### Budget Control
- **Atomic**: Postgres transactions with locking
- **Idempotent**: Same caseId returns same reservation
- **Concurrency Safe**: Parallel reserves cannot exceed headroom

### Audit Trail
- **Hash Chaining**: SHA256 hash chain per caseId
- **Records**: Decision records + status events
- **Tamper-Evident**: Hash validation on read

## Data Models

### Core Entities
- **Participants** - Identity, keys, endpoints
- **Permissions** - Action-based authorization
- **Rulebooks** - Versioned rules with reason codes
- **Proofs** - Signed proof envelopes
- **Decisions** - Rule evaluation results
- **Reservations** - Budget reservations
- **Audit Records** - Decision records and status events
- **Exceptions** - Appeals and overrides

### Seed Data Required
- 6 participants with Ed25519 keys
- Permissions for all participants
- Vendor payment rulebook v0.1
- Vendors (with duplicates and mappings)
- Works milestones (valid + missing evidence)
- Budget heads (1,000,000 headroom for demo)

## Bootstrap Process

1. Start Docker Compose (Postgres + Keycloak first)
2. Wait for services to be healthy
3. Initialize Keycloak (realm, clients, roles, users)
4. Generate Ed25519 keypairs for all participants
5. Seed Participant Directory
6. Seed Permissions Directory
7. Seed Rulebook Registry
8. Seed domain data (vendors, works, budgets)
9. Run smoke tests
10. Print URLs and credentials

## Smoke Tests

Automated validation of:
- ✅ Participant lookup returns keys/endpoints
- ✅ Permission check blocks unauthorized issuer
- ✅ Proof issuance and verification
- ✅ Checks engine returns HOLD with correct reason
- ✅ Atomic budget lock prevents double commit
- ✅ Connector submits passport, IFMS processes
- ✅ Audit has decision + status timeline
- ✅ Override works only for authorized users

## Demo Script Outline

10-12 minute walkthrough:
1. **Happy Path** - Complete bill processing flow
2. **HOLD Scenario** - Missing evidence, fix, resubmit
3. **Parallel Reserve** - Demonstrate atomic lock
4. **Redressal Override** - Authorized override logged

## Adopted Defaults

All design choices are resolved. See the "Adopted Defaults (v0.1)" section in `docs/SPECIFICATIONS.md` for the full list. Technology: Node.js + TypeScript, React SPA, REST/JSON, Prisma/TypeORM, Keycloak, RFC 8785 for proof signing.

## Next Steps

1. **Start Sprint 0** - Infrastructure and bootstrap
2. **Iterate** - Follow sprint plan sequentially

## Success Criteria

- ✅ One command brings up entire demo
- ✅ All smoke tests pass
- ✅ Happy path works end-to-end
- ✅ Demo script can be followed in 10-12 minutes
- ✅ All core concepts demonstrated

## Documentation Structure

- `SPRINT_PLAN.md` - Detailed 10-sprint breakdown
- `SPECIFICATIONS.md` - Technical specifications for all services
- `PROJECT_STRUCTURE.md` - Directory layout and file organization
- `SUMMARY.md` - This document
- `api-specs.md` - API documentation (to be created in Sprint 10)
- `demo-script.md` - Demo walkthrough (to be created in Sprint 10)
