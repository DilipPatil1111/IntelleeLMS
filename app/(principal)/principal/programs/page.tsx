"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface TaxRef {
  id: string;
  name: string;
  customerId: string | null;
}

interface Program {
  id: string;
  name: string;
  code: string;
  description: string | null;
  durationYears: number;
  durationText: string | null;
  programDomain: TaxRef | null;
  programCategory: TaxRef | null;
  programType: TaxRef | null;
  _count: { subjects: number; batches: number; students: number };
}

export default function PrincipalProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    durationText: "",
    programDomainId: "",
    programCategoryId: "",
    programTypeId: "",
  });

  const loadPrograms = useCallback(async () => {
    const [pRes, dRes, cRes, tRes] = await Promise.all([
      fetch("/api/principal/programs"),
      fetch("/api/principal/program-domains"),
      fetch("/api/principal/program-categories"),
      fetch("/api/principal/program-types"),
    ]);
    const pData = await pRes.json();
    const dData = await dRes.json();
    const cData = await cRes.json();
    const tData = await tRes.json();
    setPrograms(pData.programs || []);
    setDomains((dData.domains || []).filter((x: { isActive?: boolean }) => x.isActive !== false));
    setCategories((cData.categories || []).filter((x: { isActive?: boolean }) => x.isActive !== false));
    setTypes((tData.types || []).filter((x: { isActive?: boolean }) => x.isActive !== false));
  }, []);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  async function handleSave() {
    const url = editing ? `/api/principal/programs/${editing.id}` : "/api/principal/programs";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        durationYears: 1,
        programDomainId: form.programDomainId || null,
        programCategoryId: form.programCategoryId || null,
        programTypeId: form.programTypeId || null,
      }),
    });
    setShowModal(false);
    setEditing(null);
    setForm({
      name: "",
      code: "",
      description: "",
      durationText: "",
      programDomainId: "",
      programCategoryId: "",
      programTypeId: "",
    });
    loadPrograms();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this program?")) return;
    await fetch(`/api/principal/programs/${id}`, { method: "DELETE" });
    loadPrograms();
  }

  return (
    <>
      <PageHeader
        title="Programs"
        description="Manage academic programs and link domain, category, and type (configure lists under Program taxonomy)."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({
                name: "",
                code: "",
                description: "",
                durationText: "",
                programDomainId: "",
                programCategoryId: "",
                programTypeId: "",
              });
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Program
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.map((p) => (
          <Card key={p.id}>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-xs text-gray-500">
                    Code: {p.code} — {p.durationText || `${p.durationYears} year(s)`}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.programDomain && (
                      <Badge variant="default" className="text-[10px]">
                        Domain: {p.programDomain.name}
                      </Badge>
                    )}
                    {p.programCategory && (
                      <Badge variant="default" className="text-[10px]">
                        Category: {p.programCategory.name}
                      </Badge>
                    )}
                    {p.programType && (
                      <Badge variant="default" className="text-[10px]">
                        Type: {p.programType.name}
                      </Badge>
                    )}
                  </div>
                  {p.description && <p className="text-sm text-gray-500 mt-1">{p.description}</p>}
                  <div className="flex gap-2 mt-2">
                    <Badge>{p._count.subjects} subjects</Badge>
                    <Badge>{p._count.batches} batches</Badge>
                    <Badge>{p._count.students} students</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setForm({
                        name: p.name,
                        code: p.code,
                        description: p.description || "",
                        durationText: p.durationText || `${p.durationYears} year(s)`,
                        programDomainId: p.programDomain?.id ?? "",
                        programCategoryId: p.programCategory?.id ?? "",
                        programTypeId: p.programType?.id ?? "",
                      });
                      setShowModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Program" : "Add Program"}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Duration (type freely, e.g. 24 months, 2 years, 3 semesters)"
            value={form.durationText}
            onChange={(e) => setForm({ ...form, durationText: e.target.value })}
            placeholder="e.g. 2 years or 18 months"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program domain</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.programDomainId}
              onChange={(e) => setForm({ ...form, programDomainId: e.target.value })}
            >
              <option value="">— None —</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program category</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.programCategoryId}
              onChange={(e) => setForm({ ...form, programCategoryId: e.target.value })}
            >
              <option value="">— None —</option>
              {categories.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program type</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.programTypeId}
              onChange={(e) => setForm({ ...form, programTypeId: e.target.value })}
            >
              <option value="">— None —</option>
              {types.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
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
