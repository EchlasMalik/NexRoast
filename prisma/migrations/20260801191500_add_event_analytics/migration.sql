-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roastId" TEXT,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_roastId_idx" ON "Event"("roastId");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_roastId_fkey" FOREIGN KEY ("roastId") REFERENCES "Roast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
