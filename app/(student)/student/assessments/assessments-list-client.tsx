"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { effectiveAssessmentDateForDisplay, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  CheckCircle, Clock, BookOpen, TrendingUp, FileText,
  RotateCcw, ShieldCheck, X, Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";

const PAGE_SIZE = 10;

type Assessment = {
  id: string;
  title: string;
  type: string;
  status: string;
  totalMarks: number;
  passingMarks: number | null;
  scheduledCloseAt: Date | null;
  assessmentDate: string | Date | null;
  createdAt: string | Date;
  subject: { name: string } | null;
  batch: { program: { id: string; name: string } | null } | null;
  attempts: { id: string; status: string; submittedAt: Date | null; totalScore: number | null; percentage: number | null }[];
  _count: { questions: number };
};

interface Props {
  pending: Assessment[];
  historyByProgram: { key: string; programName: string; items: Assessment[] }[];
  retakeStatuses?: Record<string, string>;
}

export function AssessmentsListClient({ pending, historyByProgram, retakeStatuses = {} }: Props) {
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [retakeModal, setRetakeModal] = useState<{ id: string; title: string } | null>(null);
  const [retakeMessage, setRetakeMessage] = useState("");
  const [retakeSubmitting, setRetakeSubmitting] = useState(false);
  const [localRetakeStatuses, setLocalRetakeStatuses] = useState<Record<string, string>>(retakeStatuses);
  const { toasts, toast, dismiss } = useToast();

  const handleRetakeRequest = useCallback(async () => {
    if (!retakeModal) return;
    setRetakeSubmitting(true);
    try {
      const res = await fetch("/api/student/retake-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: retakeModal.id, message: retakeMessage }),
      });
      if (res.ok) {
        setLocalRetakeStatuses((prev) => ({ ...prev, [retakeModal.id]: "PENDING" }));
        setRetakeModal(null);
        setRetakeMessage("");
      } else {
        const errBody = await res.json().catch(() => null);
        toast(errBody?.error ?? "Failed to submit retake request", "error");
      }
    } finally {
      setRetakeSubmitting(false);
    }
  }, [retakeModal, retakeMessage, toast]);

  const pendingTotalPages = Math.ceil(pending.length / PAGE_SIZE);
  const paginatedPending = pending.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);

  const allHistoryItems = historyByProgram.flatMap((g) => g.items);
  const historyTotalPages = Math.ceil(allHistoryItems.length / PAGE_SIZE);
  const paginatedHistory = allHistoryItems.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  const paginatedHistoryGrouped = new Map<string, { programName: string; items: Assessment[] }>();
  for (const item of paginatedHistory) {
    const key = item.batch?.program?.id ?? "other";
    const name = item.batch?.program?.name ?? "Other Assessments";
    if (!paginatedHistoryGrouped.has(key)) paginatedHistoryGrouped.set(key, { programName: name, items: [] });
    paginatedHistoryGrouped.get(key)!.items.push(item);
  }

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      {/* ── Current / Pending ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Current Assessments
        </h2>

        {pending.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-center text-gray-500 py-8 text-sm">
                No pending assessments right now. Check your history below.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedPending.map((assessment) => {
                const attempt = assessment.attempts[0];
                const isInProgress = attempt?.status === "IN_PROGRESS";
                const isAvailable = assessment.status === "PUBLISHED" && !attempt;

                return (
                  <Card key={assessment.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900">{assessment.title}</h3>
                            <Badge variant={assessment.type === "QUIZ" ? "info" : assessment.type === "TEST" ? "warning" : assessment.type === "ASSIGNMENT" ? "default" : "success"}>
                              {assessment.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {assessment.subject?.name}
                            {assessment.batch?.program && <> · {assessment.batch.program.name}</>}
                            {" "}— {assessment._count.questions} questions — {assessment.totalMarks} marks — Assessment date{" "}
                            {formatDate(effectiveAssessmentDateForDisplay(assessment.assessmentDate, assessment.createdAt))}
                          </p>
                          {assessment.scheduledCloseAt && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Due: {formatDate(assessment.scheduledCloseAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isInProgress ? (
                            <Link href={`/student/assessments/${assessment.id}/take`}
                              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors">
                              Continue
                            </Link>
                          ) : isAvailable ? (
                            <Link href={`/student/assessments/${assessment.id}/take`}
                              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
                              Start
                            </Link>
                          ) : (
                            <Badge>Closed</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Pagination
              page={pendingPage}
              totalPages={pendingTotalPages}
              onPageChange={setPendingPage}
              totalItems={pending.length}
              itemLabel="assessments"
              className="mt-4"
            />
          </>
        )}
      </section>

      {/* ── Assessment History ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Assessment History
        </h2>

        {historyByProgram.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-center text-gray-400 py-8 text-sm">
                No completed assessments yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-6">
              {[...paginatedHistoryGrouped.entries()].map(([key, { programName, items }]) => (
                <Card key={key} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-indigo-500" />
                      {programName}
                      <span className="ml-auto text-xs font-normal text-gray-400">
                        {items.length} assessment{items.length !== 1 ? "s" : ""}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                      {items.map((assessment) => {
                        const attempt = assessment.attempts.find(
                          (t) => t.status === "GRADED" || t.status === "SUBMITTED"
                        );
                        const isGraded = attempt?.status === "GRADED";
                        const pct = attempt?.percentage ?? null;
                        const passed = pct !== null && pct >= (assessment.passingMarks && assessment.totalMarks > 0 ? (assessment.passingMarks / assessment.totalMarks) * 100 : 50);

                        return (
                          <div key={assessment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-sm font-medium text-gray-900">{assessment.title}</span>
                                <Badge variant={assessment.type === "QUIZ" ? "info" : "default"} className="text-[10px]">
                                  {assessment.type}
                                </Badge>
                                {isGraded && (
                                  <Badge variant={passed ? "success" : "danger"} className="text-[10px]">
                                    {passed ? "Passed" : "Failed"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {assessment.subject?.name} — {assessment._count.questions} questions — {assessment.totalMarks} marks — Assessment date{" "}
                                {formatDate(effectiveAssessmentDateForDisplay(assessment.assessmentDate, assessment.createdAt))}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {isGraded ? (
                                <div className="flex items-center gap-2">
                                  <div className={`flex items-center justify-center h-12 w-12 rounded-full text-sm font-bold ${passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {pct}%
                                  </div>
                                  <div className="text-xs text-gray-500 leading-tight">
                                    <p className="font-medium">{attempt?.totalScore ?? "—"}/{assessment.totalMarks}</p>
                                    <p>marks</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  Pending grade
                                </div>
                              )}
                              <Link href={`/student/assessments/${assessment.id}/results`}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                                <FileText className="h-3.5 w-3.5" />
                                Results
                              </Link>
                              {(() => {
                                const rrStatus = localRetakeStatuses[assessment.id];
                                if (isGraded && !passed && !rrStatus) {
                                  return (
                                    <button
                                      onClick={() => setRetakeModal({ id: assessment.id, title: assessment.title })}
                                      className="flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Request Retake
                                    </button>
                                  );
                                }
                                if (rrStatus === "PENDING") {
                                  return (
                                    <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-1.5 border border-yellow-200">
                                      <Clock className="h-3.5 w-3.5" /> Retake Requested
                                    </span>
                                  );
                                }
                                if (rrStatus === "APPROVED_RETAKE") {
                                  return (
                                    <Link href={`/student/assessments/${assessment.id}/take`}
                                      className="flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors">
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Retake Now
                                    </Link>
                                  );
                                }
                                if (rrStatus === "EXCUSED") {
                                  return (
                                    <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
                                      <ShieldCheck className="h-3.5 w-3.5" /> Excused
                                    </span>
                                  );
                                }
                                if (rrStatus === "DENIED") {
                                  return (
                                    <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-1.5 border border-red-200">
                                      <X className="h-3.5 w-3.5" /> Denied
                                    </span>
                                  );
                                }
                                if (isGraded && passed) {
                                  return (
                                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                                      <CheckCircle className="h-3.5 w-3.5" /> Passed
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Pagination
              page={historyPage}
              totalPages={historyTotalPages}
              onPageChange={setHistoryPage}
              totalItems={allHistoryItems.length}
              itemLabel="assessments"
              className="mt-4"
            />
          </>
        )}
      </section>

      {/* ── Retake Request Modal ──────────────────────────────────────── */}
      {retakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Request Retake</h3>
              <button
                onClick={() => { setRetakeModal(null); setRetakeMessage(""); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Request a retake for <span className="font-semibold">{retakeModal.title}</span>. Your
                teacher or principal will review this request.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for retake (optional)
                </label>
                <textarea
                  value={retakeMessage}
                  onChange={(e) => setRetakeMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Explain why you'd like to retake this assessment..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button
                variant="outline"
                onClick={() => { setRetakeModal(null); setRetakeMessage(""); }}
                disabled={retakeSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleRetakeRequest} disabled={retakeSubmitting}>
                <Send className="h-3.5 w-3.5 mr-1" />
                {retakeSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
