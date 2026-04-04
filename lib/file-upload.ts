import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import path from "path";

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

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: getMimeType(ext),
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
  userId: string;
}): Promise<{ url: string } | { error: string }> {
  const { buffer, mimeType, userId } = params;

  if (buffer.length > PROFILE_PICTURE_MAX_BYTES) {
    return { error: "File too large. Max 5MB." };
  }

  if (!PROFILE_PICTURE_ALLOWED_MIME.has(mimeType)) {
    return { error: "Invalid file type. Use JPEG, PNG, WebP, or GIF." };
  }

  const ext = mimeType.split("/")[1] ?? "jpg";
  const pathname = `profile-pictures/${userId}-${Date.now()}.${ext}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
  });

  return { url: blob.url };
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".heic": "image/heic",
  };
  return map[ext] ?? "application/octet-stream";
}
