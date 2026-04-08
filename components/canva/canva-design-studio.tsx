"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  Palette, LinkIcon, Unlink, Plus, ExternalLink,
  Download, Loader2, Search, FileText, Image as ImageIcon,
  RefreshCw, AlertTriangle,
} from "lucide-react";

const PAGE_SIZE = 9;

interface CanvaDesign {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  editUrl: string | null;
  viewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CanvaStatus {
  configured: boolean;
  connected: boolean;
  canvaUserId: string | null;
  tokenExpires: string | null;
}

const DESIGN_TYPES = [
  { value: "", label: "Custom size" },
  { value: "doc", label: "Document" },
  { value: "whiteboard", label: "Whiteboard" },
  { value: "presentation", label: "Presentation" },
];

interface Props {
  /** Callback after a design is exported and saved — receives the Blob storage URL */
  onDesignExported?: (url: string, fileName: string) => void;
}

export function CanvaDesignStudio({ onDesignExported }: Props) {
  const [status, setStatus] = useState<CanvaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<CanvaDesign[]>([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [continuation, setContinuation] = useState<string | null>(null);

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    designType: "",
    width: 2480,
    height: 1754,
  });
  const [creating, setCreating] = useState(false);

  const [exporting, setExporting] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "png">("pdf");
  const [exportModal, setExportModal] = useState<CanvaDesign | null>(null);

  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/canva/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ configured: false, connected: false, canvaUserId: null, tokenExpires: null });
    }
    setLoading(false);
  }, []);

  const loadDesigns = useCallback(async (query = "", cont = "") => {
    if (!status?.connected) return;
    setDesignsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (cont) params.set("continuation", cont);
      const res = await fetch(`/api/canva/designs?${params}`);
      const data = await res.json();
      if (cont) {
        setDesigns((prev) => [...prev, ...(data.designs || [])]);
      } else {
        setDesigns(data.designs || []);
      }
      setContinuation(data.continuation || null);
    } catch {
      setDesigns([]);
    }
    setDesignsLoading(false);
  }, [status?.connected]);

  useEffect(() => { void checkStatus(); }, [checkStatus]);
  useEffect(() => {
    if (status?.connected) void loadDesigns();
  }, [status?.connected, loadDesigns]);

  async function handleConnect() {
    try {
      const res = await fetch("/api/canva/authorize");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ message: data.error || "Failed to start Canva authorization", tone: "error" });
      }
    } catch {
      setToast({ message: "Failed to connect to Canva", tone: "error" });
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your Canva account? You'll need to re-authorize to use Canva features.")) return;
    await fetch("/api/canva/disconnect", { method: "POST" });
    setStatus((s) => s ? { ...s, connected: false, canvaUserId: null, tokenExpires: null } : s);
    setDesigns([]);
    setToast({ message: "Canva account disconnected", tone: "success" });
  }

  async function handleCreateDesign() {
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { title: createForm.title || "Untitled Design" };
      if (createForm.designType) {
        payload.designType = createForm.designType;
      } else {
        payload.width = createForm.width;
        payload.height = createForm.height;
      }

      const res = await fetch("/api/canva/create-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.editUrl) {
        window.open(data.editUrl, "_blank");
        setCreateModal(false);
        setToast({ message: "Design opened in Canva — switch to the new tab to start designing", tone: "success" });
        setTimeout(() => void loadDesigns(), 3000);
      } else {
        setToast({ message: data.error || "Failed to create design", tone: "error" });
      }
    } catch {
      setToast({ message: "Failed to create design", tone: "error" });
    }
    setCreating(false);
  }

  async function handleExport(design: CanvaDesign) {
    setExporting(design.id);
    try {
      const res = await fetch("/api/canva/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: design.id, format: exportFormat, save: true }),
      });
      const data = await res.json();

      if (data.url) {
        setToast({ message: `Design exported as ${exportFormat.toUpperCase()} and saved`, tone: "success" });
        if (onDesignExported) {
          onDesignExported(data.url, data.storedFileName || `canva-${design.id}.${exportFormat}`);
        }
        setExportModal(null);
      } else {
        setToast({ message: data.error || "Export failed", tone: "error" });
      }
    } catch {
      setToast({ message: "Export failed", tone: "error" });
    }
    setExporting(null);
  }

  function handleSearch() {
    setPage(1);
    void loadDesigns(searchQuery);
  }

  const paged = designs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-sm text-gray-500">Checking Canva status...</span>
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Canva Integration Not Configured</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
              To use Canva for designing templates, certificates, newsletters, brochures, and flyers, you need to set up Canva API credentials.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left max-w-lg mx-auto">
              <p className="text-sm font-medium text-gray-700 mb-2">Setup steps:</p>
              <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
                <li>Go to <a href="https://www.canva.com/developers/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">canva.com/developers</a> and create an integration</li>
                <li>Get your <code className="bg-gray-100 px-1 rounded text-xs">Client ID</code> and <code className="bg-gray-100 px-1 rounded text-xs">Client Secret</code></li>
                <li>Set redirect URL to: <code className="bg-gray-100 px-1 rounded text-xs break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/canva/callback</code></li>
                <li>Add the following environment variables:
                  <ul className="ml-5 mt-1 space-y-0.5 list-disc text-xs text-gray-500">
                    <li><code className="bg-gray-100 px-1 rounded">CANVA_CLIENT_ID</code></li>
                    <li><code className="bg-gray-100 px-1 rounded">CANVA_CLIENT_SECRET</code></li>
                    <li><code className="bg-gray-100 px-1 rounded">CANVA_REDIRECT_URI</code></li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {toast && (
        <div className={cn(
          "fixed right-4 top-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg",
          toast.tone === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800",
        )}>
          {toast.message}
        </div>
      )}

      {/* Connection status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-purple-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Canva Design Studio</p>
            <p className="text-xs text-gray-500">
              {status?.connected
                ? "Connected — create professional designs in Canva and import them into your app"
                : "Connect your Canva account to start designing"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.connected ? (
            <>
              <Badge variant="success" className="gap-1"><LinkIcon className="h-3 w-3" /> Connected</Badge>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                <Unlink className="h-3.5 w-3.5" /> Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
              <LinkIcon className="h-4 w-4" /> Connect Canva Account
            </Button>
          )}
        </div>
      </div>

      {!status?.connected ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <Palette className="h-12 w-12 text-purple-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Canva Account</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                Design certificates, newsletters, brochures, flyers, and more using Canva&apos;s professional design tools. Export your designs as PDF or image and use them as templates.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto mb-6">
                {["Certificates", "Newsletters", "Brochures", "Flyers"].map((item) => (
                  <div key={item} className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                    <p className="text-sm font-medium text-purple-700">{item}</p>
                  </div>
                ))}
              </div>
              <Button onClick={handleConnect} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                <LinkIcon className="h-4 w-4" /> Connect Canva Account
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-0 max-w-sm">
              <Input
                placeholder="Search your Canva designs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              />
              <Button variant="outline" size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPage(1); void loadDesigns(searchQuery); }}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button onClick={() => { setCreateForm({ title: "", designType: "", width: 2480, height: 1754 }); setCreateModal(true); }}>
                <Plus className="h-4 w-4" /> New Design
              </Button>
            </div>
          </div>

          {/* Designs grid */}
          {designsLoading && designs.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}><CardContent><div className="h-40 animate-pulse bg-gray-100 rounded" /></CardContent></Card>
              ))}
            </div>
          ) : designs.length === 0 ? (
            <Card>
              <CardContent>
                <div className="text-center py-12">
                  <Palette className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No Canva designs found</p>
                  <p className="text-sm text-gray-400 mb-4">Create a new design in Canva to get started.</p>
                  <Button onClick={() => { setCreateForm({ title: "", designType: "", width: 2480, height: 1754 }); setCreateModal(true); }}>
                    <Plus className="h-4 w-4" /> Create Your First Design
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paged.map((design) => (
                  <Card key={design.id} className="group overflow-hidden hover:shadow-md transition-shadow">
                    <div className="relative bg-gray-50 border-b border-gray-200" style={{ aspectRatio: "16/10" }}>
                      {design.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={design.thumbnailUrl} alt={design.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
                          <Palette className="h-10 w-10 text-purple-200" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm truncate">{design.title || "Untitled"}</CardTitle>
                      {design.updatedAt && (
                        <p className="text-xs text-gray-400">
                          Updated {new Date(design.updatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {design.editUrl && (
                          <a href={design.editUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-3.5 w-3.5" /> Edit in Canva
                            </Button>
                          </a>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setExportFormat("pdf"); setExportModal(design); }}>
                          <Download className="h-3.5 w-3.5" /> Export
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={Math.max(1, Math.ceil(designs.length / PAGE_SIZE))}
                onPageChange={setPage}
                className="mt-4"
              />
              {continuation && page >= Math.ceil(designs.length / PAGE_SIZE) && (
                <div className="text-center mt-2">
                  <Button variant="outline" size="sm" onClick={() => void loadDesigns(searchQuery, continuation)} disabled={designsLoading}>
                    {designsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Load more designs
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Create Design Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create New Canva Design" className="max-w-lg">
        <div className="space-y-4">
          <Input
            label="Design title"
            value={createForm.title}
            onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Certificate of Completion"
          />
          <Select
            label="Design type"
            value={createForm.designType}
            onChange={(e) => setCreateForm((f) => ({ ...f, designType: e.target.value }))}
            options={DESIGN_TYPES}
          />
          {!createForm.designType && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Width (px)"
                type="number"
                value={createForm.width}
                onChange={(e) => setCreateForm((f) => ({ ...f, width: Number(e.target.value) }))}
              />
              <Input
                label="Height (px)"
                type="number"
                value={createForm.height}
                onChange={(e) => setCreateForm((f) => ({ ...f, height: Number(e.target.value) }))}
              />
              <p className="col-span-2 text-xs text-gray-400">
                Default is A4 landscape at 300 DPI (2480 x 1754). For portrait, use 1754 x 2480.
              </p>
            </div>
          )}
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <p className="text-xs text-purple-700">
              This will create a new design in Canva and open it in a new tab. After designing, return here and use the &ldquo;Export&rdquo; button to download the design as PDF or image.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button
            onClick={() => void handleCreateDesign()}
            isLoading={creating}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Palette className="h-4 w-4" /> Create &amp; Open in Canva
          </Button>
        </div>
      </Modal>

      {/* Export Design Modal */}
      <Modal isOpen={!!exportModal} onClose={() => setExportModal(null)} title={`Export Design — ${exportModal?.title ?? ""}`} className="max-w-md">
        {exportModal && (
          <div className="space-y-4">
            {exportModal.thumbnailUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={exportModal.thumbnailUrl} alt={exportModal.title} className="w-full h-40 object-cover" />
              </div>
            )}
            <Select
              label="Export format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "pdf" | "png")}
              options={[
                { value: "pdf", label: "PDF — for certificates & documents" },
                { value: "png", label: "PNG — for images & backgrounds" },
              ]}
            />
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-blue-700">
                {exportFormat === "pdf"
                  ? "The exported PDF can be used directly as a certificate template background."
                  : "The exported image can be used as a background for certificates or embedded in newsletters."}
              </p>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setExportModal(null)}>Cancel</Button>
          {exportModal && (
            <Button
              onClick={() => void handleExport(exportModal)}
              isLoading={exporting === exportModal.id}
              disabled={!!exporting}
            >
              {exporting === exportModal.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : exportFormat === "pdf" ? (
                <FileText className="h-4 w-4" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              Export as {exportFormat.toUpperCase()}
            </Button>
          )}
        </div>
      </Modal>
    </>
  );
}
