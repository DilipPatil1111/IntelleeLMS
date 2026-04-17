"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";
import type { AttendanceReportData } from "@/lib/attendance-report";
import { Calendar, CheckCircle2, Clock, XCircle, Download, Loader2, TrendingUp } from "lucide-react";

const PAGE_SIZE = 20;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function displayStatus(s: string) {
  if (s === "EXCUSED") return "P (Excused)";
  return s;
}

export function AttendanceReportViewer({
  data,
  pdfUrl,
}: {
  data: AttendanceReportData;
  pdfUrl: string;
}) {
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const { toasts, toast, dismiss } = useToast();
  const { summary, rows } = data;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(pdfUrl, { cache: "no-store" });
      if (!res.ok) {
        toast("Failed to generate PDF", "error");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const nameMatch = cd?.match(/filename="([^"]+)"/);
      const filename = nameMatch?.[1] ?? "attendance-report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast("PDF downloaded", "success");
    } catch {
      toast("Download failed", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="mb-6 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 to-white p-6 shadow-sm">
        <p className="text-center text-xl font-semibold text-indigo-950">{data.collegeName}</p>
        <p className="text-center text-sm text-gray-600 mt-1">Attendance Report</p>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Report Summary</CardTitle>
          <Button onClick={() => void handleDownload()} disabled={downloading} isLoading={downloading}>
            <Download className="h-4 w-4 mr-1" /> Download PDF
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-5">
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Student</dt>
              <dd className="font-medium text-right">
                {data.studentName}
                {data.enrollmentNo && <span className="text-gray-400 ml-1">({data.enrollmentNo})</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Program</dt>
              <dd className="font-medium text-right">{data.programName}</dd>
            </div>
            {data.programType && (
              <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
                <dt className="text-gray-500">Program Type</dt>
                <dd className="font-medium text-right">{data.programType}</dd>
              </div>
            )}
            {data.programCategory && (
              <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
                <dt className="text-gray-500">Category</dt>
                <dd className="font-medium text-right">{data.programCategory}</dd>
              </div>
            )}
            {data.programDuration && (
              <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
                <dt className="text-gray-500">Duration</dt>
                <dd className="font-medium text-right">{data.programDuration}</dd>
              </div>
            )}
            {data.batchName && (
              <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
                <dt className="text-gray-500">Batch</dt>
                <dd className="font-medium text-right">{data.batchName}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Period</dt>
              <dd className="font-medium text-right">
                {data.periodStart ? fmtDate(data.periodStart) : "—"} – {data.periodEnd ? fmtDate(data.periodEnd) : "—"}
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard title="Total Sessions" value={summary.totalSessions} icon={<Calendar className="h-4 w-4" />} variant="indigo" />
            <StatCard title="Present" value={summary.present} icon={<CheckCircle2 className="h-4 w-4" />} variant="emerald" />
            <StatCard title="Late" value={summary.late} icon={<Clock className="h-4 w-4" />} variant="amber" />
            <StatCard title="Absent" value={summary.absent} icon={<XCircle className="h-4 w-4" />} variant="rose" />
            <StatCard title="Attendance Rate" value={`${summary.attendanceRate}%`} icon={<TrendingUp className="h-4 w-4" />} variant={summary.attendanceRate >= 75 ? "emerald" : "rose"} />
            <StatCard title="Days Attended" value={summary.totalDaysAttended} icon={<Calendar className="h-4 w-4" />} variant="indigo" />
            <StatCard title="Hours Attended" value={`${summary.totalHoursAttended} hrs`} icon={<Clock className="h-4 w-4" />} variant="emerald" />
            <StatCard title="Total Sched. Hours" value={`${summary.totalScheduledHours} hrs`} icon={<Clock className="h-4 w-4" />} variant="indigo" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Date-wise Attendance ({rows.length} records)</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No attendance records found for this period.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {paginated.map((r, i) => (
                      <tr key={i} className={r.status === "ABSENT" ? "bg-red-50/40" : undefined}>
                        <td className="px-4 py-2 text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-4 py-2 text-gray-900">{fmtDate(r.date)}</td>
                        <td className="px-4 py-2 text-gray-700">{r.subject}</td>
                        <td className="px-4 py-2 text-gray-500">{r.startTime || "—"} – {r.endTime || "—"}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {r.durationMinutes > 0
                            ? `${(r.durationMinutes / 60).toFixed(1)} hrs`
                            : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={
                              r.status === "PRESENT" ? "success"
                                : r.status === "LATE" ? "warning"
                                  : r.status === "EXCUSED" ? "default"
                                    : "danger"
                            }
                            className={r.status === "EXCUSED" ? "bg-violet-100 text-violet-700" : undefined}
                          >
                            {displayStatus(r.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} itemLabel="records" className="mt-4" />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
