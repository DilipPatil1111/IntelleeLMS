import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FeedbackCategory } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

const STUDENT_CATEGORIES: FeedbackCategory[] = ["PROGRAM_CONTENT", "TEACHING", "OTHER"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.feedback.findMany({
    where: { authorId: session.user.id },
    include: {
      aboutTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
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
  if (!user || user.role !== "STUDENT") {
    return NextResponse.json({ error: "Students only" }, { status: 403 });
  }

  const body = await req.json();
  const category = body.category as FeedbackCategory;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : null;
  const aboutTeacherId = typeof body.aboutTeacherId === "string" ? body.aboutTeacherId : null;

  if (!STUDENT_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category for students." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Please enter at least 10 characters." }, { status: 400 });
  }

  const fb = await db.feedback.create({
    data: {
      authorId: session.user.id,
      authorRole: "STUDENT",
      category,
      title: title || null,
      message,
      aboutTeacherId: aboutTeacherId || null,
    },
  });

  return NextResponse.json({ id: fb.id });
}
