-- CreateEnum
CREATE TYPE "RoastStatus" AS ENUM ('pending', 'processing', 'complete', 'failed');

-- CreateTable
CREATE TABLE "Roast" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "status" "RoastStatus" NOT NULL DEFAULT 'pending',
    "score" INTEGER,
    "critique" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedAt" TIMESTAMP(3),

    CONSTRAINT "Roast_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Roast_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100))
);

-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL,
    "roastId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadCapture_roastId_idx" ON "LeadCapture"("roastId");

-- AddForeignKey
ALTER TABLE "LeadCapture" ADD CONSTRAINT "LeadCapture_roastId_fkey" FOREIGN KEY ("roastId") REFERENCES "Roast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
