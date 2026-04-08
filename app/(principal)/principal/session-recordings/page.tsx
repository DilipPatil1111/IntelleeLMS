"use client";

import { PageHeader } from "@/components/layout/page-header";
import { SessionRecordingsManager } from "@/components/session-recordings/session-recordings-manager";

export default function PrincipalSessionRecordingsPage() {
  return (
    <>
      <PageHeader
        title="Session Recordings"
        description="Upload and manage session recordings for all programs. Students can view these recordings."
      />
      <SessionRecordingsManager
        apiPrefix="/api/principal/session-recordings"
        loadPrograms={async () => {
          const res = await fetch("/api/principal/programs");
          const data = await res.json();
          return (data.programs || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
        }}
      />
    </>
  );
}
