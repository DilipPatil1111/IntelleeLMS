import { FullProgramCalendarClient } from "@/components/calendar/full-program-calendar-client";

export default async function PrincipalFullCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string; date?: string }>;
}) {
  const sp = await searchParams;
  return <FullProgramCalendarClient mode="principal" initialBatchId={sp.batchId ?? null} initialDate={sp.date ?? null} />;
}
