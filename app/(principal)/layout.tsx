import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getInitials } from "@/lib/utils";
import { getPortalSwitcherLinks, hasPrincipalPortalAccess } from "@/lib/portal-access";

export default async function PrincipalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!hasPrincipalPortalAccess(session)) redirect("/login");

  const name = session.user.name || "Principal";
  const parts = name.split(" ");
  const initials = getInitials(parts[0] || "P", parts[parts.length - 1] || "R");

  return (
    <DashboardShell role="principal" userName={name} userInitials={initials} portalSwitcherLinks={getPortalSwitcherLinks(session)}>
      {children}
    </DashboardShell>
  );
}
