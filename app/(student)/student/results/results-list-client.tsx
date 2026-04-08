"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 10;

type Attempt = {
  id: string;
  status: string;
  totalScore: number | null;
  percentage: number | null;
  feedback: string | null;
  submittedAt: string | null;
  createdAt: string;
  assessment: {
    title: string;
    type: string;
    totalMarks: number;
    passingMarks: number | null;
    subject: { name: string } | null;
  };
};

interface Props {
  attempts: Attempt[];
}

export function ResultsListClient({ attempts }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(attempts.length / PAGE_SIZE);
  const paginated = attempts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (attempts.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-center text-gray-500 py-8">No results yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {paginated.map((attempt) => (
          <Card key={attempt.id}>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {attempt.assessment.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {attempt.assessment.subject?.name} —{" "}
                    {attempt.assessment.type} —{" "}
                    {formatDate(attempt.submittedAt || attempt.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {attempt.status === "GRADED" ? (
                    <>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          {attempt.totalScore}/{attempt.assessment.totalMarks}
                        </p>
                        <p className="text-xs text-gray-500">
                          {attempt.percentage}%
                        </p>
                      </div>
                      <Badge
                        variant={
                          attempt.percentage &&
                          attempt.percentage >=
                            (attempt.assessment.passingMarks
                              ? (attempt.assessment.passingMarks /
                                  attempt.assessment.totalMarks) *
                                100
                              : 50)
                            ? "success"
                            : "danger"
                        }
                      >
                        {attempt.percentage &&
                        attempt.percentage >=
                          (attempt.assessment.passingMarks
                            ? (attempt.assessment.passingMarks /
                                attempt.assessment.totalMarks) *
                              100
                            : 50)
                          ? "PASS"
                          : "FAIL"}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="warning">Awaiting Grade</Badge>
                  )}
                </div>
              </div>
              {attempt.feedback && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Feedback:</span>{" "}
                    {attempt.feedback}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={attempts.length}
        itemLabel="results"
        className="mt-4"
      />
    </>
  );
}
