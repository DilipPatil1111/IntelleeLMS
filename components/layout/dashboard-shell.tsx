"use client";

import { Sidebar } from "./sidebar";
import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
  role: string;
  userName: string;
  userInitials: string;
  profilePicture?: string;
  allowedPaths?: string[];
}

export function DashboardShell({ children, role, userName, userInitials, profilePicture, allowedPaths }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={role} userName={userName} userInitials={userInitials} profilePicture={profilePicture} allowedPaths={allowedPaths} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
