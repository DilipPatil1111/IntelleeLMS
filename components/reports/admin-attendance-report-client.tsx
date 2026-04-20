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

type Opt = { value: string; label: string };
type BatchOpt = Opt & { startDate?: string; endDate?: string };

interface Props {
  apiPrefix: string;
  programsUrl: string;
}

export function AdminAttendanceReportClient({ apiPrefix, programsUrl }: Props) {
  const [programs, setPrograms] = useState<Opt[]>([]);
  const [batches, setBatches] = useState<BatchOpt[]>([]);
  const [students, setStudents] = useState<Opt[]>([]);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [studentUserId, setStudentUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<AttendanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toasts, toast, dismiss } = useToast();
  const activeDatesRef = useRef({ startDate: "", endDate: "", programId: "", studentUserId: "" });

  useEffect(() => {
    fetch(programsUrl)
      .then((r) => r.json())
      .then((d) => {
        const progs = (d.programs || d.raw || []).map(
          (p: { id?: string; name?: string; value?: string; label?: string }) => ({
            value: p.id ?? p.value ?? "",
            label: p.name ?? p.label ?? "",
          })
        );
        setPrograms(progs);
      });
  }, [programsUrl]);

  useEffect(() => {
    if (!programId) {
      setBatches([]);
      setBatchId("");
      setStudents([]);
      setStudentUserId("");
      setStartDate("");
      setEndDate("");
      return;
    }
    fetch(`${apiPrefix}/attendance-report/batches?programId=${programId}`)
      .then((r) => r.json())
      .then((d) => {
        const b: BatchOpt[] = (d.batches || []).map(
          (x: { id: string; name: string; startDate?: string; endDate?: string }) => ({
            value: x.id,
            label: x.name,
            startDate: x.startDate,
            endDate: x.endDate,
          })
        );
        setBatches(b);
        if (b[0]) {
          setBatchId(b[0].value);
        }
      })
      .catch(() => setBatches([]));
  }, [programId, apiPrefix]);

  // When batch changes, reset the date inputs and the student list. We no
  // longer pre-populate dates from batch.startDate / batch.endDate — doing so
  // silently excluded attendance rows whose sessionDate fell outside the
  // planned batch window (make-up classes, future-dated sessions, etc.).
  // Leaving dates blank lets the backend return every record for the student +
  // program, and fills the inputs from the result's actual period range.
  useEffect(() => {
    if (!batchId) {
      setStudents([]);
      setStudentUserId("");
      return;
    }
    setStartDate("");
    setEndDate("");

    fetch(`${apiPrefix}/attendance-report/students?batchId=${batchId}`)
      .then((r) => r.json())
      .then((d) => {
        const s: Opt[] = (d.students || []).map((x: { userId: string; name: string }) => ({
          value: x.userId,
          label: x.name,
        }));
        setStudents(s);
        setStudentUserId("");
      })
      .catch(() => setStudents([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, apiPrefix]);

  const fetchReport = useCallback(
    async (pid: string, uid: string, start: string, end: string) => {
      if (!uid || !pid) return;
      setLoading(true);
      setData(null);
      activeDatesRef.current = { programId: pid, studentUserId: uid, startDate: start, endDate: end };
      try {
        const params = new URLSearchParams({ studentUserId: uid, programId: pid });
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
        const res = await fetch(`${apiPrefix}/attendance-report?${params}`, { cache: "no-store" });
        if (!res.ok) {
          toast("Failed to load report", "error");
          return;
        }
        const result: AttendanceReportData = await res.json();
        setData(result);
        // Fill date inputs with API-returned period if still empty
        if (!start && result.periodStart) setStartDate(result.periodStart);
        if (!end && result.periodEnd) setEndDate(result.periodEnd);
        activeDatesRef.current = {
          programId: pid,
          studentUserId: uid,
          startDate: result.periodStart || start,
          endDate: result.periodEnd || end,
        };
      } catch {
        toast("Network error", "error");
      } finally {
        setLoading(false);
      }
    },
    [apiPrefix, toast]
  );

  // Auto-generate when student is selected
  useEffect(() => {
    if (studentUserId && programId) {
      void fetchReport(programId, studentUserId, startDate, endDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentUserId]);

  const handleGenerate = () => void fetchReport(programId, studentUserId, startDate, endDate);

  const { programId: activePid, studentUserId: activeUid, startDate: activeStart, endDate: activeEnd } = activeDatesRef.current;
  const pdfUrl =
    activePid && activeUid
      ? `${apiPrefix}/attendance-report/pdf?studentUserId=${activeUid}&programId=${activePid}${activeStart ? `&startDate=${activeStart}` : ""}${activeEnd ? `&endDate=${activeEnd}` : ""}`
      : "";

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <PageHeader title="Attendance Report" description="Generate student-wise attendance reports with PDF download" />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[200px]">
          <Select
            label="Program"
            value={programId}
            onChange={(e) => { setProgramId(e.target.value); setData(null); }}
            options={programs}
            placeholder="Select program"
          />
        </div>
        <div className="min-w-[180px]">
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => { setBatchId(e.target.value); setData(null); }}
            options={batches}
            placeholder={batches.length === 0 ? "Select program first" : "Select batch"}
            disabled={batches.length === 0}
          />
        </div>
        <div className="min-w-[200px]">
          <Select
            label="Student"
            value={studentUserId}
            onChange={(e) => { setStudentUserId(e.target.value); setData(null); }}
            options={students}
            placeholder={students.length === 0 ? "Select batch first" : "Select student"}
            disabled={students.length === 0}
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
        <Button onClick={handleGenerate} disabled={!studentUserId || !programId || loading}>
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

      {!loading && !data && studentUserId && (
        <div className="text-center text-gray-500 py-12">
          Click &ldquo;Generate Report&rdquo; to view the attendance report.
        </div>
      )}
    </>
  );
}
