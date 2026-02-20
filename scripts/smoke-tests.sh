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

# Sprint 3: Rulebook and checks-engine (exposed 8084 rulebook, 8085 checks)
code_rb=$(curl -s -o /tmp/rulebook.json -w "%{http_code}" "http://127.0.0.1:8084/v1/rulebooks/vendor-payment?version=v0.1" 2>/dev/null || echo "000")
if [ "$code_rb" = "200" ]; then
  if grep -q '"version"' /tmp/rulebook.json 2>/dev/null && grep -q 'v0.1' /tmp/rulebook.json 2>/dev/null; then
    echo "  OK rulebook GET vendor-payment v0.1"
  else
    echo "  FAIL rulebook response missing version"
    fail=1
  fi
else
  echo "  FAIL rulebook GET (got $code_rb). Run seed-rulebook.sh after rulebook is up."
  fail=1
fi

# Checks-engine: missing proofs -> DENY with reason codes
eval_missing=$(curl -s -X POST "http://127.0.0.1:8085/v1/checks/evaluate" \
  -H "Content-Type: application/json" \
  -d '{"caseId":"c-missing","vendorId":"v1","workId":"w1","milestoneId":"m1","amount":1000,"budgetHead":"h1","proofRefs":[],"rulebookId":"vendor-payment","rulebookVersion":"v0.1"}' 2>/dev/null)
decision_missing=$(echo "$eval_missing" | jq -r .decision 2>/dev/null || echo "")
if [ "$decision_missing" = "DENY" ]; then
  echo "  OK checks-engine missing proofs -> DENY"
else
  echo "  FAIL checks-engine missing proofs expected DENY (got $decision_missing)"
  fail=1
fi

# Checks-engine: valid work + vendor proofs -> APPROVE
work_pid=$(jq -r .proofId /tmp/work-proof.json 2>/dev/null)
vendor_pid=$(jq -r .proofId /tmp/vendor-proof.json 2>/dev/null)
eval_body=$(jq -n \
  --arg cid "c-ok" --arg vid "v1" --arg wid "w1" --arg mid "m1" \
  --arg wid2 "$work_pid" --arg vid2 "$vendor_pid" \
  '{caseId:$cid,vendorId:$vid,workId:$wid,milestoneId:$mid,amount:1000,budgetHead:"h1",rulebookId:"vendor-payment",rulebookVersion:"v0.1",proofRefs:[{proofId:$wid2,proofType:"WorkCompletionProof",issuerId:"did:web:works.demo.gov"},{proofId:$vid2,proofType:"VendorEligibilityProof",issuerId:"did:web:vendor.demo.gov"}]}')
eval_ok=$(curl -s -X POST "http://127.0.0.1:8085/v1/checks/evaluate" -H "Content-Type: application/json" -d "$eval_body" 2>/dev/null)
decision_ok=$(echo "$eval_ok" | jq -r .decision 2>/dev/null || echo "")
if [ "$decision_ok" = "APPROVE" ]; then
  echo "  OK checks-engine valid proofs -> APPROVE"
else
  echo "  FAIL checks-engine valid proofs expected APPROVE (got $decision_ok)"
  fail=1
fi

# Rulebook: signature/issuer reason codes have overrideAllowed false
override_invalid=$(curl -s "http://127.0.0.1:8084/v1/rulebooks/vendor-payment/reasonCodes?version=v0.1" 2>/dev/null | jq -r '.reasonCodes.INVALID_PROOF_SIGNATURE.overrideAllowed' 2>/dev/null)
override_unauth=$(curl -s "http://127.0.0.1:8084/v1/rulebooks/vendor-payment/reasonCodes?version=v0.1" 2>/dev/null | jq -r '.reasonCodes.UNAUTHORIZED_ISSUER.overrideAllowed' 2>/dev/null)
if [ "$override_invalid" = "false" ] && [ "$override_unauth" = "false" ]; then
  echo "  OK rulebook DENY reason codes overrideAllowed false for signature/issuer"
else
  echo "  FAIL rulebook expected overrideAllowed false (got $override_invalid, $override_unauth)"
  fail=1
fi

if [ $fail -eq 1 ]; then
  echo "Some smoke tests failed."
  exit 1
fi
echo "All smoke tests passed."
exit 0
