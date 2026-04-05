import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** GET /api/principal/settings/signature — return current user's signature fields */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { signatureImageUrl: true, signatureTypedName: true },
    });

    return NextResponse.json({
      signatureImageUrl: user?.signatureImageUrl ?? null,
      signatureTypedName: user?.signatureTypedName ?? null,
    });
  } catch {
    // Migration not yet applied — return empty gracefully
    return NextResponse.json({ signatureImageUrl: null, signatureTypedName: null });
  }
}

/** PUT /api/principal/settings/signature — save signature fields */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    signatureImageUrl?: string | null;
    signatureTypedName?: string | null;
  };

  try {
    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        signatureImageUrl:
          body.signatureImageUrl !== undefined ? (body.signatureImageUrl || null) : undefined,
        signatureTypedName:
          body.signatureTypedName !== undefined ? (body.signatureTypedName?.trim() || null) : undefined,
      },
      select: { signatureImageUrl: true, signatureTypedName: true },
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch {
    return NextResponse.json({ error: "Migration not yet applied — run `npx prisma migrate dev` to enable signature fields." }, { status: 503 });
  }
}
