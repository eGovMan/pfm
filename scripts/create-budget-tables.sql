-- Create budget-lock tables only (safe when sharing DB with other services)
CREATE TABLE IF NOT EXISTS "BudgetHead" (
  "budgetHead" TEXT NOT NULL,
  "total" BIGINT NOT NULL DEFAULT 0,
  "committed" BIGINT NOT NULL DEFAULT 0,
  "reserved" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "BudgetHead_pkey" PRIMARY KEY ("budgetHead")
);

CREATE TABLE IF NOT EXISTS "Reservation" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "budget_head_id" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Reservation_budget_head_id_fkey" FOREIGN KEY ("budget_head_id") REFERENCES "BudgetHead"("budgetHead") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Reservation_caseId_status_idx" ON "Reservation"("caseId", "status");
CREATE INDEX IF NOT EXISTS "Reservation_budget_head_id_idx" ON "Reservation"("budget_head_id");
CREATE INDEX IF NOT EXISTS "Reservation_status_expires_at_idx" ON "Reservation"("status", "expires_at");
