import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NotificationType } from "@/app/generated/prisma/enums";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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
