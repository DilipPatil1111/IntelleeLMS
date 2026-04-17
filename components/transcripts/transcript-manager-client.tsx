"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";
import { TranscriptFormModal } from "./transcript-form-modal";
import { TranscriptPreviewModal } from "./transcript-preview-modal";
import { Plus, Edit2, Trash2, Eye, Send, Download, CheckSquare, Square } from "lucide-react";

type TranscriptRow = {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  overallAvgPct: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  standing: string | null;
  credential: string | null;
  student: { firstName: string; lastName: string; studentProfile: { enrollmentNo: string | null } | null };
  program: { name: string };
  batch: { name: string } | null;
  _count: { subjects: number };
};

interface Props {
  apiPrefix: string;
  studentsUrl: string;
  programsUrl: string;
}

export function TranscriptManagerClient({ apiPrefix, studentsUrl, programsUrl }: Props) {
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const { toasts, toast, dismiss } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/transcripts`, { cache: "no-store" });
      const d = await res.json();
      setTranscripts(d.transcripts || []);
    } catch { toast("Failed to load transcripts", "error"); }
    finally { setLoading(false); }
  }, [apiPrefix, toast]);

  useEffect(() => { void load(); }, [load]);

  const drafts = transcripts.filter((t) => t.status === "DRAFT");
  const published = transcripts.filter((t) => t.status === "PUBLISHED");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllDrafts() {
    if (selected.size === drafts.length) setSelected(new Set());
    else setSelected(new Set(drafts.map((t) => t.id)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transcript?")) return;
    await fetch(`${apiPrefix}/transcripts/${id}`, { method: "DELETE" });
    toast("Transcript deleted", "success");
    void load();
  }

  async function publishOne(id: string) {
    const res = await fetch(`${apiPrefix}/transcripts/${id}/publish`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast(d.error || "Failed to publish", "error");
      return false;
    }
    return true;
  }

  async function handlePublishSelected() {
    if (selected.size === 0) { toast("Select at least one transcript", "error"); return; }
    setPublishing(true);
    let ok = 0;
    for (const id of selected) {
      if (await publishOne(id)) ok++;
    }
    toast(`Published ${ok} transcript(s)`, "success");
    setSelected(new Set());
    void load();
    setPublishing(false);
  }

  function handleDownloadPdf(id: string) {
    window.open(`${apiPrefix}/transcripts/${id}/pdf`, "_blank");
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Transcripts"
        description="Generate, manage and publish student academic transcripts"
        actions={
          <Button onClick={() => { setEditId(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Transcript
          </Button>
        }
      />

      {/* Draft transcripts */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Draft Transcripts
            <Badge variant="warning">{drafts.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {drafts.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={selectAllDrafts}>
                  {selected.size === drafts.length ? <CheckSquare className="h-4 w-4 mr-1" /> : <Square className="h-4 w-4 mr-1" />}
                  {selected.size === drafts.length ? "Deselect All" : "Select All"}
                </Button>
                <Button size="sm" onClick={() => void handlePublishSelected()} disabled={selected.size === 0 || publishing} isLoading={publishing}>
                  <Send className="h-4 w-4 mr-1" /> Publish Selected ({selected.size})
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-gray-400 py-6">Loading…</p>
          ) : drafts.length === 0 ? (
            <p className="text-center text-gray-400 py-6">No draft transcripts. Click "New Transcript" to create one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8 px-3 py-2"></th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Program</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Batch</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Subjects</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Avg %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Standing</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Updated</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {drafts.map((t) => (
                    <tr key={t.id} className={selected.has(t.id) ? "bg-indigo-50" : undefined}>
                      <td className="px-3 py-2">
                        <button onClick={() => toggleSelect(t.id)} className="text-indigo-600">
                          {selected.has(t.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-2 font-medium">
                        {t.student.firstName} {t.student.lastName}
                        {t.student.studentProfile?.enrollmentNo && (
                          <span className="text-gray-400 text-xs ml-1">({t.student.studentProfile.enrollmentNo})</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{t.program.name}</td>
                      <td className="px-4 py-2 text-gray-500">{t.batch?.name || "—"}</td>
                      <td className="px-4 py-2 text-center">{t._count.subjects}</td>
                      <td className="px-4 py-2 font-medium">{t.overallAvgPct != null ? `${t.overallAvgPct}%` : "—"}</td>
                      <td className="px-4 py-2 text-gray-500">{t.standing || "—"}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(t.updatedAt)}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setPreviewId(t.id)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Preview"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => { setEditId(t.id); setShowForm(true); }} className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDownloadPdf(t.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Download PDF"><Download className="h-4 w-4" /></button>
                          <button onClick={() => void handleDelete(t.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Published transcripts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Published Transcripts
            <Badge variant="success">{published.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {published.length === 0 ? (
            <p className="text-center text-gray-400 py-6">No published transcripts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Program</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Batch</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Avg %</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Standing</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Credential</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Published</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {published.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2 font-medium">
                        {t.student.firstName} {t.student.lastName}
                        {t.student.studentProfile?.enrollmentNo && (
                          <span className="text-gray-400 text-xs ml-1">({t.student.studentProfile.enrollmentNo})</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{t.program.name}</td>
                      <td className="px-4 py-2 text-gray-500">{t.batch?.name || "—"}</td>
                      <td className="px-4 py-2 font-medium text-emerald-700">{t.overallAvgPct != null ? `${t.overallAvgPct}%` : "—"}</td>
                      <td className="px-4 py-2 text-gray-500">{t.standing || "—"}</td>
                      <td className="px-4 py-2 text-gray-500">{t.credential || "Not Awarded"}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{t.publishedAt ? fmtDate(t.publishedAt) : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleDownloadPdf(t.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <TranscriptFormModal
          apiPrefix={apiPrefix}
          studentsUrl={studentsUrl}
          programsUrl={programsUrl}
          editId={editId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); toast("Transcript saved", "success"); }}
        />
      )}

      {previewId && (
        <TranscriptPreviewModal
          apiPrefix={apiPrefix}
          transcriptId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </>
  );
}
