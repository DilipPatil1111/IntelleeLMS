import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  await db.sharedDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
