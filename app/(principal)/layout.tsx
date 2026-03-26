import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getInitials } from "@/lib/utils";

export default async function PrincipalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") redirect("/login");

  const name = session.user.name || "Principal";
  const parts = name.split(" ");
  const initials = getInitials(parts[0] || "P", parts[parts.length - 1] || "R");

  return (
    <DashboardShell role="principal" userName={name} userInitials={initials}>
      {children}
    </DashboardShell>
  );
}
