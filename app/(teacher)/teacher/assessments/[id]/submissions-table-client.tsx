"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 15;

interface Attempt {
  id: string;
  studentName: string;
  status: string;
  totalScore: number | null;
  totalMarks: number;
  percentage: number | null;
  submittedAt: string | null;
}

export function SubmissionsTableClient({ attempts }: { attempts: Attempt[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(attempts.length / PAGE_SIZE);
  const paginated = attempts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (attempts.length === 0) {
    return <p className="text-center text-gray-500 py-4">No submissions yet.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Student</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginated.map((attempt) => (
              <tr key={attempt.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{attempt.studentName}</td>
                <td className="px-4 py-3">
                  <Badge variant={attempt.status === "GRADED" ? "success" : attempt.status === "SUBMITTED" ? "warning" : "default"}>
                    {attempt.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">
                  {attempt.totalScore !== null
                    ? `${attempt.totalScore}/${attempt.totalMarks} (${attempt.percentage}%)`
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {attempt.submittedAt
                    ? new Date(attempt.submittedAt).toLocaleString()
                    : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={attempts.length}
          itemLabel="submissions"
        />
      </div>
    </>
  );
}
