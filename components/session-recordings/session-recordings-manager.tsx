"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { Video, Trash2, Upload, Calendar, Clock } from "lucide-react";
import { blobFileUrl } from "@/lib/blob-url";

interface Recording {
  id: string;
  title: string;
  sessionDate: string;
  videoUrl: string;
  fileName: string | null;
  durationMin: number | null;
  uploadedBy: { firstName: string; lastName: string };
}

interface Program {
  id: string;
  name: string;
}

const PAGE_SIZE = 10;

export function SessionRecordingsManager({
  apiPrefix,
  loadPrograms,
}: {
  apiPrefix: string;
  loadPrograms: () => Promise<Program[]>;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadPrograms().then((p) => {
      setPrograms(p);
      if (p.length > 0) setSelectedProgramId(p[0].id);
      setLoading(false);
    });
  }, [loadPrograms]);

  const loadRecordings = useCallback(async () => {
    if (!selectedProgramId) return;
    const res = await fetch(`${apiPrefix}?programId=${selectedProgramId}`);
    if (res.ok) {
      const data = await res.json();
      setRecordings(data.recordings || []);
    }
  }, [apiPrefix, selectedProgramId]);

  /* eslint-disable react-hooks/set-state-in-effect -- data fetch on program change */
  useEffect(() => {
    if (selectedProgramId) {
      loadRecordings();
      setPage(1);
    }
  }, [selectedProgramId, loadRecordings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleUpload() {
    if (!file || !title.trim() || !sessionDate || !selectedProgramId) return;
    setUploading(true);
    setBanner(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim());
    fd.append("sessionDate", sessionDate);
    fd.append("programId", selectedProgramId);
    if (durationMin) fd.append("durationMin", durationMin);

    const res = await fetch(apiPrefix, { method: "POST", body: fd });
    setUploading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setBanner({ tone: "error", text: (data as { error?: string }).error || "Upload failed" });
      return;
    }

    setBanner({ tone: "success", text: "Recording uploaded successfully" });
    setTitle("");
    setSessionDate("");
    setDurationMin("");
    setFile(null);
    await loadRecordings();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setBanner(null);
    const res = await fetch(`${apiPrefix}/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (res.ok) {
      setBanner({ tone: "success", text: "Recording deleted" });
      await loadRecordings();
    } else {
      setBanner({ tone: "error", text: "Could not delete recording" });
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  const paged = recordings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-indigo-600" />
            Session Recordings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {programs.length > 1 && (
            <Select
              label="Program"
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              options={programs.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}

          {banner && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${banner.tone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {banner.text}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Upload a new recording</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 — Introduction to Algebra" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Date</label>
                <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes, optional)</label>
                <input type="number" min="1" value={durationMin} onChange={(e) => setDurationMin(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="e.g. 45" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video File (MP4, MOV, WebM — max 200 MB)</label>
                <input type="file" accept=".mp4,.mov,.webm,.avi,.mkv" onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </div>
            </div>
            <Button onClick={() => void handleUpload()} isLoading={uploading} disabled={!file || !title.trim() || !sessionDate}>
              <Upload className="h-4 w-4" /> Upload Recording
            </Button>
          </div>
        </CardContent>
      </Card>

      {recordings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recordings ({recordings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {paged.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{rec.title}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(rec.sessionDate).toLocaleDateString()}
                      {rec.durationMin && <><Clock className="h-3 w-3 ml-1" /> {rec.durationMin} min</>}
                      <span>· {rec.uploadedBy.firstName} {rec.uploadedBy.lastName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={blobFileUrl(rec.videoUrl, rec.fileName ?? rec.title, true)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">View</Button>
                    </a>
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={deleting === rec.id}
                      onClick={() => void handleDelete(rec.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={Math.ceil(recordings.length / PAGE_SIZE)} onPageChange={setPage} totalItems={recordings.length} itemLabel="recordings" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
