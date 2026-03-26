"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

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
  records: { studentId: string; status: string }[];
  overrideHoliday: boolean;
  teacherAttendance: { status: string } | null;
}

function TeacherAttendanceInner() {
  const searchParams = useSearchParams();
  const pendingSessionId = searchParams.get("pendingSession");
  const [subjects, setSubjects] = useState<
    { value: string; label: string }[]
  >([]);
  const [batches, setBatches] = useState<{ value: string; label: string }[]>(
    []
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
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

  useEffect(() => {
    fetch("/api/teacher/options")
      .then((r) => r.json())
      .then((data) => {
        setSubjects(data.subjects || []);
        setBatches(data.batches || []);
      });
  }, []);

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
      fetch(
        `/api/teacher/attendance/sessions?subjectId=${subjectId}&batchId=${batchId}`
      )
        .then((r) => r.json())
        .then((data) => {
          setSessions(data.sessions || []);
        });
    }
  }, [subjectId, batchId]);

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
      fetch(`/api/teacher/attendance/sessions?subjectId=${subjectId}&batchId=${batchId}`)
        .then((r) => r.json())
        .then((data) => setSessions(data.sessions || []));
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
      fetch(
        `/api/teacher/attendance/sessions?subjectId=${subjectId}&batchId=${batchId}`
      )
        .then((r) => r.json())
        .then((data) => {
          setSessions(data.sessions || []);
        });
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark and manage student attendance"
      />

      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Select
              label="Subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              options={subjects}
              placeholder="Select subject"
            />
            <Select
              label="Batch"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              options={batches}
              placeholder="Select batch"
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
                    { value: "EXCUSED", label: "Excused" },
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
                    {["PRESENT", "LATE", "ABSENT", "EXCUSED"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setTeacherSelfStatus(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                          teacherSelfStatus === status
                            ? "bg-indigo-600 text-white"
                            : "bg-white border border-gray-200 text-gray-600"
                        }`}
                      >
                        {status}
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
                        <tr key={s.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {s.firstName} {s.lastName}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {["PRESENT", "ABSENT", "LATE", "EXCUSED"].map(
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
                                            : status === "LATE"
                                              ? "bg-yellow-500 text-white"
                                              : "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {status}
                                  </button>
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
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No sessions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
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
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Present
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      You
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Override
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(s.sessionDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {s.subject?.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {s.startTime} - {s.endTime}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {
                          s.records.filter(
                            (r) =>
                              r.status === "PRESENT" || r.status === "LATE"
                          ).length
                        }
                        /{s.records.length}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
