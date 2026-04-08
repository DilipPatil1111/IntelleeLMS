-- CreateTable: CertificateTemplate
CREATE TABLE "CertificateTemplate" (
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
CREATE TABLE "CertificateIssued" (
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
CREATE TABLE "CertificateCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertificateCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CanvaAccount
CREATE TABLE "CanvaAccount" (
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
CREATE INDEX "CertificateTemplate_createdById_idx" ON "CertificateTemplate"("createdById");

-- CreateIndex: CertificateIssued.certificateNumber (unique)
CREATE UNIQUE INDEX "CertificateIssued_certificateNumber_key" ON "CertificateIssued"("certificateNumber");

-- CreateIndex: CertificateIssued indexes
CREATE INDEX "CertificateIssued_templateId_idx" ON "CertificateIssued"("templateId");
CREATE INDEX "CertificateIssued_recipientId_idx" ON "CertificateIssued"("recipientId");
CREATE INDEX "CertificateIssued_programId_idx" ON "CertificateIssued"("programId");

-- CreateIndex: CanvaAccount.userId (unique)
CREATE UNIQUE INDEX "CanvaAccount_userId_key" ON "CanvaAccount"("userId");

-- AddForeignKey: CertificateTemplate.createdById -> User.id
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CertificateIssued.templateId -> CertificateTemplate.id
ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CertificateIssued.recipientId -> User.id
ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CertificateIssued.programId -> Program.id
ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CertificateIssued.sentByUserId -> User.id
ALTER TABLE "CertificateIssued" ADD CONSTRAINT "CertificateIssued_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CanvaAccount.userId -> User.id
ALTER TABLE "CanvaAccount" ADD CONSTRAINT "CanvaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add brandingDisplayMode to InstitutionProfile
ALTER TABLE "InstitutionProfile" ADD COLUMN IF NOT EXISTS "brandingDisplayMode" TEXT NOT NULL DEFAULT 'LOGO_WITH_TEXT';
