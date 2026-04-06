"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { CheckCircle, Clock, BookOpen, TrendingUp, FileText } from "lucide-react";

const PAGE_SIZE = 10;

type Assessment = {
  id: string;
  title: string;
  type: string;
  status: string;
  totalMarks: number;
  passingMarks: number | null;
  scheduledCloseAt: Date | null;
  subject: { name: string } | null;
  batch: { program: { id: string; name: string } | null } | null;
  attempts: { id: string; status: string; submittedAt: Date | null; totalScore: number | null; percentage: number | null }[];
  _count: { questions: number };
};

interface Props {
  pending: Assessment[];
  historyByProgram: { key: string; programName: string; items: Assessment[] }[];
}

export function AssessmentsListClient({ pending, historyByProgram }: Props) {
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

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
                            {" "}— {assessment._count.questions} questions — {assessment.totalMarks} marks
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
                                {assessment.subject?.name} — {assessment._count.questions} questions — {assessment.totalMarks} marks
                                {attempt?.submittedAt && <> · Submitted {formatDate(attempt.submittedAt)}</>}
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
                              {isGraded && (
                                <Link href={`/student/assessments/${assessment.id}/take`}
                                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Retake
                                </Link>
                              )}
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
    </>
  );
}
