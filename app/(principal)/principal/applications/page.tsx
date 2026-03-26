import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApplicationActions } from "./application-actions";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const applications = await db.programApplication.findMany({
    include: {
      applicant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, profilePicture: true } },
      program: { select: { id: true, name: true, code: true, batches: { where: { isActive: true }, select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Student Applications" description="Review and manage program applications" />

      {applications.length === 0 ? (
        <Card><CardContent><p className="text-center text-gray-500 py-8">No applications yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {app.applicant.profilePicture ? (
                      <img src={app.applicant.profilePicture} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                        {app.applicant.firstName[0]}{app.applicant.lastName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{app.applicant.firstName} {app.applicant.lastName}</p>
                      <p className="text-sm text-gray-500">{app.applicant.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">{app.program.name}</p>
                      <p className="text-xs text-gray-400">{new Date(app.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={app.status === "ENROLLED" || app.status === "ACCEPTED" ? "success" : app.status === "REJECTED" ? "danger" : "warning"}>
                      {app.status}
                    </Badge>
                  </div>
                </div>
                {app.personalStatement && (
                  <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{app.personalStatement}</p>
                )}
                {app.status === "PENDING" && (
                  <div className="mt-3">
                    <ApplicationActions applicationId={app.id} batches={app.program.batches} />
                  </div>
                )}
                {app.status === "ACCEPTED" && (
                  <div className="mt-3">
                    <ApplicationActions applicationId={app.id} batches={app.program.batches} showEnroll />
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
