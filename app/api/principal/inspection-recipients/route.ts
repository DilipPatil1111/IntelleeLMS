import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Emails for inspection review — principals and teachers (plus any address typed manually in the UI). */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [principals, teachers] = await Promise.all([
    db.user.findMany({
      where: { role: "PRINCIPAL" },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
    db.user.findMany({
      where: { role: "TEACHER" },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
  ]);

  return NextResponse.json({ principals, teachers });
}
