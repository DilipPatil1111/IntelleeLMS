-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "programCategoryId" TEXT,
ADD COLUMN     "programDomainId" TEXT,
ADD COLUMN     "programTypeId" TEXT;

-- AlterTable
ALTER TABLE "ProgramApplication" ADD COLUMN     "programCategoryId" TEXT,
ADD COLUMN     "programDomainId" TEXT,
ADD COLUMN     "programTypeId" TEXT;

-- CreateTable
CREATE TABLE "InstitutionProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "institutionNumber" TEXT,
    "legalName" TEXT,
    "permanentAddress" TEXT,
    "mailingAddress" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "socialFacebookUrl" TEXT,
    "socialLinkedInUrl" TEXT,
    "socialTwitterUrl" TEXT,
    "socialInstagramUrl" TEXT,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramDomain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramDomain_customerId_key" ON "ProgramDomain"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCategory_customerId_key" ON "ProgramCategory"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramType_customerId_key" ON "ProgramType"("customerId");

-- CreateIndex
CREATE INDEX "Program_programDomainId_idx" ON "Program"("programDomainId");

-- CreateIndex
CREATE INDEX "Program_programCategoryId_idx" ON "Program"("programCategoryId");

-- CreateIndex
CREATE INDEX "Program_programTypeId_idx" ON "Program"("programTypeId");

-- CreateIndex
CREATE INDEX "ProgramApplication_programDomainId_idx" ON "ProgramApplication"("programDomainId");

-- CreateIndex
CREATE INDEX "ProgramApplication_programCategoryId_idx" ON "ProgramApplication"("programCategoryId");

-- CreateIndex
CREATE INDEX "ProgramApplication_programTypeId_idx" ON "ProgramApplication"("programTypeId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_programDomainId_fkey" FOREIGN KEY ("programDomainId") REFERENCES "ProgramDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_programCategoryId_fkey" FOREIGN KEY ("programCategoryId") REFERENCES "ProgramCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_programTypeId_fkey" FOREIGN KEY ("programTypeId") REFERENCES "ProgramType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_programDomainId_fkey" FOREIGN KEY ("programDomainId") REFERENCES "ProgramDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_programCategoryId_fkey" FOREIGN KEY ("programCategoryId") REFERENCES "ProgramCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_programTypeId_fkey" FOREIGN KEY ("programTypeId") REFERENCES "ProgramType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
