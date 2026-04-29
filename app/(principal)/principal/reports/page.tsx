"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Users,
  GraduationCap,
  PieChart as PieIcon,
  ChevronDown,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ReportItem {
  id: string;
  title: string;
  subject: string;
  batch: string;
  program: string;
  type: string;
  totalStudents: number;
  passed: number;
  failed: number;
  avgScore: number;
}

interface Analytics {
  totalStudents: number;
  studentsByStatus: Record<string, number>;
  enrollmentByProgram: { programId: string; programName: string; count: number }[];
  totalTeachers: number;
  teacherCountByProgram: { programId: string; name: string; count: number }[];
}

interface BatchOption {
  id: string;
  name: string;
  program?: { id: string } | null;
}

interface StudentOption {
  id: string;
  name: string;
}

const STATUS_COLORS = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
  "#8b5cf6",
  "#ec4899",
];

export default function PrincipalReportsPage() {
  const [data, setData] = useState<ReportItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [allBatches, setAllBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  // All three filters default to "" which the backend treats as "All".
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [studentId, setStudentId] = useState("");

  // Build the current filter querystring once so every dependent fetch /
  // export link stays in sync.
  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (programId) params.set("programId", programId);
    if (batchId) params.set("batchId", batchId);
    if (studentId) params.set("studentId", studentId);
    return params.toString();
  }, [programId, batchId, studentId]);

  const loadReports = useCallback(() => {
    const qs = filterQuery ? `?${filterQuery}` : "";
    fetch(`/api/principal/reports${qs}`)
      .then((r) => r.json())
      .then((d) => setData(d.data || []));
    // Analytics only cares about programId right now, but piping the same
    // param through keeps behaviour identical to the previous page.
    const aq = programId ? `?programId=${programId}` : "";
    fetch(`/api/principal/analytics${aq}`)
      .then((r) => r.json())
      .then((d) => setAnalytics(d));
  }, [filterQuery, programId]);

  // Programs + batches are small and static enough to load once on mount.
  useEffect(() => {
    fetch("/api/principal/programs")
      .then((r) => r.json())
      .then((d) => {
        setPrograms(
          (d.programs || []).map((p: { id: string; name: string }) => ({
            value: p.id,
            label: p.name,
          }))
        );
      });
    fetch("/api/principal/batches")
      .then((r) => r.json())
      .then((d) => {
        setAllBatches(d.batches || []);
      });
  }, []);

  // Re-load the student picker whenever the program or batch filter
  // changes so users only see relevant names.
  useEffect(() => {
    const params = new URLSearchParams();
    if (programId) params.set("programId", programId);
    if (batchId) params.set("batchId", batchId);
    const qs = params.toString();
    fetch(`/api/principal/reports/students${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []));
  }, [programId, batchId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Derive batch options from the cached list so switching program doesn't
  // re-fetch. If the currently selected batch no longer belongs to the
  // chosen program we clear it to avoid stale filter combos.
  const batchOptions = useMemo(() => {
    const filtered = programId
      ? allBatches.filter((b) => b.program?.id === programId)
      : allBatches;
    return filtered.map((b) => ({ value: b.id, label: b.name }));
  }, [allBatches, programId]);

  useEffect(() => {
    if (!batchId) return;
    if (!batchOptions.some((b) => b.value === batchId)) setBatchId("");
  }, [batchId, batchOptions]);

  // Clear student if it's no longer in the filtered list.
  useEffect(() => {
    if (!studentId) return;
    if (!students.some((s) => s.id === studentId)) setStudentId("");
  }, [studentId, students]);

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: s.name })),
    [students]
  );

  const statusPieData = analytics
    ? Object.entries(analytics.studentsByStatus).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const pdfHref = `/api/principal/reports/pdf${filterQuery ? `?${filterQuery}` : ""}`;
  const csvHref = `/api/principal/reports/export${filterQuery ? `?${filterQuery}` : ""}`;

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Detailed performance reports with filters"
        actions={
          <DownloadReportMenu pdfHref={pdfHref} csvHref={csvHref} />
        }
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <Link
          href="/principal/reports/attendance"
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          📊 Attendance Report
          <span className="text-xs text-indigo-500">Student-wise PDF</span>
        </Link>
        <Link
          href="/principal/attendance?tab=sheet"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Attendance Grid
        </Link>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-indigo-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Users className="h-5 w-5" />
                </span>
                Enrollment & student status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-4">
                Total students (filtered): <strong>{analytics.totalStudents}</strong>
              </p>
              {statusPieData.length > 0 && (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {statusPieData.map((_, i) => (
                        <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <GraduationCap className="h-5 w-5" />
                </span>
                Teachers by program
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-gray-600">
                Active teachers (filtered scope): <strong>{analytics.totalTeachers}</strong>
              </p>
              <ul className="space-y-2">
                {analytics.teacherCountByProgram.map((row) => (
                  <li
                    key={row.programId}
                    className="flex justify-between text-sm border-b border-gray-100 pb-2"
                  >
                    <span className="text-gray-700">{row.name}</span>
                    <Badge variant="info">{row.count} teachers</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-violet-100 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-violet-600" />
                Enrollment by program
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {analytics.enrollmentByProgram.map((row) => (
                  <div
                    key={row.programId}
                    className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      {row.programName}
                    </p>
                    <p className="text-2xl font-bold text-violet-700 mt-1">{row.count}</p>
                    <p className="text-xs text-gray-400">students</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters for the Performance by Assessment table. All three default
          to "All"; changing program/batch also narrows the student list. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Performance by Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Select
              label="Program"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              options={programs}
              placeholder="All Programs"
            />
            <Select
              label="Batch"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              options={batchOptions}
              placeholder="All Batches"
            />
            <Select
              label="Student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              options={studentOptions}
              placeholder="All Students"
            />
          </div>

          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="title"
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="passed" fill="#10b981" name="Passed" />
                <Bar dataKey="failed" fill="#ef4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">
              No assessments match the selected filters.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Assessment</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Program</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Batch</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Students</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Passed</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Failed</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Avg Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No results for the selected filters.
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {item.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.subject}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.program}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.batch}</td>
                  <td className="px-4 py-3">
                    <Badge>{item.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {item.totalStudents}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="success">{item.passed}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="danger">{item.failed}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{item.avgScore}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Small dropdown that replaces the old single "Export CSV" button.
 * Offers both PDF and CSV downloads; both links carry the current filter
 * querystring so the download matches what's on screen.
 */
function DownloadReportMenu({
  pdfHref,
  csvHref,
}: {
  pdfHref: string;
  csvHref: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape so the menu behaves like native
  // dropdowns without needing a heavy component library.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-4 w-4 mr-1" /> Download report
        <ChevronDown className="h-4 w-4 ml-1" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 origin-top-right overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <FileText className="h-4 w-4 text-indigo-600" />
            Download as PDF
          </a>
          <a
            href={csvHref}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Download as CSV
          </a>
        </div>
      )}
    </div>
  );
}
