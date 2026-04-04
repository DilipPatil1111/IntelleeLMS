"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, CheckCircle, Lock, Play, FileText, Music, Image as ImageIcon, Link2, Film } from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  type: string;
  content: string | null;
  mediaUrl: string | null;
  duration: number | null;
}

interface TopicData {
  id: string;
  name: string;
  description: string | null;
  contents: ContentItem[];
  _count: { contents: number };
  progress: { isCompleted: boolean }[];
}

interface ModuleProgress {
  moduleId: string;
  moduleName: string;
  requiresCompletion: boolean;
  totalTopics: number;
  completedTopics: number;
  totalAssessments: number;
  completedAssessments: number;
  percentComplete: number;
  isLocked: boolean;
}

interface SubjectProgress {
  subjectId: string;
  subjectName: string;
  modules: ModuleProgress[];
}

export default function StudentProgramPage() {
  const [progress, setProgress] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboardingLocked, setOnboardingLocked] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [topics, setTopics] = useState<Record<string, TopicData[]>>({});
  const [loadingTopics, setLoadingTopics] = useState<string | null>(null);
  const [viewingContent, setViewingContent] = useState<ContentItem | null>(null);

  useEffect(() => {
    fetch("/api/student/progress")
      .then((r) => r.json())
      .then((data) => {
        setProgress(data.progress || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/student/onboarding")
      .then((r) => r.json())
      .then((data: { onboarding?: { principalConfirmedAt?: string | null }; studentProfileStatus?: string | null }) => {
        const o = data.onboarding;
        const spStatus = data.studentProfileStatus;
        if (!o) {
          setOnboardingLocked(false);
          return;
        }
        /** ACCEPTED = onboarding phase: hide course modules until principal unlocks (→ ENROLLED). */
        if (spStatus === "ACCEPTED") {
          setOnboardingLocked(!o.principalConfirmedAt);
          return;
        }
        setOnboardingLocked(false);
      })
      .catch(() => setOnboardingLocked(false));
  }, []);

  async function loadTopics(moduleId: string) {
    if (topics[moduleId]) { setExpandedModule(moduleId); return; }
    setLoadingTopics(moduleId);
    setExpandedModule(moduleId);
    const res = await fetch(`/api/teacher/modules/${moduleId}`);
    const data = await res.json();
    if (data.module?.topics) {
      setTopics((prev) => ({ ...prev, [moduleId]: data.module.topics }));
    }
    setLoadingTopics(null);
  }

  async function markComplete(topicId: string, moduleId: string) {
    await fetch("/api/student/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId }),
    });
    const res = await fetch(`/api/teacher/modules/${moduleId}`);
    const data = await res.json();
    if (data.module?.topics) setTopics((prev) => ({ ...prev, [moduleId]: data.module.topics }));
    const progressRes = await fetch("/api/student/progress");
    const progressData = await progressRes.json();
    setProgress(progressData.progress || []);
  }

  const contentIcon = (type: string) => {
    switch (type) {
      case "VIDEO": return <Film className="h-4 w-4 text-purple-500" />;
      case "AUDIO": return <Music className="h-4 w-4 text-green-500" />;
      case "IMAGE": return <ImageIcon className="h-4 w-4 text-blue-500" />;
      case "URL": return <Link2 className="h-4 w-4 text-cyan-500" />;
      default: return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading program...</p></div>;

  if (onboardingLocked) {
    return (
      <>
        <PageHeader title="My Program" description="Course content" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="font-medium">Course content unlocks after your principal confirms your onboarding.</p>
          <p className="mt-2 text-sm">
            You can complete checklist steps, take assigned assessments, and use Fees and Results anytime. When your principal approves onboarding, My Program, Attendance, and the full menu unlock.
          </p>
          <Link href="/student/onboarding" className="mt-4 inline-block text-sm font-medium text-indigo-600 underline">
            View onboarding checklist
          </Link>
          <Link href="/student/assessments" className="mt-4 ml-4 inline-block text-sm font-medium text-indigo-600 underline">
            My assessments
          </Link>
        </div>
      </>
    );
  }

  if (progress.length === 0) {
    return (
      <>
        <PageHeader title="My Program" description="View course content and track your progress" />
        <Card><CardContent><p className="text-center text-gray-500 py-12">No program content available yet. Please wait for your teachers to publish modules.</p></CardContent></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="My Program" description="View course content and track your progress" />

      <div className="space-y-6">
        {progress.map((subject) => (
          <Card key={subject.subjectId}>
            <CardHeader><CardTitle>{subject.subjectName}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subject.modules.map((mod) => (
                  <div key={mod.moduleId}>
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${mod.isLocked ? "bg-gray-100 opacity-60" : "hover:bg-gray-50"} ${expandedModule === mod.moduleId ? "border-indigo-300 bg-indigo-50" : "border-gray-200"}`}
                      onClick={() => !mod.isLocked && (expandedModule === mod.moduleId ? setExpandedModule(null) : loadTopics(mod.moduleId))}
                    >
                      <div className="flex items-center gap-3">
                        {mod.isLocked ? <Lock className="h-5 w-5 text-gray-400" /> : mod.percentComplete === 100 ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Play className="h-5 w-5 text-indigo-500" />}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{mod.moduleName}</p>
                          <p className="text-xs text-gray-500">{mod.completedTopics}/{mod.totalTopics} topics complete</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${mod.percentComplete}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 w-8">{mod.percentComplete}%</span>
                        {expandedModule === mod.moduleId ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>

                    {expandedModule === mod.moduleId && (
                      <div className="ml-8 mt-2 space-y-2">
                        {loadingTopics === mod.moduleId ? (
                          <p className="text-sm text-gray-400 p-2">Loading topics...</p>
                        ) : (
                          (topics[mod.moduleId] || []).map((topic) => {
                            const isComplete = topic.progress?.some((p) => p.isCompleted);
                            return (
                              <div key={topic.id} className="p-3 rounded-lg border border-gray-100 bg-white">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {isComplete ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
                                    <p className="text-sm font-medium">{topic.name}</p>
                                  </div>
                                  {!isComplete && (
                                    <Button size="sm" variant="outline" onClick={() => markComplete(topic.id, mod.moduleId)}>
                                      Mark Complete
                                    </Button>
                                  )}
                                </div>
                                {topic.contents.length > 0 && (
                                  <div className="ml-6 space-y-1">
                                    {topic.contents.map((c) => (
                                      <button key={c.id} onClick={() => setViewingContent(c)} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 w-full text-left">
                                        {contentIcon(c.type)}
                                        <span className="text-xs text-gray-700">{c.title}</span>
                                        {c.duration && <span className="text-xs text-gray-400 ml-auto">{c.duration}min</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {viewingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewingContent(null)} />
          <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{viewingContent.title}</h3>
              <button onClick={() => setViewingContent(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <Badge className="mb-4">{viewingContent.type}</Badge>
            {viewingContent.type === "TEXT" && viewingContent.content && (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{viewingContent.content}</div>
            )}
            {viewingContent.type === "VIDEO" && viewingContent.mediaUrl && (
              <div className="aspect-video rounded overflow-hidden">
                {viewingContent.mediaUrl.includes("youtube") || viewingContent.mediaUrl.includes("youtu.be") ? (
                  <iframe src={viewingContent.mediaUrl.replace("watch?v=", "embed/")} className="w-full h-full" allowFullScreen />
                ) : (
                  <video src={viewingContent.mediaUrl} controls className="w-full h-full" />
                )}
              </div>
            )}
            {viewingContent.type === "AUDIO" && viewingContent.mediaUrl && (
              <audio src={viewingContent.mediaUrl} controls className="w-full" />
            )}
            {viewingContent.type === "IMAGE" && viewingContent.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewingContent.mediaUrl} alt={viewingContent.title} className="max-w-full rounded" />
            )}
            {(viewingContent.type === "URL" || viewingContent.type === "DOCUMENT" || viewingContent.type === "PRESENTATION") && viewingContent.mediaUrl && (
              <a href={viewingContent.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                Open resource in new tab
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
