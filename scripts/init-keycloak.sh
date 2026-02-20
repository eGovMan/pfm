#!/usr/bin/env bash
# Create realm pfm-demo, clients, roles, and demo users via Keycloak Admin API
set -e
KEYCLOAK_URL="${KEYCLOAK_URL:-http://127.0.0.1:8088}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Getting Keycloak admin token..."
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const j=JSON.parse(d); process.stdout.write(j.access_token||''); } catch(e){} });" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  if command -v jq >/dev/null 2>&1; then
    TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "username=$ADMIN_USER" -d "password=$ADMIN_PASS" -d "grant_type=password" -d "client_id=admin-cli" | jq -r '.access_token // empty')
  fi
fi
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to get token. Keycloak may still be starting. Continuing anyway."
  exit 0
fi

echo "Creating realm pfm-demo..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"realm": "pfm-demo", "enabled": true, "displayName": "PFM Demo"}' -w "%{http_code}" -o /dev/null | grep -q 201 || true

echo "Creating roles..."
for role in finance_admin dept_operator treasury_operator auditor redressal_authority system_service; do
  curl -s -X POST "$KEYCLOAK_URL/admin/realms/pfm-demo/roles" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$role\"}" -w "%{http_code}" -o /dev/null | grep -qE '201|409' || true
done

echo "Creating demo users (password: demo123)..."
for user in "finance@demo.gov:finance_admin,dept_operator" "treasury@demo.gov:treasury_operator" "auditor@demo.gov:auditor" "redressal@demo.gov:redressal_authority"; do
  UNAME="${user%%:*}"
  ROLES="${user##*:}"
  curl -s -X POST "$KEYCLOAK_URL/admin/realms/pfm-demo/users" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$UNAME\", \"email\": \"$UNAME\", \"enabled\": true, \"credentials\": [{\"type\": \"password\", \"value\": \"demo123\", \"temporary\": false}]}" -w "%{http_code}" -o /dev/null | grep -qE '201|409' || true
  for role in $(echo "$ROLES" | tr ',' ' '); do
    RID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/pfm-demo/roles?search=$role" -H "Authorization: Bearer $TOKEN" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const a=JSON.parse(d); process.stdout.write(a[0]&&a[0].id?a[0].id:''); } catch(e){} });" 2>/dev/null)
    UID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/pfm-demo/users?username=$UNAME" -H "Authorization: Bearer $TOKEN" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try { const a=JSON.parse(d); process.stdout.write(a[0]&&a[0].id?a[0].id:''); } catch(e){} });" 2>/dev/null)
    if [ -n "$RID" ] && [ -n "$UID" ]; then
      curl -s -X POST "$KEYCLOAK_URL/admin/realms/pfm-demo/users/$UID/role-mappings/realm" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "[{\"id\": \"$RID\", \"name\": \"$role\"}]" -o /dev/null || true
    fi
  done
done

echo "Creating pfm-setup client (direct access grants for seeding)..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/pfm-demo/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "pfm-setup", "enabled": true, "publicClient": true, "directAccessGrantsEnabled": true}' -w "%{http_code}" -o /dev/null | grep -qE '201|409' || true

echo "Keycloak init done."
