#!/usr/bin/env bash
# Seed permissions via directory-service admin bulk API
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$SEED_DIR"
DIRECTORY_URL="${DIRECTORY_URL:-http://127.0.0.1:8081}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://127.0.0.1:8088}"

if [ ! -f "$SEED_DIR/permissions.json" ]; then
  cat > "$SEED_DIR/permissions.json" << 'EOF'
[
  {"participantId": "did:web:works.demo.gov", "action": "issue_proof", "proofType": "WorkCompletionProof", "effect": "ALLOW"},
  {"participantId": "did:web:vendor.demo.gov", "action": "issue_proof", "proofType": "VendorEligibilityProof", "effect": "ALLOW"}
]
EOF
fi

TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/pfm-demo/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=finance@demo.gov" -d "password=demo123" -d "grant_type=password" -d "client_id=pfm-setup" 2>/dev/null | \
  node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); process.stdout.write(j.access_token||''); } catch(e){} });" 2>/dev/null)
[ -z "$TOKEN" ] && command -v jq >/dev/null 2>&1 && TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/pfm-demo/protocol/openid-connect/token" \
  -d "username=finance@demo.gov" -d "password=demo123" -d "grant_type=password" -d "client_id=pfm-setup" -H "Content-Type: application/x-www-form-urlencoded" | jq -r '.access_token // empty')

SEED_SECRET="${DIRECTORY_SEED_SECRET:-pfm-demo-seed-secret}"
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
else
  AUTH_HEADER="X-Seed-Secret: $SEED_SECRET"
fi

PERMISSIONS=$(cat "$SEED_DIR/permissions.json")
HTTP=$(curl -s -w "%{http_code}" -o /tmp/seed-permissions.out -X POST "$DIRECTORY_URL/v1/admin/permissions/bulk" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"permissions\": $PERMISSIONS}")
if [ "$HTTP" = "201" ]; then
  echo "Permissions seeded (201)."
else
  echo "Permissions seed returned $HTTP: $(cat /tmp/seed-permissions.out 2>/dev/null)"
  exit 1
fi
