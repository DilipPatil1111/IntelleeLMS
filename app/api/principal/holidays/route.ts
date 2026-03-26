import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const holidays = await db.holiday.findMany({ orderBy: { date: "asc" } });
  return NextResponse.json({ holidays });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const holiday = await db.holiday.create({
    data: {
      name: body.name,
      date: new Date(body.date),
      type: body.type || "PUBLIC",
    },
  });

  return NextResponse.json({ holiday });
}
