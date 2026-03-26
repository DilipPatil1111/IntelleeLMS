import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ModulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const subjects = await db.subject.findMany({
    include: {
      program: { select: { name: true } },
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          topics: { orderBy: { orderIndex: "asc" } },
          _count: { select: { topics: true, assessments: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Course Content" description="Build program modules, topics, and study materials (LMS)" />

      {subjects.length === 0 ? (
        <Card><CardContent><p className="text-center text-gray-500 py-8">No subjects found. Add subjects first from the Subjects page.</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {subjects.map((subject) => (
            <Card key={subject.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{subject.name}</CardTitle>
                    <p className="text-sm text-gray-500">{subject.program.name} — {subject.code}</p>
                  </div>
                  <Link href={`/teacher/modules/new?subjectId=${subject.id}`}>
                    <Button size="sm">Add Module</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {subject.modules.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No modules yet. Click &quot;Add Module&quot; to start building course content.</p>
                ) : (
                  <div className="space-y-3">
                    {subject.modules.map((mod, idx) => (
                      <Link key={mod.id} href={`/teacher/modules/${mod.id}`} className="block">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{mod.name}</p>
                              <p className="text-xs text-gray-500">{mod._count.topics} topics — {mod._count.assessments} assessments</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {mod.requiresCompletion && <Badge variant="warning">Mandatory</Badge>}
                            <Badge variant={mod.isPublished ? "success" : "default"}>{mod.isPublished ? "Published" : "Draft"}</Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
