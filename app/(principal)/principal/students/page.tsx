"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type StudentStatus =
  | "APPLIED"
  | "ACCEPTED"
  | "ENROLLED"
  | "COMPLETED"
  | "GRADUATED"
  | "RETAKE"
  | "CANCELLED"
  | "SUSPENDED"
  | "EXPELLED"
  | "TRANSFERRED";

const STUDENT_STATUSES: StudentStatus[] = [
  "APPLIED",
  "ACCEPTED",
  "ENROLLED",
  "COMPLETED",
  "GRADUATED",
  "RETAKE",
  "CANCELLED",
  "SUSPENDED",
  "EXPELLED",
  "TRANSFERRED",
];

const STATUS_LABELS: Record<StudentStatus, string> = {
  APPLIED: "Applied",
  ACCEPTED: "Accepted",
  ENROLLED: "Enrolled",
  COMPLETED: "Completed",
  GRADUATED: "Graduated",
  RETAKE: "Retake",
  CANCELLED: "Cancelled",
  SUSPENDED: "Suspended",
  EXPELLED: "Expelled",
  TRANSFERRED: "Transferred",
};

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

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
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
  status: "ACCEPTED" as StudentStatus,
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
  if (status === "ENROLLED" || status === "GRADUATED" || status === "COMPLETED") return "success";
  if (status === "APPLIED" || status === "ACCEPTED" || status === "RETAKE") return "warning";
  if (
    status === "SUSPENDED" ||
    status === "CANCELLED" ||
    status === "EXPELLED" ||
    status === "TRANSFERRED"
  ) {
    return "danger";
  }
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
  const [statusModal, setStatusModal] = useState<{ toStatus: StudentStatus } | null>(null);
  const [suspendReason, setSuspendReason] = useState<"FEES" | "ATTENDANCE" | "ACADEMIC" | "OTHER">("FEES");
  const [statusNote, setStatusNote] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterBatchId, setFilterBatchId] = useState("");
  const [filterStatus, setFilterStatus] = useState<StudentStatus | "">("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  const programOptions = useMemo(
    () => programs.map((p) => ({ value: p.id, label: p.name })),
    [programs]
  );

  const filterBatchOptions = useMemo(() => {
    const list = filterProgramId ? batches.filter((b) => b.programId === filterProgramId) : batches;
    return list.map((b) => ({
      value: b.id,
      label: b.program ? `${b.name} — ${b.program.name}` : b.name,
    }));
  }, [batches, filterProgramId]);

  const teacherSelectOptions = useMemo(
    () => teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` })),
    [teachers]
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
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (filterProgramId) params.set("programId", filterProgramId);
    if (filterBatchId) params.set("batchId", filterBatchId);
    if (filterStatus) params.set("status", filterStatus);
    if (filterTeacherId) params.set("teacherId", filterTeacherId);
    const q = params.toString();
    const sRes = await fetch(`/api/principal/students${q ? `?${q}` : ""}`, { cache: "no-store" });
    const sData = await sRes.json();
    setStudents(sData.students || []);
  }, [debouncedSearch, filterProgramId, filterBatchId, filterStatus, filterTeacherId]);

  useEffect(() => {
    // Fetch when filters / debounced search change (standard data-sync pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadStudents updates list state from API
    void loadStudents();
  }, [loadStudents]);

  /** After onboarding confirm or status changes in another tab, list stays fresh when returning here. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadStudents();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadStudents]);

  const loadMeta = useCallback(async () => {
    const fetchOpts = { cache: "no-store" as const };
    const [pRes, bRes, tRes] = await Promise.all([
      fetch("/api/principal/programs", fetchOpts),
      fetch("/api/principal/batches", fetchOpts),
      fetch("/api/principal/teachers", fetchOpts),
    ]);
    const pData = await pRes.json();
    const bData = await bRes.json();
    const tData = await tRes.json();
    setPrograms(pData.programs || []);
    setBatches(bData.batches || []);
    const tList = (tData.teachers || []) as {
      id: string;
      firstName: string;
      lastName: string;
    }[];
    setTeachers(tList.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time programs/batches/teachers for filters
    void loadMeta();
  }, [loadMeta]);

  async function loadAll() {
    await loadMeta();
    await loadStudents();
  }

  async function putStudentUpdate(extras?: { suspensionReason?: string; statusNote?: string }): Promise<boolean> {
    if (!editing) return false;
    const body: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      middleName: form.middleName || null,
      phone: form.phone || null,
      email: form.email,
      isActive: form.isActive,
      programId: form.programId || null,
      batchId: form.batchId || null,
      status: form.status,
    };
    if (extras?.suspensionReason) body.suspensionReason = extras.suspensionReason;
    if (extras?.statusNote) body.statusNote = extras.statusNote;

    const res = await fetch(`/api/principal/students/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSaveBanner({ tone: "error", message: (err as { error?: string }).error || "Could not update student." });
      return false;
    }
    setSaveBanner({ tone: "success", message: "Student updated." });
    return true;
  }

  async function handleSave() {
    if (editing) {
      const needsConfirm = ["SUSPENDED", "CANCELLED", "EXPELLED", "TRANSFERRED"].includes(form.status);
      if (needsConfirm) {
        setSuspendReason("FEES");
        setStatusNote("");
        setStatusModal({ toStatus: form.status });
        return;
      }
      const ok = await putStudentUpdate();
      if (!ok) return;
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
          status: form.status,
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
    const res = await fetch(`/api/principal/students/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSaveBanner({
        tone: "error",
        message: (err as { error?: string }).error || "Could not delete student. Try again or contact support.",
      });
      return;
    }
    setSaveBanner({ tone: "success", message: "Student and related records were removed." });
    loadAll();
  }

  async function confirmStatusModal() {
    if (!statusModal) return;
    const { toStatus } = statusModal;
    const note = statusNote.trim();
    if ((toStatus === "EXPELLED" || toStatus === "TRANSFERRED") && note.length < 10) {
      setSaveBanner({
        tone: "error",
        message: "Please enter at least 10 characters explaining the reason (shown to the student and principals).",
      });
      return;
    }
    const ok = await putStudentUpdate({
      suspensionReason: toStatus === "SUSPENDED" ? suspendReason : undefined,
      statusNote: note || undefined,
    });
    if (!ok) return;
    setStatusModal(null);
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    loadAll();
  }

  function closeStatusModal() {
    setStatusModal(null);
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
      status: (s.studentProfile?.status ?? "APPLIED") as StudentStatus,
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

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[180px] flex-1">
          <Input
            label="Search student"
            placeholder="Name, email, enrollment no."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-full min-w-[140px] sm:w-44">
          <Select
            label="Program"
            value={filterProgramId}
            onChange={(e) => {
              setFilterProgramId(e.target.value);
              setFilterBatchId("");
            }}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="All programs"
          />
        </div>
        <div className="w-full min-w-[140px] sm:w-44">
          <Select
            label="Batch"
            value={filterBatchId}
            onChange={(e) => setFilterBatchId(e.target.value)}
            options={filterBatchOptions}
            placeholder="All batches"
          />
        </div>
        <div className="w-full min-w-[140px] sm:w-44">
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StudentStatus | "")}
            options={STUDENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            placeholder="All statuses"
          />
        </div>
        <div className="w-full min-w-[160px] sm:w-48">
          <Select
            label="Teacher (assigned batch)"
            value={filterTeacherId}
            onChange={(e) => setFilterTeacherId(e.target.value)}
            options={teacherSelectOptions}
            placeholder="All teachers"
          />
        </div>
      </div>

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
              const sp = s.studentProfile;
              const st = sp?.status as StudentStatus | undefined;
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{sp?.program?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{sp?.batch?.name || "—"}</td>
                  <td className="px-4 py-3">
                    {sp && st ? (
                      <Badge variant={statusBadgeVariant(st)}>{STATUS_LABELS[st]}</Badge>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
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
        isOpen={!!statusModal}
        onClose={closeStatusModal}
        title={
          statusModal?.toStatus === "SUSPENDED"
            ? "Confirm suspension"
            : statusModal?.toStatus === "CANCELLED"
              ? "Confirm cancellation"
              : statusModal?.toStatus === "EXPELLED"
                ? "Confirm expulsion"
                : statusModal?.toStatus === "TRANSFERRED"
                  ? "Confirm transfer"
                  : "Confirm status"
        }
        className="max-w-md"
      >
        {statusModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {statusModal.toStatus === "SUSPENDED"
                ? "Suspension may apply for non-payment of fees, low attendance, or incomplete compulsory academic work. The student will receive a notification."
                : statusModal.toStatus === "CANCELLED"
                  ? "The student will be notified that their admission has been cancelled."
                  : statusModal.toStatus === "EXPELLED"
                    ? "The student and principals will be notified. Enter the policy violation or non-compliance details (required, min. 10 characters)."
                    : "The student and principals will be notified. Enter the destination institution or transfer details (required, min. 10 characters)."}
            </p>
            {statusModal.toStatus === "SUSPENDED" && (
              <Select
                label="Reason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value as typeof suspendReason)}
                options={[
                  { value: "FEES", label: "Fees — non-payment or insufficient payment" },
                  { value: "ATTENDANCE", label: "Attendance — below required %" },
                  { value: "ACADEMIC", label: "Academic — compulsory assignments, tests, quizzes, or projects" },
                  { value: "OTHER", label: "Other non-compliance" },
                ]}
              />
            )}
            <Textarea
              label={
                statusModal.toStatus === "EXPELLED" || statusModal.toStatus === "TRANSFERRED"
                  ? "Details (required — min. 10 characters)"
                  : "Note to student (optional)"
              }
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              placeholder={
                statusModal.toStatus === "EXPELLED"
                  ? "e.g. Expelled under code of conduct for plagiarism on …"
                  : statusModal.toStatus === "TRANSFERRED"
                    ? "e.g. Transferred to … College, program …, effective …"
                    : "Shown in the in-app notification."
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeStatusModal}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void confirmStatusModal()}>
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
          <Select
            label="Enrollment status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
            options={STUDENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
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
