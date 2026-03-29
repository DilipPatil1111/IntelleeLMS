"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  applicationId: string;
  batches: { id: string; name: string }[];
  showEnroll?: boolean;
  /** Student was added from Students with program/batch/enrollment already set — do not duplicate placement emails. */
  placementPreRecorded?: boolean;
  /** Pre-select batch when placement was recorded elsewhere (e.g. principal Students screen). */
  defaultBatchId?: string;
  /** Called after a successful action (e.g. refetch list on client-driven pages). */
  onDone?: () => void;
}

export function ApplicationActions({
  applicationId,
  batches,
  showEnroll,
  placementPreRecorded,
  defaultBatchId,
  onDone,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [notes, setNotes] = useState("");
  const [batchId, setBatchId] = useState(defaultBatchId ?? "");

  async function handleAction(action: string) {
    if (action === "enroll" && !batchId) return;
    setLoading(action);

    await fetch(`/api/principal/applications/${applicationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, batchId, reviewNotes: notes }),
    });

    setLoading("");
    onDone?.();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review notes (optional)..." className="text-sm" />
      <div className="flex items-center gap-2 flex-wrap">
        {!showEnroll && (
          <>
            <Button size="sm" onClick={() => handleAction("accept")} isLoading={loading === "accept"}>Accept</Button>
            <Button size="sm" variant="danger" onClick={() => handleAction("reject")} isLoading={loading === "reject"}>Reject</Button>
          </>
        )}
        {showEnroll && placementPreRecorded && (
          <p className="text-sm text-gray-700 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
            Placement is already set from <strong className="font-medium">Students</strong>. When this student finishes
            onboarding, approve them under <strong className="font-medium">Onboarding review</strong> to set{" "}
            <strong className="font-medium">Enrolled</strong> and unlock the full menu. Optional: mark this application
            as placement-confirmed (no extra email) using your current batch below.
          </p>
        )}
        {(showEnroll || batches.length > 0) && (
          <>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} options={batches.map((b) => ({ value: b.id, label: b.name }))} placeholder="Select batch" />
            <Button size="sm" variant="primary" onClick={() => handleAction("enroll")} isLoading={loading === "enroll"} disabled={!batchId}>
              {placementPreRecorded ? "Confirm placement (no email)" : "Confirm Enrollment"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
