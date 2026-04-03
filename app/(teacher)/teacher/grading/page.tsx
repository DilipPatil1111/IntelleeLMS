import { Suspense } from "react";
import { GradingQueueWithKey } from "./grading-queue-wrapper";

export default function GradingPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-gray-500">Loading…</p>}>
      <GradingQueueWithKey />
    </Suspense>
  );
}
