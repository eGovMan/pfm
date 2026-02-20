# PFM Stack Demo - DPI for Public Finance

A runnable concept demo for "DPI for Public Finance" (PFM Stack) focused on vendor payments for works, demonstrating trusted proof exchange, consistent rule application, atomic budget commitment control, IFMS interaction, audit trail, and redressal.

## Status

**Planning Phase** - Specifications and sprint plan complete. Ready for implementation after answering open questions.

## Documentation

- **[SUMMARY.md](docs/SUMMARY.md)** - High-level overview and deliverables
- **[SPRINT_PLAN.md](docs/SPRINT_PLAN.md)** - Detailed 10-sprint breakdown
- **[SPECIFICATIONS.md](docs/SPECIFICATIONS.md)** - Technical specifications for all services
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - Directory layout and organization

## Quick Start (After Implementation)

```bash
# One-command setup
make setup

# Or
./scripts/setup.sh
```

This will:
1. Start all services (Postgres, Keycloak, 10 microservices, 2 UIs)
2. Initialize Keycloak with demo users
3. Generate Ed25519 keypairs
4. Seed all data (participants, permissions, rulebook, vendors, works, budgets)
5. Run smoke tests
6. Print URLs and credentials

## Architecture

### Services
- **directory-service** - Participants, keys, permissions
- **rulebook-service** - Versioned rulebooks
- **works-proof-issuer** - WorkCompletionProof issuance
- **vendor-proof-issuer** - VendorEligibilityProof issuance
- **checks-engine** - Deterministic rule evaluation
- **budget-lock** - Atomic budget reservations
- **audit-service** - Tamper-evident audit trail
- **exceptions-service** - Appeals and overrides
- **ifms-dummy** - Mock IFMS (voucher + payment)
- **ifms-connector** - Payment passport submission

### UIs
- **bill-processing-ui** - Bill creation and processing (port 3000)
- **audit-viewer-ui** - Audit trail viewing (port 3001)

### Infrastructure
- **Postgres** - Single instance
- **Keycloak** - Authentication (port 8080)

## Core Concepts

- **Trust Bootstrapping** - Participants with Ed25519 keys, permissions
- **Proof Exchange** - Signed WorkCompletionProof and VendorEligibilityProof
- **Rule Application** - Deterministic evaluation with reason codes
- **Budget Control** - Atomic reservation with concurrency safety
- **IFMS Integration** - Payment passport submission
- **Audit Trail** - Hash-chained tamper-evident records
- **Redressal** - Appeals and authorized overrides

## Next Steps

1. Begin Sprint 0: Infrastructure & Bootstrap (all defaults in `docs/SPECIFICATIONS.md`)

## License

[To be determined]
