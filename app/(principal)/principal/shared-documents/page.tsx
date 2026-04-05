"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { blobFileUrl } from "@/lib/blob-url";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface SharedDoc {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string | null;
  fileName: string | null;
  category: string | null;
  isPublic: boolean;
  audienceRoles: string[];
  sharedBy: { firstName: string; lastName: string };
}

const AUDIENCE_OPTIONS = [
  { value: "STUDENT", label: "Students" },
  { value: "TEACHER", label: "Teachers / trainers" },
  { value: "PRINCIPAL", label: "Principal / administrators" },
];

const DOC_TYPE_OPTIONS = [
  { value: "DOCUMENT", label: "Document" },
  { value: "VIDEO", label: "Video" },
  { value: "AUDIO", label: "Audio" },
  { value: "IMAGE", label: "Image" },
  { value: "PRESENTATION", label: "Presentation" },
  { value: "URL", label: "URL" },
];

const emptyForm = {
  title: "",
  description: "",
  type: "DOCUMENT",
  fileUrl: "",
  fileName: "",
  category: "",
  isPublic: true,
  audienceRoles: ["STUDENT", "TEACHER", "PRINCIPAL"] as string[],
};

export default function PrincipalSharedDocumentsPage() {
  const [documents, setDocuments] = useState<SharedDoc[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SharedDoc | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadDocuments = useCallback(async () => {
    const res = await fetch("/api/principal/shared-documents");
    const data = await res.json();
    setDocuments(data.documents || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  async function handleSave() {
    const url = editing
      ? `/api/principal/shared-documents/${editing.id}`
      : "/api/principal/shared-documents";
    const method = editing ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    loadDocuments();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/principal/shared-documents/${id}`, { method: "DELETE" });
    loadDocuments();
  }

  return (
    <>
      <PageHeader
        title="Templates & shared documents"
        description="Manage templates and files shared with staff and students"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add document
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((d) => (
          <Card key={d.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{d.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge variant="info">{d.type}</Badge>
                    {d.category && <Badge>{d.category}</Badge>}
                    <Badge variant={d.isPublic ? "success" : "default"}>
                      {d.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                  {d.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">{d.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Audience:{" "}
                    {(d.audienceRoles?.length ?? 0) > 0
                      ? d.audienceRoles.map((r) => AUDIENCE_OPTIONS.find((o) => o.value === r)?.label || r).join(", ")
                      : "Not set"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Shared by {d.sharedBy.firstName} {d.sharedBy.lastName}
                  </p>
                  {d.fileUrl && (
                    <a
                      href={blobFileUrl(d.fileUrl, d.fileName || undefined, true)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline mt-1 inline-block truncate max-w-full"
                    >
                      {d.fileName || "Open link"}
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(d);
                      setForm({
                        title: d.title,
                        description: d.description || "",
                        type: d.type,
                        fileUrl: d.fileUrl || "",
                        fileName: d.fileName || "",
                        category: d.category || "",
                        isPublic: d.isPublic,
                        audienceRoles: d.audienceRoles?.length ? d.audienceRoles : ["STUDENT", "TEACHER", "PRINCIPAL"],
                      });
                      setShowModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(d.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit document" : "Add document"}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={DOC_TYPE_OPTIONS}
          />
          <Input
            label="File URL"
            value={form.fileUrl}
            onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
          />
          <Input
            label="File name"
            value={form.fileName}
            onChange={(e) => setForm({ ...form, fileName: e.target.value })}
          />
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Share with</p>
            <div className="flex flex-wrap gap-3">
              {AUDIENCE_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.audienceRoles.includes(o.value)}
                    onChange={() => {
                      setForm((f) => ({
                        ...f,
                        audienceRoles: f.audienceRoles.includes(o.value)
                          ? f.audienceRoles.filter((x) => x !== o.value)
                          : [...f.audienceRoles, o.value],
                      }));
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="rounded text-indigo-600"
            />
            Public
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
