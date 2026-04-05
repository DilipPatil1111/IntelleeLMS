import { db } from "@/lib/db";
import { escapeHtml } from "@/lib/email";

export interface NoteWithPath {
  folderPath: string;
  note: string;
  createdAt: Date;
}

export async function collectInspectionNotesRecursively(
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
    const childNotes = await collectInspectionNotesRecursively(child.id, currentPath);
    result.push(...childNotes);
  }

  return result;
}

export function buildInspectionDraftText(
  yearName: string,
  grouped: Map<string, NoteWithPath[]>,
): string {
  let textBody = `Inspection — consolidated notes\nYear: ${yearName}\nGenerated: ${new Date().toISOString()}\n\n`;

  for (const [folderPath, notes] of grouped) {
    textBody += `${folderPath}\n${"─".repeat(Math.min(folderPath.length, 60))}\n`;
    for (const note of notes) {
      const d = note.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      textBody += `• ${note.note} (${d})\n`;
    }
    textBody += "\n";
  }
  return textBody;
}

export function buildInspectionHtmlBody(
  yearName: string,
  grouped: Map<string, NoteWithPath[]>,
  txtFileName: string,
): string {
  let htmlBody = `
    <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Inspection observations</h2>
      <p>Year: <strong>${escapeHtml(yearName)}</strong></p>
      <p style="color: #6b7280; font-size: 14px;">A consolidated text file is attached (<code>${escapeHtml(txtFileName)}</code>).</p>
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
  return htmlBody;
}

export function plainTextToEmailHtml(text: string): string {
  return `<div style="font-family: sans-serif; max-width: 700px; margin: 0 auto; white-space: pre-wrap;">${escapeHtml(text)}</div>`;
}
