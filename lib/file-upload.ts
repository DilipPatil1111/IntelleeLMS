import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

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

export const ONBOARDING_MAX_BYTES = 12 * 1024 * 1024;
export const TEMPLATE_MAX_BYTES = 8 * 1024 * 1024;

export function validateExtension(fileName: string, allowed: Set<string>): string | null {
  const ext = path.extname(fileName).toLowerCase();
  return allowed.has(ext) ? ext : null;
}

export async function writePublicUpload(params: {
  buffer: Buffer;
  originalName: string;
  allowedExt: Set<string>;
  maxBytes: number;
  /** e.g. `templates` or `onboarding/userId` */
  publicSubdir: string;
}): Promise<{ url: string; storedFileName: string } | { error: string }> {
  const { buffer, originalName, allowedExt, maxBytes, publicSubdir } = params;
  if (buffer.length > maxBytes) {
    return { error: `File too large (maximum ${Math.round(maxBytes / 1024 / 1024)} MB).` };
  }
  const ext = validateExtension(originalName, allowedExt);
  if (!ext) {
    return { error: "File type not allowed for this upload." };
  }

  const safe = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const relDir = path.join("public", "uploads", publicSubdir);
  const absDir = path.join(process.cwd(), relDir);
  const absFile = path.join(absDir, safe);

  try {
    await mkdir(absDir, { recursive: true });
    await writeFile(absFile, buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      error: `Could not save file (${msg}). On serverless hosts (e.g. Vercel) the filesystem is often read-only—add blob storage or a writable volume for production uploads.`,
    };
  }

  const urlPath = `/uploads/${publicSubdir.replace(/\\/g, "/")}/${safe}`;
  return { url: urlPath, storedFileName: originalName };
}
