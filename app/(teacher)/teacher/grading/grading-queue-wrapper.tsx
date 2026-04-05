"use client";

import { useSearchParams } from "next/navigation";
import { TeacherGradingQueueClient } from "./teacher-grading-client";

export function GradingQueueWithKey() {
  const sp = useSearchParams();
  const aid = sp.get("assessmentId") ?? "";
  return <TeacherGradingQueueClient key={aid || "all"} />;
}
