-- CreateEnum
CREATE TYPE "StudentSubmissionKind" AS ENUM ('SIGNED_CONTRACT', 'GOVERNMENT_ID', 'ONBOARDING_FEE_PROOF', 'FEE_RECEIPT');

-- CreateTable
CREATE TABLE "StudentSubmissionLog" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "kind" "StudentSubmissionKind" NOT NULL,
    "feePaymentId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSubmissionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentSubmissionLog_studentProfileId_kind_idx" ON "StudentSubmissionLog"("studentProfileId", "kind");

-- CreateIndex
CREATE INDEX "StudentSubmissionLog_feePaymentId_idx" ON "StudentSubmissionLog"("feePaymentId");

-- AddForeignKey
ALTER TABLE "StudentSubmissionLog" ADD CONSTRAINT "StudentSubmissionLog_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubmissionLog" ADD CONSTRAINT "StudentSubmissionLog_feePaymentId_fkey" FOREIGN KEY ("feePaymentId") REFERENCES "FeePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
