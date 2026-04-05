"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

interface TaxRef {
  id: string;
  name: string;
  customerId: string | null;
}

interface Program {
  id: string;
  name: string;
  code: string;
  description: string | null;
  durationYears: number;
  programDomain: TaxRef | null;
  programCategory: TaxRef | null;
  programType: TaxRef | null;
}

interface Application {
  id: string;
  status: string;
  createdAt: string;
  program: { name: string; code: string };
  programDomain: TaxRef | null;
  programCategory: TaxRef | null;
  programType: TaxRef | null;
}

export default function ApplyPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/student/apply")
      .then((r) => r.json())
      .then((data) => {
        setPrograms(data.programs || []);
        setApplications(data.applications || []);
      });
  }, []);

  async function handleApply() {
    if (!selectedProgram) { setMessage("Please select a program"); return; }
    setSubmitting(true);
    setMessage("");

    const res = await fetch("/api/student/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId: selectedProgram, personalStatement: statement }),
    });
    const data = await res.json();
    if (data.error) { setMessage(data.error); }
    else {
      setMessage("Application submitted successfully! You will receive a confirmation email.");
      setSelectedProgram("");
      setStatement("");
      const refreshed = await fetch("/api/student/apply").then((r) => r.json());
      setApplications(refreshed.applications || []);
    }
    setSubmitting(false);
  }

  const statusVariant = (s: string) => s === "ACCEPTED" || s === "ENROLLED" ? "success" : s === "REJECTED" ? "danger" : s === "PENDING" ? "warning" : "default";

  return (
    <>
      <PageHeader title="Apply for Program" description="Submit your application to enroll in a program" />

      {message && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${message.includes("success") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>New Application</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select
                label="Select Program"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                options={programs.map((p) => ({ value: p.id, label: `${p.name} (${p.code}) - ${p.durationYears} yr` }))}
                placeholder="Choose a program..."
              />
              {selectedProgram && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-sm text-indigo-800 space-y-2">
                  {(() => {
                    const p = programs.find((x) => x.id === selectedProgram);
                    if (!p) return null;
                    return (
                      <>
                        {(p.programDomain || p.programCategory || p.programType) && (
                          <div className="flex flex-wrap gap-1.5">
                            {p.programDomain && (
                              <Badge variant="default" className="text-[10px]">
                                Domain: {p.programDomain.name}
                              </Badge>
                            )}
                            {p.programCategory && (
                              <Badge variant="default" className="text-[10px]">
                                Category: {p.programCategory.name}
                              </Badge>
                            )}
                            {p.programType && (
                              <Badge variant="default" className="text-[10px]">
                                Type: {p.programType.name}
                              </Badge>
                            )}
                          </div>
                        )}
                        <p>{p.description || "No description available."}</p>
                      </>
                    );
                  })()}
                </div>
              )}
              <Textarea
                label="Personal Statement (optional)"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Tell us why you want to join this program..."
              />
              <Button onClick={handleApply} isLoading={submitting} disabled={!selectedProgram}>
                Submit Application
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>My Applications</CardTitle></CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No applications yet.</p>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="flex flex-col gap-1 p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{app.program.name}</p>
                        <p className="text-xs text-gray-500">{new Date(app.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={statusVariant(app.status)}>{app.status}</Badge>
                    </div>
                    {(app.programDomain || app.programCategory || app.programType) && (
                      <div className="flex flex-wrap gap-1">
                        {app.programDomain && (
                          <span className="text-[10px] text-gray-600">Domain: {app.programDomain.name}</span>
                        )}
                        {app.programCategory && (
                          <span className="text-[10px] text-gray-600">· Category: {app.programCategory.name}</span>
                        )}
                        {app.programType && (
                          <span className="text-[10px] text-gray-600">· Type: {app.programType.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
