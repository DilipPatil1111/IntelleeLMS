-- Legacy assessments only had createdAt; expose a consistent "assessment date" everywhere.
UPDATE "Assessment" SET "assessmentDate" = "createdAt" WHERE "assessmentDate" IS NULL;
