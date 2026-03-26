"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, ChevronDown, ChevronRight, Save, Film, FileText, Music, Image, Link2, GripVertical } from "lucide-react";

interface Content {
  id: string;
  title: string;
  type: string;
  content: string | null;
  mediaUrl: string | null;
  orderIndex: number;
  duration: number | null;
}

interface TopicData {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  isPublished: boolean;
  contents: Content[];
  _count?: { assessments: number };
}

interface ModuleData {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  requiresCompletion: boolean;
  subject: { id: string; name: string };
  topics: TopicData[];
  assessments: { id: string; title: string; type: string; status: string }[];
  prerequisiteModule: { id: string; name: string } | null;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mod, setMod] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showAddContent, setShowAddContent] = useState<string | null>(null);
  const [topicForm, setTopicForm] = useState({ name: "", description: "" });
  const [contentForm, setContentForm] = useState({ title: "", type: "TEXT", content: "", mediaUrl: "", duration: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadModule();
  }, [params.id]);

  async function loadModule() {
    const res = await fetch(`/api/teacher/modules/${params.id}`);
    const data = await res.json();
    setMod(data.module);
    setLoading(false);
  }

  function toggleTopic(id: string) {
    const next = new Set(expandedTopics);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedTopics(next);
  }

  async function handleAddTopic() {
    setSaving(true);
    await fetch("/api/teacher/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...topicForm, moduleId: params.id, orderIndex: (mod?.topics.length || 0) }),
    });
    setTopicForm({ name: "", description: "" });
    setShowAddTopic(false);
    setSaving(false);
    loadModule();
  }

  async function handleAddContent(topicId: string) {
    setSaving(true);
    await fetch(`/api/teacher/topics/${topicId}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contentForm, orderIndex: 0 }),
    });
    setContentForm({ title: "", type: "TEXT", content: "", mediaUrl: "", duration: 0 });
    setShowAddContent(null);
    setSaving(false);
    loadModule();
  }

  async function handleDeleteTopic(topicId: string) {
    await fetch(`/api/teacher/topics/${topicId}`, { method: "DELETE" });
    loadModule();
  }

  async function handleTogglePublish() {
    if (!mod) return;
    await fetch(`/api/teacher/modules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mod.name, isPublished: !mod.isPublished }),
    });
    loadModule();
  }

  const contentIcon = (type: string) => {
    switch (type) {
      case "VIDEO": return <Film className="h-4 w-4 text-purple-500" />;
      case "AUDIO": return <Music className="h-4 w-4 text-green-500" />;
      case "IMAGE": return <Image className="h-4 w-4 text-blue-500" />;
      case "DOCUMENT": case "PRESENTATION": return <FileText className="h-4 w-4 text-orange-500" />;
      case "URL": return <Link2 className="h-4 w-4 text-cyan-500" />;
      default: return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  if (!mod) return <div className="text-center py-12"><p className="text-red-500">Module not found</p></div>;

  return (
    <>
      <PageHeader
        title={mod.name}
        description={`${mod.subject.name} — ${mod.topics.length} topics`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/teacher/modules")}>Back</Button>
            <Button variant={mod.isPublished ? "secondary" : "primary"} onClick={handleTogglePublish}>
              {mod.isPublished ? "Unpublish" : "Publish"}
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-6">
        {mod.requiresCompletion && <Badge variant="warning">Mandatory Completion Required</Badge>}
        {mod.prerequisiteModule && <Badge variant="info">Requires: {mod.prerequisiteModule.name}</Badge>}
        <Badge variant={mod.isPublished ? "success" : "default"}>{mod.isPublished ? "Published" : "Draft"}</Badge>
      </div>

      {mod.description && <p className="text-sm text-gray-600 mb-6">{mod.description}</p>}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Topics</h3>
        <Button size="sm" onClick={() => setShowAddTopic(true)}><Plus className="h-4 w-4 mr-1" /> Add Topic</Button>
      </div>

      <div className="space-y-3 mb-8">
        {mod.topics.map((topic, idx) => (
          <Card key={topic.id}>
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggleTopic(topic.id)}>
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-gray-300" />
                <span className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600">{idx + 1}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{topic.name}</p>
                  <p className="text-xs text-gray-500">{topic.contents.length} content items</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                {expandedTopics.has(topic.id) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </div>
            </div>
            {expandedTopics.has(topic.id) && (
              <CardContent className="pt-0 border-t">
                {topic.description && <p className="text-sm text-gray-500 mb-3">{topic.description}</p>}
                <div className="space-y-2 mb-3">
                  {topic.contents.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded bg-gray-50">
                      {contentIcon(c.type)}
                      <span className="text-sm flex-1">{c.title}</span>
                      <Badge variant="default">{c.type}</Badge>
                      {c.duration && <span className="text-xs text-gray-400">{c.duration}min</span>}
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => { setShowAddContent(topic.id); setContentForm({ title: "", type: "TEXT", content: "", mediaUrl: "", duration: 0 }); }}>
                  <Plus className="h-3 w-3 mr-1" /> Add Content
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {mod.assessments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Linked Assessments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mod.assessments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded bg-gray-50">
                  <span className="text-sm">{a.title}</span>
                  <div className="flex gap-1">
                    <Badge>{a.type}</Badge>
                    <Badge variant={a.status === "PUBLISHED" ? "success" : "default"}>{a.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={showAddTopic} onClose={() => setShowAddTopic(false)} title="Add Topic">
        <div className="space-y-4">
          <Input label="Topic Name" value={topicForm.name} onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} placeholder="e.g. Introduction to SQL" />
          <Textarea label="Description (optional)" value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddTopic(false)}>Cancel</Button>
            <Button onClick={handleAddTopic} isLoading={saving} disabled={!topicForm.name}><Save className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!showAddContent} onClose={() => setShowAddContent(null)} title="Add Content">
        <div className="space-y-4">
          <Input label="Title" value={contentForm.title} onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })} placeholder="e.g. Lesson 1: Basics" />
          <Select label="Content Type" value={contentForm.type} onChange={(e) => setContentForm({ ...contentForm, type: e.target.value })} options={[
            { value: "TEXT", label: "Text / Paragraph" }, { value: "VIDEO", label: "Video" },
            { value: "AUDIO", label: "Audio" }, { value: "IMAGE", label: "Image" },
            { value: "DOCUMENT", label: "Document" }, { value: "URL", label: "External URL" },
            { value: "PRESENTATION", label: "Presentation (PPT)" },
          ]} />
          {contentForm.type === "TEXT" && (
            <Textarea label="Content" value={contentForm.content} onChange={(e) => setContentForm({ ...contentForm, content: e.target.value })} placeholder="Enter text content..." className="min-h-[120px]" />
          )}
          {contentForm.type !== "TEXT" && (
            <Input label="Media URL" value={contentForm.mediaUrl} onChange={(e) => setContentForm({ ...contentForm, mediaUrl: e.target.value })} placeholder="https://..." />
          )}
          <Input label="Duration (minutes, optional)" type="number" value={contentForm.duration || ""} onChange={(e) => setContentForm({ ...contentForm, duration: parseInt(e.target.value) || 0 })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddContent(null)}>Cancel</Button>
            <Button onClick={() => showAddContent && handleAddContent(showAddContent)} isLoading={saving} disabled={!contentForm.title}><Save className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
