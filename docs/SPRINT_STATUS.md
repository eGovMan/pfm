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
- Seed scripts only write JSON to infra/seed/; no admin API calls until Sprint 1+
- Keycloak realm created via API; no realm JSON file import
- generate-keys.sh uses Node to create Ed25519 keys when available; otherwise placeholder JSON
- Smoke tests require Docker; no unit tests yet
