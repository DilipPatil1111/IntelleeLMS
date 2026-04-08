import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const template = await db.certificateTemplate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { certificatesIssued: true } },
    },
  });

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const template = await db.certificateTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.backgroundUrl !== undefined && { backgroundUrl: body.backgroundUrl || null }),
      ...(body.backgroundFileName !== undefined && { backgroundFileName: body.backgroundFileName || null }),
      ...(body.orientation !== undefined && { orientation: body.orientation }),
      ...(body.pageSize !== undefined && { pageSize: body.pageSize }),
      ...(body.fieldsJson !== undefined && {
        fieldsJson: typeof body.fieldsJson === "string" ? body.fieldsJson : JSON.stringify(body.fieldsJson),
      }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({ template });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.certificateTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
