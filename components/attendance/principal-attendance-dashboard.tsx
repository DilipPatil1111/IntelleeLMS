"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Plus, Pencil, Trash2, LayoutGrid, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";

type Consolidated = {
  summary: {
    totalSessions: number;
    totalStudentAttendance: number;
    attendanceRatePercent: number | null;
    teacherPresentHours: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
  };
  byProgram: Array<{
    programId: string;
    programName: string;
    sessions: number;
    studentAttendanceCount: number;
    rate: number | null;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>;
  byBatch: Array<{
    batchId: string;
    programName: string;
    batchName: string;
    sessions: number;
    studentAttendanceCount: number;
    rate: number | null;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>;
  byStudent: Array<{
    studentId: string;
    name: string;
    programName: string;
    batchName: string;
    rate: number | null;
    present: number;
    absent: number;
    late: number;
    excused: number;
    totalSessions: number;
    presentHours: number;
  }>;
  byTeacher: Array<{
    name: string;
    sessionsRecorded: number;
    presentHours: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }>;
  sessions: Array<{
    id: string;
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    subject: { id: string; name: string };
    batch: { id: string; name: string; program: { id: string; name: string } };
    records: { id: string; studentName: string; status: string }[];
    teacherAttendance: {
      id: string;
      teacherUserId: string;
      status: string;
      teacherName: string;
    } | null;
  }>;
};

const TEACHER_STATUS_OPTS = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
];

export function PrincipalAttendanceDashboard({
  programs,
  batches,
}: {
  programs: { value: string; label: string }[];
  batches: { value: string; label: string; programId: string }[];
}) {
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Consolidated | null>(null);
  const [loading, setLoading] = useState(false);
  const { toasts, toast, dismiss } = useToast();

  const [editTa, setEditTa] = useState<{ id: string; name: string; status: string } | null>(null);
  const [editStatus, setEditStatus] = useState("PRESENT");
  const [savingTa, setSavingTa] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addBatchId, setAddBatchId] = useState("");
  const [addSubjectId, setAddSubjectId] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addStart, setAddStart] = useState("09:00");
  const [addEnd, setAddEnd] = useState("10:00");
  const [addTeacherId, setAddTeacherId] = useState("");
  const [addTeacherStatus, setAddTeacherStatus] = useState("PRESENT");
  const [addStudents, setAddStudents] = useState<{ id: string; name: string }[]>([]);
  const [addAttendance, setAddAttendance] = useState<Record<string, string>>({});
  const [teacherOpts, setTeacherOpts] = useState<{ value: string; label: string }[]>([]);
  const [subjects, setSubjects] = useState<{ value: string; label: string }[]>([]);
  const [savingAdd, setSavingAdd] = useState(false);

  type StudentDuplicateInfo = {
    studentId: string;
    studentName: string;
    existingStatus: string;
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    submittedAt: string;
  };
  type AddDuplicateState = {
    message: string;
    students: StudentDuplicateInfo[];
    /** true = exact same session time already exists; false = specific student records clash */
    sessionDuplicate: boolean;
  } | null;
  const [addDuplicate, setAddDuplicate] = useState<AddDuplicateState>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<string | null>(null);
  const [pendingDeleteTeacher, setPendingDeleteTeacher] = useState<string | null>(null);

  const [sessTeacher, setSessTeacher] = useState("");
  const [sessProgram, setSessProgram] = useState("");
  const [sessBatch, setSessBatch] = useState("");

  type DuplicateSessionItem = {
    id: string;
    subjectName: string;
    batchName: string;
    programName: string;
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    recordCount: number;
    createdAt: string;
    suggested: boolean;
  };
  type DupGroup = {
    key: string;
    subjectName: string;
    programName: string;
    batchName: string;
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    sessions: DuplicateSessionItem[];
  };
  const [dupGroups, setDupGroups] = useState<DupGroup[]>([]);
  const [loadingDups, setLoadingDups] = useState(false);
  const [deletingDupIds, setDeletingDupIds] = useState<Set<string>>(new Set());
  const [dupPanelOpen, setDupPanelOpen] = useState(true);

  const batchesFiltered = useMemo(() => {
    if (!programId) return batches;
    return batches.filter((b) => b.programId === programId);
  }, [batches, programId]);

  useEffect(() => {
    const t = new Date();
    const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    const f = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(f(start));
     
    setTo(f(end));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (programId) q.set("programId", programId);
    if (batchId) q.set("batchId", batchId);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const res = await fetch(`/api/principal/attendance/consolidated?${q}`);
    const j = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && j) setData(j);
    else setData(null);
  }, [programId, batchId, from, to]);

  const loadDuplicates = useCallback(async () => {
    setLoadingDups(true);
    const q = new URLSearchParams();
    if (programId) q.set("programId", programId);
    if (batchId) q.set("batchId", batchId);
    const res = await fetch(`/api/principal/attendance/sessions/duplicates?${q}`);
    const j = await res.json().catch(() => null) as { duplicateGroups?: DupGroup[] } | null;
    setLoadingDups(false);
    setDupGroups(j?.duplicateGroups ?? []);
    if ((j?.duplicateGroups?.length ?? 0) > 0) setDupPanelOpen(true);
  }, [programId, batchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadDuplicates();
  }, [load, loadDuplicates]);

  useEffect(() => {
    if (!addBatchId || !programId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeacherOpts([]);
       
      setSubjects([]);
      return;
    }
    const q = new URLSearchParams();
    q.set("batchId", addBatchId);
    if (programId) q.set("programId", programId);
    void fetch(`/api/principal/attendance/assigned-teachers?${q}`)
      .then((r) => r.json())
      .then((d: { teachers?: { id: string; firstName: string; lastName: string }[] }) => {
        setTeacherOpts(
          (d.teachers || []).map((t) => ({
            value: t.id,
            label: [t.firstName, t.lastName].filter(Boolean).join(" ") || t.id,
          })),
        );
      });
    void fetch("/api/principal/academic-options")
      .then((r) => r.json())
      .then((d: { programs?: { id: string; subjects: { id: string; name: string }[] }[] }) => {
        const p = (d.programs || []).find((x) => x.id === programId);
        setSubjects((p?.subjects || []).map((s) => ({ value: s.id, label: s.name })));
      });
  }, [addBatchId, programId]);

  useEffect(() => {
    if (!addBatchId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAddStudents([]);
      return;
    }
    void fetch(`/api/principal/students?batchId=${addBatchId}&status=ENROLLED`)
      .then((r) => r.json())
      .then((d: { students?: { id: string; firstName: string; lastName: string }[] }) => {
        const list = (d.students || []).map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`.trim(),
        }));
        setAddStudents(list);
        const att: Record<string, string> = {};
        for (const s of list) att[s.id] = "PRESENT";
        setAddAttendance(att);
      });
  }, [addBatchId]);

  async function saveTeacherAttendance() {
    if (!editTa) return;
    setSavingTa(true);
    const res = await fetch(`/api/principal/teacher-attendance/${editTa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: editStatus }),
    });
    setSavingTa(false);
    if (res.ok) {
      setEditTa(null);
      void load();
    }
  }

  async function confirmDeleteTeacher() {
    if (!pendingDeleteTeacher) return;
    const id = pendingDeleteTeacher;
    setPendingDeleteTeacher(null);
    const res = await fetch(`/api/principal/teacher-attendance/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  async function confirmDeleteSession() {
    if (!pendingDeleteSession) return;
    const id = pendingDeleteSession;
    setPendingDeleteSession(null);
    const res = await fetch(`/api/principal/attendance/session/${id}`, { method: "DELETE" });
    if (res.ok) { void load(); void loadDuplicates(); }
  }

  /** Deletes a single extra duplicate session by ID. */
  async function deleteSingleDuplicate(sessionId: string) {
    setDeletingDupIds((prev) => new Set(prev).add(sessionId));
    const res = await fetch("/api/principal/attendance/sessions/duplicates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: [sessionId] }),
    });
    setDeletingDupIds((prev) => { const n = new Set(prev); n.delete(sessionId); return n; });
    if (res.ok) {
      toast("Duplicate session deleted.", "success");
      void load();
      void loadDuplicates();
    } else {
      toast("Failed to delete session.", "error");
    }
  }

  /** Deletes all extra sessions in a group (keeps the suggested one). */
  async function deleteGroupExtras(group: DupGroup) {
    const extras = group.sessions.filter((s) => !s.suggested).map((s) => s.id);
    if (extras.length === 0) return;
    extras.forEach((id) =>
      setDeletingDupIds((prev) => new Set(prev).add(id))
    );
    const res = await fetch("/api/principal/attendance/sessions/duplicates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: extras }),
    });
    extras.forEach((id) =>
      setDeletingDupIds((prev) => { const n = new Set(prev); n.delete(id); return n; })
    );
    if (res.ok) {
      toast(`Deleted ${extras.length} duplicate session${extras.length !== 1 ? "s" : ""}.`, "success");
      void load();
      void loadDuplicates();
    } else {
      toast("Failed to delete duplicates.", "error");
    }
  }

  /** Deletes all extras across every duplicate group at once. */
  async function deleteAllExtras() {
    const allExtras = dupGroups.flatMap((g) =>
      g.sessions.filter((s) => !s.suggested).map((s) => s.id)
    );
    if (allExtras.length === 0) return;
    allExtras.forEach((id) =>
      setDeletingDupIds((prev) => new Set(prev).add(id))
    );
    const res = await fetch("/api/principal/attendance/sessions/duplicates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: allExtras }),
    });
    allExtras.forEach((id) =>
      setDeletingDupIds((prev) => { const n = new Set(prev); n.delete(id); return n; })
    );
    if (res.ok) {
      toast(`Deleted ${allExtras.length} duplicate session${allExtras.length !== 1 ? "s" : ""}.`, "success");
      void load();
      void loadDuplicates();
    } else {
      toast("Failed to delete duplicates.", "error");
    }
  }

  async function submitAddSession(force = false) {
    if (!addSubjectId || !addBatchId || !addDate || !programId) return;
    setSavingAdd(true);
    setAddDuplicate(null);
    const res = await fetch("/api/principal/attendance/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId: addSubjectId,
        batchId: addBatchId,
        sessionDate: addDate,
        startTime: addStart,
        endTime: addEnd,
        attendance: addAttendance,
        overrideHoliday: false,
        teacherUserId: addTeacherId || undefined,
        teacherStatus: addTeacherId ? addTeacherStatus : undefined,
        force,
      }),
    });
    setSavingAdd(false);
    if (res.status === 409) {
      const data = await res.json().catch(() => ({})) as {
        duplicate?: boolean;
        sessionDuplicate?: boolean;
        message?: string;
        students?: StudentDuplicateInfo[];
      };
      if (data.duplicate) {
        setAddDuplicate({
          message:
            data.message ||
            "Duplicate attendance detected for this subject and date.",
          students: data.students || [],
          sessionDuplicate: data.sessionDuplicate ?? false,
        });
        return;
      }
    }
    if (res.ok) {
      setAddOpen(false);
      setAddDuplicate(null);
      void load();
    } else if (res.status !== 409) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast(typeof err?.error === "string" ? err.error : "Could not create session", "error");
    }
  }

  const sessTeacherOpts = useMemo(() => {
    if (!data) return [];
    const names = new Set<string>();
    for (const s of data.sessions) {
      if (s.teacherAttendance) names.add(s.teacherAttendance.teacherName);
    }
    return [...names].sort().map((n) => ({ value: n, label: n }));
  }, [data]);

  const sessProgramOpts = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    for (const s of data.sessions) map.set(s.batch.program.id, s.batch.program.name);
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [data]);

  const sessBatchOpts = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; programId: string }>();
    for (const s of data.sessions) map.set(s.batch.id, { name: s.batch.name, programId: s.batch.program.id });
    let entries = [...map.entries()];
    if (sessProgram) entries = entries.filter(([, v]) => v.programId === sessProgram);
    return entries
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([id, v]) => ({ value: id, label: v.name }));
  }, [data, sessProgram]);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    return data.sessions.filter((s) => {
      if (sessTeacher && s.teacherAttendance?.teacherName !== sessTeacher) return false;
      if (sessProgram && s.batch.program.id !== sessProgram) return false;
      if (sessBatch && s.batch.id !== sessBatch) return false;
      return true;
    });
  }, [data, sessTeacher, sessProgram, sessBatch]);

  const th = "px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500";
  const td = "px-3 py-2 text-sm text-gray-800";

  return (
    <div className="space-y-8">
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <p className="text-sm text-gray-500">
            Scope the consolidated view. Student attendance in the grid is edited on the <strong>Program sheet</strong> tab.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Select label="Program" value={programId} onChange={(e) => setProgramId(e.target.value)} options={programs} placeholder="All programs" />
          <Select label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} options={batchesFiltered} placeholder="All batches" />
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex justify-center py-12 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-gray-500">Sessions in range</p>
                <p className="text-2xl font-semibold text-gray-900">{data.summary.totalSessions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-gray-500">Student attendance (P/A/L)</p>
                <p className="text-2xl font-semibold text-gray-900">{data.summary.totalStudentAttendance}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-gray-500">Overall rate (approx.)</p>
                <p className="text-2xl font-semibold text-indigo-700">
                  {data.summary.attendanceRatePercent != null ? `${data.summary.attendanceRatePercent}%` : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-gray-500">Teacher present hours</p>
                <p className="text-2xl font-semibold text-gray-900">{data.summary.teacherPresentHours} h</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-gray-600 mb-6 -mt-2">
            <strong>P</strong>resent / <strong>A</strong>bsent / <strong>L</strong>ate —{" "}
            <strong>Excused</strong> absences are counted and displayed as <strong>Present</strong>.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By program</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={th}>Program</th>
                      <th className={th}>Sessions</th>
                      <th className={th}>Attendance</th>
                      <th className={th}>Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byProgram.map((r) => (
                      <tr key={r.programId}>
                        <td className={td}>{r.programName}</td>
                        <td className={td}>{r.sessions}</td>
                        <td className={td}>{r.studentAttendanceCount}</td>
                        <td className={td}>{r.rate != null ? `${r.rate}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By batch</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={th}>Batch</th>
                      <th className={th}>Program</th>
                      <th className={th}>Sessions</th>
                      <th className={th}>Attendance</th>
                      <th className={th}>Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byBatch.map((r) => (
                      <tr key={r.batchId}>
                        <td className={td}>{r.batchName}</td>
                        <td className={td}>{r.programName}</td>
                        <td className={td}>{r.sessions}</td>
                        <td className={td}>{r.studentAttendanceCount}</td>
                        <td className={td}>{r.rate != null ? `${r.rate}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Student-wise</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto max-h-[min(24rem,50vh)] p-0">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className={th}>Student</th>
                      <th className={th}>Program / batch</th>
                      <th className={th}>P</th>
                      <th className={th}>A</th>
                      <th className={th}>L</th>
                      <th className={th}>Total attendance</th>
                      <th className={th}>Total sessions</th>
                      <th className={th}>Total hours</th>
                      <th className={th}>Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byStudent.map((r) => (
                      <tr key={r.studentId}>
                        <td className={td}>{r.name}</td>
                        <td className={`${td} text-gray-600`}>
                          {r.programName}
                          <br />
                          <span className="text-xs">{r.batchName}</span>
                        </td>
                        <td className={td}>{r.present + (r.excused ?? 0)}</td>
                        <td className={td}>{r.absent}</td>
                        <td className={td}>{r.late}</td>
                        <td className={`${td} font-semibold`}>{r.present + r.late + (r.excused ?? 0)}</td>
                        <td className={td}>{r.totalSessions}</td>
                        <td className={td}>{r.presentHours} h</td>
                        <td className={td}>{r.rate != null ? `${r.rate}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Teacher-wise</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto max-h-[min(24rem,50vh)] p-0">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className={th}>Teacher</th>
                      <th className={th}>Sessions</th>
                      <th className={th}>Present h</th>
                      <th className={th}>P/A/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byTeacher.map((r) => (
                      <tr key={r.name}>
                        <td className={td}>{r.name}</td>
                        <td className={td}>{r.sessionsRecorded}</td>
                        <td className={td}>{r.presentHours}</td>
                        <td className={`${td} text-xs`}>
                          {r.present + (r.excused ?? 0)}/{r.absent}/{r.late}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* ── Duplicate Sessions Warning Panel ── */}
          {(dupGroups.length > 0 || loadingDups) && (
            <div className={`rounded-xl border-2 ${dupGroups.length > 0 ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"} p-4 mb-2`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {loadingDups ? (
                    <Loader2 className="h-5 w-5 text-gray-400 animate-spin shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    {loadingDups ? (
                      <p className="text-sm text-gray-500">Checking for duplicate sessions…</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                          <p className="text-sm font-bold text-red-900">
                            {dupGroups.length} duplicate group{dupGroups.length !== 1 ? "s" : ""} found
                            {" "}({dupGroups.reduce((a, g) => a + g.sessions.length - 1, 0)} extra session{dupGroups.reduce((a, g) => a + g.sessions.length - 1, 0) !== 1 ? "s" : ""})
                          </p>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => void deleteAllExtras()}
                            isLoading={deletingDupIds.size > 0}
                          >
                            Delete all extras
                          </Button>
                          <button
                            type="button"
                            className="text-xs text-red-600 underline"
                            onClick={() => setDupPanelOpen((v) => !v)}
                          >
                            {dupPanelOpen ? "Collapse" : "Expand"}
                          </button>
                        </div>
                        <p className="text-xs text-red-700 mb-3">
                          The sessions highlighted below have the same Subject, Date, Start and End time.
                          The <span className="font-semibold text-green-800 bg-green-100 px-1 rounded">Keep</span> badge marks the session with the most student records (recommended to keep).
                          Delete the extra sessions to clean up.
                        </p>

                        {dupPanelOpen && dupGroups.map((group) => {
                          const extraCount = group.sessions.filter((s) => !s.suggested).length;
                          return (
                            <div key={group.key} className="mb-4 rounded-lg border border-red-200 overflow-hidden bg-white">
                              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-red-100 border-b border-red-200">
                                <div className="text-xs font-semibold text-red-900">
                                  {group.subjectName} · {group.programName} — {group.batchName} · {group.sessionDate}
                                  {group.startTime && group.endTime ? ` · ${group.startTime}–${group.endTime}` : ""}
                                </div>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => void deleteGroupExtras(group)}
                                  isLoading={group.sessions.some((s) => !s.suggested && deletingDupIds.has(s.id))}
                                >
                                  Delete {extraCount} extra{extraCount !== 1 ? "s" : ""}
                                </Button>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Session</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Time</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Students</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Created</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {group.sessions.map((s, idx) => (
                                    <tr key={s.id} className={s.suggested ? "bg-green-50" : "bg-red-50/40"}>
                                      <td className="px-3 py-2 text-gray-600 font-mono">
                                        #{idx + 1} {s.id.slice(-6)}
                                      </td>
                                      <td className="px-3 py-2 text-gray-700">
                                        {s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 text-gray-700 text-center">{s.recordCount}</td>
                                      <td className="px-3 py-2 text-gray-500">
                                        {new Date(s.createdAt).toLocaleString("en-US", {
                                          month: "short",
                                          day: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </td>
                                      <td className="px-3 py-2">
                                        {s.suggested ? (
                                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">Keep</span>
                                        ) : (
                                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Duplicate</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        {!s.suggested && (
                                          <Button
                                            size="sm"
                                            variant="danger"
                                            isLoading={deletingDupIds.has(s.id)}
                                            onClick={() => void deleteSingleDuplicate(s.id)}
                                          >
                                            Delete
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Sessions (edit / delete)</CardTitle>
                  <p className="text-sm text-gray-500">
                    Edit teacher self-attendance or delete a session. Edit <strong>student</strong> attendance in bulk via{" "}
                    <strong>Program sheet</strong> (same batch + subject).
                  </p>
                </div>
                <Button onClick={() => setAddOpen(true)} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" /> Add session
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  label="Teacher"
                  value={sessTeacher}
                  onChange={(e) => setSessTeacher(e.target.value)}
                  options={sessTeacherOpts}
                  placeholder="All teachers"
                />
                <Select
                  label="Program"
                  value={sessProgram}
                  onChange={(e) => { setSessProgram(e.target.value); setSessBatch(""); }}
                  options={sessProgramOpts}
                  placeholder="All programs"
                />
                <Select
                  label="Batch"
                  value={sessBatch}
                  onChange={(e) => setSessBatch(e.target.value)}
                  options={sessBatchOpts}
                  placeholder="All batches"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Program / batch</th>
                    <th className={th}>Subject</th>
                    <th className={th}>Students</th>
                    <th className={th}>Teacher</th>
                    <th className={th}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSessions.map((s) => (
                    <tr key={s.id}>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>
                        {s.sessionDate}
                        <br />
                        <span className="text-xs text-gray-500">
                          {s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : "—"}
                        </span>
                      </td>
                      <td className={td}>
                        {s.batch.program.name}
                        <br />
                        <span className="text-xs text-gray-600">{s.batch.name}</span>
                      </td>
                      <td className={td}>{s.subject.name}</td>
                      <td className={`${td} max-w-[12rem]`}>
                        <span className="text-xs">
                          {s.records.length} student{s.records.length === 1 ? "" : "s"}
                        </span>
                        <Link
                          href={`/principal/attendance?tab=sheet`}
                          className="ml-2 text-indigo-600 text-xs hover:underline inline-flex items-center gap-0.5"
                        >
                          <LayoutGrid className="h-3 w-3" /> Grid
                        </Link>
                      </td>
                      <td className={td}>
                        {s.teacherAttendance ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-xs">{s.teacherAttendance.teacherName}</span>
                            <Badge
                              variant={s.teacherAttendance.status === "PRESENT" ? "success" : s.teacherAttendance.status === "EXCUSED" ? "default" : "warning"}
                              className={s.teacherAttendance.status === "EXCUSED" ? "bg-violet-100 text-violet-700" : undefined}
                            >
                              {s.teacherAttendance.status === "EXCUSED" ? "PRESENT" : s.teacherAttendance.status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1"
                              onClick={() => {
                                setEditTa({
                                  id: s.teacherAttendance!.id,
                                  name: s.teacherAttendance!.teacherName,
                                  status: s.teacherAttendance!.status,
                                });
                                setEditStatus(s.teacherAttendance!.status);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1 text-red-600"
                              onClick={() => setPendingDeleteTeacher(s.teacherAttendance!.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className={td}>
                        <Button variant="outline" size="sm" onClick={() => setPendingDeleteSession(s.id)}>
                          Delete session
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-center text-gray-500">No data.</p>
      )}

      {editTa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <Card className="w-full max-w-sm shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">Teacher attendance</CardTitle>
              <p className="text-sm text-gray-600">{editTa.name}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={TEACHER_STATUS_OPTS}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditTa(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void saveTeacherAttendance()} disabled={savingTa}>
                  {savingTa ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" role="dialog">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl my-8">
            <CardHeader>
              <CardTitle className="text-base">Add attendance session</CardTitle>
              <p className="text-sm text-gray-600">
                Choose program scope above, then batch and subject. Pick the teacher whose self-attendance applies (including
                yourself if you are assigned to that batch/subject).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Program (required)"
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setAddBatchId("");
                }}
                options={programs}
                placeholder="Select program"
              />
              <Select
                label="Batch"
                value={addBatchId}
                onChange={(e) => setAddBatchId(e.target.value)}
                options={batchesFiltered}
                placeholder="Select batch"
              />
              <Select
                label="Subject"
                value={addSubjectId}
                onChange={(e) => setAddSubjectId(e.target.value)}
                options={subjects}
                placeholder={programId ? "Select subject" : "Select program first"}
              />
              <Input label="Session date" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="From" type="time" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
                <Input label="To" type="time" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
              </div>
              <Select
                label="Teacher self-attendance (who taught)"
                value={addTeacherId}
                onChange={(e) => setAddTeacherId(e.target.value)}
                options={teacherOpts}
                placeholder="Optional — select if recording teacher presence"
              />
              {addTeacherId && (
                <Select
                  label="Teacher status"
                  value={addTeacherStatus}
                  onChange={(e) => setAddTeacherStatus(e.target.value)}
                  options={TEACHER_STATUS_OPTS}
                />
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Students (tap to cycle in sheet later; default Present)</p>
                <div className="max-h-40 overflow-y-auto rounded border border-gray-200 divide-y text-sm">
                  {addStudents.map((stu) => (
                    <div key={stu.id} className="flex items-center justify-between px-2 py-1">
                      <span>{stu.name}</span>
                      <select
                        className="rounded border border-gray-300 text-xs"
                        value={addAttendance[stu.id] || "PRESENT"}
                        onChange={(e) =>
                          setAddAttendance((prev) => ({ ...prev, [stu.id]: e.target.value }))
                        }
                      >
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              {/* Duplicate student-attendance warning */}
              {addDuplicate && (
                <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-red-900 mb-1">
                        Duplicate Attendance Detected
                      </p>
                      <p className="text-sm text-red-800 mb-2">{addDuplicate.message}</p>

                      {addDuplicate.students.length > 0 && (
                        <div className="mb-3 rounded border border-red-200 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-red-100">
                              <tr>
                                <th className="px-2 py-1.5 text-left font-semibold text-red-900">#</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-red-900">Student</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-red-900">Status</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-red-900">Time</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-red-900">Submitted At</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 bg-white">
                              {addDuplicate.students.map((s, idx) => (
                                <tr key={s.studentId}>
                                  <td className="px-2 py-1.5 text-red-700 font-medium">{idx + 1}</td>
                                  <td className="px-2 py-1.5 font-medium text-gray-900">{s.studentName}</td>
                                  <td className="px-2 py-1.5">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                                      s.existingStatus === "PRESENT"
                                        ? "bg-green-100 text-green-800"
                                        : s.existingStatus === "ABSENT"
                                          ? "bg-red-100 text-red-800"
                                          : s.existingStatus === "LATE"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-violet-100 text-violet-800"
                                    }`}>
                                      {s.existingStatus}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-600">
                                    {s.startTime && s.endTime
                                      ? `${s.startTime} – ${s.endTime}`
                                      : s.startTime || "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-500">
                                    {new Date(s.submittedAt).toLocaleString("en-US", {
                                      month: "short",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {addDuplicate.sessionDuplicate ? (
                        <p className="text-xs text-red-700 mb-2 font-medium">
                          Clicking <strong>Create Anyway</strong> will add another session
                          alongside the existing one. Click <strong>Cancel</strong> if this
                          was an accidental duplicate submission.
                        </p>
                      ) : (
                        <p className="text-xs text-red-700 mb-2 font-medium">
                          Clicking <strong>Delete &amp; Save New</strong> will remove the
                          existing attendance record{addDuplicate.students.length !== 1 ? "s" : ""} for
                          the above student{addDuplicate.students.length !== 1 ? "s" : ""} and replace
                          them with the new attendance you are submitting.
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void submitAddSession(true)}
                          isLoading={savingAdd}
                        >
                          {addDuplicate.sessionDuplicate ? "Create Anyway" : "Delete & Save New"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAddDuplicate(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setAddOpen(false); setAddDuplicate(null); }} >
                  Cancel
                </Button>
                <Button
                  onClick={() => void submitAddSession(false)}
                  disabled={savingAdd || !addSubjectId || !addBatchId || !addDate}
                >
                  {savingAdd ? "Saving…" : "Create session"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete teacher attendance confirmation ── */}
      {pendingDeleteTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-sm shadow-xl">
            <CardHeader>
              <CardTitle className="text-base text-red-700">Remove teacher attendance?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                This will remove the teacher self-attendance record for this session. The session and student records
                will remain.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingDeleteTeacher(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => void confirmDeleteTeacher()}>
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete session confirmation ── */}
      {pendingDeleteSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-sm shadow-xl">
            <CardHeader>
              <CardTitle className="text-base text-red-700">Delete attendance session?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                This will permanently delete the entire session including all student attendance records and teacher
                self-attendance. This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingDeleteSession(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => void confirmDeleteSession()}>
                  Delete session
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
