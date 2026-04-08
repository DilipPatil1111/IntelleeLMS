"use client";

import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import { blobFileUrl } from "@/lib/blob-url";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, FileText, FileCheck, ClipboardList, Calendar, CalendarRange,
  Users, Settings, BarChart3, GraduationCap, DollarSign,
  Bell, LogOut, ChevronLeft, ChevronRight, Award, BookMarked, Layers,
  Shield, FolderOpen, Megaphone, MessageSquare, AlertCircle, Archive, Building2, ShieldCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const studentNav: NavItem[] = [
  { label: "Dashboard", href: "/student", icon: LayoutDashboard },
  { label: "My Profile", href: "/student/profile", icon: Users },
  { label: "Apply", href: "/student/apply", icon: FileCheck },
  { label: "Onboarding", href: "/student/onboarding", icon: ClipboardList },
  { label: "My Programs", href: "/student/program", icon: BookMarked },
  { label: "Assessments", href: "/student/assessments", icon: FileText },
  { label: "Results", href: "/student/results", icon: Award },
  { label: "Attendance", href: "/student/attendance", icon: Calendar },
  { label: "Full Calendar", href: "/student/full-calendar", icon: CalendarRange },
  { label: "Holidays", href: "/student/holidays", icon: Calendar },
  { label: "Fees", href: "/student/fees", icon: DollarSign },
  { label: "Pending Actions", href: "/student/pending-actions", icon: AlertCircle },
  { label: "Notifications", href: "/student/notifications", icon: Bell },
  { label: "Feedback", href: "/student/feedback", icon: MessageSquare },
];

const teacherNav: NavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { label: "My Profile", href: "/teacher/my-profile", icon: Users },
  { label: "Assessments", href: "/teacher/assessments", icon: FileText },
  { label: "Announcements", href: "/teacher/announcements", icon: Megaphone },
  { label: "Question Bank", href: "/teacher/questions", icon: ClipboardList },
  { label: "Grading", href: "/teacher/grading", icon: BookOpen },
  { label: "Attendance", href: "/teacher/attendance", icon: Calendar },
  { label: "Full Calendar", href: "/teacher/full-calendar", icon: CalendarRange },
  { label: "Holidays", href: "/teacher/holidays", icon: Calendar },
  { label: "Students", href: "/teacher/students", icon: GraduationCap },
  { label: "Feedback", href: "/teacher/feedback", icon: MessageSquare },
  { label: "Reports", href: "/teacher/reports", icon: BarChart3 },
  { label: "Subjects", href: "/teacher/subjects", icon: BookOpen },
  { label: "Course Content", href: "/teacher/modules", icon: BookMarked },
  { label: "Program Content", href: "/teacher/program-content", icon: Layers },
  { label: "Session Recordings", href: "/teacher/session-recordings", icon: Video },
  { label: "Award Certificates", href: "/teacher/award-certificates", icon: Award },
  { label: "Templates", href: "/teacher/certificate-templates", icon: FolderOpen },
  { label: "Settings", href: "/teacher/settings", icon: Settings },
];

