"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type FeedbackCategory = "PROGRAM_CONTENT" | "TEACHING" | "OTHER";

interface Row {
  id: string;
  category: string;
  title: string | null;
  message: string;
  principalReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  aboutTeacher: { id: string; firstName: string; lastName: string } | null;
}

const CAT_LABEL: Record<string, string> = {
  PROGRAM_CONTENT: "Program content",
  TEACHING: "Teaching",
  OTHER: "Other",
};

export default function StudentFeedbackPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [category, setCategory] = useState<FeedbackCategory>("PROGRAM_CONTENT");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [aboutTeacherId, setAboutTeacherId] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [fRes, tRes] = await Promise.all([fetch("/api/student/feedback"), fetch("/api/student/my-teachers")]);
    const fData = await fRes.json();
    const tData = await tRes.json();
    setRows(fData.feedback || []);
    setTeachers(tData.teachers || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submit() {
    setSaving(true);
    setBanner(null);
    const res = await fetch("/api/student/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        title: title.trim() || undefined,
        message: message.trim(),
        aboutTeacherId: aboutTeacherId || undefined,
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
    setAboutTeacherId("");
    setBanner("Thank you — your feedback was sent to the administration.");
    void load();
  }

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Share feedback on program content, teaching, or other topics with the principal and administration."
      />

      {banner && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{banner}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              options={[
                { value: "PROGRAM_CONTENT", label: "Program content (modules, materials)" },
                { value: "TEACHING", label: "Teaching quality or delivery" },
                { value: "OTHER", label: "Other" },
              ]}
            />
            <Input
              label="Subject (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
            />
            <Textarea
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Describe your feedback in at least 10 characters."
            />
            {category === "TEACHING" && teachers.length > 0 && (
              <Select
                label="About a specific teacher (optional)"
                value={aboutTeacherId}
                onChange={(e) => setAboutTeacherId(e.target.value)}
                options={teachers.map((t) => ({
                  value: t.id,
                  label: `${t.firstName} ${t.lastName}`,
                }))}
                placeholder="General — not about one person"
              />
            )}
            <Button onClick={() => void submit()} isLoading={saving}>
              Submit feedback
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your feedback history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500">No submissions yet.</p>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="info">{CAT_LABEL[r.category] || r.category}</Badge>
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.title && <p className="font-medium text-gray-900">{r.title}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{r.message}</p>
                  {r.aboutTeacher && (
                    <p className="mt-1 text-xs text-gray-500">
                      Re: {r.aboutTeacher.firstName} {r.aboutTeacher.lastName}
                    </p>
                  )}
                  {r.principalReply && (
                    <div className="mt-3 rounded-md bg-emerald-50 p-3 text-emerald-950">
                      <p className="text-xs font-semibold uppercase text-emerald-800">Administration response</p>
                      <p className="mt-1 whitespace-pre-wrap">{r.principalReply}</p>
                      {r.repliedAt && (
                        <p className="mt-1 text-xs text-emerald-700">{formatDate(r.repliedAt)}</p>
                      )}
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
