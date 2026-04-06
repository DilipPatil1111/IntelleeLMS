import { NextResponse } from "next/server";
import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const recording = await db.sessionRecording.findUnique({ where: { id } });
  if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.sessionRecording.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
