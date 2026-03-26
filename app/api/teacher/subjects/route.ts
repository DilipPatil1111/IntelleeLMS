import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subjects = await db.subject.findMany({
    include: { program: true, modules: { orderBy: { orderIndex: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ subjects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const subject = await db.subject.create({
    data: {
      name: body.name,
      code: body.code,
      description: body.description || null,
      programId: body.programId,
      credits: body.credits || 3,
    },
  });

  return NextResponse.json({ subject });
}
