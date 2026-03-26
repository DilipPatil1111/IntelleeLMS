"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Film } from "lucide-react";

interface QuestionForm {
  id?: string;
  type: "MCQ" | "SHORT" | "PARAGRAPH";
  questionText: string;
  marks: number;
  correctAnswer: string;
  options: { id?: string; optionText: string; isCorrect: boolean }[];
  maxLength: number | null;
  mediaUrl: string;
  mediaType: string;
  additionalInfo: string;
}

export default function EditAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<{ value: string; label: string }[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string }[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "QUIZ",
    subjectId: "",
    batchId: "",
    passingMarks: 0,
    duration: 0,
    scheduledOpenAt: "",
    scheduledCloseAt: "",
    assessmentDate: "",
    instructions: "",
    status: "DRAFT",
  });

  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/teacher/assessments/${params.id}`).then((r) => r.json()),
      fetch("/api/teacher/options").then((r) => r.json()),
    ]).then(([assessmentData, optionsData]) => {
      const a = assessmentData.assessment;
      if (!a) { setError("Assessment not found"); setLoading(false); return; }

      setForm({
        title: a.title || "",
        description: a.description || "",
        type: a.type || "QUIZ",
        subjectId: a.subjectId || "",
        batchId: a.batchId || "",
        passingMarks: a.passingMarks || 0,
        duration: a.duration || 0,
        scheduledOpenAt: a.scheduledOpenAt ? new Date(a.scheduledOpenAt).toISOString().slice(0, 16) : "",
        scheduledCloseAt: a.scheduledCloseAt ? new Date(a.scheduledCloseAt).toISOString().slice(0, 16) : "",
        assessmentDate: a.assessmentDate ? new Date(a.assessmentDate).toISOString().slice(0, 10) : "",
        instructions: a.instructions || "",
        status: a.status || "DRAFT",
      });

      setQuestions(
        (a.questions || []).map((q: Record<string, unknown>) => ({
          id: q.id,
          type: q.type,
          questionText: q.questionText,
          marks: q.marks,
          correctAnswer: q.correctAnswer || "",
          maxLength: q.maxLength,
          mediaUrl: (q.mediaUrl as string) || "",
          mediaType: (q.mediaType as string) || "",
          additionalInfo: (q.additionalInfo as string) || "",
          options: ((q.options as Array<Record<string, unknown>>) || []).map((o) => ({
            id: o.id,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
          })),
        }))
      );

      setSubjects(optionsData.subjects || []);
      setBatches(optionsData.batches || []);
      setLoading(false);
    }).catch(() => { setError("Failed to load assessment"); setLoading(false); });
  }, [params.id]);

  function addQuestion(type: "MCQ" | "SHORT" | "PARAGRAPH") {
    setQuestions([...questions, {
      type, questionText: "", marks: type === "MCQ" ? 2 : type === "SHORT" ? 3 : 7,
      correctAnswer: "",
      options: type === "MCQ" ? [
        { optionText: "", isCorrect: false }, { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false }, { optionText: "", isCorrect: false },
      ] : [],
      maxLength: type === "SHORT" ? 500 : type === "PARAGRAPH" ? 2000 : null,
      mediaUrl: "",
      mediaType: "",
      additionalInfo: "",
    }]);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, updates: Partial<QuestionForm>) {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  }

  function updateOption(qIdx: number, oIdx: number, text: string) {
    const updated = [...questions];
    updated[qIdx].options[oIdx].optionText = text;
    setQuestions(updated);
  }

  function setCorrectOption(qIdx: number, oIdx: number) {
    const updated = [...questions];
    updated[qIdx].options = updated[qIdx].options.map((o, i) => ({ ...o, isCorrect: i === oIdx }));
    setQuestions(updated);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    try {
      const res = await fetch(`/api/teacher/assessments/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, totalMarks, questions }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { router.push(`/teacher/assessments/${params.id}`); }
    } catch { setError("Failed to save"); }
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;

  return (
    <>
      <PageHeader
        title={`Edit: ${form.title}`}
        description="Modify assessment details, questions, and answers"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/teacher/assessments/${params.id}`)}>Cancel</Button>
            <Button onClick={handleSave} isLoading={saving}><Save className="h-4 w-4 mr-1" /> Save Changes</Button>
          </div>
        }
      />

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">{error}</div>}

      <Card className="mb-6">
        <CardHeader><CardTitle>Assessment Details</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[
                { value: "QUIZ", label: "Quiz" }, { value: "TEST", label: "Test" },
                { value: "ASSIGNMENT", label: "Assignment" }, { value: "PROJECT", label: "Project" },
                { value: "HOMEWORK", label: "Homework" },
              ]} />
              <Select label="Subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} options={subjects} placeholder="Select subject" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Batch" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} options={batches} placeholder="Select batch" />
              <Input label="Duration (minutes)" type="number" value={form.duration || ""} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Passing Marks" type="number" value={form.passingMarks || ""} onChange={(e) => setForm({ ...form, passingMarks: parseInt(e.target.value) || 0 })} />
              <Input label="Assessment Date" type="date" value={form.assessmentDate} onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Open At" type="datetime-local" value={form.scheduledOpenAt} onChange={(e) => setForm({ ...form, scheduledOpenAt: e.target.value })} />
              <Input label="Close At" type="datetime-local" value={form.scheduledCloseAt} onChange={(e) => setForm({ ...form, scheduledCloseAt: e.target.value })} />
            </div>
            <Textarea label="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Questions ({questions.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => addQuestion("MCQ")}><Plus className="h-4 w-4 mr-1" /> MCQ</Button>
              <Button variant="outline" size="sm" onClick={() => addQuestion("SHORT")}><Plus className="h-4 w-4 mr-1" /> Short</Button>
              <Button variant="outline" size="sm" onClick={() => addQuestion("PARAGRAPH")}><Plus className="h-4 w-4 mr-1" /> Paragraph</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">Q{idx + 1}</Badge>
                    <Badge>{q.type}</Badge>
                  </div>
                  <button onClick={() => removeQuestion(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
                <Textarea value={q.questionText} onChange={(e) => updateQuestion(idx, { questionText: e.target.value })} placeholder="Enter question text..." className="mb-3" />
                <Input label="Marks" type="number" value={q.marks} onChange={(e) => updateQuestion(idx, { marks: parseFloat(e.target.value) || 0 })} className="mb-3 max-w-[120px]" />

                {q.type === "MCQ" && (
                  <div className="space-y-2 mt-3">
                    <p className="text-sm font-medium text-gray-700">Options (select correct answer):</p>
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input type="radio" name={`edit-correct-${idx}`} checked={opt.isCorrect} onChange={() => setCorrectOption(idx, oIdx)} className="text-indigo-600" />
                        <Input value={opt.optionText} onChange={(e) => updateOption(idx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} />
                      </div>
                    ))}
                  </div>
                )}

                {(q.type === "SHORT" || q.type === "PARAGRAPH") && (
                  <Textarea label="Correct Answer (for grading reference)" value={q.correctAnswer} onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })} className="mt-3" />
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <Film className="h-4 w-4" /> Additional Resources
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Media URL (video/audio/image)" value={q.mediaUrl} onChange={(e) => updateQuestion(idx, { mediaUrl: e.target.value })} placeholder="https://youtube.com/... or file URL" />
                    <Select label="Media Type" value={q.mediaType} onChange={(e) => updateQuestion(idx, { mediaType: e.target.value })} options={[
                      { value: "", label: "None" }, { value: "video", label: "Video" }, { value: "audio", label: "Audio" },
                      { value: "image", label: "Image" }, { value: "document", label: "Document" }, { value: "link", label: "External Link" },
                    ]} />
                  </div>
                  <Textarea label="Additional Information / Instructions" value={q.additionalInfo} onChange={(e) => updateQuestion(idx, { additionalInfo: e.target.value })} placeholder="Extra context, hints, or reference material..." className="mt-3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(`/teacher/assessments/${params.id}`)}>Cancel</Button>
        <Button onClick={handleSave} isLoading={saving}><Save className="h-4 w-4 mr-1" /> Save Changes</Button>
      </div>
    </>
  );
}
