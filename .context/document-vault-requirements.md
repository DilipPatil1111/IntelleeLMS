# Inspection Binder & Student Pending Actions — Feature Requirements

**Status:** APPROVED — in active development  
**Date:** April 4, 2026  
**Product name:** **Inspection Binder** (formerly “Document Vault”). Principal route: `/principal/inspection-binder` (legacy `/principal/document-vault` redirects). APIs remain under `/api/principal/document-vault/*` for stability.

**Revision note v5:** **Vercel Blob** uploads use `lib/vercel-blob.ts` (`blobPut` / `blobDel`) so `BLOB_READ_WRITE_TOKEN` is passed when set (required for local/non-Vercel runtimes). **Review Complete** appears only when the principal is viewing **folder 11 — Students Photo IDs** (`autoPopulateKey === photo_ids`), not on other folders or **12 — Others**. The review modal **pre-selects all principals**; teachers are toggled per checkbox; **other emails** are a single comma-separated field (no separate “Add” control) merged into recipients on send. The user must run **“Add consolidated notes & preview”** (`POST .../review-draft`) to load editable consolidated text before **Send** (which posts `customTextBody` to `review-complete`). Auto-populated binder rows show **submission history** (chronological); the **latest** row per chain is **replace/delete**-able by the principal via `PUT/DELETE /api/principal/students/[id]/binder-document` (segment is the student **user** id, same as other principal student routes) (contract / ids / fee / fee_receipt). Manual `DocFile` rows remain fully rename/replace/delete capable.

**Revision note v4:** Default principal view is **All years / All programs / All batches**, listing every seeded binder group with **current academic year first**. Manual files support **View, Download, Update (replace)**. Auto folders show **student name → documents** with view/download. **Review Complete** (replacing per-folder “send email”) creates a **Consolidated Inspection Notes** folder under **12 — Others**, writes a **.txt** summary, and emails principals/teachers/extra addresses with attachment. Students: **submission history** (newest first) and **Update** on onboarding documents and fee receipts; same receipt UX on **My Fees**.

**Revision note v3:** Folder creation now triggered by year + program + batch selection (not year alone). GENERIC/YEAR folders are shared across batches; BATCH SPECIFIC folders are unique per program+batch. Content populates progressively with available data at creation, then auto-updates as processes complete. Payment confirmation email with receipt attachments. Full backward compatibility guarantees.

---

## Overview

Two interconnected features:

1. **Student Pending Actions** — A new student menu showing all incomplete obligations (assessments, documents, fees) with the ability to complete them inline.
2. **Inspection Binder** — Same hierarchical system as above: compliance documents by year, program, and batch; skeleton on first (year, program, batch); progressive auto-fill; manual uploads; inspection notes; **Review Complete** consolidates notes into a `.txt` under **12 — Others** and emails the package (no separate per-note email).

---

## Backward compatibility guarantees

All changes MUST preserve existing functionality:

| Existing feature | Guarantee |
|---|---|
| **Student onboarding flow** | The 4-step onboarding process (`/student/onboarding`) continues to work exactly as today. Pending Actions is an **additional** path to complete the same steps — both write to the same `StudentOnboarding` fields via the same APIs. |
| **Student fees page** | `/student/fees` remains unchanged. Pending Actions links to it and supplements it with receipt upload capability. |
| **Student assessments page** | `/student/assessments` remains unchanged. Pending Actions is a filtered view of the same data (pending only). |
| **Principal onboarding review** | `/principal/onboarding-review` continues to work. The Inspection Binder may update student onboarding documents and fee receipts only through the dedicated principal APIs (same underlying fields as student uploads). |
| **Principal student list** | `/principal/students` remains unchanged. Fee indicators are additive (new badge), not replacing existing columns. |
| **Existing upload APIs** | `POST /api/student/onboarding/upload` is reused by Pending Actions, not replaced. No signature changes. |
| **Existing file-upload.ts** | The `uploadToBlob` function is reused for vault uploads. A new `uploadToBlob` call with relaxed extension/size checks is added for vault-specific uploads — the existing function signature is not modified. |
| **Existing email system** | `sendEmail()` from `lib/email.ts` is used for all new email features. No changes to the function. |
| **Database** | All changes are additive (new tables, new fields with defaults/nullable). No existing columns are removed, renamed, or have their types changed. Existing data is untouched. |

---

# PART A: Student Pending Actions

**Route:** `/student/pending-actions`  
**Role:** STUDENT

## A1. Menu structure

A new sidebar item "Pending Actions" (with a badge count of total pending items) containing three sections:

### A1.1 Pending Assessments

- Lists all assessments where:
  - Assessment `status` = `PUBLISHED`
  - Student is in the assessment's batch AND (no `assignedStudents` rows exist OR student is in `assignedStudents`)
  - Student has **no** `Attempt` row, OR has an attempt with status `IN_PROGRESS`
