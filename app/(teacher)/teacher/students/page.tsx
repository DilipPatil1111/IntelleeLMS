"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  studentProfile: {
    program: { name: string } | null;
    batch: { name: string; programId: string } | null;
  } | null;
  attempts: { percentage: number | null }[];
  attendanceRecords: { status: string }[];
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string; programId: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/teacher/programs");
      const data = await res.json();
      setPrograms(data.raw || []);
    })();
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (programId) params.set("programId", programId);
    if (batchId) params.set("batchId", batchId);
    const qs = params.toString();
    const res = await fetch(`/api/teacher/roster${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    setStudents(data.students || []);
    if (Array.isArray(data.batches) && data.batches.length > 0) {
      setBatches(data.batches);
    }
  }, [debouncedQ, programId, batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const batchOptions = useMemo(() => {
    const list = programId ? batches.filter((b) => b.programId === programId) : batches;
    return list.map((b) => ({ value: b.id, label: b.name }));
  }, [batches, programId]);

  return (
    <>
      <PageHeader title="My Students" description="Students in your assigned batches" />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Input
            label="Search student"
            placeholder="Name, email, enrollment no."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-full min-w-[160px] sm:w-52">
          <Select
            label="Program"
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setBatchId("");
            }}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="All programs"
          />
        </div>
        <div className="w-full min-w-[160px] sm:w-52">
          <Select
            label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            options={batchOptions}
            placeholder="All batches"
          />
        </div>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-gray-500">No students match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Program</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Avg Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {students.map((s) => {
                const avg =
                  s.attempts.length > 0
                    ? Math.round(
                        s.attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / s.attempts.length
                      )
                    : 0;
                const total = s.attendanceRecords.length;
                const present = s.attendanceRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
                const attRate = total > 0 ? Math.round((present / total) * 100) : 0;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.studentProfile?.program?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.studentProfile?.batch?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={avg >= 50 ? "success" : avg > 0 ? "danger" : "default"}>{avg}%</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={attRate >= 75 ? "success" : attRate >= 50 ? "warning" : "danger"}>
                        {attRate}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
