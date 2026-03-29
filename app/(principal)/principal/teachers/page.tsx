"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GraduationCap, X } from "lucide-react";
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
    subjectAssignments: { subject: { id: string; name: string }; batch: { id: string; name: string } }[];
  } | null;
}

type AcademicProgram = {
  id: string;
  name: string;
  subjects: { id: string; name: string; programId: string }[];
  batches: { id: string; name: string; programId: string }[];
};

async function fetchPrincipalTeacherLists(debouncedQ: string, filterProgramId: string) {
  const params = new URLSearchParams();
  if (debouncedQ) params.set("q", debouncedQ);
  if (filterProgramId) params.set("programId", filterProgramId);
  const qs = params.toString();
  const prefix = qs ? `?${qs}&` : "?";
  const [uRes, aRes] = await Promise.all([
    fetch(`/api/principal/teachers${prefix}assignment=unassigned`),
    fetch(`/api/principal/teachers${prefix}assignment=assigned`),
  ]);
  const uData = await uRes.json();
  const aData = await aRes.json();
  return {
    unassigned: (uData.teachers || []) as TeacherRow[],
    assigned: (aData.teachers || []) as TeacherRow[],
  };
}

function TeacherCard({
  t,
  onEdit,
  onAssign,
  onDeactivate,
  showAssign,
  showProgramsBatches,
}: {
  t: TeacherRow;
  onEdit: (t: TeacherRow) => void;
  onAssign: (t: TeacherRow) => void;
  onDeactivate: (id: string) => void;
  showAssign?: boolean;
  /** Assigned teachers: quick entry to same edit flow for programs / subject-batch rows */
  showProgramsBatches?: boolean;
}) {
  const assigned = (t.teacherProfile?.subjectAssignments?.length ?? 0) > 0;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-gray-900">
                {t.firstName} {t.lastName}
              </h3>
              {!t.isActive && <Badge variant="danger">Inactive</Badge>}
              <Badge variant={assigned ? "success" : "warning"}>{assigned ? "Assigned" : "Unassigned"}</Badge>
            </div>
            <p className="text-sm text-gray-500">
              {t.email} — {t.teacherProfile?.employeeId}
            </p>
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
              <p className="text-xs text-gray-600 mt-2">
                <span className="font-medium text-gray-700">Teaching: </span>
                {t.teacherProfile.subjectAssignments.map((a) => `${a.subject.name} (${a.batch.name})`).join(", ")}
              </p>
            )}
            {!assigned && (
              <p className="text-xs text-amber-800 mt-2 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 inline-block">
                No subject/batch assignment yet — use Assign or edit to add courses.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            {showAssign && (
              <Button type="button" size="sm" variant="secondary" onClick={() => onAssign(t)}>
                Assign
              </Button>
            )}
            {showProgramsBatches && (
              <Button type="button" size="sm" variant="outline" onClick={() => onEdit(t)}>
                Programs &amp; batches
              </Button>
            )}
            <button type="button" onClick={() => onEdit(t)} className="p-2 text-gray-400 hover:text-indigo-600" title="Edit profile & assignments">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDeactivate(t.id)}
              className="p-2 text-gray-400 hover:text-red-600"
              title="Deactivate"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrincipalTeachersPage() {
  const [unassigned, setUnassigned] = useState<TeacherRow[]>([]);
  const [assigned, setAssigned] = useState<TeacherRow[]>([]);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [academicPrograms, setAcademicPrograms] = useState<AcademicProgram[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filterProgramId, setFilterProgramId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  /** create | edit | assign — assign opens same form as edit, focused label for unassigned rows */
  const [modalMode, setModalMode] = useState<"create" | "edit" | "assign">("create");
  const [saveError, setSaveError] = useState("");
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
  const [courseAssignments, setCourseAssignments] = useState<{ subjectId: string; batchId: string }[]>([]);
  const [pickSubject, setPickSubject] = useState("");
  const [pickBatch, setPickBatch] = useState("");

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
    const data = await fetchPrincipalTeacherLists(debouncedQ, filterProgramId);
    setUnassigned(data.unassigned);
    setAssigned(data.assigned);
  }, [debouncedQ, filterProgramId]);

  useEffect(() => {
    let cancelled = false;
    void fetchPrincipalTeacherLists(debouncedQ, filterProgramId).then((data) => {
      if (cancelled) return;
      setUnassigned(data.unassigned);
      setAssigned(data.assigned);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, filterProgramId]);

  useEffect(() => {
    if (!showModal) return;
    void (async () => {
      const res = await fetch("/api/principal/academic-options");
      const data = await res.json();
      setAcademicPrograms(data.programs || []);
    })();
  }, [showModal]);

  const programFilterOptions = useMemo(
    () => programs.map((p) => ({ value: p.value, label: p.label })),
    [programs]
  );

  const allSubjects = useMemo(() => academicPrograms.flatMap((p) => p.subjects), [academicPrograms]);

  const batchesForPickedSubject = useMemo(() => {
    const sub = allSubjects.find((s) => s.id === pickSubject);
    if (!sub) return [];
    return academicPrograms.flatMap((p) => p.batches).filter((b) => b.programId === sub.programId);
  }, [allSubjects, academicPrograms, pickSubject]);

  function openCreate() {
    setEditing(null);
    setModalMode("create");
    setSaveError("");
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
    setCourseAssignments([]);
    setPickSubject("");
    setPickBatch("");
    setShowModal(true);
  }

  function openAssign(t: TeacherRow) {
    setEditing(t);
    setModalMode("assign");
    setSaveError("");
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
    setCourseAssignments(
      t.teacherProfile?.subjectAssignments?.map((a) => ({
        subjectId: a.subject.id,
        batchId: a.batch.id,
      })) || []
    );
    setPickSubject("");
    setPickBatch("");
    setShowModal(true);
  }

  function openEdit(t: TeacherRow) {
    setEditing(t);
    setModalMode("edit");
    setSaveError("");
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
    setCourseAssignments(
      t.teacherProfile?.subjectAssignments?.map((a) => ({
        subjectId: a.subject.id,
        batchId: a.batch.id,
      })) || []
    );
    setPickSubject("");
    setPickBatch("");
    setShowModal(true);
  }

  function addCourseRow() {
    if (!pickSubject || !pickBatch) return;
    const dup = courseAssignments.some((c) => c.subjectId === pickSubject && c.batchId === pickBatch);
    if (dup) return;
    const sub = allSubjects.find((s) => s.id === pickSubject);
    if (sub) {
      setForm((f) =>
        f.programIds.includes(sub.programId) ? f : { ...f, programIds: [...f.programIds, sub.programId] }
      );
    }
    setCourseAssignments((prev) => [...prev, { subjectId: pickSubject, batchId: pickBatch }]);
    setPickBatch("");
  }

  function removeCourseRow(subjectId: string, batchId: string) {
    setCourseAssignments((prev) => prev.filter((c) => !(c.subjectId === subjectId && c.batchId === batchId)));
  }

  async function handleSave() {
    setSaveError("");
    if (editing) {
      const res = await fetch(`/api/principal/teachers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          programIds: form.programIds,
          subjectAssignments: courseAssignments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError((data as { error?: string }).error || "Could not update teacher.");
        return;
      }
    } else {
      const res = await fetch("/api/principal/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          programIds: form.programIds,
          password: form.password || undefined,
          subjectAssignments: courseAssignments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError((data as { error?: string }).error || "Could not create teacher.");
        return;
      }
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
    let removing = false;
    setForm((f) => {
      removing = f.programIds.includes(pid);
      const nextIds = removing ? f.programIds.filter((x) => x !== pid) : [...f.programIds, pid];
      return { ...f, programIds: nextIds };
    });
    if (removing) {
      setCourseAssignments((prev) =>
        prev.filter((c) => {
          const subj = allSubjects.find((s) => s.id === c.subjectId);
          return !subj || subj.programId !== pid;
        })
      );
      const picked = allSubjects.find((s) => s.id === pickSubject);
      if (pickSubject && picked && picked.programId === pid) {
        setPickSubject("");
        setPickBatch("");
      }
    }
  }

  const programNameById = useMemo(() => {
    const m = new Map<string, string>();
    academicPrograms.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [academicPrograms]);

  const subjectOptions = useMemo(() => {
    const list =
      form.programIds.length > 0
        ? allSubjects.filter((s) => form.programIds.includes(s.programId))
        : allSubjects;
    return list.map((s) => ({ value: s.id, label: s.name }));
  }, [allSubjects, form.programIds]);

  const batchOptions = useMemo(
    () => batchesForPickedSubject.map((b) => ({ value: b.id, label: b.name })),
    [batchesForPickedSubject]
  );

  return (
    <>
      <PageHeader
        title="Teachers & trainers"
        description="Create Teacher adds an account with optional programs and subject/batch rows; the teacher receives an email with a login link and temporary password and must change their password on first sign-in. Edit any teacher to uncheck programs (course rows for that program are cleared) or add subject/batch rows for new programs. Unassigned teachers can use Assign — they receive a congratulations email when first assigned from an unassigned state."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create Teacher
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

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Unassigned teachers</h2>
          <p className="text-sm text-gray-600 mb-3">
            Registered or created staff who are not yet linked to a subject and batch. Use Assign to add courses, or edit for full profile changes.
          </p>
          {unassigned.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 border border-dashed rounded-lg text-center">No unassigned teachers.</p>
          ) : (
            <div className="space-y-4">
              {unassigned.map((t) => (
                <TeacherCard
                  key={t.id}
                  t={t}
                  showAssign
                  onAssign={openAssign}
                  onEdit={openEdit}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Assigned teachers</h2>
          <p className="text-sm text-gray-600 mb-3">
            Teachers with at least one subject and batch. Use <strong className="font-medium text-gray-800">Programs &amp; batches</strong> or the
            pencil to change program membership, remove rows, or add new subjects and batches.
          </p>
          {assigned.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 border border-dashed rounded-lg text-center">No assigned teachers yet.</p>
          ) : (
            <div className="space-y-4">
              {assigned.map((t) => (
                <TeacherCard
                  key={t.id}
                  t={t}
                  showProgramsBatches
                  onAssign={openAssign}
                  onEdit={openEdit}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          modalMode === "create" ? "Create Teacher" : modalMode === "assign" ? "Assign teacher" : "Edit teacher"
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
          )}
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={!!editing}
          />
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
            <p className="text-xs text-gray-600 mb-2">
              Uncheck a program to remove it from this teacher and clear all subject/batch rows for that program. Adding a
              subject below will check the matching program automatically.
            </p>
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

          {(modalMode === "create" || editing) && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
              <p className="text-sm font-semibold text-indigo-950">Assign to subjects & batches</p>
              <p className="text-xs text-gray-600">
                Pick a subject, then a batch in the same program. Remove rows with ✕. When one or more programs are selected
                above, the subject list is limited to those programs — select more programs to assign work in additional
                programs. New rows are saved on Update.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end flex-wrap">
                <div className="min-w-[160px] flex-1">
                  <Select
                    label="Subject"
                    value={pickSubject}
                    onChange={(e) => {
                      setPickSubject(e.target.value);
                      setPickBatch("");
                    }}
                    options={subjectOptions}
                    placeholder="Select subject"
                  />
                </div>
                <div className="min-w-[160px] flex-1">
                  <Select
                    label="Batch"
                    value={pickBatch}
                    onChange={(e) => setPickBatch(e.target.value)}
                    options={batchOptions}
                    placeholder={pickSubject ? "Select batch" : "Select subject first"}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addCourseRow} disabled={!pickSubject || !pickBatch}>
                  Add
                </Button>
              </div>
              {courseAssignments.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {courseAssignments.map((c) => {
                    const subj = allSubjects.find((s) => s.id === c.subjectId);
                    const sn = subj?.name || c.subjectId;
                    const pn = subj ? programNameById.get(subj.programId) || "" : "";
                    const bn =
                      academicPrograms.flatMap((p) => p.batches).find((b) => b.id === c.batchId)?.name || c.batchId;
                    return (
                      <li key={`${c.subjectId}-${c.batchId}`} className="flex items-center justify-between gap-2 bg-white rounded border px-2 py-1">
                        <span>
                          {sn}
                          {pn ? ` — ${pn}` : ""} — {bn}
                        </span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-600 p-1"
                          onClick={() => removeCourseRow(c.subjectId, c.batchId)}
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()}>
              {modalMode === "create" ? "Create" : "Update"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
