-- Create ifms-dummy tables only (safe when sharing DB with other services)
CREATE TABLE IF NOT EXISTS "Voucher" (
  "id" TEXT NOT NULL,
  "voucher_no" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "budget_head" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Voucher_voucher_no_key" UNIQUE ("voucher_no")
);
CREATE INDEX IF NOT EXISTS "Voucher_case_id_idx" ON "Voucher"("case_id");
