-- CreateEnum
CREATE TYPE "ProgramLessonKind" AS ENUM ('TEXT', 'VIDEO', 'PDF', 'AUDIO', 'PRESENTATION', 'QUIZ', 'DOWNLOAD', 'SURVEY', 'MULTIMEDIA');

-- CreateTable
CREATE TABLE "ProgramSyllabus" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "instructions" TEXT,
    "programHours" TEXT,
    "feesNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramSyllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramChapter" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "freePreviewLesson" BOOLEAN NOT NULL DEFAULT false,
    "isPrerequisite" BOOLEAN NOT NULL DEFAULT false,
    "enableDiscussions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramLesson" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "kind" "ProgramLessonKind" NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB,
    "assessmentId" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramLessonCompletion" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramLessonCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramCertificateSend" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentByUserId" TEXT NOT NULL,

    CONSTRAINT "ProgramCertificateSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramSyllabus_programId_key" ON "ProgramSyllabus"("programId");

-- CreateIndex
CREATE INDEX "ProgramChapter_subjectId_idx" ON "ProgramChapter"("subjectId");

-- CreateIndex
CREATE INDEX "ProgramLesson_chapterId_idx" ON "ProgramLesson"("chapterId");

-- CreateIndex
CREATE INDEX "ProgramLesson_assessmentId_idx" ON "ProgramLesson"("assessmentId");

-- CreateIndex
CREATE INDEX "ProgramLessonCompletion_lessonId_idx" ON "ProgramLessonCompletion"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramLessonCompletion_studentUserId_lessonId_key" ON "ProgramLessonCompletion"("studentUserId", "lessonId");

-- CreateIndex
CREATE INDEX "ProgramCertificateSend_programId_idx" ON "ProgramCertificateSend"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCertificateSend_programId_studentUserId_key" ON "ProgramCertificateSend"("programId", "studentUserId");

-- AddForeignKey
ALTER TABLE "ProgramSyllabus" ADD CONSTRAINT "ProgramSyllabus_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramChapter" ADD CONSTRAINT "ProgramChapter_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramLesson" ADD CONSTRAINT "ProgramLesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "ProgramChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramLesson" ADD CONSTRAINT "ProgramLesson_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramLessonCompletion" ADD CONSTRAINT "ProgramLessonCompletion_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramLessonCompletion" ADD CONSTRAINT "ProgramLessonCompletion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ProgramLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCertificateSend" ADD CONSTRAINT "ProgramCertificateSend_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCertificateSend" ADD CONSTRAINT "ProgramCertificateSend_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCertificateSend" ADD CONSTRAINT "ProgramCertificateSend_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
