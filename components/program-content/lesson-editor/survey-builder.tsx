"use client";

import { useState, useCallback } from "react";
import { Plus, X, GripVertical, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

export type QuestionType = "MCQ" | "MULTI_SELECT" | "SHORT" | "PARAGRAPH" | "RATING";

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  leftLabel: string;
  rightLabel: string;
  required: boolean;
}

interface SurveyBuilderProps {
  questions: SurveyQuestion[];
  onChange: (questions: SurveyQuestion[]) => void;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ:          "Multiple choice (single answer)",
  MULTI_SELECT: "Multiple selection",
  SHORT:        "Short answer",
  PARAGRAPH:    "Paragraph (long answer)",
  RATING:       "Rating / Scale",
};

function newQuestion(type: QuestionType): SurveyQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    text: "",
    options: type === "MCQ" || type === "MULTI_SELECT" ? ["Option 1", "Option 2"] : [],
    leftLabel: "Strongly disagree",
    rightLabel: "Strongly agree",
    required: false,
  };
}

interface QuestionCardProps {
  q: SurveyQuestion;
  index: number;
  onChange: (updated: SurveyQuestion) => void;
  onRemove: () => void;
}

function QuestionCard({ q, index, onChange, onRemove }: QuestionCardProps) {
  const update = (patch: Partial<SurveyQuestion>) => onChange({ ...q, ...patch });

  const addOption = () => update({ options: [...q.options, `Option ${q.options.length + 1}`] });
  const removeOption = (i: number) => update({ options: q.options.filter((_, idx) => idx !== i) });
  const updateOption = (i: number, val: string) =>
    update({ options: q.options.map((o, idx) => (idx === i ? val : o)) });

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-gray-400">Q{index + 1}</span>
        <span className="flex-1 text-xs text-gray-500">{TYPE_LABELS[q.type]}</span>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={q.required}
            onChange={(e) => update({ required: e.target.checked })}
            className="rounded border-gray-300 text-indigo-600"
          />
          Required
        </label>
        <button type="button" onClick={onRemove}
          className="p-1 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
          title="Delete question">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Question text */}
        <Input
          placeholder="Enter your question…"
          value={q.text}
          onChange={(e) => update({ text: e.target.value })}
          className="text-sm"
        />

        {/* MCQ / Multi-select options */}
        {(q.type === "MCQ" || q.type === "MULTI_SELECT") && (
          <div className="space-y-1.5 pl-1">
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-3.5 w-3.5 shrink-0 border-2 border-gray-300 ${q.type === "MCQ" ? "rounded-full" : "rounded"}`} />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  className="flex-1 text-sm border-0 border-b border-gray-200 focus:border-indigo-400 focus:outline-none bg-transparent py-0.5 px-1"
                  placeholder={`Option ${i + 1}`}
                />
                {q.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)}
                    className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addOption}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1">
              <Plus className="h-3 w-3" /> Add option
            </button>
          </div>
        )}

        {/* Short answer preview */}
        {q.type === "SHORT" && (
          <div className="h-8 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 flex items-center">
            <span className="text-xs text-gray-400">Short answer field</span>
          </div>
        )}

        {/* Paragraph preview */}
        {q.type === "PARAGRAPH" && (
          <div className="h-16 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 flex items-start pt-2">
            <span className="text-xs text-gray-400">Paragraph answer field</span>
          </div>
        )}

        {/* Rating / Scale */}
        {q.type === "RATING" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-28 shrink-0">Left label</span>
              <Input
                value={q.leftLabel}
                onChange={(e) => update({ leftLabel: e.target.value })}
                className="text-sm"
                placeholder="e.g. Strongly disagree"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-28 shrink-0">Right label</span>
              <Input
                value={q.rightLabel}
                onChange={(e) => update({ rightLabel: e.target.value })}
                className="text-sm"
                placeholder="e.g. Strongly agree"
              />
            </div>
            <div className="flex items-center justify-between px-2 py-2 bg-gray-50 rounded-lg">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <div className="h-6 w-6 rounded-full border-2 border-gray-200 bg-white" />
                  <span className="text-[10px] text-gray-400">{n}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 px-1">
              <span>{q.leftLabel || "Left label"}</span>
              <span>{q.rightLabel || "Right label"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const QUESTION_TYPES: { type: QuestionType; label: string }[] = [
  { type: "MCQ",          label: "Multiple choice (single answer)" },
  { type: "MULTI_SELECT", label: "Multiple selection" },
  { type: "SHORT",        label: "Short answer" },
  { type: "PARAGRAPH",    label: "Paragraph (long answer)" },
  { type: "RATING",       label: "Rating / Scale" },
];

export function SurveyBuilder({ questions, onChange }: SurveyBuilderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const addQuestion = useCallback((type: QuestionType) => {
    onChange([...questions, newQuestion(type)]);
    setMenuOpen(false);
  }, [questions, onChange]);

  const updateQuestion = useCallback((idx: number, updated: SurveyQuestion) => {
    onChange(questions.map((q, i) => (i === idx ? updated : q)));
  }, [questions, onChange]);

  const removeQuestion = useCallback((idx: number) => {
    onChange(questions.filter((_, i) => i !== idx));
  }, [questions, onChange]);

  return (
    <div className="space-y-3">
      {questions.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
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

      {/* Add question menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" /> Add question
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
            {QUESTION_TYPES.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => addQuestion(type)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
