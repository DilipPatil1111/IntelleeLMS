"use client";

import { ProgramContentAdminClient } from "@/components/program-content/program-content-admin-client";

export default function TeacherProgramContentPage() {
  return (
    <ProgramContentAdminClient
      title="Program Content"
      description="Edit syllabus for programs you are assigned to."
      apiPrefix="/api/teacher/program-content"
      canCreateSubjects
      subjectCreateUrl="/api/teacher/subjects"
      loadPrograms={async () => {
        const res = await fetch("/api/teacher/programs");
        const data = await res.json();
        const raw = data.raw || [];
        return raw.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
      }}
    />
  );
}
