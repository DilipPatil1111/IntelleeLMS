"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { StudentAttendanceGridEmbed } from "@/components/attendance/student-attendance-grid-embed";
import { Calendar, CheckCircle2, Clock, Filter } from "lucide-react";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 15;

interface ProgramEntry {
  id: string;
  name: string;
  batchId: string | null;
  batchName: string | null;
  minAttendancePct: number | null;
}

interface AttendanceRecord {
  id: string;
  status: string;
  session: {
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    subject: { id?: string; name: string; program?: { id: string } | null } | null;
  };
}

interface SubjectItem {
  id: string;
  name: string;
}

interface Props {
  programs: ProgramEntry[];
  defaultProgramId: string | null;
  globalRequiredPct: number;
  batchPcts: Record<string, number | null>;
  records: AttendanceRecord[];
  subjects: SubjectItem[];
}

export function AttendancePageClient({ programs, defaultProgramId, globalRequiredPct, batchPcts, records, subjects }: Props) {
  const [selectedProgramId, setSelectedProgramId] = useState(defaultProgramId ?? "");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const selectedProg = programs.find((p) => p.id === selectedProgramId);
  const requiredPct = selectedProg?.minAttendancePct ?? globalRequiredPct;
  const batchPct = selectedProgramId ? batchPcts[selectedProgramId] ?? null : null;

  const filteredRecords = useMemo(() => {
    let filtered = records;

    if (selectedProgramId) {
      filtered = filtered.filter((r) => r.session?.subject?.program?.id === selectedProgramId);
    }

    if (subjectFilter !== "all") {
      filtered = filtered.filter((r) => r.session?.subject?.id === subjectFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter((r) => new Date(r.session.sessionDate) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => new Date(r.session.sessionDate) <= to);
    }

    return filtered;
  }, [records, selectedProgramId, subjectFilter, dateFrom, dateTo]);

  const relevantSubjects = useMemo(() => {
    if (!selectedProgramId) return subjects;
    const subIds = new Set<string>();
    for (const r of records) {
      if (r.session?.subject?.program?.id === selectedProgramId && r.session.subject.id) {
        subIds.add(r.session.subject.id);
      }
    }
    return subjects.filter((s) => subIds.has(s.id));
  }, [records, selectedProgramId, subjects]);

  const total = filteredRecords.length;
  const present = filteredRecords.filter((r) => r.status === "PRESENT" || r.status === "EXCUSED").length;
  const late = filteredRecords.filter((r) => r.status === "LATE").length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { totalDaysAttended, totalHoursAttended } = useMemo(() => {
    const presentRecords = filteredRecords.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "EXCUSED"
    );
    const uniqueDates = new Set(presentRecords.map((r) => r.session.sessionDate?.slice(0, 10)));
    let totalMinutes = 0;
    for (const r of presentRecords) {
      const start = r.session.startTime;
      const end = r.session.endTime;
      if (start && end) {
        const toMin = (t: string) => {
          const parts = t.match(/(\d{1,2}):(\d{2})/);
          if (!parts) return null;
          return parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        };
        const a = toMin(start);
        const b = toMin(end);
        if (a != null && b != null && b > a) totalMinutes += b - a;
      }
    }
    return {
      totalDaysAttended: uniqueDates.size,
      totalHoursAttended: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }, [filteredRecords]);

  function resetFilters() {
    setSubjectFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <>
      <PageHeader title="My Attendance" description="Track your attendance across all subjects" />

      {programs.length > 1 && (
        <div className="mb-6">
          <Select
            label="Select Program"
            value={selectedProgramId}
            onChange={(e) => { setSelectedProgramId(e.target.value); setPage(1); resetFilters(); }}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      )}

      {selectedProg && (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
          <p>
            <strong>{selectedProg.name}</strong>
            {selectedProg.batchName && <> — {selectedProg.batchName}</>}
          </p>
          <p className="mt-1">
            Required attendance: <strong>{requiredPct}%</strong>
            {batchPct != null && (
              <>
                {" · "}
                {batchPct < requiredPct ? (
                  <span className="font-bold text-red-800">
                    Your batch attendance: <strong className="text-red-900">{batchPct}%</strong>{" "}
                    <strong className="text-red-700">(below requirement)</strong>
                  </span>
                ) : (
                  <span className="font-bold text-emerald-800">
                    <CheckCircle2 className="inline h-4 w-4 text-green-600" />{" "}
                    Your batch attendance: <strong className="text-emerald-900">{batchPct}%</strong>{" "}
                    <strong className="text-green-700">(meeting requirement)</strong>
                  </span>
                )}
              </>
            )}
          </p>
          <p className="mt-1 flex flex-wrap gap-4 text-indigo-900">
            <span>
              Total days attended: <strong>{totalDaysAttended}</strong>
            </span>
            <span>
              Total hours attended: <strong>{totalHoursAttended} hrs</strong>
            </span>
          </p>
          <Link href="/student/full-calendar" className="mt-2 inline-block text-indigo-700 underline font-medium">
            View Full Calendar
          </Link>
        </div>
      )}

      {selectedProg?.batchId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Program attendance sheet</CardTitle>
            <p className="text-sm text-gray-500">
              Pick a subject to see your daily attendance (1 / 0 / L) across your batch&apos;s program dates.
            </p>
          </CardHeader>
          <CardContent>
            <StudentAttendanceGridEmbed programId={selectedProgramId || undefined} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Sessions" value={total} icon={<Calendar className="h-5 w-5" />} variant="indigo" />
        <StatCard title="Present" value={present} icon={<CheckCircle2 className="h-5 w-5" />} variant="emerald" />
        <StatCard title="Late" value={late} icon={<Clock className="h-5 w-5" />} variant="amber" />
        <StatCard title="Attendance Rate" value={`${rate}%`} icon={<CheckCircle2 className="h-5 w-5" />} variant={rate >= 75 ? "emerald" : "rose"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            Attendance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[160px]">
              <Select
                label="Subject"
                value={subjectFilter}
                onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
                options={[
                  { value: "all", label: "All Subjects" },
                  ...relevantSubjects.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date" value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date" value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {(subjectFilter !== "all" || dateFrom || dateTo) && (
              <button onClick={resetFilters} className="text-sm text-indigo-600 hover:underline self-end pb-2">
                Clear filters
              </button>
            )}
          </div>

          {filteredRecords.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No attendance records found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {paginated.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatDate(record.session.sessionDate)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.session.subject?.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.session.startTime || "—"} - {record.session.endTime || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={record.status === "PRESENT" ? "success" : record.status === "LATE" ? "warning" : record.status === "EXCUSED" ? "default" : "danger"}
                            className={record.status === "EXCUSED" ? "bg-violet-100 text-violet-700" : undefined}
                          >
                            {record.status === "EXCUSED" ? "PRESENT" : record.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemLabel="records" className="mt-4" />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
