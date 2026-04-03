-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "allPrograms" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Announcement" ADD COLUMN "allBatches" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Announcement" ADD COLUMN "programIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Announcement" ADD COLUMN "batchIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Announcement" ADD COLUMN "allTeachers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Announcement" ADD COLUMN "teacherIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Announcement" ADD COLUMN "sendToStudents" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Announcement" ADD COLUMN "sendToTeachers" BOOLEAN NOT NULL DEFAULT false;
