"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FullCalendarMultiProgram } from "./full-calendar-multi-program";
import { HolidaysManager } from "@/app/(student)/student/holidays/page";
import { CalendarRange, Calendar } from "lucide-react";

interface ProgramEntry {
  id: string;
  name: string;
  batchId: string | null;
  batchName: string | null;
  startDate: string | null;
  endDate: string | null;
}

type Tab = "calendar" | "holidays";

export function FullCalendarWithHolidays({
  programs,
  defaultProgramId,
}: {
  programs: ProgramEntry[];
  defaultProgramId: string;
}) {
  const [tab, setTab] = useState<Tab>("calendar");

  const tabBtn = (id: Tab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
        tab === id
          ? "bg-indigo-600 text-white shadow"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <PageHeader title="Full Calendar" description="Program schedule & holidays" />

      <div className="flex flex-wrap gap-2 mb-6">
        {tabBtn("calendar", "Program Calendar", <CalendarRange className="h-4 w-4" />)}
        {tabBtn("holidays", "Holidays", <Calendar className="h-4 w-4" />)}
      </div>

      {tab === "calendar" && (
        <FullCalendarMultiProgram programs={programs} defaultProgramId={defaultProgramId} />
      )}

      {tab === "holidays" && <HolidaysManager embedded />}
    </>
  );
}
