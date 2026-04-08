"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [onboarding, setOnboarding] = useState<Ob | null>(null);
  const [sampleContractUrl, setSampleContractUrl] = useState<string | null>(null);
  const [sampleContractLabel, setSampleContractLabel] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [isVocational, setIsVocational] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<{ step: string; tone: "success" | "error"; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/student/onboarding");
    const data = await res.json();
    setOnboarding(data.onboarding || null);
    setSampleContractUrl(data.sampleContractUrl || null);
    setSampleContractLabel(data.sampleContractFileName || null);
    setProfileStatus(data.studentProfileStatus || null);
    setIsVocational(data.isVocational ?? true);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/student/onboarding")
      .then((r) => r.json())
      .then((data: { onboarding?: Ob | null; sampleContractUrl?: string | null; sampleContractFileName?: string | null; studentProfileStatus?: string | null; isVocational?: boolean }) => {
        if (cancelled) return;
        setOnboarding(data.onboarding || null);
        setSampleContractUrl(data.sampleContractUrl || null);
        setSampleContractLabel(data.sampleContractFileName || null);
        setProfileStatus(data.studentProfileStatus || null);
        setIsVocational(data.isVocational ?? true);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
    router.refresh();
  }

  async function markOnboardingStep(step: "contract" | "governmentIds" | "feeProof" | "preAdmission") {
    setBusy(step);
    setUploadNote(null);
    const res = await fetch("/api/student/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUploadNote({
        step: step === "governmentIds" ? "ids" : step === "feeProof" ? "fee" : step === "contract" ? "contract" : "preAdmission",
        tone: "error",
        text: (data as { error?: string }).error || "Could not mark this step complete.",
      });
      setBusy(null);
      return;
    }
    await load();
    router.refresh();
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

  const allStepsDef: { key: "contract" | "ids" | "fee" | "preAdmission"; patchStep: "contract" | "governmentIds" | "feeProof" | "preAdmission"; title: string; desc: string; vocationalOnly?: boolean }[] = [
    {
      key: "contract",
      patchStep: "contract",
      title: "Step 1 — Signed student agreement",
      desc: "Download the sample agreement if provided. You may upload a signed copy, or use Mark complete for now — your principal may request documents later.",
    },
    {
      key: "ids",
      patchStep: "governmentIds",
      title: "Step 2 — Government photo ID",
      desc: "Upload a clear scan when ready, or mark complete without a file for now.",
    },
    {
      key: "fee",
      patchStep: "feeProof",
      title: "Step 3 — First payment proof",
      desc: "Upload a receipt or screenshot when ready, or mark complete for now.",
    },
    {
      key: "preAdmission",
      patchStep: "preAdmission",
      title: "Step 4 — Pre-admission test",
      desc: "Complete the assigned assessment when shared, or mark complete when applicable.",
      vocationalOnly: true,
    },
  ];

  const steps = allStepsDef.filter((s) => !s.vocationalOnly || isVocational);
  const totalSteps = steps.length;

  const allStudentSteps = steps.every((s) => stepComplete(s.key));

  const checklistDoneCount = steps.filter((s) => stepComplete(s.key)).length;
  const checklistPercent = Math.round((checklistDoneCount / totalSteps) * 100);

  const isEnrolled = profileStatus === "ENROLLED" || profileStatus === "COMPLETED" || profileStatus === "GRADUATED";
  const pendingStepNames = steps.filter((s) => !stepComplete(s.key)).map((s) => s.title);

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Finish these steps in any order. Course materials unlock after your principal confirms onboarding."
      />

      <div className="mb-6 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/90 to-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-indigo-950">Checklist progress</p>
          <span className="text-sm font-medium text-indigo-700">{checklistDoneCount} of {totalSteps} steps</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${checklistPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {onboarding.principalConfirmedAt
            ? "Your principal has unlocked full course access."
            : allStudentSteps
              ? "All steps done — waiting for principal approval to unlock My Program and Attendance."
              : "Complete each step in any order. Uploads are optional for now — use Mark complete to proceed. Assessments and Results stay available from the sidebar."}
        </p>
      </div>

      {allStudentSteps && !onboarding.principalConfirmedAt && !isEnrolled && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          All checklist items are done. Your principal will confirm your onboarding to unlock full course access.
        </div>
      )}

      {allStudentSteps && !onboarding.principalConfirmedAt && isEnrolled && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Your onboarding is complete. You have full access to your program content.{" "}
          <Link href="/student/program" className="font-medium underline">
            Go to course content
          </Link>
        </div>
      )}

      {!allStudentSteps && isEnrolled && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">The following onboarding steps still need to be completed:</p>
          <ul className="mt-1 list-inside list-disc">
            {pendingStepNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
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
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <label className="flex cursor-pointer flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100">
                            <Upload className="h-4 w-4" />
                            {busy === s.key ? "Uploading…" : "Upload Document"}
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
                          <span className="text-xs text-gray-500">PDF, PNG, JPG… (max 12 MB)</span>
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          isLoading={busy === s.patchStep}
                          disabled={busy !== null}
                          onClick={() => void markOnboardingStep(s.patchStep)}
                        >
                          Mark complete (no upload)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy !== null}
                          onClick={() => setUploadNote(null)}
                        >
                          Submit Later
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {s.key === "preAdmission" && !complete && (
                  <Button
                    size="sm"
                    isLoading={busy === "preAdmission"}
                    onClick={() => void markOnboardingStep("preAdmission")}
                  >
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
