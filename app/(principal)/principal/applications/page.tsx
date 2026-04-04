import { Suspense } from "react";
import { ApplicationsClient } from "./applications-client";

function ApplicationsSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-36 rounded bg-gray-100" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg border border-gray-200 bg-gray-100" />
      ))}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<ApplicationsSkeleton />}>
      <ApplicationsClient />
    </Suspense>
  );
}
