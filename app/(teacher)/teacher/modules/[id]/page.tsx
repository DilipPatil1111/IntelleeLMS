"use client";

import { useCallback, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, Save, Film, FileText, Music, Image as ImageIcon, Link2, GripVertical } from "lucide-react";

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
  orderIndex: number;
  isPublished: boolean;
  requiresCompletion: boolean;
  prerequisiteModuleId: string | null;
  subject: { id: string; name: string };
  topics: TopicData[];
  assessments: { id: string; title: string; type: string; status: string }[];
  prerequisiteModule: { id: string; name: string } | null;
}

const CONTENT_TYPE_OPTIONS = [
  { value: "TEXT", label: "Text / Paragraph" },
  { value: "VIDEO", label: "Video" },
  { value: "AUDIO", label: "Audio" },
  { value: "IMAGE", label: "Image" },
  { value: "DOCUMENT", label: "Document" },
  { value: "URL", label: "External URL" },
  { value: "PRESENTATION", label: "Presentation (PPT)" },
];

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mod, setMod] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Module edit
  const [showEditModule, setShowEditModule] = useState(false);
  const [moduleForm, setModuleForm] = useState({ name: "", description: "", orderIndex: 0, requiresCompletion: false, prerequisiteModuleId: "" });

  // Topic add/edit
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicData | null>(null);
  const [topicForm, setTopicForm] = useState({ name: "", description: "" });

  // Content add/edit
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentTopicId, setContentTopicId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [contentForm, setContentForm] = useState({ title: "", type: "TEXT", content: "", mediaUrl: "", duration: 0 });

  // Delete confirmation
  const [showDeleteModule, setShowDeleteModule] = useState(false);

  const loadModule = useCallback(async () => {
    const res = await fetch(`/api/teacher/modules/${params.id}`);
    const data = await res.json();
    setMod(data.module);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModule();
  }, [loadModule]);

  function toggleTopic(id: string) {
    const next = new Set(expandedTopics);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedTopics(next);
  }

  // --- Module CRUD ---

  function openEditModule() {
    if (!mod) return;
    setModuleForm({
      name: mod.name,
      description: mod.description || "",
      orderIndex: mod.orderIndex,
      requiresCompletion: mod.requiresCompletion,
      prerequisiteModuleId: mod.prerequisiteModuleId || "",
    });
    setShowEditModule(true);
  }

  async function handleSaveModule() {
    setSaving(true);
    await fetch(`/api/teacher/modules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(moduleForm),
    });
    setShowEditModule(false);
    setSaving(false);
    loadModule();
  }

  async function handleDeleteModule() {
    await fetch(`/api/teacher/modules/${params.id}`, { method: "DELETE" });
    router.push("/teacher/modules");
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

  // --- Topic CRUD ---

  function openAddTopic() {
    setEditingTopic(null);
    setTopicForm({ name: "", description: "" });
    setShowTopicModal(true);
  }

  function openEditTopic(topic: TopicData) {
    setEditingTopic(topic);
    setTopicForm({ name: topic.name, description: topic.description || "" });
    setShowTopicModal(true);
  }

  async function handleSaveTopic() {
    setSaving(true);
    if (editingTopic) {
      await fetch(`/api/teacher/topics/${editingTopic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topicForm),
      });
    } else {
      await fetch("/api/teacher/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...topicForm, moduleId: params.id, orderIndex: (mod?.topics.length || 0) }),
      });
    }
    setTopicForm({ name: "", description: "" });
    setEditingTopic(null);
    setShowTopicModal(false);
    setSaving(false);
    loadModule();
  }

  async function handleDeleteTopic(topicId: string) {
    if (!confirm("Delete this topic and all its content?")) return;
    await fetch(`/api/teacher/topics/${topicId}`, { method: "DELETE" });
    loadModule();
  }

  // --- Content CRUD ---

  function openAddContent(topicId: string) {
    setEditingContent(null);
    setContentTopicId(topicId);
    setContentForm({ title: "", type: "TEXT", content: "", mediaUrl: "", duration: 0 });
    setShowContentModal(true);
  }

  function openEditContent(topicId: string, c: Content) {
    setEditingContent(c);
    setContentTopicId(topicId);
    setContentForm({
      title: c.title,
      type: c.type,
      content: c.content || "",
      mediaUrl: c.mediaUrl || "",
      duration: c.duration || 0,
    });
    setShowContentModal(true);
  }

  async function handleSaveContent() {
    setSaving(true);
    if (editingContent) {
      await fetch(`/api/teacher/contents/${editingContent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contentForm),
      });
    } else if (contentTopicId) {
      await fetch(`/api/teacher/topics/${contentTopicId}/contents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contentForm, orderIndex: 0 }),
      });
    }
    setContentForm({ title: "", type: "TEXT", content: "", mediaUrl: "", duration: 0 });
    setEditingContent(null);
    setContentTopicId(null);
    setShowContentModal(false);
    setSaving(false);
    loadModule();
  }

  async function handleDeleteContent(contentId: string) {
    if (!confirm("Delete this content item?")) return;
    await fetch(`/api/teacher/contents/${contentId}`, { method: "DELETE" });
    loadModule();
  }

  const contentIcon = (type: string) => {
    switch (type) {
      case "VIDEO": return <Film className="h-4 w-4 text-purple-500" />;
      case "AUDIO": return <Music className="h-4 w-4 text-green-500" />;
      case "IMAGE": return <ImageIcon className="h-4 w-4 text-blue-500" />;
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
            <Button variant="outline" onClick={openEditModule}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
            <Button variant="danger" onClick={() => setShowDeleteModule(true)}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
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
        <Button size="sm" onClick={openAddTopic}><Plus className="h-4 w-4 mr-1" /> Add Topic</Button>
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
                <button type="button" onClick={(e) => { e.stopPropagation(); openEditTopic(topic); }} className="text-gray-400 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
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
                      <button type="button" onClick={() => openEditContent(topic.id, c)} className="text-gray-400 hover:text-indigo-600"><Pencil className="h-3 w-3" /></button>
                      <button type="button" onClick={() => handleDeleteContent(c.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => openAddContent(topic.id)}>
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

      {/* Edit Module Modal */}
      <Modal isOpen={showEditModule} onClose={() => setShowEditModule(false)} title="Edit Module">
        <div className="space-y-4">
          <Input label="Module Name" value={moduleForm.name} onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })} />
          <Textarea label="Description" value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} />
          <Input label="Order Index" type="number" value={moduleForm.orderIndex} onChange={(e) => setModuleForm({ ...moduleForm, orderIndex: parseInt(e.target.value) || 0 })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={moduleForm.requiresCompletion} onChange={(e) => setModuleForm({ ...moduleForm, requiresCompletion: e.target.checked })} />
            Requires mandatory completion
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditModule(false)}>Cancel</Button>
            <Button onClick={handleSaveModule} isLoading={saving}><Save className="h-4 w-4 mr-1" /> Update</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Module Confirmation */}
      <Modal isOpen={showDeleteModule} onClose={() => setShowDeleteModule(false)} title="Delete Module">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Are you sure you want to delete <strong>{mod.name}</strong>? This will also delete all topics, content, and linked data. This action cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModule(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteModule}><Trash2 className="h-4 w-4 mr-1" /> Delete Module</Button>
          </div>
        </div>
      </Modal>

      {/* Topic Add/Edit Modal */}
      <Modal isOpen={showTopicModal} onClose={() => setShowTopicModal(false)} title={editingTopic ? "Edit Topic" : "Add Topic"}>
        <div className="space-y-4">
          <Input label="Topic Name" value={topicForm.name} onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} placeholder="e.g. Introduction to SQL" />
          <Textarea label="Description (optional)" value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTopicModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTopic} isLoading={saving} disabled={!topicForm.name}><Save className="h-4 w-4 mr-1" /> {editingTopic ? "Update" : "Add"}</Button>
          </div>
        </div>
      </Modal>

      {/* Content Add/Edit Modal */}
      <Modal isOpen={showContentModal} onClose={() => setShowContentModal(false)} title={editingContent ? "Edit Content" : "Add Content"}>
        <div className="space-y-4">
          <Input label="Title" value={contentForm.title} onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })} placeholder="e.g. Lesson 1: Basics" />
          <Select label="Content Type" value={contentForm.type} onChange={(e) => setContentForm({ ...contentForm, type: e.target.value })} options={CONTENT_TYPE_OPTIONS} />
          {contentForm.type === "TEXT" && (
            <Textarea label="Content" value={contentForm.content} onChange={(e) => setContentForm({ ...contentForm, content: e.target.value })} placeholder="Enter text content..." className="min-h-[120px]" />
          )}
          {contentForm.type !== "TEXT" && (
            <Input label="Media URL" value={contentForm.mediaUrl} onChange={(e) => setContentForm({ ...contentForm, mediaUrl: e.target.value })} placeholder="https://..." />
          )}
          <Input label="Duration (minutes, optional)" type="number" value={contentForm.duration || ""} onChange={(e) => setContentForm({ ...contentForm, duration: parseInt(e.target.value) || 0 })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowContentModal(false)}>Cancel</Button>
            <Button onClick={handleSaveContent} isLoading={saving} disabled={!contentForm.title}><Save className="h-4 w-4 mr-1" /> {editingContent ? "Update" : "Add"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
