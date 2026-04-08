import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { programId: true, batchId: true },
  });

  if (!profile?.programId) return NextResponse.json({ progress: [] });

  const subjects = await db.subject.findMany({
    where: { programId: profile.programId },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          topics: {
            orderBy: { orderIndex: "asc" },
            include: {
              _count: { select: { contents: true } },
              progress: { where: { studentId: session.user.id } },
            },
          },
          assessments: {
            where: { batchId: profile.batchId || undefined },
            include: { attempts: { where: { studentId: session.user.id } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const progress = subjects.map((subject) => ({
    subjectId: subject.id,
    subjectName: subject.name,
    modules: subject.modules.map((mod) => {
      const totalTopics = mod.topics.length;
      const completedTopics = mod.topics.filter((t) => t.progress.some((p) => p.isCompleted)).length;
      const totalAssessments = mod.assessments.length;
      const completedAssessments = mod.assessments.filter((a) =>
        a.attempts.some((att) => att.status === "SUBMITTED" || att.status === "GRADED")
      ).length;

      return {
        moduleId: mod.id,
        moduleName: mod.name,
        requiresCompletion: mod.requiresCompletion,
        totalTopics,
        completedTopics,
        totalAssessments,
        completedAssessments,
        percentComplete: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
        isLocked: false,
      };
    }),
  }));

  return NextResponse.json({ progress });
}

export async function POST(req: Request) {
  const gate2 = await requireStudentPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const { topicId } = body;

  if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

  await db.topicProgress.upsert({
    where: { topicId_studentId: { topicId, studentId: session.user.id } },
    update: { isCompleted: true, completedAt: new Date() },
    create: { topicId, studentId: session.user.id, isCompleted: true, completedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
