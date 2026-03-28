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
  /** Called after a successful action (e.g. refetch list on client-driven pages). */
  onDone?: () => void;
}

export function ApplicationActions({ applicationId, batches, showEnroll, onDone }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [notes, setNotes] = useState("");
  const [batchId, setBatchId] = useState("");

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
        {(showEnroll || batches.length > 0) && (
          <>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} options={batches.map((b) => ({ value: b.id, label: b.name }))} placeholder="Select batch" />
            <Button size="sm" variant="primary" onClick={() => handleAction("enroll")} isLoading={loading === "enroll"} disabled={!batchId}>
              Confirm Enrollment
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
