"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import type { ProgramLessonKind } from "@/app/generated/prisma/enums";

type ProgramOpt = { id: string; name: string };

type LessonRow = {
  id: string;
  title: string;
  kind: ProgramLessonKind;
  isDraft: boolean;
  assessmentId: string | null;
};

type ChapterRow = {
  id: string;
  title: string;
  isMandatory: boolean;
  lessons: LessonRow[];
};

type SubjectRow = {
  id: string;
  name: string;
  code: string;
  programChapters: ChapterRow[];
};

type Syllabus = {
  instructions: string | null;
  programHours: string | null;
  feesNote: string | null;
  isPublished: boolean;
};

const LESSON_KINDS: ProgramLessonKind[] = [
  "TEXT",
  "VIDEO",
  "PDF",
  "AUDIO",
  "PRESENTATION",
  "QUIZ",
  "DOWNLOAD",
  "SURVEY",
  "MULTIMEDIA",
];

export function ProgramContentAdminClient(props: {
  title: string;
  description?: string;
  loadPrograms: () => Promise<ProgramOpt[]>;
  apiPrefix: string;
  canCreateSubjects: boolean;
  subjectCreateUrl: string;
}) {
  const { title, description, loadPrograms, apiPrefix, canCreateSubjects, subjectCreateUrl } = props;

  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [programId, setProgramId] = useState("");
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [programName, setProgramName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [chapterTitle, setChapterTitle] = useState<Record<string, string>>({});
  const [lessonForm, setLessonForm] = useState<Record<string, { title: string; kind: ProgramLessonKind; assessmentId: string; isDraft: boolean }>>({});

  const loadTree = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/${programId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const p = data.program;
      setProgramName(p.name);
      setSyllabus(
        p.programSyllabus || {
          instructions: null,
          programHours: null,
          feesNote: null,
          isPublished: false,
        }
      );
      setSubjects(p.subjects || []);
    } catch {
      setSyllabus(null);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [apiPrefix, programId]);

  useEffect(() => {
    loadPrograms().then(setPrograms);
  }, [loadPrograms]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  async function saveSyllabus() {
    if (!programId || !syllabus) return;
    setSaving(true);
    try {
      await fetch(`${apiPrefix}/${programId}/syllabus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syllabus),
      });
      await loadTree();
    } finally {
      setSaving(false);
    }
  }

  async function addSubject() {
    if (!programId || !newSubjectName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(subjectCreateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, name: newSubjectName.trim() }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error || "Failed to create subject");
        return;
      }
      setNewSubjectName("");
      await loadTree();
    } finally {
      setSaving(false);
    }
  }

  async function addChapter(subjectId: string) {
    const t = chapterTitle[subjectId]?.trim();
    if (!t) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiPrefix}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, title: t }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error || "Failed");
        return;
      }
      setChapterTitle((prev) => ({ ...prev, [subjectId]: "" }));
      await loadTree();
    } finally {
      setSaving(false);
    }
  }

  async function addLesson(chapterId: string) {
    const f = lessonForm[chapterId];
    if (!f?.title?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiPrefix}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId,
          kind: f.kind,
          title: f.title.trim(),
          assessmentId: f.kind === "QUIZ" && f.assessmentId?.trim() ? f.assessmentId.trim() : null,
          isDraft: f.isDraft,
          content: f.kind === "TEXT" ? { html: "" } : {},
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error || "Failed");
        return;
      }
      setLessonForm((prev) => ({
        ...prev,
        [chapterId]: { title: "", kind: "TEXT", assessmentId: "", isDraft: true },
      }));
      await loadTree();
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson?")) return;
    const res = await fetch(`${apiPrefix}/lessons/${lessonId}`, { method: "DELETE" });
    if (res.ok) await loadTree();
  }

  async function deleteChapter(chapterId: string) {
    if (!confirm("Delete this chapter and all lessons?")) return;
    const res = await fetch(`${apiPrefix}/chapters/${chapterId}`, { method: "DELETE" });
    if (res.ok) await loadTree();
  }

  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <span className="text-sm font-medium text-gray-700">Program</span>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="">Select program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {programId && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{programName} — syllabus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && <p className="text-sm text-gray-500">Loading…</p>}
              {syllabus && (
                <>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Program instructions</span>
                    <textarea
                      className="mt-1 w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={syllabus.instructions || ""}
                      onChange={(e) => setSyllabus({ ...syllabus, instructions: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Program hours</span>
                      <Input
                        value={syllabus.programHours || ""}
                        onChange={(e) => setSyllabus({ ...syllabus, programHours: e.target.value })}
                      />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Fees (optional)</span>
                      <Input
                        value={syllabus.feesNote || ""}
                        onChange={(e) => setSyllabus({ ...syllabus, feesNote: e.target.value })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={syllabus.isPublished}
                      onChange={(e) => setSyllabus({ ...syllabus, isPublished: e.target.checked })}
                    />
                    Published (visible to students)
                  </label>
                  <Button type="button" onClick={saveSyllabus} disabled={saving}>
                    Save syllabus
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {canCreateSubjects && (
            <Card>
              <CardHeader>
                <CardTitle>Add subject</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Input
                  placeholder="Subject name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="max-w-md"
                />
                <Button type="button" variant="secondary" onClick={addSubject} disabled={saving}>
                  Add subject
                </Button>
              </CardContent>
            </Card>
          )}

          {subjects.map((sub) => (
            <Card key={sub.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {sub.code}: {sub.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="New chapter title"
                    value={chapterTitle[sub.id] || ""}
                    onChange={(e) => setChapterTitle((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                    className="max-w-md"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => addChapter(sub.id)} disabled={saving}>
                    Add chapter
                  </Button>
                </div>

                {sub.programChapters.map((ch) => (
                  <div key={ch.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">{ch.title}</p>
                      {ch.isMandatory && (
                        <span className="text-xs font-medium text-amber-800">Mandatory</span>
                      )}
                      <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => deleteChapter(ch.id)}>
                        Delete chapter
                      </Button>
                    </div>

                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                      {ch.lessons.map((les) => (
                        <div key={les.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>
                            <span className="font-medium text-gray-600">{les.kind}</span>: {les.title}{" "}
                            {les.isDraft ? <span className="text-amber-700">(draft)</span> : null}
                          </span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => deleteLesson(les.id)}>
                            Delete
                          </Button>
                        </div>
                      ))}

                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                        <select
                          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                          value={lessonForm[ch.id]?.kind || "TEXT"}
                          onChange={(e) =>
                            setLessonForm((prev) => ({
                              ...prev,
                              [ch.id]: {
                                title: prev[ch.id]?.title || "",
                                kind: e.target.value as ProgramLessonKind,
                                assessmentId: prev[ch.id]?.assessmentId || "",
                                isDraft: prev[ch.id]?.isDraft ?? true,
                              },
                            }))
                          }
                        >
                          {LESSON_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder="Lesson title"
                          value={lessonForm[ch.id]?.title || ""}
                          onChange={(e) =>
                            setLessonForm((prev) => ({
                              ...prev,
                              [ch.id]: {
                                kind: prev[ch.id]?.kind || "TEXT",
                                title: e.target.value,
                                assessmentId: prev[ch.id]?.assessmentId || "",
                                isDraft: prev[ch.id]?.isDraft ?? true,
                              },
                            }))
                          }
                          className="max-w-xs"
                        />
                        {(lessonForm[ch.id]?.kind || "TEXT") === "QUIZ" && (
                          <Input
                            placeholder="Assessment ID"
                            value={lessonForm[ch.id]?.assessmentId || ""}
                            onChange={(e) =>
                              setLessonForm((prev) => ({
                                ...prev,
                                [ch.id]: {
                                  ...prev[ch.id],
                                  kind: "QUIZ",
                                  title: prev[ch.id]?.title || "",
                                  assessmentId: e.target.value,
                                  isDraft: prev[ch.id]?.isDraft ?? true,
                                },
                              }))
                            }
                            className="max-w-xs font-mono text-xs"
                          />
                        )}
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={lessonForm[ch.id]?.isDraft ?? true}
                            onChange={(e) =>
                              setLessonForm((prev) => ({
                                ...prev,
                                [ch.id]: {
                                  kind: prev[ch.id]?.kind || "TEXT",
                                  title: prev[ch.id]?.title || "",
                                  assessmentId: prev[ch.id]?.assessmentId || "",
                                  isDraft: e.target.checked,
                                },
                              }))
                            }
                          />
                          Draft
                        </label>
                        <Button type="button" size="sm" onClick={() => addLesson(ch.id)} disabled={saving}>
                          Add lesson
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
