import type { Session } from "next-auth";

export type PortalRole = "STUDENT" | "TEACHER" | "PRINCIPAL";

function parseGranted(raw: unknown): PortalRole[] {
  if (!Array.isArray(raw)) return [];
  const out: PortalRole[] = [];
  for (const x of raw) {
    if (x === "STUDENT" || x === "TEACHER" || x === "PRINCIPAL") out.push(x);
  }
  return out;
}

function primaryRole(session: Session | null): PortalRole | null {
  const r = session?.user && (session.user as { role?: string }).role;
  if (r === "STUDENT" || r === "TEACHER" || r === "PRINCIPAL") return r;
  return null;
}

function grantedPortals(session: Session | null): PortalRole[] {
  return parseGranted(session?.user && (session.user as { grantedPortals?: unknown }).grantedPortals);
}

/**
 * Whether the user may use a given portal (routes + APIs).
 * Primary `User.role` counts; extra rows in `UserPortalGrant` add access.
 * Principals keep legacy access to the Teacher portal (unchanged).
 */
export function sessionHasPortalAccess(
  session: Session | null,
  portal: PortalRole
): boolean {
  const p = primaryRole(session);
  if (!p) return false;
  if (p === portal) return true;
  if (grantedPortals(session).includes(portal)) return true;
  if (portal === "TEACHER" && p === "PRINCIPAL") return true;
  return false;
}

export function hasStudentPortalAccess(session: Session | null): boolean {
  return sessionHasPortalAccess(session, "STUDENT");
}

export function hasTeacherPortalAccess(session: Session | null): boolean {
  return sessionHasPortalAccess(session, "TEACHER");
}

export function hasPrincipalPortalAccess(session: Session | null): boolean {
  return sessionHasPortalAccess(session, "PRINCIPAL");
}

/**
 * Teacher-style ownership rules (only your own assessments, etc.).
 * Principals are never restricted; line teachers and “granted teacher” users are.
 */
export function isTeacherOwnershipRestricted(session: Session | null): boolean {
  const p = primaryRole(session);
  if (!p) return false;
  if (p === "PRINCIPAL") return false;
  if (p === "TEACHER") return true;
  return grantedPortals(session).includes("TEACHER");
}

export type PortalSwitcherLink = { href: string; label: string };

/** Dashboard links when the user can open more than one portal. */
export function getPortalSwitcherLinks(session: Session | null): PortalSwitcherLink[] {
  if (!session?.user) return [];
  const links: PortalSwitcherLink[] = [];
  if (hasStudentPortalAccess(session)) links.push({ href: "/student", label: "Student portal" });
  if (hasTeacherPortalAccess(session)) links.push({ href: "/teacher", label: "Teacher portal" });
  if (hasPrincipalPortalAccess(session)) links.push({ href: "/principal", label: "Principal portal" });
  return links;
}
