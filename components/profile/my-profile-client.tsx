"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { blobFileUrl } from "@/lib/blob-url";

// ── Types ───────────────────────────────────────────────────────────────────

interface StudentInfo {
  enrollmentNo: string | null;
  status: string | null;
  program: { name: string } | null;
  batch: { name: string; academicYear: { name: string } | null } | null;
}

interface TeacherInfo {
  specialization: string | null;
  qualification: string | null;
  joinDate: string;
  teacherPrograms: { program: { name: string } }[];
}

interface UserProfile {
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
  profilePicture: string | null;
  role: string;
  createdAt: string;
  studentProfile?: StudentInfo | null;
  teacherProfile?: TeacherInfo | null;
}

interface Alert {
  tone: "success" | "error";
  text: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function initials(u: UserProfile) {
  return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
}

// ── Main component ───────────────────────────────────────────────────────────

interface MyProfileClientProps {
  /** When true, suppresses the PageHeader so the component can be embedded inside another page. */
  embedded?: boolean;
}

export function MyProfileClient({ embedded = false }: MyProfileClientProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);

  // photo
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // password change
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwAlert, setPwAlert] = useState<Alert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/user/profile", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { user?: UserProfile; error?: string };
      if (res.ok && data.user) {
        setUser(data.user);
        setForm(data.user);
      } else {
        setUser(null);
        setLoadError(
          data.error ?? (res.status === 401 ? "Please sign in again." : `Could not load profile (${res.status}).`)
        );
      }
    } catch {
      setUser(null);
      setLoadError("Network error while loading your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function field(key: keyof UserProfile) {
    return (form[key] as string | null | undefined) ?? "";
  }

  function set(key: keyof UserProfile, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile() {
    setSaving(true);
    setAlert(null);
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        postalCode: form.postalCode,
        visaStatus: form.visaStatus,
      }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; user?: UserProfile };
    setSaving(false);
    if (!res.ok || !data.ok) {
      setAlert({ tone: "error", text: data.error ?? "Save failed." });
      return;
    }
    setUser((prev) => prev ? { ...prev, ...data.user } : prev);
    setAlert({ tone: "success", text: "Profile updated successfully." });
  }

  async function uploadPhoto(file: File) {
    setPhotoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    // Use the role-appropriate endpoint or the generic student one (all roles have the same blob logic)
    const endpoint = user?.role === "STUDENT"
      ? "/api/student/profile-picture"
      : "/api/user/profile-picture";
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({})) as { profilePicture?: string; error?: string };
    setPhotoUploading(false);
    if (res.ok && data.profilePicture) {
      setUser((prev) => prev ? { ...prev, profilePicture: data.profilePicture ?? prev.profilePicture } : prev);
      setForm((prev) => ({ ...prev, profilePicture: data.profilePicture ?? prev.profilePicture }));
      setAlert({ tone: "success", text: "Profile photo updated." });
    } else {
      setAlert({
        tone: "error",
        text: data.error ?? "Photo upload failed. Use JPEG, PNG, WebP, or GIF under 5 MB.",
      });
    }
  }

  async function changePassword() {
    if (!pwForm.next || pwForm.next.length < 8) {
      setPwAlert({ tone: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwAlert({ tone: "error", text: "New passwords do not match." });
      return;
    }
    setPwSaving(true);
    setPwAlert(null);
    const res = await fetch("/api/user/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    });
    const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string };
    setPwSaving(false);
    if (!res.ok || !data.success) {
      setPwAlert({ tone: "error", text: data.error ?? "Password change failed." });
      return;
    }
    setPwAlert({ tone: "success", text: "Password changed successfully." });
    setPwForm({ current: "", next: "", confirm: "" });
  }

  if (loading) {
    return (
      <>
        {!embedded && <PageHeader title="My Profile" description="Manage your personal information" />}
        <p className="text-sm text-gray-500">Loading your profile…</p>
      </>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Profile could not be loaded</p>
        <p className="mt-1 text-amber-800/90">{loadError ?? "Something went wrong. Try again, or use My Profile from the sidebar."}</p>
        <Button className="mt-3" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const photoSrc = user.profilePicture ? blobFileUrl(user.profilePicture, "profile", true) : null;

  return (
    <>
      {!embedded && <PageHeader title="My Profile" description="View and update your personal information" />}

      {/* ── Photo + name header ─────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              {photoSrc ? (
                <Image
                  src={photoSrc}
                  alt={`${user.firstName} ${user.lastName}`}
                  width={88}
                  height={88}
                  unoptimized
                  className="h-22 w-22 rounded-full object-cover ring-2 ring-indigo-100"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-2xl font-bold ring-2 ring-indigo-50">
                  {initials(user)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">
                {user.firstName} {user.middleName ? user.middleName + " " : ""}{user.lastName}
              </h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {user.role === "PRINCIPAL" ? "Administrator / Principal" : user.role.charAt(0) + user.role.slice(1).toLowerCase()}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }}
                />
                <Button variant="outline" size="sm" isLoading={photoUploading} onClick={() => photoRef.current?.click()}>
                  {user.profilePicture ? "Change Photo" : "Upload Photo"}
                </Button>
                {user.profilePicture && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const ep =
                        user.role === "STUDENT" ? "/api/student/profile-picture" : "/api/user/profile-picture";
                      await fetch(ep, { method: "DELETE" });
                      setUser((p) => (p ? { ...p, profilePicture: null } : p));
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG or WebP · Max 5 MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {alert && (
        <div className={`mb-4 rounded-md px-4 py-2 text-sm border ${alert.tone === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {alert.text}
        </div>
      )}

      {/* ── Editable fields ─────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">First Name <span className="text-red-500">*</span></label>
              <Input value={field("firstName")} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Middle Name</label>
              <Input placeholder="Optional" value={field("middleName")} onChange={(e) => set("middleName", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Last Name <span className="text-red-500">*</span></label>
              <Input value={field("lastName")} onChange={(e) => set("lastName", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
              <Input value={user.email} disabled className="bg-gray-50 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Phone</label>
              <Input placeholder="e.g. +1-555-0100" value={field("phone")} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Visa / Immigration Status</label>
              <Input placeholder="e.g. Student Visa" value={field("visaStatus")} onChange={(e) => set("visaStatus", e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Address</label>
              <Input placeholder="Street address" value={field("address")} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">City</label>
              <Input placeholder="City" value={field("city")} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">State / Province</label>
              <Input placeholder="State" value={field("state")} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Country</label>
              <Input placeholder="Country" value={field("country")} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Postal / ZIP Code</label>
              <Input placeholder="Postal code" value={field("postalCode")} onChange={(e) => set("postalCode", e.target.value)} />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => void saveProfile()} isLoading={saving}>
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Role-specific read-only info ─────────────────────── */}
      {user.role === "STUDENT" && user.studentProfile && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Academic Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { label: "Enrollment No.", value: user.studentProfile.enrollmentNo ?? "—" },
                { label: "Status", value: user.studentProfile.status ?? "—" },
                { label: "Program", value: user.studentProfile.program?.name ?? "Not assigned" },
                { label: "Batch / Class", value: user.studentProfile.batch?.name ?? "Not assigned" },
                { label: "Academic Year", value: user.studentProfile.batch?.academicYear?.name ?? "—" },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{f.label}</p>
                  <p className="mt-1 text-sm text-gray-900">{f.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {user.role === "TEACHER" && user.teacherProfile && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Teaching Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { label: "Specialization", value: user.teacherProfile.specialization ?? "—" },
                { label: "Qualification", value: user.teacherProfile.qualification ?? "—" },
                {
                  label: "Joined",
                  value: user.teacherProfile.joinDate
                    ? new Date(user.teacherProfile.joinDate).toLocaleDateString()
                    : "—",
                },
                {
                  label: "Assigned Programs",
                  value: user.teacherProfile.teacherPrograms.length > 0
                    ? user.teacherProfile.teacherPrograms.map((p) => p.program.name).join(", ")
                    : "None",
                },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{f.label}</p>
                  <p className="mt-1 text-sm text-gray-900">{f.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Change Password ──────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent>
          {pwAlert && (
            <div className={`mb-4 rounded-md px-4 py-2 text-sm border ${pwAlert.tone === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {pwAlert.text}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Password</label>
              <Input
                type="password"
                autoComplete="current-password"
                value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">New Password</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={pwForm.next}
                onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Confirm New Password</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Minimum 8 characters.</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void changePassword()} isLoading={pwSaving}>
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
