import { auth } from "@/lib/auth";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { getOrCreateProgramSyllabus, fetchProgramContentTree, staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ programId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { programId } = await params;
  const ok = await staffCanAccessProgram(session.user.id, "PRINCIPAL", programId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await getOrCreateProgramSyllabus(programId);
  const program = await fetchProgramContentTree(programId);
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ program });
}
