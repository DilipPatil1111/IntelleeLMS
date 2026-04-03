"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Megaphone } from "lucide-react";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  recipientAll: boolean;
  sendToStudents?: boolean;
  sendToTeachers?: boolean;
  allPrograms?: boolean;
  allBatches?: boolean;
  programIds?: string[];
  batchIds?: string[];
  allTeachers?: boolean;
  teacherIds?: string[];
  createdAt: string;
  creator: { firstName: string; lastName: string };
  program: { name: string } | null;
  batch: { name: string } | null;
  academicYear: { name: string } | null;
  _count: { recipients: number };
}

interface StudentOpt {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  programId?: string | null;
  batchId?: string | null;
}

interface TeacherOpt {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

function audienceBadges(a: AnnouncementRow): ReactNode[] {
  const sendSt = a.sendToStudents !== false;
  const sendT = a.sendToTeachers === true;
  const bits: ReactNode[] = [];
  if (sendSt) {
    const ap = a.allPrograms !== false;
    const ab = a.allBatches !== false;
    const pids = a.programIds?.length ?? 0;
    const bids = a.batchIds?.length ?? 0;
    if (ap && ab) bits.push(<Badge key="stf" variant="info">Students: current year (all programs / batches)</Badge>);
    else {
      const p = !ap && pids > 0 ? `${pids} program(s)` : ap ? "All programs" : a.program?.name ?? "—";
      const b = !ab && bids > 0 ? `${bids} batch(es)` : ab ? "All batches" : a.batch?.name ?? "—";
      bits.push(
        <Badge key="st" variant="info">
          Students: {p} · {b}
        </Badge>
      );
    }
    bits.push(
      <Badge key="stmode" variant={a.recipientAll ? "success" : "default"}>
        {a.recipientAll ? "All matching students" : `${a._count.recipients} recipient(s)`}
      </Badge>
    );
  }
  if (sendT) {
    bits.push(
      <Badge key="te" variant="warning">
        Teachers: {a.allTeachers ? "All" : `${a.teacherIds?.length ?? 0} selected`}
      </Badge>
    );
  }
  return bits;
}

export default function PrincipalAnnouncementsPage() {
  const [list, setList] = useState<AnnouncementRow[]>([]);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string; programId?: string }[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    allPrograms: true,
    programIds: [] as string[],
    allBatches: true,
    batchIds: [] as string[],
    sendToStudents: true,
    recipientAll: true,
    selectedStudentIds: [] as string[],
    sendToTeachers: false,
    allTeachers: false,
    selectedTeacherIds: [] as string[],
    emailCopyToSender: false,
  });

  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("emailTemplateDraft");
      if (raw) {
        try {
          const { subject, body } = JSON.parse(raw) as { subject?: string; body?: string };
          setForm((f) => ({
            ...f,
            title: subject?.slice(0, 200) || f.title,
            body: body || f.body,
          }));
          setShowModal(true);
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem("emailTemplateDraft");
      }
    }
  }, []);

  async function load() {
    const [a, p, b, s, t] = await Promise.all([
      fetch("/api/principal/announcements").then((r) => r.json()),
      fetch("/api/principal/programs").then((r) => r.json()),
      fetch("/api/principal/batches").then((r) => r.json()),
      fetch("/api/principal/students").then((r) => r.json()),
      fetch("/api/principal/teachers").then((r) => r.json()),
    ]);
    setList(a.announcements || []);
    setPrograms((p.programs || []).map((x: { id: string; name: string }) => ({ value: x.id, label: x.name })));
    setBatches(
      (b.batches || []).map((x: { id: string; name: string; programId: string }) => ({
        value: x.id,
        label: x.name,
        programId: x.programId,
      }))
    );
    setStudents(
      (s.students || []).map(
        (u: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          studentProfile?: { batchId?: string | null; programId?: string | null };
        }) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          batchId: u.studentProfile?.batchId,
          programId: u.studentProfile?.programId,
        })
      )
    );
    setTeachers(
      (t.teachers || []).map((u: { id: string; firstName: string; lastName: string; email: string }) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
      }))
    );
  }

  const visibleBatches = useMemo(() => {
    if (form.allPrograms) return batches;
    if (!form.programIds.length) return [];
    return batches.filter((x) => x.programId && form.programIds.includes(x.programId));
  }, [batches, form.allPrograms, form.programIds]);

  const filteredStudents = useMemo(() => {
    let rows = students;
    if (form.sendToStudents && !form.allBatches && form.batchIds.length > 0) {
      rows = rows.filter((s) => s.batchId && form.batchIds.includes(s.batchId));
    }
    if (form.sendToStudents && !form.allPrograms && form.programIds.length > 0) {
      rows = rows.filter((s) => s.programId && form.programIds.includes(s.programId));
    }
    return rows;
  }, [students, form.sendToStudents, form.allPrograms, form.allBatches, form.programIds, form.batchIds]);

  function toggleProgram(id: string) {
    setForm((f) => {
      const has = f.programIds.includes(id);
      const programIds = has ? f.programIds.filter((x) => x !== id) : [...f.programIds, id];
      return { ...f, programIds, allPrograms: false };
    });
  }

  function toggleBatch(id: string) {
    setForm((f) => {
      const has = f.batchIds.includes(id);
      const batchIds = has ? f.batchIds.filter((x) => x !== id) : [...f.batchIds, id];
      return { ...f, batchIds, allBatches: false };
    });
  }

  function toggleTeacher(id: string) {
    setForm((f) => {
      const has = f.selectedTeacherIds.includes(id);
      const selectedTeacherIds = has ? f.selectedTeacherIds.filter((x) => x !== id) : [...f.selectedTeacherIds, id];
      return { ...f, selectedTeacherIds, allTeachers: false };
    });
  }

  function initialForm() {
    return {
      title: "",
      body: "",
      allPrograms: true,
      programIds: [] as string[],
      allBatches: true,
      batchIds: [] as string[],
      sendToStudents: true,
      recipientAll: true,
      selectedStudentIds: [] as string[],
      sendToTeachers: false,
      allTeachers: false,
      selectedTeacherIds: [] as string[],
      emailCopyToSender: false,
    };
  }

  async function handleCreate() {
    const payload: Record<string, unknown> = {
      title: form.title,
      body: form.body,
      allPrograms: form.allPrograms,
      programIds: form.allPrograms ? [] : form.programIds,
      allBatches: form.allBatches,
      batchIds: form.allBatches ? [] : form.batchIds,
      sendToStudents: form.sendToStudents,
      recipientAll: form.sendToStudents ? form.recipientAll : false,
      sendToTeachers: form.sendToTeachers,
      allTeachers: form.sendToTeachers ? form.allTeachers : false,
      teacherIds: form.sendToTeachers && !form.allTeachers ? form.selectedTeacherIds : [],
      emailCopyToSender: form.emailCopyToSender,
    };
    if (form.sendToStudents && !form.recipientAll) {
      payload.studentIds = form.selectedStudentIds;
    }
    const res = await fetch("/api/principal/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(typeof err.error === "string" ? err.error : "Could not publish announcement");
      return;
    }
    setShowModal(false);
    setForm(initialForm());
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await fetch(`/api/principal/announcements/${id}`, { method: "DELETE" });
    load();
  }

  function toggleStudent(id: string) {
    setForm((f) => ({
      ...f,
      selectedStudentIds: f.selectedStudentIds.includes(id)
        ? f.selectedStudentIds.filter((x) => x !== id)
        : [...f.selectedStudentIds, id],
    }));
  }

  function selectAllStudents() {
    setForm((f) => ({ ...f, selectedStudentIds: filteredStudents.map((s) => s.id) }));
  }

  function deselectAllStudents() {
    setForm((f) => ({ ...f, selectedStudentIds: [] }));
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Broadcast to students and/or teachers. Narrow by program and batch, or pick individuals. With “all programs” and “all batches”, students in the current academic year are included."
        actions={
          <Button
            onClick={() => {
              setForm(initialForm());
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> New announcement
          </Button>
        }
      />

      <div className="space-y-4">
        {list.map((a) => (
          <Card key={a.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap line-clamp-3">{a.body}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {audienceBadges(a)}
                      {a.academicYear && <Badge variant="default">{a.academicYear.name}</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {a.creator.firstName} {a.creator.lastName} · {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create announcement" className="max-w-2xl">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea
            label="Message"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="min-h-[140px]"
          />

          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <p className="text-sm font-medium text-gray-900">Programs</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allPrograms}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allPrograms: e.target.checked,
                    programIds: e.target.checked ? [] : f.programIds,
                  }))
                }
              />
              All programs
            </label>
            {!form.allPrograms && (
              <div className="flex flex-wrap gap-2 mb-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setForm((f) => ({ ...f, programIds: programs.map((p) => p.value) }))}
                >
                  Select all programs
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, programIds: [] }))}>
                  Deselect all
                </Button>
              </div>
            )}
            {!form.allPrograms && (
              <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-100 rounded p-2">
                {programs.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.programIds.includes(p.value)} onChange={() => toggleProgram(p.value)} />
                    {p.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <p className="text-sm font-medium text-gray-900">Batches</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allBatches}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allBatches: e.target.checked,
                    batchIds: e.target.checked ? [] : f.batchIds,
                  }))
                }
              />
              All batches
            </label>
            {!form.allBatches && (
              <div className="flex flex-wrap gap-2 mb-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setForm((f) => ({ ...f, batchIds: visibleBatches.map((b) => b.value) }))}
                >
                  Select all listed
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, batchIds: [] }))}>
                  Deselect all
                </Button>
              </div>
            )}
            {!form.allBatches && (
              <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-100 rounded p-2">
                {visibleBatches.length === 0 ? (
                  <p className="text-xs text-amber-700">Select program(s) first, or enable All programs.</p>
                ) : (
                  visibleBatches.map((b) => (
                    <label key={b.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.batchIds.includes(b.value)} onChange={() => toggleBatch(b.value)} />
                      {b.label}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.sendToStudents}
              onChange={(e) => setForm({ ...form, sendToStudents: e.target.checked })}
            />
            Send to students
          </label>

          {form.sendToStudents && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.recipientAll}
                  onChange={(e) => setForm({ ...form, recipientAll: e.target.checked })}
                />
                All students matching the program/batch filters above (default when both “All programs” and “All batches”: current academic year)
              </label>
              {!form.recipientAll && (
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium">Select students</p>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={selectAllStudents}>
                        Select all
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={deselectAllStudents}>
                        Deselect all
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.selectedStudentIds.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                        />
                        {s.firstName} {s.lastName} ({s.email})
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.sendToTeachers}
                onChange={(e) => setForm({ ...form, sendToTeachers: e.target.checked })}
              />
              Send to teachers
            </label>
            {form.sendToTeachers && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allTeachers}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        allTeachers: e.target.checked,
                        selectedTeacherIds: e.target.checked ? [] : f.selectedTeacherIds,
                      }))
                    }
                  />
                  All teachers
                </label>
                {!form.allTeachers && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setForm((f) => ({ ...f, selectedTeacherIds: teachers.map((t) => t.id) }))}
                      >
                        Select all teachers
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setForm((f) => ({ ...f, selectedTeacherIds: [] }))}
                      >
                        Deselect all
                      </Button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-100 rounded p-2">
                      {teachers.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.selectedTeacherIds.includes(t.id)}
                            onChange={() => toggleTeacher(t.id)}
                          />
                          {t.firstName} {t.lastName} ({t.email})
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.emailCopyToSender}
              onChange={(e) => setForm({ ...form, emailCopyToSender: e.target.checked })}
            />
            Send email copy to Sender
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || !form.body.trim()}>
              Publish
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
