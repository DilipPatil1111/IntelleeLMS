"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export default function NewModulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<{ value: string; label: string }[]>([]);
  const [modules, setModules] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    subjectId: searchParams.get("subjectId") || "",
    requiresCompletion: false,
    prerequisiteModuleId: "",
  });

  useEffect(() => {
    fetch("/api/teacher/options").then((r) => r.json()).then((data) => {
      setSubjects((data.subjects || []).map((s: { value: string; label: string }) => s));
    });
  }, []);

  useEffect(() => {
    if (form.subjectId) {
      fetch(`/api/teacher/modules?subjectId=${form.subjectId}`).then((r) => r.json()).then((data) => {
        setModules((data.modules || []).map((m: { id: string; name: string }) => ({ value: m.id, label: m.name })));
      });
    }
  }, [form.subjectId]);

  async function handleSubmit() {
    if (!form.name || !form.subjectId) { setError("Name and subject are required"); return; }
    setSaving(true);
    setError("");

    const res = await fetch("/api/teacher/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); }
    else { router.push(`/teacher/modules/${data.module.id}`); }
    setSaving(false);
  }

  return (
    <>
      <PageHeader title="Create Module" description="Add a new module to a subject" />

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">{error}</div>}

      <Card>
        <CardHeader><CardTitle>Module Details</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input label="Module Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Module 1: Introduction to Databases" />
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this module covers..." />
            <Select label="Subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} options={subjects} placeholder="Select subject" />
            <Select label="Prerequisite Module (optional)" value={form.prerequisiteModuleId} onChange={(e) => setForm({ ...form, prerequisiteModuleId: e.target.value })} options={[{ value: "", label: "None" }, ...modules]} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.requiresCompletion} onChange={(e) => setForm({ ...form, requiresCompletion: e.target.checked })} className="rounded text-indigo-600" />
              Require completion (students must complete assessments before moving forward)
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push("/teacher/modules")}>Cancel</Button>
              <Button onClick={handleSubmit} isLoading={saving}>Create Module</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
