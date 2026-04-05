import { Suspense } from "react";
import { FullCalendarClient } from "@/components/calendar/full-calendar-client-wrapper";

export default async function PrincipalFullCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string; date?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<div className="h-screen animate-pulse rounded-xl border border-gray-200 bg-gray-50" />}>
      <FullCalendarClient mode="principal" initialBatchId={sp.batchId ?? null} initialDate={sp.date ?? null} />
    </Suspense>
  );
}
