DO $$ BEGIN
  ALTER TYPE "StudentStatus" ADD VALUE 'APPLIED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
