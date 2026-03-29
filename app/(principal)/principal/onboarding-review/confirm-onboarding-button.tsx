"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function ConfirmOnboardingButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onConfirm() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/principal/students/${userId}/onboarding/confirm`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
      <Button size="sm" onClick={onConfirm} isLoading={loading}>
        Confirm onboarding — unlock courses
      </Button>
    </div>
  );
}
