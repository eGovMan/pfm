-- Create audit-service tables only (safe when sharing DB with other services)
CREATE TABLE IF NOT EXISTS "DecisionRecord" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "rulebook_id" TEXT NOT NULL,
  "rulebook_version" TEXT NOT NULL,
  "evaluated_at" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reasons_json" TEXT NOT NULL,
  "proof_refs_json" TEXT NOT NULL,
  "proof_checks_json" TEXT NOT NULL,
  "reservation_id" TEXT,
  "decision_hash" TEXT NOT NULL,
  "previous_hash" TEXT NOT NULL,
  "record_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DecisionRecord_case_id_idx" ON "DecisionRecord"("case_id");

CREATE TABLE IF NOT EXISTS "StatusEvent" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_time" TEXT NOT NULL,
  "refs_json" TEXT NOT NULL,
  "previous_hash" TEXT NOT NULL,
  "event_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StatusEvent_case_id_idx" ON "StatusEvent"("case_id");
