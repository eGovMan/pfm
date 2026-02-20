#!/usr/bin/env bash
# Seed permissions (Sprint 1 will POST to directory-service)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$SEED_DIR"

if [ ! -f "$SEED_DIR/permissions.json" ]; then
  cat > "$SEED_DIR/permissions.json" << 'EOF'
[
  {"participantId": "did:web:works.demo.gov", "action": "issue_proof", "proofType": "WorkCompletionProof", "effect": "ALLOW"},
  {"participantId": "did:web:vendor.demo.gov", "action": "issue_proof", "proofType": "VendorEligibilityProof", "effect": "ALLOW"}
]
EOF
fi
echo "Permissions seed data ready at infra/seed/permissions.json"
