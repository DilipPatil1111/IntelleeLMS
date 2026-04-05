import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const customerId =
    body.customerId === null || body.customerId === ""
      ? null
      : typeof body.customerId === "string"
        ? body.customerId.trim()
        : undefined;

  try {
    const category = await db.programCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(customerId !== undefined && { customerId }),
        ...(typeof body.sortOrder === "number" && { sortOrder: body.sortOrder }),
        ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
      },
    });
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "Update failed (check customerId uniqueness)." }, { status: 409 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [pCount, aCount] = await Promise.all([
    db.program.count({ where: { programCategoryId: id } }),
    db.programApplication.count({ where: { programCategoryId: id } }),
  ]);
  if (pCount > 0 || aCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete: in use by programs or applications. Remove links first." },
      { status: 409 },
    );
  }

  await db.programCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
