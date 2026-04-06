"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Play,
  FileText,
  Music,
  Download,
  Globe,
  Presentation,
  HelpCircle,
  ClipboardList,
  BookOpen,
  ArrowRight,
  Menu,
  X,
  Lock,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type LessonKind =
  | "TEXT"
  | "VIDEO"
  | "PDF"
  | "AUDIO"
  | "PRESENTATION"
  | "QUIZ"
  | "DOWNLOAD"
  | "SURVEY"
  | "MULTIMEDIA";

interface LessonData {
  id: string;
  title: string;
  kind: LessonKind;
  isDraft: boolean;
  assessmentId: string | null;
  content: Record<string, unknown> | null;
  isCompleted: boolean;
}

interface ChapterData {
  id: string;
  title: string;
  isMandatory: boolean;
  lessons: LessonData[];
}

interface SubjectData {
  id: string;
  name: string;
  code: string;
  programChapters: ChapterData[];
}

interface ProgramData {
  name: string;
  programSyllabus: {
    instructions: string | null;
    programHours: string | null;
    feesNote: string | null;
  } | null;
  subjects: SubjectData[];
}

// ─────────────────────────────────────────────
// Icon helpers
// ─────────────────────────────────────────────
function LessonIcon({ kind, className = "h-4 w-4" }: { kind: LessonKind; className?: string }) {
  const map: Record<LessonKind, React.ReactNode> = {
    TEXT: <FileText className={className} />,
    VIDEO: <Play className={className} />,
    PDF: <FileText className={className} />,
    AUDIO: <Music className={className} />,
    PRESENTATION: <Presentation className={className} />,
    QUIZ: <HelpCircle className={className} />,
    DOWNLOAD: <Download className={className} />,
    SURVEY: <ClipboardList className={className} />,
    MULTIMEDIA: <Globe className={className} />,
  };
  return <>{map[kind]}</>;
}

// ─────────────────────────────────────────────
// Survey renderer
// ─────────────────────────────────────────────
interface SurveyQuestion {
  id: string;
  type: "MCQ" | "MULTI_SELECT" | "SHORT" | "PARAGRAPH" | "RATING";
  question: string;
  options?: { id: string; text: string }[];
  leftLabel?: string;
  rightLabel?: string;
}

