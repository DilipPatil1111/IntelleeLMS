"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { Trash2, MessageSquareReply } from "lucide-react";

interface Author {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface FRow {
  id: string;
  category: string;
  authorRole: string;
  title: string | null;
  message: string;
  principalReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  author: Author;
  aboutStudent: { firstName: string; lastName: string; email: string } | null;
  aboutTeacher: { firstName: string; lastName: string; email: string } | null;
  repliedBy: { firstName: string; lastName: string } | null;
}

const CAT_LABEL: Record<string, string> = {
  PROGRAM_CONTENT: "Program content",
  TEACHING: "Teaching",
  OTHER: "Other",
  STUDENT_CONCERN: "Student concern",
};

export default function PrincipalFeedbackPage() {
  const [rows, setRows] = useState<FRow[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");
  const [role, setRole] = useState("");
  const [replyModal, setReplyModal] = useState<FRow | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (category) params.set("category", category);
    if (role) params.set("role", role);
    const qs = params.toString();
    const res = await fetch(`/api/principal/feedback${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    setRows(data.feedback || []);
  }, [debouncedQ, category, role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function sendReply() {
    if (!replyModal) return;
    setSaving(true);
    await fetch(`/api/principal/feedback/${replyModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ principalReply: replyText.trim() }),
    });
    setSaving(false);
    setReplyModal(null);
    setReplyText("");
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this feedback permanently?")) return;
    await fetch(`/api/principal/feedback/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <>
      <PageHeader
        title="Feedback inbox"
        description="Review feedback from students and teachers. Reply with action taken or delete entries from history."
      />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Input label="Search" placeholder="Name, email, or text" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-full min-w-[140px] sm:w-44">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: "PROGRAM_CONTENT", label: "Program content" },
              { value: "TEACHING", label: "Teaching" },
              { value: "OTHER", label: "Other" },
              { value: "STUDENT_CONCERN", label: "Student concern" },
            ]}
            placeholder="All categories"
          />
        </div>
        <div className="w-full min-w-[120px] sm:w-36">
          <Select
            label="From"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: "STUDENT", label: "Students" },
              { value: "TEACHER", label: "Teachers" },
            ]}
            placeholder="All"
          />
        </div>
      </div>

      <div className="space-y-4">
        {rows.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-8 text-center text-gray-500">No feedback matches your filters.</p>
            </CardContent>
          </Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={r.authorRole === "TEACHER" ? "warning" : "info"}>{r.authorRole}</Badge>
                      <Badge variant="default">{CAT_LABEL[r.category] || r.category}</Badge>
                      <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      {r.author.firstName} {r.author.lastName}{" "}
                      <span className="font-normal text-gray-500">({r.author.email})</span>
                    </p>
                    {r.title && <p className="mt-1 font-semibold text-gray-800">{r.title}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{r.message}</p>
                    {r.aboutStudent && (
                      <p className="mt-2 text-xs text-gray-600">
                        About student: {r.aboutStudent.firstName} {r.aboutStudent.lastName} ({r.aboutStudent.email})
                      </p>
                    )}
                    {r.aboutTeacher && (
                      <p className="mt-2 text-xs text-gray-600">
                        About teacher: {r.aboutTeacher.firstName} {r.aboutTeacher.lastName}
                      </p>
                    )}
                    {r.principalReply && (
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                        <p className="text-xs font-semibold uppercase text-emerald-800">Action taken / reply</p>
                        <p className="mt-1 whitespace-pre-wrap">{r.principalReply}</p>
                        {r.repliedBy && r.repliedAt && (
                          <p className="mt-2 text-xs text-emerald-800">
                            {r.repliedBy.firstName} {r.repliedBy.lastName} · {formatDate(r.repliedAt)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1 sm:flex-col">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyModal(r);
                        setReplyText(r.principalReply || "");
                      }}
                    >
                      <MessageSquareReply className="mr-1 h-4 w-4" />
                      {r.principalReply ? "Edit reply" : "Reply"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => void remove(r.id)}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={!!replyModal}
        onClose={() => setReplyModal(null)}
        title="Reply — action taken"
        className="max-w-lg"
      >
        <p className="mb-3 text-sm text-gray-600">
          This message is saved on the feedback record. The submitter receives an in-app notification and an email.
        </p>
        <Textarea
          label="Your response"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={6}
          placeholder="Describe what was done or next steps."
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setReplyModal(null)}>
            Cancel
          </Button>
          <Button onClick={() => void sendReply()} isLoading={saving}>
            Save & notify
          </Button>
        </div>
      </Modal>
    </>
  );
}
