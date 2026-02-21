-- Create exceptions-service tables only (safe when sharing DB with other services)
CREATE TABLE IF NOT EXISTS "Appeal" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "raised_by" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Appeal_case_id_idx" ON "Appeal"("case_id");

CREATE TABLE IF NOT EXISTS "Override" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "performed_by" TEXT NOT NULL,
  "reason_codes_overridden_json" TEXT NOT NULL,
  "justification" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Override_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Override_case_id_idx" ON "Override"("case_id");
