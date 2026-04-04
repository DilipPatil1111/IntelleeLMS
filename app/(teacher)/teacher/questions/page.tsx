"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";

type QuestionType = "MCQ" | "SHORT" | "PARAGRAPH";

interface QuestionOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
  orderIndex: number;
}

interface QuestionRow {
  id: string;
  questionText: string;
  type: QuestionType;
  marks: number;
  correctAnswer: string | null;
  options: QuestionOption[];
  assessment: {
    title: string;
    subject: { name: string } | null;
  };
}

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "MCQ", label: "MCQ" },
  { value: "SHORT", label: "Short answer" },
  { value: "PARAGRAPH", label: "Paragraph" },
];

const EDIT_TYPE_OPTIONS = [
  { value: "MCQ", label: "MCQ" },
  { value: "SHORT", label: "Short answer" },
  { value: "PARAGRAPH", label: "Paragraph" },
];

const PAGE_SIZE = 10;

function defaultMcqOptions() {
  return [
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ];
}

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [form, setForm] = useState({
    questionText: "",
    type: "MCQ" as QuestionType,
    marks: 1,
    correctAnswer: "",
    options: defaultMcqOptions(),
  });

  const filterKey = useMemo(
    () => `${debouncedQ}|${subjectFilter}|${typeFilter}`,
    [debouncedQ, subjectFilter, typeFilter]
  );
  const prevFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchQuestions = useCallback(async (p: number) => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (subjectFilter) params.set("subject", subjectFilter);
    if (typeFilter) params.set("type", typeFilter);
    params.set("page", String(p));
    params.set("pageSize", String(PAGE_SIZE));
    const res = await fetch(`/api/teacher/questions?${params.toString()}`);
    const data = await res.json();
    setQuestions(data.questions || []);
    setListTotal(typeof data.total === "number" ? data.total : 0);
    if (Array.isArray(data.subjects)) {
      setSubjectNames(data.subjects);
    }
  }, [debouncedQ, subjectFilter, typeFilter]);

  useEffect(() => {
    const filtersChanged = prevFilterKeyRef.current !== filterKey;
    if (filtersChanged && page !== 1) {
      prevFilterKeyRef.current = filterKey;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(1);
      return;
    }
    if (filtersChanged) {
      prevFilterKeyRef.current = filterKey;
    }
    const pageToUse = filtersChanged ? 1 : page;
     
    void fetchQuestions(pageToUse);
  }, [filterKey, page, fetchQuestions]);

  const subjectOptions = useMemo(
    () => [{ value: "", label: "All subjects" }, ...subjectNames.map((n) => ({ value: n, label: n }))],
    [subjectNames]
  );

  function openEdit(q: QuestionRow) {
    setEditing(q);
    const sorted = [...q.options].sort((a, b) => a.orderIndex - b.orderIndex);
    setForm({
      questionText: q.questionText,
      type: q.type,
      marks: q.marks,
      correctAnswer: q.correctAnswer || "",
      options:
        q.type === "MCQ" && sorted.length > 0
          ? sorted.map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect }))
          : defaultMcqOptions(),
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!editing) return;
    const payload: Record<string, unknown> = {
      questionText: form.questionText,
      type: form.type,
      marks: form.marks,
      correctAnswer: form.correctAnswer || null,
    };
    if (form.type === "MCQ") {
      payload.options = form.options.filter((o) => o.optionText.trim() !== "");
    }
    await fetch(`/api/teacher/questions/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowModal(false);
    setEditing(null);
    await fetchQuestions(page);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    await fetch(`/api/teacher/questions/${id}`, { method: "DELETE" });
    await fetchQuestions(page);
  }

  function setOption(i: number, patch: Partial<(typeof form.options)[0]>) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    }));
  }

  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Question Bank"
        description="Browse and edit questions across your assessments"
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          label="Search"
          placeholder="Question or assessment title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:flex-1"
        />
        <Select
          label="Subject"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          options={subjectOptions}
        />
        <Select
          label="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={TYPE_OPTIONS}
        />
      </div>

      {listTotal === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-gray-500">
              {debouncedQ === "" && !subjectFilter && !typeFilter
                ? "No questions created yet."
                : "No questions match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-500">
            {listTotal} question{listTotal === 1 ? "" : "s"} match · {PAGE_SIZE} per page
          </p>
          <div className="space-y-3">
            {questions.map((q) => (
              <Card key={q.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="info">{q.type}</Badge>
                        <Badge>{q.marks} marks</Badge>
                        <span className="text-xs text-gray-400">
                          {q.assessment.subject?.name} — {q.assessment.title}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{q.questionText}</p>
                      {q.type === "MCQ" && q.options.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[...q.options]
                            .sort((a, b) => a.orderIndex - b.orderIndex)
                            .map((o) => (
                              <span
                                key={o.id}
                                className={`rounded px-2 py-0.5 text-xs ${
                                  o.isCorrect ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {o.optionText}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(q)}
                        className="p-1 text-gray-400 hover:text-indigo-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
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
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Edit question" className="max-w-2xl">
        <div className="space-y-4">
          <Textarea
            label="Question"
            value={form.questionText}
            onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as QuestionType,
                options: e.target.value === "MCQ" && f.options.length === 0 ? defaultMcqOptions() : f.options,
              }))
            }
            options={EDIT_TYPE_OPTIONS}
          />
          <Input
            label="Marks"
            type="number"
            step="0.5"
            value={form.marks}
            onChange={(e) => setForm({ ...form, marks: parseFloat(e.target.value) || 0 })}
          />
          {form.type !== "MCQ" && (
            <Textarea
              label="Correct answer (reference)"
              value={form.correctAnswer}
              onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
            />
          )}
          {form.type === "MCQ" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Options</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      options: [...f.options, { optionText: "", isCorrect: false }],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3 w-3" /> Add option
                </Button>
              </div>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    value={opt.optionText}
                    onChange={(e) => setOption(i, { optionText: e.target.value })}
                    className="flex-1"
                  />
                  <label className="flex items-center gap-1 whitespace-nowrap pt-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={opt.isCorrect}
                      onChange={(e) => setOption(i, { isCorrect: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    Correct
                  </label>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
