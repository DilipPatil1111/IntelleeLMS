import { auth } from "@/lib/auth";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { getOrCreateInstitutionSettings } from "@/lib/institution-settings";
import { isProgramContentCompleteForStudent, staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { programId: string; studentUserId: string };
  if (!body.programId || !body.studentUserId) {
    return NextResponse.json({ error: "programId and studentUserId required" }, { status: 400 });
  }

  const can = await staffCanAccessProgram(session.user.id, session, body.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eligible = await isProgramContentCompleteForStudent(body.studentUserId, body.programId);
  if (!eligible) {
    return NextResponse.json({ error: "Student is not eligible yet" }, { status: 400 });
  }

  const settings = await getOrCreateInstitutionSettings();
  if (!settings.certificateTemplateUrl) {
    return NextResponse.json({ error: "No certificate template uploaded in Settings" }, { status: 400 });
  }

  try {
    const response = await fetch(settings.certificateTemplateUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Could not load certificate template" }, { status: 502 });
    }
    const buf = new Uint8Array(await response.arrayBuffer());
    const fname = settings.certificateTemplateFileName || "certificate-preview.pdf";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fname)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Template fetch failed" }, { status: 502 });
  }
}
