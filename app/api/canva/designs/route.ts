import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidCanvaToken, canvaFetch, isCanvaConfigured } from "@/lib/canva";

/**
 * GET /api/canva/designs
 * Lists the user's Canva designs with optional search.
 * Query params: ?query=search&continuation=token
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const continuation = searchParams.get("continuation") || "";

  try {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (continuation) params.set("continuation", continuation);
    params.set("ownership", "owned");

    const res = await canvaFetch(accessToken, `/designs?${params.toString()}`, {
      method: "GET",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: "Failed to list designs", details: errText }, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      designs: (data.items || []).map((d: Record<string, unknown>) => ({
        id: d.id,
        title: d.title,
        thumbnailUrl: (d.thumbnail as Record<string, unknown>)?.url,
        editUrl: (d.urls as Record<string, unknown>)?.edit_url,
        viewUrl: (d.urls as Record<string, unknown>)?.view_url,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
      continuation: data.continuation || null,
    });
  } catch (err) {
    console.error("Canva list designs exception:", err);
    return NextResponse.json({ error: "Failed to list designs" }, { status: 500 });
  }
}
