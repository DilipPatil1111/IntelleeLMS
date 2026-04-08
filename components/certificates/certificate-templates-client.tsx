"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { blobFileUrl } from "@/lib/blob-url";
import {
  Plus, FileText, Trash2, Edit, Eye, Send, CheckCircle2, Users, X,
  Image as ImageIcon, FileUp, Loader2, Palette,
} from "lucide-react";

const PAGE_SIZE = 8;

interface CertField {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  align: "left" | "center" | "right";
  maxWidth?: number;
}

const DEFAULT_FIELDS: CertField[] = [
  { key: "INSTITUTION_LOGO", label: "Institution Logo", x: 43, y: 5, fontSize: 12, fontWeight: "normal", color: "#000000", align: "center", maxWidth: 14 },
  { key: "INSTITUTION_NAME", label: "Institution Name", x: 20, y: 15, fontSize: 22, fontWeight: "bold", color: "#1e1b4b", align: "center", maxWidth: 60 },
  { key: "CUSTOM_TEXT", label: "Certificate Title", x: 15, y: 25, fontSize: 28, fontWeight: "bold", color: "#312e81", align: "center", maxWidth: 70 },
  { key: "STUDENT_NAME", label: "Student Name", x: 15, y: 40, fontSize: 24, fontWeight: "bold", color: "#111827", align: "center", maxWidth: 70 },
  { key: "PROGRAM_NAME", label: "Program Name", x: 15, y: 50, fontSize: 16, fontWeight: "normal", color: "#374151", align: "center", maxWidth: 70 },
  { key: "COMPLETION_DATE", label: "Date", x: 15, y: 60, fontSize: 14, fontWeight: "normal", color: "#6b7280", align: "center", maxWidth: 70 },
  { key: "CERTIFICATE_NUMBER", label: "Certificate Number", x: 5, y: 90, fontSize: 10, fontWeight: "normal", color: "#9ca3af", align: "left", maxWidth: 30 },
  { key: "PRINCIPAL_NAME", label: "Principal Name", x: 60, y: 78, fontSize: 14, fontWeight: "bold", color: "#111827", align: "center", maxWidth: 30 },
  { key: "PRINCIPAL_SIGNATURE", label: "Principal Signature", x: 62, y: 70, fontSize: 12, fontWeight: "normal", color: "#000000", align: "center", maxWidth: 25 },
];

const FIELD_KEYS = [
  { value: "STUDENT_NAME", label: "Student Name" },
  { value: "PROGRAM_NAME", label: "Program Name" },
  { value: "CERTIFICATE_NUMBER", label: "Certificate Number" },
  { value: "COMPLETION_DATE", label: "Completion Date" },
  { value: "PRINCIPAL_NAME", label: "Principal Name" },
  { value: "PRINCIPAL_SIGNATURE", label: "Principal Signature (image)" },
  { value: "INSTITUTION_NAME", label: "Institution Name" },
  { value: "INSTITUTION_LOGO", label: "Institution Logo (image)" },
  { value: "CUSTOM_TEXT", label: "Custom Text" },
];

const SAMPLE_DATA: Record<string, string> = {
  STUDENT_NAME: "John Smith",
  PROGRAM_NAME: "Business Administration",
  CERTIFICATE_NUMBER: "INT001",
  COMPLETION_DATE: "April 6, 2026",
  PRINCIPAL_NAME: "Dr. Principal",
  INSTITUTION_NAME: "Intellee College",
  CUSTOM_TEXT: "Certificate of Completion",
};

interface Template {
  id: string;
  name: string;
  description: string | null;
  backgroundUrl: string | null;
  backgroundFileName: string | null;
  orientation: string;
  pageSize: string;
  fieldsJson: string;
  isActive: boolean;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
  _count: { certificatesIssued: number };
}

interface Recipient {
  userId: string;
  name: string;
  email: string;
  enrollmentNo?: string;
}

interface Program {
  id: string;
  name: string;
}

