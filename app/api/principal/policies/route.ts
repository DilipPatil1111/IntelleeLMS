import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { PolicyType } from "@/app/generated/prisma/enums";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const policies = await db.policy.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ policies });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
