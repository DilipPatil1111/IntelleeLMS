import { auth } from "@/lib/auth";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { redirect } from "next/navigation";
import { AttendanceSyncClient } from "./attendance-sync-client";

export const dynamic = "force-dynamic";

export default async function AttendanceSyncPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPrincipalPortalAccess(session)) redirect("/");

  return <AttendanceSyncClient />;
}
