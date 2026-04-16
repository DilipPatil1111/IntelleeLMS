"use client";

import { AdminAttendanceReportClient } from "@/components/reports/admin-attendance-report-client";

export default function PrincipalAttendanceReportPage() {
  return (
    <AdminAttendanceReportClient
      apiPrefix="/api/principal"
      programsUrl="/api/principal/programs"
    />
  );
}
