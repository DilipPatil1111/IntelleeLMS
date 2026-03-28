import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FeedbackCategory } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

async function teacherHasAccessToStudent(teacherUserId: string, studentUserId: string): Promise<boolean> {
  const profile = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    include: { subjectAssignments: true },
  });
  const batchIds = [...new Set(profile?.subjectAssignments.map((a) => a.batchId) ?? [])];
  if (batchIds.length === 0) return false;
  const sp = await db.studentProfile.findUnique({ where: { userId: studentUserId } });
  return !!(sp?.batchId && batchIds.includes(sp.batchId));
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.feedback.findMany({
    where: { authorId: session.user.id },
    include: {
      aboutStudent: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ feedback: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "TEACHER") {
    return NextResponse.json({ error: "Teachers only" }, { status: 403 });
  }

  const body = await req.json();
  const category = body.category as FeedbackCategory;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : null;
  const aboutStudentId = typeof body.aboutStudentId === "string" ? body.aboutStudentId : null;

  const allowed: FeedbackCategory[] = ["PROGRAM_CONTENT", "TEACHING", "OTHER", "STUDENT_CONCERN"];
  if (!allowed.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Please enter at least 10 characters." }, { status: 400 });
  }
  if (category === "STUDENT_CONCERN" && !aboutStudentId) {
    return NextResponse.json({ error: "Select a student for student concern feedback." }, { status: 400 });
  }
  if (aboutStudentId && !(await teacherHasAccessToStudent(session.user.id, aboutStudentId))) {
    return NextResponse.json(
      { error: "You can only submit student feedback for learners in your assigned batches." },
      { status: 403 }
    );
  }

  const fb = await db.feedback.create({
    data: {
      authorId: session.user.id,
      authorRole: "TEACHER",
      category,
      title: title || null,
      message,
      aboutStudentId: aboutStudentId || null,
    },
  });

  return NextResponse.json({ id: fb.id });
}
