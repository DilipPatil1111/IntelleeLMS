import { requireTeacherPortal } from "@/lib/api-auth";
import { getAttendanceReportData } from "@/lib/attendance-report";
import { AttendanceReportPdf } from "@/components/pdf/attendance-report-pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import React from "react";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const studentUserId = searchParams.get("studentUserId");
  const programId = searchParams.get("programId");
  if (!studentUserId || !programId) {
    return NextResponse.json({ error: "studentUserId and programId required" }, { status: 400 });
  }

  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const data = await getAttendanceReportData({ studentUserId, programId, startDate, endDate });
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
