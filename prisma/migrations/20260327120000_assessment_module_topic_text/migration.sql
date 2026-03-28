-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "moduleNameText" TEXT;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "topicNameText" TEXT;
