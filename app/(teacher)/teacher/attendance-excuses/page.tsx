import { AttendanceExcusesClient } from "@/components/attendance-excuses/attendance-excuses-client";

export default function TeacherAttendanceExcusesPage() {
  return <AttendanceExcusesClient apiBasePath="/api/teacher/attendance-excuse-requests" role="teacher" />;
}
