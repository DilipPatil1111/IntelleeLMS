"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CheckCircle, Circle, Loader2 } from "lucide-react";

type Student = {
  id: string;
  name: string;
  completed: boolean;
  completedLessons: number;
};

export function ChapterCompletionModal({
  isOpen,
  onClose,
  chapterId,
  chapterTitle,
  apiPrefix,
}: {
  isOpen: boolean;
  onClose: () => void;
  chapterId: string;
  chapterTitle: string;
  apiPrefix: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [lessonCount, setLessonCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!isOpen || !chapterId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/chapters/${chapterId}/student-completion`);
      if (res.ok) {
        const data = await res.json();
        const list: Student[] = data.students || [];
        setStudents(list);
        setLessonCount(data.lessonCount || 0);
        const sel: Record<string, boolean> = {};
        for (const s of list) sel[s.id] = s.completed;
        setSelected(sel);
      }
    } finally {
      setLoading(false);
    }
  }, [isOpen, chapterId, apiPrefix]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const s of students) next[s.id] = on;
    setSelected(next);
  }

  async function save() {
    setSaving(true);
    try {
      const toMark = students.filter((s) => selected[s.id] && !s.completed).map((s) => s.id);
      const toUnmark = students.filter((s) => !selected[s.id] && s.completed).map((s) => s.id);

      if (toMark.length > 0) {
        await fetch(`${apiPrefix}/chapters/${chapterId}/student-completion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentUserIds: toMark }),
        });
      }
      if (toUnmark.length > 0) {
        await fetch(`${apiPrefix}/chapters/${chapterId}/student-completion`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentUserIds: toUnmark }),
        });
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  const allChecked = students.length > 0 && students.every((s) => selected[s.id]);
  const noneChecked = students.every((s) => !selected[s.id]);
  const changedCount = students.filter(
    (s) => (selected[s.id] && !s.completed) || (!selected[s.id] && s.completed),
  ).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chapter completion — ${chapterTitle}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Mark all <strong>{lessonCount}</strong> published lesson{lessonCount !== 1 ? "s" : ""} in this chapter as
          complete for the selected students. Quiz lessons must be completed through Assessments.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No enrolled students found for this program.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(true)} disabled={allChecked}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(false)} disabled={noneChecked}>
                Deselect all
              </Button>
              <span className="ml-auto text-xs text-gray-400 self-center">
                {students.filter((s) => selected[s.id]).length}/{students.length} selected
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {students.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[s.id]}
                    onChange={() => setSelected((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                  {s.completed ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3.5 w-3.5" /> All done
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Circle className="h-3.5 w-3.5" /> {s.completedLessons}/{lessonCount}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || changedCount === 0}>
            {saving ? "Saving…" : changedCount > 0 ? `Save (${changedCount} change${changedCount !== 1 ? "s" : ""})` : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
