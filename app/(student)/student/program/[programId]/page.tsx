"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import {
  BookOpen,
  Eye,
  FolderOpen,
  Layers,
  ChevronRight,
  ChevronDown,
  FileText,
  Video,
  FileAudio,
  Presentation,
  Download,
  BarChart2,
  Globe,
  ClipboardList,
  AlertCircle,
  CheckCircle,
  Circle,
  Lock,
  Play,
  Music,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  isPrerequisite: boolean;
  freePreviewLesson: boolean;
  enableDiscussions: boolean;
  lessons: LessonData[];
}

interface SubjectData {
  id: string;
  name: string;
  code: string;
  programChapters: ChapterData[];
}

interface SessionRecording {
  id: string;
  title: string;
  sessionDate: string;
  videoUrl: string;
  fileName: string | null;
  durationMin: number | null;
  uploadedBy: { firstName: string; lastName: string };
}

interface Syllabus {
  instructions: string | null;
  programHours: string | null;
  feesNote: string | null;
  isPublished: boolean;
}

interface ProgramData {
  name: string;
  code: string;
  programSyllabus: Syllabus | null;
  subjects: SubjectData[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LESSON_ICONS: Record<LessonKind, React.ReactNode> = {
  TEXT: <FileText className="h-4 w-4" />,
  VIDEO: <Video className="h-4 w-4" />,
  PDF: <FileText className="h-4 w-4" />,
  AUDIO: <FileAudio className="h-4 w-4" />,
  PRESENTATION: <Presentation className="h-4 w-4" />,
  QUIZ: <ClipboardList className="h-4 w-4" />,
  DOWNLOAD: <Download className="h-4 w-4" />,
  SURVEY: <BarChart2 className="h-4 w-4" />,
  MULTIMEDIA: <Globe className="h-4 w-4" />,
};

// ─── Survey types + component ─────────────────────────────────────────────────

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
    await fetch(`/api/student/program-content/lessons/${lessonId}/complete`, { method: "POST" });
    setSubmitted(true);
    setSubmitting(false);
    onComplete();
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-semibold text-gray-800">Survey submitted! Thank you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 font-medium text-gray-800">{i + 1}. {q.question}</p>
          {q.type === "MCQ" && q.options && (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name={`q_${q.id}`} value={opt.id} checked={answers[q.id] === opt.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))} className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{opt.text}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "MULTI_SELECT" && q.options && (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" value={opt.id}
                    checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt.id)}
                    onChange={(e) => {
                      const prev = (answers[q.id] as string[]) || [];
                      setAnswers((a) => ({ ...a, [q.id]: e.target.checked ? [...prev, opt.id] : prev.filter((x) => x !== opt.id) }));
                    }} className="accent-indigo-600" />
                  <span className="text-sm text-gray-700">{opt.text}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "SHORT" && (
            <input type="text" value={(answers[q.id] as string) || ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder="Your answer…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400" />
          )}
          {q.type === "PARAGRAPH" && (
            <textarea value={(answers[q.id] as string) || ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder="Your answer…" rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400" />
          )}
          {q.type === "RATING" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: String(n) }))}
                    className={`h-9 w-9 rounded-full border-2 text-sm font-medium transition-colors ${answers[q.id] === String(n) ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 text-gray-600 hover:border-indigo-400"}`}>
                    {n}
                  </button>
                ))}
              </div>
              {(q.leftLabel || q.rightLabel) && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{q.leftLabel}</span><span>{q.rightLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={handleSubmit} disabled={submitting}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        {submitting ? "Submitting…" : "Submit Survey"}
      </button>
    </div>
  );
}

// ─── Lesson content panel ─────────────────────────────────────────────────────

