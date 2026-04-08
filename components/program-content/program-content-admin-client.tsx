"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import {
  Plus, ChevronRight, ChevronDown, Pencil, Trash2, BookOpen,
  Layers, GraduationCap, FileText, Video, FileAudio, Presentation,
  Download, BarChart2, Globe, ClipboardList, Eye, EyeOff, CheckCircle,
  AlertCircle, Settings, Book, FolderOpen, GripVertical, Tag, ChevronUp,
} from "lucide-react";
import type { ProgramLessonKind } from "@/app/generated/prisma/enums";
import { LessonEditorModal } from "./lesson-editor-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaxRef = { id: string; name: string };
type TaxItem = { id: string; name: string; customerId: string | null; sortOrder: number; isActive: boolean };
type ProgramOpt = {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  durationText?: string | null;
  programDomain?: TaxRef | null;
  programCategory?: TaxRef | null;
  programType?: TaxRef | null;
  _count?: { subjects: number; batches: number; students: number };
};
type SubjectOpt = { id: string; name: string; code: string };
type LessonRow = {
  id: string;
  title: string;
  kind: ProgramLessonKind;
  isDraft: boolean;
  assessmentId: string | null;
  content?: Record<string, unknown> | null;
};
type ChapterRow = {
  id: string;
  title: string;
  isMandatory: boolean;
  isPrerequisite: boolean;
  freePreviewLesson: boolean;
  enableDiscussions: boolean;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const LESSON_KINDS: { kind: ProgramLessonKind; label: string; icon: React.ReactNode }[] = [
  { kind: "TEXT", label: "Text", icon: <FileText className="h-5 w-5" /> },
  { kind: "VIDEO", label: "Video", icon: <Video className="h-5 w-5" /> },
  { kind: "PDF", label: "PDF", icon: <FileText className="h-5 w-5" /> },
  { kind: "AUDIO", label: "Audio", icon: <FileAudio className="h-5 w-5" /> },
  { kind: "PRESENTATION", label: "Presentation", icon: <Presentation className="h-5 w-5" /> },
  { kind: "QUIZ", label: "Quiz", icon: <ClipboardList className="h-5 w-5" /> },
  { kind: "DOWNLOAD", label: "Download", icon: <Download className="h-5 w-5" /> },
  { kind: "SURVEY", label: "Survey", icon: <BarChart2 className="h-5 w-5" /> },
  { kind: "MULTIMEDIA", label: "Multimedia", icon: <Globe className="h-5 w-5" /> },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProgramContentAdminClientProps {
  title: string;
  description?: string;
  role: "principal" | "teacher";
  loadPrograms: () => Promise<ProgramOpt[]>;
  loadAllSubjects: (programId: string) => Promise<SubjectOpt[]>;
  apiPrefix: string;
  canCreateSubjects: boolean;
  subjectCreateUrl: string;
  // Program CRUD (only principal can create/edit/delete programs)
  canManagePrograms?: boolean;
  programsApiUrl?: string;
  programTaxonomyUrls?: {
    domains: string;
    categories: string;
    types: string;
  };
}

// ─── Taxonomy panel (embedded at top of Program Content) ─────────────────────

type TaxTab = "domains" | "categories" | "types";
const TAX_EMPTY_FORM = { name: "", customerId: "", sortOrder: 0 };

function TaxonomyPanel({
  taxonomyUrls,
}: {
  taxonomyUrls: { domains: string; categories: string; types: string };
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TaxTab>("domains");
  const [domains, setDomains] = useState<TaxItem[]>([]);
  const [categories, setCategories] = useState<TaxItem[]>([]);
  const [types, setTypes] = useState<TaxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaxItem | null>(null);
  const [form, setForm] = useState(TAX_EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [d, c, t] = await Promise.all([
      fetch(taxonomyUrls.domains).then((r) => r.json()),
      fetch(taxonomyUrls.categories).then((r) => r.json()),
      fetch(taxonomyUrls.types).then((r) => r.json()),
    ]);
    setDomains(d.domains || []);
    setCategories(c.categories || []);
    setTypes(t.types || []);
    setLoading(false);
  }, [taxonomyUrls]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void loadAll();
  }, [open, loadAll]);

  const items = tab === "domains" ? domains : tab === "categories" ? categories : types;
  const label = tab === "domains" ? "Domain" : tab === "categories" ? "Category" : "Type";
  const baseUrl =
    tab === "domains"
      ? taxonomyUrls.domains
      : tab === "categories"
        ? taxonomyUrls.categories
        : taxonomyUrls.types;

  function openCreate() {
    setEditing(null);
    setForm(TAX_EMPTY_FORM);
    setModalOpen(true);
  }
  function openEdit(x: TaxItem) {
    setEditing(x);
    setForm({ name: x.name, customerId: x.customerId ?? "", sortOrder: x.sortOrder });
    setModalOpen(true);
  }
  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const url = editing ? `${baseUrl}/${editing.id}` : baseUrl;
    const method = editing ? "PUT" : "POST";
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      sortOrder: form.sortOrder,
      isActive: true,
      customerId: form.customerId.trim() || null,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert((j as { error?: string }).error || "Save failed"); return; }
    setModalOpen(false);
    void loadAll();
  }
  async function remove(x: TaxItem) {
    if (!confirm(`Delete "${x.name}"?`)) return;
    const res = await fetch(`${baseUrl}/${x.id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert((j as { error?: string }).error || "Delete failed"); return; }
    void loadAll();
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50/80 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-indigo-500 shrink-0" />
          <span className="text-base font-bold text-indigo-900">Program Taxonomy</span>
          <span className="text-xs text-indigo-500">(Domains · Categories · Types)</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-indigo-400" /> : <ChevronDown className="h-4 w-4 text-indigo-400" />}
      </button>

      {open && (
        <div className="border-t border-indigo-100 px-4 pb-4 pt-3 bg-white">
          {/* Tab bar */}
          <div className="flex gap-2 mb-4">
            {(["domains", "categories", "types"] as TaxTab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  tab === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={openCreate}
              className="ml-auto flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add {label}
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400 py-2">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No {label.toLowerCase()}s yet. Add one above.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-gray-50">
              {items.map((x) => (
                <li key={x.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{x.name}</p>
                    {x.customerId && <p className="text-[10px] text-gray-400">ID: {x.customerId}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!x.isActive && <span className="text-[10px] text-gray-400 mr-1">Inactive</span>}
                    <button type="button" className="p-1 text-gray-400 hover:text-indigo-600" onClick={() => openEdit(x)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="p-1 text-gray-400 hover:text-red-500" onClick={() => void remove(x)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Taxonomy CRUD modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${label}` : `Add ${label}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Name *</label>
            <Input
              placeholder={tab === "domains" ? "e.g. Software" : tab === "categories" ? "e.g. Vocational" : "e.g. Diploma"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Customer ID (optional)</label>
            <Input
              placeholder="e.g. DOM-001 — leave empty if not used"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sort order</label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgramContentAdminClient(props: ProgramContentAdminClientProps) {
  const {
    title,
    role,
    loadPrograms,
    loadAllSubjects,
    apiPrefix,
    canCreateSubjects,
    subjectCreateUrl,
    canManagePrograms = false,
    programsApiUrl = "/api/principal/programs",
    programTaxonomyUrls,
  } = props;

  // ── Step navigation ──────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Programs ─────────────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<ProgramOpt | null>(null);
  const [programsLoading, setProgramsLoading] = useState(false);

  // Program modal
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramOpt | null>(null);
  const [programForm, setProgramForm] = useState({
    name: "", code: "", description: "", durationText: "",
    programDomainId: "", programCategoryId: "", programTypeId: "",
  });
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [progTypes, setProgTypes] = useState<{ id: string; name: string }[]>([]);

  // ── Subjects ─────────────────────────────────────────────────────────────
  const [allProgramSubjects, setAllProgramSubjects] = useState<SubjectOpt[]>([]);
  const [linkedSubjects, setLinkedSubjects] = useState<SubjectRow[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Subject create modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });
  const [subjectMsg, setSubjectMsg] = useState<string | null>(null);
  const [subjectSaving, setSubjectSaving] = useState(false);

  // Subject edit modal
  const [editSubjectModal, setEditSubjectModal] = useState<{ open: boolean; subject: SubjectRow | null }>({ open: false, subject: null });
  const [editSubjectForm, setEditSubjectForm] = useState({ name: "", code: "" });
  const [editSubjectMsg, setEditSubjectMsg] = useState<string | null>(null);
  const [editSubjectSaving, setEditSubjectSaving] = useState(false);

  // Approval request modal (teacher wants to delete published-program subject)
  const [approvalModal, setApprovalModal] = useState<{ open: boolean; subjectId: string; subjectName: string }>({ open: false, subjectId: "", subjectName: "" });
  const [approvalSending, setApprovalSending] = useState(false);

  // Drag-and-drop for subjects
  const dragSubjectId = useRef<string | null>(null);
  const [dragOverSubjectId, setDragOverSubjectId] = useState<string | null>(null);

  // Syllabus
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [syllabusSaving, setSyllabusSaving] = useState(false);

  // ── Chapters / Lessons ────────────────────────────────────────────────────
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [chapterModal, setChapterModal] = useState<{
    open: boolean;
    subjectId: string;
    editing: ChapterRow | null;
  }>({ open: false, subjectId: "", editing: null });
  const [chapterForm, setChapterForm] = useState({
    title: "",
    isMandatory: false,
    isPrerequisite: false,
    freePreviewLesson: false,
    enableDiscussions: false,
  });
  const [lessonModal, setLessonModal] = useState<{
    open: boolean;
    chapterId: string;
    editing: LessonRow | null;
  }>({ open: false, chapterId: "", editing: null });
  const [contentSaving, setContentSaving] = useState(false);

  // ── Load programs ─────────────────────────────────────────────────────────

  const fetchPrograms = useCallback(async () => {
    setProgramsLoading(true);
    try {
      const [progs, taxData] = await Promise.all([
        loadPrograms(),
        canManagePrograms && programTaxonomyUrls
          ? Promise.all([
              fetch(programTaxonomyUrls.domains).then((r) => r.json()),
              fetch(programTaxonomyUrls.categories).then((r) => r.json()),
              fetch(programTaxonomyUrls.types).then((r) => r.json()),
            ])
          : Promise.resolve(null),
      ]);
      setPrograms(progs);
      if (taxData) {
        setDomains((taxData[0]?.domains || []).filter((x: { isActive?: boolean }) => x.isActive !== false));
        setCategories((taxData[1]?.categories || []).filter((x: { isActive?: boolean }) => x.isActive !== false));
        setProgTypes((taxData[2]?.types || []).filter((x: { isActive?: boolean }) => x.isActive !== false));
      }
    } finally {
      setProgramsLoading(false);
    }
  }, [loadPrograms, canManagePrograms, programTaxonomyUrls]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // ── Load subjects + tree for selected program ─────────────────────────────

  const loadSubjectsAndTree = useCallback(async (pid: string) => {
    setSubjectsLoading(true);
    try {
      const [treeRes, allSubs] = await Promise.all([
        fetch(`${apiPrefix}/${pid}`),
        loadAllSubjects(pid),
      ]);
      const data = await treeRes.json();
      const p = data.program;
      setSyllabus(
        p?.programSyllabus || { instructions: null, programHours: null, feesNote: null, isPublished: false }
      );
      setLinkedSubjects(p?.subjects || []);
      setAllProgramSubjects(allSubs);
      // Auto-expand all subjects
      const expanded: Record<string, boolean> = {};
      for (const s of (p?.subjects || [])) expanded[s.id] = true;
      setExpandedSubjects(expanded);
    } finally {
      setSubjectsLoading(false);
    }
  }, [apiPrefix, loadAllSubjects]);

  function selectProgram(p: ProgramOpt) {
    setSelectedProgram(p);
    setStep(2);
    loadSubjectsAndTree(p.id);
  }

  // ── Program CRUD ──────────────────────────────────────────────────────────

  function openCreateProgram() {
    setEditingProgram(null);
    setProgramForm({ name: "", code: "", description: "", durationText: "", programDomainId: "", programCategoryId: "", programTypeId: "" });
    setShowProgramModal(true);
  }

  function openEditProgram(p: ProgramOpt, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingProgram(p);
    setProgramForm({
      name: p.name,
      code: p.code || "",
      description: p.description || "",
      durationText: p.durationText || "",
      programDomainId: p.programDomain?.id || "",
      programCategoryId: p.programCategory?.id || "",
      programTypeId: p.programType?.id || "",
    });
    setShowProgramModal(true);
  }

  async function saveProgram() {
    const url = editingProgram ? `${programsApiUrl}/${editingProgram.id}` : programsApiUrl;
    const method = editingProgram ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...programForm,
        durationYears: 1,
        programDomainId: programForm.programDomainId || null,
        programCategoryId: programForm.programCategoryId || null,
        programTypeId: programForm.programTypeId || null,
      }),
    });
    if (!res.ok) { alert("Failed to save program"); return; }
    setShowProgramModal(false);
    await fetchPrograms();
  }

  async function deleteProgram(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this program? This cannot be undone.")) return;
    await fetch(`${programsApiUrl}/${id}`, { method: "DELETE" });
    if (selectedProgram?.id === id) { setSelectedProgram(null); setStep(1); }
    await fetchPrograms();
  }

  // ── Syllabus ──────────────────────────────────────────────────────────────

  async function saveSyllabus() {
    if (!selectedProgram || !syllabus) return;
    setSyllabusSaving(true);
    try {
      await fetch(`${apiPrefix}/${selectedProgram.id}/syllabus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syllabus),
      });
      await loadSubjectsAndTree(selectedProgram.id);
    } finally {
      setSyllabusSaving(false);
    }
  }

  // ── Subject CRUD + drag reorder ───────────────────────────────────────────

  async function createSubject() {
    if (!selectedProgram || !subjectForm.name.trim()) return;
    setSubjectMsg(null);
    setSubjectSaving(true);
    try {
      const res = await fetch(subjectCreateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: selectedProgram.id,
          name: subjectForm.name.trim(),
          code: subjectForm.code.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        setSubjectMsg((e as { error?: string }).error || "Failed to create subject");
        return;
      }
      setShowSubjectModal(false);
      setSubjectForm({ name: "", code: "" });
      await loadSubjectsAndTree(selectedProgram.id);
    } finally {
      setSubjectSaving(false);
    }
  }

  function openEditSubject(sub: SubjectRow) {
    setEditSubjectForm({ name: sub.name, code: sub.code });
    setEditSubjectMsg(null);
    setEditSubjectModal({ open: true, subject: sub });
  }

  async function saveEditSubject() {
    if (!editSubjectModal.subject || !editSubjectForm.name.trim() || !selectedProgram) return;
    setEditSubjectMsg(null);
    setEditSubjectSaving(true);
    try {
      const res = await fetch(`${apiPrefix}/subjects/${editSubjectModal.subject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editSubjectForm.name.trim(), code: editSubjectForm.code.trim() || undefined }),
      });
      if (!res.ok) {
        const e = await res.json();
        setEditSubjectMsg((e as { error?: string }).error || "Failed to save");
        return;
      }
      setEditSubjectModal({ open: false, subject: null });
      await loadSubjectsAndTree(selectedProgram.id);
    } finally {
      setEditSubjectSaving(false);
    }
  }

  async function deleteSubject(sub: SubjectRow) {
    if (!selectedProgram) return;
    const isPublished = syllabus?.isPublished ?? false;

    if (isPublished && role === "teacher") {
      // Teacher can't delete from published program — show approval request modal
      setApprovalModal({ open: true, subjectId: sub.id, subjectName: `${sub.code}: ${sub.name}` });
      return;
    }

    if (isPublished && role === "principal") {
      if (!confirm(`"${sub.name}" is in a PUBLISHED program. Unpublish the program first, then delete, or proceed anyway?`)) return;
    } else {
      if (!confirm(`Delete subject "${sub.name}" and all its chapters and lessons? This cannot be undone.`)) return;
    }

    const res = await fetch(`${apiPrefix}/subjects/${sub.id}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json();
      alert((e as { error?: string }).error || "Delete failed");
      return;
    }
    await loadSubjectsAndTree(selectedProgram.id);
  }

  async function sendApprovalRequest() {
    if (!selectedProgram || !approvalModal.subjectId) return;
    setApprovalSending(true);
    try {
      // Send a notification via existing announcements or a simple fetch to principal API
      // For now we use the school's email notification pattern via a POST that logs a message
      await fetch(`/api/teacher/program-content/subjects/${approvalModal.subjectId}/delete-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: selectedProgram.id, subjectName: approvalModal.subjectName }),
      });
      setApprovalModal({ open: false, subjectId: "", subjectName: "" });
      alert("Approval request sent to Principal/Administrator.");
    } catch {
      alert("Failed to send request. Please contact your Principal directly.");
    } finally {
      setApprovalSending(false);
    }
  }

  function handleSubjectDragStart(e: React.DragEvent, subjectId: string) {
    dragSubjectId.current = subjectId;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleSubjectDragOver(e: React.DragEvent, subjectId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragSubjectId.current !== subjectId) setDragOverSubjectId(subjectId);
  }

  async function handleSubjectDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverSubjectId(null);
    const fromId = dragSubjectId.current;
    dragSubjectId.current = null;
    if (!fromId || fromId === targetId || !selectedProgram) return;

    const reordered = [...linkedSubjects];
    const fromIdx = reordered.findIndex((s) => s.id === fromId);
    const toIdx = reordered.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLinkedSubjects(reordered);

    // Persist order
    await fetch(`${apiPrefix}/subjects/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId: selectedProgram.id, orderedIds: reordered.map((s) => s.id) }),
    });
  }

  function handleSubjectDragEnd() {
    dragSubjectId.current = null;
    setDragOverSubjectId(null);
  }

  // ── Chapter CRUD ──────────────────────────────────────────────────────────

  function openAddChapter(subjectId: string) {
    setChapterForm({ title: "", isMandatory: false, isPrerequisite: false, freePreviewLesson: false, enableDiscussions: false });
    setChapterModal({ open: true, subjectId, editing: null });
  }

  function openEditChapter(ch: ChapterRow, subjectId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setChapterForm({
      title: ch.title,
      isMandatory: ch.isMandatory,
      isPrerequisite: ch.isPrerequisite,
      freePreviewLesson: ch.freePreviewLesson,
      enableDiscussions: ch.enableDiscussions,
    });
    setChapterModal({ open: true, subjectId, editing: ch });
  }

  async function saveChapter() {
    if (!chapterForm.title.trim() || !selectedProgram) return;
    setContentSaving(true);
    try {
      if (chapterModal.editing) {
        await fetch(`${apiPrefix}/chapters/${chapterModal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chapterForm),
        });
      } else {
        await fetch(`${apiPrefix}/chapters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId: chapterModal.subjectId, ...chapterForm }),
        });
      }
      setChapterModal({ open: false, subjectId: "", editing: null });
      await loadSubjectsAndTree(selectedProgram.id);
    } finally {
      setContentSaving(false);
    }
  }

  async function deleteChapter(chapterId: string) {
    if (!confirm("Delete this chapter and all its lessons?") || !selectedProgram) return;
    await fetch(`${apiPrefix}/chapters/${chapterId}`, { method: "DELETE" });
    await loadSubjectsAndTree(selectedProgram.id);
  }

  // ── Lesson CRUD ───────────────────────────────────────────────────────────

  function openAddLesson(chapterId: string) {
    setLessonModal({ open: true, chapterId, editing: null });
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: true }));
  }

  function openEditLesson(les: LessonRow, chapterId: string) {
    setLessonModal({ open: true, chapterId, editing: les });
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson?") || !selectedProgram) return;
    await fetch(`${apiPrefix}/lessons/${lessonId}`, { method: "DELETE" });
    await loadSubjectsAndTree(selectedProgram.id);
  }

  async function toggleLessonDraft(les: LessonRow) {
    if (!selectedProgram) return;
    await fetch(`${apiPrefix}/lessons/${les.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDraft: !les.isDraft }),
    });
    await loadSubjectsAndTree(selectedProgram.id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const lessonKindMeta = (k: ProgramLessonKind) =>
    LESSON_KINDS.find((x) => x.kind === k) || LESSON_KINDS[0];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Taxonomy panel (always visible at top, collapsible) ───────────── */}
      {programTaxonomyUrls && (
        <TaxonomyPanel taxonomyUrls={programTaxonomyUrls} />
      )}

      {/* ── Top breadcrumb bar ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <button
            onClick={() => setStep(1)}
            className={step === 1 ? "font-semibold text-gray-900" : "hover:text-indigo-600"}
          >
            Programs
          </button>
          {selectedProgram && (
            <>
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => setStep(2)}
                className={step === 2 ? "font-semibold text-gray-900" : "hover:text-indigo-600"}
              >
                {selectedProgram.name}
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="font-semibold text-gray-900">Curriculum</span>
            </>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 1: Program list                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              {role === "principal"
                ? "Select a program to manage its syllabus, or create a new one."
                : "Select a program to build or edit its curriculum."}
            </p>
            {canManagePrograms && (
              <Button onClick={openCreateProgram}>
                <Plus className="h-4 w-4 mr-1" /> Create Program
              </Button>
            )}
          </div>

          {programsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : programs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <GraduationCap className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No programs yet.</p>
              {canManagePrograms && (
                <Button className="mt-4" onClick={openCreateProgram}>
                  <Plus className="h-4 w-4 mr-1" /> Create your first program
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectProgram(p)}
                  className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all"
                >
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 mb-4" />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                      {p.code && <p className="text-xs text-gray-400 mt-0.5">{p.code}</p>}
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    {canManagePrograms && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => openEditProgram(p, e)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                          title="Edit program"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => deleteProgram(p.id, e)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-500"
                          title="Delete program"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.durationText && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                        {p.durationText}
                      </span>
                    )}
                    {p.programDomain && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
                        {p.programDomain.name}
                      </span>
                    )}
                    {p.programCategory && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 rounded-full px-2 py-0.5">
                        {p.programCategory.name}
                      </span>
                    )}
                  </div>

                  {p._count && (
                    <div className="mt-3 flex gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Book className="h-3 w-3" /> {p._count.subjects} subjects
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {p._count.batches} batches
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" /> {p._count.students} students
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 2 & 3: Program detail (subjects + chapters)                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {(step === 2 || step === 3) && selectedProgram && (
        <div className="flex flex-col gap-6">
          {/* ── Program syllabus card ──────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <h2 className="font-semibold text-gray-900">Syllabus overview</h2>
                </div>
                {/* Publish status badge (read-only indicator, not the action button) */}
                {syllabus && (
                  <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    syllabus.isPublished
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {syllabus.isPublished ? <><Eye className="h-3 w-3" /> Published — visible to students</> : <><EyeOff className="h-3 w-3" /> Draft — hidden from students</>}
                  </span>
                )}
              </div>
              {syllabus && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                      Program instructions
                    </label>
                    <textarea
                      className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm resize-none focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                      placeholder="Welcome message or general instructions for students…"
                      value={syllabus.instructions || ""}
                      onChange={(e) => setSyllabus({ ...syllabus, instructions: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Program hours</label>
                    <Input
                      placeholder="e.g. 120 hrs"
                      value={syllabus.programHours || ""}
                      onChange={(e) => setSyllabus({ ...syllabus, programHours: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Fees (optional note)</label>
                    <Input
                      placeholder="e.g. $1,200 or Included"
                      value={syllabus.feesNote || ""}
                      onChange={(e) => setSyllabus({ ...syllabus, feesNote: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={saveSyllabus} disabled={syllabusSaving} className="w-full">
                      {syllabusSaving ? "Saving…" : "Save syllabus"}
                    </Button>
                  </div>

                  {/* Publish / Unpublish button */}
                  <div className="sm:col-span-3 pt-1 flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...syllabus, isPublished: !syllabus.isPublished };
                        setSyllabus(next);
                        // Auto-save publish state immediately
                        fetch(`${apiPrefix}/${selectedProgram!.id}/syllabus`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(next),
                        }).then(() => loadSubjectsAndTree(selectedProgram!.id));
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                        syllabus.isPublished
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${syllabus.isPublished ? "bg-white/80" : "bg-white/80"}`} />
                      {syllabus.isPublished ? "Unpublish Program" : "Publish Program"}
                    </button>
                    <p className="text-[11px] text-gray-400">
                      {syllabus.isPublished
                        ? "Students can currently view this program. Unpublishing will hide it immediately."
                        : "While in Draft, this program is invisible to students. Publish to make it visible."}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Subjects + Curriculum ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-indigo-600" />
                <h2 className="font-semibold text-gray-900">Curriculum</h2>
                <span className="text-xs text-gray-400">
                  {linkedSubjects.length} subject{linkedSubjects.length !== 1 ? "s" : ""}
                </span>
                {linkedSubjects.length > 1 && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <GripVertical className="h-3 w-3" /> drag to reorder
                  </span>
                )}
              </div>
              {canCreateSubjects && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectForm({ name: "", code: "" });
                    setSubjectMsg(null);
                    setShowSubjectModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {linkedSubjects.length === 0 ? "Add Subject" : "Add / Link Subject"}
                </button>
              )}
            </div>

            {subjectsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : linkedSubjects.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
                <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">No subjects yet for this program.</p>
                {canCreateSubjects && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectForm({ name: "", code: "" });
                      setSubjectMsg(null);
                      setShowSubjectModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Add First Subject
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {linkedSubjects.map((sub) => (
                  <div
                    key={sub.id}
                    draggable
                    onDragStart={(e) => handleSubjectDragStart(e, sub.id)}
                    onDragOver={(e) => handleSubjectDragOver(e, sub.id)}
                    onDrop={(e) => handleSubjectDrop(e, sub.id)}
                    onDragEnd={handleSubjectDragEnd}
                    className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${
                      dragOverSubjectId === sub.id
                        ? "border-blue-400 ring-2 ring-blue-200 scale-[1.01]"
                        : "border-gray-200"
                    }`}
                  >
                    {/* Subject header */}
                    <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/80 transition-colors">
                      {/* Drag handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 shrink-0 mr-1"
                        title="Drag to reorder"
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>

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

                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {/* Edit subject */}
                        <button
                          type="button"
                          title="Edit subject"
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                          onClick={(e) => { e.stopPropagation(); openEditSubject(sub); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Delete subject */}
                        <button
                          type="button"
                          title={syllabus?.isPublished && role === "teacher" ? "Request approval to delete" : "Delete subject"}
                          className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${
                            syllabus?.isPublished && role === "teacher"
                              ? "text-amber-400 hover:text-amber-600"
                              : "text-gray-400 hover:text-red-500"
                          }`}
                          onClick={(e) => { e.stopPropagation(); deleteSubject(sub); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {/* Add chapter */}
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                          onClick={(e) => { e.stopPropagation(); openAddChapter(sub.id); }}
                        >
                          <Plus className="h-3 w-3" /> Add chapter
                        </button>
                      </div>
                    </div>

                    {/* Chapters list */}
                    {expandedSubjects[sub.id] && (
                      <div className="border-t border-gray-100">
                        {sub.programChapters.length === 0 ? (
                          <div className="px-6 py-4 text-sm text-gray-400 flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            No chapters yet — click <strong>Add chapter</strong> above.
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

                                  <div className="flex items-center gap-1">
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                                        title="Chapter settings"
                                        onClick={(e) => { e.stopPropagation(); openEditChapter(ch, sub.id, e); }}
                                      >
                                        <Settings className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                                        title="Delete chapter"
                                        onClick={(e) => { e.stopPropagation(); deleteChapter(ch.id); }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                                      onClick={(e) => { e.stopPropagation(); openAddLesson(ch.id); }}
                                    >
                                      <Plus className="h-3 w-3" /> Lesson
                                    </button>
                                  </div>
                                </div>

                                {/* Lessons list */}
                                {expandedChapters[ch.id] && (
                                  <div className="bg-gray-50/60 border-t border-gray-100">
                                    {ch.lessons.length === 0 ? (
                                      <div className="px-10 py-3 text-xs text-gray-400 flex items-center gap-2">
                                        <FileText className="h-3.5 w-3.5" />
                                        No lessons yet — add one using the <strong>+ Lesson</strong> button.
                                      </div>
                                    ) : (
                                      <div className="divide-y divide-gray-100">
                                        {ch.lessons.map((les) => {
                                          const meta = lessonKindMeta(les.kind);
                                          return (
                                            <div
                                              key={les.id}
                                              className="group/lesson flex items-center gap-3 px-10 py-2.5 hover:bg-white transition-colors"
                                            >
                                              <span className="text-gray-400 shrink-0">{meta.icon}</span>
                                              <span className="flex-1 text-sm text-gray-700">{les.title}</span>
                                              <div className="flex items-center gap-1.5">
                                                <span
                                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                    les.isDraft
                                                      ? "bg-gray-100 text-gray-500"
                                                      : "bg-green-50 text-green-700"
                                                  }`}
                                                >
                                                  {les.isDraft ? "Draft" : "Published"}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                                                <button
                                                  type="button"
                                                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                                                  title={les.isDraft ? "Publish lesson" : "Set to draft"}
                                                  onClick={() => toggleLessonDraft(les)}
                                                >
                                                  {les.isDraft
                                                    ? <Eye className="h-3.5 w-3.5" />
                                                    : <EyeOff className="h-3.5 w-3.5" />}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                                                  title="Edit lesson"
                                                  onClick={() => openEditLesson(les, ch.id)}
                                                >
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                                                  title="Delete lesson"
                                                  onClick={() => deleteLesson(les.id)}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2 px-10 py-2 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/60 transition-colors"
                                      onClick={() => openAddLesson(ch.id)}
                                    >
                                      <Plus className="h-3.5 w-3.5" /> Add lesson
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-6 py-2.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/60 transition-colors border-t border-gray-100"
                          onClick={() => openAddChapter(sub.id)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add chapter to {sub.name}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Create / edit program                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showProgramModal}
        onClose={() => setShowProgramModal(false)}
        title={editingProgram ? "Edit program" : "Create program"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Program name *
            </label>
            <Input
              placeholder="e.g. Diploma in Software Engineering"
              value={programForm.name}
              onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Program code *
            </label>
            <Input
              placeholder="e.g. DSE2024"
              value={programForm.code}
              onChange={(e) => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px] focus:ring-1 focus:ring-indigo-400 focus:outline-none"
              placeholder="Short description of the program…"
              value={programForm.description}
              onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Duration
            </label>
            <Input
              placeholder="e.g. 2 years, 18 months, 3 semesters"
              value={programForm.durationText}
              onChange={(e) => setProgramForm({ ...programForm, durationText: e.target.value })}
            />
          </div>
          {canManagePrograms && domains.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Domain</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={programForm.programDomainId}
                onChange={(e) => setProgramForm({ ...programForm, programDomainId: e.target.value })}
              >
                <option value="">— None —</option>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {canManagePrograms && categories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Category</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={programForm.programCategoryId}
                onChange={(e) => setProgramForm({ ...programForm, programCategoryId: e.target.value })}
              >
                <option value="">— None —</option>
                {categories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          {canManagePrograms && progTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={programForm.programTypeId}
                onChange={(e) => setProgramForm({ ...programForm, programTypeId: e.target.value })}
              >
                <option value="">— None —</option>
                {progTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowProgramModal(false)}>Cancel</Button>
            <Button onClick={saveProgram} disabled={!programForm.name.trim() || !programForm.code.trim()}>
              {editingProgram ? "Save changes" : "Create program"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Edit subject                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={editSubjectModal.open}
        onClose={() => setEditSubjectModal({ open: false, subject: null })}
        title="Edit subject"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Subject name *</label>
            <Input
              placeholder="e.g. SQL Databases"
              value={editSubjectForm.name}
              onChange={(e) => setEditSubjectForm({ ...editSubjectForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Subject code <span className="text-gray-400">(leave blank to keep current)</span>
            </label>
            <Input
              placeholder={editSubjectModal.subject?.code || "e.g. SQLSUB"}
              value={editSubjectForm.code}
              onChange={(e) => setEditSubjectForm({ ...editSubjectForm, code: e.target.value.toUpperCase() })}
            />
          </div>
          {editSubjectMsg && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" /> {editSubjectMsg}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditSubjectModal({ open: false, subject: null })}>Cancel</Button>
            <Button onClick={saveEditSubject} disabled={editSubjectSaving || !editSubjectForm.name.trim()}>
              {editSubjectSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Teacher approval request for deleting published subject      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={approvalModal.open}
        onClose={() => setApprovalModal({ open: false, subjectId: "", subjectName: "" })}
        title="Request deletion approval"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900 mb-1">Program is published</p>
            <p className="text-sm text-amber-800">
              The subject <strong>{approvalModal.subjectName}</strong> belongs to a published program. Only the
              Principal / Administrator can approve deletion of subjects from a live program.
            </p>
          </div>
          <p className="text-sm text-gray-700">
            Click <strong>Send Request</strong> to notify the Principal. They will review and delete the subject if approved.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setApprovalModal({ open: false, subjectId: "", subjectName: "" })}>Cancel</Button>
            <Button onClick={sendApprovalRequest} disabled={approvalSending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {approvalSending ? "Sending…" : "Send Request to Principal"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Add / link subject                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title="Add Subject"
      >
        <div className="space-y-5">
          {/* Existing subjects (already linked to this program) */}
          {allProgramSubjects.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Existing subjects for this program
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-2">
                {allProgramSubjects.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-white border border-gray-100 text-sm text-gray-800"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-medium text-gray-500 mr-1">{s.code}:</span>
                    {s.name}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                These subjects are already linked. To add chapters, expand the subject in the curriculum view above.
              </p>
            </div>
          )}

          {/* Create new subject */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {allProgramSubjects.length > 0 ? "Or create a new subject" : "Create subject"}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subject name *</label>
                <Input
                  placeholder="e.g. SQL Databases"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Subject code <span className="text-gray-400">(optional — auto-generated if blank)</span>
                </label>
                <Input
                  placeholder="e.g. SQLSUB"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>

          {subjectMsg && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" /> {subjectMsg}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowSubjectModal(false)}>Cancel</Button>
            <Button onClick={createSubject} disabled={subjectSaving || !subjectForm.name.trim()}>
              {subjectSaving ? "Creating…" : "Create subject"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Chapter settings                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={chapterModal.open}
        onClose={() => setChapterModal({ open: false, subjectId: "", editing: null })}
        title={chapterModal.editing ? "Chapter settings" : "Add chapter"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Chapter title *
            </label>
            <Input
              placeholder="e.g. Introduction to SQL"
              value={chapterForm.title}
              onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Chapter settings</p>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={chapterForm.isMandatory}
                onChange={(e) => setChapterForm({ ...chapterForm, isMandatory: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">Mandatory chapter</span>
                <p className="text-xs text-gray-500">Students must complete this chapter. An alert is shown until done.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={chapterForm.isPrerequisite}
                onChange={(e) => setChapterForm({ ...chapterForm, isPrerequisite: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">Make this a prerequisite</span>
                <p className="text-xs text-gray-500">Must be completed before progressing to later chapters.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={chapterForm.freePreviewLesson}
                onChange={(e) => setChapterForm({ ...chapterForm, freePreviewLesson: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">Free preview chapter</span>
                <p className="text-xs text-gray-500">Allow non-enrolled students to preview this chapter.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={chapterForm.enableDiscussions}
                onChange={(e) => setChapterForm({ ...chapterForm, enableDiscussions: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">Enable discussions</span>
                <p className="text-xs text-gray-500">Allow students to post questions or comments for this chapter.</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setChapterModal({ open: false, subjectId: "", editing: null })}>
              Cancel
            </Button>
            <Button onClick={saveChapter} disabled={contentSaving || !chapterForm.title.trim()}>
              {contentSaving ? "Saving…" : chapterModal.editing ? "Save settings" : "Add chapter"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Full lesson editor                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <LessonEditorModal
        isOpen={lessonModal.open}
        onClose={() => setLessonModal({ open: false, chapterId: "", editing: null })}
        chapterId={lessonModal.chapterId}
        chapter={
          lessonModal.chapterId
            ? (linkedSubjects
                .flatMap((s) => s.programChapters)
                .find((c) => c.id === lessonModal.chapterId) ?? null)
            : null
        }
        editing={lessonModal.editing}
        apiPrefix={apiPrefix}
        onSaved={() => {
          if (selectedProgram) loadSubjectsAndTree(selectedProgram.id);
        }}
      />
    </div>
  );
}
