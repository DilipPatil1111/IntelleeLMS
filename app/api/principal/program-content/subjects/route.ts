import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { programId: string; name: string; code?: string };

  if (!body.programId || !body.name?.trim()) {
    return NextResponse.json({ error: "programId and name required" }, { status: 400 });
  }

  const can = await staffCanAccessProgram(session.user.id, "PRINCIPAL", body.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const code =
    body.code?.trim() ||
    `SUB-${body.programId.slice(0, 6)}-${Date.now().toString(36)}`.toUpperCase();

  try {
    const subject = await db.subject.create({
      data: {
        name: body.name.trim(),
        code,
        programId: body.programId,
        credits: 3,
      },
    });
    return NextResponse.json({ subject });
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && e.code === "P2002" ? "Subject code already exists" : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
