import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildProfileStatusData,
  isValidStudentStatus,
  notifyStudentStatusChange,
} from "@/lib/student-status";
import { sendGraduationCertificateEmail } from "@/lib/graduation-certificate";
import type { SuspensionReason } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

/** Dedicated status update (optional note / suspension reason). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status } = body;

  if (!isValidStudentStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const suspensionReason =
    typeof body.suspensionReason === "string" ? (body.suspensionReason as SuspensionReason) : undefined;
  const statusNote = typeof body.statusNote === "string" ? body.statusNote : undefined;
  const noteTrim = statusNote?.trim() ?? "";

  if (status === "SUSPENDED" && !suspensionReason) {
    return NextResponse.json(
      { error: "suspensionReason is required when status is SUSPENDED." },
      { status: 400 }
    );
  }

  if ((status === "EXPELLED" || status === "TRANSFERRED") && noteTrim.length < 10) {
    return NextResponse.json(
      {
        error:
          status === "EXPELLED"
            ? "Provide details (at least 10 characters): policy violation / non-compliance context."
            : "Provide details (at least 10 characters): destination institution, transfer context.",
      },
      { status: 400 }
    );
  }

  const existing = await db.studentProfile.findUnique({ where: { userId: id } });
  const prev = existing?.status;
  if (!prev) return NextResponse.json({ error: "No student profile" }, { status: 404 });

  await db.studentProfile.update({
    where: { userId: id },
    data: {
      ...buildProfileStatusData(status, { suspensionReason: suspensionReason ?? null, statusNote }),
      ...(prev === "GRADUATED" && status !== "GRADUATED" ? { graduationCertificateSentAt: null } : {}),
    },
  });

  if (prev !== status) {
    await notifyStudentStatusChange(id, prev, status, {
      suspensionReason: suspensionReason ?? null,
      statusNote: statusNote ?? null,
    });
    if (status === "GRADUATED" && prev !== "GRADUATED") {
      await sendGraduationCertificateEmail(id);
    }
  }

  return NextResponse.json({ success: true });
}
