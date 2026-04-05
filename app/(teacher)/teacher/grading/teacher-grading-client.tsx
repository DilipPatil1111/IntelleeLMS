"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

const PAGE_SIZE = 10;

type AttemptRow = {
  id: string;
  status: string;
  submittedAt: Date | string | null;
  totalScore: number | null;
  percentage: number | null;
  student: { firstName: string; lastName: string };
  assessment: { title: string; totalMarks: number; subject: { name: string } | null };
};

export function TeacherGradingQueueClient() {
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId") || "";

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (assessmentId) params.set("assessmentId", assessmentId);
    const res = await fetch(`/api/teacher/grading-queue?${params.toString()}`);
    const data = await res.json();
    setAttempts(data.attempts || []);
    setTotal(typeof data.total === "number" ? data.total : 0);
    setLoading(false);
  }, [page, assessmentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Grading Queue" description="Review and grade student submissions" />

      {loading ? (
        <p className="text-center text-gray-500 py-8">Loading…</p>
      ) : total === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-500 py-8">No submissions to grade.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {attempts.map((attempt) => (
              <Card key={attempt.id}>
                <CardContent>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {attempt.student.firstName} {attempt.student.lastName}
                        </h3>
                        <Badge variant={attempt.status === "GRADED" ? "success" : "warning"}>{attempt.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {attempt.assessment.title} — {attempt.assessment.subject?.name}
                        {attempt.submittedAt && ` — Submitted ${formatDateTime(attempt.submittedAt)}`}
                      </p>
                      {attempt.totalScore !== null && (
                        <p className="mt-1 text-xs text-gray-500">
                          Score: {attempt.totalScore}/{attempt.assessment.totalMarks} ({attempt.percentage}%)
                        </p>
                      )}
                    </div>
                    <Link href={`/teacher/grading/${attempt.id}`}>
                      <button
                        type="button"
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        {attempt.status === "GRADED" ? "Review" : "Grade"}
                      </button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">
                {total} submission{total === 1 ? "" : "s"} total · {PAGE_SIZE} per page · Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
