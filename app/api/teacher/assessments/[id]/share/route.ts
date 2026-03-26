import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { sharedWithEmail } = body;

  const targetUser = await db.user.findUnique({ where: { email: sharedWithEmail } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const share = await db.assessmentShare.upsert({
    where: { assessmentId_sharedWithId: { assessmentId: id, sharedWithId: targetUser.id } },
    create: {
      assessmentId: id,
      sharedWithId: targetUser.id,
      sharedById: session.user.id,
    },
    update: {},
  });

  return NextResponse.json({ success: true, share });
}