function LessonContentPanel({
  lesson,
  onComplete,
  onClose,
}: {
  lesson: LessonData;
  onComplete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const content = lesson.content as Record<string, unknown> | null;

  const str = (key: string) => (typeof content?.[key] === "string" ? (content[key] as string) : null);
  const files = (key: string): string[] => {
    const v = content?.[key];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    if (typeof v === "string" && v) return [v];
    return [];
  };

  async function markDone() {
    setCompleting(true);
    await onComplete(lesson.id);
    setCompleting(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span className="text-gray-400">{LESSON_ICONS[lesson.kind]}</span>
            <span className="text-[10px] uppercase tracking-wide opacity-60">{lesson.kind}</span>
            {lesson.isCompleted && (
              <span className="ml-2 flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle className="h-3 w-3" /> Completed
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900">{lesson.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-5 max-h-[600px] overflow-y-auto">
        {lesson.kind === "TEXT" && (
          <div className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(str("html") || "<p>No content available.</p>") }} />
        )}

        {lesson.kind === "VIDEO" && (
          <>
            {files("videoUrls").length > 0 ? (
              <div className="space-y-4">
                {files("videoUrls").map((url, i) => (
                  <video key={i} controls className="w-full rounded-xl bg-black shadow-lg max-h-[500px]" src={url} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 rounded-xl bg-gray-100 text-gray-300">
                <Play className="h-12 w-12" />
              </div>
            )}
            {str("notes") && (
              <div className="prose prose-gray max-w-none border-t pt-4"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(str("notes")!) }} />
            )}
          </>
        )}

        {lesson.kind === "AUDIO" && (
          <>
            {str("body") && <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(str("body")!) }} />}
            {files("audioUrls").length > 0
              ? files("audioUrls").map((url, i) => <audio key={i} controls className="w-full rounded-lg" src={url} />)
              : <div className="flex items-center justify-center h-32 rounded-xl bg-gray-100 text-gray-300"><Music className="h-10 w-10" /></div>
            }
          </>
        )}

        {lesson.kind === "PDF" && (
          <div className="space-y-4">
            {files("pdfUrls").length > 0
              ? files("pdfUrls").map((url, i) => (
                <div key={i} className="space-y-2">
                  <iframe src={url} title={`PDF ${i + 1}`} className="w-full rounded-xl border border-gray-200 shadow-sm" style={{ height: 600 }} />
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                    <Download className="h-3.5 w-3.5" /> Open in new tab
                  </a>
                </div>
              ))
              : <div className="flex items-center justify-center h-64 rounded-xl bg-gray-100 text-gray-300"><FileText className="h-12 w-12" /></div>
            }
          </div>
        )}

        {lesson.kind === "PRESENTATION" && (
          <div className="space-y-4">
            {files("pptUrls").length > 0
              ? files("pptUrls").map((url, i) => (
                <div key={i} className="space-y-2">
                  {url.endsWith(".pdf")
                    ? <iframe src={url} title={`Slide ${i + 1}`} className="w-full rounded-xl border border-gray-200" style={{ height: 540 }} />
                    : (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 flex flex-col items-start gap-3">
                        <Presentation className="h-8 w-8 text-indigo-400" />
                        <a href={url} download className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                          <Download className="h-3.5 w-3.5" /> Download Presentation
                        </a>
                      </div>
                    )}
                </div>
              ))
              : <div className="flex items-center justify-center h-64 rounded-xl bg-gray-100 text-gray-300"><Presentation className="h-12 w-12" /></div>
            }
          </div>
        )}

        {lesson.kind === "DOWNLOAD" && (
          <div className="space-y-3">
            {files("downloadUrls").length > 0
              ? files("downloadUrls").map((url, i) => {
                const name = url.split("/").pop() || `File ${i + 1}`;
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                        <Download className="h-5 w-5 text-indigo-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-800 truncate max-w-xs">{name}</span>
                    </div>
                    <a href={url} download className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">Download</a>
                  </div>
                );
              })
              : <div className="flex items-center justify-center h-32 rounded-xl bg-gray-100 text-gray-300"><Download className="h-10 w-10" /></div>
            }
          </div>
        )}

        {lesson.kind === "MULTIMEDIA" && (
          <div className="space-y-4">
            {str("externalUrl") ? (
              <div className="space-y-2">
                <iframe src={str("externalUrl")!} title="Multimedia" className="w-full rounded-xl border border-gray-200" style={{ height: 540 }} allowFullScreen />
                <a href={str("externalUrl")!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
                  <Globe className="h-3.5 w-3.5" /> Open in new tab
                </a>
              </div>
            ) : files("multimediaUrls").map((url, i) => {
              const name = url.split("/").pop() || `File ${i + 1}`;
              return (
                <div key={i} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                  <span className="text-sm text-gray-700">{name}</span>
                  <a href={url} download className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">Download</a>
                </div>
              );
            })}
          </div>
        )}

        {lesson.kind === "QUIZ" && (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50">
              <HelpCircle className="h-10 w-10 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{lesson.title}</h3>
              {lesson.isCompleted
                ? <p className="text-sm text-green-600 font-medium flex items-center justify-center gap-1"><CheckCircle className="h-4 w-4" /> Quiz completed</p>
                : <p className="text-sm text-gray-500">Complete this quiz to mark it done.</p>
              }
            </div>
            {lesson.assessmentId && (
              <Link href={`/student/assessments/${lesson.assessmentId}/take`}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md">
                {lesson.isCompleted ? "Retake Quiz" : "Take Quiz"} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}

        {lesson.kind === "SURVEY" && (() => {
          const qs = Array.isArray(content?.questions) ? (content!.questions as SurveyQuestion[]) : [];
          return <SurveyViewer lessonId={lesson.id} questions={qs} onComplete={() => {}} />;
        })()}
      </div>

      {/* Footer */}
      {lesson.kind !== "QUIZ" && lesson.kind !== "SURVEY" && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
          <div>
            {lesson.isCompleted && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Completed
              </span>
            )}
          </div>
          {!lesson.isCompleted && (
            <button type="button" onClick={markDone} disabled={completing}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {completing ? "Saving…" : "Mark Complete"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentProgramDetailPage() {
  const { programId } = useParams<{ programId: string }>();
  const router = useRouter();
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [activeLesson, setActiveLesson] = useState<LessonData | null>(null);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const [expandedRecording, setExpandedRecording] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [contentRes, recRes] = await Promise.all([
        fetch(`/api/student/program-content/${programId}`).then((r) => r.json()),
        fetch(`/api/student/session-recordings?programId=${programId}`).then((r) => r.ok ? r.json() : { recordings: [] }),
      ]);
      const data = contentRes;
      if (data.message && !data.program) setMessage(data.message);
      if (data.syllabusPublished === false) setPublished(false);
      if (data.program) {
        setProgram(data.program);
        const expanded: Record<string, boolean> = {};
        for (const s of (data.program.subjects ?? [])) expanded[s.id] = true;
        setExpandedSubjects(expanded);
      }
      setRecordings(recRes.recordings || []);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleComplete(lessonId: string) {
    await fetch(`/api/student/program-content/lessons/${lessonId}/complete`, { method: "POST" });
    const data = await fetch(`/api/student/program-content/${programId}`).then((r) => r.json());
    if (data.program) {
      setProgram(data.program);
      const updatedLessons: LessonData[] = data.program.subjects
        .flatMap((s: SubjectData) => s.programChapters)
        .flatMap((ch: ChapterData) => ch.lessons);
      const updated = updatedLessons.find((l: LessonData) => l.id === lessonId);
      if (updated) setActiveLesson(updated);
    }
  }

  // Compute progress
  const allLessons: LessonData[] = program
    ? program.subjects.flatMap((s) => s.programChapters.flatMap((ch) => ch.lessons))
    : [];
  const completedCount = allLessons.filter((l) => l.isCompleted).length;
  const totalCount = allLessons.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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

  if (!published || !program) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Program not available</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            {message || "Program content has not been published yet. Check back soon."}
          </p>
        </div>
        <button
          onClick={() => router.push("/student/program")}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Programs
        </button>
      </div>
    );
  }

  const syllabus = program.programSyllabus;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <button
            onClick={() => router.push("/student/program")}
            className="hover:text-indigo-600 transition-colors"
          >
            Programs
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-gray-900">{program.name}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Program Content</h1>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Your progress</span>
            <span className="text-sm text-gray-500">{completedCount}/{totalCount} lessons · {progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Syllabus overview card */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Syllabus overview</h2>
            </div>
            {syllabus && (
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                syllabus.isPublished
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {syllabus.isPublished && <><Eye className="h-3 w-3" /> Published — visible to students</>}
              </span>
            )}
          </div>
          {syllabus && (
            <div className="grid gap-4 sm:grid-cols-3">
              {syllabus.instructions && (
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                    Program instructions
                  </label>
                  <div className="w-full rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                    {syllabus.instructions}
                  </div>
                </div>
              )}
              {syllabus.programHours && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Program hours</label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-700">
                    {syllabus.programHours}
                  </div>
                </div>
              )}
              {syllabus.feesNote && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Fees (optional note)</label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-700">
                    {syllabus.feesNote}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Recordings */}
      {recordings.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <button
              type="button"
              onClick={() => setRecordingsOpen((p) => !p)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-indigo-600" />
                <h2 className="font-semibold text-gray-900">Session Recordings</h2>
                <span className="text-xs text-gray-400">({recordings.length})</span>
              </div>
              {recordingsOpen
                ? <ChevronDown className="h-4 w-4 text-gray-400" />
                : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </button>

            {recordingsOpen && (
              <div className="mt-4 relative pl-6">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-indigo-100" />
                <div className="space-y-4">
                  {recordings.map((rec) => (
                    <div key={rec.id} className="relative">
                      <div className="absolute -left-[13px] top-2 h-3 w-3 rounded-full border-2 border-indigo-400 bg-white" />
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setExpandedRecording(expandedRecording === rec.id ? null : rec.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{rec.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(rec.sessionDate).toLocaleDateString()}
                                {rec.durationMin ? ` · ${rec.durationMin} min` : ""}
                                {rec.uploadedBy ? ` · by ${rec.uploadedBy.firstName} ${rec.uploadedBy.lastName}` : ""}
                              </p>
                            </div>
                            <Play className="h-4 w-4 text-indigo-500 shrink-0" />
                          </div>
                        </button>
                        {expandedRecording === rec.id && (
                          <div className="mt-3">
                            <video
                              controls
                              className="w-full rounded-lg bg-black max-h-[400px]"
                              src={rec.videoUrl}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Curriculum section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Curriculum</h2>
            <span className="text-xs text-gray-400">
              {program.subjects.length} subject{program.subjects.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {program.subjects.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
            <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No subjects available yet for this program.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {program.subjects.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Subject header */}
                <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/80 transition-colors">
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-3 text-left"
                    onClick={() => setExpandedSubjects((prev) => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                  >
                    {expandedSubjects[sub.id]
                      ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                    <Layers className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div className="text-left">
                      <span className="font-semibold text-gray-900 text-sm">{sub.code}: {sub.name}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        {sub.programChapters.length} chapter{sub.programChapters.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </button>

                  {/* Subject completion count */}
                  {(() => {
                    const subLessons = sub.programChapters.flatMap((ch) => ch.lessons);
                    const subCompleted = subLessons.filter((l) => l.isCompleted).length;
                    const subTotal = subLessons.length;
                    if (subTotal === 0) return null;
                    return (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        subCompleted === subTotal
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {subCompleted}/{subTotal}
                      </span>
                    );
                  })()}
                </div>

                {/* Chapters list */}
                {expandedSubjects[sub.id] && (
                  <div className="border-t border-gray-100">
                    {sub.programChapters.length === 0 ? (
                      <div className="px-6 py-4 text-sm text-gray-400 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        No chapters available.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {sub.programChapters.map((ch) => (
                          <div key={ch.id} className="group">
                            {/* Chapter header row */}
                            <div
                              className="flex items-center gap-2 px-6 py-3 hover:bg-gray-50/80 cursor-pointer"
                              onClick={() => setExpandedChapters((prev) => ({ ...prev, [ch.id]: !prev[ch.id] }))}
                            >
                              {expandedChapters[ch.id]
                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                              <BookOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <span className="flex-1 text-sm font-medium text-gray-800">{ch.title}</span>

                              <div className="flex items-center gap-1.5 mr-1">
                                {ch.isMandatory && (
                                  <span className="hidden sm:flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 font-medium">
                                    <AlertCircle className="h-2.5 w-2.5" /> Mandatory
                                  </span>
                                )}
                                {ch.isPrerequisite && (
                                  <span className="hidden sm:flex items-center gap-0.5 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-1.5 py-0.5 font-medium">
                                    Prerequisite
                                  </span>
                                )}
                                {ch.freePreviewLesson && (
                                  <span className="hidden sm:flex items-center gap-0.5 text-[10px] bg-green-50 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5 font-medium">
                                    Free preview
                                  </span>
                                )}
                              </div>

                              {/* Chapter completion count */}
                              {ch.lessons.length > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  ch.lessons.every((l) => l.isCompleted)
                                    ? "bg-green-50 text-green-700"
                                    : "text-gray-400"
                                }`}>
                                  {ch.lessons.filter((l) => l.isCompleted).length}/{ch.lessons.length}
                                </span>
                              )}
                            </div>

                            {/* Lessons list */}
                            {expandedChapters[ch.id] && (
                              <div className="bg-gray-50/60 border-t border-gray-100">
                                {ch.lessons.length === 0 ? (
                                  <div className="px-10 py-3 text-xs text-gray-400 flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5" />
                                    No lessons available.
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-100">
                                    {ch.lessons.map((les) => {
                                      const isActive = activeLesson?.id === les.id;
                                      return (
                                        <button
                                          key={les.id}
                                          type="button"
                                          onClick={() => setActiveLesson(isActive ? null : les)}
                                          className={`w-full flex items-center gap-3 px-10 py-2.5 text-left transition-colors ${
                                            isActive
                                              ? "bg-indigo-50 border-l-2 border-indigo-500"
                                              : "hover:bg-white"
                                          }`}
                                        >
                                          {les.isCompleted
                                            ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                            : <Circle className="h-4 w-4 text-gray-300 shrink-0" />}
                                          <span className="text-gray-400 shrink-0">{LESSON_ICONS[les.kind]}</span>
                                          <span className="flex-1 text-sm text-gray-700">{les.title}</span>
                                          {les.isCompleted ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-50 text-green-700">
                                              Completed
                                            </span>
                                          ) : (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                                              Pending
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active lesson content panel */}
      {activeLesson && (
        <div className="mt-2">
          <LessonContentPanel
            key={activeLesson.id}
            lesson={activeLesson}
            onComplete={handleComplete}
            onClose={() => setActiveLesson(null)}
          />
        </div>
      )}
    </div>
  );
}
