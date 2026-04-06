"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  Plus, Search, X, Eye, EyeOff,
  GraduationCap, Users, ShieldCheck, MoreVertical, Pencil, UserX, UserCheck, Trash2,
} from "lucide-react";

const PAGE_SIZE = 15;

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "STUDENT" | "TEACHER" | "PRINCIPAL";

interface UserRow {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  visaStatus: string | null;
  role: Role;
  isActive: boolean;
  profilePicture: string | null;
  createdAt: string;
  studentProfile?: { enrollmentNo: string | null; status: string | null; programId: string | null; batchId: string | null } | null;
  teacherProfile?: { employeeId: string | null; department: string | null; specialization: string | null } | null;
}

interface Alert { tone: "success" | "error"; text: string; }

type Tab = "ALL" | "STUDENT" | "TEACHER" | "PRINCIPAL";

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  TEACHER: "Teacher",
  PRINCIPAL: "Administrator",
};

const emptyCreate = {
  firstName: "", middleName: "", lastName: "", email: "",
  phone: "", role: "STUDENT" as Role,
  enrollmentNo: "", programId: "", batchId: "",
  employeeId: "", department: "", specialization: "",
  password: "",
};

// ── Row actions menu (3-dot) ─────────────────────────────────────────────────

function RowActionsMenu({
  user: u,
  currentUserId,
  onEdit,
  onDeactivate,
  onReactivate,
  onDelete,
}: {
  user: UserRow;
  currentUserId?: string;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({
      top: r.bottom + 4,
      right: typeof window !== "undefined" ? window.innerWidth - r.right : 0,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    function handleDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleScrollResize() {
      updateMenuPosition();
    }
    document.addEventListener("mousedown", handleDoc);
    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    return () => {
      document.removeEventListener("mousedown", handleDoc);
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
    };
  }, [open, updateMenuPosition]);

  const isSelf = currentUserId === u.id;

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] min-w-[11rem] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4 text-gray-400" />
              Edit
            </button>
            {!isSelf && u.isActive && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"
                onClick={() => {
                  setOpen(false);
                  onDeactivate();
                }}
              >
                <UserX className="h-4 w-4" />
                Deactivate
              </button>
            )}
            {!isSelf && !u.isActive && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-green-700 hover:bg-green-50"
                onClick={() => {
                  setOpen(false);
                  onReactivate();
                }}
              >
                <UserCheck className="h-4 w-4" />
                Reactivate
              </button>
            )}
            {!isSelf && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="flex justify-end">
      {menu}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open row actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => {
            if (!v && triggerRef.current) {
              const r = triggerRef.current.getBoundingClientRect();
              setMenuPos({
                top: r.bottom + 4,
                right: window.innerWidth - r.right,
              });
            }
            return !v;
          });
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserRow & {
    employeeId: string; department: string; specialization: string;
    enrollmentNo: string; programId: string; batchId: string;
  }>>({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const roleParam = tab !== "ALL" ? `&role=${tab}` : "";
    const res = await fetch(`/api/principal/users?q=${encodeURIComponent(q)}${roleParam}`);
    if (res.ok) {
      const data = await res.json() as { users: UserRow[] };
      setUsers(data.users);
    }
    setLoading(false);
  }, [tab, q]);

  useEffect(() => { setPage(1); }, [tab, q]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d: { user?: { id: string } }) => {
        if (d.user?.id) setCurrentUserId(d.user.id);
      })
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim()) {
      setCreateError("First name, last name and email are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/principal/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json() as { ok?: boolean; temporaryPassword?: string; error?: string };
    setCreating(false);
    if (!res.ok || !data.ok) {
      setCreateError(data.error ?? "Failed to create user.");
      return;
    }
    setCreatedCreds({ email: createForm.email, password: data.temporaryPassword ?? "" });
    setCreateForm(emptyCreate);
    setAlert({ tone: "success", text: "User created successfully." });
    void load();
  }

  function openEdit(u: UserRow) {
    setEditError(null);
    setEditUser(u);
    setEditForm({
      firstName: u.firstName,
      middleName: u.middleName ?? "",
      lastName: u.lastName,
      email: u.email,
      phone: u.phone ?? "",
      address: u.address ?? "",
      city: u.city ?? "",
      state: u.state ?? "",
      country: u.country ?? "",
      postalCode: u.postalCode ?? "",
      visaStatus: u.visaStatus ?? "",
      isActive: u.isActive,
      employeeId: u.teacherProfile?.employeeId ?? "",
      department: u.teacherProfile?.department ?? "",
      specialization: u.teacherProfile?.specialization ?? "",
      enrollmentNo: u.studentProfile?.enrollmentNo ?? "",
      programId: u.studentProfile?.programId ?? "",
      batchId: u.studentProfile?.batchId ?? "",
    });
  }

  async function handleSave() {
    if (!editUser) return;
    setSaving(true);
    setEditError(null);
    const res = await fetch(`/api/principal/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) {
      setEditError(data.error ?? "Save failed.");
      return;
    }
    setEditUser(null);
    setAlert({ tone: "success", text: "User updated successfully." });
    void load();
  }

  async function setUserActive(u: UserRow, active: boolean) {
    setAlert(null);
    const res = await fetch(`/api/principal/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: active }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) {
      setAlert({ tone: "error", text: data.error ?? "Could not update account status." });
      return;
    }
    setAlert({
      tone: "success",
      text: `${u.firstName} ${u.lastName} has been ${active ? "reactivated" : "deactivated"}.`,
    });
    void load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setAlert(null);
    const res = await fetch(`/api/principal/users/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json() as { ok?: boolean; error?: string };
    setDeleting(false);
    setDeleteTarget(null);
    if (!res.ok) {
      setAlert({ tone: "error", text: data.error ?? "Delete failed." });
      return;
    }
    setAlert({ tone: "success", text: "User account removed permanently." });
    void load();
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "ALL", label: "All Users", icon: <Users className="w-4 h-4" /> },
    { id: "STUDENT", label: "Students", icon: <GraduationCap className="w-4 h-4" /> },
    { id: "TEACHER", label: "Teachers", icon: <Users className="w-4 h-4" /> },
    { id: "PRINCIPAL", label: "Administrators", icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  const roleBadge = (role: Role, isActive: boolean) => {
    const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    const color = role === "STUDENT"
      ? "bg-blue-100 text-blue-700"
      : role === "TEACHER"
        ? "bg-purple-100 text-purple-700"
        : "bg-orange-100 text-orange-700";
    return (
      <span className={`${base} ${color} ${!isActive ? "opacity-50" : ""}`}>
        {ROLE_LABELS[role]}
      </span>
    );
  };

  return (
    <>
      <PageHeader
        title="User Management"
        description="Create, view, edit and manage all user accounts — students, teachers, and administrators."
      />

      {alert && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${
          alert.tone === "success"
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          <span>{alert.text}</span>
          <button type="button" onClick={() => setAlert(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button onClick={() => { setCreatedCreds(null); setCreateForm(emptyCreate); setCreateError(null); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add user
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">Loading…</div>
          ) : users.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-14"> </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u) => (
                    <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.isActive ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {u.firstName} {u.middleName ? `${u.middleName} ` : ""}{u.lastName}
                        </div>
                        {u.studentProfile?.enrollmentNo && (
                          <div className="text-xs text-gray-400 mt-0.5">{u.studentProfile.enrollmentNo}</div>
                        )}
                        {u.teacherProfile?.employeeId && (
                          <div className="text-xs text-gray-400 mt-0.5">{u.teacherProfile.employeeId}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.phone ?? "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{roleBadge(u.role, u.isActive)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.isActive ? "text-green-700" : "text-gray-400"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right align-middle">
                        <RowActionsMenu
                          user={u}
                          currentUserId={currentUserId}
                          onEdit={() => openEdit(u)}
                          onDeactivate={() => void setUserActive(u, false)}
                          onReactivate={() => void setUserActive(u, true)}
                          onDelete={() => setDeleteTarget(u)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination page={page} totalPages={Math.ceil(users.length / PAGE_SIZE)} onPageChange={setPage} totalItems={users.length} itemLabel="users" className="mt-4" />

      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setCreatedCreds(null); setCreateError(null); }} title="Add New User">
        {createdCreds ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">User created successfully!</p>
              <p className="text-sm text-green-700">Share these credentials with the user — they will be asked to change their password on first login.</p>
            </div>
            <div className="space-y-2">
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</span>
                <p className="text-sm font-mono bg-gray-50 border rounded px-3 py-2">{createdCreds.email}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Temporary Password</span>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono bg-gray-50 border rounded px-3 py-2 flex-1">
                    {showPassword ? createdCreds.password : "•".repeat(Math.max(createdCreds.password.length, 8))}
                  </p>
                  <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(createdCreds.password)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => { setCreateOpen(false); setCreatedCreds(null); }}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {createError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
            )}

            <div>
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Role <span className="text-red-500">*</span></span>
              <div className="flex gap-2">
                {(["STUDENT", "TEACHER", "PRINCIPAL"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCreateForm((p) => ({ ...p, role: r }))}
                    className={`flex-1 py-2 rounded-md border text-xs font-medium transition-colors ${
                      createForm.role === r
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name *"
                value={createForm.firstName}
                onChange={(e) => setCreateForm((p) => ({ ...p, firstName: e.target.value }))}
              />
              <Input
                label="Middle Name"
                value={createForm.middleName}
                onChange={(e) => setCreateForm((p) => ({ ...p, middleName: e.target.value }))}
              />
              <Input
                label="Last Name *"
                value={createForm.lastName}
                onChange={(e) => setCreateForm((p) => ({ ...p, lastName: e.target.value }))}
              />
              <Input
                label="Phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <Input
              label="Email *"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            />
            <div>
              <Input
                label="Password (optional — auto-generated if blank)"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">Minimum 8 characters. Leave blank to auto-generate a temporary password.</p>
            </div>

            {createForm.role === "STUDENT" && (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Student details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Enrollment No (optional)"
                    value={createForm.enrollmentNo}
                    onChange={(e) => setCreateForm((p) => ({ ...p, enrollmentNo: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {createForm.role === "TEACHER" && (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Employee ID (optional)"
                    value={createForm.employeeId}
                    onChange={(e) => setCreateForm((p) => ({ ...p, employeeId: e.target.value }))}
                  />
                  <Input
                    label="Department"
                    value={createForm.department}
                    onChange={(e) => setCreateForm((p) => ({ ...p, department: e.target.value }))}
                  />
                  <Input
                    label="Specialization"
                    value={createForm.specialization}
                    onChange={(e) => setCreateForm((p) => ({ ...p, specialization: e.target.value }))}
                    className="col-span-2"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()} isLoading={creating}>Create user</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => { setEditUser(null); setEditError(null); }} title={editUser ? `Edit ${editUser.firstName} ${editUser.lastName}` : ""}>
        {editUser && (
          <div className="space-y-4">
            {editError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>
            )}

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Role: {ROLE_LABELS[editUser.role]}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name *"
                value={(editForm.firstName as string) ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
              />
              <Input
                label="Middle Name"
                value={(editForm.middleName as string) ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, middleName: e.target.value }))}
              />
              <Input
                label="Last Name *"
                value={(editForm.lastName as string) ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
              />
              <Input
                label="Phone"
                value={(editForm.phone as string) ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <Input
              label="Email *"
              type="email"
              autoComplete="email"
              value={(editForm.email as string) ?? ""}
              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
            />

            {editUser.role === "PRINCIPAL" && (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administrator — address and details</p>
                <Input
                  label="Street address"
                  value={(editForm.address as string) ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="City"
                    value={(editForm.city as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                  />
                  <Input
                    label="State / Province"
                    value={(editForm.state as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
                  />
                  <Input
                    label="Country"
                    value={(editForm.country as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))}
                  />
                  <Input
                    label="Postal / ZIP"
                    value={(editForm.postalCode as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, postalCode: e.target.value }))}
                  />
                </div>
                <Input
                  label="Visa / immigration status"
                  value={(editForm.visaStatus as string) ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, visaStatus: e.target.value }))}
                />
              </div>
            )}

            {currentUserId !== editUser.id && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Account status</span>
                <button
                  type="button"
                  onClick={() => setEditForm((p) => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editForm.isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editForm.isActive ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
                <span className={`text-sm ${editForm.isActive ? "text-green-700" : "text-gray-400"}`}>
                  {editForm.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            )}

            {editUser.role === "TEACHER" && (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Employee ID"
                    value={(editForm.employeeId as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, employeeId: e.target.value }))}
                  />
                  <Input
                    label="Department"
                    value={(editForm.department as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                  />
                  <Input
                    label="Specialization"
                    value={(editForm.specialization as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, specialization: e.target.value }))}
                    className="col-span-2"
                  />
                </div>
              </div>
            )}

            {editUser.role === "STUDENT" && (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Student details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Enrollment No"
                    value={(editForm.enrollmentNo as string) ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, enrollmentNo: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button onClick={() => void handleSave()} isLoading={saving}>Save changes</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete user permanently?"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will permanently remove{" "}
              <strong>
                {deleteTarget.firstName} {deleteTarget.lastName}
              </strong>{" "}
              ({deleteTarget.email}) and cannot be undone. Related data may be reassigned to your account where needed.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => void confirmDelete()}
                isLoading={deleting}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
