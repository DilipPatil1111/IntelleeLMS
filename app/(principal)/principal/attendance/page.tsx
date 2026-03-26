"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, LayoutGrid } from "lucide-react";

interface StudentSession {
  id: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  overrideHoliday: boolean;
  subject: { name: string };
  batch: { name: string; program?: { name: string } };
  records: { student: { firstName: string; lastName: string }; status: string }[];
}

interface TeacherAttRow {
  id: string;
  status: string;
  teacher: { firstName: string; lastName: string; email: string };
  session: {
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    subject: { name: string };
    batch: { name: string; program: { name: string }; academicYear: { name: string } };
  };
}

export default function PrincipalAttendancePage() {
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherAttRow[]>([]);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string }[]>([]);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    fetch("/api/principal/programs")
      .then((r) => r.json())
      .then((d) =>
        setPrograms((d.programs || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })))
      );
    fetch("/api/principal/batches")
      .then((r) => r.json())
      .then((d) =>
        setBatches((d.batches || []).map((b: { id: string; name: string; program: { name: string } }) => ({
          value: b.id,
          label: `${b.name} — ${b.program?.name || ""}`,
        })))
      );
  }, []);

  function loadStudentSessions() {
    const q = new URLSearchParams();
    if (batchId) q.set("batchId", batchId);
    if (programId) q.set("programId", programId);
    const url = `/api/principal/attendance${q.toString() ? `?${q}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []));
  }

  function loadTeacherRows() {
    const q = new URLSearchParams();
    if (batchId) q.set("batchId", batchId);
    if (programId) q.set("programId", programId);
    fetch(`/api/principal/teacher-attendance?${q}`)
      .then((r) => r.json())
      .then((data) => setTeacherRows(data.records || []));
  }

  useEffect(() => {
    loadStudentSessions();
    loadTeacherRows();
  }, [batchId, programId]);

  const tabBtn = (id: "student" | "teacher", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
        tab === id ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Program / batch views for student sessions and teacher self-attendance"
      />

      <div className="flex flex-wrap gap-3 mb-6">
        {tabBtn("student", "Student attendance", <Users className="h-4 w-4" />)}
        {tabBtn("teacher", "Teacher attendance", <UserCheck className="h-4 w-4" />)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Select
          label="Program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          options={programs}
          placeholder="All programs"
        />
        <Select
          label="Batch"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          options={batches}
          placeholder="All batches"
        />
      </div>

      {tab === "student" && (
        <>
          {sessions.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-center text-gray-500 py-8">No student attendance sessions match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sessions.map((s) => {
                const present = s.records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
                return (
                  <Card key={s.id}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                            <LayoutGrid className="h-5 w-5" />
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {s.subject?.name} — {s.batch?.name}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {s.batch?.program?.name && <span>{s.batch.program.name} · </span>}
                              {new Date(s.sessionDate).toLocaleDateString()}{" "}
                              {s.startTime && `| ${s.startTime} - ${s.endTime}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="success">
                            {present}/{s.records.length} present
                          </Badge>
                          {s.overrideHoliday && <Badge variant="warning">Holiday override</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "teacher" && (
        <Card>
          <CardHeader>
            <CardTitle>Teacher self-attendance (by session)</CardTitle>
          </CardHeader>
          <CardContent>
            {teacherRows.length === 0 ? (
              <p className="text-center text-gray-500 py-6">No teacher attendance records for these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Teacher</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Program / batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {teacherRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-sm">
                          {row.teacher.firstName} {row.teacher.lastName}
                          <br />
                          <span className="text-xs text-gray-400">{row.teacher.email}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.session.batch.program.name}
                          <br />
                          <span className="text-xs">{row.session.batch.name} · {row.session.batch.academicYear.name}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{row.session.subject.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(row.session.sessionDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={row.status === "PRESENT" ? "success" : row.status === "ABSENT" ? "danger" : "warning"}>
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
