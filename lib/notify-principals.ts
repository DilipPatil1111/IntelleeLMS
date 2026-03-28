import { db } from "@/lib/db";

/** Informs all principal accounts when a student is expelled or transferred (audit trail in their notifications). */
export async function notifyPrincipalsDisciplinaryAction(params: {
  studentUserId: string;
  type: "EXPELLED" | "TRANSFERRED";
  /** Required detail text from the administrator (policy violation, destination institution, etc.). */
  detail: string;
}) {
  const { studentUserId, type, detail } = params;
  const u = await db.user.findUnique({
    where: { id: studentUserId },
    select: { firstName: true, lastName: true, studentProfile: { select: { enrollmentNo: true } } },
  });
  if (!u) return;

  const name = `${u.firstName} ${u.lastName}`.trim();
  const enr = u.studentProfile?.enrollmentNo ?? "—";

  const principals = await db.user.findMany({
    where: { role: "PRINCIPAL" },
    select: { id: true },
  });
  if (principals.length === 0) return;

  const title = type === "EXPELLED" ? "Student expelled — record" : "Student transferred out — record";
  const message =
    type === "EXPELLED"
      ? `Expelled for non-compliance or policy violation: ${name} (enrollment ${enr}). Details recorded: ${detail}`
      : `Transferred to another college or institution: ${name} (enrollment ${enr}). Details: ${detail}`;

  await db.notification.createMany({
    data: principals.map((p) => ({
      userId: p.id,
      type: "GENERAL" as const,
      title,
      message,
      link: "/principal/students",
    })),
  });
}
