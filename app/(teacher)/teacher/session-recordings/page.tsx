"use client";

import { PageHeader } from "@/components/layout/page-header";
import { SessionRecordingsManager } from "@/components/session-recordings/session-recordings-manager";

export default function TeacherSessionRecordingsPage() {
  return (
    <>
      <PageHeader
        title="Session Recordings"
        description="Upload and manage session recordings for your programs. Students can view these recordings."
      />
      <SessionRecordingsManager
        apiPrefix="/api/teacher/session-recordings"
        loadPrograms={async () => {
          const res = await fetch("/api/teacher/programs");
          const data = await res.json();
          const raw: Array<{ id: string; name: string }> = data.raw || [];
          return raw.map((p) => ({ id: p.id, name: p.name }));
        }}
      />
    </>
  );
}
