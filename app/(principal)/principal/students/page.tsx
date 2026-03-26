"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

type StudentStatus =
  | "APPLICANT"
  | "ACCEPTED"
  | "ENROLLED"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "EXPELLED"
  | "TRANSFERRED"
  | "GRADUATED"
  | "CANCELLED";

const STUDENT_STATUSES: StudentStatus[] = [
  "APPLICANT",
  "ACCEPTED",
  "ENROLLED",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "EXPELLED",
  "TRANSFERRED",
  "GRADUATED",
  "CANCELLED",
];

const statusSelectOptions = STUDENT_STATUSES.map((s) => ({ value: s, label: s }));

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  studentProfile: {
    enrollmentNo: string;
    programId: string | null;
    batchId: string | null;
    status: StudentStatus;
    program: { id: string; name: string } | null;
    batch: { id: string; name: string } | null;
  } | null;
  attempts: { percentage: number | null }[];
  attendanceRecords: { status: string }[];
}

interface Program {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  name: string;
  programId: string;
  program?: { id: string; name: string };
}

const emptyForm = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  phone: "",
  programId: "",
  batchId: "",
  enrollmentNo: "",
  isActive: true,
};

function avgScore(attempts: { percentage: number | null }[]) {
  if (!attempts.length) return 0;
  return Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length);
}

function attendancePct(records: { status: string }[]) {
  const total = records.length;
  if (!total) return 0;
  const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  return Math.round((present / total) * 100);
}

function statusBadgeVariant(status: StudentStatus): "success" | "warning" | "danger" | "default" {
  if (status === "ACTIVE" || status === "ENROLLED" || status === "GRADUATED") return "success";
  if (status === "APPLICANT" || status === "ACCEPTED") return "warning";
  if (status === "SUSPENDED" || status === "EXPELLED" || status === "CANCELLED") return "danger";
  return "default";
}

export default function PrincipalStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveBanner, setSaveBanner] = useState<{ tone: "success" | "warning" | "error"; message: string } | null>(
    null
  );

  const programOptions = useMemo(
    () => programs.map((p) => ({ value: p.id, label: p.name })),
    [programs]
  );

  const batchOptionsForForm = useMemo(() => {
    if (!form.programId) {
      return batches.map((b) => ({
        value: b.id,
        label: b.program ? `${b.name} — ${b.program.name}` : b.name,
      }));
    }
    return batches
      .filter((b) => b.programId === form.programId)
      .map((b) => ({ value: b.id, label: b.name }));
  }, [batches, form.programId]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [sRes, pRes, bRes] = await Promise.all([
      fetch("/api/principal/students"),
      fetch("/api/principal/programs"),
      fetch("/api/principal/batches"),
    ]);
    const sData = await sRes.json();
    const pData = await pRes.json();
    const bData = await bRes.json();
    setStudents(sData.students || []);
    setPrograms(pData.programs || []);
    setBatches(bData.batches || []);
  }

  async function handleSave() {
    if (editing) {
      const res = await fetch(`/api/principal/students/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          middleName: form.middleName || null,
          phone: form.phone || null,
          email: form.email,
          isActive: form.isActive,
          programId: form.programId || null,
          batchId: form.batchId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveBanner({ tone: "error", message: (err as { error?: string }).error || "Could not update student." });
        return;
      }
      setSaveBanner({ tone: "success", message: "Student updated." });
    } else {
      const res = await fetch("/api/principal/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || null,
          programId: form.programId || null,
          batchId: form.batchId || null,
          enrollmentNo: form.enrollmentNo.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveBanner({
          tone: "error",
          message: (data as { error?: string }).error || "Could not create student.",
        });
        return;
      }
      const welcome = (data as { welcomeEmailStatus?: string; emailError?: string }).welcomeEmailStatus;
      const emailErr = (data as { emailError?: string }).emailError;
      if (welcome === "failed") {
        setSaveBanner({
          tone: "error",
          message: `Student created, but the welcome email failed: ${emailErr || "unknown error"}. Check Vercel env: RESEND_API_KEY, RESEND_FROM_EMAIL, and NEXT_PUBLIC_APP_URL.`,
        });
      } else if (welcome === "mock") {
        setSaveBanner({
          tone: "warning",
          message:
            "Student created, but no email was sent: the server still does not see RESEND_API_KEY. In Vercel → Settings → Environment Variables, add RESEND_API_KEY for this deployment’s environment (Production vs Preview), save, then redeploy. Trailing spaces in the key value can also cause this.",
        });
      } else {
        setSaveBanner({
          tone: "success",
          message: "Student created. A welcome email with login link and temporary password was sent.",
        });
      }
    }
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    await fetch(`/api/principal/students/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function handleStatusChange(student: StudentRow, status: StudentStatus) {
    await fetch(`/api/principal/students/${student.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
        phone: student.phone,
        email: student.email,
        isActive: student.isActive,
        programId: student.studentProfile?.programId ?? null,
        batchId: student.studentProfile?.batchId ?? null,
        status,
      }),
    });
    loadAll();
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(s: StudentRow) {
    setEditing(s);
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      middleName: s.middleName || "",
      email: s.email,
      phone: s.phone || "",
      programId: s.studentProfile?.programId || "",
      batchId: s.studentProfile?.batchId || "",
      enrollmentNo: s.studentProfile?.enrollmentNo || "",
      isActive: s.isActive,
    });
    setShowModal(true);
  }

  return (
    <>
      <PageHeader
        title="All Students"
        description="View performance and manage all students"
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Student
          </Button>
        }
      />

      {saveBanner && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            saveBanner.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : saveBanner.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {saveBanner.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Program</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Batch</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Avg Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Attendance%</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {students.map((s) => {
              const avg = avgScore(s.attempts);
              const attRate = attendancePct(s.attendanceRecords);
              const st = s.studentProfile?.status ?? "ACTIVE";
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.studentProfile?.program?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.studentProfile?.batch?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <Badge variant={statusBadgeVariant(st)}>{st}</Badge>
                      <select
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={st}
                        onChange={(e) => handleStatusChange(s, e.target.value as StudentStatus)}
                      >
                        {STUDENT_STATUSES.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={avg >= 50 ? "success" : avg > 0 ? "danger" : "default"}>{avg}%</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={attRate >= 75 ? "success" : attRate >= 50 ? "warning" : "danger"}>
                      {attRate}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="p-1 text-gray-400 hover:text-indigo-600"
                        aria-label="Edit student"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        aria-label="Delete student"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Student" : "Add Student"}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <Input
              label="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
          {editing && (
            <Input
              label="Middle name"
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
            />
          )}
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Select
            label="Program"
            value={form.programId}
            onChange={(e) => setForm({ ...form, programId: e.target.value, batchId: "" })}
            options={programOptions}
            placeholder="Select program"
          />
          <Select
            label="Batch"
            value={form.batchId}
            onChange={(e) => setForm({ ...form, batchId: e.target.value })}
            options={batchOptionsForForm}
            placeholder={form.programId ? "Select batch" : "Select program first"}
          />
          <Input
            label="Enrollment No. (optional — auto if empty)"
            value={form.enrollmentNo}
            onChange={(e) => setForm({ ...form, enrollmentNo: e.target.value })}
            disabled={!!editing}
          />
          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Account active
            </label>
          )}
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
