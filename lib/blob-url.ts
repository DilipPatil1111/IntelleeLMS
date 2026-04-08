/**
 * Client-safe blob URL helper.
 *
 * This module has NO server-side imports (no lib/env.ts, no @vercel/blob).
 * It is safe to use in "use client" components.
 *
 * How it works:
 *   - When NEXT_PUBLIC_BLOB_ACCESS === "private" every blob URL is routed
 *     through /api/blob-download so the server can attach the token.
 *   - Otherwise the blob URL is returned as-is (public stores serve directly).
 */

function isPrivateStore(): boolean {
  return process.env.NEXT_PUBLIC_BLOB_ACCESS === "private";
}

/**
 * Returns the URL the browser should use to view or download a blob file.
 *
 * @param blobUrl  The raw URL stored in the database (e.g. fileUrl).
 * @param filename Optional filename hint for the Content-Disposition header.
 * @param inline   Pass true to open in-browser (images/PDFs); false triggers download.
 */
export function blobFileUrl(
  blobUrl: string,
  filename?: string,
  inline = false,
): string {
  if (!blobUrl) return blobUrl;
  if (!isPrivateStore()) return blobUrl;

  // External URLs (not Vercel Blob) should be served directly
  if (blobUrl.startsWith("http") && !blobUrl.includes(".blob.vercel-storage.com") && !blobUrl.includes(".public.blob.vercel-storage.com")) {
    return blobUrl;
  }

  const params = new URLSearchParams({ url: blobUrl });
  if (filename) params.set("filename", filename);
  if (inline) params.set("inline", "1");
  return `/api/blob-download?${params.toString()}`;
}
