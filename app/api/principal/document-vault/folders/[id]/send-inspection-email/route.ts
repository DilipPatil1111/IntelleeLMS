import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { escapeHtml } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";

interface NoteWithPath {
  folderPath: string;
  note: string;
  createdAt: Date;
}

async function collectNotesRecursively(
  folderId: string,
  pathPrefix: string,
): Promise<NoteWithPath[]> {
  const folder = await db.docFolder.findUnique({
    where: { id: folderId },
    include: {
      notes: { orderBy: { createdAt: "asc" } },
      children: { select: { id: true, name: true } },
    },
  });

  if (!folder) return [];

  const currentPath = pathPrefix ? `${pathPrefix} > ${folder.name}` : folder.name;

  const result: NoteWithPath[] = folder.notes.map((n) => ({
    folderPath: currentPath,
    note: n.note,
    createdAt: n.createdAt,
  }));

  for (const child of folder.children) {
    const childNotes = await collectNotesRecursively(child.id, currentPath);
    result.push(...childNotes);
  }

  return result;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folder = await db.docFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const body = await req.json();
  const { recipients, yearName } = body as {
    recipients?: string[];
    yearName?: string;
  };

  if (!recipients || recipients.length === 0) {
    return NextResponse.json(
      { error: "At least one recipient is required" },
      { status: 400 },
    );
  }

  if (!yearName) {
    return NextResponse.json(
      { error: "yearName is required" },
      { status: 400 },
    );
  }

  const allNotes = await collectNotesRecursively(id, "");

  if (allNotes.length === 0) {
    return NextResponse.json(
      { error: "No inspection notes found in this folder or its descendants" },
      { status: 400 },
    );
  }

  const grouped = new Map<string, NoteWithPath[]>();
  for (const n of allNotes) {
    const existing = grouped.get(n.folderPath);
    if (existing) {
      existing.push(n);
    } else {
      grouped.set(n.folderPath, [n]);
    }
  }

  let htmlBody = `
    <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Inspection Observations</h2>
      <p>Year: <strong>${escapeHtml(yearName)}</strong></p>
  `;

  for (const [folderPath, notes] of grouped) {
    htmlBody += `
      <h3 style="color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-top: 24px;">
        ${escapeHtml(folderPath)}
      </h3>
      <ul style="padding-left: 20px;">
    `;
    for (const note of notes) {
      const date = note.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      htmlBody += `<li style="margin-bottom: 8px;">${escapeHtml(note.note)} <span style="color: #6b7280; font-size: 12px;">(${date})</span></li>`;
    }
    htmlBody += `</ul>`;
  }

  htmlBody += `</div>`;

  const subject = `Inspection observations for the year ${yearName}`;

  for (const recipient of recipients) {
    await sendEmailWithSignature({ to: recipient, subject, html: htmlBody, senderUserId: session.user.id });
  }

  return NextResponse.json({ ok: true });
}
