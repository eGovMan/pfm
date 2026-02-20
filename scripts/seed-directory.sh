#!/usr/bin/env bash
# Seed participants, endpoints, public keys via directory-service admin bulk API
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$SEED_DIR"
DIRECTORY_URL="${DIRECTORY_URL:-http://127.0.0.1:8081}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://127.0.0.1:8088}"

if [ ! -f "$SEED_DIR/participants.json" ]; then
  cat > "$SEED_DIR/participants.json" << 'EOF'
[
  {"participantId": "did:web:works.demo.gov", "name": "Works Proof Issuer", "roles": ["proof_issuer"]},
  {"participantId": "did:web:vendor.demo.gov", "name": "Vendor Proof Issuer", "roles": ["proof_issuer"]}
]
EOF
fi

# Prefer Keycloak token; fallback to seed secret for bootstrap
TOKEN=""
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/pfm-demo/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=finance@demo.gov" -d "password=demo123" -d "grant_type=password" -d "client_id=pfm-setup" 2>/dev/null | \
  node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); process.stdout.write(j.access_token||''); } catch(e){} });" 2>/dev/null)
[ -z "$TOKEN" ] && command -v jq >/dev/null 2>&1 && TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/pfm-demo/protocol/openid-connect/token" \
  -d "username=finance@demo.gov" -d "password=demo123" -d "grant_type=password" -d "client_id=pfm-setup" -H "Content-Type: application/x-www-form-urlencoded" | jq -r '.access_token // empty')

SEED_SECRET="${DIRECTORY_SEED_SECRET:-pfm-demo-seed-secret}"
AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
else
  AUTH_HEADER="X-Seed-Secret: $SEED_SECRET"
  echo "Using X-Seed-Secret for directory bootstrap (Keycloak token not available)."
fi

# Build participants payload with endpoints and keys
PARTICIPANTS_JSON=$(node -e "
  const fs = require('fs');
  const participants = JSON.parse(fs.readFileSync('$SEED_DIR/participants.json', 'utf8'));
  let publicKeys = {};
  try { publicKeys = JSON.parse(fs.readFileSync('$SEED_DIR/public-keys.json', 'utf8')); } catch (e) {}
  const baseUrls = {
    'did:web:works.demo.gov': 'http://works-proof-issuer:8080',
    'did:web:vendor.demo.gov': 'http://vendor-proof-issuer:8080'
  };
  const out = participants.map(p => {
    const base = baseUrls[p.participantId] || 'http://localhost:8080';
    const pub = publicKeys[p.participantId];
    return {
      participantId: p.participantId,
      name: p.name,
      roles: p.roles || ['proof_issuer'],
      endpoints: {
        proofIssue: base + '/v1/proofs/issue',
        proofStatus: base + '/v1/proofs'
      },
      keys: pub && pub.publicKey ? [{ keyId: 'key-1', publicKey: pub.publicKey, alg: 'Ed25519' }] : []
    };
  });
  console.log(JSON.stringify(out));
" 2>/dev/null)

if [ -z "$PARTICIPANTS_JSON" ]; then
  echo "Failed to build participants payload."
  exit 1
fi

HTTP=$(curl -s -w "%{http_code}" -o /tmp/seed-directory.out -X POST "$DIRECTORY_URL/v1/admin/participants/bulk" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"participants\": $PARTICIPANTS_JSON}")
if [ "$HTTP" = "201" ]; then
  echo "Directory participants seeded (201)."
else
  echo "Directory seed returned $HTTP: $(cat /tmp/seed-directory.out 2>/dev/null)"
  exit 1
fi
