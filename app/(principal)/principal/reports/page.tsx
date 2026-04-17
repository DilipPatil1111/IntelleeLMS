"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Download, Users, GraduationCap, PieChart as PieIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

const STATUS_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#6b7280", "#8b5cf6", "#ec4899"];

export default function PrincipalReportsPage() {
  const [data, setData] = useState<ReportItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [programId, setProgramId] = useState("");

  const loadReports = useCallback(() => {
    const url = programId ? `/api/principal/reports?programId=${programId}` : "/api/principal/reports";
    fetch(url).then((r) => r.json()).then((d) => setData(d.data || []));
    const aq = programId ? `?programId=${programId}` : "";
    fetch(`/api/principal/analytics${aq}`).then((r) => r.json()).then((d) => setAnalytics(d));
  }, [programId]);

  useEffect(() => {
    fetch("/api/principal/programs").then((r) => r.json()).then((d) => {
      setPrograms((d.programs || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })));
    });
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const statusPieData = analytics
    ? Object.entries(analytics.studentsByStatus).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Detailed performance reports with filters"
        actions={
          <a href="/api/teacher/reports/export" target="_blank">
            <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </a>
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

      <div className="mb-6 max-w-xs">
        <Select label="Filter by Program" value={programId} onChange={(e) => setProgramId(e.target.value)} options={programs} placeholder="All Programs" />
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
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
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
                  <li key={row.programId} className="flex justify-between text-sm border-b border-gray-100 pb-2">
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
                  <div key={row.programId} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{row.programName}</p>
                    <p className="text-2xl font-bold text-violet-700 mt-1">{row.count}</p>
                    <p className="text-xs text-gray-400">students</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {data.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Performance by Assessment</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="passed" fill="#10b981" name="Passed" />
                <Bar dataKey="failed" fill="#ef4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
            {data.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.title}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.subject}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.program}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{item.batch}</td>
                <td className="px-4 py-3"><Badge>{item.type}</Badge></td>
                <td className="px-4 py-3 text-sm text-gray-900">{item.totalStudents}</td>
                <td className="px-4 py-3"><Badge variant="success">{item.passed}</Badge></td>
                <td className="px-4 py-3"><Badge variant="danger">{item.failed}</Badge></td>
                <td className="px-4 py-3 text-sm font-medium">{item.avgScore}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
