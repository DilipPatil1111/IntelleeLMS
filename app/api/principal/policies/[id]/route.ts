import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { PolicyType } from "@/app/generated/prisma/enums";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = await req.json();
  const policy = await db.policy.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description || null,
      content: body.content || null,
      fileUrl: body.fileUrl || null,
      category: body.category || null,
      policyType: (body.policyType as PolicyType) || undefined,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json({ policy });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  await db.policy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