- Each row shows: assessment title, subject, type (quiz/test/etc.), due date (`scheduledCloseAt`), and a "Take Assessment" / "Continue" button linking to `/student/assessments/{id}/take`
- Sorted by due date ascending (most urgent first)
- **No changes to the assessment or attempt system** — this is a read-only filtered view of existing data

### A1.2 Pending Documents

Derived from the student's `StudentOnboarding` record. A document is "pending" if its corresponding timestamp is NULL **and** no file was uploaded:

| Document | Pending condition | Upload action | On upload, vault auto-populates |
|---|---|---|---|
| **Signed student agreement** (Step 1) | `contractAcknowledgedAt` is NULL | Upload signed contract → calls existing `POST /api/student/onboarding/upload` with `step=contract` | Folder 02 — Signed Student Documents |
| **Government photo ID** (Step 2) | `governmentIdsUploadedAt` is NULL | Upload ID scan → calls existing `POST /api/student/onboarding/upload` with `step=ids` | Folder 11 — Students Photo IDs |
| **Fee payment proof** (Step 3) | `feeProofUploadedAt` is NULL | Upload receipt → calls existing `POST /api/student/onboarding/upload` with `step=fee` | Folder 12 — Others > Payment Invoices & Receipts |

- Each pending item shows the document name, a description of what's needed, and an "Upload" button
- On successful upload, the item moves to a "Completed" section at the bottom (with a green checkmark and the uploaded file name)
- Students who completed these during onboarding will see **no pending documents** — all items appear as completed
- If the student has no `StudentOnboarding` record, this section shows "No document requirements assigned yet"
- **Same APIs, same storage** — Pending Actions calls the same `POST /api/student/onboarding/upload` endpoint that the onboarding page uses

### A1.3 Pending Fees

- Calculated from: `totalFees` (sum of `program.feeStructures[].totalAmount`) minus `totalPaid` (sum of `feePayments[].amountPaid`)
- If `pending > 0`, show:
  - Summary: "Total: $X | Paid: $Y | **Pending: $Z**"
  - An "Upload Payment Receipt" button that opens an upload dialog
  - The uploaded receipt is stored via a **new** endpoint that creates a `FeePayment` record with `receiptUrl` and `receiptFileName` (see A2)
  - Previously uploaded receipts are listed with file names and "View" buttons
- If `pending <= 0`, show "All fees are paid" with a green checkmark
- Link to `/student/fees` for full payment history

## A2. Schema additions (Student side)

Add `receiptUrl` and `receiptFileName` fields to `FeePayment` so students can attach receipts to specific payments (beyond the one-time onboarding fee proof):

```prisma
model FeePayment {
  ...existing fields (unchanged)...
  receiptUrl       String?   // NEW: Vercel Blob URL for payment receipt
  receiptFileName  String?   // NEW: Original file name of receipt
}
```

These are nullable fields with no defaults, so existing `FeePayment` rows are unaffected.

## A3. Principal visibility of pending fees

When a student has pending fees (`totalFees - totalPaid > 0`):

- The student automatically appears in the principal's student list with a "Pending Fees" badge/indicator
- In the principal's student detail / fees view:
  - Show the student's fee breakdown (total / paid / pending)
  - Show uploaded payment receipts (from `FeePayment.receiptUrl` and `StudentOnboarding.feeProofUploadUrl`)
  - Principal can click **"Confirm Payment Received"** which:
    1. Updates the `FeePayment` record to mark it as confirmed
    2. Sends a **confirmation email** to the student with the subject "Payment Received — {student name}" containing:
       - The confirmed amount
       - Updated total paid / pending balance
       - The uploaded receipt(s) as **email attachments** (fetched from Vercel Blob URL and attached via `sendEmail()` attachments parameter)
    3. Uses existing `sendEmail()` from `lib/email.ts` — no changes to the email function
  - Display paid/pending totals **student-wise** under Program > Batch (default: all students)

## A4. Navigation from Pending Actions

| Action | Where it goes |
|---|---|
| "Take Assessment" | `/student/assessments/{id}/take` (existing page, no changes) |
| "Continue Assessment" | `/student/assessments/{id}/take` (existing page, resumes `IN_PROGRESS` attempt) |
| "Upload Document" | In-page upload dialog → existing `POST /api/student/onboarding/upload` (no changes to API) |
| "Upload Payment Receipt" | In-page upload dialog → new `POST /api/student/pending-actions/upload-receipt` |
| "View Fees" | `/student/fees` (existing page, no changes) |

---

# PART B: Inspection Binder (Principal/Administrator)

**Route:** `/principal/inspection-binder` (redirect from `/principal/document-vault`)  
**Role:** PRINCIPAL

## B1. Folder creation trigger — Year + Program + Batch selection