const principalNav: NavItem[] = [
  { label: "Dashboard", href: "/principal", icon: LayoutDashboard },
  { label: "My Profile", href: "/principal/my-profile", icon: Users },
  { label: "Applications", href: "/principal/applications", icon: FileCheck },
  { label: "Feedback", href: "/principal/feedback", icon: MessageSquare },
  { label: "Onboarding review", href: "/principal/onboarding-review", icon: ClipboardList },
  { label: "All Assessments", href: "/principal/assessments", icon: FileText },
  { label: "Students", href: "/principal/students", icon: GraduationCap },
  { label: "Teachers", href: "/principal/teachers", icon: Users },
  { label: "User Management", href: "/principal/users", icon: ShieldCheck },
  { label: "Attendance", href: "/principal/attendance", icon: Calendar },
  { label: "Full Calendar", href: "/principal/full-calendar", icon: CalendarRange },
  { label: "Program Content", href: "/principal/program-content", icon: Layers },
  { label: "Session Recordings", href: "/principal/session-recordings", icon: Video },
  { label: "Award Certificates", href: "/principal/award-certificates", icon: Award },
  { label: "Institution profile", href: "/principal/institution-profile", icon: Building2 },
  { label: "Academic years", href: "/principal/academic-years", icon: CalendarRange },
  { label: "Batches", href: "/principal/batches", icon: Layers },
  { label: "Reports", href: "/principal/reports", icon: BarChart3 },
  { label: "Holidays", href: "/principal/holidays", icon: Calendar },
  { label: "Email Templates", href: "/principal/email-templates", icon: Bell },
  { label: "Announcements", href: "/principal/announcements", icon: Megaphone },
  { label: "Policies", href: "/principal/policies", icon: Shield },
  { label: "Templates", href: "/principal/shared-documents", icon: FolderOpen },
  { label: "Inspection Binder", href: "/principal/inspection-binder", icon: Archive },
  { label: "Student Fees", href: "/principal/student-fees", icon: DollarSign },
  { label: "Settings", href: "/principal/settings", icon: Settings },
];

const navMap: Record<string, NavItem[]> = {
  student: studentNav,
  teacher: teacherNav,
  principal: principalNav,
};

interface SidebarProps {
  role: string;
  userName: string;
  userInitials: string;
  profilePicture?: string;
  allowedPaths?: string[];
}

export function Sidebar({ role, userName, userInitials, profilePicture, allowedPaths }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { logoUrl, legalName, brandingDisplayMode, loaded } = useBranding();
  const allNavItems = navMap[role.toLowerCase()] || [];
  const navItems = allowedPaths ? allNavItems.filter((item) => allowedPaths.includes(item.href)) : allNavItems;

  return (
    <aside
      className={cn(
        "flex flex-col bg-gray-900 text-white transition-all duration-300 h-full",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <Link href={`/${role.toLowerCase()}`} className="flex items-center gap-2 min-w-0">
          {(() => {
            if (!loaded) {
              return !collapsed ? <span className="text-lg font-bold text-indigo-400 truncate">&nbsp;</span> : null;
            }
            const showLogo = logoUrl && (brandingDisplayMode === "LOGO_ONLY" || brandingDisplayMode === "LOGO_WITH_TEXT");
            const showText = legalName && (brandingDisplayMode === "TEXT_ONLY" || brandingDisplayMode === "LOGO_WITH_TEXT");

            return (
              <>
                {showLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={blobFileUrl(logoUrl, "logo", true)}
                    alt={legalName ?? "Logo"}
                    className={cn(
                      "object-contain flex-shrink-0",
                      collapsed ? "h-8 w-8" : "h-8 w-auto max-w-[120px]"
                    )}
                  />
                )}
                {showText && !collapsed && (
                  <span className="text-lg font-bold text-indigo-400 truncate">
                    {legalName}
                  </span>
                )}
                {!showLogo && !showText && !collapsed && (
                  <span className="text-lg font-bold text-indigo-400 truncate">Intellee</span>
                )}
              </>
            );
          })()}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => {
          // Use exact match for root dashboards; for sub-paths require a "/" separator to avoid
          // "/student/program" matching "/student/program-content" etc.
          const isActive =
            pathname === item.href ||
            (item.href !== `/${role.toLowerCase()}` && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <Link
          href={`/${role.toLowerCase() === "principal" ? "principal/my-profile" : role.toLowerCase() === "teacher" ? "teacher/my-profile" : "student/profile"}`}
          className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-gray-800 transition-colors"
          title={collapsed ? "My Profile" : undefined}
        >
          {profilePicture ? (
            <Image src={blobFileUrl(profilePicture, undefined, true)} alt="" width={32} height={32} unoptimized className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium">
              {userInitials}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-400 capitalize">{role.toLowerCase()}</p>
            </div>
          )}
        </Link>
        <form action="/api/auth/signout" method="POST" className="mt-3">
          <button
            type="submit"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white w-full transition-colors",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
