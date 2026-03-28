"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

type Ob = {
  contractAcknowledgedAt: string | null;
  governmentIdsUploadedAt: string | null;
  feeProofUploadedAt: string | null;
  preAdmissionCompletedAt: string | null;
  principalConfirmedAt: string | null;
  contractDocumentUrl: string | null;
};

export default function StudentOnboardingPage() {
  const [onboarding, setOnboarding] = useState<Ob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/student/onboarding");
    const data = await res.json();
    setOnboarding(data.onboarding || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function mark(step: "contract" | "ids" | "fee" | "preAdmission") {
    setBusy(step);
    await fetch("/api/student/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
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
      title: "Step 1 — Sign student agreement",
      desc: "Review the contract text (PDF from your college when configured) and confirm you agree.",
    },
    {
      key: "ids",
      title: "Step 2 — Government photo ID",
      desc: "Upload clear photos or scans of your government-issued ID (handled via profile / documents when wired).",
    },
    {
      key: "fee",
      title: "Step 3 — First payment",
      desc: "Upload a payment receipt screenshot or proof. Online payment gateway can be enabled later.",
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
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {complete ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-300 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{s.title}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{s.desc}</p>
                    {s.key === "contract" && onboarding.contractDocumentUrl && (
                      <a
                        href={onboarding.contractDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 underline mt-2 inline-block"
                      >
                        Open contract document
                      </a>
                    )}
                  </div>
                </div>
                {!complete && (
                  <Button size="sm" isLoading={busy === s.key} onClick={() => mark(s.key)}>
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
