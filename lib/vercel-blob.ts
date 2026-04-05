/**
 * Server-only Vercel Blob helpers.
 * Do NOT import this file from "use client" components — it imports lib/env.ts
 * which reads server-side environment variables via process.env at module load time.
 *
 * For client components that need to build blob download URLs, use lib/blob-url.ts instead.
 */
import { del, put } from "@vercel/blob";
import { env } from "@/lib/env";

export function defaultBlobAccess(): "public" | "private" {
  return env.BLOB_ACCESS === "private" ? "private" : "public";
}

type BlobPutOptions = NonNullable<Parameters<typeof put>[2]>;

/** Passes `BLOB_READ_WRITE_TOKEN` when set (required for Vercel Blob outside Vercel runtime). */
export async function blobPut(
  pathname: string,
  body: Parameters<typeof put>[1],
  options?: Omit<BlobPutOptions, "access"> & { access?: BlobPutOptions["access"] },
) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  const { access: optAccess, ...rest } = options ?? {};
  return put(pathname, body, {
    ...rest,
    access: optAccess ?? defaultBlobAccess(),
    ...(token ? { token } : {}),
  });
}

export async function blobDel(
  url: string,
  options?: Parameters<typeof del>[1],
) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  return del(url, {
    ...options,
    ...(token ? { token } : {}),
  });
}
