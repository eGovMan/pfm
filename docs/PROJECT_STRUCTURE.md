# Project Structure

## Directory Layout

```
pfm/
├── docker-compose.yml          # Main Docker Compose configuration
├── Makefile                    # One-command setup: `make setup`
├── README.md                   # Project overview and quick start
│
├── scripts/                    # Bootstrap and utility scripts
│   ├── setup.sh               # Main entry point (one-command setup)
│   ├── init-keycloak.sh       # Keycloak realm/clients/users setup
│   ├── generate-keys.sh       # Ed25519 keypair generation
│   ├── seed-directory.sh      # Seed participant directory
│   ├── seed-permissions.sh    # Seed permissions
│   ├── seed-rulebook.sh       # Seed rulebook v0.1
│   ├── seed-domain-data.sh    # Seed vendors, works, budgets
│   └── smoke-tests.sh         # Automated end-to-end tests
│
├── infra/                      # Infrastructure configuration
│   ├── keycloak/              # Keycloak realm export (optional)
│   └── seed/                  # Seed data JSON files
│       ├── participants.json
│       ├── permissions.json
│       ├── rulebook-v0.1.json
│       ├── vendors.json
│       ├── works.json
│       └── budgets.json
│
├── services/                   # All microservices
│   ├── directory-service/
│   │   ├── Dockerfile
│   │   ├── package.json (or requirements.txt, go.mod)
│   │   ├── src/
│   │   │   ├── server.ts (or .py, .go)
│   │   │   ├── models.ts
│   │   │   ├── db.ts
│   │   │   └── routes.ts
│   │   └── migrations/ (or schema.sql)
│   │
│   ├── rulebook-service/
│   ├── works-proof-issuer/
│   ├── vendor-proof-issuer/
│   ├── checks-engine/
│   ├── budget-lock/
│   ├── audit-service/
│   ├── exceptions-service/
│   ├── ifms-dummy/
│   └── ifms-connector/
│
├── ui/                         # Frontend applications
│   ├── bill-processing-ui/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   └── services/
│   │   └── public/
│   │
│   └── audit-viewer-ui/
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│
├── shared/                     # Shared libraries/utilities
│   ├── proof-verification/    # Ed25519 signing/verification
│   │   ├── sign.ts
│   │   ├── verify.ts
│   │   └── canonical-json.ts
│   └── types/                  # Shared TypeScript types (if using TS)
│       ├── proof.ts
│       ├── decision.ts
│       └── passport.ts
│
├── tests/                      # Integration and E2E tests
│   ├── smoke-tests/
│   │   ├── test-participants.sh
│   │   ├── test-proofs.sh
│   │   ├── test-checks.sh
│   │   ├── test-budget.sh
│   │   ├── test-connector.sh
│   │   └── test-override.sh
│   └── integration/
│
└── docs/                       # Documentation
    ├── SPRINT_PLAN.md         # This file
    ├── SPECIFICATIONS.md      # Technical specifications
    ├── PROJECT_STRUCTURE.md   # This file
    ├── api-specs.md           # API documentation (to be created)
    └── demo-script.md         # Demo walkthrough (to be created)
```

## Service Structure Template

Each service follows this structure:

```
service-name/
├── Dockerfile
├── .dockerignore
├── package.json (or requirements.txt, go.mod, etc.)
├── .env.example              # Example environment variables
├── README.md                 # Service-specific docs
├── src/ (or app/, or cmd/)
│   ├── server.ts (main entry)
│   ├── config.ts
│   ├── db/
│   │   ├── connection.ts
│   │   └── schema.sql
│   ├── models/
│   ├── routes/
│   │   └── index.ts
│   ├── services/
│   └── utils/
└── tests/
```

## Key Files

### docker-compose.yml
- Defines all services (Postgres, Keycloak, 10 services, 2 UIs)
- Network configuration (internal vs exposed)
- Volume mounts for data persistence
- Health checks
- Environment variables

### scripts/setup.sh
Main bootstrap script that:
1. Starts Docker Compose (Postgres + Keycloak first)
2. Waits for services to be healthy
3. Calls init-keycloak.sh
4. Calls generate-keys.sh
5. Calls seed-*.sh scripts in order
6. Runs smoke-tests.sh
7. Prints URLs and credentials

### Makefile
Simple wrapper:
```makefile
.PHONY: setup
setup:
	./scripts/setup.sh

.PHONY: up
up:
	docker-compose up -d

.PHONY: down
down:
	docker-compose down

.PHONY: logs
logs:
	docker-compose logs -f

.PHONY: test
test:
	./scripts/smoke-tests.sh
```

## Environment Variables

Services will use environment variables for:
- Database connection (from docker-compose)
- Keycloak URL and credentials
- Service URLs (discovered via Docker Compose service names)
- Private keys (Ed25519)
- Service account credentials

## Port Mapping

- **Exposed to host**:
  - Keycloak: `8080`
  - Bill Processing UI: `3000`
  - Audit Viewer UI: `3001`

- **Internal only** (service-to-service):
  - All other services: `8080` (internal network)

## Data Persistence

- Postgres data: Docker volume `pfm_postgres_data`
- Keycloak data: Docker volume `pfm_keycloak_data`
- Service keys: Docker volume `pfm_keys` (or env vars)

## Network

- Single Docker network: `pfm-network`
- Services discover each other via service names (e.g., `http://directory-service:8080`)
