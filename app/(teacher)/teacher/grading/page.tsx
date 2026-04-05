import { Suspense } from "react";
import { GradingQueueWithKey } from "./grading-queue-wrapper";

function GradingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg border border-gray-200 bg-gray-100" />
      ))}
    </div>
  );
}

export default function GradingPage() {
  return (
    <Suspense fallback={<GradingSkeleton />}>
      <GradingQueueWithKey />
    </Suspense>
  );
}
