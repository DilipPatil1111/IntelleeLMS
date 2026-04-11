"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Subject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number;
  program: { name: string };
  modules: {
    id: string;
    name: string;
    orderIndex: number;
    isCompleted: boolean;
  }[];
}

export function SubjectsManager({ embedded = false }: { embedded?: boolean }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>(
    []
  );
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    programId: "",
    credits: 3,
  });

  const loadData = useCallback(async () => {
    const [subRes, optRes] = await Promise.all([
      fetch("/api/teacher/subjects"),
      fetch("/api/teacher/options"),
    ]);
    const subData = await subRes.json();
    const optData = await optRes.json();
    setSubjects(subData.subjects || []);
    setPrograms(optData.programs || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleSave() {
    const url = editing
      ? `/api/teacher/subjects/${editing.id}`
      : "/api/teacher/subjects";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setEditing(null);
    setForm({ name: "", code: "", description: "", programId: "", credits: 3 });
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this subject?")) return;
    await fetch(`/api/teacher/subjects/${id}`, { method: "DELETE" });
    loadData();
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code,
      description: s.description || "",
      programId: "",
      credits: s.credits,
    });
    setShowModal(true);
  }

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="Subjects"
          description="Manage subjects and course modules"
          actions={
            <Button
              onClick={() => {
                setEditing(null);
                setForm({
                  name: "",
                  code: "",
                  description: "",
                  programId: "",
                  credits: 3,
                });
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Subject
            </Button>
          }
        />
      ) : (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">Manage subjects across all your programs</p>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm({ name: "", code: "", description: "", programId: "", credits: 3 });
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Subject
          </Button>
        </div>
      )}

      {subjects.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-500 py-8">
              No subjects found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.map((s) => (
            <Card key={s.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {s.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Code: {s.code} — Credits: {s.credits} —{" "}
                      {s.program?.name}
                    </p>
                    {s.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1 text-gray-400 hover:text-indigo-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {s.modules.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {s.modules
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div
                            className={`h-2 w-2 rounded-full ${m.isCompleted ? "bg-green-500" : "bg-gray-300"}`}
                          />
                          <span className="text-gray-700">{m.name}</span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Subject" : "Add Subject"}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Select
            label="Program"
            value={form.programId}
            onChange={(e) => setForm({ ...form, programId: e.target.value })}
            options={programs}
            placeholder="Select program"
          />
          <Input
            label="Credits"
            type="number"
            value={form.credits}
            onChange={(e) =>
              setForm({ ...form, credits: parseInt(e.target.value) || 3 })
            }
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function TeacherSubjectsPage() {
  return <SubjectsManager />;
}
