"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type FeedbackCategory = "PROGRAM_CONTENT" | "TEACHING" | "OTHER" | "STUDENT_CONCERN";

interface Row {
  id: string;
  category: string;
  title: string | null;
  message: string;
  principalReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  aboutStudent: { id: string; firstName: string; lastName: string } | null;
}

interface StudentOpt {
  id: string;
  firstName: string;
  lastName: string;
}

const CAT_LABEL: Record<string, string> = {
  PROGRAM_CONTENT: "Program content",
  TEACHING: "Teaching / delivery",
  OTHER: "Other",
  STUDENT_CONCERN: "Student concern",
};

export default function TeacherFeedbackPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [category, setCategory] = useState<FeedbackCategory>("PROGRAM_CONTENT");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [aboutStudentId, setAboutStudentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    const [fRes, rRes] = await Promise.all([fetch("/api/teacher/feedback"), fetch("/api/teacher/roster")]);
    const fData = await fRes.json();
    const rData = await rRes.json();
    setRows(fData.feedback || []);
    const studs = (rData.students || []) as { firstName: string; lastName: string; id: string }[];
    setStudents(studs.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName })));
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setSaving(true);
    setBanner(null);
    const res = await fetch("/api/teacher/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        title: title.trim() || undefined,
        message: message.trim(),
        aboutStudentId: category === "STUDENT_CONCERN" ? aboutStudentId : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setBanner((e as { error?: string }).error || "Could not send feedback.");
      return;
    }
    setMessage("");
    setTitle("");
    setAboutStudentId("");
    setBanner("Feedback sent to the principal.");
    void load();
  }

  return (
    <>
      <PageHeader
        title="Feedback to administration"
        description="Send observations to the principal or admin — including student-specific concerns for learners in your batches."
      />

      {banner && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{banner}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Category"
              value={category}
              onChange={(e) => {
                const v = e.target.value as FeedbackCategory;
                setCategory(v);
                if (v !== "STUDENT_CONCERN") setAboutStudentId("");
              }}
              options={[
                { value: "PROGRAM_CONTENT", label: "Program content" },
                { value: "TEACHING", label: "Teaching / coordination" },
                { value: "STUDENT_CONCERN", label: "Student concern (select a student)" },
                { value: "OTHER", label: "Other" },
              ]}
            />
            {category === "STUDENT_CONCERN" && (
              <Select
                label="Student"
                value={aboutStudentId}
                onChange={(e) => setAboutStudentId(e.target.value)}
                options={students.map((s) => ({
                  value: s.id,
                  label: `${s.firstName} ${s.lastName}`,
                }))}
                placeholder="Select student"
              />
            )}
            <Input label="Subject (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
            <Button onClick={() => void submit()} isLoading={saving}>
              Submit
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500">No feedback yet.</p>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="info">{CAT_LABEL[r.category] || r.category}</Badge>
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.aboutStudent && (
                    <p className="text-xs text-gray-600">
                      Student: {r.aboutStudent.firstName} {r.aboutStudent.lastName}
                    </p>
                  )}
                  {r.title && <p className="font-medium text-gray-900">{r.title}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{r.message}</p>
                  {r.principalReply && (
                    <div className="mt-3 rounded-md bg-emerald-50 p-3 text-emerald-950">
                      <p className="text-xs font-semibold uppercase text-emerald-800">Response</p>
                      <p className="mt-1 whitespace-pre-wrap">{r.principalReply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
