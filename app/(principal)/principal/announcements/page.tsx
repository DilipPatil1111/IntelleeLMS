"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
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
  batchId?: string | null;
}

export default function PrincipalAnnouncementsPage() {
  const [list, setList] = useState<AnnouncementRow[]>([]);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string; programId?: string }[]>([]);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    programId: "",
    batchId: "",
    academicYearId: "",
    recipientAll: true,
    sendEmail: true,
    selectedStudentIds: [] as string[],
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
    const [a, p, b, y, s] = await Promise.all([
      fetch("/api/principal/announcements").then((r) => r.json()),
      fetch("/api/principal/programs").then((r) => r.json()),
      fetch("/api/principal/batches").then((r) => r.json()),
      fetch("/api/principal/academic-years").then((r) => r.json()),
      fetch("/api/principal/students").then((r) => r.json()),
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
    setYears((y.years || []).map((x: { id: string; name: string }) => ({ value: x.id, label: x.name })));
    setStudents(
      (s.students || []).map(
        (u: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          studentProfile?: { batchId?: string | null };
        }) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          batchId: u.studentProfile?.batchId,
        })
      )
    );
  }

  const filteredStudents = useMemo(() => {
    let rows = students;
    if (form.batchId) rows = rows.filter((s) => s.batchId === form.batchId);
    return rows;
  }, [students, form.batchId]);

  async function handleCreate() {
    const payload: Record<string, unknown> = {
      title: form.title,
      body: form.body,
      programId: form.programId || null,
      batchId: form.batchId || null,
      academicYearId: form.academicYearId || null,
      recipientAll: form.recipientAll,
      sendEmail: form.sendEmail,
    };
    if (!form.recipientAll) {
      payload.studentIds = form.selectedStudentIds;
    }
    await fetch("/api/principal/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowModal(false);
    setForm({
      title: "",
      body: "",
      programId: "",
      batchId: "",
      academicYearId: "",
      recipientAll: true,
      sendEmail: true,
      selectedStudentIds: [],
    });
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
        description="Broadcast messages to students by program, batch, or year. Default: all students in the current academic year."
        actions={
          <Button
            onClick={() => {
              setForm({
                title: "",
                body: "",
                programId: "",
                batchId: "",
                academicYearId: "",
                recipientAll: true,
                sendEmail: true,
                selectedStudentIds: [],
              });
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
                      {a.program && <Badge variant="info">{a.program.name}</Badge>}
                      {a.batch && <Badge>{a.batch.name}</Badge>}
                      {a.academicYear && <Badge variant="warning">{a.academicYear.name}</Badge>}
                      <Badge variant={a.recipientAll ? "success" : "default"}>
                        {a.recipientAll ? "All matching students" : `${a._count.recipients} selected`}
                      </Badge>
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
          <Textarea label="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="min-h-[140px]" />
          <Select
            label="Program (optional)"
            value={form.programId}
            onChange={(e) => setForm({ ...form, programId: e.target.value })}
            options={programs}
            placeholder="All programs"
          />
          <Select
            label="Batch (optional)"
            value={form.batchId}
            onChange={(e) => setForm({ ...form, batchId: e.target.value })}
            options={batches}
            placeholder="All batches"
          />
          <Select
            label="Academic year (optional)"
            value={form.academicYearId}
            onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
            options={years}
            placeholder="Current year (default when others empty)"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.recipientAll}
              onChange={(e) => setForm({ ...form, recipientAll: e.target.checked })}
            />
            Send to all students matching the filters above (default: all current-year students if filters empty)
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
            Send email copy to recipients
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
