#!/usr/bin/env bash
# Seed participants, endpoints, public keys (Sprint 1 will POST to directory-service)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$SEED_DIR"

if [ ! -f "$SEED_DIR/participants.json" ]; then
  cat > "$SEED_DIR/participants.json" << 'EOF'
[
  {"participantId": "did:web:works.demo.gov", "name": "Works Proof Issuer", "roles": ["proof_issuer"], "status": "ACTIVE"},
  {"participantId": "did:web:vendor.demo.gov", "name": "Vendor Proof Issuer", "roles": ["proof_issuer"], "status": "ACTIVE"}
]
EOF
fi
echo "Directory seed data ready at infra/seed/participants.json"
