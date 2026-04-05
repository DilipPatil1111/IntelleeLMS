import { del, put } from "@vercel/blob";
import { env } from "@/lib/env";

/** Passes `BLOB_READ_WRITE_TOKEN` when set (required for Vercel Blob outside Vercel runtime). */
export async function blobPut(
  pathname: string,
  body: Parameters<typeof put>[1],
  options?: Parameters<typeof put>[2],
) {
  const token = env.BLOB_READ_WRITE_TOKEN;
  return put(pathname, body, {
    ...(options ?? {}),
    access: options?.access ?? "public",
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
