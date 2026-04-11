"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 15;

type AttendanceRecord = {
  id: string;
  status: string;
  session: {
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    subject: { name: string } | null;
  };
};

interface Props {
  records: AttendanceRecord[];
}

export function AttendanceTableClient({ records }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const paginated = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance History</CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No attendance records found.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginated.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(record.session.sessionDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.session.subject?.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {record.session.startTime || "—"} -{" "}
                        {record.session.endTime || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            record.status === "PRESENT"
                              ? "success"
                              : record.status === "LATE"
                                ? "warning"
                                : record.status === "EXCUSED"
                                  ? "default"
                                  : "danger"
                          }
                          className={record.status === "EXCUSED" ? "bg-violet-100 text-violet-700" : undefined}
                        >
                          {record.status === "EXCUSED" ? "PRESENT" : record.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={records.length}
              itemLabel="records"
              className="mt-4"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