The folder structure is created when the principal **selects all three: year, program, and batch**. The system checks if the folder skeleton already exists for that combination. If not, it **automatically creates all 12 default folders** with whatever information is already available. If no data exists yet, the folders are created empty and content populates later as processes are completed.

**User flow:**

```
Step 1: Select Year   → [2025-26 ▼]           (no folders created yet)
Step 2: Select Program → [Diploma in SE ▼]     (no folders created yet)
Step 3: Select Batch   → [Fall - Aug 25 ▼]     (NOW: skeleton created)
         │
         ▼ (auto-created for this year + program + batch combination)
01 - Final Student Admission Contracts & Policies                    [GENERIC]
02 - Signed Student Documents - DSWE (Fall - Aug 25 Batch)           [BATCH SPECIFIC]
03 - Trainer Contracts                                               [GENERIC]
04 - Approved Program Curricula                                      [GENERIC]
05 - Current Advertising                                             [GENERIC]
06 - Student Testimonial Consent Forms                               [GENERIC]
07 - Current Certificate of Insurance and Proof of Coverage          [YEAR SPECIFIC]
08 - Sample Transcripts                                              [GENERIC]
09 - Transcript Storage Agreement                                    [YEAR SPECIFIC]
09 - Lease Contract                                                  [YEAR SPECIFIC]
10 - Fire Inspection Report                                          [YEAR SPECIFIC]
11 - Students Photo IDs - DSWE (Fall - Aug 25 Batch)                 [BATCH SPECIFIC]
12 - Others                                                          [BATCH SPECIFIC]
    ├── Payment Invoices & Receipts
    ├── Pre-admission Test Results
    ├── Student Attendance
    └── Student Transcripts
```

**Key principles:**
- All 12 folders + sub-folders under "12 - Others" are created in one go when year + program + batch are all selected.
- GENERIC folders (01, 03, 04, 05, 06, 08) are **shared across all batches** for that year. If they were already created for a different program+batch selection under the same year, they are reused (not duplicated).
- YEAR SPECIFIC folders (07, 09, 09-Lease, 10) are **shared across all batches within that year**. Created once per year, reused across program+batch selections.
- BATCH SPECIFIC folders (02, 11, 12 and sub-folders) are **unique per program + batch combination**. Selecting a different batch creates a new set of batch-specific folders.
- Folder names for batch-specific folders auto-include the program code and batch name (e.g., "02 - Signed Student Documents - DSWE (Fall - Aug 25 Batch)").
- The creation is **idempotent** — selecting the same year + program + batch again does not duplicate folders.

## B2. Progressive content population

After the folder skeleton is created, content populates progressively — either automatically from student data or manually by the principal. **Empty folders are normal and expected.** They fill up over time as the academic year progresses.

### At creation time (year + program + batch selected)

The system immediately populates whatever data is already available:

- **GENERIC & YEAR SPECIFIC folders:** Empty — ready for principal to upload files manually.
- **Folder 02 (Signed Student Documents):** If any students in this batch have already uploaded signed contracts (via onboarding or Pending Actions), their documents appear immediately. Otherwise empty.
- **Folder 11 (Students Photo IDs):** If any students have uploaded government photo IDs, they appear immediately. Otherwise empty.
- **Folder 12 sub-folders:** Pre-populated with any existing payment receipts, pre-admission test results, etc. Otherwise empty.

### Ongoing — content arrives as processes complete

As students and administrators complete their workflows, the vault automatically reflects new data **without any manual action by the principal**:

### Stage 3 — Progressive auto-population (ongoing)

As students complete onboarding or upload documents from Pending Actions, the vault automatically reflects the new data:

| Student action | When it happens | Where it appears in vault |
|---|---|---|
| Student uploads signed contract (Onboarding Step 1 OR Pending Actions) | Writes to `StudentOnboarding.signedContractUploadUrl` | Folder 02 — student's name as file label |
| Student uploads government photo ID (Onboarding Step 2 OR Pending Actions) | Writes to `StudentOnboarding.governmentIdUploadUrl` | Folder 11 — student's name as file label |
| Student uploads fee payment proof (Onboarding Step 3 OR Pending Actions) | Writes to `StudentOnboarding.feeProofUploadUrl` | Folder 12 > Payment Invoices & Receipts — student-wise |
| Student uploads payment receipt (Pending Actions > Pending Fees) | Creates `FeePayment` with `receiptUrl` | Folder 12 > Payment Invoices & Receipts — student-wise with amount |
| Student completes pre-admission test (Onboarding Step 4) | Sets `StudentOnboarding.preAdmissionCompletedAt` + `Attempt` record | Folder 12 > Pre-admission Test Results — student name + score |
| Principal creates new student and assigns to batch | New `StudentProfile` + `StudentOnboarding` | Student appears in all relevant batch-specific folders (initially with "pending" status for un-uploaded documents) |
| New batch created for existing program | Admin creates batch | When principal selects the new batch, batch-specific folder content refreshes for that batch |

