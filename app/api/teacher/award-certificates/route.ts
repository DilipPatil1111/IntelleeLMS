import { auth } from "@/lib/auth";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { listStudentsForAwardCertificates, staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });

  const can = await staffCanAccessProgram(session.user.id, "TEACHER", programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const students = await listStudentsForAwardCertificates(programId);
  return NextResponse.json({ students });
}
