import { auth } from "@/lib/auth";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { getAttendanceReportData } from "@/lib/attendance-report";
import { AttendanceReportPdf } from "@/components/pdf/attendance-report-pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import React from "react";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });

  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const data = await getAttendanceReportData({
    studentUserId: session.user.id,
    programId,
    startDate,
    endDate,
  });

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rendered = await renderToBuffer(<AttendanceReportPdf data={data} />);
  const pdfBytes = new Uint8Array(rendered);
  const safeName = data.studentName.replace(/[^\w\-]+/g, "_").slice(0, 40) || "student";

  return new NextResponse(
    pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer,
    {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-attendance-report.pdf"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
