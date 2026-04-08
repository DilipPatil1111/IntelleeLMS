"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Download, Filter } from "lucide-react";
import {
  HOLIDAY_TYPE_FORM_OPTIONS,
  holidayBadgeVariant,
  holidayTypeDotClass,
  holidayTypeLabel,
} from "@/lib/holiday-types";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  academicYearId?: string | null;
  programId?: string | null;
  program?: { id: string; name: string } | null;
}

interface ProgramOpt {
  id: string;
  name: string;
}

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [byYear, setByYear] = useState<Record<string, Holiday[]>>({});
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);
  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [filterProgramId, setFilterProgramId] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState({ name: "", date: "", type: "PUBLIC", academicYearId: "", programId: "" });

  const loadHolidays = useCallback(async () => {
    const params = new URLSearchParams({ years: "2" });
    if (filterProgramId && filterProgramId !== "all") params.set("programId", filterProgramId);

    const [hRes, yRes, pRes] = await Promise.all([
      fetch(`/api/principal/holidays?${params}`),
      fetch("/api/principal/academic-years"),
      fetch("/api/principal/programs"),
    ]);
    const data = await hRes.json();
    const yData = await yRes.json();
    const pData = await pRes.json();
    setHolidays(data.holidays || []);
    setByYear(data.byYear || {});
    setYears((yData.years || []).map((y: { id: string; name: string }) => ({ value: y.id, label: y.name })));
    setPrograms((pData.programs || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
  }, [filterProgramId]);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  async function handleSave() {
    const url = editing ? `/api/principal/holidays/${editing.id}` : "/api/principal/holidays";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setEditing(null);
    setForm({ name: "", date: "", type: "PUBLIC", academicYearId: "", programId: "" });
    loadHolidays();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/principal/holidays/${id}`, { method: "DELETE" });
    loadHolidays();
  }

  // Separate public/global and program-specific for display
  const publicHolidays = holidays.filter((h) => !h.programId);
  const programHolidays = holidays.filter((h) => !!h.programId);
  const programGroups = new Map<string, { name: string; holidays: Holiday[] }>();
  for (const h of programHolidays) {
    const pid = h.programId!;
    const pName = h.program?.name || "Unknown Program";
    if (!programGroups.has(pid)) programGroups.set(pid, { name: pName, holidays: [] });
    programGroups.get(pid)!.holidays.push(h);
  }

  return (
    <>
      <PageHeader
        title="Holidays"
        description="Manage public holidays and program-specific custom holidays for the whole academic year. Public holidays apply to all programs; custom holidays can be assigned to a specific program."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const rows = [["Name", "Date", "Type", "Program"], ...holidays.map((h) => [h.name, h.date, h.type, h.program?.name || "All Programs"])];
                const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `holidays-${new Date().getFullYear()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Download CSV
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setForm({ name: "", date: "", type: "PUBLIC", academicYearId: "", programId: "" });
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Holiday
            </Button>
          </div>
        }
      />

      {/* Program filter */}
      <div className="mb-6 flex items-end gap-3 flex-wrap">
        <div className="min-w-[200px]">
          <Select
            label="Filter by Program"
            value={filterProgramId}
            onChange={(e) => setFilterProgramId(e.target.value)}
            options={[
              { value: "all", label: "All Programs" },
              ...programs.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 pb-2">
          <Filter className="h-4 w-4" />
          Showing {publicHolidays.length} public + {programHolidays.length} custom holidays
        </div>
      </div>

      {/* Public holidays section */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Public & Institution-Wide Holidays ({publicHolidays.length})
        </h2>
        {publicHolidays.length === 0 ? (
          <p className="text-sm text-gray-500 ml-5">No public holidays added yet.</p>
        ) : (
          <div className="space-y-2">
            {publicHolidays.map((h) => (
              <HolidayCard
                key={h.id}
                holiday={h}
                onEdit={() => {
                  setEditing(h);
                  setForm({ name: h.name, date: toDateInputValue(h.date), type: h.type, academicYearId: h.academicYearId || "", programId: h.programId || "" });
                  setShowModal(true);
                }}
                onDelete={() => handleDelete(h.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Program-specific holidays */}
      {programGroups.size > 0 && (
        <div className="space-y-6 mb-8">
          {Array.from(programGroups.entries()).map(([pid, group]) => (
            <div key={pid}>
              <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                {group.name} — Custom Holidays ({group.holidays.length})
              </h2>
              <div className="space-y-2">
                {group.holidays.map((h) => (
                  <HolidayCard
                    key={h.id}
                    holiday={h}
                    onEdit={() => {
                      setEditing(h);
                      setForm({ name: h.name, date: toDateInputValue(h.date), type: h.type, academicYearId: h.academicYearId || "", programId: h.programId || "" });
                      setShowModal(true);
                    }}
                    onDelete={() => handleDelete(h.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline by year (shows all) */}
      {Object.keys(byYear).length > 0 && (
        <div className="mb-8 space-y-6">
          <h2 className="text-base font-semibold text-gray-800">Timeline View</h2>
          {Object.keys(byYear)
            .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
            .map((year) => (
              <div key={year}>
                <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  Calendar year {year}
                </h3>
                <div className="space-y-2 pl-2 border-l-2 border-indigo-100">
                  {(byYear[year] || []).map((h) => (
                    <p key={h.id} className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">{h.name}</span> — {new Date(h.date).toLocaleDateString()}
                      {h.program && <span className="ml-1.5 text-xs text-indigo-600">({h.program.name})</span>}
                    </p>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Holiday" : "Add Holiday"}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Christmas Day"
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={HOLIDAY_TYPE_FORM_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />
          <Select
            label="Program (optional — leave blank for institution-wide / public holiday)"
            value={form.programId}
            onChange={(e) => setForm({ ...form, programId: e.target.value })}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="All Programs (institution-wide)"
          />
          <p className="text-xs text-gray-500">
            Public holidays apply to all programs. To add a custom holiday specific to one program, select the program above.
            For multi-day breaks, add one entry per date.
          </p>
          <Select
            label="Academic year (emails current-year students when this matches current year)"
            value={form.academicYearId}
            onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
            options={years}
            placeholder="Optional"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function HolidayCard({
  holiday,
  onEdit,
  onDelete,
}: {
  holiday: Holiday;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 shrink-0 rounded-full ${holidayTypeDotClass(holiday.type)}`} />
            <div>
              <p className="text-sm font-medium text-gray-900">{holiday.name}</p>
              <p className="text-xs text-gray-500">
                {new Date(holiday.date).toLocaleDateString()}
                {holiday.program && <span className="ml-1.5 text-indigo-600">· {holiday.program.name}</span>}
              </p>
            </div>
            <Badge variant={holidayBadgeVariant(holiday.type)} dot>{holidayTypeLabel(holiday.type)}</Badge>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-indigo-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
