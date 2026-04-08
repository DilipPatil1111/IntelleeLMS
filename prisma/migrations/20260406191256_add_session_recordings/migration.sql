-- CreateTable
CREATE TABLE "SessionRecording" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "durationMin" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionRecording_programId_idx" ON "SessionRecording"("programId");

-- CreateIndex
CREATE INDEX "SessionRecording_sessionDate_idx" ON "SessionRecording"("sessionDate");

-- AddForeignKey
ALTER TABLE "SessionRecording" ADD CONSTRAINT "SessionRecording_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRecording" ADD CONSTRAINT "SessionRecording_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
