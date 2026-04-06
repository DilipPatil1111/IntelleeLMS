"use client";

import { useState, useCallback } from "react";
import { Plus, X, ChevronDown, GripVertical, CheckSquare, Circle, AlignLeft, AlignJustify } from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Types ───────────────────────────────────────────────────────────────────

export type QuizQuestionType = "MCQ" | "MULTI_SELECT" | "SHORT" | "PARAGRAPH";

export interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  text: string;
  marks: number;
  options: QuizOption[];
  correctAnswer: string;
  maxLength: number;
  additionalInfo: string;
}

interface QuizBuilderProps {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<QuizQuestionType, { label: string; icon: React.ReactNode; desc: string }> = {
  MCQ:          { label: "Multiple choice",    icon: <Circle       className="h-3.5 w-3.5" />, desc: "Single correct answer" },
  MULTI_SELECT: { label: "Multiple selection", icon: <CheckSquare  className="h-3.5 w-3.5" />, desc: "One or more correct answers" },
  SHORT:        { label: "Short answer",       icon: <AlignLeft    className="h-3.5 w-3.5" />, desc: "Single-line text response" },
  PARAGRAPH:    { label: "Paragraph",          icon: <AlignJustify className="h-3.5 w-3.5" />, desc: "Long-form text response" },
};

const QUESTION_TYPES: QuizQuestionType[] = ["MCQ", "MULTI_SELECT", "SHORT", "PARAGRAPH"];

function newQuestion(type: QuizQuestionType): QuizQuestion {
  const hasOptions = type === "MCQ" || type === "MULTI_SELECT";
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    text: "",
    marks: type === "PARAGRAPH" ? 5 : type === "SHORT" ? 3 : 2,
    options: hasOptions ? [
      { text: "Option A", isCorrect: type === "MCQ" },
      { text: "Option B", isCorrect: false },
      { text: "Option C", isCorrect: false },
    ] : [],
    correctAnswer: "",
    maxLength: type === "PARAGRAPH" ? 2000 : 500,
    additionalInfo: "",
  };
}

// ─── Single question card ─────────────────────────────────────────────────────

interface QuestionCardProps {
  q: QuizQuestion;
  index: number;
  onChange: (updated: QuizQuestion) => void;
  onRemove: () => void;
}

