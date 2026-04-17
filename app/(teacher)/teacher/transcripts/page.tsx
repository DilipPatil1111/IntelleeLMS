"use client";
import { TranscriptManagerClient } from "@/components/transcripts/transcript-manager-client";

export default function TeacherTranscriptsPage() {
  return (
    <TranscriptManagerClient
      apiPrefix="/api/teacher"
      studentsUrl="/api/teacher/transcripts/students"
      programsUrl="/api/teacher/programs"
    />
  );
}
