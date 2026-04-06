import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationsListClient } from "./notifications-list-client";

export default async function StudentNotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Stay up to date with your activities"
      />
      <NotificationsListClient notifications={JSON.parse(JSON.stringify(notifications))} />
    </>
  );
}
