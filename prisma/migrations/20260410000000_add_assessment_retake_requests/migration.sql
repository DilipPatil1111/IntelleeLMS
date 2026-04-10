-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RetakeRequestStatus" AS ENUM ('PENDING', 'APPROVED_RETAKE', 'EXCUSED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new NotificationType values
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETAKE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETAKE_REQUEST_RESOLVED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssessmentRetakeRequest" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "status" "RetakeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "studentMessage" TEXT,
    "staffMessage" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentRetakeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentRetakeRequest_assessmentId_studentUserId_key" ON "AssessmentRetakeRequest"("assessmentId", "studentUserId");
CREATE INDEX IF NOT EXISTS "AssessmentRetakeRequest_studentUserId_idx" ON "AssessmentRetakeRequest"("studentUserId");
CREATE INDEX IF NOT EXISTS "AssessmentRetakeRequest_status_idx" ON "AssessmentRetakeRequest"("status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AssessmentRetakeRequest" ADD CONSTRAINT "AssessmentRetakeRequest_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentRetakeRequest" ADD CONSTRAINT "AssessmentRetakeRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentRetakeRequest" ADD CONSTRAINT "AssessmentRetakeRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
