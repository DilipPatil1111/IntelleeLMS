import { type NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

/**
 * GET /api/blob-download?url=<blob-url>&filename=<name>&inline=1
 *
 * Authenticated proxy for private Vercel Blob files.
 * When BLOB_ACCESS is "public" (or unset) the client can hit the blob URL
 * directly, but for private stores every read must be authenticated server-side.
 *
 * Query params:
 *   url       – full private blob URL (required)
 *   filename  – suggested download filename (optional, defaults to last path segment)
 *   inline    – if "1" serve with Content-Disposition: inline (for in-browser view);
 *               otherwise attachment (triggers browser download)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const blobUrl = searchParams.get("url");
  if (!blobUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.(?:public|private)\.blob\.vercel-storage\.com\//;
  if (!BLOB_URL_RE.test(blobUrl)) {
    return new NextResponse("Invalid blob URL", { status: 400 });
  }

  const inline = searchParams.get("inline") === "1";
  const rawFilename =
    searchParams.get("filename") ??
    decodeURIComponent(blobUrl.split("/").pop() ?? "file");
  const filename = rawFilename.replace(/["\r\n\\]/g, "_");

  const token = env.BLOB_READ_WRITE_TOKEN;

  try {
    const result = await get(blobUrl, {
      access: "private",
      ...(token ? { token } : {}),
    } as Parameters<typeof get>[1]);

    if (!result || result.statusCode !== 200) {
      return new NextResponse("Blob not found", { status: 404 });
    }

    const disposition = inline
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[blob-download] error", err);
    return new NextResponse("Failed to fetch blob", { status: 502 });
  }
}
