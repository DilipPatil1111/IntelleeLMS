"use client";

import dynamic from "next/dynamic";

function CalendarSkeleton() {
  return <div className="h-screen animate-pulse rounded-xl border border-gray-200 bg-gray-50" />;
}

const FullProgramCalendarDynamic = dynamic(
  () =>
    import("@/components/calendar/full-program-calendar-client").then((m) => ({
      default: m.FullProgramCalendarClient,
    })),
  { loading: () => <CalendarSkeleton />, ssr: false }
);

export function FullCalendarClient({
  mode,
  initialBatchId,
  initialDate,
}: {
  mode: "principal" | "teacher";
  initialBatchId: string | null;
  initialDate: string | null;
}) {
  return (
    <FullProgramCalendarDynamic
      mode={mode}
      initialBatchId={initialBatchId}
      initialDate={initialDate}
    />
  );
}
