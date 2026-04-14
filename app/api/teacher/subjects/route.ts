import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const subjects = await db.subject.findMany({
    include: { program: true, modules: { orderBy: { orderIndex: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ subjects });
}

export async function POST(req: Request) {
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

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
