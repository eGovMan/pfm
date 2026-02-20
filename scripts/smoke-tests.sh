#!/usr/bin/env bash
# Smoke tests: health endpoints and minimal checks
set -e
COMPOSE="docker compose"
$COMPOSE version >/dev/null 2>&1 || COMPOSE="docker-compose"

echo "Smoke tests"

# Health check helper via docker exec (services listen on 8080 internally)
exec_health() {
  local svc="$1"
  if $COMPOSE exec -T "$svc" node -e "require('http').get('http://127.0.0.1:8080/health', (r)=>{ let b=''; r.on('data',c=>b+=c); r.on('end',()=>process.exit(r.statusCode===200?0:1)); }).on('error',()=>process.exit(1));" 2>/dev/null; then
    echo "  OK $svc /health -> 200"
  else
    echo "  FAIL $svc /health"
    return 1
  fi
}

fail=0
for svc in directory-service rulebook-service works-proof-issuer vendor-proof-issuer checks-engine budget-lock audit-service exceptions-service ifms-dummy ifms-connector; do
  exec_health "$svc" || fail=1
done

# Keycloak (exposed on 8088)
code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/health/ready 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  echo "  OK keycloak /health/ready -> 200"
else
  echo "  FAIL keycloak (got $code)"
  fail=1
fi

# UIs (exposed on 3000, 3001)
for port in 3000 3001; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$port/" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "  OK ui:$port -> 200"
  else
    echo "  FAIL ui:$port (got $code)"
    fail=1
  fi
done

if [ $fail -eq 1 ]; then
  echo "Some smoke tests failed."
  exit 1
fi
echo "All smoke tests passed."
exit 0
