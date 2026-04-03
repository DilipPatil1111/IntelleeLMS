"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, LayoutGrid } from "lucide-react";

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
  { value: "EXCUSED", label: "Excused" },
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!addBatchId || !programId) {
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

  async function deleteTeacherAttendanceRow(id: string) {
    if (!confirm("Remove teacher attendance for this session?")) return;
    const res = await fetch(`/api/principal/teacher-attendance/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  async function deleteSession(id: string) {
    if (!confirm("Delete this entire attendance session (all student and teacher attendance records)?")) return;
    const res = await fetch(`/api/principal/attendance/session/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  async function submitAddSession() {
    if (!addSubjectId || !addBatchId || !addDate || !programId) return;
    setSavingAdd(true);
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
      }),
    });
    setSavingAdd(false);
    if (res.ok) {
      setAddOpen(false);
      void load();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(typeof err?.error === "string" ? err.error : "Could not create session");
    }
  }

  const th = "px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500";
  const td = "px-3 py-2 text-sm text-gray-800";

  return (
    <div className="space-y-8">
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
                <p className="text-xs font-medium text-gray-500">Student attendance (P/A/L/E)</p>
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
            <strong>P</strong>resent / <strong>A</strong>bsent / <strong>L</strong>ate / <strong>E</strong>xcused —{" "}
            <strong>Excused</strong> means an approved absence (for example medical leave or a college-sanctioned event). It is
            counted separately from unexcused <strong>Absent</strong>, so reports can tell the difference.
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
                        <td className={td}>{r.present}</td>
                        <td className={td}>{r.absent}</td>
                        <td className={td}>{r.late}</td>
                        <td className={td}>{r.present + r.late}</td>
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
                          {r.present}/{r.absent}/{r.late}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
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
                  {data.sessions.map((s) => (
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
                            <Badge variant={s.teacherAttendance.status === "PRESENT" ? "success" : "warning"}>
                              {s.teacherAttendance.status}
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
                              onClick={() => void deleteTeacherAttendanceRow(s.teacherAttendance!.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className={td}>
                        <Button variant="outline" size="sm" onClick={() => void deleteSession(s.id)}>
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
                        <option value="EXCUSED">Excused</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void submitAddSession()} disabled={savingAdd || !addSubjectId || !addBatchId || !addDate}>
                  {savingAdd ? "Saving…" : "Create session"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
