-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttendanceExcuseStatus" AS ENUM ('PENDING', 'EXCUSED', 'DENIED', 'KEPT_ABSENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new NotificationType values
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_EXCUSE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_EXCUSE_RESOLVED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AttendanceExcuseRequest" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "status" "AttendanceExcuseStatus" NOT NULL DEFAULT 'PENDING',
    "studentMessage" TEXT,
    "staffMessage" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceExcuseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceExcuseRequest_attendanceRecordId_studentUserId_key" ON "AttendanceExcuseRequest"("attendanceRecordId", "studentUserId");
CREATE INDEX IF NOT EXISTS "AttendanceExcuseRequest_studentUserId_idx" ON "AttendanceExcuseRequest"("studentUserId");
CREATE INDEX IF NOT EXISTS "AttendanceExcuseRequest_status_idx" ON "AttendanceExcuseRequest"("status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AttendanceExcuseRequest" ADD CONSTRAINT "AttendanceExcuseRequest_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceExcuseRequest" ADD CONSTRAINT "AttendanceExcuseRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceExcuseRequest" ADD CONSTRAINT "AttendanceExcuseRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
