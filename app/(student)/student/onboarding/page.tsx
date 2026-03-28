"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Upload } from "lucide-react";
import Link from "next/link";

type Ob = {
  contractAcknowledgedAt: string | null;
  governmentIdsUploadedAt: string | null;
  feeProofUploadedAt: string | null;
  preAdmissionCompletedAt: string | null;
  principalConfirmedAt: string | null;
  contractDocumentUrl: string | null;
  signedContractUploadUrl: string | null;
  signedContractFileName: string | null;
  governmentIdUploadUrl: string | null;
  governmentIdFileName: string | null;
  feeProofUploadUrl: string | null;
  feeProofFileName: string | null;
};

const FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.bmp,.gif,.webp,.tif,.tiff,.heic,application/pdf,image/png,image/jpeg,image/bmp,image/gif,image/webp";

export default function StudentOnboardingPage() {
  const [onboarding, setOnboarding] = useState<Ob | null>(null);
  const [sampleContractUrl, setSampleContractUrl] = useState<string | null>(null);
  const [sampleContractLabel, setSampleContractLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<{ step: string; tone: "success" | "error"; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/student/onboarding");
    const data = await res.json();
    setOnboarding(data.onboarding || null);
    setSampleContractUrl(data.sampleContractUrl || null);
    setSampleContractLabel(data.sampleContractFileName || null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function uploadStep(step: "contract" | "ids" | "fee", file: File) {
    setBusy(step);
    setUploadNote(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("step", step);
    const res = await fetch("/api/student/onboarding/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setUploadNote({
        step,
        tone: "error",
        text: (data as { error?: string }).error || "Could not upload file.",
      });
      return;
    }
    setUploadNote({
      step,
      tone: "success",
      text: (data as { message?: string }).message || "File uploaded successfully.",
    });
    await load();
  }

  async function markPreAdmission() {
    setBusy("preAdmission");
    await fetch("/api/student/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "preAdmission" }),
    });
    await load();
    setBusy(null);
  }

  if (loading) {
    return <p className="text-gray-500">Loading…</p>;
  }

  if (!onboarding) {
    return (
      <>
        <PageHeader title="Onboarding" description="Complete your enrollment checklist" />
        <Card>
          <CardContent className="py-8 text-center text-gray-600">
            No onboarding checklist is assigned yet. After you are enrolled in a program, return here to complete contracts, ID upload, fees, and pre-admission steps.
          </CardContent>
        </Card>
      </>
    );
  }

  function stepComplete(key: "contract" | "ids" | "fee" | "preAdmission"): boolean {
    if (!onboarding) return false;
    switch (key) {
      case "contract":
        return !!onboarding.contractAcknowledgedAt;
      case "ids":
        return !!onboarding.governmentIdsUploadedAt;
      case "fee":
        return !!onboarding.feeProofUploadedAt;
      case "preAdmission":
        return !!onboarding.preAdmissionCompletedAt;
      default:
        return false;
    }
  }

  const steps: { key: "contract" | "ids" | "fee" | "preAdmission"; title: string; desc: string }[] = [
    {
      key: "contract",
      title: "Step 1 — Signed student agreement",
      desc: "Download the sample agreement if provided, sign it, then upload your signed copy (PDF or clear scan).",
    },
    {
      key: "ids",
      title: "Step 2 — Government photo ID",
      desc: "Upload a clear photo or scan of your government-issued ID (PDF, PNG, JPG, BMP, or other common image formats).",
    },
    {
      key: "fee",
      title: "Step 3 — First payment proof",
      desc: "Upload a receipt, screenshot, or bank proof of your first payment (PDF or image).",
    },
    {
      key: "preAdmission",
      title: "Step 4 — Pre-admission test",
      desc: "Complete the assigned quiz or assessment from your program. Your instructor or principal will share the link when applicable.",
    },
  ];

  const allStudentSteps =
    onboarding.contractAcknowledgedAt &&
    onboarding.governmentIdsUploadedAt &&
    onboarding.feeProofUploadedAt &&
    onboarding.preAdmissionCompletedAt;

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Finish these steps in any order. Course materials unlock after your principal confirms onboarding."
      />

      {allStudentSteps && !onboarding.principalConfirmedAt && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          All checklist items are done. Your principal will confirm your onboarding to unlock full course access.
        </div>
      )}

      {onboarding.principalConfirmedAt && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Onboarding approved.{" "}
          <Link href="/student/program" className="font-medium underline">
            Go to course content
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {steps.map((s) => {
          const complete = stepComplete(s.key);
          return (
            <Card key={s.key}>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  {complete ? (
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="mt-0.5 h-6 w-6 shrink-0 text-gray-300" />
                  )}
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{s.title}</CardTitle>
                    <p className="mt-1 text-sm text-gray-600">{s.desc}</p>

                    {s.key === "contract" && (sampleContractUrl || onboarding.contractDocumentUrl) && (
                      <a
                        href={sampleContractUrl || onboarding.contractDocumentUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm font-medium text-indigo-600 underline"
                      >
                        Open sample agreement
                        {sampleContractLabel ? ` (${sampleContractLabel})` : ""}
                      </a>
                    )}

                    {uploadNote?.step === s.key && (
                      <p
                        className={`mt-2 text-sm ${uploadNote.tone === "success" ? "text-green-800" : "text-red-700"}`}
                      >
                        {uploadNote.text}
                      </p>
                    )}

                    {s.key === "contract" && onboarding.signedContractUploadUrl && (
                      <p className="mt-2 text-sm text-gray-700">
                        Uploaded:{" "}
                        <a
                          href={onboarding.signedContractUploadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 underline"
                        >
                          {onboarding.signedContractFileName || "View file"}
                        </a>
                      </p>
                    )}
                    {s.key === "ids" && onboarding.governmentIdUploadUrl && (
                      <p className="mt-2 text-sm text-gray-700">
                        Uploaded:{" "}
                        <a
                          href={onboarding.governmentIdUploadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 underline"
                        >
                          {onboarding.governmentIdFileName || "View ID"}
                        </a>
                      </p>
                    )}
                    {s.key === "fee" && onboarding.feeProofUploadUrl && (
                      <p className="mt-2 text-sm text-gray-700">
                        Uploaded:{" "}
                        <a
                          href={onboarding.feeProofUploadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 underline"
                        >
                          {onboarding.feeProofFileName || "View receipt"}
                        </a>
                      </p>
                    )}

                    {s.key !== "preAdmission" && !complete && (
                      <label className="mt-3 flex cursor-pointer flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100">
                          <Upload className="h-4 w-4" />
                          {busy === s.key ? "Uploading…" : "Choose file"}
                        </span>
                        <input
                          type="file"
                          accept={FILE_ACCEPT}
                          className="sr-only"
                          disabled={busy !== null}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void uploadStep(s.key as "contract" | "ids" | "fee", f);
                          }}
                        />
                        <span className="text-xs text-gray-500">PDF, PNG, JPG, BMP, GIF, WebP, TIFF, HEIC (max 12 MB)</span>
                      </label>
                    )}
                  </div>
                </div>
                {s.key === "preAdmission" && !complete && (
                  <Button size="sm" isLoading={busy === "preAdmission"} onClick={() => void markPreAdmission()}>
                    Mark complete
                  </Button>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Steps can be completed in any sequence. Payment gateway integration can be activated later; for now use fee proof upload or visit the{" "}
        <Link href="/student/fees" className="text-indigo-600 underline">
          Fees
        </Link>{" "}
        page.
      </p>
    </>
  );
}
