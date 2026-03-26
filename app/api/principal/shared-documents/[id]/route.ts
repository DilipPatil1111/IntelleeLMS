import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const doc = await db.sharedDocument.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description || null,
      type: body.type || "DOCUMENT",
      fileUrl: body.fileUrl || null,
      fileName: body.fileName || null,
      category: body.category || null,
      isPublic: body.isPublic ?? true,
      audienceRoles: Array.isArray(body.audienceRoles) ? body.audienceRoles : undefined,
    },
  });

  return NextResponse.json({ document: doc });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.sharedDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
