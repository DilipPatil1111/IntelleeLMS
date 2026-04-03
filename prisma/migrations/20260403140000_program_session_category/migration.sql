-- CreateEnum
CREATE TYPE "ProgramSessionCategory" AS ENUM ('THEORY', 'PRACTICAL', 'SLACK', 'PROJECT');

-- AlterTable
ALTER TABLE "ProgramCalendarSlot" ADD COLUMN "sessionCategory" "ProgramSessionCategory";
