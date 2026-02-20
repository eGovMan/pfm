#!/usr/bin/env bash
# PFM Stack Demo – one-command bootstrap
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

export SKIP_SMOKE_TESTS="${SKIP_SMOKE_TESTS:-0}"

echo "==> Building and starting stack..."
docker compose build --no-cache 2>/dev/null || docker-compose build --no-cache 2>/dev/null || true
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null

echo "==> Waiting for Postgres and Keycloak..."
sleep 5
for i in {1..60}; do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/health/ready 2>/dev/null | grep -q 200; then
    echo "Keycloak is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then echo "Timeout waiting for Keycloak"; exit 1; fi
  sleep 3
done

echo "==> Initializing Keycloak..."
"$SCRIPT_DIR/init-keycloak.sh"

echo "==> Generating keys..."
"$SCRIPT_DIR/generate-keys.sh"

echo "==> Seeding directory (placeholder)..."
"$SCRIPT_DIR/seed-directory.sh" || true
echo "==> Seeding permissions (placeholder)..."
"$SCRIPT_DIR/seed-permissions.sh" || true
echo "==> Seeding rulebook (placeholder)..."
"$SCRIPT_DIR/seed-rulebook.sh" || true
echo "==> Seeding domain data (placeholder)..."
"$SCRIPT_DIR/seed-domain-data.sh" || true

echo "==> Waiting for services..."
sleep 15

if [ "$SKIP_SMOKE_TESTS" != "1" ]; then
  echo "==> Running smoke tests..."
  "$SCRIPT_DIR/smoke-tests.sh" | tee docs/smoke-test-report.md 2>/dev/null || "$SCRIPT_DIR/smoke-tests.sh"
else
  echo "==> Skipping smoke tests (SKIP_SMOKE_TESTS=1)"
fi

echo ""
echo "=============================================="
echo "  PFM Stack Demo – Setup complete"
echo "=============================================="
echo "  Keycloak:    http://127.0.0.1:8088"
echo "  Bill UI:     http://127.0.0.1:3000"
echo "  Audit UI:    http://127.0.0.1:3001"
echo ""
echo "  Demo users (password: demo123):"
echo "    finance@demo.gov   (finance_admin, dept_operator)"
echo "    treasury@demo.gov  (treasury_operator)"
echo "    auditor@demo.gov   (auditor)"
echo "    redressal@demo.gov (redressal_authority)"
echo "  Keycloak admin: admin / admin"
echo "=============================================="
