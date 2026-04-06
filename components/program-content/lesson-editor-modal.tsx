"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "./lesson-editor/rich-text-editor";
import { FileUploadArea } from "./lesson-editor/file-upload-area";
import type { UploadedFile, PendingFile } from "./lesson-editor/file-upload-area";
import { SurveyBuilder } from "./lesson-editor/survey-builder";
import type { SurveyQuestion } from "./lesson-editor/survey-builder";
import { QuizBuilder } from "./lesson-editor/quiz-builder";
import type { QuizQuestion } from "./lesson-editor/quiz-builder";
import {
  FileText, Video, FileAudio, Presentation, ClipboardList,
  Download, BarChart2, Globe, ExternalLink,
  Radio, Link2, Upload as UploadIcon, Loader2,
  Trash2, Settings, AlertCircle, CheckCircle2, PlusCircle,
} from "lucide-react";
import type { ProgramLessonKind } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LessonRow {
  id: string;
  title: string;
  kind: ProgramLessonKind;
  isDraft: boolean;
  assessmentId: string | null;
  content?: Record<string, unknown> | null;
}

export interface ChapterRow {
  id: string;
  freePreviewLesson: boolean;
  isPrerequisite: boolean;
  enableDiscussions: boolean;
}

interface LessonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterId: string;
  chapter: ChapterRow | null;
  editing: LessonRow | null;
  apiPrefix: string;
  onSaved: () => void;
}

// ─── Lesson kind metadata ─────────────────────────────────────────────────────

const LESSON_KINDS: { kind: ProgramLessonKind; label: string; icon: React.ReactNode; desc: string }[] = [
  { kind: "TEXT",         label: "Text",         icon: <FileText      className="h-6 w-6" />, desc: "Rich text content with formatting" },
  { kind: "VIDEO",        label: "Video",        icon: <Video         className="h-6 w-6" />, desc: "Upload video files" },
  { kind: "PDF",          label: "PDF",          icon: <FileText      className="h-6 w-6" />, desc: "Upload PDF documents" },
  { kind: "AUDIO",        label: "Audio",        icon: <FileAudio     className="h-6 w-6" />, desc: "Upload audio files" },
  { kind: "PRESENTATION", label: "Presentation", icon: <Presentation  className="h-6 w-6" />, desc: "Upload PPT or PDF slides" },
  { kind: "QUIZ",         label: "Quiz",         icon: <ClipboardList className="h-6 w-6" />, desc: "Create a quiz with questions" },
  { kind: "DOWNLOAD",     label: "Download",     icon: <Download      className="h-6 w-6" />, desc: "Downloadable files (any format)" },
  { kind: "SURVEY",       label: "Survey",       icon: <BarChart2     className="h-6 w-6" />, desc: "Create a questionnaire" },
  { kind: "MULTIMEDIA",   label: "Multimedia",   icon: <Globe         className="h-6 w-6" />, desc: "External URL or zip package" },
];

function kindMeta(kind: ProgramLessonKind) {
  return LESSON_KINDS.find((k) => k.kind === kind) ?? LESSON_KINDS[0];
}

const ACCEPT: Partial<Record<ProgramLessonKind, string>> = {
  VIDEO:        "video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi,.mkv",
  AUDIO:        "audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,.mp3,.wav,.ogg,.m4a,.aac,.flac",
  PDF:          "application/pdf,.pdf",
  PRESENTATION: "application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,.ppt,.pptx,.pdf",
  DOWNLOAD:     "*",
  MULTIMEDIA:   ".zip,.rar,.7z,.tar,.gz,.html,.htm",
};

