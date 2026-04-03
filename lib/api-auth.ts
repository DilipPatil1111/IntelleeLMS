import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  hasPrincipalPortalAccess,
  hasStudentPortalAccess,
  hasTeacherPortalAccess,
} from "@/lib/portal-access";

type GateOk = { ok: true; session: Session };
type GateFail = { ok: false; response: NextResponse };
type Gate = GateOk | GateFail;

export async function requireStudentPortal(): Promise<Gate> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasStudentPortalAccess(session)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}

export async function requireTeacherPortal(): Promise<Gate> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasTeacherPortalAccess(session)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}

export async function requirePrincipalPortal(): Promise<Gate> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasPrincipalPortalAccess(session)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}
