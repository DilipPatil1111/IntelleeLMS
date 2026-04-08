"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Film, Music, Archive, Plus, Loader2 } from "lucide-react";

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
}

export interface PendingFile {
  id: string;
  file: File;
  preview?: string;
}

interface FileUploadAreaProps {
  /** Already-uploaded files (from existing lesson content) */
  uploaded: UploadedFile[];
  /** Files staged locally, not yet uploaded */
  pending: PendingFile[];
  /** Called when user adds new files via picker or drop */
  onAddPending: (files: PendingFile[]) => void;
  /** Called when user removes a pending file */
  onRemovePending: (id: string) => void;
  /** Called when user removes an already-uploaded file */
  onRemoveUploaded: (url: string) => void;
  accept?: string;
  label?: string;
  uploading?: boolean;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return <Film className="h-4 w-4 text-blue-500" />;
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) return <Music className="h-4 w-4 text-purple-500" />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return <Archive className="h-4 w-4 text-orange-500" />;
  return <FileText className="h-4 w-4 text-gray-500" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileUploadArea({
  uploaded,
  pending,
  onAddPending,
  onRemovePending,
  onRemoveUploaded,
  accept,
  label = "Drop files here or click to upload",
  uploading = false,
}: FileUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newPending: PendingFile[] = Array.from(fileList).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
    }));
    onAddPending(newPending);
  }, [onAddPending]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const hasAny = uploaded.length > 0 || pending.length > 0;

  return (
    <div className="space-y-2">
      {/* File list */}
      {hasAny && (
        <div className="space-y-1.5">
          {uploaded.map((f) => (
            <div key={f.url} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-white group">
              {fileIcon(f.name)}
              <a href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-sm text-gray-700 hover:text-indigo-600 truncate min-w-0">
                {f.name}
              </a>
              <span className="text-xs text-gray-400 shrink-0">{formatSize(f.size)}</span>
              <button type="button" onClick={() => onRemoveUploaded(f.url)}
                className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 group">
              {uploading
                ? <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />
                : fileIcon(p.file.name)}
              <span className="flex-1 text-sm text-gray-700 truncate min-w-0">{p.file.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatSize(p.file.size)}</span>
              {!uploading && (
                <button type="button" onClick={() => onRemovePending(p.id)}
                  className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone / Add more */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
          dragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40"
        }`}
      >
        {hasAny ? (
          <div className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium">
            <Plus className="h-4 w-4" /> Add more files
          </div>
        ) : (
          <>
            <Upload className="h-6 w-6 text-gray-400" />
            <p className="text-sm text-gray-500 text-center">{label}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
          onClick={(e) => (e.currentTarget.value = "")}
        />
      </div>
    </div>
  );
}
