-- Roast -> Audit platform refactor.
--
-- This is a destructive reset, not a data-preserving migration: every existing
-- Roast, LeadCapture and Event row is dropped. That was a deliberate product
-- decision — the old comedy-roast records have no category scores, no issues
-- and no business name, so they cannot populate the new audit UI, and keeping
-- a compatibility layer for them would have contaminated the new schema.
--
-- scripts/export-legacy-data.mjs dumps all three tables to JSON and MUST be
-- run before this migration. Some dropped rows were paid for.

-- Old world.
DROP TABLE IF EXISTS "LeadCapture";
DROP TABLE IF EXISTS "Event";
DROP TABLE IF EXISTS "Roast";
DROP TYPE IF EXISTS "RoastStatus";

-- New world.
CREATE TYPE "AuditStatus" AS ENUM ('pending', 'processing', 'complete', 'failed');

CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'pending',
    "screenshotUrl" TEXT,
    "businessName" TEXT,
    "businessType" TEXT,
    "overallScore" INTEGER,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "report" JSONB,
    "reportVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id"),
    -- Kept from the original schema. Prisma cannot express a CHECK, so this is
    -- invisible to drift detection: if the model is ever regenerated from
    -- scratch, re-add it by hand.
    CONSTRAINT "Audit_overallScore_range" CHECK ("overallScore" IS NULL OR ("overallScore" >= 0 AND "overallScore" <= 100))
);

CREATE INDEX "Audit_indexable_completedAt_idx" ON "Audit"("indexable", "completedAt");
CREATE INDEX "Audit_host_completedAt_idx" ON "Audit"("host", "completedAt");
CREATE INDEX "Audit_createdAt_idx" ON "Audit"("createdAt");

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "auditId" TEXT,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_type_idx" ON "Event"("type");
CREATE INDEX "Event_auditId_idx" ON "Event"("auditId");
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

ALTER TABLE "Event" ADD CONSTRAINT "Event_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
