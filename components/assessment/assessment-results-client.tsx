"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToastContainer } from "@/components/ui/toast-container";
import { useToast } from "@/hooks/use-toast";
import type { AssessmentResultsReportData, DropdownOption } from "@/lib/assessment-detailed-results";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Download, Loader2, Pencil, Save, X } from "lucide-react";

type Role = "teacher" | "principal" | "student";

const ASSESSMENT_TYPES: DropdownOption[] = [
  { value: "QUIZ", label: "Quiz" },
  { value: "TEST", label: "Test" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "PROJECT", label: "Project" },
  { value: "HOMEWORK", label: "Homework" },
];

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type EditableFields = {
  title: string;
  type: string;
  subjectId: string;
  batchId: string;
  totalMarks: string;
  passingMarks: string;
  durationMinutes: string;
  assessmentDate: string;
  createdAt: string;
};

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditableFields | null>(null);
  const { toasts, toast, dismiss } = useToast();

  const canEdit = role !== "student";
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

  function startEditing() {
    if (!data) return;
    const a = data.assessment;
    setEditForm({
      title: a.title,
      type: a.type,
      subjectId: a.subjectId,
      batchId: a.batchId,
      totalMarks: String(a.totalMarks),
      passingMarks: a.passingMarks != null ? String(a.passingMarks) : "",
      durationMinutes: a.durationMinutes != null ? String(a.durationMinutes) : "",
      assessmentDate: toDateInput(a.assessmentDate),
      createdAt: toDateTimeLocal(a.createdAt),
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditForm(null);
  }

  async function saveEdits() {
    if (!editForm || !data) return;
    setSaving(true);

    let assessmentDateISO: string | null = null;
    if (editForm.assessmentDate) {
      assessmentDateISO = new Date(editForm.assessmentDate + "T12:00:00").toISOString();
    }

    let createdAtISO: string | null = null;
    if (editForm.createdAt) {
      createdAtISO = new Date(editForm.createdAt).toISOString();
    }

    const payload: Record<string, unknown> = {
      title: editForm.title,
      type: editForm.type,
      subjectId: editForm.subjectId,
      batchId: editForm.batchId,
      totalMarks: parseFloat(editForm.totalMarks) || 0,
      passingMarks: editForm.passingMarks ? parseFloat(editForm.passingMarks) : null,
      durationMinutes: editForm.durationMinutes ? parseInt(editForm.durationMinutes, 10) : null,
      assessmentDate: assessmentDateISO,
      createdAt: createdAtISO,
    };

    try {
      const res = await fetch(`/api/${apiPrefix}/assessments/${assessmentId}/results-meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast((json as { error?: string }).error || "Failed to save changes", "error");
        setSaving(false);
        return;
      }

      toast("Assessment details updated successfully", "success");
      setEditing(false);
      setEditForm(null);
      await load();
    } catch {
      toast("Network error — could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof EditableFields, value: string) {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

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

  const { assessment, studentResults, collegeName, subjectOptions, batchOptions } = data;
  const resultsTitle = role === "student" ? "Your results" : "Student-wise results";
  const reportSubtitle =
    role === "student" ? "Your detailed assessment report" : "Detailed assessment report";

  const selectedBatch = batchOptions.find((b) => b.value === (editForm?.batchId ?? assessment.batchId));

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
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
            {canEdit && !editing && (
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" /> Edit Details
              </Button>
            )}
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {editing ? "Edit Assessment Details" : assessment.title}
          </CardTitle>
          {editing && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void saveEdits()} disabled={saving} isLoading={saving}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {editing && editForm ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Title"
                value={editForm.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
              <Select
                label="Type"
                options={ASSESSMENT_TYPES}
                value={editForm.type}
                onChange={(e) => updateField("type", e.target.value)}
              />
              <Select
                label="Subject"
                options={subjectOptions}
                value={editForm.subjectId}
                onChange={(e) => updateField("subjectId", e.target.value)}
              />
              <Select
                label="Batch"
                options={batchOptions}
                value={editForm.batchId}
                onChange={(e) => updateField("batchId", e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <p className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {selectedBatch?.label?.split(" — ")[0] || assessment.programName}
                </p>
              </div>
              <Input
                label="Total Marks"
                type="number"
                min="0"
                step="0.5"
                value={editForm.totalMarks}
                onChange={(e) => updateField("totalMarks", e.target.value)}
              />
              <Input
                label="Passing Marks"
                type="number"
                min="0"
                step="0.5"
                value={editForm.passingMarks}
                onChange={(e) => updateField("passingMarks", e.target.value)}
                placeholder="Leave empty for default (50%)"
              />
              <Input
                label="Time Allowed (minutes)"
                type="number"
                min="0"
                value={editForm.durationMinutes}
                onChange={(e) => updateField("durationMinutes", e.target.value)}
                placeholder="Leave empty for unlimited"
              />
              <Input
                label="Assessment Date"
                type="date"
                value={editForm.assessmentDate}
                onChange={(e) => updateField("assessmentDate", e.target.value)}
              />
              <Input
                label="Created Date"
                type="datetime-local"
                value={editForm.createdAt}
                onChange={(e) => updateField("createdAt", e.target.value)}
              />
            </div>
          ) : (
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
          )}
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
