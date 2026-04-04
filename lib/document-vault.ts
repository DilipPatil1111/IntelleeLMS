import { db } from "@/lib/db";
import { FolderScope } from "@/app/generated/prisma/client";

interface SeedParams {
  yearId: string;
  programId: string;
  batchId: string;
  programCode: string;
  batchName: string;
}

export async function seedVaultFolders(params: SeedParams): Promise<void> {
  const { yearId, programId, batchId, programCode, batchName } = params;

  const genericFolders = [
    { sort: 1, name: "01 - Final Student Admission Contracts & Policies" },
    { sort: 3, name: "03 - Trainer Contracts" },
    { sort: 4, name: "04 - Approved Program Curricula" },
    { sort: 5, name: "05 - Current Advertising" },
    { sort: 6, name: "06 - Student Testimonial Consent Forms" },
    { sort: 8, name: "08 - Sample Transcripts" },
  ];

  const yearSpecificFolders = [
    { sort: 7, name: "07 - Current Certificate of Insurance and Proof of Coverage" },
    { sort: 9, name: "09 - Transcript Storage Agreement" },
    { sort: 9, name: "09 - Lease Contract" },
    { sort: 10, name: "10 - Fire Inspection Report" },
  ];

  const batchLabel = `${programCode} (${batchName})`;

  for (const f of genericFolders) {
    const exists = await db.docFolder.findFirst({
      where: { yearId, scope: FolderScope.GENERIC, name: f.name, parentId: null },
    });
    if (!exists) {
      await db.docFolder.create({
        data: {
          name: f.name,
          parentId: null,
          scope: FolderScope.GENERIC,
          yearId,
          sortOrder: f.sort,
        },
      });
    }
  }

  for (const f of yearSpecificFolders) {
    const exists = await db.docFolder.findFirst({
      where: { yearId, scope: FolderScope.YEAR_SPECIFIC, name: f.name, parentId: null },
    });
    if (!exists) {
      await db.docFolder.create({
        data: {
          name: f.name,
          parentId: null,
          scope: FolderScope.YEAR_SPECIFIC,
          yearId,
          sortOrder: f.sort,
        },
      });
    }
  }

  // Folder 02
  const folder02Name = `02 - Signed Student Documents - ${batchLabel}`;
  const existing02 = await db.docFolder.findFirst({
    where: { programId, batchId, scope: FolderScope.BATCH_SPECIFIC, autoPopulateKey: "signed_contracts", parentId: null },
  });
  if (!existing02) {
    await db.docFolder.create({
      data: {
        name: folder02Name,
        parentId: null,
        scope: FolderScope.BATCH_SPECIFIC,
        yearId,
        programId,
        batchId,
        isAutoPopulated: true,
        autoPopulateKey: "signed_contracts",
        sortOrder: 2,
      },
    });
  }

  // Folder 11
  const folder11Name = `11 - Students Photo IDs - ${batchLabel}`;
  const existing11 = await db.docFolder.findFirst({
    where: { programId, batchId, scope: FolderScope.BATCH_SPECIFIC, autoPopulateKey: "photo_ids", parentId: null },
  });
  if (!existing11) {
    await db.docFolder.create({
      data: {
        name: folder11Name,
        parentId: null,
        scope: FolderScope.BATCH_SPECIFIC,
        yearId,
        programId,
        batchId,
        isAutoPopulated: true,
        autoPopulateKey: "photo_ids",
        sortOrder: 11,
      },
    });
  }

  // Folder 12 + sub-folders
  const existing12 = await db.docFolder.findFirst({
    where: { programId, batchId, scope: FolderScope.BATCH_SPECIFIC, name: "12 - Others", parentId: null },
  });
  const folder12Id = existing12
    ? existing12.id
    : (
        await db.docFolder.create({
          data: {
            name: "12 - Others",
            parentId: null,
            scope: FolderScope.BATCH_SPECIFIC,
            yearId,
            programId,
            batchId,
            sortOrder: 12,
          },
        })
      ).id;

  const subFolders = [
    { sort: 1, name: "Payment Invoices & Receipts", autoPopulateKey: "payment_receipts" },
    { sort: 2, name: "Pre-admission Test Results", autoPopulateKey: "pre_admission" },
    { sort: 3, name: "Student Attendance", autoPopulateKey: "attendance" },
    { sort: 4, name: "Student Transcripts", autoPopulateKey: "transcripts" },
  ];

  for (const sf of subFolders) {
    const existingSub = await db.docFolder.findFirst({
      where: { parentId: folder12Id, autoPopulateKey: sf.autoPopulateKey },
    });
    if (!existingSub) {
      await db.docFolder.create({
        data: {
          name: sf.name,
          parentId: folder12Id,
          scope: FolderScope.BATCH_SPECIFIC,
          yearId,
          programId,
          batchId,
          isAutoPopulated: true,
          autoPopulateKey: sf.autoPopulateKey,
          sortOrder: sf.sort,
        },
      });
    }
  }
}