**The vault does NOT store copies of student files.** Auto-populated folders read from `StudentOnboarding` and `FeePayment` records at query time and display them. This means:
- No data duplication
- If a student re-uploads a document, the vault immediately shows the latest version
- Deleting from the vault doesn't delete the student's source file

## B3. Auto-populated folder details

### Folder 02 — Signed Student Documents - {programCode} ({batchName})

- Reads `StudentOnboarding.signedContractUploadUrl` for every student in the selected program + batch
- Each student with an uploaded contract shows as: `{firstName} {lastName} - Signed Contract` with a [View] button
- Students without uploads show as: `{firstName} {lastName} - Pending` (greyed out, no View button)
- Sourced from: Onboarding Step 1 upload, OR Pending Actions > Pending Documents > Signed contract upload

### Folder 11 — Students Photo IDs - {programCode} ({batchName})

- Reads `StudentOnboarding.governmentIdUploadUrl` for every student in the selected program + batch
- Each student with an uploaded ID shows as: `{firstName} {lastName} - Government ID` with a [View] button
- Students without uploads show as: `{firstName} {lastName} - Pending` (greyed out)
- Sourced from: Onboarding Step 2 upload, OR Pending Actions > Pending Documents > Government photo ID upload

### Folder 12 — Others (sub-sections)

Inside "12 - Others", display sub-folders with filter controls:

```
12 - Others/
├── [Filter: Student (default: all students in selected batch)]
│
├── Payment Invoices & Receipts/
│   ├── Auto-populated from:
│   │   - StudentOnboarding.feeProofUploadUrl (onboarding Step 3)
│   │   - FeePayment.receiptUrl (ongoing payment receipts from Pending Actions)
│   │   Displayed student-wise: "{firstName} {lastName} - {receipt name} - ${amount}"
│   └── Principal can also manually upload receipts/invoices here
│
├── Pre-admission Test Results/
│   ├── Auto-populated from:
│   │   - Students with preAdmissionCompletedAt set AND a matching Attempt:
│   │     Show "{firstName} {lastName} - {assessmentTitle} - Score: {score}/{total} ({percentage}%)"
│   │   - Students with preAdmissionCompletedAt NOT set:
│   │     Show "{firstName} {lastName} - Pending" (this also appears in student's Pending Actions > Pending Assessments)
│   └── Score is a link to the detailed results view
│
├── Student Attendance/
│   └── Link to consolidated attendance report for the selected program > batch
│       Uses existing attendance grid component (read-only view embedded or linked)
│
└── Student Transcripts/
    └── Student-wise transcript links
        (Transcript generation is not yet ready — display: "Coming soon — transcript generation will be available in a future update")
```

## B4. Folder scope types

| Scope | Meaning | Created when | Shared? | Content available |
|---|---|---|---|---|
| **GENERIC** | Same across all years/programs/batches. Principal uploads once. | First year+program+batch selection for that year | Shared across all batches within the same year. Not duplicated. | Immediately (principal uploads manually) |
| **YEAR SPECIFIC** | Tied to the selected academic year. | First year+program+batch selection for that year | Shared across all batches within that year. Not duplicated. | Immediately (principal uploads manually) |
| **BATCH SPECIFIC** | Tied to a specific program + batch. Auto-populated from student data. | Each unique program+batch selection | Unique per program+batch. New set created per batch. | Progressively — whatever data exists at creation time, then auto-updates as students complete onboarding and upload documents |

## B5. Folder management (all folders)

| Capability | Details |
|---|---|
| **Create folder** | User can create a sub-folder at any level inside any folder. |
| **Rename folder** | Inline rename on any folder. Auto-generated names (e.g., "02 - Signed Student Documents - DSWE (Fall Aug 25)") can be renamed. |
| **Delete folder** | Deletes the folder + all children (sub-folders, manually uploaded files, inspection notes). Confirmation required. **Auto-populated folders (02, 11, 12 and sub-folders) cannot be deleted** — they are system-managed. The principal can delete manually-created sub-folders within them. |
| **Copy structure** | Deep-copy an entire folder sub-tree (folders only, no files, no auto-populated content) into any target folder. Useful for duplicating the template for a new batch or creating a custom folder layout. |
| **Collapse / Expand** | Every folder has a toggle chevron. Expand/collapse state persists during the browser session. |

## B6. File management

