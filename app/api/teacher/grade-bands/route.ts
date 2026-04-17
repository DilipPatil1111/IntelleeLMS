import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const bands = await db.gradeBand.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ bands });
}
