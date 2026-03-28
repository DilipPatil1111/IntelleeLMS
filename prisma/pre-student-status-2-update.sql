UPDATE "StudentProfile" SET status = 'APPLIED'::"StudentStatus" WHERE status::text = 'APPLICANT';
UPDATE "StudentProfile" SET status = 'ENROLLED'::"StudentStatus" WHERE status::text = 'ACTIVE';
UPDATE "StudentProfile" SET status = 'CANCELLED'::"StudentStatus" WHERE status::text IN ('INACTIVE', 'TRANSFERRED');
UPDATE "StudentProfile" SET status = 'SUSPENDED'::"StudentStatus" WHERE status::text = 'EXPELLED';
