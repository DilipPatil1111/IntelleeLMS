"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FileViewer } from "@/components/document-vault/file-viewer";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Upload,
  Trash2,
  Pencil,
  Copy,
  Send,
  FileText,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;
  scope: "GENERIC" | "YEAR_SPECIFIC" | "BATCH_SPECIFIC";
  yearId: string | null;
  programId: string | null;
  batchId: string | null;
  isAutoPopulated: boolean;
  autoPopulateKey: string | null;
  sortOrder: number;
  createdAt: string;
}

interface DocFile {
  id: string;
  folderId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  contentType: string;
  studentId: string | null;
  createdAt: string;
}

interface AutoFile {
  studentName: string;
  fileName: string;
  fileUrl: string | null;
  contentType: string;
  fileSize: number;
  status: "uploaded" | "pending";
}

interface InspectionNote {
  id: string;
  folderId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface SelectOption {
  id: string;
  name: string;
}

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTree(folders: DocFolder[]): Map<string | null, DocFolder[]> {
  const map = new Map<string | null, DocFolder[]>();
  for (const f of folders) {
    const key = f.parentId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  Array.from(map.values()).forEach((arr) => {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  });
  return map;
}

function getBreadcrumb(folders: DocFolder[], folderId: string): DocFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: DocFolder[] = [];
  let current: DocFolder | undefined = byId.get(folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

async function readJsonOrError<T>(
  res: Response,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const text = await res.text();
  let parsed: unknown = {};
  if (text.trim()) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return {
        ok: false,
        error: res.statusText || `Invalid response (${res.status})`,
      };
    }
  }
  if (!res.ok) {
    const err = (parsed as { error?: string }).error;
    return { ok: false, error: err || `Request failed (${res.status})` };
  }
  return { ok: true, data: parsed as T };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function TreeSkeleton() {
  return (
    <div className="space-y-2 p-4 animate-pulse">
      {[100, 130, 80, 150, 110, 90, 140, 120].map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-gray-200" />
          <div className="h-4 rounded bg-gray-200" style={{ width: `${w}px` }} />
        </div>
      ))}
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      <div className="h-5 w-48 rounded bg-gray-200" />
      <div className="flex gap-2">
        <div className="h-9 w-28 rounded bg-gray-200" />
        <div className="h-9 w-32 rounded bg-gray-200" />
      </div>
      {[160, 200, 140, 180].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-gray-200" />
          <div className="h-4 rounded bg-gray-200" style={{ width: `${w}px` }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all",
        toast.variant === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      )}
    >
      {toast.variant === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      {toast.message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DocumentVaultPage() {
  // Selector state
  const [years, setYears] = useState<SelectOption[]>([]);
  const [programs, setPrograms] = useState<SelectOption[]>([]);
  const [batches, setBatches] = useState<SelectOption[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");

  // Folder state
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Content state for selected folder
  const [files, setFiles] = useState<DocFile[]>([]);
  const [autoFiles, setAutoFiles] = useState<AutoFile[]>([]);
  const [notes, setNotes] = useState<InspectionNote[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  // Inline editing state
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameFileValue, setRenameFileValue] = useState("");

  // Note form
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Modals
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [copyTargetId, setCopyTargetId] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [emailPreview, setEmailPreview] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // File viewer
  const [viewerFile, setViewerFile] = useState<{
    fileUrl: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  } | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  // New subfolder
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Load dropdown options on mount
  // -------------------------------------------------------------------------

  const loadOptions = useCallback(async () => {
    const [yRes, pRes, bRes] = await Promise.all([
      fetch("/api/principal/academic-years").then((r) => r.json()),
      fetch("/api/principal/programs").then((r) => r.json()),
      fetch("/api/principal/batches").then((r) => r.json()),
    ]);
     
    setYears(yRes.academicYears || yRes.years || []);
     
    setPrograms(pRes.programs || []);
     
    setBatches(bRes.batches || []);
  }, []);

  useEffect(() => {
     
    void loadOptions();
  }, [loadOptions]);

  // -------------------------------------------------------------------------
  // Seed & load folders when all three selectors are set
  // -------------------------------------------------------------------------

  const loadFolders = useCallback(async () => {
    if (!selectedYear || !selectedProgram || !selectedBatch) return;
    setFoldersLoading(true);
    try {
      const seedRes = await fetch("/api/principal/document-vault/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearId: selectedYear,
          programId: selectedProgram,
          batchId: selectedBatch,
        }),
      });
      const seedOut = await readJsonOrError<{ error?: string }>(seedRes);
      if (!seedOut.ok) {
        setToast({ message: seedOut.error, variant: "error" });
        setFolders([]);
        setSelectedFolderId(null);
        return;
      }

      const res = await fetch(
        `/api/principal/document-vault/folders?yearId=${selectedYear}&programId=${selectedProgram}&batchId=${selectedBatch}`,
      );
      const out = await readJsonOrError<{ folders?: DocFolder[] }>(res);
      if (!out.ok) {
        setToast({ message: out.error, variant: "error" });
        setFolders([]);
      } else {
        setFolders(out.data.folders || []);
      }
      setSelectedFolderId(null);
    } finally {
      setFoldersLoading(false);
    }
  }, [selectedYear, selectedProgram, selectedBatch]);

  useEffect(() => {
     
    void loadFolders();
  }, [loadFolders]);

  // -------------------------------------------------------------------------
  // Load content for selected folder
  // -------------------------------------------------------------------------

  const loadFolderContent = useCallback(async () => {
    if (!selectedFolderId) return;
    setContentLoading(true);
    try {
      const folder = folders.find((f) => f.id === selectedFolderId);
      const [filesHttp, notesHttp] = await Promise.all([
        fetch(`/api/principal/document-vault/folders/${selectedFolderId}/files`),
        fetch(`/api/principal/document-vault/folders/${selectedFolderId}/notes`),
      ]);
      const filesOut = await readJsonOrError<{ files?: DocFile[] }>(filesHttp);
      const notesOut = await readJsonOrError<{ notes?: InspectionNote[] }>(notesHttp);
      if (!filesOut.ok || !notesOut.ok) {
        const message = !filesOut.ok
          ? filesOut.error
          : !notesOut.ok
            ? notesOut.error
            : "Request failed";
        setToast({
          message,
          variant: "error",
        });
        setFiles([]);
        setNotes([]);
        setAutoFiles([]);
        return;
      }
      setFiles(filesOut.data.files || []);
      setNotes(notesOut.data.notes || []);
      if (folder?.isAutoPopulated) {
        const autoHttp = await fetch(
          `/api/principal/document-vault/folders/${selectedFolderId}/auto-files`,
        );
        const autoOut = await readJsonOrError<{ autoFiles?: AutoFile[] }>(autoHttp);
        if (!autoOut.ok) {
          setToast({ message: autoOut.error, variant: "error" });
          setAutoFiles([]);
        } else {
          setAutoFiles(autoOut.data.autoFiles || []);
        }
      } else {
        setAutoFiles([]);
      }
    } finally {
      setContentLoading(false);
    }
  }, [selectedFolderId, folders]);

  useEffect(() => {
     
    void loadFolderContent();
  }, [loadFolderContent]);

  // -------------------------------------------------------------------------
  // Folder actions
  // -------------------------------------------------------------------------

  const tree = buildTree(folders);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const breadcrumb = selectedFolderId ? getBreadcrumb(folders, selectedFolderId) : [];

  function toggleExpand(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRenameFolder(id: string) {
    if (!renameValue.trim()) {
      setRenamingFolderId(null);
      return;
    }
    await fetch(`/api/principal/document-vault/folders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingFolderId(null);
    loadFolders();
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Delete this folder and all its contents?")) return;
    const res = await fetch(`/api/principal/document-vault/folders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setToast({ message: err.error || "Cannot delete folder", variant: "error" });
      return;
    }
    if (selectedFolderId === id) setSelectedFolderId(null);
    loadFolders();
  }

  async function handleCreateSubfolder(parentId: string | null) {
    const name = parentId ? newSubfolderName.trim() : prompt("Folder name:");
    if (!name) {
      setCreatingSubfolder(false);
      setNewSubfolderName("");
      return;
    }
    await fetch("/api/principal/document-vault/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parentId,
        yearId: selectedYear,
        programId: selectedProgram,
        batchId: selectedBatch,
      }),
    });
    setCreatingSubfolder(false);
    setNewSubfolderName("");
    loadFolders();
  }

