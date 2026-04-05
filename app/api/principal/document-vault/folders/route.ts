import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FolderScope } from "@/app/generated/prisma/client";
import { listFoldersForContext } from "@/lib/document-vault";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  if (searchParams.get("all") === "true") {
    try {
      const groupRows = await db.docFolder.groupBy({
        by: ["yearId", "programId", "batchId"],
        where: {
          scope: FolderScope.BATCH_SPECIFIC,
          yearId: { not: null },
          programId: { not: null },
          batchId: { not: null },
        },
      });

      const years = await db.academicYear.findMany();
      const yearById = new Map(years.map((y) => [y.id, y]));
      const programs = await db.program.findMany();
      const programById = new Map(programs.map((p) => [p.id, p]));
      const batches = await db.batch.findMany();
      const batchById = new Map(batches.map((b) => [b.id, b]));

      const sorted = [...groupRows].sort((a, b) => {
        const ya = a.yearId ? yearById.get(a.yearId) : undefined;
        const yb = b.yearId ? yearById.get(b.yearId) : undefined;
        if (ya && yb) {
          if (ya.isCurrent !== yb.isCurrent) return ya.isCurrent ? -1 : 1;
          return yb.startDate.getTime() - ya.startDate.getTime();
        }
        return 0;
      });

      const groups = await Promise.all(
        sorted.map(async (g) => {
          const folders = await listFoldersForContext(
            g.yearId!,
            g.programId,
            g.batchId,
          );
          const y = g.yearId ? yearById.get(g.yearId) : undefined;
          const p = g.programId ? programById.get(g.programId) : undefined;
          const b = g.batchId ? batchById.get(g.batchId) : undefined;
          return {
            yearId: g.yearId,
            yearName: y?.name ?? g.yearId ?? "",
            programId: g.programId,
            programName: p?.name ?? "",
            batchId: g.batchId,
            batchName: b?.name ?? "",
            folders,
          };
        }),
      );

      return NextResponse.json({ groups });
    } catch (e) {
      console.error("[document-vault/folders GET all]", e);
      const message =
        e instanceof Error ? e.message : "Failed to load inspection binder folders";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const yearId = searchParams.get("yearId");
  const programId = searchParams.get("programId");
  const batchId = searchParams.get("batchId");

  if (!yearId) {
    return NextResponse.json({ error: "yearId is required" }, { status: 400 });
  }

  try {
    const folders = await listFoldersForContext(yearId, programId, batchId);

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
  const { name, parentId, yearId, programId, batchId, scope } = body as {
    name?: string;
    parentId?: string | null;
    yearId?: string | null;
    programId?: string | null;
    batchId?: string | null;
    scope?: FolderScope;
  };

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const resolvedScope =
      scope ??
      (programId && batchId ? FolderScope.BATCH_SPECIFIC : FolderScope.GENERIC);

    const folder = await db.docFolder.create({
      data: {
        name,
        parentId: parentId ?? null,
        yearId: yearId ?? null,
        programId: programId ?? null,
        batchId: batchId ?? null,
        scope: resolvedScope,
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
