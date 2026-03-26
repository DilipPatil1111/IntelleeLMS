import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, moduleId, orderIndex } = body;

  if (!name || !moduleId) return NextResponse.json({ error: "Name and module are required" }, { status: 400 });

  const topic = await db.topic.create({
    data: { name, description: description || null, moduleId, orderIndex: orderIndex || 0 },
  });

  return NextResponse.json({ topic });
}
