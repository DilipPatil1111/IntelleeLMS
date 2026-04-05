import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/teacher/program-content/subjects/[subjectId]/delete-request
 * Teacher requests Principal approval to delete a subject from a published program.
 * Creates an Announcement visible to Principals with the request details.
 */
export async function POST(req: Request, { params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { programId?: string; subjectName?: string };

  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    include: { program: true },
  });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { firstName: true, lastName: true, email: true } });
  const teacherName = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "A teacher";
  const subjectLabel = body.subjectName || `${subject.code}: ${subject.name}`;
  const programName = subject.program?.name || "unknown program";

  // Create an announcement so Principals see the request in their portal
  try {
    await db.announcement.create({
      data: {
        title: `[Approval Required] Subject deletion request — ${programName}`,
        body: `${teacherName} has requested deletion of subject "${subjectLabel}" from the published program "${programName}".\n\nTo approve: go to Program Content → ${programName} → unpublish the program, delete the subject, then re-publish if appropriate.`,
        createdById: session.user.id,
        recipientAll: false,
        sendEmail: false,
        allPrograms: false,
        allBatches: false,
        sendToStudents: false,
        sendToTeachers: false,
        allTeachers: false,
      },
    });
  } catch {
    // Announcement creation is best-effort
  }

  return NextResponse.json({ ok: true, message: "Approval request sent to Principal." });
}
