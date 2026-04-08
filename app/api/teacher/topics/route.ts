import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;


  const body = await req.json();
  const { name, description, moduleId, orderIndex } = body;

  if (!name || !moduleId) return NextResponse.json({ error: "Name and module are required" }, { status: 400 });

  const topic = await db.topic.create({
    data: { name, description: description || null, moduleId, orderIndex: orderIndex || 0 },
  });

  return NextResponse.json({ topic });
}
