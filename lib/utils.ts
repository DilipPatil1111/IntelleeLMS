import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Prefer explicit `assessmentDate` when set; otherwise use `createdAt` (legacy
 * rows or records created before assessmentDate was captured).
 */
export function effectiveAssessmentDateForDisplay(
  assessmentDate: Date | string | null | undefined,
  createdAt: Date | string
): Date | string {
  if (assessmentDate != null && assessmentDate !== "") {
    const d = assessmentDate instanceof Date ? assessmentDate : new Date(assessmentDate);
    if (Number.isFinite(d.getTime())) return assessmentDate;
  }
  return createdAt;
}

export function generateToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function calculatePercentage(obtained: number, total: number) {
  if (total === 0) return 0;
  return Math.round((obtained / total) * 100 * 100) / 100;
}
