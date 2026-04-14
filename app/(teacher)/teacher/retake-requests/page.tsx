"use client";

import { RetakeRequestsClient } from "@/components/retake-requests/retake-requests-client";

export default function TeacherRetakeRequestsPage() {
  return <RetakeRequestsClient apiBasePath="/api/teacher/retake-requests" role="teacher" />;
}
