# PFM Stack Demo – Script (10–12 min)

Prerequisites: `./scripts/setup.sh` completed; all smoke tests passed.

---

## 1. Setup check (0:30)

```bash
# Ensure stack is up
docker compose ps
# Optional: re-run smoke tests
./scripts/smoke-tests.sh
```

**URLs:** Bill UI http://localhost:3000 | Audit UI http://localhost:3001 | Keycloak http://localhost:8088

---

## 2. Happy path – Bill UI (4–5 min)

1. Open **http://localhost:3000** → redirect to Keycloak.
2. Log in: **finance@demo.gov** / **demo123**.
3. Create case: keep defaults (workId work-1, milestoneId m1, vendorId v1, amount 50000, budgetHead head-001) or change; click **Next: Fetch proofs**.
4. Click **Issue proofs** (wait ~1s).
5. Click **Evaluate** → decision should be **APPROVE**.
6. Click **Reserve budget & submit payment** (wait ~5–6s for IFMS delay) → “Payment submitted successfully.”
7. Note the **Case ID** at the top (e.g. `case-xyz`).

---

## 3. Audit viewer – timeline and integrity (2 min)

1. Open **http://localhost:3001** (Audit Viewer).
2. Paste the **Case ID** from step 2, click **Search**.
3. Confirm **Integrity: OK**.
4. Check timeline: one **Decision** (APPROVE) and two **Event** entries (`voucher_created`, `payment_completed`).
5. Optionally: enable **Advanced** to see hashes; use **Export timeline JSON** to download.

---

## 4. HOLD path – appeal (2 min)

1. In Bill UI, create a **new case** (new Case ID).
2. Set **Bank validated** to **unchecked** (or use vendorId that yields HOLD).
3. Issue proofs → Evaluate → decision **HOLD** (e.g. VENDOR_BANK_NOT_VALIDATED).
4. Click **Appeal** → “Appeal recorded.”
5. In Audit Viewer, search the **same Case ID** → confirm **Appeals** section shows the appeal.

---

## 5. Redressal – override (2 min)

1. Log out from Bill UI; log in as **redressal@demo.gov** / **demo123**.
2. Open a case that had **HOLD** with an **override-allowed** reason (e.g. VENDOR_BANK_NOT_VALIDATED).
3. Issue proofs → Evaluate → HOLD.
4. Click **Override** (visible only for redressal user when reason is override-allowed) → “Override recorded.”
5. In Audit Viewer, search that case → **Overrides** section shows the override; timeline may show `override_applied` event.

---

## 6. Concurrency (optional, 1 min)

From terminal:

```bash
# Reserve same caseId twice → same reservationId (idempotent)
curl -s -X POST http://127.0.0.1:8086/v1/budget/reserve -H "Content-Type: application/json" \
  -d '{"caseId":"demo-concurrent","budgetHead":"head-001","amount":10000}' | jq .reservationId
curl -s -X POST http://127.0.0.1:8086/v1/budget/reserve -H "Content-Type: application/json" \
  -d '{"caseId":"demo-concurrent","budgetHead":"head-001","amount":10000}' | jq .reservationId
# Second response same reservationId
```

---

## Troubleshooting

- **Bill UI:** “Loading / redirecting to login” → Keycloak not ready or bill-ui client missing; run `./scripts/init-keycloak.sh`.
- **Evaluate DENY with valid-looking proofs:** Ensure directory and rulebook are seeded (`seed-directory.sh`, `seed-rulebook.sh`) and keys generated (`generate-keys.sh`).
- **Submit payment fails:** Check budget head exists (smoke test creates head-001); reservation must be RESERVED and decision APPROVE with matching decisionHash in audit.
