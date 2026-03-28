"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Institution = {
  id: number;
  minAttendancePercent: number;
  minAverageMarksPercent: number;
  minFeePaidPercent: number;
  pendingFeesAlertAmount: number | null;
  certificateTemplateUrl: string | null;
  certificateTemplateFileName: string | null;
  transcriptTemplateUrl: string | null;
  transcriptTemplateFileName: string | null;
};

type ProgramRow = {
  id: string;
  name: string;
  code: string;
  minAttendancePercent: number | null;
  minAverageMarksPercent: number | null;
  minFeePaidPercent: number | null;
};

export default function PrincipalSettingsPage() {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"certificate" | "transcript" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/principal/settings");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.institution) {
      setInstitution(data.institution);
      setPrograms(data.programs || []);
      setMessage(null);
    } else {
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Could not load settings." });
    }
    setLoading(false);
  }

  async function save(instOverride?: Institution) {
    const inst = instOverride ?? institution;
    if (!inst) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/principal/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution: {
          minAttendancePercent: inst.minAttendancePercent,
          minAverageMarksPercent: inst.minAverageMarksPercent,
          minFeePaidPercent: inst.minFeePaidPercent,
          pendingFeesAlertAmount: inst.pendingFeesAlertAmount,
          certificateTemplateUrl: inst.certificateTemplateUrl,
          certificateTemplateFileName: inst.certificateTemplateFileName,
          transcriptTemplateUrl: inst.transcriptTemplateUrl,
          transcriptTemplateFileName: inst.transcriptTemplateFileName,
        },
        programs: programs.map((p) => ({
          id: p.id,
          minAttendancePercent: p.minAttendancePercent,
          minAverageMarksPercent: p.minAverageMarksPercent,
          minFeePaidPercent: p.minFeePaidPercent,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Save failed." });
      return;
    }
    setMessage({ tone: "success", text: "Settings saved." });
    void load();
  }

  function updateProgram(id: string, patch: Partial<ProgramRow>) {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function uploadTemplate(kind: "certificate" | "transcript", file: File) {
    const inst = institution;
    if (!inst) return;
    setUploading(kind);
    setMessage(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch("/api/principal/settings/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(null);
    if (!res.ok) {
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Upload failed." });
      return;
    }
    const url = (data as { url?: string }).url;
    const fileName = (data as { fileName?: string }).fileName;
    if (!url) return;
    const next: Institution = {
      ...inst,
      ...(kind === "certificate"
        ? { certificateTemplateUrl: url, certificateTemplateFileName: fileName ?? null }
        : { transcriptTemplateUrl: url, transcriptTemplateFileName: fileName ?? null }),
    };
    setInstitution(next);
    await save(next);
  }

  async function clearTemplate(kind: "certificate" | "transcript") {
    const inst = institution;
    if (!inst) return;
    const next: Institution = {
      ...inst,
      ...(kind === "certificate"
        ? { certificateTemplateUrl: null, certificateTemplateFileName: null }
        : { transcriptTemplateUrl: null, transcriptTemplateFileName: null }),
    };
    setInstitution(next);
    await save(next);
  }

  if (loading && !institution) {
    return (
      <>
        <PageHeader title="Settings" description="Compliance thresholds and fee alerts" />
        <p className="text-sm text-gray-500">Loading…</p>
      </>
    );
  }

  if (!institution) {
    return (
      <>
        <PageHeader title="Settings" description="Compliance thresholds and fee alerts" />
        <p className="text-sm text-red-600">{message?.text ?? "Unable to load settings."}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Compliance thresholds, certificate and transcript templates (graduation emails), and per-program overrides. When a student is set to Graduated, the certificate template is attached to their congratulations email if uploaded below."
      />

      {message && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            message.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Institution defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <p className="text-sm text-gray-600">
            These defaults apply when a program does not set its own override. Compliance checks (e.g. reports) can
            compare student attendance %, average assessment score %, and fees paid vs. total due against these
            thresholds.
          </p>
          <Input
            label="Minimum attendance % (required)"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={institution.minAttendancePercent}
            onChange={(e) =>
              setInstitution({ ...institution, minAttendancePercent: Number(e.target.value) || 0 })
            }
          />
          <Input
            label="Minimum average marks % (quizzes, tests, assignments, projects)"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={institution.minAverageMarksPercent}
            onChange={(e) =>
              setInstitution({ ...institution, minAverageMarksPercent: Number(e.target.value) || 0 })
            }
          />
          <Input
            label="Minimum fee paid % (of total program fees assigned — good standing)"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={institution.minFeePaidPercent}
            onChange={(e) =>
              setInstitution({ ...institution, minFeePaidPercent: Number(e.target.value) || 0 })
            }
          />
          <Input
            label="Pending fees alert (optional — amount)"
            type="number"
            min={0}
            step={1}
            value={institution.pendingFeesAlertAmount ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setInstitution({
                ...institution,
                pendingFeesAlertAmount: v === "" ? null : Number(v),
              });
            }}
            placeholder="e.g. 2000"
          />
          <p className="text-xs text-gray-500">
            Leave pending fees empty to only use percentage-based rules. Student-wise fee % paid and pending balances
            come from fee structures and payments on each student&apos;s profile.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Certificate &amp; transcript templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 max-w-xl">
          <p className="text-sm text-gray-600">
            Upload a <strong>certificate</strong> file (PDF or Word). It is attached automatically when a principal sets a
            student&apos;s status to <strong>Graduated</strong> (after all academic and compliance requirements are
            met). The <strong>transcript</strong> template is stored for official records and future transcript
            generation (same formats: PDF, DOC, DOCX).
          </p>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Graduation certificate template</label>
            {institution.certificateTemplateUrl ? (
              <p className="text-sm text-gray-600">
                Current:{" "}
                <a
                  href={institution.certificateTemplateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {institution.certificateTemplateFileName || "certificate file"}
                </a>
              </p>
            ) : (
              <p className="text-sm text-gray-500">No file uploaded.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                disabled={uploading === "certificate" || saving}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadTemplate("certificate", f);
                }}
                className="text-sm text-gray-700"
              />
              {institution.certificateTemplateUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || uploading !== null}
                  onClick={() => void clearTemplate("certificate")}
                >
                  Remove
                </Button>
              ) : null}
              {uploading === "certificate" ? <span className="text-xs text-gray-500">Uploading…</span> : null}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Transcript template</label>
            {institution.transcriptTemplateUrl ? (
              <p className="text-sm text-gray-600">
                Current:{" "}
                <a
                  href={institution.transcriptTemplateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {institution.transcriptTemplateFileName || "transcript template"}
                </a>
              </p>
            ) : (
              <p className="text-sm text-gray-500">No file uploaded.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                disabled={uploading === "transcript" || saving}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadTemplate("transcript", f);
                }}
                className="text-sm text-gray-700"
              />
              {institution.transcriptTemplateUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || uploading !== null}
                  onClick={() => void clearTemplate("transcript")}
                >
                  Remove
                </Button>
              ) : null}
              {uploading === "transcript" ? <span className="text-xs text-gray-500">Uploading…</span> : null}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Files are stored under <code className="rounded bg-gray-100 px-1">public/uploads/templates</code>. Serverless
            hosts may need persistent storage; re-upload after deploy if the file disappears.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Program overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Leave a field empty to use the institution default for that metric. Values are stored per program.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Program</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Min attendance %</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Min avg marks %</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Min fee paid %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {programs.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {p.name} <span className="text-gray-500">({p.code})</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        placeholder="default"
                        value={p.minAttendancePercent ?? ""}
                        onChange={(e) =>
                          updateProgram(p.id, {
                            minAttendancePercent: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        placeholder="default"
                        value={p.minAverageMarksPercent ?? ""}
                        onChange={(e) =>
                          updateProgram(p.id, {
                            minAverageMarksPercent: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        placeholder="default"
                        value={p.minFeePaidPercent ?? ""}
                        onChange={(e) =>
                          updateProgram(p.id, {
                            minFeePaidPercent: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void save()} isLoading={saving}>
        Save settings
      </Button>
    </>
  );
}
