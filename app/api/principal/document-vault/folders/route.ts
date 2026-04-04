import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FolderScope, Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearId = searchParams.get("yearId");
  const programId = searchParams.get("programId");
  const batchId = searchParams.get("batchId");

  if (!yearId) {
    return NextResponse.json({ error: "yearId is required" }, { status: 400 });
  }

  try {
    const orConditions: Prisma.DocFolderWhereInput[] = [
      { yearId, scope: FolderScope.GENERIC },
      { yearId, scope: FolderScope.YEAR_SPECIFIC },
    ];

    if (programId && batchId) {
      orConditions.push({
        programId,
        batchId,
        scope: FolderScope.BATCH_SPECIFIC,
      });
    }

    const folders = await db.docFolder.findMany({
      where: { OR: orConditions },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        parentId: true,
        scope: true,
        yearId: true,
        programId: true,
        batchId: true,
        isAutoPopulated: true,
        autoPopulateKey: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ folders });
  } catch (e) {
    console.error("[document-vault/folders GET]", e);
    const message =
      e instanceof Error ? e.message : "Failed to load document vault folders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, parentId, yearId, scope } = body as {
    name?: string;
    parentId?: string | null;
    yearId?: string;
    scope?: FolderScope;
  };

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const folder = await db.docFolder.create({
      data: {
        name,
        parentId: parentId ?? null,
        yearId: yearId ?? null,
        scope: scope ?? FolderScope.GENERIC,
      },
    });

    return NextResponse.json({ folder });
  } catch (e) {
    console.error("[document-vault/folders POST]", e);
    const message =
      e instanceof Error ? e.message : "Failed to create folder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
