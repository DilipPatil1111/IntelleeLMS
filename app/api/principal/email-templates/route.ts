import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await db.emailTemplate.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const template = await db.emailTemplate.upsert({
    where: { name: body.name },
    update: { subject: body.subject, body: body.body, description: body.description },
    create: { name: body.name, subject: body.subject, body: body.body, description: body.description },
  });

  return NextResponse.json({ template });
}
