"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Megaphone } from "lucide-react";

interface Ann {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  creator: { firstName: string; lastName: string };
  program: { name: string } | null;
  batch: { name: string } | null;
}

const PAGE_SIZE = 10;

export default function TeacherAnnouncementsPage() {
  const [list, setList] = useState<Ann[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [programs, setPrograms] = useState<{ value: string; label: string }[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    programId: "",
    batchId: "",
    recipientAll: true,
    selectedStudentIds: [] as string[],
  });

  const fetchAnnouncements = useCallback(async (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(PAGE_SIZE));
    const a = await fetch(`/api/teacher/announcements?${params.toString()}`).then((r) => r.json());
    setList(a.announcements || []);
    setListTotal(typeof a.total === "number" ? a.total : 0);
  }, []);

  useEffect(() => {
    void (async () => {
      const [p, b] = await Promise.all([
        fetch("/api/teacher/programs").then((r) => r.json()),
        fetch("/api/teacher/options").then((r) => r.json()),
      ]);
      setPrograms(p.programs || []);
      setBatches(b.batches || []);
    })();
  }, []);

  useEffect(() => {
    void fetchAnnouncements(page);
  }, [page, fetchAnnouncements]);

  useEffect(() => {
    if (!form.batchId) return;
    fetch(`/api/teacher/students?batchId=${form.batchId}`)
      .then((r) => r.json())
      .then((d) =>
        setStudents(
          (d.students || []).map((u: { id: string; firstName: string; lastName: string; email: string }) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
          }))
        )
      );
  }, [form.batchId]);

  async function handleCreate() {
    await fetch("/api/teacher/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        body: form.body,
        programId: form.programId,
        batchId: form.batchId || null,
        recipientAll: form.recipientAll,
        studentIds: form.recipientAll ? undefined : form.selectedStudentIds,
      }),
    });
    setShowModal(false);
    setForm({ title: "", body: "", programId: "", batchId: "", recipientAll: true, selectedStudentIds: [] });
    setPage(1);
    await fetchAnnouncements(1);
  }

  function toggle(sid: string) {
    setForm((f) => ({
      ...f,
      selectedStudentIds: f.selectedStudentIds.includes(sid)
        ? f.selectedStudentIds.filter((x) => x !== sid)
        : [...f.selectedStudentIds, sid],
    }));
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="View college announcements. Create announcements for your assigned programs and batches."
        actions={
          <Button
            onClick={() => {
              setForm({
                title: "",
                body: "",
                programId: "",
                batchId: "",
                recipientAll: true,
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
        {listTotal > 0 && (
          <p className="text-sm text-gray-500">
            {listTotal} announcement{listTotal === 1 ? "" : "s"} total · {PAGE_SIZE} per page
          </p>
        )}
        {list.map((a) => (
          <Card key={a.id}>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">{a.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {a.program && <Badge variant="info">{a.program.name}</Badge>}
                    {a.batch && <Badge>{a.batch.name}</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {a.creator.firstName} {a.creator.lastName} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {listTotal > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              Page {page} of {Math.max(1, Math.ceil(listTotal / PAGE_SIZE))}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= Math.max(1, Math.ceil(listTotal / PAGE_SIZE))}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create announcement" className="max-w-lg">
        <div className="space-y-4">
          <Select
            label="Program (assigned)"
            value={form.programId}
            onChange={(e) => setForm({ ...form, programId: e.target.value })}
            options={programs}
            placeholder="Select program"
          />
          <Select
            label="Batch"
            value={form.batchId}
            onChange={(e) => setForm({ ...form, batchId: e.target.value })}
            options={batches}
            placeholder="Select batch"
          />
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.recipientAll}
              onChange={(e) => setForm({ ...form, recipientAll: e.target.checked })}
            />
            All students in batch
          </label>
          {!form.recipientAll && (
            <div className="max-h-36 overflow-y-auto border rounded p-2 space-y-1">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.selectedStudentIds.includes(s.id)} onChange={() => toggle(s.id)} />
                  {s.firstName} {s.lastName}
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!form.programId || !form.batchId || !form.title || !form.body}>
              Send
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
