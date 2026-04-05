"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Plus, Pencil, Trash2 } from "lucide-react";

type TaxItem = {
  id: string;
  name: string;
  customerId: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Tab = "domains" | "categories" | "types";

const emptyForm = { name: "", customerId: "", sortOrder: 0 };

export default function ProgramTaxonomyPage() {
  const [tab, setTab] = useState<Tab>("domains");
  const [domains, setDomains] = useState<TaxItem[]>([]);
  const [categories, setCategories] = useState<TaxItem[]>([]);
  const [types, setTypes] = useState<TaxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaxItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, c, t] = await Promise.all([
      fetch("/api/principal/program-domains").then((r) => r.json()),
      fetch("/api/principal/program-categories").then((r) => r.json()),
      fetch("/api/principal/program-types").then((r) => r.json()),
    ]);
    setDomains(d.domains || []);
    setCategories(c.categories || []);
    setTypes(t.types || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = tab === "domains" ? domains : tab === "categories" ? categories : types;
  const label =
    tab === "domains" ? "Program domain" : tab === "categories" ? "Program category" : "Program type";

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(x: TaxItem) {
    setEditing(x);
    setForm({
      name: x.name,
      customerId: x.customerId ?? "",
      sortOrder: x.sortOrder,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    const base =
      tab === "domains"
        ? "/api/principal/program-domains"
        : tab === "categories"
          ? "/api/principal/program-categories"
          : "/api/principal/program-types";
    const url = editing ? `${base}/${editing.id}` : base;
    const method = editing ? "PUT" : "POST";
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      sortOrder: form.sortOrder,
      isActive: true,
    };
    if (form.customerId.trim()) body.customerId = form.customerId.trim();
    else body.customerId = null;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error || "Save failed");
      return;
    }
    setModalOpen(false);
    void load();
  }

  async function remove(x: TaxItem) {
    if (!confirm(`Delete "${x.name}"?`)) return;
    const base =
      tab === "domains"
        ? "/api/principal/program-domains"
        : tab === "categories"
          ? "/api/principal/program-categories"
          : "/api/principal/program-types";
    const res = await fetch(`${base}/${x.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error || "Delete failed");
      return;
    }
    void load();
  }

  return (
    <>
      <PageHeader
        title="Program taxonomy"
        description="Define domains, categories, and types, then link them on each program. Optional Customer ID is unique per list when set."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add {label}
          </Button>
        }
      />

      <div className="flex gap-2 mb-6">
        {(
          [
            ["domains", "Domains"],
            ["categories", "Categories"],
            ["types", "Types"],
          ] as const
        ).map(([k, text]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tab === "domains" && "Program domains"}
            {tab === "categories" && "Program categories"}
            {tab === "types" && "Program types"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">No items yet. Add one to use it on programs.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((x) => (
                <li key={x.id} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{x.name}</p>
                    <p className="text-xs text-gray-500">
                      Customer ID: {x.customerId || "—"} · Sort: {x.sortOrder}
                      {!x.isActive && " · Inactive"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      className="p-1.5 text-gray-400 hover:text-indigo-600"
                      onClick={() => openEdit(x)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      onClick={() => void remove(x)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${label}` : `Add ${label}`}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={
              tab === "domains" ? "e.g. Software" : tab === "categories" ? "e.g. Vocational" : "e.g. Diploma"
            }
          />
          <Input
            label="Customer ID (optional)"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            placeholder="e.g. DOM-001 — leave empty if not used"
          />
          <Input
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()}>Save</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
