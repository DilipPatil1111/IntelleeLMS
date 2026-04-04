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
import { Select } from "@/components/ui/select";

interface Policy {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  fileUrl: string | null;
  category: string | null;
  policyType: "PROGRAM" | "COLLEGE" | "STUDENT" | "OTHER";
  isActive: boolean;
}

const emptyForm = {
  title: "",
  description: "",
  content: "",
  fileUrl: "",
  category: "",
  policyType: "OTHER" as Policy["policyType"],
  isActive: true,
};

const POLICY_TYPES: { value: Policy["policyType"]; label: string }[] = [
  { value: "PROGRAM", label: "Program policies" },
  { value: "COLLEGE", label: "College-level policies" },
  { value: "STUDENT", label: "Student policies" },
  { value: "OTHER", label: "Other policies" },
];

export default function PrincipalPoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadPolicies = useCallback(async () => {
    const res = await fetch("/api/principal/policies");
    const data = await res.json();
    setPolicies(data.policies || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPolicies();
  }, [loadPolicies]);

  async function handleSave() {
    const url = editing ? `/api/principal/policies/${editing.id}` : "/api/principal/policies";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    loadPolicies();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this policy?")) return;
    await fetch(`/api/principal/policies/${id}`, { method: "DELETE" });
    loadPolicies();
  }

  return (
    <>
      <PageHeader
        title="Policies"
        description="Manage college policies and guidelines"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Policy
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {policies.map((p) => (
          <Card key={p.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="info">{POLICY_TYPES.find((x) => x.value === p.policyType)?.label || p.policyType}</Badge>
                  </div>
                  {p.category && (
                    <p className="text-xs text-gray-500 mt-0.5">Category: {p.category}</p>
                  )}
                  {p.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">{p.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant={p.isActive ? "success" : "default"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {p.fileUrl && (
                    <a
                      href={p.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline mt-2 inline-block truncate max-w-full"
                    >
                      View file
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setForm({
                        title: p.title,
                        description: p.description || "",
                        content: p.content || "",
                        fileUrl: p.fileUrl || "",
                        category: p.category || "",
                        policyType: p.policyType || "OTHER",
                        isActive: p.isActive,
                      });
                      setShowModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
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
        title={editing ? "Edit Policy" : "Add Policy"}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <Select
            label="Policy type"
            value={form.policyType}
            onChange={(e) => setForm({ ...form, policyType: e.target.value as Policy["policyType"] })}
            options={POLICY_TYPES}
          />
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Textarea
            label="Content"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <Input
            label="File URL"
            value={form.fileUrl}
            onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
          />
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded text-indigo-600"
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
