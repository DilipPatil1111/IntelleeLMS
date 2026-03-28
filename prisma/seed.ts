import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { normalizePgConnectionString } from "../lib/pg-connection-url";

const adapter = new PrismaPg({
  connectionString: normalizePgConnectionString(process.env.DATABASE_URL!),
});
const db = new PrismaClient({ adapter });

/** Clear all application data (keeps `_prisma_migrations`). */
async function truncatePublicTables() {
  await db.$executeRawUnsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('_prisma_migrations')
      ) LOOP
        EXECUTE format('TRUNCATE TABLE %I CASCADE', r.tablename);
      END LOOP;
    END $$;
  `);
}

async function main() {
  console.log("Truncating public tables...");
  await truncatePublicTables();

  console.log("Seeding sample data...");
  const password = await bcrypt.hash("Demo123!", 12);

  // ─── Academic year & programs ───
  const year = await db.academicYear.create({
    data: {
      name: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
      isCurrent: true,
    },
  });

  const csProgram = await db.program.create({
    data: {
      name: "Computer Science",
      code: "CS101",
      description: "Bachelor of Computer Science",
      durationYears: 4,
      durationText: "4 years",
      minAttendancePercent: 80,
      minAverageMarksPercent: 42,
      minFeePaidPercent: 55,
    },
  });

  const baProgram = await db.program.create({
    data: {
      name: "Business Administration",
      code: "BA101",
      description: "Bachelor of Business Administration",
      durationYears: 3,
      durationText: "3 years",
    },
  });

  const csBatch = await db.batch.create({
    data: {
      name: "CS Batch A - 2025",
      programId: csProgram.id,
      academicYearId: year.id,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
    },
  });

  const baBatch = await db.batch.create({
    data: {
      name: "BA Batch A - 2025",
      programId: baProgram.id,
      academicYearId: year.id,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
    },
  });

  const webDev = await db.subject.create({
    data: {
      name: "Web Development",
      code: "CS201",
      programId: csProgram.id,
      credits: 4,
      modules: {
        create: [
          { name: "HTML & CSS Fundamentals", orderIndex: 0 },
          { name: "JavaScript Essentials", orderIndex: 1 },
          { name: "React & Next.js", orderIndex: 2 },
        ],
      },
    },
    include: { modules: true },
  });

  const dbSubject = await db.subject.create({
    data: {
      name: "Database Systems",
      code: "CS202",
      programId: csProgram.id,
      credits: 3,
      modules: {
        create: [
          { name: "SQL Fundamentals", orderIndex: 0 },
          { name: "Normalization", orderIndex: 1 },
        ],
      },
    },
    include: { modules: true },
  });

  await db.subject.create({
    data: {
      name: "Marketing Principles",
      code: "BA201",
      programId: baProgram.id,
      credits: 3,
      modules: { create: [{ name: "Introduction to Marketing", orderIndex: 0 }] },
    },
  });

  const marketing = await db.subject.findFirstOrThrow({ where: { code: "BA201" } });

  await db.feeStructure.createMany({
    data: [
      { programId: csProgram.id, name: "CS Tuition 2025-26", totalAmount: 15000, term: "Annual" },
      { programId: baProgram.id, name: "BA Tuition 2025-26", totalAmount: 12000, term: "Annual" },
    ],
  });

  await db.institutionSettings.create({
    data: {
      id: 1,
      minAttendancePercent: 75,
      minAverageMarksPercent: 40,
      minFeePaidPercent: 50,
      pendingFeesAlertAmount: 2000,
    },
  });

  // ─── Principal ───
  const principal = await db.user.create({
    data: {
      email: "principal@intellee.edu",
      firstName: "Sarah",
      lastName: "Johnson",
      hashedPassword: password,
      role: "PRINCIPAL",
      phone: "+1-555-0100",
      country: "Canada",
    },
  });

  // ─── Teachers ───
  const teacherCs = await db.user.create({
    data: {
      email: "teacher.cs@intellee.edu",
      firstName: "Michael",
      lastName: "Chen",
      hashedPassword: password,
      role: "TEACHER",
      phone: "+1-555-0200",
      country: "Canada",
    },
  });

  const tpCs = await db.teacherProfile.create({
    data: {
      userId: teacherCs.id,
      employeeId: "TCH000001",
      department: "Computer Science",
      qualification: "M.Sc. CS",
      specialization: "Web Development",
      teacherPrograms: { create: [{ programId: csProgram.id }] },
    },
  });

  await db.teacherSubjectAssignment.createMany({
    data: [
      { teacherProfileId: tpCs.id, subjectId: webDev.id, batchId: csBatch.id },
      { teacherProfileId: tpCs.id, subjectId: dbSubject.id, batchId: csBatch.id },
    ],
  });

  const teacherBa = await db.user.create({
    data: {
      email: "teacher.ba@intellee.edu",
      firstName: "Priya",
      lastName: "Nair",
      hashedPassword: password,
      role: "TEACHER",
      phone: "+1-555-0201",
      country: "Canada",
    },
  });

  const tpBa = await db.teacherProfile.create({
    data: {
      userId: teacherBa.id,
      employeeId: "TCH000002",
      department: "Business",
      qualification: "MBA",
      specialization: "Marketing",
      teacherPrograms: { create: [{ programId: baProgram.id }] },
    },
  });

  await db.teacherSubjectAssignment.create({
    data: { teacherProfileId: tpBa.id, subjectId: marketing.id, batchId: baBatch.id },
  });

  // ─── Students (scenarios) ───
  // 1) Applied — PENDING application only
  const uPending = await db.user.create({
    data: {
      email: "applicant.pending@intellee.edu",
      firstName: "Alex",
      lastName: "Rivera",
      hashedPassword: password,
      role: "STUDENT",
      country: "Canada",
      visaStatus: "Study Permit",
    },
  });
  await db.studentProfile.create({
    data: {
      userId: uPending.id,
      enrollmentNo: "STU000001",
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "APPLIED",
    },
  });
  await db.programApplication.create({
    data: {
      applicantId: uPending.id,
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "PENDING",
      personalStatement: "I want to study CS and build web apps.",
    },
  });

  // 2) Application ACCEPTED, not enrolled yet
  const uAccepted = await db.user.create({
    data: {
      email: "applicant.accepted@intellee.edu",
      firstName: "Jordan",
      lastName: "Lee",
      hashedPassword: password,
      role: "STUDENT",
      country: "USA",
    },
  });
  await db.studentProfile.create({
    data: {
      userId: uAccepted.id,
      enrollmentNo: "STU000002",
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ACCEPTED",
    },
  });
  await db.programApplication.create({
    data: {
      applicantId: uAccepted.id,
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ACCEPTED",
      personalStatement: "Please consider my application.",
      reviewedById: principal.id,
      reviewedAt: new Date(),
      reviewNotes: "Strong background in math.",
    },
  });

  // 3) ENROLLED + onboarding in progress (2/4 steps)
  const uPartial = await db.user.create({
    data: {
      email: "student.onboarding@intellee.edu",
      firstName: "Sam",
      lastName: "Okonkwo",
      hashedPassword: password,
      role: "STUDENT",
      country: "Nigeria",
    },
  });
  await db.studentProfile.create({
    data: {
      userId: uPartial.id,
      enrollmentNo: "STU000003",
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ENROLLED",
      enrollmentDate: new Date(),
    },
  });
  await db.programApplication.create({
    data: {
      applicantId: uPartial.id,
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ENROLLED",
      reviewedById: principal.id,
      reviewedAt: new Date(),
    },
  });
  await db.studentOnboarding.create({
    data: {
      userId: uPartial.id,
      contractAcknowledgedAt: new Date(),
      governmentIdsUploadedAt: new Date(),
      contractDocumentUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    },
  });

  // 4) ENROLLED + onboarding done, awaiting principal confirmation
  const uWaiting = await db.user.create({
    data: {
      email: "student.awaiting@intellee.edu",
      firstName: "Taylor",
      lastName: "Morgan",
      hashedPassword: password,
      role: "STUDENT",
      country: "Canada",
    },
  });
  await db.studentProfile.create({
    data: {
      userId: uWaiting.id,
      enrollmentNo: "STU000004",
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ENROLLED",
      enrollmentDate: new Date(),
    },
  });
  await db.programApplication.create({
    data: {
      applicantId: uWaiting.id,
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ENROLLED",
      reviewedById: principal.id,
      reviewedAt: new Date(),
    },
  });
  await db.studentOnboarding.create({
    data: {
      userId: uWaiting.id,
      contractAcknowledgedAt: new Date(),
      governmentIdsUploadedAt: new Date(),
      feeProofUploadedAt: new Date(),
      preAdmissionCompletedAt: new Date(),
    },
  });

  // 5) ENROLLED + fully onboarded (principal confirmed) — full course access
  const uFull = await db.user.create({
    data: {
      email: "student.enrolled@intellee.edu",
      firstName: "Alice",
      lastName: "Smith",
      hashedPassword: password,
      role: "STUDENT",
      country: "Canada",
    },
  });
  await db.studentProfile.create({
    data: {
      userId: uFull.id,
      enrollmentNo: "STU000005",
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ENROLLED",
      enrollmentDate: new Date(),
    },
  });
  await db.programApplication.create({
    data: {
      applicantId: uFull.id,
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ENROLLED",
      reviewedById: principal.id,
      reviewedAt: new Date(),
    },
  });
  await db.studentOnboarding.create({
    data: {
      userId: uFull.id,
      contractAcknowledgedAt: new Date(),
      governmentIdsUploadedAt: new Date(),
      feeProofUploadedAt: new Date(),
      preAdmissionCompletedAt: new Date(),
      principalConfirmedAt: new Date(),
    },
  });

  // 6) Legacy-style ENROLLED: no StudentOnboarding row (full nav without checklist)
  const uLegacy = await db.user.create({
    data: {
      email: "legacy.student@intellee.edu",
      firstName: "Bob",
      lastName: "Williams",
      hashedPassword: password,
      role: "STUDENT",
      country: "Canada",
    },
  });
  await db.studentProfile.create({
    data: {
      userId: uLegacy.id,
      enrollmentNo: "STU000006",
      programId: csProgram.id,
      batchId: csBatch.id,
      status: "ENROLLED",
      enrollmentDate: new Date(),
    },
  });

  // 7) BA program student
  const uBa = await db.user.create({
    data: {
      email: "ba.student@intellee.edu",
      firstName: "Chris",
      lastName: "Patel",
      hashedPassword: password,
      role: "STUDENT",
      country: "India",
    },
  });
  await db.studentProfile.create({
    data: {
      userId: uBa.id,
      enrollmentNo: "STU000007",
      programId: baProgram.id,
      batchId: baBatch.id,
      status: "ENROLLED",
      enrollmentDate: new Date(),
    },
  });

  // ─── Holidays ───
  await db.holiday.createMany({
    data: [
      { name: "New Year's Day", date: new Date("2026-01-01"), type: "PUBLIC", academicYearId: year.id },
      { name: "Spring Break", date: new Date("2026-03-16"), type: "COLLEGE", academicYearId: year.id },
      { name: "Canada Day", date: new Date("2026-07-01"), type: "PUBLIC", academicYearId: year.id },
    ],
  });

  // ─── Published assessment (CS) ───
  const webMod = webDev.modules[0];
  await db.assessment.create({
    data: {
      title: "Web Development Midterm Quiz",
      description: "HTML, CSS, JavaScript basics",
      type: "QUIZ",
      status: "PUBLISHED",
      subjectId: webDev.id,
      batchId: csBatch.id,
      createdById: teacherCs.id,
      moduleId: webMod?.id,
      totalMarks: 20,
      passingMarks: 10,
      duration: 30,
      scheduledOpenAt: new Date("2026-03-01"),
      scheduledCloseAt: new Date("2026-06-30"),
      assessmentDate: new Date("2026-03-15"),
      instructions: "Answer all questions.",
      questions: {
        create: [
          {
            type: "MCQ",
            questionText: "What does HTML stand for?",
            marks: 2,
            orderIndex: 0,
            options: {
              create: [
                { optionText: "Hyper Text Markup Language", isCorrect: true, orderIndex: 0 },
                { optionText: "High Tech Modern Language", isCorrect: false, orderIndex: 1 },
              ],
            },
          },
          {
            type: "SHORT",
            questionText: "What is the difference between block and inline elements?",
            marks: 5,
            orderIndex: 1,
            maxLength: 500,
          },
        ],
      },
    },
  });

  // ─── Email templates ───
  await db.emailTemplate.createMany({
    data: [
      {
        name: "application_received",
        subject: "Application received — {{programName}}",
        body: "Hi {{firstName}}, we received your application to {{programName}}.",
      },
      {
        name: "application_accepted",
        subject: "Accepted — {{programName}}",
        body: "Dear {{firstName}}, congratulations on your acceptance to {{programName}}.",
      },
      {
        name: "enrollment_confirmed",
        subject: "Enrollment confirmed — {{programName}}",
        body: "Dear {{firstName}}, you are enrolled in {{programName}}. Profile: {{profileLink}}",
      },
    ],
  });

  // ─── Policies ───
  await db.policy.createMany({
    data: [
      {
        title: "College Code of Conduct",
        policyType: "COLLEGE",
        description: "General behaviour and academic integrity.",
        isActive: true,
      },
      {
        title: "CS Program Handbook",
        policyType: "PROGRAM",
        description: "Computer Science program rules.",
        isActive: true,
      },
    ],
  });

  // ─── Sample notification for principal ───
  await db.notification.create({
    data: {
      userId: principal.id,
      type: "GENERAL",
      title: "Welcome to Intellee (sample)",
      message: "This is a seeded notification. Open Applications to review pending applicants.",
      link: "/principal/applications",
    },
  });

  console.log("\n✅ Database cleared and reseeded.\n");
  console.log("═══ Login password for ALL demo users: Demo123! ═══\n");
  console.log("Principal:  principal@intellee.edu");
  console.log("Teachers:   teacher.cs@intellee.edu");
  console.log("            teacher.ba@intellee.edu");
  console.log("\nStudents (scenarios):");
  console.log("  Applied (PENDING app):   applicant.pending@intellee.edu");
  console.log("  Accepted (pre-enroll): applicant.accepted@intellee.edu");
  console.log("  Onboarding 2/4 steps:  student.onboarding@intellee.edu");
  console.log("  Onboarding done, wait: student.awaiting@intellee.edu  → use Principal → Onboarding review");
  console.log("  Fully enrolled:        student.enrolled@intellee.edu");
  console.log("  Legacy (no checklist):   legacy.student@intellee.edu");
  console.log("  BA program:              ba.student@intellee.edu");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