function parseContent(content: Record<string, unknown> | null | undefined) {
  const c = content ?? {};
  return {
    html:             typeof c.html === "string"              ? c.html             : "",
    files:            Array.isArray(c.files)                  ? (c.files as UploadedFile[]) : [],
    multimediaMode:   (c.mode === "url" || c.mode === "file") ? c.mode as "url"|"file" : "url",
    multimediaUrl:    typeof c.url === "string"               ? c.url              : "",
    surveyQuestions:  Array.isArray(c.questions) && (c.questions as QuizQuestion[]).every((q) => "required" in q)
      ? (c.questions as SurveyQuestion[])
      : [],
    quizQuestions:    Array.isArray(c.questions) && (c.questions as QuizQuestion[]).every((q) => "marks" in q)
      ? (c.questions as QuizQuestion[])
      : [],
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LessonEditorModal({
  isOpen,
  onClose,
  chapterId,
  chapter,
  editing,
  apiPrefix,
  onSaved,
}: LessonEditorModalProps) {
  const [title, setTitle]     = useState("");
  const [kind, setKind]       = useState<ProgramLessonKind>("TEXT");
  const [isDraft, setIsDraft] = useState(true);
  const [typePicked, setTypePicked] = useState(false);

  // File-based content
  const [textContent, setTextContent]       = useState("");
  const [uploadedFiles, setUploadedFiles]   = useState<UploadedFile[]>([]);
  const [pendingFiles, setPendingFiles]     = useState<PendingFile[]>([]);
  const [multimediaMode, setMultimediaMode] = useState<"url" | "file">("url");
  const [multimediaUrl, setMultimediaUrl]   = useState("");

  // Survey
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizWarning, setQuizWarning]     = useState<string | null>(null);
  const [quizMode, setQuizMode]           = useState<"create" | "link">("create");
  const [linkedAssessmentId, setLinkedAssessmentId] = useState<string>("");
  const [existingAssessments, setExistingAssessments] = useState<{
    id: string; title: string; status: string; totalMarks: number;
    batch: { name: string } | null; subject: { name: string } | null;
    _count: { questions: number };
  }[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Chapter settings
  const [freePreview, setFreePreview]               = useState(false);
  const [isPrerequisite, setIsPrerequisite]         = useState(false);
  const [enableDiscussions, setEnableDiscussions]   = useState(false);

  // Save state
  const [saving, setSaving]               = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setTitle(editing.title);
      setKind(editing.kind);
      setIsDraft(editing.isDraft);
      setTypePicked(true);

      const parsed = parseContent(editing.content as Record<string, unknown> | null);
      setTextContent(parsed.html);
      setUploadedFiles(parsed.files);
      setPendingFiles([]);
      setMultimediaMode(parsed.multimediaMode);
      setMultimediaUrl(parsed.multimediaUrl);
      setSurveyQuestions(parsed.surveyQuestions);
      setQuizQuestions(parsed.quizQuestions);
    } else {
      setTitle(""); setKind("TEXT"); setIsDraft(true); setTypePicked(false);
      setTextContent(""); setUploadedFiles([]); setPendingFiles([]);
      setMultimediaMode("url"); setMultimediaUrl("");
      setSurveyQuestions([]); setQuizQuestions([]);
    }
    setQuizWarning(null);
    setQuizMode("create");
    setLinkedAssessmentId(editing?.assessmentId ?? "");
    setError(null);

    if (chapter) {
      setFreePreview(chapter.freePreviewLesson);
      setIsPrerequisite(chapter.isPrerequisite);
      setEnableDiscussions(chapter.enableDiscussions);
    }
  }, [isOpen, editing, chapter]);

  // ── Fetch existing assessments when QUIZ is selected ─────────────────────
  useEffect(() => {
    if (!isOpen || kind !== "QUIZ" || !chapterId) return;
    setLoadingAssessments(true);
    fetch(`${apiPrefix}/chapters/${chapterId}/assessments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.assessments) setExistingAssessments(data.assessments);
      })
      .catch(() => {})
      .finally(() => setLoadingAssessments(false));
  }, [isOpen, kind, chapterId, apiPrefix]);

  // ── Upload pending files ───────────────────────────────────────────────────
  const uploadPendingFiles = useCallback(async (lessonId: string): Promise<UploadedFile[]> => {
    const results: UploadedFile[] = [...uploadedFiles];
    for (const pending of pendingFiles) {
      const fd = new FormData();
      fd.append("file", pending.file);
      const res = await fetch(`${apiPrefix}/lessons/${lessonId}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) results.push({ url: data.url, name: data.name, size: data.size });
      else throw new Error(data.error ?? "Upload failed");
    }
    return results;
  }, [uploadedFiles, pendingFiles, apiPrefix]);

  // ── Main save ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) { setError("Please enter a lesson title."); return; }
    setError(null);
    setSaving(true);
    try {
      // ── QUIZ: dedicated quiz endpoint or link existing ─────────────────────
      if (kind === "QUIZ") {
        // Create or update lesson record first (if new)
        let lessonId = editing?.id ?? "";
        if (!lessonId) {
          const res = await fetch(`${apiPrefix}/lessons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chapterId, kind, title: title.trim(), isDraft, content: {} }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to create lesson");
          lessonId = data.lesson.id;
        }

        if (quizMode === "link") {
          // Link an existing assessment to this lesson
          if (!linkedAssessmentId) throw new Error("Please select an assessment to link.");
          const pRes = await fetch(`${apiPrefix}/lessons/${lessonId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title.trim(),
              assessmentId: linkedAssessmentId,
              isDraft,
              content: { linkedAssessmentId },
            }),
          });
          const pData = await pRes.json();
          if (!pRes.ok) throw new Error(pData.error ?? "Failed to link assessment");
        } else {
          // Save quiz via dedicated endpoint (create questions + assessments)
          const qRes = await fetch(`${apiPrefix}/lessons/${lessonId}/quiz`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title.trim(),
              questions: quizQuestions,
              isDraft,
            }),
          });
          const qData = await qRes.json();
          if (!qRes.ok) throw new Error(qData.error ?? "Failed to save quiz");
          if (qData.warning) setQuizWarning(qData.warning);
        }

        // Patch chapter settings
        if (chapter) {
          await fetch(`${apiPrefix}/chapters/${chapterId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ freePreviewLesson: freePreview, isPrerequisite, enableDiscussions }),
          });
        }
        onSaved();
        if (!quizWarning) onClose();
        return;
      }

      // ── All other lesson types ─────────────────────────────────────────────
      let lessonId = editing?.id ?? "";
      if (!lessonId) {
        const res = await fetch(`${apiPrefix}/lessons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId, kind, title: title.trim(), isDraft, content: {} }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create lesson");
        lessonId = data.lesson.id;
      }

      // Upload pending files
      let finalFiles = uploadedFiles;
      if (pendingFiles.length > 0) {
        setUploadingFiles(true);
        finalFiles = await uploadPendingFiles(lessonId);
        setUploadingFiles(false);
      }

      const contentWithFiles = (() => {
        switch (kind) {
          case "TEXT":       return { html: textContent };
          case "AUDIO":      return { html: textContent, files: finalFiles };
          case "MULTIMEDIA": return { mode: multimediaMode, url: multimediaUrl, files: finalFiles };
          case "SURVEY":     return { questions: surveyQuestions };
          default:           return { files: finalFiles };
        }
      })();

      await fetch(`${apiPrefix}/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), kind, content: contentWithFiles, isDraft }),
      });

      if (chapter) {
        await fetch(`${apiPrefix}/chapters/${chapterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freePreviewLesson: freePreview, isPrerequisite, enableDiscussions }),
        });
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred. Please try again.");
      setUploadingFiles(false);
    } finally {
      setSaving(false);
    }
  }, [
    title, kind, isDraft, textContent, uploadedFiles, pendingFiles,
    multimediaMode, multimediaUrl, surveyQuestions, quizQuestions,
    freePreview, isPrerequisite, enableDiscussions,
    editing, chapterId, chapter, apiPrefix, uploadPendingFiles, onSaved, onClose,
  ]);

  const handleDelete = useCallback(async () => {
    if (!editing) return;
    if (!confirm(`Delete lesson "${editing.title}"?`)) return;
    await fetch(`${apiPrefix}/lessons/${editing.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }, [editing, apiPrefix, onSaved, onClose]);

  const isBusy = saving || uploadingFiles;

  // ── Step 1: Type picker ───────────────────────────────────────────────────
  if (!typePicked && !editing) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Add lesson" className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Lesson title *
            </label>
            <Input
              placeholder="e.g. Introduction to Childcare Fundamentals"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Choose lesson type</p>
            <div className="grid grid-cols-3 gap-2">
              {LESSON_KINDS.map(({ kind: k, label, icon, desc }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setKind(k); setTypePicked(true); }}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-600 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 transition-all group"
                >
                  <span className="text-gray-400 group-hover:text-indigo-500 transition-colors">{icon}</span>
                  <span>{label}</span>
                  <span className="text-[10px] text-gray-400 text-center leading-tight hidden group-hover:block">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Step 2: Full editor ───────────────────────────────────────────────────
  const meta = kindMeta(kind);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit lesson — ${meta.label}` : `Add ${meta.label} lesson`}
      className="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Lesson title *
            </label>
            <Input
              placeholder="e.g. Introduction to Childcare Fundamentals"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus={!editing}
            />
          </div>
          {/* Only show "Change type" for non-quiz types and when adding new */}
          {!editing && kind !== "QUIZ" && (
            <div className="pt-5">
              <button
                type="button"
                onClick={() => setTypePicked(false)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" /> Change type
              </button>
            </div>
          )}
        </div>

        {/* ── TEXT ──────────────────────────────────────────────────────────── */}
        {kind === "TEXT" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Content</label>
            <RichTextEditor value={textContent} onChange={setTextContent} placeholder="Start writing your lesson content…" minHeight={220} />
          </div>
        )}

        {/* ── VIDEO ─────────────────────────────────────────────────────────── */}
        {kind === "VIDEO" && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Video files</label>
            <FileUploadArea
              uploaded={uploadedFiles} pending={pendingFiles}
              onAddPending={(f) => setPendingFiles((p) => [...p, ...f])}
              onRemovePending={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
              onRemoveUploaded={(url) => setUploadedFiles((u) => u.filter((x) => x.url !== url))}
              accept={ACCEPT.VIDEO}
              label="Drop video files here or click to upload (MP4, MOV, WebM, AVI — max 200 MB)"
              uploading={uploadingFiles}
            />
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">Additional text (optional)</label>
            <RichTextEditor value={textContent} onChange={setTextContent} placeholder="Add supplementary notes, transcripts, or descriptions…" minHeight={120} />
          </div>
        )}

        {/* ── PDF ───────────────────────────────────────────────────────────── */}
        {kind === "PDF" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">PDF files</label>
            <FileUploadArea
              uploaded={uploadedFiles} pending={pendingFiles}
              onAddPending={(f) => setPendingFiles((p) => [...p, ...f])}
              onRemovePending={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
              onRemoveUploaded={(url) => setUploadedFiles((u) => u.filter((x) => x.url !== url))}
              accept={ACCEPT.PDF} label="Drop PDF files here or click to upload (max 50 MB each)" uploading={uploadingFiles}
            />
          </div>
        )}

        {/* ── AUDIO ─────────────────────────────────────────────────────────── */}
        {kind === "AUDIO" && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Audio files</label>
            <FileUploadArea
              uploaded={uploadedFiles} pending={pendingFiles}
              onAddPending={(f) => setPendingFiles((p) => [...p, ...f])}
              onRemovePending={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
              onRemoveUploaded={(url) => setUploadedFiles((u) => u.filter((x) => x.url !== url))}
              accept={ACCEPT.AUDIO} label="Drop audio files here or click to upload (MP3, WAV, OGG, M4A, AAC — max 50 MB)" uploading={uploadingFiles}
            />
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">Content / transcript (optional)</label>
            <RichTextEditor value={textContent} onChange={setTextContent} placeholder="Add a transcript, show notes, or supporting text…" minHeight={140} />
          </div>
        )}

        {/* ── PRESENTATION ──────────────────────────────────────────────────── */}
        {kind === "PRESENTATION" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Presentation files</label>
            <FileUploadArea
              uploaded={uploadedFiles} pending={pendingFiles}
              onAddPending={(f) => setPendingFiles((p) => [...p, ...f])}
              onRemovePending={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
              onRemoveUploaded={(url) => setUploadedFiles((u) => u.filter((x) => x.url !== url))}
              accept={ACCEPT.PRESENTATION} label="Drop PowerPoint or PDF files here (PPT, PPTX, PDF — max 100 MB)" uploading={uploadingFiles}
            />
          </div>
        )}

        {/* ── DOWNLOAD ──────────────────────────────────────────────────────── */}
        {kind === "DOWNLOAD" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Downloadable files</label>
            <FileUploadArea
              uploaded={uploadedFiles} pending={pendingFiles}
              onAddPending={(f) => setPendingFiles((p) => [...p, ...f])}
              onRemovePending={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
              onRemoveUploaded={(url) => setUploadedFiles((u) => u.filter((x) => x.url !== url))}
              accept={ACCEPT.DOWNLOAD} label="Drop any files here — ZIP, PDF, DOC, images, videos, etc. (max 200 MB each)" uploading={uploadingFiles}
            />
          </div>
        )}

        {/* ── MULTIMEDIA ────────────────────────────────────────────────────── */}
        {kind === "MULTIMEDIA" && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Content source</p>
            <div className="flex gap-3">
              {(["url", "file"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMultimediaMode(m)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                    multimediaMode === m ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {m === "url" ? <Radio className={`h-4 w-4 ${multimediaMode === "url" ? "text-indigo-600" : "text-gray-400"}`} /> : <UploadIcon className={`h-4 w-4 ${multimediaMode === "file" ? "text-indigo-600" : "text-gray-400"}`} />}
                  {m === "url" ? "Use external URL" : "Upload content file"}
                </button>
              ))}
            </div>
            {multimediaMode === "url" ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">External URL</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="https://docs.google.com/… or your webinar/survey link" value={multimediaUrl} onChange={(e) => setMultimediaUrl(e.target.value)} className="pl-9" />
                </div>
                {multimediaUrl && (
                  <a href={multimediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1">
                    <ExternalLink className="h-3 w-3" /> Preview link
                  </a>
                )}
              </div>
            ) : (
              <FileUploadArea
                uploaded={uploadedFiles} pending={pendingFiles}
                onAddPending={(f) => setPendingFiles((p) => [...p, ...f])}
                onRemovePending={(id) => setPendingFiles((p) => p.filter((x) => x.id !== id))}
                onRemoveUploaded={(url) => setUploadedFiles((u) => u.filter((x) => x.url !== url))}
                accept={ACCEPT.MULTIMEDIA} label="Drop ZIP or compressed content files here (max 200 MB)" uploading={uploadingFiles}
              />
            )}
          </div>
        )}

        {/* ── QUIZ ──────────────────────────────────────────────────────────── */}
        {kind === "QUIZ" && (
          <div className="space-y-3">
            {/* Mode tabs */}
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setQuizMode("create")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  quizMode === "create"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5" /> Create New Quiz
              </button>
              <button
                type="button"
                onClick={() => setQuizMode("link")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  quizMode === "link"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Link2 className="h-3.5 w-3.5" /> Link Existing Assessment
              </button>
            </div>

            {/* Create New Quiz */}
            {quizMode === "create" && (
              <>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Quiz questions
                  </label>
                  {quizQuestions.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {quizQuestions.reduce((s, q) => s + q.marks, 0)} total marks
                    </span>
                  )}
                </div>
                <QuizBuilder questions={quizQuestions} onChange={setQuizQuestions} />
                {quizWarning && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{quizWarning} You can still publish it once a batch is added to this program.</span>
                  </div>
                )}
              </>
            )}

            {/* Link Existing Assessment */}
            {quizMode === "link" && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Select an assessment from this program
                </label>
                {loadingAssessments ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading assessments…
                  </div>
                ) : existingAssessments.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                    No quizzes found for this program. Create one first from the Assessments menu.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {existingAssessments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setLinkedAssessmentId(a.id)}
                        className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          linkedAssessmentId === a.id
                            ? "border-indigo-400 bg-indigo-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {a._count.questions} question{a._count.questions !== 1 ? "s" : ""} · {a.totalMarks} marks
                            {a.subject && <> · {a.subject.name}</>}
                            {a.batch && <> · {a.batch.name}</>}
                          </p>
                        </div>
                        <span className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          a.status === "PUBLISHED"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {a.status}
                        </span>
                        {linkedAssessmentId === a.id && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                  Linked assessment must be Published from the Assessments menu for students to see this lesson.
                </div>
              </div>
            )}

            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
              Once published, this quiz will appear in students&#39; Assessments and results will be tracked in the Assessment module.
            </div>
          </div>
        )}

        {/* ── SURVEY ────────────────────────────────────────────────────────── */}
        {kind === "SURVEY" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Survey questions</label>
            <SurveyBuilder questions={surveyQuestions} onChange={setSurveyQuestions} />
          </div>
        )}

        {/* ── Chapter / Lesson settings ──────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lesson settings</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={freePreview} onChange={(e) => setFreePreview(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
              <span className="text-sm text-gray-700">Make this a free preview lesson</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={isPrerequisite} onChange={(e) => setIsPrerequisite(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
              <span className="text-sm text-gray-700">Make this a prerequisite</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={enableDiscussions} onChange={(e) => setEnableDiscussions(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
              <span className="text-sm text-gray-700">Enable discussions for this lesson</span>
            </label>
          </div>
          <p className="text-[11px] text-gray-400">These settings apply to all lessons in this chapter.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIsDraft((d) => !d)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isDraft ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-white/80" />
            {isDraft ? "Save as Draft" : "Published"}
          </button>
          <div className="flex-1" />
          {editing && (
            <Button variant="outline" onClick={handleDelete} disabled={isBusy} className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isBusy}>Cancel</Button>
          <Button onClick={handleSave} disabled={isBusy || !title.trim()}>
            {isBusy
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{uploadingFiles ? "Uploading…" : "Saving…"}</>
              : editing ? "Save changes" : "Add lesson"
            }
          </Button>
        </div>
      </div>
    </Modal>
  );
}
