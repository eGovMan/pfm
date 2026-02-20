#!/usr/bin/env bash
# Seed rulebook placeholder (Sprint 3 will POST to rulebook-service)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$SEED_DIR"

if [ ! -f "$SEED_DIR/rulebook-v0.1.json" ]; then
  cat > "$SEED_DIR/rulebook-v0.1.json" << 'EOF'
{"rulebookId": "vendor-payment", "version": "v0.1", "rulesJson": [], "reasonCodesJson": {}}
EOF
fi
echo "Rulebook seed data ready at infra/seed/rulebook-v0.1.json"
