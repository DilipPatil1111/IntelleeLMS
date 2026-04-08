import { auth } from "@/lib/auth";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { sendProgramContentCertificateEmail } from "@/lib/program-content-certificate-email";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { programId: string; studentUserIds: string[] };
  if (!body.programId || !Array.isArray(body.studentUserIds) || body.studentUserIds.length === 0) {
    return NextResponse.json({ error: "programId and studentUserIds required" }, { status: 400 });
  }

  const can = await staffCanAccessProgram(session.user.id, session, body.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const results: { studentUserId: string; ok: boolean; error?: string }[] = [];

  for (const studentUserId of body.studentUserIds) {
    const r = await sendProgramContentCertificateEmail({
      programId: body.programId,
      studentUserId,
      sentByUserId: session.user.id,
    });
    if (r.ok) {
      results.push({ studentUserId, ok: true });
    } else {
      results.push({ studentUserId, ok: false, error: r.error });
    }
  }

  return NextResponse.json({ results });
}
