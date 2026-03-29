"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentResultsReportData } from "@/lib/assessment-detailed-results";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

type Role = "teacher" | "principal" | "student";

export function AssessmentResultsClient({
  assessmentId,
  role,
}: {
  assessmentId: string;
  role: Role;
}) {
  const [data, setData] = useState<AssessmentResultsReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  const apiPrefix =
    role === "principal" ? "principal" : role === "student" ? "student" : "teacher";
  const backHref =
    role === "principal"
      ? "/principal/assessments"
      : role === "student"
        ? "/student/assessments"
        : `/teacher/assessments/${assessmentId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/${apiPrefix}/assessments/${assessmentId}/detailed-results`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as { error?: string }).error || "Could not load results.");
      setData(null);
    } else {
      setData(json as AssessmentResultsReportData);
    }
    setLoading(false);
  }, [apiPrefix, assessmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/principal/assessments/${assessmentId}/results/pdf`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("Could not generate PDF.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const nameMatch = cd?.match(/filename="([^"]+)"/);
      const filename = nameMatch?.[1] ?? "assessment-results.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading results…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        <p>{error || "No data."}</p>
        <Link href={backHref} className="mt-4 inline-block text-indigo-600 underline">
          Go back
        </Link>
      </div>
    );
  }

  const { assessment, studentResults, collegeName } = data;
  const resultsTitle = role === "student" ? "Your results" : "Student-wise results";
  const reportSubtitle =
    role === "student" ? "Your detailed assessment report" : "Detailed assessment report";

  return (
    <>
      <PageHeader
        title={resultsTitle}
        description={`${assessment.title} — ${assessment.programName} — ${assessment.batchName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={backHref}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </Link>
            {role === "principal" && (
              <Button onClick={() => void downloadPdf()} disabled={pdfLoading} isLoading={pdfLoading}>
                <Download className="h-4 w-4 mr-1" /> Download PDF
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 to-white p-6 shadow-sm">
        <p className="text-center text-xl font-semibold text-indigo-950">{collegeName}</p>
        <p className="text-center text-sm text-gray-600 mt-1">{reportSubtitle}</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">{assessment.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Type</dt>
              <dd>
                <Badge>{assessment.type}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Subject</dt>
              <dd className="font-medium">{assessment.subjectName}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Program</dt>
              <dd className="font-medium">{assessment.programName}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Batch</dt>
              <dd className="font-medium">{assessment.batchName}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Total marks</dt>
              <dd className="font-medium">{assessment.totalMarks}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Passing marks</dt>
              <dd className="font-medium">{assessment.passingMarks ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Time allowed</dt>
              <dd>{assessment.durationMinutes != null ? `${assessment.durationMinutes} min` : "Unlimited"}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Assessment date</dt>
              <dd>{assessment.assessmentDate ? formatDateTime(assessment.assessmentDate) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Created</dt>
              <dd>{formatDateTime(assessment.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-gray-100 py-1">
              <dt className="text-gray-500">Teacher</dt>
              <dd className="font-medium">{assessment.creatorName}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-8">
        {studentResults.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {role === "student" ? "No submission found for this assessment." : "No submissions yet."}
          </p>
        ) : (
          studentResults.map((s) => (
            <Card key={s.attemptId}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-base">
                    {s.studentName}
                    {s.enrollmentNo && (
                      <span className="text-sm font-normal text-gray-500 ml-2">({s.enrollmentNo})</span>
                    )}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={s.attemptStatus === "GRADED" ? "success" : "warning"}>{s.attemptStatus}</Badge>
                    <Badge variant={s.passFail === "PASS" ? "success" : s.passFail === "FAIL" ? "danger" : "default"}>
                      {s.passFail}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Score: {s.totalScore != null ? `${s.totalScore} / ${assessment.totalMarks}` : "—"} (
                      {s.percentage != null ? `${s.percentage}%` : "—"})
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Started {formatDateTime(s.startedAt)}
                  {s.submittedAt && <> — Submitted {formatDateTime(s.submittedAt)}</>}
                  {s.durationMinutes != null && <> — Duration {s.durationMinutes} min</>}
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                        <th className="py-2 pr-2 w-10">#</th>
                        <th className="py-2 pr-2 min-w-[180px]">Question</th>
                        <th className="py-2 pr-2 min-w-[140px]">Student answer</th>
                        <th className="py-2 pr-2 min-w-[140px]">Correct / key</th>
                        <th className="py-2 pr-2">Marks</th>
                        <th className="py-2">Correct?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.questions.map((q) => (
                        <tr key={q.orderIndex} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-2 text-gray-500">{q.orderIndex}</td>
                          <td className="py-2 pr-2">
                            <span className="text-xs text-gray-400 mr-1">{q.questionType}</span>
                            {q.questionText}
                          </td>
                          <td className="py-2 pr-2 text-gray-800">{q.studentAnswerDisplay}</td>
                          <td className="py-2 pr-2 text-gray-600">{q.correctAnswerDisplay}</td>
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {q.score} / {q.maxMarks}
                          </td>
                          <td className="py-2">
                            {q.isCorrect === null ? "—" : q.isCorrect ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
