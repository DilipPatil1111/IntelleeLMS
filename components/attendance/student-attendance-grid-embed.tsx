"use client";

import { AttendanceProgramGridClient } from "@/components/attendance/attendance-program-grid-client";

/** View-only program attendance spreadsheet for the logged-in student. */
export function StudentAttendanceGridEmbed({ programId }: { programId?: string }) {
  return <AttendanceProgramGridClient apiRole="student" embedded studentProgramId={programId} />;
}
