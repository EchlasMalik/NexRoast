-- Reintroduces a paid tier for the full audit.
--
-- The free audit keeps the score, every category breakdown, the summary,
-- strengths and the first issues in full. Payment unlocks the remaining issues
-- and the PDF. Nullable and defaulting to NULL, so every existing audit stays
-- in the free tier — nothing already published changes.

ALTER TABLE "Audit" ADD COLUMN "unlockedAt" TIMESTAMP(3);

-- Paid audits are looked up by the webhook and rendered differently, so the
-- partial index keeps that lookup cheap without indexing the (many) free rows.
CREATE INDEX "Audit_unlockedAt_idx" ON "Audit"("unlockedAt") WHERE "unlockedAt" IS NOT NULL;
