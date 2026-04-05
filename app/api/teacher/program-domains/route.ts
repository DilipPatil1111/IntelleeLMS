import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await db.programDomain.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ domains: items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const customerId =
    typeof body.customerId === "string" && body.customerId.trim() !== ""
      ? body.customerId.trim()
      : null;
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;

  try {
    const domain = await db.programDomain.create({
      data: { name, customerId, sortOrder, isActive: body.isActive !== false },
    });
    return NextResponse.json({ domain });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "customerId must be unique when set." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