function QuestionCard({ q, index, onChange, onRemove }: QuestionCardProps) {
  const [showExtra, setShowExtra] = useState(false);
  const meta = TYPE_META[q.type];

  const update = (patch: Partial<QuizQuestion>) => onChange({ ...q, ...patch });

  const updateOption = (i: number, patch: Partial<QuizOption>) =>
    update({ options: q.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });

  const toggleCorrect = (i: number) => {
    if (q.type === "MCQ") {
      update({ options: q.options.map((o, idx) => ({ ...o, isCorrect: idx === i })) });
    } else {
      updateOption(i, { isCorrect: !q.options[i].isCorrect });
    }
  };

  const addOption = () =>
    update({ options: [...q.options, { text: `Option ${q.options.length + 1}`, isCorrect: false }] });

  const removeOption = (i: number) => {
    if (q.options.length <= 2) return;
    const next = q.options.filter((_, idx) => idx !== i);
    if (q.type === "MCQ" && !next.some((o) => o.isCorrect)) next[0].isCorrect = true;
    update({ options: next });
  };

  const hasOptions = q.type === "MCQ" || q.type === "MULTI_SELECT";

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-gray-400 shrink-0">Q{index + 1}</span>
        <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
          {meta.icon}
          {meta.label}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <span className="hidden sm:inline">Marks:</span>
            <input
              type="number"
              min={1}
              max={100}
              value={q.marks}
              onChange={(e) => update({ marks: Math.max(1, Number(e.target.value) || 1) })}
              className="w-12 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-indigo-400"
            />
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Delete question"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Question text */}
        <Input
          placeholder="Enter your question…"
          value={q.text}
          onChange={(e) => update({ text: e.target.value })}
          className="text-sm font-medium"
        />

        {/* MCQ / MULTI_SELECT options */}
        {hasOptions && (
          <div className="space-y-1.5 pl-1">
            <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wide mb-1">
              {q.type === "MCQ" ? "Options — select the correct answer" : "Options — check all correct answers"}
            </p>
            {q.options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${opt.isCorrect ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-transparent"}`}>
                <button
                  type="button"
                  onClick={() => toggleCorrect(i)}
                  className={`shrink-0 h-4 w-4 rounded-${q.type === "MCQ" ? "full" : "sm"} border-2 flex items-center justify-center transition-colors ${
                    opt.isCorrect
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-gray-300 hover:border-indigo-400"
                  }`}
                  title={opt.isCorrect ? "Correct answer" : "Mark as correct"}
                >
                  {opt.isCorrect && <span className="text-[8px] font-bold leading-none">✓</span>}
                </button>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOption(i, { text: e.target.value })}
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none placeholder:text-gray-300"
                  placeholder={`Option ${i + 1}`}
                />
                {q.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)}
                    className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addOption}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1 pl-1">
              <Plus className="h-3 w-3" /> Add option
            </button>
          </div>
        )}

        {/* SHORT answer */}
        {q.type === "SHORT" && (
          <div className="space-y-2">
            <div className="h-8 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 flex items-center">
              <span className="text-xs text-gray-400">Student types a short answer here</span>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-gray-400 tracking-wide mb-1">
                Model answer (used for reference / auto-grading)
              </label>
              <Input
                value={q.correctAnswer}
                onChange={(e) => update({ correctAnswer: e.target.value })}
                className="text-sm"
                placeholder="Expected correct answer…"
              />
            </div>
          </div>
        )}

        {/* PARAGRAPH answer */}
        {q.type === "PARAGRAPH" && (
          <div className="space-y-2">
            <div className="h-14 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 flex items-start pt-2">
              <span className="text-xs text-gray-400">Student types a long-form answer here</span>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-gray-400 tracking-wide mb-1">
                Model answer / rubric (optional)
              </label>
              <textarea
                value={q.correctAnswer}
                onChange={(e) => update({ correctAnswer: e.target.value })}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                placeholder="Expected answer or grading rubric…"
              />
            </div>
          </div>
        )}

        {/* Additional info / hint toggle */}
        <button
          type="button"
          onClick={() => setShowExtra((s) => !s)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showExtra ? "rotate-180" : ""}`} />
          {showExtra ? "Hide" : "Add"} hint / additional info
        </button>
        {showExtra && (
          <Input
            value={q.additionalInfo}
            onChange={(e) => update({ additionalInfo: e.target.value })}
            className="text-sm"
            placeholder="Hint or additional information shown to students after submission…"
          />
        )}
      </div>
    </div>
  );
}

// ─── Quiz total marks summary ─────────────────────────────────────────────────

function QuizSummary({ questions }: { questions: QuizQuestion[] }) {
  if (questions.length === 0) return null;
  const total = questions.reduce((s, q) => s + q.marks, 0);
  const counts = questions.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700">
      <span className="font-semibold">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
      <span className="text-indigo-400">·</span>
      <span className="font-semibold">{total} total marks</span>
      {Object.entries(counts).map(([type, count]) => (
        <span key={type} className="flex items-center gap-1 text-indigo-500">
          <span className="font-medium">{count}</span> {TYPE_META[type as QuizQuestionType]?.label}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuizBuilder({ questions, onChange }: QuizBuilderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const addQuestion = useCallback((type: QuizQuestionType) => {
    onChange([...questions, newQuestion(type)]);
    setMenuOpen(false);
  }, [questions, onChange]);

  const updateQuestion = useCallback((idx: number, updated: QuizQuestion) => {
    onChange(questions.map((q, i) => (i === idx ? updated : q)));
  }, [questions, onChange]);

  const removeQuestion = useCallback((idx: number) => {
    onChange(questions.filter((_, i) => i !== idx));
  }, [questions, onChange]);

  return (
    <div className="space-y-3">
      <QuizSummary questions={questions} />

      {questions.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="text-2xl mb-2">📝</div>
          No questions yet — add your first question below.
        </div>
      )}

      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={i}
          onChange={(updated) => updateQuestion(i, updated)}
          onRemove={() => removeQuestion(i)}
        />
      ))}

      {/* Add question button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" /> Add question
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
            {QUESTION_TYPES.map((type) => {
              const m = TYPE_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => addQuestion(type)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-400">{m.icon}</span>
                  <div className="text-left">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-gray-400">{m.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
