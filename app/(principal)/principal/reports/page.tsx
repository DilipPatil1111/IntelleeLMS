"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

export default function PrincipalReportsPage() {
  const [data, setData] = useState<ReportItem[]>([]);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [programId, setProgramId] = useState("");

  useEffect(() => {
    fetch("/api/principal/programs").then((r) => r.json()).then((d) => {
      setPrograms((d.programs || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })));
    });
    loadReports();
  }, []);

  function loadReports() {
    const url = programId ? `/api/principal/reports?programId=${programId}` : "/api/principal/reports";
    fetch(url).then((r) => r.json()).then((d) => setData(d.data || []));
  }

  useEffect(() => { loadReports(); }, [programId]);

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

      <div className="mb-6 max-w-xs">
        <Select label="Filter by Program" value={programId} onChange={(e) => setProgramId(e.target.value)} options={programs} placeholder="All Programs" />
      </div>

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
