"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { FullProgramCalendarClient } from "@/components/calendar/full-program-calendar-client";

interface ProgramEntry {
  id: string;
  name: string;
  batchId: string | null;
  batchName: string | null;
  startDate: string | null;
  endDate: string | null;
}

export function FullCalendarMultiProgram({
  programs,
  defaultProgramId,
}: {
  programs: ProgramEntry[];
  defaultProgramId: string;
}) {
  const [selectedProgramId, setSelectedProgramId] = useState(defaultProgramId);
  const selected = programs.find((p) => p.id === selectedProgramId) ?? programs[0];

  return (
    <div>
      {programs.length > 1 && (
        <div className="mb-6 max-w-md">
          <Select
            label="Select Program"
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            options={programs.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      )}
      {selected?.batchId ? (
        <FullProgramCalendarClient
          key={selected.batchId}
          mode="student"
          fixedBatchId={selected.batchId}
          studentProgramName={selected.name}
          studentBatchName={selected.batchName}
          studentBatchRange={selected.startDate && selected.endDate ? { from: selected.startDate, to: selected.endDate } : null}
        />
      ) : (
        <p className="text-gray-500 text-sm">No batch assigned for the selected program.</p>
      )}
    </div>
  );
}
