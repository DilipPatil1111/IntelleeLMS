-- ── GradeBand ────────────────────────────────────────────────────────────────
-- Grade bands define how percentage marks map to letter grades (e.g. A, B, F).
-- Configured by the principal in Settings; used when generating transcripts.

CREATE TABLE IF NOT EXISTS "GradeBand" (
    "id"         TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "minPercent" DOUBLE PRECISION NOT NULL,
    "maxPercent" DOUBLE PRECISION NOT NULL,
    "gradePoint" DOUBLE PRECISION,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeBand_pkey" PRIMARY KEY ("id")
);

-- ── TranscriptStatus enum ─────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE "TranscriptStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Transcript ────────────────────────────────────────────────────────────────
-- A student transcript created by a teacher / principal.
-- Status is DRAFT until explicitly published; once published the student can
-- view it under Reports → Final Transcript Report.

CREATE TABLE IF NOT EXISTS "Transcript" (
    "id"           TEXT NOT NULL,
    "studentId"    TEXT NOT NULL,
    "programId"    TEXT NOT NULL,
    "batchId"      TEXT,
    "status"       "TranscriptStatus" NOT NULL DEFAULT 'DRAFT',
    "totalHours"   DOUBLE PRECISION,
    "startDate"    TIMESTAMP(3),
    "endDate"      TIMESTAMP(3),
    "standing"     TEXT,
    "credential"   TEXT,
    "overallAvgPct" DOUBLE PRECISION,
    "remarks"      TEXT,
    "createdById"  TEXT NOT NULL,
    "publishedAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- ── TranscriptSubjectRow ──────────────────────────────────────────────────────
-- One row per subject/course in a transcript, holding marks and grade.

CREATE TABLE IF NOT EXISTS "TranscriptSubjectRow" (
    "id"             TEXT NOT NULL,
    "transcriptId"   TEXT NOT NULL,
    "subjectCode"    TEXT,
    "subjectName"    TEXT NOT NULL,
    "description"    TEXT,
    "autoMarksPct"   DOUBLE PRECISION,
    "manualMarksPct" DOUBLE PRECISION,
    "finalMarksPct"  DOUBLE PRECISION,
    "grade"          TEXT,
    "sortOrder"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptSubjectRow_pkey" PRIMARY KEY ("id")
);

-- ── Foreign keys ──────────────────────────────────────────────────────────────

ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transcript"
    ADD CONSTRAINT "Transcript_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TranscriptSubjectRow"
    ADD CONSTRAINT "TranscriptSubjectRow_transcriptId_fkey"
    FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "Transcript_studentId_idx" ON "Transcript"("studentId");
CREATE INDEX IF NOT EXISTS "Transcript_status_idx"    ON "Transcript"("status");
CREATE INDEX IF NOT EXISTS "Transcript_programId_idx" ON "Transcript"("programId");

CREATE INDEX IF NOT EXISTS "TranscriptSubjectRow_transcriptId_idx"
    ON "TranscriptSubjectRow"("transcriptId");
