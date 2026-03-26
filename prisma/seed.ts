import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Academic Year
  const year = await db.academicYear.create({
    data: { name: "2025-2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30"), isCurrent: true },
  });

  // Programs
  const csProgram = await db.program.create({
    data: { name: "Computer Science", code: "CS101", description: "Bachelor of Computer Science", durationYears: 4 },
  });
  const baProgram = await db.program.create({
    data: { name: "Business Administration", code: "BA101", description: "Bachelor of Business Administration", durationYears: 3 },
  });

  // Batches
  const csBatch = await db.batch.create({
    data: { name: "CS Batch A - 2025", programId: csProgram.id, academicYearId: year.id, startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30") },
  });
  const baBatch = await db.batch.create({
    data: { name: "BA Batch A - 2025", programId: baProgram.id, academicYearId: year.id, startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30") },
  });

  // Subjects
  const webDev = await db.subject.create({
    data: { name: "Web Development", code: "CS201", programId: csProgram.id, credits: 4, modules: { create: [
      { name: "HTML & CSS Fundamentals", orderIndex: 0 },
      { name: "JavaScript Essentials", orderIndex: 1 },
      { name: "React & Next.js", orderIndex: 2 },
      { name: "Backend with Node.js", orderIndex: 3 },
    ] } },
  });
  const dbSubject = await db.subject.create({
    data: { name: "Database Systems", code: "CS202", programId: csProgram.id, credits: 3, modules: { create: [
      { name: "SQL Fundamentals", orderIndex: 0 },
      { name: "Normalization", orderIndex: 1 },
      { name: "NoSQL Databases", orderIndex: 2 },
    ] } },
  });
  const marketing = await db.subject.create({
    data: { name: "Marketing Principles", code: "BA201", programId: baProgram.id, credits: 3 },
  });

  // Fee structures
  await db.feeStructure.create({ data: { programId: csProgram.id, name: "CS Tuition Fee 2025-26", totalAmount: 15000, term: "Annual" } });
  await db.feeStructure.create({ data: { programId: baProgram.id, name: "BA Tuition Fee 2025-26", totalAmount: 12000, term: "Annual" } });

  // Principal
  const principalPw = await bcrypt.hash("principal123", 12);
  await db.user.create({
    data: {
      email: "principal@intellee.edu",
      firstName: "Sarah",
      lastName: "Johnson",
      hashedPassword: principalPw,
      role: "PRINCIPAL",
      phone: "+1-555-0100",
      country: "Canada",
    },
  });

  // Teacher
  const teacherPw = await bcrypt.hash("teacher123", 12);
  const teacher = await db.user.create({
    data: {
      email: "teacher@intellee.edu",
      firstName: "Michael",
      lastName: "Chen",
      hashedPassword: teacherPw,
      role: "TEACHER",
      phone: "+1-555-0200",
      country: "Canada",
    },
  });
  const teacherProfile = await db.teacherProfile.create({
    data: { userId: teacher.id, employeeId: "TCH000001", department: "Computer Science", qualification: "M.Sc. Computer Science", specialization: "Web Development" },
  });
  await db.teacherSubjectAssignment.createMany({
    data: [
      { teacherProfileId: teacherProfile.id, subjectId: webDev.id, batchId: csBatch.id },
      { teacherProfileId: teacherProfile.id, subjectId: dbSubject.id, batchId: csBatch.id },
    ],
  });

  // Students
  const studentPw = await bcrypt.hash("student123", 12);
  const studentNames = [
    { first: "Alice", last: "Smith" },
    { first: "Bob", last: "Williams" },
    { first: "Charlie", last: "Brown" },
    { first: "Diana", last: "Garcia" },
    { first: "Ethan", last: "Taylor" },
  ];

  for (let i = 0; i < studentNames.length; i++) {
    const s = await db.user.create({
      data: {
        email: `${studentNames[i].first.toLowerCase()}@student.intellee.edu`,
        firstName: studentNames[i].first,
        lastName: studentNames[i].last,
        hashedPassword: studentPw,
        role: "STUDENT",
        phone: `+1-555-0${300 + i}`,
        country: "Canada",
        visaStatus: i % 2 === 0 ? "Citizen" : "Study Permit",
      },
    });
    await db.studentProfile.create({
      data: {
        userId: s.id,
        enrollmentNo: `STU${String(i + 1).padStart(6, "0")}`,
        programId: csProgram.id,
        batchId: csBatch.id,
      },
    });
  }

  // Holidays
  await db.holiday.createMany({
    data: [
      { name: "New Year's Day", date: new Date("2026-01-01"), type: "PUBLIC" },
      { name: "Family Day", date: new Date("2026-02-16"), type: "PUBLIC" },
      { name: "Good Friday", date: new Date("2026-04-03"), type: "PUBLIC" },
      { name: "Victoria Day", date: new Date("2026-05-18"), type: "PUBLIC" },
      { name: "Canada Day", date: new Date("2026-07-01"), type: "PUBLIC" },
      { name: "Winter Break Start", date: new Date("2025-12-22"), type: "COLLEGE" },
      { name: "Spring Break", date: new Date("2026-03-16"), type: "COLLEGE" },
    ],
  });

  // Sample Assessment
  await db.assessment.create({
    data: {
      title: "Web Development Midterm Quiz",
      description: "Covers HTML, CSS, and JavaScript fundamentals",
      type: "QUIZ",
      status: "PUBLISHED",
      subjectId: webDev.id,
      batchId: csBatch.id,
      createdById: teacher.id,
      totalMarks: 20,
      passingMarks: 10,
      duration: 30,
      scheduledOpenAt: new Date("2026-03-01"),
      scheduledCloseAt: new Date("2026-04-01"),
      assessmentDate: new Date("2026-03-15"),
      instructions: "Answer all questions. MCQs are auto-graded. Short answers will be reviewed by the instructor.",
      questions: {
        create: [
          {
            type: "MCQ", questionText: "What does HTML stand for?", marks: 2, orderIndex: 0,
            options: { create: [
              { optionText: "Hyper Text Markup Language", isCorrect: true, orderIndex: 0 },
              { optionText: "High Tech Modern Language", isCorrect: false, orderIndex: 1 },
              { optionText: "Hyper Transfer Markup Language", isCorrect: false, orderIndex: 2 },
              { optionText: "Home Tool Markup Language", isCorrect: false, orderIndex: 3 },
            ] },
          },
          {
            type: "MCQ", questionText: "Which CSS property is used to change the text color?", marks: 2, orderIndex: 1,
            options: { create: [
              { optionText: "font-color", isCorrect: false, orderIndex: 0 },
              { optionText: "text-color", isCorrect: false, orderIndex: 1 },
              { optionText: "color", isCorrect: true, orderIndex: 2 },
              { optionText: "foreground", isCorrect: false, orderIndex: 3 },
            ] },
          },
          {
            type: "MCQ", questionText: "What is the correct way to declare a JavaScript variable?", marks: 2, orderIndex: 2,
            options: { create: [
              { optionText: "variable x = 5", isCorrect: false, orderIndex: 0 },
              { optionText: "let x = 5", isCorrect: true, orderIndex: 1 },
              { optionText: "v x = 5", isCorrect: false, orderIndex: 2 },
              { optionText: "dim x = 5", isCorrect: false, orderIndex: 3 },
            ] },
          },
          {
            type: "SHORT", questionText: "Explain the difference between 'let' and 'const' in JavaScript.", marks: 5, orderIndex: 3,
            correctAnswer: "let allows reassignment while const creates a read-only reference that cannot be reassigned.",
            maxLength: 500,
          },
          {
            type: "PARAGRAPH", questionText: "Describe the CSS Box Model and explain each of its components.", marks: 9, orderIndex: 4,
            correctAnswer: "The CSS Box Model consists of: Content (the actual element), Padding (space inside the border), Border (edge around padding), and Margin (space outside the border). These layers work together to define the total space an element occupies.",
            maxLength: 2000,
          },
        ],
      },
    },
  });

  console.log("Seed completed successfully!");
  console.log("\nTest accounts:");
  console.log("  Principal: principal@intellee.edu / principal123");
  console.log("  Teacher:   teacher@intellee.edu / teacher123");
  console.log("  Student:   alice@student.intellee.edu / student123");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
