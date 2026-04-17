"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

type SubjectRow = {
  id: string; subjectCode: string | null; subjectName: string;
  finalMarksPct: number | null; grade: string | null;
};

type Transcript = {
  id: string; overallAvgPct: number | null; totalHours: number | null;
  startDate: string | null; endDate: string | null; standing: string | null;
  credential: string | null; remarks: string | null; publishedAt: string | null;
  program: { name: string };
  batch: { name: string } | null;
  subjects: SubjectRow[];
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

export default function StudentTranscriptPage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/transcripts")
      .then((r) => r.json())
      .then((d) => setTranscripts(d.transcripts || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Final Transcripts" description="Your published academic transcripts" />

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading…</div>
      ) : transcripts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium">No transcripts available yet</p>
          <p className="text-sm text-gray-400 mt-1">Your transcript will appear here once published by your institution.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {transcripts.map((t) => (
            <Card key={t.id} className="border-indigo-100 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between pb-3 bg-gradient-to-r from-indigo-50 to-white rounded-t-xl">
                <div>
                  <CardTitle className="text-base text-indigo-900">{t.program.name}</CardTitle>
                  {t.batch && <p className="text-sm text-gray-500 mt-0.5">{t.batch.name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">Published</Badge>
                  <Button size="sm" variant="outline" onClick={() => window.open(`/api/student/transcripts/${t.id}/pdf`, "_blank")}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                  {t.startDate && <div><span className="text-gray-500 block text-xs">Start Date</span><span className="font-medium">{fmtDate(t.startDate)}</span></div>}
                  {t.endDate && <div><span className="text-gray-500 block text-xs">End Date</span><span className="font-medium">{fmtDate(t.endDate)}</span></div>}
                  {t.totalHours && <div><span className="text-gray-500 block text-xs">Total Hours</span><span className="font-medium">{t.totalHours} hrs</span></div>}
                  {t.publishedAt && <div><span className="text-gray-500 block text-xs">Issued</span><span className="font-medium">{fmtDate(t.publishedAt)}</span></div>}
                </div>

                {/* Subject table */}
                <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
                  <table className="min-w-full text-sm">
                    <thead className="bg-indigo-900 text-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold">Course</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold">Subject</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold">Mark %</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {t.subjects.map((s, i) => (
                        <tr key={s.id} className={i % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-4 py-2 text-gray-500 text-xs">{s.subjectCode || "—"}</td>
                          <td className="px-4 py-2">{s.subjectName}</td>
                          <td className="px-4 py-2 text-right font-medium">{s.finalMarksPct != null ? `${s.finalMarksPct}%` : <span className="text-gray-400">WD</span>}</td>
                          <td className={`px-4 py-2 text-center font-bold text-xs ${!s.grade || s.grade === "—" ? "text-gray-400" : s.grade.trim().toUpperCase().startsWith("F") || s.grade.toUpperCase() === "WD" ? "text-red-600" : "text-emerald-700"}`}>{s.grade || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="flex flex-wrap gap-6 text-sm">
                  <div><span className="text-gray-500">Average: </span><strong>{t.overallAvgPct != null ? `${t.overallAvgPct}%` : "—"}</strong></div>
                  <div><span className="text-gray-500">Standing: </span><strong>{t.standing || "—"}</strong></div>
                  <div><span className="text-gray-500">Credential: </span><strong>{t.credential || "Not Awarded"}</strong></div>
                </div>
                {t.remarks && <p className="text-xs text-gray-400 italic mt-2">{t.remarks}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
