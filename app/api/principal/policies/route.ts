import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { PolicyType } from "@/app/generated/prisma/enums";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const policies = await db.policy.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ policies });
}

export async function POST(req: Request) {
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const policy = await db.policy.create({
    data: {
      title: body.title,
      description: body.description || null,
      content: body.content || null,
      fileUrl: body.fileUrl || null,
      category: body.category || null,
      policyType: (body.policyType as PolicyType) || "OTHER",
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json({ policy });
}