function SurveyViewer({
  lessonId,
  questions,
  onComplete,
}: {
  lessonId: string;
  questions: SurveyQuestion[];
  onComplete: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await fetch(`/api/student/program-content/lessons/${lessonId}/complete`, { method: "POST" });
      setSubmitted(true);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-semibold text-gray-800">Survey submitted!</p>
        <p className="text-sm text-gray-500">Thank you for your response.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 font-medium text-gray-800">
            {i + 1}. {q.question}
          </p>
          {q.type === "MCQ" && q.options && (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={opt.id}
                    checked={answers[q.id] === opt.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{opt.text}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "MULTI_SELECT" && q.options && (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt.id}
                    checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt.id)}
                    onChange={(e) => {
                      const prev = (answers[q.id] as string[]) || [];
                      setAnswers((a) => ({
                        ...a,
                        [q.id]: e.target.checked
                          ? [...prev, opt.id]
                          : prev.filter((x) => x !== opt.id),
                      }));
                    }}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{opt.text}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "SHORT" && (
            <input
              type="text"
              value={(answers[q.id] as string) || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder="Your answer…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          )}
          {q.type === "PARAGRAPH" && (
            <textarea
              value={(answers[q.id] as string) || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder="Your answer…"
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          )}
          {q.type === "RATING" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: String(n) }))}
                    className={`h-9 w-9 rounded-full border-2 text-sm font-medium transition-colors ${
                      answers[q.id] === String(n)
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 text-gray-600 hover:border-indigo-400"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {(q.leftLabel || q.rightLabel) && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{q.leftLabel}</span>
                  <span>{q.rightLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Survey"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Content viewer
// ─────────────────────────────────────────────
function LessonContentPanel({
  lesson,
  onComplete,
  onNext,
  hasNext,
}: {
  lesson: LessonData;
  onComplete: (id: string) => Promise<void>;
  onNext: () => void;
  hasNext: boolean;
}) {
  const [completing, setCompleting] = useState(false);
  const content = lesson.content as Record<string, unknown> | null;

  const getStringVal = (key: string) =>
    typeof content?.[key] === "string" ? (content[key] as string) : null;

  const getFiles = (key: string): string[] => {
    const val = content?.[key];
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
    if (typeof val === "string" && val) return [val];
    return [];
  };

  async function handleComplete() {
    setCompleting(true);
    await onComplete(lesson.id);
    setCompleting(false);
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <LessonIcon kind={lesson.kind} />
          <span className="capitalize">{lesson.kind.toLowerCase()}</span>
          {lesson.isCompleted && (
            <span className="ml-2 flex items-center gap-1 text-green-600 text-xs font-medium">
              <CheckCircle className="h-3.5 w-3.5" /> Completed
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-900">{lesson.title}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 space-y-6">
        {/* TEXT */}
        {lesson.kind === "TEXT" && (
          <div
            className="prose prose-gray max-w-none text-gray-800"
            dangerouslySetInnerHTML={{ __html: getStringVal("html") || "<p>No content.</p>" }}
          />
        )}

        {/* VIDEO */}
        {lesson.kind === "VIDEO" && (
          <>
            {getFiles("videoUrls").length > 0 ? (
              <div className="space-y-4">
                {getFiles("videoUrls").map((url, i) => (
                  <video
                    key={i}
                    controls
                    className="w-full rounded-xl bg-black shadow-lg max-h-[500px]"
                    src={url}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 rounded-xl bg-gray-100 text-gray-400">
                <Play className="h-12 w-12 opacity-40" />
              </div>
            )}
            {getStringVal("notes") && (
              <div
                className="prose prose-gray max-w-none border-t pt-4 text-gray-700"
                dangerouslySetInnerHTML={{ __html: getStringVal("notes")! }}
              />
            )}
          </>
        )}

        {/* AUDIO */}
        {lesson.kind === "AUDIO" && (
          <>
            {getStringVal("body") && (
              <div
                className="prose prose-gray max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: getStringVal("body")! }}
              />
            )}
            {getFiles("audioUrls").length > 0 ? (
              <div className="space-y-3">
                {getFiles("audioUrls").map((url, i) => (
                  <audio key={i} controls className="w-full rounded-lg" src={url} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 rounded-xl bg-gray-100 text-gray-400">
                <Music className="h-10 w-10 opacity-40" />
              </div>
            )}
          </>
        )}

        {/* PDF */}
        {lesson.kind === "PDF" && (
          <div className="space-y-4">
            {getFiles("pdfUrls").length > 0 ? (
              getFiles("pdfUrls").map((url, i) => (
                <div key={i} className="space-y-2">
                  <iframe
                    src={url}
                    title={`PDF ${i + 1}`}
                    className="w-full rounded-xl border border-gray-200 shadow-sm"
                    style={{ height: "600px" }}
                  />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Open in new tab
                  </a>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-64 rounded-xl bg-gray-100 text-gray-400">
                <FileText className="h-12 w-12 opacity-40" />
              </div>
            )}
          </div>
        )}

        {/* PRESENTATION */}
        {lesson.kind === "PRESENTATION" && (
          <div className="space-y-4">
            {getFiles("pptUrls").length > 0 ? (
              getFiles("pptUrls").map((url, i) => {
                const isGoogleSlideable = url.endsWith(".pdf");
                return (
                  <div key={i} className="space-y-2">
                    {isGoogleSlideable ? (
                      <iframe
                        src={url}
                        title={`Slide ${i + 1}`}
                        className="w-full rounded-xl border border-gray-200 shadow-sm"
                        style={{ height: "540px" }}
                      />
                    ) : (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                        <Presentation className="h-8 w-8 text-indigo-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-3">Presentation file</p>
                        <a
                          href={url}
                          download
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" /> Download Presentation
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-64 rounded-xl bg-gray-100 text-gray-400">
                <Presentation className="h-12 w-12 opacity-40" />
              </div>
            )}
          </div>
        )}

        {/* DOWNLOAD */}
        {lesson.kind === "DOWNLOAD" && (
          <div className="space-y-3">
            {getFiles("downloadUrls").length > 0 ? (
              getFiles("downloadUrls").map((url, i) => {
                const filename = url.split("/").pop() || `File ${i + 1}`;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                        <Download className="h-5 w-5 text-indigo-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-800 truncate max-w-xs">{filename}</span>
                    </div>
                    <a
                      href={url}
                      download
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                    >
                      Download
                    </a>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-32 rounded-xl bg-gray-100 text-gray-400">
                <Download className="h-10 w-10 opacity-40" />
              </div>
            )}
          </div>
        )}

        {/* MULTIMEDIA */}
        {lesson.kind === "MULTIMEDIA" && (
          <div className="space-y-4">
            {getStringVal("externalUrl") ? (
              <div className="space-y-2">
                <iframe
                  src={getStringVal("externalUrl")!}
                  title="Multimedia content"
                  className="w-full rounded-xl border border-gray-200 shadow-sm"
                  style={{ height: "540px" }}
                  allowFullScreen
                />
                <a
                  href={getStringVal("externalUrl")!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" /> Open in new tab
                </a>
              </div>
            ) : getFiles("multimediaUrls").length > 0 ? (
              getFiles("multimediaUrls").map((url, i) => {
                const filename = url.split("/").pop() || `File ${i + 1}`;
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <span className="text-sm text-gray-700">{filename}</span>
                    <a href={url} download className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 transition-colors">
                      Download
                    </a>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-32 rounded-xl bg-gray-100 text-gray-400">
                <Globe className="h-10 w-10 opacity-40" />
              </div>
            )}
          </div>
        )}

        {/* QUIZ */}
        {lesson.kind === "QUIZ" && (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50">
              <HelpCircle className="h-10 w-10 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Quiz: {lesson.title}</h3>
              {lesson.isCompleted ? (
                <p className="text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                  <CheckCircle className="h-4 w-4" /> You have completed this quiz.
                </p>
              ) : (
                <p className="text-sm text-gray-500">Complete this quiz to mark it as done.</p>
              )}
            </div>
            {lesson.assessmentId && (
              <Link
                href={`/student/assessments/${lesson.assessmentId}/take`}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-md"
              >
                {lesson.isCompleted ? "Retake Quiz" : "Take Quiz"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}

        {/* SURVEY */}
        {lesson.kind === "SURVEY" && (() => {
          const questions = Array.isArray(content?.questions) ? (content!.questions as SurveyQuestion[]) : [];
          return (
            <SurveyViewer
              lessonId={lesson.id}
              questions={questions}
              onComplete={() => {}}
            />
          );
        })()}
      </div>

      {/* Footer: Complete & Continue */}
      {lesson.kind !== "QUIZ" && lesson.kind !== "SURVEY" && (
        <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            {lesson.isCompleted && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Completed
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!lesson.isCompleted && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {completing ? "Saving…" : "Mark Complete"}
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={onNext}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────
function CourseSidebar({
  program,
  activeLesson,
  onSelectLesson,
  completedCount,
  totalCount,
}: {
  program: ProgramData;
  activeLesson: LessonData | null;
  onSelectLesson: (l: LessonData) => void;
  completedCount: number;
  totalCount: number;
}) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    const set = new Set<string>();
    program.subjects.forEach((s) =>
      s.programChapters.forEach((ch) => {
        if (ch.lessons.length > 0) set.add(ch.id);
      })
    );
    return set;
  });

  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Program header */}
      <div className="p-4 border-b border-gray-700 bg-gray-900">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-indigo-400 flex-shrink-0" />
          <h2 className="text-sm font-bold text-white leading-tight line-clamp-2">{program.name}</h2>
        </div>
        {totalCount > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{completedCount}/{totalCount} lessons</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lesson list */}
      <div className="flex-1 overflow-y-auto">
        {program.subjects.map((sub) => (
          <div key={sub.id}>
            <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                {sub.code}
              </p>
              <p className="text-xs font-semibold text-gray-200 leading-tight">{sub.name}</p>
            </div>
            {sub.programChapters.map((ch) => (
              <div key={ch.id}>
                <button
                  type="button"
                  onClick={() => toggleChapter(ch.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800/60 border-b border-gray-700/50 text-left hover:bg-gray-800 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-300 leading-tight pr-2">{ch.title}</span>
                  {expandedChapters.has(ch.id) ? (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {expandedChapters.has(ch.id) &&
                  ch.lessons.map((les) => {
                    const isActive = activeLesson?.id === les.id;
                    return (
                      <button
                        key={les.id}
                        type="button"
                        onClick={() => onSelectLesson(les)}
                        className={`w-full flex items-start gap-2.5 px-4 py-2.5 border-b border-gray-700/30 text-left transition-colors ${
                          isActive
                            ? "bg-indigo-600 text-white"
                            : "text-gray-300 hover:bg-gray-700/60"
                        }`}
                      >
                        {les.isCompleted ? (
                          <CheckCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isActive ? "text-white" : "text-green-400"}`} />
                        ) : (
                          <Circle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isActive ? "text-white/70" : "text-gray-600"}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium leading-snug ${isActive ? "text-white" : ""}`}>
                            {les.title}
                          </p>
                          <p className={`text-[10px] mt-0.5 capitalize ${isActive ? "text-indigo-200" : "text-gray-500"}`}>
                            {les.kind.toLowerCase()}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function StudentProgramContentPage() {
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [published, setPublished] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<LessonData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allLessons = program
    ? program.subjects.flatMap((s) => s.programChapters.flatMap((ch) => ch.lessons))
    : [];
  const completedCount = allLessons.filter((l) => l.isCompleted).length;
  const totalCount = allLessons.length;

  const loadData = useCallback(async () => {
    try {
      const data = await fetch("/api/student/program-content").then((r) => r.json());
      if (data.message && !data.program) setMessage(data.message);
      if (data.syllabusPublished === false) setPublished(false);
      if (data.program) {
        setProgram(data.program);
        // Auto-select first available lesson
        const first = data.program.subjects
          .flatMap((s: SubjectData) => s.programChapters)
          .flatMap((ch: ChapterData) => ch.lessons)
          .find((l: LessonData) => !l.isCompleted) ??
          data.program.subjects
            .flatMap((s: SubjectData) => s.programChapters)
            .flatMap((ch: ChapterData) => ch.lessons)[0];
        if (first) setActiveLesson(first);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleComplete(lessonId: string) {
    await fetch(`/api/student/program-content/lessons/${lessonId}/complete`, { method: "POST" });
    // Refresh data to update completion status
    const data = await fetch("/api/student/program-content").then((r) => r.json());
    if (data.program) {
      setProgram(data.program);
      // Keep active lesson updated
      const updatedLesson = data.program.subjects
        .flatMap((s: SubjectData) => s.programChapters)
        .flatMap((ch: ChapterData) => ch.lessons)
        .find((l: LessonData) => l.id === lessonId);
      if (updatedLesson) setActiveLesson(updatedLesson);
    }
  }

  function handleNext() {
    if (!activeLesson) return;
    const idx = allLessons.findIndex((l) => l.id === activeLesson.id);
    if (idx >= 0 && idx < allLessons.length - 1) {
      setActiveLesson(allLessons[idx + 1]);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500" />
          <p className="text-sm">Loading program…</p>
        </div>
      </div>
    );
  }

  // ── Not published / no program ──
  if (!published || !program) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Program not available</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">{message || "Program content is not available yet."}</p>
        </div>
      </div>
    );
  }

  // ── Full viewer ──
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Lessons
        </button>
        <span className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
          {activeLesson?.title ?? program.name}
        </span>
        <span className="text-xs text-gray-400">{completedCount}/{totalCount}</span>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop always visible, mobile overlay */}
        <aside
          className={`
            w-72 bg-gray-900 flex-shrink-0 flex flex-col overflow-hidden
            lg:flex
            ${sidebarOpen ? "flex absolute inset-y-0 left-0 z-40" : "hidden"}
          `}
        >
          <CourseSidebar
            program={program}
            activeLesson={activeLesson}
            onSelectLesson={(l) => {
              setActiveLesson(l);
              setSidebarOpen(false);
            }}
            completedCount={completedCount}
            totalCount={totalCount}
          />
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Content panel */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {activeLesson ? (
            <LessonContentPanel
              lesson={activeLesson}
              onComplete={handleComplete}
              onNext={handleNext}
              hasNext={allLessons.findIndex((l) => l.id === activeLesson.id) < allLessons.length - 1}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <BookOpen className="h-12 w-12 text-indigo-300" />
              <div>
                <h2 className="text-xl font-bold text-gray-800">{program.name}</h2>
                {program.programSyllabus?.instructions && (
                  <p className="mt-2 text-sm text-gray-500 max-w-md">{program.programSyllabus.instructions}</p>
                )}
                {totalCount > 0 && (
                  <p className="mt-4 text-sm text-gray-400">
                    {totalCount} lesson{totalCount !== 1 ? "s" : ""} available. Select one from the sidebar.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
