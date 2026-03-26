"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string | null;
}

const defaultTemplates = [
  { name: "application_received", subject: "Application Received - {{programName}}", description: "Auto-reply when student submits application", body: "Dear {{firstName}},\n\nThank you for applying to {{programName}}. Your application has been received and is under review.\n\nWe will notify you once a decision has been made.\n\nBest regards,\nIntellee College" },
  { name: "application_accepted", subject: "Congratulations! Application Accepted - {{programName}}", description: "Sent when application is accepted", body: "Dear {{firstName}},\n\nCongratulations! Your application to {{programName}} has been accepted.\n\nYou will receive enrollment details shortly.\n\nBest regards,\nIntellee College" },
  { name: "enrollment_confirmed", subject: "Enrollment Confirmed - {{programName}}", description: "Sent when enrollment is confirmed", body: "Dear {{firstName}},\n\nYour enrollment in {{programName}} has been confirmed.\n\nLogin to your student dashboard: {{profileLink}}\n\nBest regards,\nIntellee College" },
];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", body: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/principal/email-templates").then((r) => r.json()).then((data) => setTemplates(data.templates || []));
  }, []);

  function startEdit(t: Template | typeof defaultTemplates[0]) {
    setEditing(t.name);
    setForm({ name: t.name, subject: t.subject, body: t.body, description: t.description || "" });
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/principal/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const refreshed = await fetch("/api/principal/email-templates").then((r) => r.json());
    setTemplates(refreshed.templates || []);
    setEditing(null);
    setSaving(false);
  }

  const allTemplates = defaultTemplates.map((dt) => {
    const saved = templates.find((t) => t.name === dt.name);
    return saved || { ...dt, id: "" };
  });

  return (
    <>
      <PageHeader title="Email Templates" description="Configure auto-generated email templates for student communications" />

      <div className="space-y-4">
        {allTemplates.map((t) => (
          <Card key={t.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{t.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</CardTitle>
                  {"id" in t && t.id ? <Badge variant="success">Customized</Badge> : <Badge>Default</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        sessionStorage.setItem(
                          "emailTemplateDraft",
                          JSON.stringify({ subject: t.subject, body: t.body })
                        );
                      }
                      window.location.href = "/principal/announcements";
                    }}
                  >
                    Apply to announcement
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startEdit(t)}>Edit</Button>
                </div>
              </div>
            </CardHeader>
            {editing === t.name ? (
              <CardContent>
                <div className="space-y-3">
                  <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  <Textarea label="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="min-h-[150px] font-mono text-sm" />
                  <p className="text-xs text-gray-400">Variables: {"{{firstName}}, {{programName}}, {{profileLink}}"}</p>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} isLoading={saving} size="sm">Save</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              </CardContent>
            ) : (
              <CardContent>
                <p className="text-sm text-gray-500">{t.description}</p>
                <p className="text-xs text-gray-400 mt-1">Subject: {t.subject}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
