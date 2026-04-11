"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { AttendanceProgramGridClient } from "@/components/attendance/attendance-program-grid-client";
import { LayoutGrid, CalendarDays } from "lucide-react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface SessionData {
  id: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  subject: { name: string };
  records: {
    studentId: string;
    status: string;
    student: { firstName: string; lastName: string } | null;
  }[];
  overrideHoliday: boolean;
  teacherAttendance: { status: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Present (Excused)",
};

/** Sorted roster for Recent Sessions — shows each student so names are visible (not only counts). */
function sessionRecordsRoster(
  records: SessionData["records"]
): { label: string; title: string } {
  const sorted = [...records].sort((a, b) => {
    const ln = (a.student?.lastName || "").localeCompare(b.student?.lastName || "", undefined, {
      sensitivity: "base",
    });
    if (ln !== 0) return ln;
    return (a.student?.firstName || "").localeCompare(b.student?.firstName || "", undefined, {
      sensitivity: "base",
    });
  });
  if (sorted.length === 0) {
    return { label: "—", title: "No student rows on this session" };
  }
  const lines = sorted.map((r) => {
    const name =
      [r.student?.firstName, r.student?.lastName].filter(Boolean).join(" ").trim() ||
      `Student ${r.studentId.slice(0, 8)}…`;
    const st = STATUS_LABEL[r.status] || r.status;
    return `${name} (${st})`;
  });
  const title = lines.join("\n");
  const label = lines.join(" · ");
  return { label, title };
}

/** Avoid UTC date-only strings shifting the calendar day in local `toLocaleDateString`. */
function formatSessionDate(isoDate: string): string {
  const s = typeof isoDate === "string" ? isoDate : String(isoDate);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return `${Number(mo)}/${Number(d)}/${y}`;
  }
  return new Date(isoDate).toLocaleDateString();
}

function studentAttendanceStats(records: { status: string }[]) {
  const n = records.length;
  const present = records.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "EXCUSED"
  ).length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const pctPres = n ? Math.round((100 * present) / n) : 0;
  const pctAbs = n ? Math.round((100 * absent) / n) : 0;
  return { n, present, absent, pctPres, pctAbs };
}

interface SessionsSummary {
  recordCount: number;
  presentCount: number;
  absentCount: number;
  pctPresent: number;
  pctAbsent: number;
}

/** Matches /api/teacher/options — includes programId to filter batch list by subject. */
type TeacherCatalogOption = { value: string; label: string; programId: string };

function TeacherAttendanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingSessionId = searchParams.get("pendingSession");
  const viewGrid = searchParams.get("view") === "grid";
  const [subjects, setSubjects] = useState<TeacherCatalogOption[]>([]);
  const [batches, setBatches] = useState<TeacherCatalogOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsSummary, setSessionsSummary] = useState<SessionsSummary | null>(
    null
  );
  const [sessionsPage, setSessionsPage] = useState(1);
  const [subjectId, setSubjectId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [overrideHoliday, setOverrideHoliday] = useState(false);
  const [teacherSelfStatus, setTeacherSelfStatus] = useState("PRESENT");
  const [includeTeacherSelf, setIncludeTeacherSelf] = useState(true);
  const [resolvingSession, setResolvingSession] = useState(false);

  const applySessionsFetchResult = useCallback(
    (data: {
      sessions?: SessionData[];
      total?: number;
      summary?: SessionsSummary;
    }) => {
      setSessions(data.sessions || []);
      setSessionsTotal(typeof data.total === "number" ? data.total : 0);
      const s = data.summary;
      if (
        s &&
        typeof s.recordCount === "number" &&
        typeof s.presentCount === "number" &&
        typeof s.absentCount === "number" &&
        typeof s.pctPresent === "number" &&
        typeof s.pctAbsent === "number"
      ) {
        setSessionsSummary(s);
      } else {
        setSessionsSummary(null);
      }
    },
    []
  );

  useEffect(() => {
    fetch("/api/teacher/options")
      .then((r) => r.json())
      .then((data: { subjects?: TeacherCatalogOption[]; batches?: TeacherCatalogOption[] }) => {
        setSubjects(data.subjects || []);
        setBatches(data.batches || []);
      });
  }, []);

  /** Only batches in the same program as the selected subject (valid subject + batch pairs). */
  const batchOptionsForSubject = useMemo(() => {
    if (!subjectId) return [];
    const sub = subjects.find((s) => s.value === subjectId);
    if (!sub) return [];
    return batches.filter((b) => b.programId === sub.programId);
  }, [subjectId, subjects, batches]);

  useEffect(() => {
    if (!batchId || !subjectId) return;
    const ok = batchOptionsForSubject.some((b) => b.value === batchId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!ok) setBatchId("");
  }, [batchOptionsForSubject, batchId, subjectId]);

  useEffect(() => {
    if (batchId) {
      fetch(`/api/teacher/students?batchId=${batchId}`)
        .then((r) => r.json())
        .then((data) => {
          setStudents(data.students || []);
          const defaultAtt: Record<string, string> = {};
          (data.students || []).forEach((s: Student) => {
            defaultAtt[s.id] = "PRESENT";
          });
          setAttendance(defaultAtt);
        });
    }
  }, [batchId]);

  useEffect(() => {
    if (subjectId && batchId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionsPage(1);
    } else {
       
      setSessions([]);
       
      setSessionsTotal(0);
       
      setSessionsSummary(null);
    }
  }, [subjectId, batchId]);

  useEffect(() => {
    if (!subjectId || !batchId) return;
    const qs = new URLSearchParams({
      subjectId,
      batchId,
      page: String(sessionsPage),
      pageSize: "12",
    });
    fetch(`/api/teacher/attendance/sessions?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => applySessionsFetchResult(data));
  }, [subjectId, batchId, sessionsPage, applySessionsFetchResult]);

  const recentSessionsFooter = useMemo(() => {
    if (sessions.length === 0) return null;
    const pageTotals = sessions.reduce(
      (acc, s) => {
        const st = studentAttendanceStats(s.records);
        acc.records += st.n;
        acc.present += st.present;
        acc.absent += st.absent;
        return acc;
      },
      { records: 0, present: 0, absent: 0 }
    );
    const footerPctPres = pageTotals.records
      ? Math.round((100 * pageTotals.present) / pageTotals.records)
      : 0;
    const footerPctAbs = pageTotals.records
      ? Math.round((100 * pageTotals.absent) / pageTotals.records)
      : 0;
    return { pageTotals, footerPctPres, footerPctAbs };
  }, [sessions]);

  useEffect(() => {
    if (sessionDate) {
      fetch(`/api/teacher/attendance/check-holiday?date=${sessionDate}`)
        .then((r) => r.json())
        .then((data) => {
          setIsHoliday(data.isHoliday || false);
        });
    }
  }, [sessionDate]);

  async function resolvePendingTeacherAttendance() {
    if (!pendingSessionId) return;
    setResolvingSession(true);
    await fetch("/api/teacher/attendance/record-teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceSessionId: pendingSessionId, status: teacherSelfStatus }),
    });
    setResolvingSession(false);
    window.history.replaceState({}, "", "/teacher/attendance");
    if (subjectId && batchId) {
      setSessionsPage(1);
      const qs = new URLSearchParams({ subjectId, batchId, page: "1", pageSize: "12" });
      fetch(`/api/teacher/attendance/sessions?${qs.toString()}`)
        .then((r) => r.json())
        .then((data) => applySessionsFetchResult(data));
    }
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/teacher/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        batchId,
        sessionDate,
        startTime,
        endTime,
        attendance,
        overrideHoliday,
        teacherSelfStatus: includeTeacherSelf ? teacherSelfStatus : undefined,
      }),
    });
    setSaving(false);
    if (subjectId && batchId) {
      setSessionsPage(1);
      const qs = new URLSearchParams({ subjectId, batchId, page: "1", pageSize: "12" });
      fetch(`/api/teacher/attendance/sessions?${qs.toString()}`)
        .then((r) => r.json())
        .then((data) => applySessionsFetchResult(data));
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark and manage student attendance — single session or full program sheet."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.push("/teacher/attendance")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            !viewGrid ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Single session
        </button>
        <button
          type="button"
          onClick={() => router.push("/teacher/attendance?view=grid")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            viewGrid ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Program sheet
        </button>
      </div>

      {viewGrid ? (
        <AttendanceProgramGridClient apiRole="teacher" embedded />
      ) : (
        <>
      <Card className="mb-6">
        <CardContent>
          {subjects.length === 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No subjects or batches are linked to your profile yet. Ask a principal to assign you to programs or
              subjects (Teacher settings / roster) so you can load students and record attendance.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Select
              label="Subject"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setBatchId("");
              }}
              options={subjects}
              placeholder="Select subject"
            />
            <Select
              label="Batch"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              options={batchOptionsForSubject}
              placeholder={subjectId ? "Select batch" : "Select subject first"}
            />
            <Input
              label="Date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                label="End"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {pendingSessionId && (
            <div className="rounded-lg bg-red-50 border-2 border-red-300 p-4 mb-4">
              <p className="text-sm font-bold text-red-800 mb-2">Your attendance is still required for a saved session.</p>
              <div className="flex flex-wrap items-end gap-3">
                <Select
                  label="Your status for that class"
                  value={teacherSelfStatus}
                  onChange={(e) => setTeacherSelfStatus(e.target.value)}
                  options={[
                    { value: "PRESENT", label: "Present" },
                    { value: "LATE", label: "Late" },
                    { value: "ABSENT", label: "Absent" },
                  ]}
                />
                <Button onClick={resolvePendingTeacherAttendance} isLoading={resolvingSession}>
                  Confirm my attendance
                </Button>
              </div>
            </div>
          )}

          {isHoliday && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4 flex items-center justify-between">
              <p className="text-sm text-red-600">
                This date is a holiday. Attendance recording requires an
                override.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={overrideHoliday}
                  onChange={(e) => setOverrideHoliday(e.target.checked)}
                  className="text-indigo-600"
                />
                Override Holiday
              </label>
            </div>
          )}

          {students.length > 0 &&
            subjectId &&
            (!isHoliday || overrideHoliday) && (
              <>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
                    <input
                      type="checkbox"
                      checked={includeTeacherSelf}
                      onChange={(e) => setIncludeTeacherSelf(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Record my attendance for this class session (recommended)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["PRESENT", "LATE", "ABSENT"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setTeacherSelfStatus(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                          (teacherSelfStatus === status || (status === "PRESENT" && teacherSelfStatus === "EXCUSED"))
                            ? "bg-indigo-600 text-white"
                            : "bg-white border border-gray-200 text-gray-600"
                        }`}
                      >
                        {STATUS_LABEL[status] ?? status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {students.map((s) => (
                        <tr
                          key={s.id}
                          className={
                            attendance[s.id] === "ABSENT"
                              ? "bg-red-100/90"
                              : undefined
                          }
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {s.firstName} {s.lastName}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {attendance[s.id] === "EXCUSED" ? (
                                <span className="px-3 py-1 rounded text-xs font-medium bg-violet-600 text-white">
                                  Present (Excused)
                                </span>
                              ) : (
                                ["PRESENT", "ABSENT", "LATE"].map(
                                  (status) => (
                                    <button
                                      key={status}
                                      onClick={() =>
                                        setAttendance({
                                          ...attendance,
                                          [s.id]: status,
                                        })
                                      }
                                      className={`px-3 py-1 rounded text-xs font-medium ${
                                        attendance[s.id] === status
                                          ? status === "PRESENT"
                                            ? "bg-green-600 text-white"
                                            : status === "ABSENT"
                                              ? "bg-red-600 text-white"
                                              : "bg-yellow-500 text-white"
                                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      {STATUS_LABEL[status] ?? status}
                                    </button>
                                  )
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSave} isLoading={saving}>
                    Save Attendance
                  </Button>
                </div>
              </>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Recent Sessions Attendance</CardTitle>
          {sessionsTotal > 0 && (
            <p className="text-sm text-gray-500">
              {sessionsTotal} session{sessionsTotal === 1 ? "" : "s"} total · 12 per page
            </p>
          )}
        </CardHeader>
        <CardContent>
          {sessions.length === 0 && sessionsTotal === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No sessions recorded yet.
            </p>
          ) : (
            <>
              <div className="max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Subject
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 min-w-[12rem]">
                        Students
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Present
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Absent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        You
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Override
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        % Present
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        % Absent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sessions.map((s) => {
                      const st = studentAttendanceStats(s.records);
                      const roster = sessionRecordsRoster(s.records);
                      return (
                      <tr key={s.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatSessionDate(s.sessionDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {s.subject?.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {s.startTime} - {s.endTime}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-800 max-w-[20rem] align-top">
                          <div
                            className="max-h-28 overflow-y-auto pr-1 whitespace-normal break-words"
                            title={roster.title}
                          >
                            {roster.label}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 text-sm tabular-nums ${
                            st.present > 0
                              ? "bg-emerald-100 text-emerald-950"
                              : ""
                          }`}
                        >
                          {st.present}/{st.n}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm tabular-nums ${
                            st.absent > 0
                              ? "bg-red-100 text-red-950"
                              : ""
                          }`}
                        >
                          {st.absent}/{st.n}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {s.teacherAttendance ? (
                            <Badge variant="success">{s.teacherAttendance.status}</Badge>
                          ) : (
                            <Badge variant="danger">Pending</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.overrideHoliday && (
                            <Badge variant="warning">Holiday Override</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900">
                          {st.pctPres}%
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900">
                          {st.pctAbs}%
                        </td>
                      </tr>
                    );})}
                  </tbody>
                  {(recentSessionsFooter || sessionsSummary) && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    {recentSessionsFooter && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-sm font-medium text-gray-700"
                      >
                        Totals (this page)
                      </td>
                      <td
                        className={`px-4 py-3 text-sm tabular-nums ${
                          recentSessionsFooter.pageTotals.present > 0
                            ? "bg-emerald-100 text-emerald-950"
                            : "text-gray-900"
                        }`}
                      >
                        {recentSessionsFooter.pageTotals.present}/{recentSessionsFooter.pageTotals.records}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm tabular-nums ${
                          recentSessionsFooter.pageTotals.absent > 0
                            ? "bg-red-100 text-red-950"
                            : "text-gray-900"
                        }`}
                      >
                        {recentSessionsFooter.pageTotals.absent}/{recentSessionsFooter.pageTotals.records}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">—</td>
                      <td className="px-4 py-3 text-sm text-gray-400">—</td>
                      <td className="px-4 py-3 text-sm text-right font-medium tabular-nums text-gray-900">
                        {recentSessionsFooter.footerPctPres}%
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium tabular-nums text-gray-900">
                        {recentSessionsFooter.footerPctAbs}%
                      </td>
                    </tr>
                    )}
                    {sessionsSummary && sessionsTotal > 0 && (
                    <tr className="border-t border-gray-200">
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-sm font-medium text-gray-700"
                      >
                        Totals (all sessions, this subject and batch)
                      </td>
                      <td
                        className={`px-4 py-3 text-sm tabular-nums ${
                          sessionsSummary.presentCount > 0
                            ? "bg-emerald-100 text-emerald-950"
                            : "text-gray-900"
                        }`}
                      >
                        {sessionsSummary.presentCount}/{sessionsSummary.recordCount}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm tabular-nums ${
                          sessionsSummary.absentCount > 0
                            ? "bg-red-100 text-red-950"
                            : "text-gray-900"
                        }`}
                      >
                        {sessionsSummary.absentCount}/{sessionsSummary.recordCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">—</td>
                      <td className="px-4 py-3 text-sm text-gray-400">—</td>
                      <td className="px-4 py-3 text-sm text-right font-medium tabular-nums text-gray-900">
                        {sessionsSummary.pctPresent}%
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium tabular-nums text-gray-900">
                        {sessionsSummary.pctAbsent}%
                      </td>
                    </tr>
                    )}
                  </tfoot>
                  )}
                </table>
              </div>
              {sessionsTotal > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-600">
                    Page {sessionsPage} of {Math.max(1, Math.ceil(sessionsTotal / 12))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sessionsPage <= 1}
                      onClick={() => setSessionsPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sessionsPage >= Math.max(1, Math.ceil(sessionsTotal / 12))}
                      onClick={() =>
                        setSessionsPage((p) =>
                          p < Math.ceil(sessionsTotal / 12) ? p + 1 : p
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </>
  );
}

export default function TeacherAttendancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <TeacherAttendanceInner />
    </Suspense>
  );
}
