"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Trash2, Send, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function AssessmentActions({ assessmentId, status, title }: { assessmentId: string; status: string; title: string }) {
  const router = useRouter();
  const [showPublish, setShowPublish] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyTitle, setCopyTitle] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (showPublish) {
      fetch(`/api/teacher/assessments/${assessmentId}/students`)
        .then((r) => r.json())
        .then((data) => {
          const list = data.students || [];
          setStudents(list);
          setSelectedIds(list.map((s: Student) => s.id));
        });
    }
  }, [showPublish, assessmentId]);

  function toggleStudent(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  }

  async function handlePublish() {
    setPublishing(true);
    await fetch(`/api/teacher/assessments/${assessmentId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedStudentIds: selectedIds, sendEmail }),
    });
    setPublishing(false);
    setShowPublish(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/teacher/assessments/${assessmentId}`, { method: "DELETE" });
    setDeleting(false);
    router.push("/teacher/assessments");
  }

  async function handleCopy() {
    setCopying(true);
    try {
      const res = await fetch(`/api/teacher/assessments/${assessmentId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: copyTitle || undefined }),
      });
      const data = await res.json();
      if (data.id) {
        setShowCopy(false);
        router.push(`/teacher/assessments/${data.id}`);
      }
    } catch { /* ignore */ }
    setCopying(false);
  }

  return (
    <>
      <Button onClick={() => { setCopyTitle(`${title} (Copy)`); setShowCopy(true); }} variant="outline" size="sm">
        <Copy className="h-4 w-4 mr-1" /> Copy Quiz
      </Button>

      {(status === "DRAFT" || status === "CLOSED") && (
        <Button onClick={() => setShowPublish(true)} variant="primary" size="sm">
          <Send className="h-4 w-4 mr-1" /> Publish
        </Button>
      )}

      {status === "DRAFT" && (
        <Button onClick={() => setShowDelete(true)} variant="danger" size="sm">
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      )}

      <Modal isOpen={showPublish} onClose={() => setShowPublish(false)} title="Publish Assessment" className="max-w-xl">
        <p className="text-sm text-gray-500 mb-4">Select which students should receive this assessment. All students in the batch are selected by default.</p>

        <div className="mb-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={selectedIds.length === students.length && students.length > 0} onChange={toggleAll} className="rounded text-indigo-600" />
            Select All ({students.length})
          </label>
          <span className="text-xs text-gray-400">{selectedIds.length} selected</span>
        </div>

        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleStudent(s.id)} className="rounded text-indigo-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{s.email}</p>
              </div>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 mt-4 text-sm text-gray-700">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded text-indigo-600" />
          Send email notification to selected students
        </label>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setShowPublish(false)}>Cancel</Button>
          <Button onClick={handlePublish} isLoading={publishing} disabled={selectedIds.length === 0}>
            Publish to {selectedIds.length} Student{selectedIds.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Assessment">
        <p className="text-sm text-gray-500 mb-4">Are you sure you want to delete this assessment? This will permanently remove all questions, answers, and student submissions. This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleting}>Delete Permanently</Button>
        </div>
      </Modal>

      <Modal isOpen={showCopy} onClose={() => setShowCopy(false)} title="Copy Assessment">
        <p className="text-sm text-gray-500 mb-4">
          Create a duplicate of this assessment as a new DRAFT. All questions, options, and correct answers will be copied. Scheduling dates and student submissions are not copied.
        </p>
        <Input
          label="Title for the copy"
          value={copyTitle}
          onChange={(e) => setCopyTitle(e.target.value)}
          placeholder="e.g. Midterm Quiz - Batch B"
        />
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setShowCopy(false)}>Cancel</Button>
          <Button onClick={handleCopy} isLoading={copying}>
            <Copy className="h-4 w-4 mr-1" /> Create Copy
          </Button>
        </div>
      </Modal>
    </>
  );
}
