import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const documents = await db.sharedDocument.findMany({
    include: { sharedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const doc = await db.sharedDocument.create({
    data: {
      title: body.title,
      description: body.description || null,
      type: body.type || "DOCUMENT",
      fileUrl: body.fileUrl || null,
      fileName: body.fileName || null,
      category: body.category || null,
      sharedById: session.user.id,
      isPublic: body.isPublic ?? true,
      audienceRoles: Array.isArray(body.audienceRoles) ? body.audienceRoles : [],
    },
  });

  return NextResponse.json({ document: doc });
}
