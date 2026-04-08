import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidCanvaToken, canvaFetch, isCanvaConfigured } from "@/lib/canva";

/**
 * POST /api/canva/create-design
 * Creates a new design in Canva and returns the edit URL.
 *
 * Body: { title?: string, designType?: string, width?: number, height?: number }
 *
 * designType can be: "doc", "whiteboard", "presentation", or omitted for custom size.
 * If width and height are provided (in px), a custom-sized design is created.
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
    return NextResponse.json({ error: "Canva not connected. Please connect your Canva account first." }, { status: 403 });
  }

  const body = await request.json();
  const title = body.title || "Untitled Design";

  const designPayload: Record<string, unknown> = {
    design_type: body.designType || undefined,
    title,
  };

  if (body.width && body.height) {
    designPayload.design_type = undefined;
    designPayload.dimensions = {
      width: body.width,
      height: body.height,
      units: "px",
    };
  }

  Object.keys(designPayload).forEach(
    (key) => designPayload[key] === undefined && delete designPayload[key]
  );

  try {
    const res = await canvaFetch(accessToken, "/designs", {
      method: "POST",
      body: JSON.stringify(designPayload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Canva create-design error:", res.status, errBody);
      return NextResponse.json({ error: "Failed to create Canva design", details: errBody }, { status: res.status });
    }

    const data = await res.json();
    // data.design.id, data.design.urls.edit_url, data.design.urls.view_url
    return NextResponse.json({
      designId: data.design?.id,
      editUrl: data.design?.urls?.edit_url,
      viewUrl: data.design?.urls?.view_url,
      title: data.design?.title,
    });
  } catch (err) {
    console.error("Canva create-design exception:", err);
    return NextResponse.json({ error: "Failed to create design" }, { status: 500 });
  }
}
