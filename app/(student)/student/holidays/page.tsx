"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { holidayBadgeVariant, holidayTypeLabel } from "@/lib/holiday-types";

type Holiday = {
  id: string;
  name: string;
  date: string;
  type: string;
  academicYear: { name: string } | null;
};

export default function StudentHolidaysViewPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/student/holidays")
      .then((r) => r.json())
      .then((d) => setHolidays(d.holidays || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Holidays"
        description="Holidays and breaks for your academic year (view only): public, college, breaks, exam prep, and custom."
      />
      {loading ? (
        <div className="flex justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {holidays.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div>
                  <p className="font-medium text-gray-900">{h.name}</p>
                  <p className="text-sm text-gray-500">{formatDate(h.date)}</p>
                </div>
                <Badge variant={holidayBadgeVariant(h.type)}>{holidayTypeLabel(h.type)}</Badge>
              </CardContent>
            </Card>
          ))}
          {holidays.length === 0 && <p className="text-gray-500">No holidays listed for your batch year.</p>}
        </div>
      )}
    </>
  );
}