| Capability | Details |
|---|---|
| **Upload** | Upload button inside any folder (including auto-populated folders — principal can add supplementary files). **No file type or size restrictions.** Stored in Vercel Blob under `document-vault/<folderId>/`. Multiple files can be selected at once. |
| **Upload feedback** | Success toast: "Upload successful — {filename}". If multiple files: "Upload successful — {count} files uploaded". Failure toast with error message. |
| **Sort order** | Newest file first (`createdAt` descending). |
| **Delete file** | Confirmation dialog. Deletes from DB and Vercel Blob. **Cannot delete auto-populated files** — they are managed by their source (student onboarding/payments). Principal can only delete files they manually uploaded. |
| **Rename file** | Change the display name of manually uploaded files. Auto-populated file names cannot be changed (they derive from student name + document type). |
| **View file** | "View" button opens the file viewer (see B7). |

## B7. File viewer window

When "View" is clicked, a floating overlay window opens:

| Property | Behavior |
|---|---|
| **Rendering** | PDFs: embedded `<iframe>`. Images (jpg, png, gif, webp): `<img>`. Office docs (docx, xlsx, pptx): Google Docs Viewer (`docs.google.com/gview?url=...&embedded=true`). Other types: download link with filename and size. |
| **Scrollbars** | Vertical and horizontal scrollbars on the content area as needed. |
| **Resize** | Window is draggable and resizable (user can drag corners and edges). |
| **Maximize** | A maximize button expands the viewer to fill the full viewport. A restore button returns to the previous size and position. |
| **Minimize** | A minimize button collapses the viewer to a small bar at the bottom of the screen with the file name visible. Clicking the bar restores the window. |
| **Close** | An X button closes the viewer entirely. |
| **Header** | File name + file type badge (PDF, Image, Doc, etc.) + file size. |

## B8. Inspection notes & email

### Per-folder notes

- Each folder has an expandable "Inspection Notes" section
- User can **add**, **edit**, and **delete** observation notes on any folder (including auto-populated folders)
- Each note is timestamped with creation date
- Notes are stored in `InspectionNote` table linked to the folder

### Consolidated inspection email

- A "Send Inspection Email" button is available at any folder level
- When clicked, the system:
  1. Collects all inspection notes from the selected folder **and all its descendants** recursively
  2. Groups them by folder path (e.g., "01 - Final Student Admission Contracts & Policies > subfolder name")
  3. Presents a **draft email preview** the user can review and edit before sending
- **Subject line:** `Inspection observations for the year <YEAR>` — where `<YEAR>` is the name of the selected academic year (e.g., "2025-26")
- **Recipients:** Multi-select picker:
  - Principal/Administrator email (pre-selected by default)
  - Teachers (searchable dropdown populated from teacher list)
- **Send:** Uses existing `sendEmail()` from `lib/email.ts` — no changes to the email helper
- Notes are **not** deleted after sending — they remain for ongoing reference
- A "Send" button is displayed after the draft preview

---

# PART C: Data model (proposed schema additions)

All changes are **additive only** — no existing columns are removed, renamed, or have types changed.

## C1. New models

```prisma
model DocFolder {
  id        String      @id @default(cuid())
  name      String
  parentId  String?
  scope     FolderScope @default(GENERIC)
  /** Links to AcademicYear for YEAR_SPECIFIC and as the root grouping */
  yearId    String?
  /** Links to Program for BATCH_SPECIFIC folders */
  programId String?
  /** Links to Batch for BATCH_SPECIFIC folders */
  batchId   String?
  /** Whether this folder is auto-populated from student data (cannot be deleted by user) */
  isAutoPopulated Boolean @default(false)
  /** A tag identifying the auto-populated source type (e.g., "signed_contracts", "photo_ids", "payment_receipts", "pre_admission", "attendance", "transcripts") */
  autoPopulateKey String?
  /** Display order within the parent (lower = first) */
  sortOrder Int         @default(0)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  parent    DocFolder?  @relation("FolderTree", fields: [parentId], references: [id], onDelete: Cascade)
  children  DocFolder[] @relation("FolderTree")
  files     DocFile[]
  notes     InspectionNote[]

  @@index([parentId])
  @@index([yearId])
  @@index([programId, batchId])
}

enum FolderScope {
  GENERIC
  YEAR_SPECIFIC
  BATCH_SPECIFIC
}

model DocFile {
  id          String   @id @default(cuid())
  folderId    String
  fileName    String
  fileUrl     String
  fileSize    Int
  contentType String
  /** If populated from a student record, links to the student for labeling */
  studentId   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  folder      DocFolder @relation(fields: [folderId], references: [id], onDelete: Cascade)

  @@index([folderId])
}

model InspectionNote {
  id        String   @id @default(cuid())
  folderId  String
  note      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  folder    DocFolder @relation(fields: [folderId], references: [id], onDelete: Cascade)

  @@index([folderId])
}
```

## C2. Modifications to existing models

