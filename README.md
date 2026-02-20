# PFM Stack Demo – DPI for Public Finance

A runnable concept demo for "DPI for Public Finance" (PFM Stack) focused on vendor payments for works: trusted proof exchange, rule evaluation, atomic budget commitment, IFMS interaction, audit trail, and redressal.

## Quick start

```bash
./scripts/setup.sh
```

This will build the stack, start Postgres and Keycloak, initialize Keycloak (realm, clients, users), generate Ed25519 keys, seed directory/permissions/rulebook/domain data, run smoke tests, and print URLs and credentials.

**URLs after setup**

- **Bill UI:** http://localhost:3000  
- **Audit UI:** http://localhost:3001  
- **Keycloak:** http://localhost:8088  

**Demo users (password: demo123)**  
finance@demo.gov, treasury@demo.gov, auditor@demo.gov, redressal@demo.gov  

**Keycloak admin:** admin / admin  

## Documentation

- **[SUMMARY.md](docs/SUMMARY.md)** – High-level overview and deliverables  
- **[SPRINT_PLAN.md](docs/SPRINT_PLAN.md)** – 10-sprint implementation plan  
- **[SPECIFICATIONS.md](docs/SPECIFICATIONS.md)** – Technical specifications  
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** – Directory layout  
- **[SPRINT_STATUS.md](docs/SPRINT_STATUS.md)** – What’s implemented per sprint  
- **[docs/api-specs.md](docs/api-specs.md)** – v1 API endpoints  
- **[docs/demo-script.md](docs/demo-script.md)** – 10–12 min demo walkthrough  
- **[docs/data-models.md](docs/data-models.md)** – Data models  
- **[docs/reason-codes.md](docs/reason-codes.md)** – Rulebook reason codes  

## Architecture

**Services:** directory (8081), rulebook (8084), works-proof (8082), vendor-proof (8083), checks-engine (8085), budget-lock (8086), audit (8087), exceptions (8089), ifms-dummy (8090), ifms-connector (8091).  

**UIs:** bill-processing-ui (3000), audit-viewer-ui (3001).  

**Infra:** Postgres, Keycloak (8088).  

## Troubleshooting

- **Smoke tests fail (directory 500, budget 000, etc.):** Run full setup so seeds and keys are applied: `./scripts/init-keycloak.sh`, `./scripts/generate-keys.sh`, `./scripts/seed-directory.sh`, `./scripts/seed-permissions.sh`, `./scripts/seed-rulebook.sh`, then `./scripts/smoke-tests.sh`.
- **Bill UI redirects to login forever:** Ensure Keycloak is ready and bill-ui client exists: `./scripts/init-keycloak.sh`. Use http://localhost:3000 (not 127.0.0.1) if that’s what’s configured in Keycloak redirect URIs.
- **Evaluate returns DENY with valid proofs:** Re-seed directory after generating keys so public keys are in directory; re-seed rulebook if needed.
- **Skip smoke tests on setup:** `SKIP_SMOKE_TESTS=1 ./scripts/setup.sh`

## License

[To be determined]
