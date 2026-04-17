"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AttendanceReportViewer } from "@/components/reports/attendance-report-viewer";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";
import type { AttendanceReportData } from "@/lib/attendance-report";
import { Loader2 } from "lucide-react";

type ProgramOpt = { value: string; label: string };

export default function StudentReportsPage() {
  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [programId, setProgramId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<AttendanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toasts, toast, dismiss } = useToast();
  // Tracks the dates that were used when the last report was loaded (for pdfUrl)
  const activeDatesRef = useRef({ startDate: "", endDate: "", programId: "" });

  useEffect(() => {
    fetch("/api/student/programs")
      .then((r) => r.json())
      .then((d) => {
        const progs: ProgramOpt[] = (d.programs || []).map((p: { id: string; name: string }) => ({
          value: p.id,
          label: p.name,
        }));
        setPrograms(progs);
        if (progs.length === 1) setProgramId(progs[0].value);
      });
  }, []);

  const fetchReport = useCallback(
    async (pid: string, start: string, end: string) => {
      if (!pid) return;
      setLoading(true);
      setData(null);
      activeDatesRef.current = { programId: pid, startDate: start, endDate: end };
      try {
        const params = new URLSearchParams({ programId: pid });
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
        const res = await fetch(`/api/student/attendance-report?${params}`, { cache: "no-store" });
        if (!res.ok) {
          toast("Failed to load report", "error");
          return;
        }
        const result: AttendanceReportData = await res.json();
        setData(result);
        // Populate date inputs with the batch defaults from API on first load
        if (!start && result.periodStart) setStartDate(result.periodStart);
        if (!end && result.periodEnd) setEndDate(result.periodEnd);
        activeDatesRef.current = {
          programId: pid,
          startDate: result.periodStart || start,
          endDate: result.periodEnd || end,
        };
      } catch {
        toast("Network error", "error");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Auto-load with blank dates when program changes so API returns batch defaults
  useEffect(() => {
    if (programId) {
      setStartDate("");
      setEndDate("");
      setData(null);
      void fetchReport(programId, "", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const handleGenerate = () => void fetchReport(programId, startDate, endDate);

  const { programId: activePid, startDate: activeStart, endDate: activeEnd } = activeDatesRef.current;
  const pdfUrl =
    activePid
      ? `/api/student/attendance-report/pdf?programId=${activePid}${activeStart ? `&startDate=${activeStart}` : ""}${activeEnd ? `&endDate=${activeEnd}` : ""}`
      : "";

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <PageHeader title="Reports" description="View and download your attendance reports" />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[240px]">
          <Select
            label="Program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            options={programs}
            placeholder="Select a program"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <Button onClick={handleGenerate} disabled={!programId || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Generate Report
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading report…
        </div>
      )}

      {!loading && data && <AttendanceReportViewer data={data} pdfUrl={pdfUrl} />}

      {!loading && !data && programId && (
        <div className="text-center text-gray-500 py-12">
          <p>No attendance data found for the selected program and period.</p>
        </div>
      )}
    </>
  );
}
