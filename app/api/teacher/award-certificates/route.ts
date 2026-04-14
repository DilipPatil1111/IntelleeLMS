import { auth } from "@/lib/auth";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { listStudentsForAwardCertificates, listBatchesForProgram, staffCanAccessProgram, bulkMarkProgramComplete } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });

  const can = await staffCanAccessProgram(session.user.id, session, programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const batchId = searchParams.get("batchId") || undefined;
  const batches = await listBatchesForProgram(programId);
  const students = await listStudentsForAwardCertificates(programId, batchId);
  return NextResponse.json({ students, batches });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { programId, studentUserIds } = body;
  if (!programId || !Array.isArray(studentUserIds) || studentUserIds.length === 0)
    return NextResponse.json({ error: "programId and studentUserIds[] required" }, { status: 400 });

  const can = await staffCanAccessProgram(session.user.id, session, programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await bulkMarkProgramComplete(programId, studentUserIds);
  return NextResponse.json({ ok: true, ...result });
}
