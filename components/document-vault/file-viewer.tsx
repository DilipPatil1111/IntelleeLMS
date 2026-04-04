"use client";

import { cn } from "@/lib/utils";
import {
  Maximize2,
  Minimize2,
  X,
  Download,
  FileText,
  Image as ImageIcon,
  File,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface FileViewerProps {
  fileUrl: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  onClose: () => void;
}

type ViewState = "windowed" | "maximized" | "minimized";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategory(
  contentType: string,
  fileName: string
): "pdf" | "image" | "office" | "other" {
  if (contentType === "application/pdf" || fileName.endsWith(".pdf"))
    return "pdf";

  if (contentType.startsWith("image/")) return "image";

  const officeExtensions = [".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt"];
  const officeTypes = [
    "application/vnd.openxmlformats-officedocument",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ];
  if (
    officeExtensions.some((ext) => fileName.toLowerCase().endsWith(ext)) ||
    officeTypes.some((t) => contentType.startsWith(t))
  )
    return "office";

  return "other";
}

function getTypeBadge(category: "pdf" | "image" | "office" | "other") {
  switch (category) {
    case "pdf":
      return { label: "PDF", icon: FileText, color: "bg-red-100 text-red-700" };
    case "image":
      return {
        label: "Image",
        icon: ImageIcon,
        color: "bg-blue-100 text-blue-700",
      };
    case "office":
      return {
        label: "Doc",
        icon: FileText,
        color: "bg-indigo-100 text-indigo-700",
      };
    default:
      return {
        label: "Other",
        icon: File,
        color: "bg-gray-100 text-gray-700",
      };
  }
}

export function FileViewer({
  fileUrl,
  fileName,
  contentType,
  fileSize,
  onClose,
}: FileViewerProps) {
  const [viewState, setViewState] = useState<ViewState>("windowed");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const category = getFileCategory(contentType, fileName);
  const badge = getTypeBadge(category);
  const BadgeIcon = badge.icon;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (viewState === "maximized" || viewState === "minimized") return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: position.x,
        originY: position.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        setPosition({
          x: dragRef.current.originX + dx,
          y: dragRef.current.originY + dy,
        });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [viewState, position]
  );

  const toggleMaximize = () => {
    if (viewState === "maximized") {
      setViewState("windowed");
    } else {
      setViewState("maximized");
      setPosition({ x: 0, y: 0 });
    }
  };

  const toggleMinimize = () => {
    if (viewState === "minimized") {
      setViewState("windowed");
    } else {
      setViewState("minimized");
    }
  };

  if (viewState === "minimized") {
    return (
      <div
        className="fixed bottom-0 left-0 z-50 flex h-12 w-72 cursor-pointer items-center gap-2 rounded-tr-lg bg-white px-3 shadow-lg border border-gray-200"
        onClick={toggleMinimize}
      >
        <FileText className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="truncate text-sm font-medium text-gray-700">
          {fileName}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-auto rounded p-0.5 hover:bg-gray-100"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    );
  }

  const isMaximized = viewState === "maximized";

  const containerStyle: React.CSSProperties = isMaximized
    ? { width: "100vw", height: "100vh", top: 0, left: 0 }
    : {
        width: "70vw",
        height: "70vh",
        minWidth: 400,
        minHeight: 300,
        resize: "both" as const,
        transform: `translate(${position.x}px, ${position.y}px)`,
      };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      <div
        ref={containerRef}
        className={cn(
          "relative z-10 flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl",
          isMaximized && "!rounded-none"
        )}
        style={containerStyle}
      >
        {/* Header */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5",
            !isMaximized && "cursor-grab active:cursor-grabbing"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                badge.color
              )}
            >
              <BadgeIcon className="h-3 w-3" />
              {badge.label}
            </span>
            <span className="truncate text-sm font-medium text-gray-800">
              {fileName}
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              {formatFileSize(fileSize)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <a
              href={fileUrl}
              download={fileName}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              title="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={toggleMinimize}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={toggleMaximize}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <FileContent
            fileUrl={fileUrl}
            fileName={fileName}
            category={category}
          />
        </div>
      </div>
    </div>
  );
}

function FileContent({
  fileUrl,
  fileName,
  category,
}: {
  fileUrl: string;
  fileName: string;
  category: "pdf" | "image" | "office" | "other";
}) {
  switch (category) {
    case "pdf":
      return (
        <iframe
          src={fileUrl}
          className="h-full w-full border-0"
          title={fileName}
        />
      );
    case "image":
      return (
        <div className="flex h-full items-center justify-center bg-gray-950/5 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={fileName}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    case "office":
      return (
        <iframe
          src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
          className="h-full w-full border-0"
          title={fileName}
        />
      );
    default:
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
          <File className="h-16 w-16 text-gray-300" />
          <p className="text-sm text-gray-500">
            Preview not available for this file type.
          </p>
          <a
            href={fileUrl}
            download={fileName}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Download File
          </a>
        </div>
      );
  }
}
