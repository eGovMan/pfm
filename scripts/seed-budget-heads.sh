#!/usr/bin/env bash
# Seed budget head(s) so reserve has headroom (Bill UI default: head-001)
set -e
BUDGET_URL="${BUDGET_URL:-http://127.0.0.1:8086}"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BUDGET_URL/v1/admin/budget/heads" \
  -H "Content-Type: application/json" -d '{"budgetHead":"head-001","total":1000000}')
if [ "$code" = "201" ]; then
  echo "Budget head head-001 seeded (total=1000000)."
else
  echo "Budget head seed returned $code (may already exist)."
fi
