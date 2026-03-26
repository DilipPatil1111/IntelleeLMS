"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, Sparkles, Film, FileUp } from "lucide-react";

interface QuestionForm {
  type: "MCQ" | "SHORT" | "PARAGRAPH";
  questionText: string;
  marks: number;
  correctAnswer: string;
  options: { optionText: string; isCorrect: boolean }[];
  maxLength: number | null;
  mediaUrl: string;
  mediaType: string;
  additionalInfo: string;
}

export default function CreateAssessmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<{ value: string; label: string }[]>([]);
  const [batches, setBatches] = useState<{ value: string; label: string }[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "QUIZ",
    subjectId: "",
    batchId: "",
    moduleId: "",
    topicId: "",
    isMandatory: false,
    totalMarks: 0,
    passingMarks: 0,
    duration: 0,
    scheduledOpenAt: "",
    scheduledCloseAt: "",
    assessmentDate: "",
    instructions: "",
  });

  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [modules, setModules] = useState<{ value: string; label: string }[]>([]);
  const [topicsList, setTopicsList] = useState<{ value: string; label: string }[]>([]);

  // AI Generate dialog state
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiTypes, setAiTypes] = useState<string[]>(["MCQ"]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [importingFile, setImportingFile] = useState(false);

  useEffect(() => {
    if (form.subjectId) {
      fetch(`/api/teacher/modules?subjectId=${form.subjectId}`)
        .then((r) => r.json())
        .then((data) => {
          setModules((data.modules || []).map((m: { id: string; name: string }) => ({ value: m.id, label: m.name })));
          setForm((f) => ({ ...f, moduleId: "", topicId: "" }));
          setTopicsList([]);
        });
    }
  }, [form.subjectId]);

  useEffect(() => {
    if (form.moduleId) {
      fetch(`/api/teacher/modules/${form.moduleId}`)
        .then((r) => r.json())
        .then((data) => {
          const topics = data.module?.topics || [];
          setTopicsList(topics.map((t: { id: string; name: string }) => ({ value: t.id, label: t.name })));
          setForm((f) => ({ ...f, topicId: "" }));
        });
    }
  }, [form.moduleId]);

  useEffect(() => {
    fetch("/api/teacher/options")
      .then((r) => r.json())
      .then((data) => {
        setSubjects(data.subjects || []);
        setBatches(data.batches || []);
      });
  }, []);

  function addQuestion(type: "MCQ" | "SHORT" | "PARAGRAPH") {
    setQuestions([
      ...questions,
      {
        type,
        questionText: "",
        marks: type === "MCQ" ? 2 : type === "SHORT" ? 3 : 7,
        correctAnswer: "",
        options:
          type === "MCQ"
            ? [
                { optionText: "", isCorrect: false },
                { optionText: "", isCorrect: false },
                { optionText: "", isCorrect: false },
                { optionText: "", isCorrect: false },
              ]
            : [],
        maxLength: type === "SHORT" ? 500 : type === "PARAGRAPH" ? 2000 : null,
        mediaUrl: "",
        mediaType: "",
        additionalInfo: "",
      },
    ]);
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
    updated[qIdx].options = updated[qIdx].options.map((o, i) => ({
      ...o,
      isCorrect: i === oIdx,
    }));
    setQuestions(updated);
  }

  function toggleAiType(type: string) {
    setAiTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleGenerateAI() {
    if (!form.subjectId) {
      setError("Select a subject first (Step 1)");
      return;
    }
    if (!aiTopic.trim()) {
      setError("Please enter a topic for AI to generate questions about");
      return;
    }

    setAiGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: form.subjectId,
          type: form.type,
          count: aiCount,
          topic: aiTopic,
          questionTypes: aiTypes,
        }),
      });
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions([...questions, ...data.questions]);
        setShowAIDialog(false);
        setAiTopic("");
      } else {
        setError("AI did not return any questions. Try a different topic.");
      }
    } catch {
      setError("AI generation failed. Please try again.");
    }
    setAiGenerating(false);
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingFile(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/teacher/import-questions/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.questions?.length > 0) {
        const imported = data.questions.map((q: Partial<QuestionForm>) => ({
          ...q,
          mediaUrl: q.mediaUrl || "",
          mediaType: q.mediaType || "",
          additionalInfo: q.additionalInfo || "",
        }));
        setQuestions([...questions, ...imported]);
      }
    } catch {
      setError("Failed to import file");
    }

    setImportingFile(false);
    e.target.value = "";
  }

  async function handleSubmit(publish: boolean) {
    setLoading(true);
    setError("");

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    try {
      const res = await fetch("/api/teacher/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          totalMarks,
          status: publish ? "PUBLISHED" : "DRAFT",
          questions,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        router.push(`/teacher/assessments/${data.id}`);
      }
    } catch {
      setError("Failed to create assessment");
    }
    setLoading(false);
  }

  return (
    <>
      <PageHeader
        title="Create Assessment"
        description="Build a quiz, test, or assignment for your students"
      />

      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex items-center gap-2 ${s <= step ? "text-indigo-600" : "text-gray-400"}`}
          >
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-indigo-600 text-white"
                  : s < step
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gray-100"
              }`}
            >
              {s}
            </div>
            <span className="text-sm font-medium hidden sm:inline">
              {s === 1 ? "Details" : s === 2 ? "Questions" : "Review"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardContent>
            <div className="space-y-4">
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Midterm Quiz - Chapter 3" required />
              <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Module (optional)" value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })} options={[{ value: "", label: "None" }, ...modules]} placeholder="Link to module" />
                <Select label="Topic (optional)" value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} options={[{ value: "", label: "None" }, ...topicsList]} placeholder="Link to topic" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })} className="rounded text-indigo-600" />
                Mandatory assessment (students must complete before accessing next module)
              </label>
              <Textarea label="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Special instructions for students..." />
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!form.title || !form.subjectId || !form.batchId}>
                  Next: Add Questions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => addQuestion("MCQ")}>
              <Plus className="h-4 w-4 mr-1" /> MCQ
            </Button>
            <Button variant="outline" size="sm" onClick={() => addQuestion("SHORT")}>
              <Plus className="h-4 w-4 mr-1" /> Short Answer
            </Button>
            <Button variant="outline" size="sm" onClick={() => addQuestion("PARAGRAPH")}>
              <Plus className="h-4 w-4 mr-1" /> Paragraph
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!form.subjectId) {
                  setError("Go back to Step 1 and select a subject first");
                  return;
                }
                setShowAIDialog(true);
                setError("");
              }}
            >
              <Sparkles className="h-4 w-4 mr-1" /> AI Generate
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" isLoading={importingFile} onClick={() => document.getElementById("file-import")?.click()}>
                <FileUp className="h-4 w-4 mr-1" /> Import File
              </Button>
              <input
                id="file-import"
                type="file"
                accept=".csv,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileImport}
                disabled={importingFile}
              />
            </div>
          </div>

          {questions.length === 0 && (
            <Card className="mb-4">
              <CardContent>
                <div className="text-center py-8">
                  <Sparkles className="h-10 w-10 text-indigo-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No questions added yet.</p>
                  <p className="text-sm text-gray-400">
                    Add questions manually using the buttons above, or click <strong>AI Generate</strong> to create questions automatically.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <Card key={idx}>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="info">Q{idx + 1}</Badge>
                      <Badge>{q.type}</Badge>
                    </div>
                    <button onClick={() => removeQuestion(idx)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    value={q.questionText}
                    onChange={(e) => updateQuestion(idx, { questionText: e.target.value })}
                    placeholder="Enter question text..."
                    className="mb-3"
                  />
                  <Input
                    label="Marks"
                    type="number"
                    value={q.marks}
                    onChange={(e) => updateQuestion(idx, { marks: parseFloat(e.target.value) || 0 })}
                    className="mb-3 max-w-[120px]"
                  />

                  {q.type === "MCQ" && (
                    <div className="space-y-2 mt-3">
                      <p className="text-sm font-medium text-gray-700">Options (select correct answer):</p>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${idx}`}
                            checked={opt.isCorrect}
                            onChange={() => setCorrectOption(idx, oIdx)}
                            className="text-indigo-600"
                          />
                          <Input
                            value={opt.optionText}
                            onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                            placeholder={`Option ${oIdx + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {(q.type === "SHORT" || q.type === "PARAGRAPH") && (
                    <div className="mt-3">
                      <Textarea
                        label="Correct Answer (for grading reference)"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                        placeholder="Enter the correct/expected answer..."
                      />
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Film className="h-4 w-4" /> Additional Resources
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Media URL (video/audio/image)"
                        value={q.mediaUrl}
                        onChange={(e) => updateQuestion(idx, { mediaUrl: e.target.value })}
                        placeholder="https://youtube.com/... or file URL"
                      />
                      <Select
                        label="Media Type"
                        value={q.mediaType}
                        onChange={(e) => updateQuestion(idx, { mediaType: e.target.value })}
                        options={[
                          { value: "", label: "None" },
                          { value: "video", label: "Video" },
                          { value: "audio", label: "Audio" },
                          { value: "image", label: "Image" },
                          { value: "document", label: "Document" },
                          { value: "link", label: "External Link" },
                        ]}
                      />
                    </div>
                    <Textarea
                      label="Additional Information / Instructions"
                      value={q.additionalInfo}
                      onChange={(e) => updateQuestion(idx, { additionalInfo: e.target.value })}
                      placeholder="Extra context, hints, or reference material for this question..."
                      className="mt-3"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={questions.length === 0}>Next: Review</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Review Assessment</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><p className="text-xs text-gray-500">Title</p><p className="font-medium">{form.title}</p></div>
              <div><p className="text-xs text-gray-500">Type</p><p className="font-medium">{form.type}</p></div>
              <div><p className="text-xs text-gray-500">Questions</p><p className="font-medium">{questions.length}</p></div>
              <div><p className="text-xs text-gray-500">Total Marks</p><p className="font-medium">{questions.reduce((s, q) => s + q.marks, 0)}</p></div>
              <div><p className="text-xs text-gray-500">Passing Marks</p><p className="font-medium">{form.passingMarks || "Not set"}</p></div>
              <div><p className="text-xs text-gray-500">Duration</p><p className="font-medium">{form.duration ? `${form.duration} min` : "Unlimited"}</p></div>
            </div>

            <div className="mb-6 space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Questions Preview</h4>
              {questions.map((q, idx) => (
                <div key={idx} className="p-2 rounded bg-gray-50 text-sm">
                  <span className="font-medium text-indigo-600">Q{idx + 1} ({q.type}, {q.marks}m)</span>: {q.questionText.slice(0, 100)}{q.questionText.length > 100 ? "..." : ""}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button variant="secondary" onClick={() => handleSubmit(false)} isLoading={loading}>
                Save as Draft
              </Button>
              <Button onClick={() => handleSubmit(true)} isLoading={loading}>
                Publish Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Generate Dialog */}
      <Modal isOpen={showAIDialog} onClose={() => setShowAIDialog(false)} title="AI Generate Questions" className="max-w-lg">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Tell the AI what topic to create questions about. It will generate questions with correct answers automatically.
            </p>
          </div>

          <Input
            label="Topic / Focus Area"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="e.g. SQL Joins, CSS Flexbox, Photosynthesis..."
          />

          <Input
            label="Number of Questions"
            type="number"
            min={1}
            max={20}
            value={aiCount}
            onChange={(e) => setAiCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 5)))}
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Question Types to Generate</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "MCQ", label: "Multiple Choice" },
                { value: "SHORT", label: "Short Answer" },
                { value: "PARAGRAPH", label: "Paragraph" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggleAiType(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    aiTypes.includes(t.value)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {aiTypes.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Select at least one question type</p>
            )}
          </div>

          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
            <p className="text-xs text-indigo-700">
              <strong>Subject:</strong> {subjects.find((s) => s.value === form.subjectId)?.label || "Not selected"}<br />
              <strong>Will generate:</strong> {aiCount} questions about &quot;{aiTopic || "..."}&quot; ({aiTypes.join(", ") || "none selected"})
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAIDialog(false)}>Cancel</Button>
            <Button
              onClick={handleGenerateAI}
              isLoading={aiGenerating}
              disabled={!aiTopic.trim() || aiTypes.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-1" /> Generate Questions
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
