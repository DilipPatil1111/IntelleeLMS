import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templates = await db.certificateTemplate.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { certificatesIssued: true } },
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, backgroundUrl, backgroundFileName, orientation, pageSize, fieldsJson } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  const template = await db.certificateTemplate.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      backgroundUrl: backgroundUrl || null,
      backgroundFileName: backgroundFileName || null,
      orientation: orientation || "LANDSCAPE",
      pageSize: pageSize || "A4",
      fieldsJson: typeof fieldsJson === "string" ? fieldsJson : JSON.stringify(fieldsJson ?? []),
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
