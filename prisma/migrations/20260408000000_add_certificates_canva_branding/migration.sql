-- CreateTable: CertificateTemplate
CREATE TABLE IF NOT EXISTS "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "backgroundUrl" TEXT,
    "backgroundFileName" TEXT,
    "orientation" TEXT NOT NULL DEFAULT 'LANDSCAPE',
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "fieldsJson" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CertificateIssued
CREATE TABLE IF NOT EXISTS "CertificateIssued" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "programId" TEXT,
    "dataJson" TEXT NOT NULL DEFAULT '{}',
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateIssued_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CertificateCounter
CREATE TABLE IF NOT EXISTS "CertificateCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertificateCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CanvaAccount
CREATE TABLE IF NOT EXISTS "CanvaAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "canvaUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: CertificateTemplate.createdById
CREATE INDEX IF NOT EXISTS "CertificateTemplate_createdById_idx" ON "CertificateTemplate"("createdById");

-- CreateIndex: CertificateIssued.certificateNumber (unique)
CREATE UNIQUE INDEX IF NOT EXISTS "CertificateIssued_certificateNumber_key" ON "CertificateIssued"("certificateNumber");

-- CreateIndex: CertificateIssued indexes
CREATE INDEX IF NOT EXISTS "CertificateIssued_templateId_idx" ON "CertificateIssued"("templateId");
CREATE INDEX IF NOT EXISTS "CertificateIssued_recipientId_idx" ON "CertificateIssued"("recipientId");
CREATE INDEX IF NOT EXISTS "CertificateIssued_programId_idx" ON "CertificateIssued"("programId");

-- CreateIndex: CanvaAccount.userId (unique)
CREATE UNIQUE INDEX IF NOT EXISTS "CanvaAccount_userId_key" ON "CanvaAccount"("userId");

-- AddForeignKey: CertificateTemplate.createdById -> User.id
DO $$ BEGIN
  ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: CertificateIssued.templateId -> CertificateTemplate.id
DO $$ BEGIN
  ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: CertificateIssued.recipientId -> User.id
DO $$ BEGIN
  ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: CertificateIssued.programId -> Program.id
DO $$ BEGIN
  ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: CertificateIssued.sentByUserId -> User.id
DO $$ BEGIN
  ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: CanvaAccount.userId -> User.id
DO $$ BEGIN
  ALTER TABLE "CanvaAccount" ADD CONSTRAINT "CanvaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add brandingDisplayMode to InstitutionProfile
ALTER TABLE "InstitutionProfile" ADD COLUMN IF NOT EXISTS "brandingDisplayMode" TEXT NOT NULL DEFAULT 'LOGO_WITH_TEXT';
