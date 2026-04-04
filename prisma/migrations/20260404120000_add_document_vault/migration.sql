-- CreateEnum
CREATE TYPE "FolderScope" AS ENUM ('GENERIC', 'YEAR_SPECIFIC', 'BATCH_SPECIFIC');

-- AlterTable: add receipt/confirm fields to FeePayment
ALTER TABLE "FeePayment" ADD COLUMN "receiptUrl" TEXT;
ALTER TABLE "FeePayment" ADD COLUMN "receiptFileName" TEXT;
ALTER TABLE "FeePayment" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "FeePayment" ADD COLUMN "confirmedById" TEXT;

-- CreateTable
CREATE TABLE "DocFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "scope" "FolderScope" NOT NULL DEFAULT 'GENERIC',
    "yearId" TEXT,
    "programId" TEXT,
    "batchId" TEXT,
    "isAutoPopulated" BOOLEAN NOT NULL DEFAULT false,
    "autoPopulateKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocFile" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionNote" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocFolder_parentId_idx" ON "DocFolder"("parentId");
CREATE INDEX "DocFolder_yearId_idx" ON "DocFolder"("yearId");
CREATE INDEX "DocFolder_programId_batchId_idx" ON "DocFolder"("programId", "batchId");

-- CreateIndex
CREATE INDEX "DocFile_folderId_idx" ON "DocFile"("folderId");

-- CreateIndex
CREATE INDEX "InspectionNote_folderId_idx" ON "InspectionNote"("folderId");

-- AddForeignKey
ALTER TABLE "DocFolder" ADD CONSTRAINT "DocFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocFile" ADD CONSTRAINT "DocFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionNote" ADD CONSTRAINT "InspectionNote_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
