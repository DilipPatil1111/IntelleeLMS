-- Join table for per-student assessment assignment (used when publishing / syncing student lists).

CREATE TABLE "AssessmentAssignedStudent" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAssignedStudent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssessmentAssignedStudent_studentId_idx" ON "AssessmentAssignedStudent"("studentId");

CREATE UNIQUE INDEX "AssessmentAssignedStudent_assessmentId_studentId_key" ON "AssessmentAssignedStudent"("assessmentId", "studentId");

ALTER TABLE "AssessmentAssignedStudent" ADD CONSTRAINT "AssessmentAssignedStudent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentAssignedStudent" ADD CONSTRAINT "AssessmentAssignedStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
