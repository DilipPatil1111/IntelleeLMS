-- CreateEnum
CREATE TYPE "ProgramCalendarSlotType" AS ENUM ('SESSION', 'LUNCH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LOW_ATTENDANCE_STUDENT';
ALTER TYPE "NotificationType" ADD VALUE 'LOW_ATTENDANCE_STAFF';
ALTER TYPE "NotificationType" ADD VALUE 'CALENDAR_HOURS_UPDATE_REQUEST';

-- CreateTable
CREATE TABLE "ProgramCalendarSlot" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "subjectId" TEXT,
    "slotDate" DATE NOT NULL,
    "slotType" "ProgramCalendarSlotType" NOT NULL DEFAULT 'SESSION',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#6366f1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramCalendarSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramCalendarSlot_batchId_slotDate_idx" ON "ProgramCalendarSlot"("batchId", "slotDate");

-- CreateIndex
CREATE INDEX "ProgramCalendarSlot_programId_batchId_idx" ON "ProgramCalendarSlot"("programId", "batchId");

-- CreateIndex
CREATE INDEX "ProgramCalendarSlot_teacherUserId_idx" ON "ProgramCalendarSlot"("teacherUserId");

-- AddForeignKey
ALTER TABLE "ProgramCalendarSlot" ADD CONSTRAINT "ProgramCalendarSlot_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCalendarSlot" ADD CONSTRAINT "ProgramCalendarSlot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCalendarSlot" ADD CONSTRAINT "ProgramCalendarSlot_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCalendarSlot" ADD CONSTRAINT "ProgramCalendarSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
