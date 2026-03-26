import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status } = body;

  const validStatuses = [
    "ACTIVE",
    "INACTIVE",
    "SUSPENDED",
    "EXPELLED",
    "TRANSFERRED",
    "GRADUATED",
    "CANCELLED",
  ];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await db.studentProfile.update({
    where: { userId: id },
    data: { status },
  });

  const isActive = !["SUSPENDED", "EXPELLED", "TRANSFERRED", "INACTIVE", "CANCELLED"].includes(status);
  await db.user.update({
    where: { id },
    data: { isActive },
  });

  return NextResponse.json({ success: true });
}
