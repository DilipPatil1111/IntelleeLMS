import { randomUUID } from "crypto";
import path from "path";
import { blobPut, defaultBlobAccess } from "@/lib/vercel-blob";

// ─── Lesson content upload types ─────────────────────────────────────────────

export const LESSON_VIDEO_ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".avi", ".mkv"]);
export const LESSON_AUDIO_ALLOWED_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);
export const LESSON_PDF_ALLOWED_EXT = new Set([".pdf"]);
export const LESSON_PRESENTATION_ALLOWED_EXT = new Set([".ppt", ".pptx", ".pdf"]);
export const LESSON_DOWNLOAD_ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".rar", ".7z", ".tar", ".gz",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".mp4", ".mov", ".webm", ".mp3", ".wav", ".aac",
  ".txt", ".csv", ".json",
]);
export const LESSON_MULTIMEDIA_ALLOWED_EXT = new Set([
  ".zip", ".rar", ".7z", ".tar", ".gz",
  ".html", ".htm",
]);

export const LESSON_VIDEO_MAX_BYTES = 200 * 1024 * 1024;   // 200 MB
export const LESSON_AUDIO_MAX_BYTES = 50 * 1024 * 1024;    // 50 MB
export const LESSON_PDF_MAX_BYTES = 50 * 1024 * 1024;      // 50 MB
export const LESSON_PRESENTATION_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const LESSON_DOWNLOAD_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
export const LESSON_MULTIMEDIA_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

// ─── Existing upload types ────────────────────────────────────────────────────

/** Student onboarding: PDF + common image types. */
export const ONBOARDING_ALLOWED_EXT = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".bmp",
  ".gif",
  ".webp",
  ".tif",
  ".tiff",
  ".heic",
]);

/** Principal templates: Office + PDF. */
export const TEMPLATE_ALLOWED_EXT = new Set([".pdf", ".doc", ".docx"]);

/** Profile pictures: web image formats only. */
export const PROFILE_PICTURE_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ONBOARDING_MAX_BYTES = 12 * 1024 * 1024;
export const TEMPLATE_MAX_BYTES = 8 * 1024 * 1024;
export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;

/** Extension → MIME when the browser sends an empty or wrong `File.type` (common on some OS / drag-drop). */
const PROFILE_EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".pjpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Resolves a trusted image/jpeg | image/png | image/webp | image/gif for profile uploads.
 */
export function resolveProfilePictureMimeType(fileName: string, rawType: string): string {
  let t = (rawType || "").trim().toLowerCase();
  if (t === "image/jpg" || t === "image/pjpeg") t = "image/jpeg";
  if (PROFILE_PICTURE_ALLOWED_MIME.has(t)) return t;

  const ext = path.extname(fileName || "").toLowerCase();
  const inferred = PROFILE_EXT_TO_MIME[ext];
  if (inferred && PROFILE_PICTURE_ALLOWED_MIME.has(inferred)) return inferred;

  return t;
}

export function validateExtension(fileName: string, allowed: Set<string>): string | null {
  const ext = path.extname(fileName).toLowerCase();
  return allowed.has(ext) ? ext : null;
}

/**
 * Uploads a file to Vercel Blob Storage.
 * Falls back with a descriptive error if BLOB_READ_WRITE_TOKEN is not configured.
 */
export async function uploadToBlob(params: {
  buffer: Buffer;
  originalName: string;
  allowedExt: Set<string>;
  maxBytes: number;
  /** Storage folder prefix, e.g. "templates" or "onboarding/userId" */
  folder: string;
}): Promise<{ url: string; storedFileName: string } | { error: string }> {
  const { buffer, originalName, allowedExt, maxBytes, folder } = params;

  if (buffer.length > maxBytes) {
    return { error: `File too large (maximum ${Math.round(maxBytes / 1024 / 1024)} MB).` };
  }

  const ext = validateExtension(originalName, allowedExt);
  if (!ext) {
    return { error: "File type not allowed for this upload." };
  }

  const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const pathname = `${folder}/${safeName}`;

  const blob = await blobPut(pathname, buffer, {
    contentType: getMimeType(ext),
    access: defaultBlobAccess(),
  });

  return { url: blob.url, storedFileName: originalName };
}

/**
 * Uploads a profile picture buffer to Vercel Blob.
 * Returns the public URL to store in the database.
 */
export async function uploadProfilePictureToBlob(params: {
  buffer: Buffer;
  mimeType: string;
  /** Original filename — used to infer MIME when `mimeType` is missing (browser quirk). */
  fileName?: string;
  userId: string;
}): Promise<{ url: string } | { error: string }> {
  const { buffer, userId } = params;
  const fileName = params.fileName ?? "";
  const mimeType = resolveProfilePictureMimeType(fileName, params.mimeType);

  if (buffer.length > PROFILE_PICTURE_MAX_BYTES) {
    return { error: "File too large. Max 5MB." };
  }

  if (!PROFILE_PICTURE_ALLOWED_MIME.has(mimeType)) {
    return { error: "Invalid file type. Use JPEG, PNG, WebP, or GIF (max 5 MB)." };
  }

  const ext = mimeType.split("/")[1] ?? "jpg";
  const pathname = `profile-pictures/${userId}-${Date.now()}.${ext}`;

  try {
    const blob = await blobPut(pathname, buffer, {
      contentType: mimeType,
      // Respect BLOB_ACCESS — forcing "public" breaks private-only Blob stores.
      access: defaultBlobAccess(),
    });

    return { url: blob.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("uploadProfilePictureToBlob", msg);
    if (/public access|private store/i.test(msg)) {
      return {
        error:
          "Blob storage rejected this upload. Check BLOB_READ_WRITE_TOKEN and that your store allows the configured BLOB_ACCESS mode.",
      };
    }
    return { error: "Could not upload file to storage. Try again or use a smaller JPEG/PNG." };
  }
}

export function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".pdf":  "application/pdf",
    ".doc":  "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls":  "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt":  "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif":  "image/gif",
    ".webp": "image/webp",
    ".bmp":  "image/bmp",
    ".svg":  "image/svg+xml",
    ".tif":  "image/tiff",
    ".tiff": "image/tiff",
    ".heic": "image/heic",
    ".mp4":  "video/mp4",
    ".mov":  "video/quicktime",
    ".webm": "video/webm",
    ".avi":  "video/x-msvideo",
    ".mkv":  "video/x-matroska",
    ".mp3":  "audio/mpeg",
    ".wav":  "audio/wav",
    ".ogg":  "audio/ogg",
    ".m4a":  "audio/mp4",
    ".aac":  "audio/aac",
    ".flac": "audio/flac",
    ".zip":  "application/zip",
    ".rar":  "application/vnd.rar",
    ".7z":   "application/x-7z-compressed",
    ".tar":  "application/x-tar",
    ".gz":   "application/gzip",
    ".txt":  "text/plain",
    ".csv":  "text/csv",
    ".json": "application/json",
    ".html": "text/html",
    ".htm":  "text/html",
  };
  return map[ext] ?? "application/octet-stream";
}
