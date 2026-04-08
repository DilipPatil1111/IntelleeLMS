import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const templates = await db.emailTemplate.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const template = await db.emailTemplate.upsert({
    where: { name: body.name },
    update: { subject: body.subject, body: body.body, description: body.description },
    create: { name: body.name, subject: body.subject, body: body.body, description: body.description },
  });

  return NextResponse.json({ template });
}
