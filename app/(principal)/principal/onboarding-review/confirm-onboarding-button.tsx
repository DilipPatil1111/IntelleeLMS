"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function ConfirmOnboardingButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/principal/students/${userId}/onboarding/confirm`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" onClick={onConfirm} isLoading={loading}>
      Confirm onboarding — unlock courses
    </Button>
  );
}