interface Props {
  apiPrefix: string;
  programsApiUrl: string;
}

export function CertificateTemplatesClient({ apiPrefix, programsApiUrl }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [editModal, setEditModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    backgroundUrl: "",
    backgroundFileName: "",
    orientation: "LANDSCAPE",
    pageSize: "A4",
    fields: DEFAULT_FIELDS as CertField[],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [sendModal, setSendModal] = useState<Template | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [recipientType, setRecipientType] = useState("students");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [completionDate, setCompletionDate] = useState("");
  const [customText, setCustomText] = useState("Certificate of Completion");
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{ userId: string; ok: boolean; certNumber?: string; error?: string }[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewingTemplateId, setPreviewingTemplateId] = useState<string | null>(null);

  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaConfigured, setCanvaConfigured] = useState(false);

  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetch("/api/canva/status")
      .then((r) => r.json())
      .then((data) => {
        setCanvaConfigured(!!data.configured);
        setCanvaConnected(!!data.connected);
      })
      .catch(() => {});
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPrefix);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("[certificate-templates] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [apiPrefix]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  function openCreate() {
    setEditId(null);
    setForm({ name: "", description: "", backgroundUrl: "", backgroundFileName: "", orientation: "LANDSCAPE", pageSize: "A4", fields: [...DEFAULT_FIELDS] });
    setEditModal(true);
  }

  function openEdit(t: Template) {
    setEditId(t.id);
    let fields: CertField[];
    try { fields = JSON.parse(t.fieldsJson); } catch { fields = [...DEFAULT_FIELDS]; }
    setForm({ name: t.name, description: t.description || "", backgroundUrl: t.backgroundUrl || "", backgroundFileName: t.backgroundFileName || "", orientation: t.orientation, pageSize: t.pageSize, fields });
    setEditModal(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = { name: form.name, description: form.description, backgroundUrl: form.backgroundUrl, backgroundFileName: form.backgroundFileName, orientation: form.orientation, pageSize: form.pageSize, fieldsJson: JSON.stringify(form.fields) };
    const url = editId ? `${apiPrefix}/${editId}` : apiPrefix;
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setToast({ message: editId ? "Template updated" : "Template created", tone: "success" });
      setEditModal(false);
      void loadTemplates();
    } else {
      const err = await res.json().catch(() => ({}));
      setToast({ message: (err as { error?: string }).error || "Save failed", tone: "error" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? Certificates already issued will remain.")) return;
    const res = await fetch(`${apiPrefix}/${id}`, { method: "DELETE" });
    if (res.ok) {
      setToast({ message: "Template deleted", tone: "success" });
      void loadTemplates();
    }
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${apiPrefix}/upload`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.url) {
      setForm((f) => ({ ...f, backgroundUrl: data.url, backgroundFileName: data.fileName || file.name }));
      setToast({ message: `${file.name} uploaded as background`, tone: "success" });
    } else {
      setToast({ message: data.error || "Upload failed", tone: "error" });
    }
    setUploading(false);
  }

  // Send flow
  async function openSend(t: Template) {
    setSendModal(t);
    setSendResults(null);
    setSelectedRecipients(new Set());
    setCompletionDate("");
    setCustomText("Certificate of Completion");
    setRecipientType("students");
    setSelectedProgramId("");
    const pRes = await fetch(programsApiUrl);
    const pData = await pRes.json();
    setPrograms(pData.programs || []);
  }

  useEffect(() => {
    if (!sendModal) return;
    const params = new URLSearchParams();
    if (selectedProgramId) params.set("programId", selectedProgramId);
    params.set("type", recipientType);
    fetch(`${apiPrefix}/generate?${params}`)
      .then((r) => r.json())
      .then((d) => setRecipients(d.recipients || []))
      .catch(() => setRecipients([]));
  }, [sendModal, selectedProgramId, recipientType, apiPrefix]);

  function toggleRecipient(userId: string) {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  // Preview modal state
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  async function handlePreviewFromCard(templateId: string) {
    setPreviewingTemplateId(templateId);
    try {
      const res = await fetch(`${apiPrefix}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewPdfUrl(url);
      } else {
        const errData = await res.json().catch(() => ({ error: "Server error" }));
        setToast({ message: `Preview failed: ${(errData as {error?:string}).error || res.statusText}`, tone: "error" });
      }
    } catch (e) {
      setToast({ message: `Preview failed: ${e instanceof Error ? e.message : "unknown error"}`, tone: "error" });
    }
    setPreviewingTemplateId(null);
  }

  async function handlePreview(recipientUserId?: string) {
    if (!sendModal) return;
    setPreviewing(true);
    try {
      const res = await fetch(`${apiPrefix}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: sendModal.id,
          recipientUserId: recipientUserId || recipients[0]?.userId,
          programId: selectedProgramId || undefined,
          completionDate: completionDate || undefined,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        setPreviewPdfUrl(URL.createObjectURL(blob));
      } else {
        const errData = await res.json().catch(() => ({ error: "Server error" }));
        setToast({ message: `Preview failed: ${(errData as {error?:string}).error || res.statusText}`, tone: "error" });
      }
    } catch (e) {
      setToast({ message: `Preview failed: ${e instanceof Error ? e.message : "unknown error"}`, tone: "error" });
    }
    setPreviewing(false);
  }

  async function handleSend() {
    if (!sendModal || selectedRecipients.size === 0) return;
    setSending(true);
    const res = await fetch(`${apiPrefix}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: sendModal.id,
        recipientUserIds: Array.from(selectedRecipients),
        programId: selectedProgramId || undefined,
        completionDate: completionDate || undefined,
        customText,
      }),
    });
    const data = await res.json();
    setSendResults(data.results || []);
    const okCount = (data.results || []).filter((r: { ok: boolean }) => r.ok).length;
    setToast({ message: `${okCount} certificate(s) sent successfully`, tone: "success" });
    void loadTemplates();
    setSending(false);
  }

  function updateField(idx: number, key: string, value: string | number) {
    setForm((f) => {
      const fields = [...f.fields];
      fields[idx] = { ...fields[idx], [key]: value };
      return { ...f, fields };
    });
  }

  function addField() {
    setForm((f) => ({
      ...f,
      fields: [...f.fields, { key: "CUSTOM_TEXT", label: "Custom Text", x: 50, y: 50, fontSize: 14, fontWeight: "normal" as const, color: "#000000", align: "center" as const, maxWidth: 50 }],
    }));
  }

  function removeField(idx: number) {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
  }

  const isPdf = form.backgroundFileName?.toLowerCase().endsWith(".pdf") || form.backgroundUrl?.toLowerCase().endsWith(".pdf");
  const paged = templates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {toast && (
        <div className={cn(
          "fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg",
          toast.tone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800",
        )}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Certificate Templates</h3>
          <p className="text-sm text-gray-500">Design templates, preview with student data, and send personalized PDF certificates.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Template</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent><div className="h-32 animate-pulse bg-gray-100 rounded" /></CardContent></Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No certificate templates yet</p>
              <p className="text-sm text-gray-400 mb-4">Upload a PDF or image as background, position fields, and generate personalized certificates.</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4" /> Create Template</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map((t) => {
              let cardFields: CertField[];
              try { cardFields = JSON.parse(t.fieldsJson); } catch { cardFields = []; }
              const cardIsPdf = t.backgroundUrl?.toLowerCase().endsWith(".pdf");

              return (
                <Card key={t.id} className="relative group overflow-hidden">
                  {/* Visual template preview on card */}
                  <div
                    className="relative bg-white border-b border-gray-200 overflow-hidden"
                    style={{ aspectRatio: t.orientation === "LANDSCAPE" ? "1.414/1" : "1/1.414", maxHeight: 200 }}
                  >
                    {t.backgroundUrl && !cardIsPdf && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={blobFileUrl(t.backgroundUrl, undefined, true)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {t.backgroundUrl && cardIsPdf && (
                      <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-red-300" />
                      </div>
                    )}
                    {!t.backgroundUrl && (
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50" />
                    )}

                    {/* Overlay field labels */}
                    {cardFields.map((field, idx) => {
                      const isImgField = field.key === "PRINCIPAL_SIGNATURE" || field.key === "INSTITUTION_LOGO";
                      const sampleVal = SAMPLE_DATA[field.key] || field.label;
                      return (
                        <div
                          key={idx}
                          className="absolute pointer-events-none"
                          style={{
                            left: `${field.x}%`,
                            top: `${field.y}%`,
                            maxWidth: field.maxWidth ? `${field.maxWidth}%` : "80%",
                          }}
                        >
                          {isImgField ? (
                            <div className="bg-gray-200/50 border border-dashed border-gray-400 rounded px-1 text-[7px] text-gray-500">
                              [{field.label}]
                            </div>
                          ) : (
                            <span
                              style={{
                                fontSize: `clamp(5px, ${field.fontSize * 0.35}px, 14px)`,
                                color: field.color,
                                fontWeight: field.fontWeight,
                                textShadow: "0 0 2px rgba(255,255,255,0.9)",
                              }}
                              className="whitespace-nowrap leading-tight"
                            >
                              {sampleVal}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <Badge variant={t.isActive ? "success" : "secondary"}>
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{t.orientation} &middot; {t.pageSize}</span>
                      <span>&middot;</span>
                      <span>{t._count.certificatesIssued} issued</span>
                      {cardIsPdf && <Badge variant="default" className="text-[10px] px-1.5 py-0">PDF</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handlePreviewFromCard(t.id)}
                        disabled={previewingTemplateId === t.id}
                      >
                        {previewingTemplateId === t.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Eye className="h-3.5 w-3.5" />
                        }
                        Preview PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(t)}><Edit className="h-3.5 w-3.5" /> Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => void openSend(t)}><Send className="h-3.5 w-3.5" /> Send</Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => void handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} totalPages={Math.ceil(templates.length / PAGE_SIZE)} onPageChange={setPage} className="mt-4" />
        </>
      )}

      {/* Create/Edit Template Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={editId ? "Edit Template" : "New Certificate Template"} className="max-w-5xl">
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Template name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            <Textarea label="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="min-h-[40px]" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Select label="Orientation" value={form.orientation} onChange={(e) => setForm((f) => ({ ...f, orientation: e.target.value }))}
              options={[{ value: "LANDSCAPE", label: "Landscape" }, { value: "PORTRAIT", label: "Portrait" }]} />
            <Select label="Page size" value={form.pageSize} onChange={(e) => setForm((f) => ({ ...f, pageSize: e.target.value }))}
              options={[{ value: "A4", label: "A4" }, { value: "LETTER", label: "Letter" }]} />

            {/* Background upload */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Background (PDF or Image)</p>
              {form.backgroundUrl ? (
                <div className="flex items-center gap-2 mb-2 p-2 bg-green-50 rounded border border-green-200">
                  {isPdf ? <FileText className="h-5 w-5 text-red-500 shrink-0" /> : <ImageIcon className="h-5 w-5 text-indigo-500 shrink-0" />}
                  <span className="text-xs text-gray-700 truncate flex-1">{form.backgroundFileName || "Uploaded"}</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, backgroundUrl: "", backgroundFileName: "" }))} className="text-red-500 text-xs font-medium shrink-0">Remove</button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <label className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  uploading ? "border-gray-200 bg-gray-50" : "border-indigo-300 bg-indigo-50 hover:bg-indigo-100",
                )}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <FileUp className="h-4 w-4 text-indigo-600" />}
                  <span className="text-sm text-indigo-700 font-medium">{uploading ? "Uploading..." : "Upload PDF / Image"}</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" disabled={uploading}
                    onChange={(e) => { if (e.target.files?.[0]) void handleUploadFile(e.target.files[0]); e.target.value = ""; }} />
                </label>
              </div>
              {canvaConfigured && canvaConnected && (
                <button
                  type="button"
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 transition-colors"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/canva/create-design", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: form.name || "Certificate Background",
                          width: form.orientation === "LANDSCAPE" ? 2480 : 1754,
                          height: form.orientation === "LANDSCAPE" ? 1754 : 2480,
                        }),
                      });
                      const data = await res.json();
                      if (data.editUrl) {
                        window.open(data.editUrl, "_blank");
                        setToast({ message: "Canva opened — design your background, then export it from the Canva Studio tab", tone: "success" });
                      } else {
                        setToast({ message: data.error || "Failed to open Canva", tone: "error" });
                      }
                    } catch {
                      setToast({ message: "Failed to open Canva", tone: "error" });
                    }
                  }}
                >
                  <Palette className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-purple-700 font-medium">Design in Canva</span>
                </button>
              )}
              <p className="text-xs text-gray-400 mt-1">Or paste a URL:</p>
              <Input value={form.backgroundUrl} onChange={(e) => setForm((f) => ({ ...f, backgroundUrl: e.target.value }))} placeholder="https://..." />
            </div>
          </div>

          {/* Live certificate preview */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Live preview (sample data)</p>
            <div
              className="relative border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white"
              style={{ aspectRatio: form.orientation === "LANDSCAPE" ? "1.414/1" : "1/1.414" }}
            >
              {/* Background layer */}
              {form.backgroundUrl && !isPdf && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={blobFileUrl(form.backgroundUrl, undefined, true)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              {form.backgroundUrl && isPdf && (
                <iframe src={`${blobFileUrl(form.backgroundUrl, undefined, true)}#toolbar=0&navpanes=0&scrollbar=0`} className="absolute inset-0 w-full h-full border-0" title="PDF background" />
              )}
              {!form.backgroundUrl && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                  <p className="text-sm text-gray-400">No background — upload a PDF or image above</p>
                </div>
              )}

              {/* Field overlay layer */}
              {form.fields.map((field, idx) => {
                const value = SAMPLE_DATA[field.key] || field.label;
                const isImgField = field.key === "PRINCIPAL_SIGNATURE" || field.key === "INSTITUTION_LOGO";

                return (
                  <div
                    key={idx}
                    className="absolute"
                    style={{
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      maxWidth: field.maxWidth ? `${field.maxWidth}%` : "80%",
                    }}
                  >
                    {isImgField ? (
                      <div className="bg-gray-200/70 border border-dashed border-gray-400 rounded px-2 py-1 text-xs text-gray-500 backdrop-blur-sm">
                        [{field.label}]
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: `clamp(7px, ${field.fontSize * 0.55}px, 24px)`,
                          color: field.color,
                          fontWeight: field.fontWeight,
                          textAlign: field.align,
                          textShadow: "0 0 3px rgba(255,255,255,0.8)",
                        }}
                        className="whitespace-nowrap"
                      >
                        {value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Field layout editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Fields on certificate</p>
              <Button variant="outline" size="sm" onClick={addField}><Plus className="h-3 w-3" /> Add field</Button>
            </div>
            <div className="space-y-2">
              {form.fields.map((field, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2 bg-gray-50">
                  <div className="w-40">
                    <Select value={field.key} onChange={(e) => {
                      const fk = FIELD_KEYS.find((f) => f.value === e.target.value);
                      updateField(idx, "key", e.target.value);
                      if (fk) updateField(idx, "label", fk.label);
                    }} options={FIELD_KEYS.map((f) => ({ value: f.value, label: f.label }))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">X</span>
                    <Input className="w-14" type="number" value={field.x} onChange={(e) => updateField(idx, "x", Number(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Y</span>
                    <Input className="w-14" type="number" value={field.y} onChange={(e) => updateField(idx, "y", Number(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Sz</span>
                    <Input className="w-14" type="number" value={field.fontSize} onChange={(e) => updateField(idx, "fontSize", Number(e.target.value))} />
                  </div>
                  <Select value={field.fontWeight} onChange={(e) => updateField(idx, "fontWeight", e.target.value)}
                    options={[{ value: "normal", label: "Normal" }, { value: "bold", label: "Bold" }]} />
                  <input type="color" value={field.color} onChange={(e) => updateField(idx, "color", e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
                  <Select value={field.align} onChange={(e) => updateField(idx, "align", e.target.value)}
                    options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">W%</span>
                    <Input className="w-14" type="number" value={field.maxWidth ?? ""} onChange={(e) => updateField(idx, "maxWidth", Number(e.target.value))} />
                  </div>
                  <button type="button" onClick={() => removeField(idx)} className="p-1 text-red-400 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">X and Y are percentages (0–100) from the top-left corner. W% is maximum width. Changes are reflected in the preview above in real time.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setEditModal(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} isLoading={saving}>{editId ? "Update Template" : "Create Template"}</Button>
        </div>
      </Modal>

      {/* Send Certificates Modal */}
      <Modal isOpen={!!sendModal} onClose={() => setSendModal(null)} title={`Send Certificates — ${sendModal?.name ?? ""}`} className="max-w-3xl">
        {sendModal && !sendResults && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Program" value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}
                options={programs.map((p) => ({ value: p.id, label: p.name }))} placeholder="All programs" />
              <Select label="Recipient type" value={recipientType} onChange={(e) => setRecipientType(e.target.value)}
                options={[{ value: "students", label: "Students" }, { value: "teachers", label: "Teachers" }]} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Completion date" type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} />
              <Input label="Certificate title" value={customText} onChange={(e) => setCustomText(e.target.value)} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700"><Users className="h-4 w-4 inline mr-1" /> Recipients ({recipients.length})</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedRecipients(new Set(recipients.map((r) => r.userId)))} className="text-xs text-indigo-600">Select all</button>
                  <button type="button" onClick={() => setSelectedRecipients(new Set())} className="text-xs text-gray-500">Deselect all</button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {recipients.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-6">No recipients found for the selected filters.</p>
                ) : (
                  recipients.map((r) => (
                    <label key={r.userId} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedRecipients.has(r.userId)} onChange={() => toggleRecipient(r.userId)} className="rounded border-gray-300 text-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                        <p className="text-xs text-gray-500 truncate">{r.email}{r.enrollmentNo ? ` — ${r.enrollmentNo}` : ""}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); void handlePreview(r.userId); }} disabled={previewing}>
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {sendResults && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Results</p>
            <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
              {sendResults.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  {r.ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                  <span className="text-sm font-medium">{r.certNumber ?? "—"}</span>
                  {r.error && <span className="text-xs text-red-500">{r.error}</span>}
                  {r.ok && <span className="text-xs text-green-600">Sent</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setSendModal(null)}>{sendResults ? "Close" : "Cancel"}</Button>
          {!sendResults && (
            <Button onClick={() => void handleSend()} isLoading={sending} disabled={selectedRecipients.size === 0}>
              <Send className="h-4 w-4" /> Send to {selectedRecipients.size} recipient(s)
            </Button>
          )}
        </div>
      </Modal>

      {/* PDF Preview Modal */}
      <Modal isOpen={!!previewPdfUrl} onClose={() => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); }} title="Certificate Preview" className="max-w-5xl">
        {previewPdfUrl && (
          <div className="w-full" style={{ height: "75vh" }}>
            <iframe src={previewPdfUrl} className="w-full h-full border rounded-lg" title="Certificate Preview" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          {previewPdfUrl && (
            <a href={previewPdfUrl} download="certificate-preview.pdf" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              <FileUp className="h-4 w-4" /> Download PDF
            </a>
          )}
          <Button variant="outline" onClick={() => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); }}>Close</Button>
        </div>
      </Modal>
    </>
  );
}
