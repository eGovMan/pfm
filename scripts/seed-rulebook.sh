#!/usr/bin/env bash
# Seed rulebook v0.1 via rulebook-service admin API
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$SEED_DIR"

RULEBOOK_URL="${RULEBOOK_URL:-http://127.0.0.1:8084}"
SEED_SECRET="${RULEBOOK_SEED_SECRET:-${DIRECTORY_SEED_SECRET:-pfm-demo-seed-secret}}"

if [ ! -f "$SEED_DIR/rulebook-v0.1.json" ]; then
  echo "Missing $SEED_DIR/rulebook-v0.1.json"
  exit 1
fi

# Build payload: rulebookId, version, rulesJson, reasonCodesJson
PAYLOAD=$(node -e "
  const fs = require('fs');
  const j = JSON.parse(fs.readFileSync('$SEED_DIR/rulebook-v0.1.json', 'utf8'));
  console.log(JSON.stringify({
    rulebookId: j.rulebookId,
    version: j.version,
    rulesJson: j.rules || [],
    reasonCodesJson: j.reasonCodes || {},
    createdBy: 'seed'
  }));
")

HTTP=$(curl -s -w "%{http_code}" -o /tmp/seed-rulebook.out -X POST "$RULEBOOK_URL/v1/admin/rulebooks" \
  -H "X-Seed-Secret: $SEED_SECRET" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [ "$HTTP" = "201" ]; then
  echo "Rulebook v0.1 seeded (201)."
else
  echo "Rulebook seed returned $HTTP: $(cat /tmp/seed-rulebook.out 2>/dev/null)"
  exit 1
fi
