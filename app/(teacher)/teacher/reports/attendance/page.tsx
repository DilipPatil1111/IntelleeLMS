"use client";

import { AdminAttendanceReportClient } from "@/components/reports/admin-attendance-report-client";

export default function TeacherAttendanceReportPage() {
  return (
    <AdminAttendanceReportClient
      apiPrefix="/api/teacher"
      programsUrl="/api/teacher/programs"
    />
  );
}