```prisma
model FeePayment {
  ...existing fields (ALL unchanged)...
  receiptUrl       String?   // NEW: Vercel Blob URL for payment receipt screenshot
  receiptFileName  String?   // NEW: Original file name of uploaded receipt
  confirmedAt      DateTime? // NEW: When principal confirmed this payment
  confirmedById    String?   // NEW: Principal user ID who confirmed
}
```

All new fields are nullable — no migration impact on existing rows.

---

# PART D: API routes (proposed)

## D1. Student Pending Actions APIs

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/student/pending-actions` | Returns counts and lists of all pending items (assessments, documents, fees). Reads existing data — no writes. |
| `POST` | `/api/student/pending-actions/upload-receipt` | Upload a fee payment receipt. Stores in Vercel Blob, creates a `FeePayment` record with `receiptUrl` and `receiptFileName`. |

Document uploads **reuse** existing `POST /api/student/onboarding/upload` — no new endpoint needed, no changes to that endpoint.

## D2. Document Vault APIs (Principal)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/principal/document-vault/folders` | Fetch folder tree filtered by `yearId`. Returns full tree with scope metadata. |
| `POST` | `/api/principal/document-vault/folders` | Create a folder (manual sub-folder). |
| `PUT` | `/api/principal/document-vault/folders/[id]` | Rename or move a folder. Cannot rename auto-populated folder `autoPopulateKey`. |
| `DELETE` | `/api/principal/document-vault/folders/[id]` | Delete folder + all descendants. Rejects if `isAutoPopulated=true`. |
| `POST` | `/api/principal/document-vault/folders/[id]/copy` | Deep-copy folder sub-tree (folders only, no files/notes) to a target parent. |
| `GET` | `/api/principal/document-vault/folders/[id]/files` | List files in a folder (newest first). For auto-populated folders, dynamically queries `StudentOnboarding`/`FeePayment` records. |
| `POST` | `/api/principal/document-vault/folders/[id]/files` | Upload file(s) to a folder. Supports multiple files. No type/size restriction. |
| `PUT` | `/api/principal/document-vault/files/[id]` | Rename a manually uploaded file. |
| `DELETE` | `/api/principal/document-vault/files/[id]` | Delete a manually uploaded file (+ Blob). Rejects auto-populated files. |
| `GET` | `/api/principal/document-vault/folders/[id]/notes` | List inspection notes for a folder. |
| `POST` | `/api/principal/document-vault/folders/[id]/notes` | Add an inspection note. |
| `PUT` | `/api/principal/document-vault/notes/[id]` | Edit a note. |
| `DELETE` | `/api/principal/document-vault/notes/[id]` | Delete a note. |
| `POST` | `/api/principal/document-vault/folders/[id]/send-inspection-email` | Collect notes recursively from folder + descendants, send consolidated email. |
| `POST` | `/api/principal/document-vault/seed` | Create default folder structure for a given `yearId` + `programId` + `batchId`. Idempotent — GENERIC/YEAR folders are reused if already created for that year; BATCH SPECIFIC folders are created per unique program+batch. |

## D3. Principal Fees View (enhanced)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/principal/students/fees` | List students with fee summaries (total/paid/pending), filterable by program/batch. |
| `GET` | `/api/principal/students/[id]/fees` | Single student fee detail with all receipts (from `FeePayment.receiptUrl` + `StudentOnboarding.feeProofUploadUrl`). |
| `POST` | `/api/principal/students/[id]/fees/confirm` | Principal confirms payment. Sets `confirmedAt` + `confirmedById` on the `FeePayment` record. Sends confirmation email to student with receipt attached. |

---

# PART E: UI layout

## E1. Student — Pending Actions page

