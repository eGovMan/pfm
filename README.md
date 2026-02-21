# PFM Stack Demo – DPI for Public Finance

A runnable concept demo for "DPI for Public Finance" (PFM Stack) focused on vendor payments for works: trusted proof exchange, rule evaluation, atomic budget commitment, IFMS interaction, audit trail, and redressal.

## Quick start

**One-command setup (recommended):**

```bash
./scripts/setup.sh
```

This builds the stack, starts Postgres and Keycloak, initializes Keycloak (realm, clients, users), generates Ed25519 keys, seeds directory/permissions/rulebook/domain data, runs smoke tests, and prints URLs and credentials.

**If you already have the stack running** and only want to run smoke tests, ensure seeds have been applied first (otherwise directory, budget, and proof verification will fail):

```bash
./scripts/init-keycloak.sh
./scripts/generate-keys.sh
./scripts/seed-directory.sh
./scripts/seed-permissions.sh
./scripts/seed-rulebook.sh
./scripts/smoke-tests.sh
```

**URLs after setup**

- **Bill UI:** http://localhost:3000  
- **Audit UI:** http://localhost:3001  
- **Keycloak:** http://localhost:8088  

**Bill UI login (do not use Keycloak admin)**  
1. Open **http://localhost:3000** (Bill UI).  
2. You are redirected to Keycloak’s **application** login (pfm-demo realm).  
3. Log in with **finance@demo.gov** / **demo123** (not admin/admin).  
4. You are sent back to the Bill UI.

**Keycloak admin console** (optional): http://localhost:8088 → admin / admin. Use only for realm/config; the Bill UI uses the pfm-demo app login above.  

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

- **Keycloak "We are sorry... Unexpected error when handling authentication request":** Usually a Keycloak or DB glitch. Check the error: `docker compose logs keycloak --tail 80`. Restart Keycloak: `docker compose restart keycloak`, wait 60s, then try again. If it persists, re-run `./scripts/init-keycloak.sh` (with Keycloak up) to recreate realm and users. As a last resort, recreate the database and run full setup from scratch (this wipes all app and Keycloak data).
- **Keycloak not reachable / "This page isn't working" on the auth URL:** Restart Keycloak: `docker compose up -d keycloak`, wait 30–60s. Open **http://localhost:3000** (Bill UI); use **finance@demo.gov** / **demo123** (not admin/admin). Run `./scripts/init-keycloak.sh` if the realm or bill-ui client is missing.
- **Keycloak or login page frozen:** Try a private/incognito window or another browser. Restart Keycloak with more memory (compose already sets JAVA_OPTS_APPEND). Test the realm login directly: open http://localhost:8088/realms/pfm-demo/protocol/openid-connect/auth?client_id=bill-ui&redirect_uri=http://localhost:3000/&response_type=code&scope=openid — you should see the pfm-demo login form; if it loads, the Bill UI redirect should work from http://localhost:3000.
- **Auth URL fails (e.g. /realms/pfm-demo/protocol/openid-connect/auth returns 404 or error):** The realm and bill-ui client must exist and accept the redirect URI. Run `./scripts/init-keycloak.sh` to create the realm, clients, and users. If you already ran it, run it again—it will update the bill-ui client so `http://localhost:3000/` is an allowed redirect URI.
- **Smoke tests fail (directory 500, budget 000, proof verify, checks APPROVE):** Run full setup so seeds and keys are applied: `./scripts/setup.sh` or the same script sequence (init-keycloak, generate-keys, seed-directory, seed-permissions, seed-rulebook, then smoke-tests). Ensure ports 8081, 8086, etc. are exposed.
- **Bill UI redirects to login forever:** Ensure Keycloak is ready and bill-ui client exists: `./scripts/init-keycloak.sh`. Use http://localhost:3000 (not 127.0.0.1) if that’s what’s configured in Keycloak redirect URIs.
- **"Rulebook fetch failed: 500" in Bill UI:** Seed the rulebook: `./scripts/seed-rulebook.sh`. If seed returns **"table Rulebook does not exist"**, run: `docker compose exec rulebook-service npx prisma db push --accept-data-loss`, then seed again.
- **"The table Participant does not exist" (directory seed 500):** Create directory tables only: `docker compose exec -T postgres psql -U pfm -d pfm -f - < scripts/create-directory-tables.sql`, then run `./scripts/seed-directory.sh` again.
- **"The table DecisionRecord does not exist" (audit-service):** Create audit tables: `docker compose exec -T postgres psql -U pfm -d pfm -f - < scripts/create-audit-tables.sql`.
- **"The table Appeal does not exist" (exceptions-service):** Create only Appeal/Override tables (safe; does not drop other services’ tables): `docker compose exec -T postgres psql -U pfm -d pfm -f - < scripts/create-appeal-tables.sql`. Then try Appeal again in the Bill UI.
- **Evaluate returns DENY (INVALID_PROOF_SIGNATURE / UNAUTHORIZED_ISSUER):** (1) Regenerate keys and reseed so directory and issuers use the same keypair: `RESET_KEYS=1 ./scripts/generate-keys.sh`, then `./scripts/seed-directory.sh`, then **restart proof issuers** so they load the new keys: `docker compose restart works-proof-issuer vendor-proof-issuer`. (2) Run `./scripts/seed-permissions.sh` if you recreated directory tables. (3) Create new proofs (new case or re-issue) and run Evaluate again—existing proofs were signed with the old key.
- **"The table BudgetHead does not exist" (RESERVE_FAILED):** Create budget tables: `docker compose exec -T postgres psql -U pfm -d pfm -f - < scripts/create-budget-tables.sql`. Then run `./scripts/seed-budget-heads.sh`.
- **INSUFFICIENT_HEADROOM (amount exceeds available headroom):** Seed the budget head so it has a positive total: `./scripts/seed-budget-heads.sh` (sets head-001 total to 1,000,000). Then try Reserve again.
- **"The table Voucher does not exist" (ifms-dummy):** Create table: `docker compose exec -T postgres psql -U pfm -d pfm -f - < scripts/create-ifms-dummy-tables.sql`.
- **Budget admin head returns 000:** Curl couldn't reach the service; check `docker compose ps` and `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8086/health`.
- **Skip smoke tests on setup:** `SKIP_SMOKE_TESTS=1 ./scripts/setup.sh`

## License

[To be determined]
