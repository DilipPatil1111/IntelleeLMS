import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { seedVaultFolders } from "@/lib/document-vault";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { yearId, programId, batchId } = body as {
    yearId?: string;
    programId?: string;
    batchId?: string;
  };

  if (!yearId || !programId || !batchId) {
    return NextResponse.json(
      { error: "yearId, programId, and batchId are required" },
      { status: 400 },
    );
  }

  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const batch = await db.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  try {
    await seedVaultFolders({
      yearId,
      programId,
      batchId,
      programCode: program.code,
      batchName: batch.name,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[document-vault/seed]", e);
    const message =
      e instanceof Error ? e.message : "Failed to seed document vault folders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
