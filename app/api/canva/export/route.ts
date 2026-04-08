import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidCanvaToken, canvaFetch, isCanvaConfigured } from "@/lib/canva";
import { uploadToBlob, TEMPLATE_MAX_BYTES } from "@/lib/file-upload";

/**
 * POST /api/canva/export
 * Exports a Canva design as PDF or PNG and optionally saves to Blob storage.
 *
 * Body: { designId: string, format?: "pdf" | "png" | "jpg", save?: boolean }
 * - If save=true, the exported file is uploaded to Vercel Blob and URL is returned.
 * - Otherwise, just the Canva export URL is returned.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isCanvaConfigured()) {
    return NextResponse.json({ error: "Canva is not configured" }, { status: 503 });
  }

  const accessToken = await getValidCanvaToken(session.user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "Canva not connected" }, { status: 403 });
  }

  const body = await request.json();
  const { designId, format = "pdf", save = true } = body;

  if (!designId) {
    return NextResponse.json({ error: "designId is required" }, { status: 400 });
  }

  try {
    // Step 1: Create export job
    const exportRes = await canvaFetch(accessToken, "/exports", {
      method: "POST",
      body: JSON.stringify({
        design_id: designId,
        format: {
          type: format.toUpperCase(),
        },
      }),
    });

    if (!exportRes.ok) {
      const errText = await exportRes.text();
      console.error("Canva export create error:", exportRes.status, errText);
      return NextResponse.json({ error: "Failed to start export", details: errText }, { status: exportRes.status });
    }

    const exportData = await exportRes.json();
    const jobId = exportData.job?.id;

    if (!jobId) {
      return NextResponse.json({ error: "No export job ID returned" }, { status: 500 });
    }

    // Step 2: Poll until the export is complete (Canva processes exports async)
    let attempts = 0;
    const maxAttempts = 30;
    let downloadUrl: string | null = null;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusRes = await canvaFetch(accessToken, `/exports/${jobId}`);
      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.job?.status === "success") {
        downloadUrl = statusData.job.urls?.[0];
        break;
      }

      if (statusData.job?.status === "failed") {
        return NextResponse.json({ error: "Canva export failed", details: statusData.job.error }, { status: 500 });
      }
    }

    if (!downloadUrl) {
      return NextResponse.json({ error: "Export timed out" }, { status: 504 });
    }

    // Step 3: Optionally download and save to Blob storage
    if (save) {
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        return NextResponse.json({ error: "Failed to download exported file from Canva" }, { status: 502 });
      }

      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const ext = format === "pdf" ? ".pdf" : format === "png" ? ".png" : ".jpg";
      const allowedExt = new Set([ext]);

      const result = await uploadToBlob({
        buffer,
        originalName: `canva-export-${designId}${ext}`,
        allowedExt,
        maxBytes: TEMPLATE_MAX_BYTES,
        folder: "canva-exports",
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        url: result.url,
        storedFileName: result.storedFileName,
        designId,
        format,
      });
    }

    return NextResponse.json({ downloadUrl, designId, format });
  } catch (err) {
    console.error("Canva export exception:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