```
┌──────────────────────────────────────────────────────┐
│  Pending Actions                          Badge: (5) │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ⚠ PENDING ASSESSMENTS (2)                           │
│  ┌──────────────────────────────────────────────────┐│
│  │ Math Quiz 3          Due: Apr 10   [Take]        ││
│  │ Physics Test 2       Due: Apr 15   [Continue]    ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  📄 PENDING DOCUMENTS (2)                             │
│  ┌──────────────────────────────────────────────────┐│
│  │ Signed student agreement      [Upload]           ││
│  │ Government photo ID           [Upload]           ││
│  └──────────────────────────────────────────────────┘│
│  ✅ Completed: Fee payment proof (uploaded Apr 2)     │
│                                                      │
│  💰 PENDING FEES                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Total: $5,000  Paid: $2,000  Pending: $3,000     ││
│  │ [Upload Payment Receipt]    [View Fee Details →]  ││
│  │                                                   ││
│  │ Previous receipts:                                ││
│  │  • tuition_receipt_mar.pdf  $2,000  [View]        ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

## E2. Principal — Document Vault page

```
┌───────────────────────────────────────────────────────────────┐
│  Document Vault                                               │
│  Year: [2025-26 ▼]  Program: [DSWE ▼]  Batch: [Fall Aug ▼]  │
│                                                               │
│  (Selecting year + program + batch creates folder skeleton)    │
│  (Content populates progressively from student data)          │
├──────────────────────┬────────────────────────────────────────┤
│  FOLDER TREE (left)  │  FOLDER CONTENT (right)                │
│                      │                                        │
│  ▼ 01 - Final Stu.. │  Breadcrumb: 02 > Signed Student Docs  │
│  ▼ 02 - Signed St.. │                                        │
│    (auto-populated)  │  [+ Upload File]  [+ New Subfolder]    │
│  ▶ 03 - Trainer ..  │                                        │
│  ▶ 04 - Approved..  │  Auto-populated files:                  │
│  ▶ 05 - Current ..  │  ┌────────────────────────────────────┐│
│  ▶ 06 - Student ..  │  │ 🟢 John Smith - Signed Contract     ││
│  ▶ 07 - Current ..  │  │    contract.pdf  120KB  [View]      ││
│  ▶ 08 - Sample T.. │  │ 🟢 Jane Doe - Signed Contract       ││
│  ▶ 09 - Transcrip.. │  │    agreement.pdf  95KB  [View]      ││
│  ▶ 09 - Lease Co.. │  │ ⏳ Bob Wilson - Pending              ││
│  ▶ 10 - Fire Ins.. │  └────────────────────────────────────┘│
│  ▼ 11 - Students..  │                                        │
│  ▼ 12 - Others       │  Manually uploaded files:              │
│    ▶ Payment Recei.. │  ┌────────────────────────────────────┐│
│    ▶ Pre-admission.. │  │ batch_policy_addendum.pdf   [View] ││
│    ▶ Attendance      │  └────────────────────────────────────┘│
│    ▶ Transcripts     │                                        │
│                      │  ── Inspection Notes ──                │
│  [+ New Root Folder] │  "All contracts verified" — Apr 3      │
│                      │  [+ Add Note]                          │
│                      │                                        │
│                      │  [📧 Send Inspection Email]            │
├──────────────────────┴────────────────────────────────────────┤
│  (File Viewer overlay window appears here when opened)        │
└───────────────────────────────────────────────────────────────┘
```

## E3. Principal — Student Fees Confirmation

```
┌──────────────────────────────────────────────────────────────┐
│  Student Fees   Program: [DSWE ▼]  Batch: [Fall Aug ▼]      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Student          Total    Paid    Pending   Status          │
│  ──────────────────────────────────────────────────────      │
│  John Smith       $5,000   $2,000  $3,000    ⚠ Pending      │
│                   receipt_mar.pdf [View] [Confirm Payment]   │
│  Jane Doe         $5,000   $5,000  $0        ✅ Paid         │
│  Bob Wilson       $5,000   $0      $5,000    ⚠ Pending      │
│                   No receipts uploaded                        │
│                                                              │
│  [Confirm Payment] → sends email to student:                 │
│    Subject: "Payment Received — John Smith"                  │
│    Body: Amount confirmed, balance summary                   │
│    Attachment: uploaded receipt file(s)                       │
└──────────────────────────────────────────────────────────────┘
```

---

# PART F: Access control

| Feature | Who can access | Impact on existing features |
|---|---|---|
| Student Pending Actions | STUDENT only | None — reads existing data, uses existing upload API |
| Document Vault | PRINCIPAL only | None — new pages, new tables |
| Upload payment receipt | STUDENT (own data only) | Adds fields to `FeePayment` — no impact on existing fee display |
| View/confirm student fees | PRINCIPAL | New views — existing student pages unchanged |
| Auto-populated vault files | Read-only in vault (managed by source system) | Source data (`StudentOnboarding`, `FeePayment`) is not modified |
| Payment confirmation email | PRINCIPAL triggers, STUDENT receives | Uses existing `sendEmail()`, no changes to email system |

---

# PART G: Cross-feature data flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STUDENT ACTIONS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Onboarding (/student/onboarding)    Pending Actions                │
│  ─────────────────────────────────   ──────────────────────         │
│  Step 1: Upload signed contract  ──► Same API, same field           │
│  Step 2: Upload government ID    ──► Same API, same field           │
│  Step 3: Upload fee proof        ──► Same API, same field           │
│  Step 4: Pre-admission test      ──► Read-only (shows pending)      │
│                                      + Upload payment receipt (NEW) │
│                                                                     │
│  ALL uploads write to same StudentOnboarding / FeePayment fields    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     DOCUMENT VAULT (reads at query time)            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Year + Program + Batch selected → all 12 folder shells created     │
│       │                                                             │
│       ├── GENERIC folders (01,03,04,05,06,08)                       │
│       │   └── Shared across batches, principal uploads manually     │
│       ├── YEAR_SPECIFIC folders (07,09,09L,10)                      │
│       │   └── Shared within year, principal uploads manually        │
│       └── BATCH_SPECIFIC folders (02,11,12 + sub-folders)           │
│           └── Unique per program+batch, auto-populated:             │
│               Folder 02 ← StudentOnboarding.signedContractUploadUrl │
│               Folder 11 ← StudentOnboarding.governmentIdUploadUrl   │
│               12/Payments ← feeProofUploadUrl + FeePayment.receipt  │
│               12/Pre-admission ← Attempt results                    │
│               12/Attendance ← links to attendance grid              │
│               12/Transcripts ← placeholder (coming soon)            │
│           Content populates progressively as students complete       │
│           onboarding and upload documents                           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     PRINCIPAL FEE CONFIRMATION                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Principal clicks [Confirm Payment]                                 │
│       │                                                             │
│       ├──► Updates FeePayment.confirmedAt + confirmedById           │
│       │                                                             │
│       └──► sendEmail() to student:                                  │
│            Subject: "Payment Received — {student name}"             │
│            Body: confirmed amount + updated balance                 │
│            Attachments: receipt file(s) from Vercel Blob            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# PART H: Implementation phases (proposed)

| Phase | Scope | Dependencies | Existing code impact |
|---|---|---|---|
| **1** | Schema: add `DocFolder`, `DocFile`, `InspectionNote`, `FolderScope` enum. Add `receiptUrl`, `receiptFileName`, `confirmedAt`, `confirmedById` to `FeePayment`. | None | Additive migration only — no existing columns touched |
| **2** | Student Pending Actions page + `GET /api/student/pending-actions` + `POST .../upload-receipt` | Phase 1 | Reuses existing onboarding upload API (no changes). Reads existing assessment/onboarding/fee data (no changes). |
| **3** | Document Vault seed API + folder CRUD APIs | Phase 1 | New routes only — no changes to existing routes |
| **4** | Document Vault UI — folder tree + file list + breadcrumb + year/program/batch selectors | Phase 3 | New page — no changes to existing pages |
| **5** | File viewer overlay (resize, maximize, minimize, scroll, multi-format) | Phase 4 | New component — no changes to existing components |
| **6** | Auto-population logic (folders 02, 11, 12 reading from `StudentOnboarding` / `FeePayment` / `Attempt`) | Phases 3 + 4 | Read-only queries against existing tables — no writes, no schema changes |
| **7** | Inspection notes UI + consolidated email send | Phase 4 | Uses existing `sendEmail()` — no changes |
| **8** | Principal fees view: student-wise fee list, receipt viewing, "Confirm Payment Received" with email + receipt attachment | Phase 1 | New views/routes. Existing student fees page and principal student list unchanged. |
| **9** | Sidebar updates: add "Pending Actions" to student nav (with badge), add "Document Vault" to principal nav | Phases 2 + 4 | Adds nav items — does not remove or modify existing items |

---

# PART I: Resolved decisions

These were open questions in v1, now resolved based on your feedback:

| # | Question | Decision |
|---|---|---|
| 1 | Folder 02 naming | Auto-generates as "02 - Signed Student Documents - {programCode} ({batchName})" when program+batch is selected |
| 2 | Fee payment receipts | Students can upload multiple receipts over time — each `FeePayment` has its own `receiptUrl` |
| 3 | Principal fee confirmation | Confirms the `FeePayment` record (`confirmedAt`, `confirmedById`) AND sends confirmation email to student with receipt(s) as attachments |
| 4 | Auto-populated file deletion | Principal cannot delete auto-populated files from vault. They are read-only views of source data. Principal can add supplementary files alongside them. |
| 5 | Copy structure | Copies folders only (no files, no auto-populated content). Auto-populated folder markers (`isAutoPopulated`, `autoPopulateKey`) are NOT copied. |
| 6 | Multi-file upload | Yes — upload supports selecting multiple files at once |
| 7 | Student transcripts | Shows "Coming soon — transcript generation will be available in a future update" |
| 8 | Folder 12 sub-filters | Default "all" lists each student as a separate row with their documents/results. Filter by individual student to show only that student's data. |
| 9 | Pre-admission test | Shows score inline in the folder (student name + assessment title + score + percentage). Score text links to the detailed results view. |
| 10 | Folder creation trigger | **Year + Program + Batch selection together creates all 12 folder shells (including sub-folders under 12).** GENERIC and YEAR SPECIFIC folders are shared/reused across batches. BATCH SPECIFIC folders are unique per program+batch. Content populates progressively with whatever data is already available at creation time, then auto-updates as students complete onboarding/actions. |
| 11 | Existing functionality | **All existing features are preserved.** Changes are additive only. Same APIs reused where applicable. No column removals or renames. |
| 12 | Payment confirmation | Principal "Confirm Payment Received" sends email to student with receipt attachments via `sendEmail()`. |
