"use client";

import { Sidebar } from "./sidebar";
import { PortalSwitcher, type PortalSwitcherLink } from "./portal-switcher";
import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
  role: string;
  userName: string;
  userInitials: string;
  profilePicture?: string;
  allowedPaths?: string[];
  portalSwitcherLinks?: PortalSwitcherLink[];
}

export function DashboardShell({
  children,
  role,
  userName,
  userInitials,
  profilePicture,
  allowedPaths,
  portalSwitcherLinks,
}: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={role} userName={userName} userInitials={userInitials} profilePicture={profilePicture} allowedPaths={allowedPaths} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {portalSwitcherLinks && portalSwitcherLinks.length > 1 ? <PortalSwitcher links={portalSwitcherLinks} /> : null}
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
