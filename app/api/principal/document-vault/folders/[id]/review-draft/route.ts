import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  buildInspectionDraftText,
  buildInspectionHtmlBody,
  collectInspectionNotesRecursively,
  type NoteWithPath,
} from "@/lib/inspection-binder-notes";

/**
 * POST /api/principal/document-vault/folders/[id]/review-draft
 *
 * Generates consolidated inspection notes for preview / email body.
 *
 * When `yearId`, `programId`, and `batchId` are supplied in the request body the
 * route collects notes from EVERY folder in that batch (generic + year-specific +
 * batch-specific root folders and all their descendants).  This is the expected
 * behaviour when "Review Complete" is triggered from folder 11.
 *
 * Fallback: if no batch context is supplied, only the subtree of the named folder
 * ([id]) is searched — same behaviour as before.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rootFolderId } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    yearId?: string;
    programId?: string;
    batchId?: string;
  };

  const root = await db.docFolder.findUnique({ where: { id: rootFolderId } });
  if (!root) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // Resolve year name for the email subject / header
  const yearId = body.yearId ?? root.yearId ?? null;
  const year = yearId ? await db.academicYear.findUnique({ where: { id: yearId } }) : null;
  const yearName = year?.name ?? "Current year";

  let allNotes: NoteWithPath[] = [];

  const programId = body.programId ?? root.programId ?? null;
  const batchId = body.batchId ?? root.batchId ?? null;

  if (yearId && programId && batchId) {
    // Collect from ALL top-level folders visible in this batch binder:
    //   • GENERIC folders (shared across all batches for this year)
    //   • YEAR_SPECIFIC folders (shared across batches for this year)
    //   • BATCH_SPECIFIC root folders (specific to this program+batch)
    const topLevelFolders = await db.docFolder.findMany({
      where: {
        parentId: null,
        OR: [
          { yearId, scope: "GENERIC" },
          { yearId, scope: "YEAR_SPECIFIC" },
          { yearId, programId, batchId, scope: "BATCH_SPECIFIC" },
        ],
      },
      select: { id: true },
    });

    for (const f of topLevelFolders) {
      const notes = await collectInspectionNotesRecursively(f.id, "");
      allNotes.push(...notes);
    }
  } else {
    // Fallback: only this folder's subtree
    allNotes = await collectInspectionNotesRecursively(rootFolderId, "");
  }

  if (allNotes.length === 0) {
    return NextResponse.json(
      { error: "No inspection notes found across any folder in this binder" },
      { status: 400 },
    );
  }

  const grouped = new Map<string, NoteWithPath[]>();
  for (const n of allNotes) {
    const existing = grouped.get(n.folderPath);
    if (existing) existing.push(n);
    else grouped.set(n.folderPath, [n]);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const txtFileName = `Inspection-notes-${dateStr}.txt`;
  const textBody = buildInspectionDraftText(yearName, grouped);
  const htmlBody = buildInspectionHtmlBody(yearName, grouped, txtFileName);
  const subject = `Inspection observations for the year ${yearName}`;

  return NextResponse.json({
    textBody,
    htmlBody,
    subject,
    txtFileName,
  });
}
