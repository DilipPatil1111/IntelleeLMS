/**
 * Server-side helper to fetch blob content from Vercel Blob (private or public) or external URLs.
 * Use this when server-side code needs to read a stored file (e.g. PDF template, images).
 */
import { get } from "@vercel/blob";
import { env } from "@/lib/env";

function isVercelBlobUrl(url: string): boolean {
  return url.includes(".blob.vercel-storage.com") || url.includes(".public.blob.vercel-storage.com");
}

/**
 * Fetches blob/file content as a Buffer.
 * - For private Vercel Blob URLs: uses the Blob SDK with the read-write token.
 * - For public/external URLs: uses plain fetch.
 */
export async function fetchBlobAsBuffer(url: string): Promise<Buffer> {
  if (env.BLOB_ACCESS === "private" && isVercelBlobUrl(url)) {
    const token = env.BLOB_READ_WRITE_TOKEN;
    const result = await get(url, {
      access: "private",
      ...(token ? { token } : {}),
    } as Parameters<typeof get>[1]);

    if (!result || result.statusCode !== 200) {
      throw new Error(`Blob not found or inaccessible: ${url} (status: ${result?.statusCode})`);
    }

    const chunks: Uint8Array[] = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }

  // Public blob or external URL — plain fetch
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
