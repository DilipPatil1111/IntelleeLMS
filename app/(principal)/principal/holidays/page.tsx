"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
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
}

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [byYear, setByYear] = useState<Record<string, Holiday[]>>({});
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState({ name: "", date: "", type: "PUBLIC", academicYearId: "" });

  useEffect(() => {
    loadHolidays();
  }, []);

  async function loadHolidays() {
    const [hRes, yRes] = await Promise.all([
      fetch("/api/principal/holidays?years=2"),
      fetch("/api/principal/academic-years"),
    ]);
    const data = await hRes.json();
    const yData = await yRes.json();
    setHolidays(data.holidays || []);
    setByYear(data.byYear || {});
    setYears((yData.years || []).map((y: { id: string; name: string }) => ({ value: y.id, label: y.name })));
  }

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
    setForm({ name: "", date: "", type: "PUBLIC", academicYearId: "" });
    loadHolidays();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/principal/holidays/${id}`, { method: "DELETE" });
    loadHolidays();
  }

  return (
    <>
      <PageHeader
        title="Holidays"
        description="Public holidays, college closures, custom days off, summer/winter breaks, and exam preparation leave — one row per calendar date (repeat dates for multi-day breaks). Link an academic year to email current-year students when you add or edit rows."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const rows = [["Name", "Date", "Type"], ...holidays.map((h) => [h.name, h.date, h.type])];
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
                setForm({ name: "", date: "", type: "PUBLIC", academicYearId: "" });
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Holiday
            </Button>
          </div>
        }
      />

      {Object.keys(byYear).length > 0 && (
        <div className="mb-8 space-y-6">
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
                    </p>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="space-y-3">
        {holidays.map((h) => (
          <Card key={h.id}>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${holidayTypeDotClass(h.type)}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.name}</p>
                    <p className="text-xs text-gray-500">{new Date(h.date).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={holidayBadgeVariant(h.type)}>{holidayTypeLabel(h.type)}</Badge>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(h);
                      setForm({ name: h.name, date: toDateInputValue(h.date), type: h.type, academicYearId: h.academicYearId || "" });
                      setShowModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(h.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
          <p className="text-xs text-gray-500">
            Use the <strong>Name</strong> field for the specific title (e.g. &quot;Independence Day&quot;, &quot;Winter break — week 1&quot;). For
            multi-day breaks, add one entry per date or export and bulk-import later.
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
