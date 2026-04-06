/**
 * One-time backfill: populate ProgramEnrollment from existing StudentProfile
 * and ProgramApplication records with ENROLLED status.
 *
 * Run: npx tsx scripts/backfill-program-enrollments.ts
 */

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  // 1. Backfill from StudentProfile where programId is set and status is ENROLLED/COMPLETED/GRADUATED
  const profiles = await db.studentProfile.findMany({
    where: {
      programId: { not: null },
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    select: {
      userId: true,
      programId: true,
      batchId: true,
      status: true,
      enrollmentNo: true,
      enrollmentDate: true,
    },
  });

  let created = 0;
  let skipped = 0;

  for (const p of profiles) {
    if (!p.programId) continue;
    try {
      await db.programEnrollment.upsert({
        where: { userId_programId: { userId: p.userId, programId: p.programId } },
        update: {},
        create: {
          userId: p.userId,
          programId: p.programId,
          batchId: p.batchId,
          status: p.status,
          enrollmentNo: p.enrollmentNo,
          enrollmentDate: p.enrollmentDate,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  console.log(`StudentProfile backfill: ${created} created, ${skipped} skipped`);

  // 2. Backfill from ProgramApplication where status is ENROLLED
  //    (covers multi-program cases where StudentProfile.programId was overwritten)
  const applications = await db.programApplication.findMany({
    where: { status: "ENROLLED" },
    include: {
      applicant: {
        include: {
          studentProfile: {
            select: { enrollmentNo: true, enrollmentDate: true, batchId: true },
          },
        },
      },
    },
  });

  let appCreated = 0;
  let appSkipped = 0;

  for (const app of applications) {
    try {
      await db.programEnrollment.upsert({
        where: { userId_programId: { userId: app.applicantId, programId: app.programId } },
        update: {},
        create: {
          userId: app.applicantId,
          programId: app.programId,
          batchId: app.batchId ?? app.applicant?.studentProfile?.batchId ?? null,
          status: "ENROLLED",
          enrollmentNo: app.applicant?.studentProfile?.enrollmentNo ?? null,
          enrollmentDate: app.applicant?.studentProfile?.enrollmentDate ?? new Date(),
        },
      });
      appCreated++;
    } catch {
      appSkipped++;
    }
  }

  console.log(`ProgramApplication backfill: ${appCreated} created, ${appSkipped} skipped`);
  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
