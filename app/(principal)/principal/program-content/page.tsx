"use client";

import { ProgramContentAdminClient } from "@/components/program-content/program-content-admin-client";

export default function PrincipalProgramContentPage() {
  return (
    <ProgramContentAdminClient
      title="Program Content"
      description="Build the program syllabus: subjects, chapters, and lessons. Publish when ready for students."
      apiPrefix="/api/principal/program-content"
      canCreateSubjects
      subjectCreateUrl="/api/principal/program-content/subjects"
      loadPrograms={async () => {
        const res = await fetch("/api/principal/programs");
        const data = await res.json();
        return (data.programs || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
      }}
    />
  );
}
