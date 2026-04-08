"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";
import { Loader2, Calendar } from "lucide-react";
import { holidayBadgeVariant, holidayTypeDotClass, holidayTypeLabel } from "@/lib/holiday-types";

type Holiday = {
  id: string;
  name: string;
  date: string;
  type: string;
  programId: string | null;
  program: { id: string; name: string } | null;
  academicYear: { name: string } | null;
};

type ProgramOpt = { id: string; name: string };

const PAGE_SIZE = 15;

export default function TeacherHolidaysViewPage() {
  const [allHolidays, setAllHolidays] = useState<Holiday[]>([]);
  const [_totalFromApi, setTotalFromApi] = useState(0);
  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  /* eslint-disable react-hooks/set-state-in-effect -- data fetch on filter change */
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ years: "3", page: "1", pageSize: "500" });
    if (selectedProgramId !== "all") params.set("programId", selectedProgramId);

    void fetch(`/api/teacher/holidays?${params}`)
      .then((r) => r.json())
      .then((d) => {
        // API may return paginated subset; for client-side filtering we request a large page
        const all: Holiday[] = d.holidays || [];
        // Reconstruct all from publicHolidays + byProgram if available
        const publicH: Holiday[] = d.publicHolidays || [];
        const byProg: Record<string, Holiday[]> = d.byProgram || {};
        const combined = [...publicH];
        for (const pId of Object.keys(byProg)) {
          for (const h of byProg[pId]) {
            if (!combined.find((c) => c.id === h.id)) combined.push(h);
          }
        }
        // Use the combined set if larger, else fall back to holidays array
        const fullSet = combined.length >= all.length ? combined : all;
        fullSet.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setAllHolidays(fullSet);
        setTotalFromApi(d.total ?? fullSet.length);
        setPrograms(d.programs || []);
        setPage(1);
      })
      .finally(() => setLoading(false));
  }, [selectedProgramId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Filter client-side
  const filtered =
    selectedProgramId === "all"
      ? allHolidays
      : allHolidays.filter((h) => !h.programId || h.programId === selectedProgramId);

  const publicHolidays = filtered.filter((h) => !h.programId);
  const customHolidays = filtered.filter((h) => !!h.programId);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Holidays"
        description="View-only — public holidays and program-specific custom holidays for your assigned programs."
      />

      {loading ? (
        <div className="flex justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {programs.length > 1 && (
            <div className="mb-6 max-w-sm">
              <Select
                label="Filter by Program"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                options={[
                  { value: "all", label: "All Programs" },
                  ...programs.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
          )}

          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-800">Public Holidays</span>
              </div>
              <p className="text-2xl font-bold text-red-900">{publicHolidays.length}</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-800">Program Holidays</span>
              </div>
              <p className="text-2xl font-bold text-indigo-900">{customHolidays.length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            </div>
          </div>

          {/* Holiday list */}
          <div className="space-y-2">
            {paginated.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 shrink-0 rounded-full ${holidayTypeDotClass(h.type)}`} />
                    <div>
                      <p className="font-medium text-gray-900">{h.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(h.date)}
                        {h.program && <span className="ml-1.5 text-indigo-600">· {h.program.name}</span>}
                        {h.academicYear && <span className="ml-1.5 text-gray-400">· {h.academicYear.name}</span>}
                      </p>
                    </div>
                  </div>
                  <Badge variant={holidayBadgeVariant(h.type)} dot>{holidayTypeLabel(h.type)}</Badge>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="text-gray-500 py-8 text-center">No holidays in range for your programs.</p>
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filtered.length}
            itemLabel="holidays"
            className="mt-4"
          />
        </>
      )}
    </>
  );
}
