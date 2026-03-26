import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) return NextResponse.json({ isHoliday: false });

  const date = new Date(dateStr);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const holiday = await db.holiday.findFirst({
    where: { date: { gte: startOfDay, lt: endOfDay } },
  });

  return NextResponse.json({ isHoliday: !!holiday, holiday: holiday ? { name: holiday.name, type: holiday.type } : null });
}