  function openCopyModal(folderId: string) {
    setCopySourceId(folderId);
    setCopyTargetId("");
    setShowCopyModal(true);
  }

  async function handleCopyStructure() {
    if (!copySourceId) return;
    await fetch(`/api/principal/document-vault/folders/${copySourceId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetParentId: copyTargetId || null }),
    });
    setShowCopyModal(false);
    setToast({ message: "Folder structure copied", variant: "success" });
    loadFolders();
  }

  async function handleCreateRootFolder() {
    const name = prompt("New root folder name:");
    if (!name?.trim()) return;
    await fetch("/api/principal/document-vault/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        parentId: null,
        yearId: selectedYear,
        programId: selectedProgram,
        batchId: selectedBatch,
      }),
    });
    loadFolders();
  }

  // -------------------------------------------------------------------------
  // File actions
  // -------------------------------------------------------------------------

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedFolderId || !e.target.files?.length) return;
    const formData = new FormData();
    for (const file of Array.from(e.target.files)) {
      formData.append("files", file);
    }
    const res = await fetch(`/api/principal/document-vault/folders/${selectedFolderId}/files`, {
      method: "POST",
      body: formData,
    });
    e.target.value = "";
    if (res.ok) {
      const count = Array.from(e.target.files || []).length;
      setToast({
        message: count > 1 ? `Upload successful — ${count} files uploaded` : "Upload successful",
        variant: "success",
      });
      loadFolderContent();
    } else {
      const err = await res.json().catch(() => ({}));
      setToast({ message: err.error || "Upload failed", variant: "error" });
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("Delete this file?")) return;
    const res = await fetch(`/api/principal/document-vault/files/${fileId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setToast({ message: err.error || "Cannot delete file", variant: "error" });
      return;
    }
    loadFolderContent();
  }

  async function handleRenameFile(fileId: string) {
    if (!renameFileValue.trim()) {
      setRenamingFileId(null);
      return;
    }
    await fetch(`/api/principal/document-vault/files/${fileId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: renameFileValue.trim() }),
    });
    setRenamingFileId(null);
    loadFolderContent();
  }

  // -------------------------------------------------------------------------
  // Note actions
  // -------------------------------------------------------------------------

  async function handleAddNote() {
    if (!selectedFolderId || !newNote.trim()) return;
    await fetch(`/api/principal/document-vault/folders/${selectedFolderId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote.trim() }),
    });
    setNewNote("");
    loadFolderContent();
  }

  async function handleEditNote(noteId: string) {
    if (!editNoteValue.trim()) {
      setEditingNoteId(null);
      return;
    }
    await fetch(`/api/principal/document-vault/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: editNoteValue.trim() }),
    });
    setEditingNoteId(null);
    loadFolderContent();
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/principal/document-vault/notes/${noteId}`, { method: "DELETE" });
    loadFolderContent();
  }

  // -------------------------------------------------------------------------
  // Inspection email
  // -------------------------------------------------------------------------

  async function openEmailModal() {
    if (!selectedFolderId) return;
    setShowEmailModal(true);
    setEmailSending(false);
    setEmailRecipients([]);
    setEmailPreview("");
    const tRes = await fetch("/api/principal/teachers").then((r) => r.json());
    setTeachers(
      (tRes.teachers || []).map((t: { id: string; firstName: string; lastName: string; email: string }) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
      }))
    );
    const allNotes = collectDescendantNotes(selectedFolderId);
    const yearName = years.find((y) => y.id === selectedYear)?.name ?? selectedYear;
    setEmailPreview(
      allNotes.length > 0
        ? allNotes
            .map((n) => {
              const path = getBreadcrumb(folders, n.folderId)
                .map((f) => f.name)
                .join(" > ");
              return `[${path}]\n${n.note}\n— ${formatDate(n.createdAt)}`;
            })
            .join("\n\n")
        : `No inspection notes found for the year ${yearName}.`
    );
  }

  function collectDescendantNotes(folderId: string): InspectionNote[] {
    const descendantIds = new Set<string>();
    function walk(id: string) {
      descendantIds.add(id);
      const children = tree.get(id) || [];
      for (const child of children) walk(child.id);
    }
    walk(folderId);
    return notes.filter((n) => descendantIds.has(n.folderId));
  }

  function toggleEmailRecipient(email: string) {
    setEmailRecipients((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  async function handleSendEmail() {
    if (!selectedFolderId || emailRecipients.length === 0) return;
    setEmailSending(true);
    try {
      const res = await fetch(
        `/api/principal/document-vault/folders/${selectedFolderId}/send-inspection-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipients: emailRecipients }),
        }
      );
      if (res.ok) {
        setToast({ message: "Inspection email sent", variant: "success" });
        setShowEmailModal(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ message: err.error || "Failed to send email", variant: "error" });
      }
    } finally {
      setEmailSending(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render folder tree item
  // -------------------------------------------------------------------------

  function renderTreeItem(folder: DocFolder, depth: number) {
    const children = tree.get(folder.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isRenaming = renamingFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 transition-colors",
            isSelected && "bg-indigo-50 text-indigo-900 font-medium"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button
            type="button"
            className="shrink-0 p-0.5 rounded hover:bg-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(folder.id);
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
              )
            ) : (
              <span className="inline-block h-3.5 w-3.5" />
            )}
          </button>

          {isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          )}

          {isRenaming ? (
            <input
              type="text"
              className="flex-1 min-w-0 rounded border border-indigo-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameFolder(folder.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameFolder(folder.id);
                if (e.key === "Escape") setRenamingFolderId(null);
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 min-w-0 truncate"
              onClick={() => {
                setSelectedFolderId(folder.id);
                if (hasChildren && !isExpanded) toggleExpand(folder.id);
              }}
              title={folder.name}
            >
              {folder.name}
            </span>
          )}

          {folder.isAutoPopulated && (
            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 leading-none">
              Auto
            </span>
          )}

          {/* Context actions */}
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              className="rounded p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingFolderId(folder.id);
                setRenameValue(folder.name);
              }}
            >
              <Pencil className="h-3 w-3" />
            </button>
            {!folder.isAutoPopulated && (
              <button
                type="button"
                className="rounded p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(folder.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              className="rounded p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              title="Copy structure"
              onClick={(e) => {
                e.stopPropagation();
                openCopyModal(folder.id);
              }}
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50"
              title="New subfolder"
              onClick={(e) => {
                e.stopPropagation();
                const name = prompt("Subfolder name:");
                if (name?.trim()) {
                  handleCreateSubfolder(folder.id);
                  setNewSubfolderName(name.trim());
                }
              }}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isExpanded &&
          children.map((child) => renderTreeItem(child, depth + 1))}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render right panel content
  // -------------------------------------------------------------------------

  function renderContent() {
    if (!selectedFolderId || !selectedFolder) {
      return (
        <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
          <div className="text-center space-y-2">
            <Folder className="h-12 w-12 mx-auto text-gray-300" />
            <p>Select a folder to view its contents</p>
          </div>
        </div>
      );
    }

    if (contentLoading) return <ContentSkeleton />;

    return (
      <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
          {breadcrumb.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                className={cn(
                  "hover:text-indigo-600 hover:underline",
                  f.id === selectedFolderId && "text-gray-900 font-medium"
                )}
                onClick={() => setSelectedFolderId(f.id)}
              >
                {f.name}
              </button>
            </span>
          ))}
        </nav>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          {creatingSubfolder ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Subfolder name"
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubfolder(selectedFolderId);
                  if (e.key === "Escape") {
                    setCreatingSubfolder(false);
                    setNewSubfolderName("");
                  }
                }}
                autoFocus
              />
              <Button size="sm" onClick={() => handleCreateSubfolder(selectedFolderId)}>
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCreatingSubfolder(false);
                  setNewSubfolderName("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreatingSubfolder(true)}
            >
              <Plus className="h-4 w-4" />
              New Subfolder
            </Button>
          )}
        </div>

        {/* Auto-populated files */}
        {selectedFolder.isAutoPopulated && autoFiles.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Auto-populated files
            </h3>
            <Card className="!p-0">
              <CardContent className="divide-y divide-gray-100">
                {autoFiles.map((af, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      af.status === "pending" && "opacity-60"
                    )}
                  >
                    {af.status === "uploaded" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {af.studentName} — {af.status === "uploaded" ? af.fileName : "Pending"}
                      </p>
                      {af.status === "uploaded" && (
                        <p className="text-xs text-gray-500">
                          {formatBytes(af.fileSize)}
                        </p>
                      )}
                    </div>
                    {af.status === "uploaded" && af.fileUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setViewerFile({
                            fileUrl: af.fileUrl!,
                            fileName: af.fileName,
                            contentType: af.contentType,
                            fileSize: af.fileSize,
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Manual files */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {selectedFolder.isAutoPopulated ? "Manually uploaded files" : "Files"}
            {files.length > 0 && (
              <span className="ml-1 text-gray-400 font-normal">({files.length})</span>
            )}
          </h3>
          {files.length === 0 ? (
            <p className="text-sm text-gray-400">No files uploaded yet.</p>
          ) : (
            <Card className="!p-0">
              <CardContent className="divide-y divide-gray-100">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      {renamingFileId === file.id ? (
                        <input
                          type="text"
                          className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={renameFileValue}
                          onChange={(e) => setRenameFileValue(e.target.value)}
                          onBlur={() => handleRenameFile(file.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameFile(file.id);
                            if (e.key === "Escape") setRenamingFileId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.fileName}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatBytes(file.fileSize)} · {formatDate(file.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setViewerFile({
                            fileUrl: file.fileUrl,
                            fileName: file.fileName,
                            contentType: file.contentType,
                            fileSize: file.fileSize,
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <button
                        type="button"
                        className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Rename"
                        onClick={() => {
                          setRenamingFileId(file.id);
                          setRenameFileValue(file.fileName);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        {/* Inspection notes */}
        <section>
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors mb-3"
            onClick={() => setNotesExpanded((p) => !p)}
          >
            {notesExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Inspection Notes
            {notes.length > 0 && (
              <Badge variant="default">{notes.length}</Badge>
            )}
          </button>

          {notesExpanded && (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-gray-200 p-3">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editNoteValue}
                        onChange={(e) => setEditNoteValue(e.target.value)}
                        className="!min-h-[60px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEditNote(note.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {note.note}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(note.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Edit"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditNoteValue(note.note);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add note form */}
              <div className="flex items-start gap-2">
                <Textarea
                  placeholder="Add an inspection note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="!min-h-[60px] flex-1"
                />
                <Button
                  size="sm"
                  disabled={!newNote.trim()}
                  onClick={handleAddNote}
                >
                  <Plus className="h-4 w-4" />
                  Add Note
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Send inspection email */}
        <div className="pt-2">
          <Button variant="outline" onClick={openEmailModal}>
            <Send className="h-4 w-4" />
            Send Inspection Email
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const rootFolders = tree.get(null) || [];
  const allSelected = selectedYear && selectedProgram && selectedBatch;

  return (
    <>
      <PageHeader
        title="Document Vault"
        actions={
          <div className="flex items-center gap-3">
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setFolders([]);
                setSelectedFolderId(null);
              }}
            >
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              value={selectedProgram}
              onChange={(e) => {
                setSelectedProgram(e.target.value);
                setFolders([]);
                setSelectedFolderId(null);
              }}
            >
              <option value="">Program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setFolders([]);
                setSelectedFolderId(null);
              }}
            >
              <option value="">Batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {!allSelected ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <Folder className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">
              Select a Year, Program, and Batch to view the document vault.
            </p>
            <p className="text-xs mt-1">
              The folder skeleton will be created automatically when all three are selected.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden" style={{ minHeight: "calc(100vh - 220px)" }}>
          {/* Left panel — folder tree */}
          <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/50">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Folders
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {foldersLoading ? (
                <TreeSkeleton />
              ) : rootFolders.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  No folders yet.
                </p>
              ) : (
                rootFolders.map((folder) => renderTreeItem(folder, 0))
              )}
            </div>
            {!foldersLoading && (
              <div className="px-3 py-3 border-t border-gray-200">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  onClick={handleCreateRootFolder}
                >
                  <Plus className="h-4 w-4" />
                  New Root Folder
                </button>
              </div>
            )}
          </div>

          {/* Right panel — folder content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
          </div>
        </div>
      )}

      {/* Copy structure modal */}
      <Modal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        title="Copy Folder Structure"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a target parent folder. The folder structure (folders only, no files) will be copied there.
          </p>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            value={copyTargetId}
            onChange={(e) => setCopyTargetId(e.target.value)}
          >
            <option value="">Root level (no parent)</option>
            {folders
              .filter((f) => f.id !== copySourceId)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {getBreadcrumb(folders, f.id)
                    .map((b) => b.name)
                    .join(" > ")}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCopyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopyStructure}>Copy</Button>
          </div>
        </div>
      </Modal>

      {/* Inspection email modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        title="Send Inspection Email"
        className="max-w-2xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Recipients</p>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2">
              {teachers.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={emailRecipients.includes(t.email)}
                    onChange={() => toggleEmailRecipient(t.email)}
                  />
                  {t.firstName} {t.lastName} ({t.email})
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
              <p className="font-medium mb-2">
                Subject: Inspection observations for the year{" "}
                {years.find((y) => y.id === selectedYear)?.name ?? ""}
              </p>
              <hr className="my-2 border-gray-200" />
              {emailPreview}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={emailRecipients.length === 0}
              isLoading={emailSending}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </Modal>

      {/* File viewer overlay */}
      {viewerFile && (
        <FileViewer
          fileUrl={viewerFile.fileUrl}
          fileName={viewerFile.fileName}
          contentType={viewerFile.contentType}
          fileSize={viewerFile.fileSize}
          onClose={() => setViewerFile(null)}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
