"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PortalAccessSettings } from "@/components/settings/portal-access-settings";
import { blobFileUrl } from "@/lib/blob-url";
import { MyProfileClient } from "@/components/profile/my-profile-client";

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
  studentContractSampleUrl: string | null;
  studentContractSampleFileName: string | null;
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
  const [uploading, setUploading] = useState<"certificate" | "transcript" | "studentContract" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Email signature state
  const [sigImageUrl, setSigImageUrl] = useState<string | null>(null);
  const [sigTypedName, setSigTypedName] = useState("");
  const [sigUploading, setSigUploading] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigMessage, setSigMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const sigFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/principal/settings");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.institution) {
      setInstitution(data.institution);
      setPrograms(data.programs || []);
    } else {
      setMessage({ tone: "error", text: (data as { error?: string }).error || "Could not load settings." });
    }
    setLoading(false);
  }, []);

  const loadSignature = useCallback(async () => {
    const res = await fetch("/api/principal/settings/signature");
    if (!res.ok) return;
    const data = await res.json().catch(() => ({})) as { signatureImageUrl?: string | null; signatureTypedName?: string | null };
    setSigImageUrl(data.signatureImageUrl ?? null);
    setSigTypedName(data.signatureTypedName ?? "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadSignature();
  }, [load, loadSignature]);

  async function save(instOverride?: Institution, successMessage = "Settings saved.") {
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
          studentContractSampleUrl: inst.studentContractSampleUrl,
          studentContractSampleFileName: inst.studentContractSampleFileName,
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
    setMessage({ tone: "success", text: successMessage });
    void load();
  }

  function updateProgram(id: string, patch: Partial<ProgramRow>) {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function uploadTemplate(kind: "certificate" | "transcript" | "studentContract", file: File) {
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
      setMessage({
        tone: "error",
        text: (data as { error?: string }).error || "File was not uploaded. Check the file type and size, or server storage.",
      });
      return;
    }
    const url = (data as { url?: string }).url;
    const fileName = (data as { fileName?: string }).fileName;
    if (!url) {
      setMessage({
        tone: "error",
        text: "Upload response did not include a file URL. Nothing was saved.",
      });
      return;
    }
    const next: Institution = {
      ...inst,
      ...(kind === "certificate"
        ? { certificateTemplateUrl: url, certificateTemplateFileName: fileName ?? null }
        : kind === "transcript"
          ? { transcriptTemplateUrl: url, transcriptTemplateFileName: fileName ?? null }
          : { studentContractSampleUrl: url, studentContractSampleFileName: fileName ?? null }),
    };
    setInstitution(next);
    const label =
      kind === "certificate"
        ? "Graduation certificate template uploaded and saved successfully."
        : kind === "transcript"
          ? "Transcript template uploaded and saved successfully."
          : "Sample student agreement uploaded and saved successfully.";
    await save(next, label);
  }

  async function clearTemplate(kind: "certificate" | "transcript" | "studentContract") {
    const inst = institution;
    if (!inst) return;
    const next: Institution = {
      ...inst,
      ...(kind === "certificate"
        ? { certificateTemplateUrl: null, certificateTemplateFileName: null }
        : kind === "transcript"
          ? { transcriptTemplateUrl: null, transcriptTemplateFileName: null }
          : { studentContractSampleUrl: null, studentContractSampleFileName: null }),
    };
    setInstitution(next);
    await save(next, "File removed from settings.");
  }

  async function uploadSignatureImage(file: File) {
    setSigUploading(true);
    setSigMessage(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/principal/settings/signature/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
    setSigUploading(false);
    if (!res.ok || !data.url) {
      setSigMessage({ tone: "error", text: data.error || "Upload failed." });
      return;
    }
    setSigImageUrl(data.url);
    setSigMessage({ tone: "success", text: "Signature image uploaded." });
  }

  async function saveSignatureText() {
    setSigSaving(true);
    setSigMessage(null);
    const res = await fetch("/api/principal/settings/signature", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureTypedName: sigTypedName }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    setSigSaving(false);
    setSigMessage(res.ok && data.ok ? { tone: "success", text: "Signature name saved." } : { tone: "error", text: data.error || "Save failed." });
  }

  async function removeSignatureImage() {
    setSigSaving(true);
    setSigMessage(null);
    const res = await fetch("/api/principal/settings/signature", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureImageUrl: null }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
    setSigSaving(false);
    if (res.ok && data.ok) {
      setSigImageUrl(null);
      setSigMessage({ tone: "success", text: "Signature image removed." });
    } else {
      setSigMessage({ tone: "error", text: data.error || "Remove failed." });
    }
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

      {/* ── My Profile ── inline at top of Settings ──────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>
            View and update your name, contact details, profile photo, and password. This is your personal account as
            principal or administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <MyProfileClient embedded />
        </CardContent>
      </Card>

      <div className="my-8 border-t border-gray-200" />

      <PortalAccessSettings />

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
          <CardTitle>Sample student agreement (onboarding)</CardTitle>
        </CardHeader>
        <CardContent className="max-w-xl space-y-4">
          <p className="text-sm text-gray-600">
            Upload a <strong>PDF or Word</strong> file that students download in <strong>Onboarding → Step 1</strong> before they upload their signed copy. If empty, a program-specific link may still be used when enrollment sets one.
          </p>
          {institution.studentContractSampleUrl ? (
            <p className="text-sm text-gray-600">
              Current:{" "}
              <a
                href={institution.studentContractSampleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {institution.studentContractSampleFileName || "Sample agreement"}
              </a>
            </p>
          ) : (
            <p className="text-sm text-gray-500">No sample agreement uploaded.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              disabled={uploading === "studentContract" || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadTemplate("studentContract", f);
              }}
              className="text-sm text-gray-700"
            />
            {institution.studentContractSampleUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || uploading !== null}
                onClick={() => void clearTemplate("studentContract")}
              >
                Remove
              </Button>
            ) : null}
            {uploading === "studentContract" ? <span className="text-xs text-gray-500">Uploading…</span> : null}
          </div>
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
                disabled={uploading !== null || saving}
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
                disabled={uploading !== null || saving}
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

      {/* ── Email Signature ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Email Signature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-gray-600">
            Your signature is automatically appended to every email you send from the portal (announcements,
            welcome emails, inspection reports, etc.). Upload an image of your handwritten signature
            <strong> or </strong> type your name to use as a stylised cursive signature.
          </p>

          {sigMessage && (
            <div className={`rounded-md px-4 py-2 text-sm ${sigMessage.tone === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {sigMessage.text}
            </div>
          )}

          {/* Signature image */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Signature image (png / jpg / svg recommended)</p>
            {sigImageUrl ? (
              <div className="flex items-center gap-4">
                <img
                  src={blobFileUrl(sigImageUrl, "signature", true)}
                  alt="Your signature"
                  className="max-h-16 max-w-48 rounded border border-gray-200 bg-white p-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void removeSignatureImage()}
                  isLoading={sigSaving}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No signature image uploaded.</p>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={sigFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadSignatureImage(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                isLoading={sigUploading}
                onClick={() => sigFileRef.current?.click()}
              >
                {sigImageUrl ? "Replace image" : "Upload signature image"}
              </Button>
            </div>
          </div>

          {/* Typed name signature */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Typed name signature{" "}
              <span className="font-normal text-gray-500">(used only when no image is uploaded)</span>
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="e.g. Dr. Jane Smith"
                value={sigTypedName}
                onChange={(e) => setSigTypedName(e.target.value)}
                className="max-w-xs"
              />
              <Button size="sm" onClick={() => void saveSignatureText()} isLoading={sigSaving}>
                Save name
              </Button>
            </div>
            {sigTypedName.trim() && (
              <p className="text-sm text-gray-500">
                Preview:{" "}
                <span style={{ fontFamily: "'Brush Script MT','Segoe Script','Comic Sans MS',cursive", fontSize: "1.3em" }}>
                  {sigTypedName}
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grade Bands */}
      <GradeBandsManager />

      <Button onClick={() => void save()} isLoading={saving}>
        Save settings
      </Button>
    </>
  );
}

// ─── Grade Bands Manager ─────────────────────────────────────────────

type GradeBandRow = { id: string; label: string; minPercent: number; maxPercent: number; gradePoint: number | null; sortOrder: number };
type BandForm = { label: string; minPercent: string; maxPercent: string; gradePoint: string; sortOrder: string };

const DEFAULT_BANDS: BandForm[] = [
  { label: "A+", minPercent: "95", maxPercent: "100", gradePoint: "4.0", sortOrder: "0" },
  { label: "A",  minPercent: "87", maxPercent: "94",  gradePoint: "4.0", sortOrder: "1" },
  { label: "A-", minPercent: "80", maxPercent: "86",  gradePoint: "3.7", sortOrder: "2" },
  { label: "B+", minPercent: "77", maxPercent: "79",  gradePoint: "3.3", sortOrder: "3" },
  { label: "B",  minPercent: "73", maxPercent: "76",  gradePoint: "3.0", sortOrder: "4" },
  { label: "B-", minPercent: "70", maxPercent: "72",  gradePoint: "2.7", sortOrder: "5" },
  { label: "C+", minPercent: "67", maxPercent: "69",  gradePoint: "2.3", sortOrder: "6" },
  { label: "C",  minPercent: "63", maxPercent: "66",  gradePoint: "2.0", sortOrder: "7" },
  { label: "C-", minPercent: "60", maxPercent: "62",  gradePoint: "1.7", sortOrder: "8" },
  { label: "D+", minPercent: "57", maxPercent: "59",  gradePoint: "1.3", sortOrder: "9" },
  { label: "D",  minPercent: "53", maxPercent: "56",  gradePoint: "1.0", sortOrder: "10" },
  { label: "D-", minPercent: "50", maxPercent: "52",  gradePoint: "0.7", sortOrder: "11" },
  { label: "F",  minPercent: "0",  maxPercent: "49",  gradePoint: "0.0", sortOrder: "12" },
  { label: "WD", minPercent: "0",  maxPercent: "0",   gradePoint: "",    sortOrder: "13" },
];

function GradeBandsManager() {
  const [bands, setBands] = useState<GradeBandRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState<BandForm>({ label: "", minPercent: "", maxPercent: "", gradePoint: "", sortOrder: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BandForm>({ label: "", minPercent: "", maxPercent: "", gradePoint: "", sortOrder: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const loadBands = useCallback(async () => {
    const res = await fetch("/api/principal/grade-bands");
    const d = await res.json();
    setBands(d.bands || []);
  }, []);

  useEffect(() => { void loadBands(); }, [loadBands]);

  async function handleAdd() {
    setSaving(true);
    const res = await fetch("/api/principal/grade-bands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: addForm.label, minPercent: parseFloat(addForm.minPercent), maxPercent: parseFloat(addForm.maxPercent), gradePoint: addForm.gradePoint ? parseFloat(addForm.gradePoint) : null, sortOrder: parseInt(addForm.sortOrder || "0", 10) }),
    });
    setSaving(false);
    if (res.ok) { setAddForm({ label: "", minPercent: "", maxPercent: "", gradePoint: "", sortOrder: "" }); void loadBands(); setMsg({ tone: "success", text: "Grade band added" }); }
    else { setMsg({ tone: "error", text: "Failed to add" }); }
  }

  async function handleSeedDefaults() {
    setSaving(true);
    for (const b of DEFAULT_BANDS) {
      await fetch("/api/principal/grade-bands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: b.label, minPercent: parseFloat(b.minPercent), maxPercent: parseFloat(b.maxPercent), gradePoint: b.gradePoint ? parseFloat(b.gradePoint) : null, sortOrder: parseInt(b.sortOrder, 10) }) });
    }
    setSaving(false);
    void loadBands();
    setMsg({ tone: "success", text: "Default grade bands loaded" });
  }

  async function handleUpdate() {
    if (!editId) return;
    setSaving(true);
    const res = await fetch(`/api/principal/grade-bands/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editForm.label, minPercent: parseFloat(editForm.minPercent), maxPercent: parseFloat(editForm.maxPercent), gradePoint: editForm.gradePoint ? parseFloat(editForm.gradePoint) : null, sortOrder: parseInt(editForm.sortOrder || "0", 10) }),
    });
    setSaving(false);
    if (res.ok) { setEditId(null); void loadBands(); setMsg({ tone: "success", text: "Updated" }); }
    else setMsg({ tone: "error", text: "Failed to update" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this grade band?")) return;
    await fetch(`/api/principal/grade-bands/${id}`, { method: "DELETE" });
    void loadBands();
    setMsg({ tone: "success", text: "Deleted" });
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Grade Bands</CardTitle>
        <CardDescription>Configure grade labels, percentage ranges, and grade points used in transcripts.</CardDescription>
      </CardHeader>
      <CardContent>
        {msg && <div className={`mb-3 rounded-lg px-4 py-2 text-sm ${msg.tone === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

        {bands.length === 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>No grade bands configured.</span>
            <Button size="sm" variant="outline" onClick={() => void handleSeedDefaults()} isLoading={saving}>Load Defaults</Button>
          </div>
        )}

        {/* Existing bands table */}
        {bands.length > 0 && (
          <div className="overflow-x-auto mb-5">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Label</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Min %</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Max %</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Grade Point</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Sort</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {bands.map((b) => (
                  <tr key={b.id}>
                    {editId === b.id ? (
                      <>
                        <td className="px-2 py-1"><input value={editForm.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} className="w-16 rounded border border-gray-300 px-2 py-1 text-xs" /></td>
                        <td className="px-2 py-1"><input value={editForm.minPercent} onChange={(e) => setEditForm((f) => ({ ...f, minPercent: e.target.value }))} type="number" className="w-16 rounded border border-gray-300 px-2 py-1 text-xs" /></td>
                        <td className="px-2 py-1"><input value={editForm.maxPercent} onChange={(e) => setEditForm((f) => ({ ...f, maxPercent: e.target.value }))} type="number" className="w-16 rounded border border-gray-300 px-2 py-1 text-xs" /></td>
                        <td className="px-2 py-1"><input value={editForm.gradePoint} onChange={(e) => setEditForm((f) => ({ ...f, gradePoint: e.target.value }))} type="number" step="0.1" className="w-16 rounded border border-gray-300 px-2 py-1 text-xs" /></td>
                        <td className="px-2 py-1"><input value={editForm.sortOrder} onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))} type="number" className="w-12 rounded border border-gray-300 px-2 py-1 text-xs" /></td>
                        <td className="px-2 py-1 text-right flex gap-1 justify-end">
                          <Button size="sm" onClick={() => void handleUpdate()} isLoading={saving}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-bold text-indigo-700">{b.label}</td>
                        <td className="px-3 py-2">{b.minPercent}</td>
                        <td className="px-3 py-2">{b.maxPercent}</td>
                        <td className="px-3 py-2">{b.gradePoint ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-400">{b.sortOrder}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setEditId(b.id); setEditForm({ label: b.label, minPercent: String(b.minPercent), maxPercent: String(b.maxPercent), gradePoint: b.gradePoint != null ? String(b.gradePoint) : "", sortOrder: String(b.sortOrder) }); }} className="p-1 text-amber-600 hover:bg-amber-50 rounded text-xs">Edit</button>
                            <button onClick={() => void handleDelete(b.id)} className="p-1 text-red-500 hover:bg-red-50 rounded text-xs">Del</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add new band */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-800 list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span> Add Grade Band
          </summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-3">
            <Input label="Label" value={addForm.label} onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))} placeholder="A+" />
            <Input label="Min %" type="number" value={addForm.minPercent} onChange={(e) => setAddForm((f) => ({ ...f, minPercent: e.target.value }))} placeholder="87" />
            <Input label="Max %" type="number" value={addForm.maxPercent} onChange={(e) => setAddForm((f) => ({ ...f, maxPercent: e.target.value }))} placeholder="94" />
            <Input label="Grade Pt" type="number" step="0.1" value={addForm.gradePoint} onChange={(e) => setAddForm((f) => ({ ...f, gradePoint: e.target.value }))} placeholder="4.0" />
            <Input label="Sort" type="number" value={addForm.sortOrder} onChange={(e) => setAddForm((f) => ({ ...f, sortOrder: e.target.value }))} placeholder="0" />
            <div className="flex items-end"><Button onClick={() => void handleAdd()} isLoading={saving} disabled={!addForm.label}>Add</Button></div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}