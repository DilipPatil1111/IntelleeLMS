import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const taxonomySelect = {
  programDomain: { select: { id: true, name: true, customerId: true } },
  programCategory: { select: { id: true, name: true, customerId: true } },
  programType: { select: { id: true, name: true, customerId: true } },
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const programs = await db.program.findMany({
    include: {
      ...taxonomySelect,
      _count: { select: { subjects: true, batches: true, students: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ programs });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const durationText = typeof body.durationText === "string" ? body.durationText.trim() : "";
  const optId = (v: unknown) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;

  const program = await db.program.create({
    data: {
      name: body.name,
      code: body.code,
      description: body.description || null,
      durationYears: typeof body.durationYears === "number" ? body.durationYears : 1,
      durationText: durationText || null,
      programDomainId: optId(body.programDomainId),
      programCategoryId: optId(body.programCategoryId),
      programTypeId: optId(body.programTypeId),
    },
    include: taxonomySelect,
  });

  return NextResponse.json({ program });
}
