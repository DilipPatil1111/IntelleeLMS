import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");

  const where = subjectId ? { subjectId } : {};
  const modules = await db.module.findMany({
    where,
    include: {
      subject: { select: { name: true, code: true } },
      topics: { orderBy: { orderIndex: "asc" }, include: { _count: { select: { contents: true } } } },
      _count: { select: { topics: true, assessments: true } },
    },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json({ modules });
}

export async function POST(req: Request) {
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const { name, description, subjectId, orderIndex, requiresCompletion, prerequisiteModuleId } = body;

  if (!name || !subjectId) return NextResponse.json({ error: "Name and subject are required" }, { status: 400 });

  const mod = await db.module.create({
    data: {
      name,
      description: description || null,
      subjectId,
      orderIndex: orderIndex || 0,
      requiresCompletion: requiresCompletion || false,
      prerequisiteModuleId: prerequisiteModuleId || null,
    },
  });

  return NextResponse.json({ module: mod });
}
