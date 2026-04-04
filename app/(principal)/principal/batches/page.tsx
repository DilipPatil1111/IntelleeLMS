"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  programId: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  program: { id: string; name: string };
  academicYear: { id: string; name: string };
  _count: { students: number };
}

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

const emptyForm = {
  name: "",
  programId: "",
  academicYearId: "",
  startDate: "",
  endDate: "",
  isActive: true,
};

export default function PrincipalBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programOptions, setProgramOptions] = useState<{ value: string; label: string }[]>([]);
  const [yearOptions, setYearOptions] = useState<{ value: string; label: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadAll = useCallback(async () => {
    const [bRes, pRes, yRes] = await Promise.all([
      fetch("/api/principal/batches"),
      fetch("/api/principal/programs"),
      fetch("/api/principal/academic-years"),
    ]);
    const bData = await bRes.json();
    const pData = await pRes.json();
    const yData = await yRes.json();
    setBatches(bData.batches || []);
    setProgramOptions(
      (pData.programs || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }))
    );
    setYearOptions(
      (yData.years || []).map((y: { id: string; name: string }) => ({ value: y.id, label: y.name }))
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  async function handleSave() {
    const url = editing ? `/api/principal/batches/${editing.id}` : "/api/principal/batches";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this batch?")) return;
    await fetch(`/api/principal/batches/${id}`, { method: "DELETE" });
    loadAll();
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(b: Batch) {
    setEditing(b);
    setForm({
      name: b.name,
      programId: b.programId,
      academicYearId: b.academicYearId,
      startDate: toDateInputValue(b.startDate),
      endDate: toDateInputValue(b.endDate),
      isActive: b.isActive,
    });
    setShowModal(true);
  }

  return (
    <>
      <PageHeader
        title="Batches"
        description="Manage student batches by program and academic year"
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Batch
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((b) => (
          <Card key={b.id}>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{b.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.program.name} — {b.academicYear.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(b.startDate).toLocaleDateString()} — {new Date(b.endDate).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge>{b._count.students} students</Badge>
                    {b.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge>Inactive</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.id)}
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
        title={editing ? "Edit Batch" : "Add Batch"}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Select
            label="Program"
            value={form.programId}
            onChange={(e) => setForm({ ...form, programId: e.target.value })}
            options={programOptions}
            placeholder="Select program"
          />
          <Select
            label="Academic year"
            value={form.academicYearId}
            onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
            options={yearOptions}
            placeholder="Select academic year"
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
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
