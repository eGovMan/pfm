#!/usr/bin/env bash
# Seed vendors, works, budgets (Sprint 1+ will use via admin/seed endpoints)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_DIR="${REPO_ROOT}/infra/seed"
mkdir -p "$SEED_DIR"

for f in vendors.json works.json budgets.json; do
  if [ ! -f "$SEED_DIR/$f" ]; then
    echo "[]" > "$SEED_DIR/$f"
  fi
done
echo "Domain seed data ready at infra/seed/"
