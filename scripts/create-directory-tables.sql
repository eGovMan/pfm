-- Create directory-service tables only (safe when sharing DB with other services)
CREATE TABLE IF NOT EXISTS "Participant" (
  "participantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Participant_pkey" PRIMARY KEY ("participantId")
);

CREATE TABLE IF NOT EXISTS "Endpoint" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Endpoint_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("participantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Endpoint_participantId_service_key" UNIQUE ("participantId", "service")
);

CREATE TABLE IF NOT EXISTS "Key" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "alg" TEXT NOT NULL DEFAULT 'Ed25519',
  "publicKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Key_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Key_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("participantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Key_participantId_keyId_key" UNIQUE ("participantId", "keyId")
);

CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "proofType" TEXT,
  "resource" TEXT,
  "conditions_json" TEXT,
  "effect" TEXT NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Permission_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("participantId") ON DELETE CASCADE ON UPDATE CASCADE
);
