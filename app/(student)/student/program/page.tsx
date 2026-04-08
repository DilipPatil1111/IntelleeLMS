"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ChevronRight,
  Book,
  Layers,
  BookOpen,
  Lock,
} from "lucide-react";

type TaxRef = { id: string; name: string };

interface ProgramCard {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  durationText?: string | null;
  programDomain?: TaxRef | null;
  programCategory?: TaxRef | null;
  programType?: TaxRef | null;
  _count?: { subjects: number; batches: number; students: number };
  isPublished?: boolean;
}

export default function StudentMyProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/programs")
      .then((r) => r.json())
      .then((data) => setPrograms(data.programs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span className="font-semibold text-gray-900">Programs</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">My Programs</h1>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Select a program to view its syllabus and curriculum.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No programs assigned yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Once you are enrolled in a program, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/student/program/${p.id}`)}
              className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all"
            >
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 mb-4" />

              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                  {p.code && <p className="text-xs text-gray-400 mt-0.5">{p.code}</p>}
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.durationText && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                    {p.durationText}
                  </span>
                )}
                {p.programDomain && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">
                    {p.programDomain.name}
                  </span>
                )}
                {p.programCategory && (
                  <span className="text-[10px] bg-purple-50 text-purple-700 rounded-full px-2 py-0.5">
                    {p.programCategory.name}
                  </span>
                )}
                {p.programType && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                    {p.programType.name}
                  </span>
                )}
              </div>

              {p._count && (
                <div className="mt-3 flex gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Book className="h-3 w-3" /> {p._count.subjects} subject{p._count.subjects !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {p._count.batches} batch{p._count.batches !== 1 ? "es" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> {p._count.students} student{p._count.students !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {p.isPublished !== undefined && (
                <div className="mt-3">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 ${
                    p.isPublished
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    <BookOpen className="h-2.5 w-2.5" />
                    {p.isPublished ? "Published" : "Not yet published"}
                  </span>
                </div>
              )}

              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-4 w-4 text-indigo-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
