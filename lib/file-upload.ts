import { randomUUID } from "crypto";
import path from "path";
import { blobPut, defaultBlobAccess } from "@/lib/vercel-blob";

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
