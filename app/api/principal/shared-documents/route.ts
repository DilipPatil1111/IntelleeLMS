import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const documents = await db.sharedDocument.findMany({
    include: { sharedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
