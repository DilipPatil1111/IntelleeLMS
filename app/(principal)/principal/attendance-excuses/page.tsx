import { AttendanceExcusesClient } from "@/components/attendance-excuses/attendance-excuses-client";

export default function PrincipalAttendanceExcusesPage() {
  return <AttendanceExcusesClient apiBasePath="/api/principal/attendance-excuse-requests" role="principal" />;
}
