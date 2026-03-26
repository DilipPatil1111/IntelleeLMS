"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface AcademicYearData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export default function AcademicYearPage() {
  const [years, setYears] = useState<AcademicYearData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AcademicYearData | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", isCurrent: false });

  useEffect(() => {
    loadYears();
  }, []);

  async function loadYears() {
    const res = await fetch("/api/principal/academic-years");
    const data = await res.json();
    setYears(data.years || []);
  }

  async function handleSave() {
    const url = editing ? `/api/principal/academic-years/${editing.id}` : "/api/principal/academic-years";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setEditing(null);
    setForm({ name: "", startDate: "", endDate: "", isCurrent: false });
    loadYears();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this academic year?")) return;
    await fetch(`/api/principal/academic-years/${id}`, { method: "DELETE" });
    loadYears();
  }

  return (
    <>
      <PageHeader
        title="Academic Years"
        description="Manage academic year periods"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ name: "", startDate: "", endDate: "", isCurrent: false });
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Year
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {years.map((y) => (
          <Card key={y.id}>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{y.name}</h3>
                  <p className="text-xs text-gray-500">
                    {new Date(y.startDate).toLocaleDateString()} — {new Date(y.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {y.isCurrent && <Badge variant="success">Current</Badge>}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(y);
                      setForm({
                        name: y.name,
                        startDate: toDateInputValue(y.startDate),
                        endDate: toDateInputValue(y.endDate),
                        isCurrent: y.isCurrent,
                      });
                      setShowModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(y.id)}
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
        title={editing ? "Edit Academic Year" : "Add Academic Year"}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. 2025-2026"
          />
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            label="End Date"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isCurrent}
              onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
            />
            Mark as current year
          </label>
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
