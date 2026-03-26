import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mod = await db.module.findUnique({
    where: { id },
    include: {
      subject: true,
      topics: {
        orderBy: { orderIndex: "asc" },
        include: { contents: { orderBy: { orderIndex: "asc" } }, _count: { select: { assessments: true } } },
      },
      assessments: { select: { id: true, title: true, type: true, status: true } },
      prerequisiteModule: { select: { id: true, name: true } },
    },
  });

  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ module: mod });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const mod = await db.module.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description || null,
      orderIndex: body.orderIndex ?? undefined,
      isPublished: body.isPublished ?? undefined,
      requiresCompletion: body.requiresCompletion ?? undefined,
      prerequisiteModuleId: body.prerequisiteModuleId || null,
    },
  });

  return NextResponse.json({ module: mod });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.module.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
