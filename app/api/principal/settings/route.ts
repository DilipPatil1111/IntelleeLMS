import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateInstitutionSettings } from "@/lib/institution-settings";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [institution, programs] = await Promise.all([
    getOrCreateInstitutionSettings(),
    db.program.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        minAttendancePercent: true,
        minAverageMarksPercent: true,
        minFeePaidPercent: true,
      },
    }),
  ]);

  return NextResponse.json({ institution, programs });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const i = body.institution as Record<string, unknown> | undefined;
  if (!i) return NextResponse.json({ error: "Missing institution" }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const optNum = (v: unknown) =>
    v === null || v === "" ? null : typeof v === "number" && Number.isFinite(v) ? v : undefined;

  const institution = await db.institutionSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      minAttendancePercent: num(i.minAttendancePercent) ?? 75,
      minAverageMarksPercent: num(i.minAverageMarksPercent) ?? 40,
      minFeePaidPercent: num(i.minFeePaidPercent) ?? 50,
      pendingFeesAlertAmount: optNum(i.pendingFeesAlertAmount),
      certificateTemplateUrl:
        typeof i.certificateTemplateUrl === "string" ? i.certificateTemplateUrl : null,
      certificateTemplateFileName:
        typeof i.certificateTemplateFileName === "string" ? i.certificateTemplateFileName : null,
      transcriptTemplateUrl: typeof i.transcriptTemplateUrl === "string" ? i.transcriptTemplateUrl : null,
      transcriptTemplateFileName:
        typeof i.transcriptTemplateFileName === "string" ? i.transcriptTemplateFileName : null,
    },
    update: {
      ...(num(i.minAttendancePercent) !== undefined && { minAttendancePercent: num(i.minAttendancePercent)! }),
      ...(num(i.minAverageMarksPercent) !== undefined && { minAverageMarksPercent: num(i.minAverageMarksPercent)! }),
      ...(num(i.minFeePaidPercent) !== undefined && { minFeePaidPercent: num(i.minFeePaidPercent)! }),
      ...(Object.prototype.hasOwnProperty.call(i, "pendingFeesAlertAmount") && {
        pendingFeesAlertAmount: optNum(i.pendingFeesAlertAmount),
      }),
      ...(Object.prototype.hasOwnProperty.call(i, "certificateTemplateUrl") && {
        certificateTemplateUrl: typeof i.certificateTemplateUrl === "string" ? i.certificateTemplateUrl : null,
      }),
      ...(Object.prototype.hasOwnProperty.call(i, "certificateTemplateFileName") && {
        certificateTemplateFileName:
          typeof i.certificateTemplateFileName === "string" ? i.certificateTemplateFileName : null,
      }),
      ...(Object.prototype.hasOwnProperty.call(i, "transcriptTemplateUrl") && {
        transcriptTemplateUrl: typeof i.transcriptTemplateUrl === "string" ? i.transcriptTemplateUrl : null,
      }),
      ...(Object.prototype.hasOwnProperty.call(i, "transcriptTemplateFileName") && {
        transcriptTemplateFileName:
          typeof i.transcriptTemplateFileName === "string" ? i.transcriptTemplateFileName : null,
      }),
    },
  });

  const programsIn = body.programs as
    | {
        id: string;
        minAttendancePercent?: number | null;
        minAverageMarksPercent?: number | null;
        minFeePaidPercent?: number | null;
      }[]
    | undefined;

  if (programsIn?.length) {
    for (const p of programsIn) {
      if (!p.id) continue;
      await db.program.update({
        where: { id: p.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(p, "minAttendancePercent") && {
            minAttendancePercent: p.minAttendancePercent,
          }),
          ...(Object.prototype.hasOwnProperty.call(p, "minAverageMarksPercent") && {
            minAverageMarksPercent: p.minAverageMarksPercent,
          }),
          ...(Object.prototype.hasOwnProperty.call(p, "minFeePaidPercent") && {
            minFeePaidPercent: p.minFeePaidPercent,
          }),
        },
      });
    }
  }

  return NextResponse.json({ institution });
}
