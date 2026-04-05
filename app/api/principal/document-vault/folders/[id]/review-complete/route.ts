import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FolderScope } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { env } from "@/lib/env";
import {
  buildInspectionDraftText,
  buildInspectionHtmlBody,
  collectInspectionNotesRecursively,
  plainTextToEmailHtml,
  type NoteWithPath,
} from "@/lib/inspection-binder-notes";
import { blobPut } from "@/lib/vercel-blob";
import { getOrCreateInspectionReviewNotesFolder } from "@/lib/document-vault";

async function resolveBatchContext(folderId: string) {
  let cur = await db.docFolder.findUnique({ where: { id: folderId } });
  while (cur) {
    if (cur.batchId && cur.programId && cur.yearId) {
      return cur;
    }
    if (!cur.parentId) break;
    cur = await db.docFolder.findUnique({ where: { id: cur.parentId } });
  }
  return null;
}

/** Collect notes from every folder visible in a batch binder */
async function collectAllBatchNotes(
  yearId: string,
  programId: string,
  batchId: string,
): Promise<NoteWithPath[]> {
  const topLevel = await db.docFolder.findMany({
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

  const result: NoteWithPath[] = [];
  for (const f of topLevel) {
    const notes = await collectInspectionNotesRecursively(f.id, "");
    result.push(...notes);
  }
  return result;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rootFolderId } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    recipients,
    yearName,
    yearId: bodyYearId,
    programId: bodyProgramId,
    batchId: bodyBatchId,
    customTextBody,
    customHtmlBody,
  } = body as {
    recipients?: string[];
    yearName?: string;
    yearId?: string;
    programId?: string;
    batchId?: string;
    customTextBody?: string;
    customHtmlBody?: string;
  };

  if (!recipients || recipients.length === 0) {
    return NextResponse.json(
      { error: "At least one recipient is required" },
      { status: 400 },
    );
  }

  if (!yearName?.trim()) {
    return NextResponse.json({ error: "yearName is required" }, { status: 400 });
  }

  const root = await db.docFolder.findUnique({ where: { id: rootFolderId } });
  if (!root) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // Resolve batch context
  const ctxFolder = await resolveBatchContext(rootFolderId);
  let yearId = ctxFolder?.yearId ?? null;
  let programId = ctxFolder?.programId ?? null;
  let batchId = ctxFolder?.batchId ?? null;

  if (!batchId || !programId || !yearId) {
    if (bodyYearId && bodyProgramId && bodyBatchId) {
      const batch = await db.batch.findFirst({
        where: {
          id: bodyBatchId,
          programId: bodyProgramId,
          academicYearId: bodyYearId,
        },
      });
      if (batch) {
        yearId = bodyYearId;
        programId = bodyProgramId;
        batchId = bodyBatchId;
      }
    }
  }

  if (!batchId || !programId || !yearId) {
    return NextResponse.json(
      {
        error:
          "Could not determine program batch for this binder. Click the folder in a batch section of the tree, or set Year, Program, and Batch in the header.",
      },
      { status: 400 },
    );
  }

  // Collect notes from ALL folders in the batch (not just the triggering folder),
  // unless a custom body was already supplied by the user.
  let allNotes: NoteWithPath[] = [];
  if (!(customTextBody && customTextBody.trim())) {
    allNotes = await collectAllBatchNotes(yearId, programId, batchId);
  }

  if (allNotes.length === 0 && !(customTextBody && customTextBody.trim())) {
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

  const textBody =
    customTextBody != null && customTextBody.trim() !== ""
      ? customTextBody
      : buildInspectionDraftText(yearName.trim(), grouped);

  const buf = Buffer.from(textBody, "utf8");

  let htmlBody: string;
  if (customHtmlBody != null && customHtmlBody.trim() !== "") {
    htmlBody = customHtmlBody;
  } else if (customTextBody != null && customTextBody.trim() !== "") {
    htmlBody = plainTextToEmailHtml(customTextBody);
  } else {
    htmlBody = buildInspectionHtmlBody(yearName.trim(), grouped, txtFileName);
  }

  const subject = `Inspection observations for the year ${yearName.trim()}`;

  // Send email first — does not require Vercel Blob. Blob upload used to run first and threw
  // when BLOB_READ_WRITE_TOKEN was unset, blocking email entirely.
  const emailErrors: string[] = [];
  for (const recipient of recipients) {
    const result = await sendEmailWithSignature({
      to: recipient,
      subject,
      html: htmlBody,
      attachments: [{ filename: txtFileName, content: buf }],
      senderUserId: session.user.id,
    });
    if (!result.ok) {
      emailErrors.push(`${recipient}: ${result.error}`);
    }
  }

  if (emailErrors.length > 0) {
    return NextResponse.json(
      {
        error: `Email failed for some recipients: ${emailErrors.join("; ")}`,
      },
      { status: 502 },
    );
  }

  const blobToken =
    typeof process.env.BLOB_READ_WRITE_TOKEN === "string"
      ? process.env.BLOB_READ_WRITE_TOKEN.trim()
      : env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!blobToken) {
    return NextResponse.json({
      ok: true,
      vaultSaved: false,
      docFileName: txtFileName,
      message:
        "Email sent. The consolidated .txt was not saved to the Inspection Review Notes folder because BLOB_READ_WRITE_TOKEN is not set. Add it to your environment (Vercel Blob) to persist the file in the binder.",
    });
  }

  const reviewNotesFolderId = await getOrCreateInspectionReviewNotesFolder(yearId, programId, batchId);

  const subfolderName = `Consolidated Inspection Notes \u2014 ${dateStr}`;

  const sub = await db.docFolder.create({
    data: {
      name: subfolderName,
      parentId: reviewNotesFolderId,
      scope: FolderScope.BATCH_SPECIFIC,
      yearId,
      programId,
      batchId,
      sortOrder: 100,
    },
  });

  try {
    const blob = await blobPut(`inspection-binder/consolidated/${randomUUID()}.txt`, buf, {
      contentType: "text/plain",
    });

    await db.docFile.create({
      data: {
        folderId: sub.id,
        fileName: txtFileName,
        fileUrl: blob.url,
        fileSize: buf.length,
        contentType: "text/plain",
      },
    });

    return NextResponse.json({
      ok: true,
      vaultSaved: true,
      consolidatedFolderId: sub.id,
      docFileName: txtFileName,
    });
  } catch (e) {
    console.error("[review-complete] blob upload failed after email sent", e);
    try {
      await db.docFolder.delete({ where: { id: sub.id } });
    } catch {
      /* ignore */
    }
    return NextResponse.json({
      ok: true,
      vaultSaved: false,
      docFileName: txtFileName,
      message:
        "Email sent, but saving the consolidated file to the Inspection Review Notes folder failed (check BLOB_READ_WRITE_TOKEN and Blob storage).",
    });
  }
}
