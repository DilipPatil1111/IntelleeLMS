"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

function toDateInputValue(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

const emptyForm = {
  name: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
};

export default function PrincipalAcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, toast, dismiss } = useToast();

  useEffect(() => {
    loadYears();
  }, []);

  async function loadYears() {
    const res = await fetch("/api/principal/academic-years");
    const data = await res.json();
    setYears(data.years || []);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError("End date must be on or after the start date.");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/principal/academic-years/${editing.id}` : "/api/principal/academic-years";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          isCurrent: form.isCurrent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || "Could not save academic year.");
        setSaving(false);
        return;
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      await loadYears();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this academic year? This is only allowed if no batches or linked records use it.")) return;
    const res = await fetch(`/api/principal/academic-years/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast((data as { error?: string }).error || "Could not delete.", "error");
      return;
    }
    loadYears();
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function openEdit(y: AcademicYear) {
    setEditing(y);
    setForm({
      name: y.name,
      startDate: toDateInputValue(y.startDate),
      endDate: toDateInputValue(y.endDate),
      isCurrent: y.isCurrent,
    });
    setError(null);
    setShowModal(true);
  }

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Academic years"
        description="Define academic years so batches, holidays, and announcements can reference them."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add academic year
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {years.length === 0 && (
          <p className="text-sm text-gray-500 col-span-full">
            No academic years yet. Add one here, then use it when creating batches.
          </p>
        )}
        {years.map((y) => (
          <Card key={y.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{y.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(y.startDate).toLocaleDateString()} — {new Date(y.endDate).toLocaleDateString()}
                  </p>
                  {y.isCurrent && (
                    <div className="mt-2">
                      <Badge variant="success">Current year</Badge>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(y)}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(y.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    aria-label="Delete"
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
        onClose={() => !saving && setShowModal(false)}
        title={editing ? "Edit academic year" : "Add academic year"}
      >
        <div className="space-y-4">
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. 2025–2026"
          />
          <Input
            label="Start date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            label="End date"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isCurrent}
              onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
            />
            Mark as current academic year (clears this flag from other years)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
