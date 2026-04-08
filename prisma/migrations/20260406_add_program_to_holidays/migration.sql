-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN "programId" TEXT;

-- CreateIndex
CREATE INDEX "Holiday_programId_idx" ON "Holiday"("programId");

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
