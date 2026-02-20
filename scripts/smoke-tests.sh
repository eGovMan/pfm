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

# Sprint 1: Directory API (directory exposed on 8081 for setup/seeding)
code=$(curl -s -o /tmp/dir-participant.json -w "%{http_code}" "http://127.0.0.1:8081/v1/participants/did:web:works.demo.gov" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  if grep -q '"keys"' /tmp/dir-participant.json 2>/dev/null && grep -q '"endpoints"' /tmp/dir-participant.json 2>/dev/null; then
    echo "  OK directory GET /v1/participants/:id (keys and endpoints)"
  else
    echo "  FAIL directory participant response missing keys/endpoints"
    fail=1
  fi
else
  echo "  FAIL directory GET participant (got $code)"
  fail=1
fi

allowed=$(curl -s "http://127.0.0.1:8081/v1/permissions/isAllowed?participantId=did:web:works.demo.gov&action=issue_proof&proofType=WorkCompletionProof" 2>/dev/null | grep -o '"allowed":[^,}]*' | cut -d: -f2)
if [ "$allowed" = "true" ]; then
  echo "  OK directory isAllowed (works issuer, WorkCompletionProof) -> true"
else
  echo "  FAIL directory isAllowed expected true (got $allowed)"
  fail=1
fi

allowed2=$(curl -s "http://127.0.0.1:8081/v1/permissions/isAllowed?participantId=did:web:vendor.demo.gov&action=issue_proof&proofType=WorkCompletionProof" 2>/dev/null | grep -o '"allowed":[^,}]*' | cut -d: -f2)
if [ "$allowed2" = "false" ]; then
  echo "  OK directory isAllowed (vendor, WorkCompletionProof) -> false"
else
  echo "  FAIL directory isAllowed expected false for unauthorized (got $allowed2)"
  fail=1
fi

code_admin=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:8081/v1/admin/participants/bulk" -H "Content-Type: application/json" -d '{"participants":[]}' 2>/dev/null || echo "000")
if [ "$code_admin" = "401" ]; then
  echo "  OK directory admin bulk without token -> 401"
else
  echo "  FAIL directory admin without token expected 401 (got $code_admin)"
  fail=1
fi

# Sprint 2: Proof issuers (exposed 8082 works, 8083 vendor)
# Ensure infra/keys exist (run generate-keys.sh) and re-run 'docker compose up -d' to expose 8082/8083.
code_work_issue=$(curl -s -o /tmp/work-proof.json -w "%{http_code}" -X POST "http://127.0.0.1:8082/v1/proofs/issue" \
  -H "Content-Type: application/json" \
  -d '{"workId":"w1","milestoneId":"m1","completionDate":"2025-01-01"}' 2>/dev/null || echo "000")
if [ "$code_work_issue" = "201" ]; then
  if grep -q '"proofId"' /tmp/work-proof.json 2>/dev/null && grep -q '"signature"' /tmp/work-proof.json 2>/dev/null; then
    echo "  OK works-proof-issuer POST /v1/proofs/issue -> 201 (proof + signature)"
  else
    echo "  FAIL works-proof-issuer response missing proofId/signature"
    fail=1
  fi
else
  echo "  FAIL works-proof-issuer issue (got $code_work_issue). Ensure ports 8082/8083 exposed and infra/keys exist."
  fail=1
fi

work_proof_id=$(jq -r .proofId /tmp/work-proof.json 2>/dev/null || echo "")
work_status=$(curl -s "http://127.0.0.1:8082/v1/proofs/${work_proof_id}/status" 2>/dev/null | jq -r .status 2>/dev/null || echo "")
if [ "$work_status" = "VALID" ]; then
  echo "  OK works-proof-issuer GET status -> VALID"
else
  echo "  FAIL works-proof-issuer status expected VALID (got $work_status)"
  fail=1
fi

if node scripts/verify-proof-smoke.js /tmp/work-proof.json "did:web:works.demo.gov" 2>/dev/null; then
  echo "  OK verify work proof signature (directory public key)"
else
  echo "  FAIL verify work proof signature"
  fail=1
fi

code_vendor_issue=$(curl -s -o /tmp/vendor-proof.json -w "%{http_code}" -X POST "http://127.0.0.1:8083/v1/proofs/issue" \
  -H "Content-Type: application/json" \
  -d '{"canonicalVendorId":"v1","bankValidated":true,"blacklisted":false,"taxStatus":"compliant"}' 2>/dev/null || echo "000")
if [ "$code_vendor_issue" = "201" ]; then
  if grep -q '"proofId"' /tmp/vendor-proof.json 2>/dev/null && grep -q '"signature"' /tmp/vendor-proof.json 2>/dev/null; then
    echo "  OK vendor-proof-issuer POST /v1/proofs/issue -> 201 (proof + signature)"
  else
    echo "  FAIL vendor-proof-issuer response missing proofId/signature"
    fail=1
  fi
else
  echo "  FAIL vendor-proof-issuer issue (got $code_vendor_issue)"
  fail=1
fi

if node scripts/verify-proof-smoke.js /tmp/vendor-proof.json "did:web:vendor.demo.gov" 2>/dev/null; then
  echo "  OK verify vendor proof signature (directory public key)"
else
  echo "  FAIL verify vendor proof signature"
  fail=1
fi

if [ $fail -eq 1 ]; then
  echo "Some smoke tests failed."
  exit 1
fi
echo "All smoke tests passed."
exit 0
