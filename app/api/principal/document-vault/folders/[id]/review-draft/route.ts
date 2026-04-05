import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  buildInspectionDraftText,
  buildInspectionHtmlBody,
  collectInspectionNotesRecursively,
  type NoteWithPath,
} from "@/lib/inspection-binder-notes";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rootFolderId } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const root = await db.docFolder.findUnique({ where: { id: rootFolderId } });
  if (!root) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const year = root.yearId
    ? await db.academicYear.findUnique({ where: { id: root.yearId } })
    : null;
  const yearName = year?.name ?? "Current year";

  const allNotes = await collectInspectionNotesRecursively(rootFolderId, "");

  if (allNotes.length === 0) {
    return NextResponse.json(
      { error: "No inspection notes found in this folder or its descendants" },
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
