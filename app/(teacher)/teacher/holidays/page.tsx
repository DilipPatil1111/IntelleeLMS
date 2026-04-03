"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { holidayBadgeVariant, holidayTypeLabel } from "@/lib/holiday-types";

const PAGE_SIZE = 10;

type Holiday = {
  id: string;
  name: string;
  date: string;
  type: string;
  academicYear: { name: string } | null;
};

export default function TeacherHolidaysViewPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ years: "3", page: String(page), pageSize: String(PAGE_SIZE) });
    void fetch(`/api/teacher/holidays?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setHolidays(d.holidays || []);
        setTotal(typeof d.total === "number" ? d.total : 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <PageHeader
        title="Holidays"
        description="View-only — public holidays, college closures, custom days, summer/winter breaks, and exam preparation leave."
      />
      {loading ? (
        <div className="flex justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {total > 0 && (
            <p className="text-sm text-gray-500">
              {total} holiday{total === 1 ? "" : "s"} in range · {PAGE_SIZE} per page
            </p>
          )}
          {holidays.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div>
                  <p className="font-medium text-gray-900">{h.name}</p>
                  <p className="text-sm text-gray-500">{formatDate(h.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={holidayBadgeVariant(h.type)}>{holidayTypeLabel(h.type)}</Badge>
                  {h.academicYear && <span className="text-xs text-gray-400">{h.academicYear.name}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
          {holidays.length === 0 && <p className="text-gray-500">No holidays in range.</p>}
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">
                Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
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
                  disabled={page >= Math.max(1, Math.ceil(total / PAGE_SIZE))}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
