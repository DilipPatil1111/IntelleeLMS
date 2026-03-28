"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GraduationCap } from "lucide-react";
import { Select } from "@/components/ui/select";

interface TeacherRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  isActive: boolean;
  teacherProfile: {
    id: string;
    employeeId: string;
    department: string | null;
    qualification: string | null;
    specialization: string | null;
    teacherPrograms: { program: { id: string; name: string } }[];
    subjectAssignments: { subject: { name: string }; batch: { name: string } }[];
  } | null;
}

export default function PrincipalTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filterProgramId, setFilterProgramId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    middleName: "",
    phone: "",
    password: "",
    employeeId: "",
    department: "",
    qualification: "",
    specialization: "",
    programIds: [] as string[],
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void (async () => {
      const pRes = await fetch("/api/principal/programs");
      const pData = await pRes.json();
      setPrograms((pData.programs || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })));
    })();
  }, []);

  const loadTeachers = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (filterProgramId) params.set("programId", filterProgramId);
    const qs = params.toString();
    const tRes = await fetch(`/api/principal/teachers${qs ? `?${qs}` : ""}`);
    const tData = await tRes.json();
    setTeachers(tData.teachers || []);
  }, [debouncedQ, filterProgramId]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const programFilterOptions = useMemo(
    () => programs.map((p) => ({ value: p.value, label: p.label })),
    [programs]
  );

  function openCreate() {
    setEditing(null);
    setForm({
      email: "",
      firstName: "",
      lastName: "",
      middleName: "",
      phone: "",
      password: "",
      employeeId: "",
      department: "",
      qualification: "",
      specialization: "",
      programIds: [],
    });
    setShowModal(true);
  }

  function openEdit(t: TeacherRow) {
    setEditing(t);
    setForm({
      email: t.email,
      firstName: t.firstName,
      lastName: t.lastName,
      middleName: t.middleName || "",
      phone: t.phone || "",
      password: "",
      employeeId: t.teacherProfile?.employeeId || "",
      department: t.teacherProfile?.department || "",
      qualification: t.teacherProfile?.qualification || "",
      specialization: t.teacherProfile?.specialization || "",
      programIds: t.teacherProfile?.teacherPrograms.map((tp) => tp.program.id) || [],
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (editing) {
      await fetch(`/api/principal/teachers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          programIds: form.programIds,
        }),
      });
    } else {
      await fetch("/api/principal/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          programIds: form.programIds,
          password: form.password || undefined,
        }),
      });
    }
    setShowModal(false);
    setEditing(null);
    void loadTeachers();
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this teacher? They will no longer be able to sign in.")) return;
    await fetch(`/api/principal/teachers/${id}`, { method: "DELETE" });
    void loadTeachers();
  }

  function toggleProgram(pid: string) {
    setForm((f) => ({
      ...f,
      programIds: f.programIds.includes(pid) ? f.programIds.filter((x) => x !== pid) : [...f.programIds, pid],
    }));
  }

  return (
    <>
      <PageHeader
        title="Teachers & trainers"
        description="Add, edit, and assign staff to programs (many-to-many)"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add teacher
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Input
            label="Search teacher"
            placeholder="Name, email, or employee ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-full min-w-[180px] sm:w-64">
          <Select
            label="Program"
            value={filterProgramId}
            onChange={(e) => setFilterProgramId(e.target.value)}
            options={programFilterOptions}
            placeholder="All programs"
          />
        </div>
      </div>

      <div className="space-y-4">
        {teachers.map((t) => (
          <Card key={t.id}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900">
                      {t.firstName} {t.lastName}
                    </h3>
                    {!t.isActive && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-gray-500">{t.email} — {t.teacherProfile?.employeeId}</p>
                  {t.teacherProfile?.teacherPrograms && t.teacherProfile.teacherPrograms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.teacherProfile.teacherPrograms.map((tp) => (
                        <Badge key={tp.program.id} variant="info">
                          <GraduationCap className="h-3 w-3 mr-0.5 inline" />
                          {tp.program.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {t.teacherProfile?.subjectAssignments && t.teacherProfile.subjectAssignments.length > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      Subject assignments:{" "}
                      {t.teacherProfile.subjectAssignments.map((a) => `${a.subject.name} (${a.batch.name})`).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => openEdit(t)} className="p-2 text-gray-400 hover:text-indigo-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDeactivate(t.id)} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit teacher" : "Add teacher"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <Input label="Middle name" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {!editing && (
            <Input
              label="Password (optional — leave blank for auto-generated)"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
          <Input label="Employee ID" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
          <Input label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <Textarea label="Qualification" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
          <Textarea label="Specialization" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Programs (select one or more)</p>
            <div className="flex flex-wrap gap-2">
              {programs.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.programIds.includes(p.value)}
                    onChange={() => toggleProgram(p.value)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
