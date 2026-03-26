import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NotificationType } from "@/app/generated/prisma/enums";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as NotificationType | null;
  const unreadOnly = searchParams.get("unreadOnly") === "1";

  const notifications = await db.notification.findMany({
    where: {
      userId: session.user.id,
      ...(type ? { type } : {}),
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ notifications });
}
