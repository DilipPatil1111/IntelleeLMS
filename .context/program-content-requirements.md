# Program Content — Feature Requirements

**Status:** **MVP implemented** in app (April 2026) — see `PLAN.md` §18. Remaining UX (rich editors, file uploads per type, survey builder UI) may be phased.  
**Date:** April 5, 2026  
**Reference UI:** Thinkific-style course curriculum (chapters, lessons, content-type picker); adapted to Intellee’s **Program → Subject → Chapter → Lesson** model.

---

## 1. Purpose

Deliver a **Program Content** capability that lets **Principal/Administrator** and **Teacher/Trainer** authors build and maintain a **structured syllabus** (program tree) with rich lesson types, settings, drafts, and previews. **Enrolled students** consume that content in **view-only** mode from the student portal, with **dashboard alerts** for pending assessments, surveys, mandatory chapters, and **program completion / certificate** flows integrated with existing LMS features.

This document is written for **review before implementation**. After approval, requirements will be mirrored in `PLAN.md` and broken into phased delivery.

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | Single **authoring** surface (Principal + Teacher) to define program syllabus: metadata, subjects, chapters, and typed lessons. |
| G2 | **Students** see a **read-only** full program tree under **Program Content** (and/or **Program** menu) for programs they are enrolled in. |
| G3 | **Quizzes** created from Program Content link to the existing **Assessment** system; students take them via existing assessment flows. |
| G4 | **Alerts** on the student dashboard / pending tasks for: incomplete mandatory quizzes/surveys, incomplete **mandatory** chapters, and other blocking items. |
| G5 | **Certificate** at program end: use **graduation / certificate template** from Principal settings; **Award Certificates** menu for Principal/Teacher (eligible list, preview per student, selective send); email with **PDF** attachment and **congratulations** message; clear **student UX** for eligibility and “graduated” state. |

---

## 3. Out of scope (for v1 unless revised)

- Replacing Thinkific; this is **Intellee-native** implementation.
- Full video hosting pipeline beyond **upload to existing storage** (Vercel Blob / current patterns) unless already supported.
- Paid enrollment / e-commerce (fees are optional metadata only unless tied to existing **Student Fees**).

---

## 3b. Program Content — Unified authoring flow (Thinkific-style, April 2026)

### Navigation consolidation

- **Principal / Administrator:** Single **Program Content** sidebar entry replaces the separate **Programs** menu item. The page opens at the **Programs list** (Step 1), so programs are managed from within Program Content. The separate `/principal/programs` route remains accessible but is no longer in the sidebar.
- **Teacher / Trainer:** **Program Content** sidebar entry opens at their assigned programs list (Step 1). Teachers cannot create or delete programs; only view and author curriculum for assigned ones.
- **Student:** Unchanged — **Program Content** under **Program** menu, view-only.

### Three-step flow inside Program Content

```
Step 1: Programs list
  └─ [Create Program] (principal only) — modal with name, code, description, duration, domain/category/type
  └─ [Click program card] → Step 2

Step 2: Program detail (Subjects + Curriculum)
  ├─ Syllabus panel: instructions, hours, fees, Published toggle → Save
  ├─ [Add / link subject] modal:
  │    • Shows existing subjects for this program (with checkmarks)
  │    • "Create new subject" form: name (required), code (optional, auto-uppercased)
  └─ Curriculum tree (subjects → chapters)

Step 3: Curriculum (integrated in Step 2 view)
  └─ Subject row (expandable) → Chapter rows (expandable) → Lesson rows
       Chapter actions: [Add chapter] [Settings ⚙] [Delete]
       Lesson actions: [Publish/Draft toggle] [Edit ✏] [Delete 🗑]
```

### Chapter settings (all checkboxes shown in modal)

| Setting | Effect |
|---------|--------|
| Mandatory chapter | Student alert until complete |
| Prerequisite | Must complete before next chapter |
| Free preview | Non-enrolled can view |
| Enable discussions | Students can comment |

### Lesson type picker (Thinkific-style 3×3 grid)

Text · Video · PDF · Audio · Presentation · Quiz · Download · Survey · Multimedia

Each lesson has a **Draft / Published** toggle switch (off = draft, on = published).

---

## 4. Roles & navigation

| Role | Menu | Access |
|------|------|--------|
| **Principal / Administrator** | **Program Content** | Full CRUD on programs they manage; assign teachers; publish/draft; preview syllabus. |
| **Principal / Administrator** | **Award Certificates** | List of **completion-eligible** students; **Preview** per student; **select all / deselect / individual** selection; **send email** with certificate **PDF** + congratulations (see §9). |
| **Teacher / Trainer** | **Program Content** | Create/edit content for **assigned** programs/subjects (exact permission matrix **TBD** — default: same program scope as today’s teacher–program links). |
| **Teacher / Trainer** | **Award Certificates** | Same as Principal, scoped to programs they teach (**TBD** exact scope). |
| **Student** | **Program** area → **Program Content** | **View only** for enrolled program(s); cannot edit tree. |

**Student visibility rule:** **Program Content** is visible only when the student is **enrolled** in that program (existing enrollment / `StudentProfile` / batch rules apply).

---

## 5. Program tree (canonical structure)

Displayed to all roles (authors see edit affordances; students see read-only).

```
Program Name
├── Program Instructions     [free text]
├── Program Hours            [free text or structured — see open questions]
├── Duration                 [align with existing Program.duration / durationText]
├── Fees (optional)          [optional; may reference or link to existing fee structures]
└── Content
    └── Subject [code]: Subject N: {Subject Name}
        └── Chapter M: {Chapter name}
            └── Lessons (ordered): Text | Presentation | PDF | Audio | Video | Quiz | Download | Survey | Multimedia
```

- **Ordering:** Subjects, chapters, and lessons support **drag-and-drop reorder** (authors).
- **Hierarchy:** Program → **Subject** → **Chapter** → **Lesson** (typed content item).

---

## 6. Authoring flow: “Create course / program syllabus”

### 6.1 Program selection

- Author selects **Program** from existing **Programs** list (created in Principal portal).
- Program metadata (name, taxonomy links, etc.) remains **source of truth** in existing `Program` model; Program Content **extends** it with syllabus data.

### 6.2 Subjects

- Author selects **Subject** from subjects **linked to that program** (existing or new **Subject** model linkage — implementation detail).
- If the subject does not exist: **Add subject** flow to create and link to the program.

### 6.3 Chapters

- Under each subject: **Add Chapter** (name, optional description, **mandatory** flag — see §11).

### 6.4 Lessons (content items)

For each chapter, author adds one or more **lessons** by choosing a **content type** (modal or grid similar to reference screenshots):

| Type | Summary (v1 behavior) |
|------|------------------------|
| **Text** | Title; **rich text** body (toolbar: font family/size, bold, italic, lists, indent; Word-like editing as feasible in web). **Save Chapter** / **Save as Draft** at bottom. |
| **Video** | Title; **Upload video** (existing file pipeline); optional **additional text** (same rich editor); **Add more files** for multiple attachments. |
| **PDF** | Title; **Upload PDF**; **Add more files** for multiple PDFs. |
| **Presentation** | Title; upload **PPT** and/or **PDF**; viewer shows **slides** in-window (implementation: PDF pages + optional PPT conversion or “download to view” fallback — **TBD**). |
| **Audio** | Title; **rich text** for description; **Upload audio** (supported types **TBD**); **Add more files**. |
| **Quiz** | **Reuse existing “Create Quiz” / assessment** flow from **Assessments** menu: link or embed assessment creation so the resulting assessment appears in student **Assessments** and grading unchanged. |
| **Download** | Title; file(s) for download (any allowed type per policy). |
| **Survey** | Title; **questionnaire builder**: MCQ, multiple-select, paragraph, single line, **ratings**, **scale** (left label, right label). Add questions iteratively. |
| **Multimedia** | Title; **either** (a) **Externally hosted content** radio → **URL** field (webinar, Google Doc, etc.), **or** (b) **Upload .zip** / compressed package; **Add more files** as needed. |

### 6.5 Save actions

- **Save Chapter** — persists chapter + lessons in current state.
- **Save as Draft** — program/syllabus or lesson can remain **draft**; not shown to students until **published** (rules **TBD**: draft at program vs chapter vs lesson level — see §13).

### 6.6 Preview

- **Preview** (student-like or author preview) for draft content — align with reference **Preview** dropdown (all lessons vs published only) **TBD**.

---

## 7. Chapter / lesson settings (per chapter)

Shown **below** each chapter (or per-lesson where applicable — **confirm in review**).

| Setting | Description |
|---------|-------------|
| **Free preview lesson** | Allow non-enrolled or limited preview (**TBD** business rule). |
| **Prerequisite** | Must complete before unlocking later content (ties to **gating** — see §11). |
| **Enable discussions** | Toggle; optional **Apply to all lessons in this course** (reference UI). |
| **Apply to all lessons in this course** | Global apply for selected toggles (reference). |

**Actions:** **Save Chapter**, **Preview**, **Delete Chapter** (with confirm).

---

## 8. Student experience

### 8.1 Program Content (view-only)

- From **Program** menu → **Program Content**: show **full program tree** for the enrolled program.
- No edit controls; optional **progress** indicators (chapter/lesson complete) **TBD**.

### 8.2 Assessments integration

- Any **Quiz** lesson tied to an **Assessment** appears in the student’s **Assessments** list as today.
- **No change** to core take/submit/grade flows unless explicitly required.

### 8.3 Alerts & pending tasks

Generate **dashboard / pending-action alerts** when:

- Student has **pending** linked quiz/assessment (not submitted or not passed — rules **TBD**).
- **Mandatory survey** not completed.
- **Mandatory chapter** (or lesson) not marked complete.

Copy examples: “Pending assessment”, “Mandatory quiz”, “Complete mandatory chapter: {name}”.

### 8.4 Completion & certificate (student-facing)

**Chapter-level completion by students:**
- Students can mark chapters complete via "Mark Chapter Complete" button at the bottom of each expanded chapter
- Marking a chapter complete automatically marks all lessons within that chapter as complete
- The button is only shown when the chapter has incomplete lessons

**Certificate eligibility:**
- A student is eligible when ALL chapters are marked complete AND all assigned assessments have no pending items
- Programs with no published lessons treat the lesson requirement as satisfied (no lesson barrier)
- Eligible students show as "Eligible" in the Award Certificate menu

**Certificate distribution:**
- **Staff** use the **Award Certificates** menu (§9) to **preview** and **release** certificates by email
- **Certificate PDF** is generated from **certificate template** uploaded in **Principal → Settings → Upload Certificate Template**
- After the certificate email has been **sent** (released) for that student+program:
  - Student sees **You are graduated for this program** (or agreed final copy)

**Mark Complete from Award Certificates (bulk):**
- Principal/Administrator and Teacher can also bulk mark students as complete from the Award Certificates menu
- Select Program → Batch → select students → "Mark Complete" marks all pending chapters/lessons as complete for those students

---

## 9. Award Certificates (Principal & Teacher)

Dedicated menu: **Award Certificates** — operational screen for **Principal / Administrator** and **Teacher / Trainer** to process program/course completions and distribute certificates by email.

### 9.1 Eligible student list

- Displays students who **completed** the **course/program** (same completion rules as §8: chapters, mandatory items, assessments, surveys — implementation-defined).
- List is scoped by **program** (and optionally batch — **TBD**) so staff work one program at a time or see filters as needed.
- Each row identifies the student (name, enrollment identifiers per existing patterns).

### 9.2 Selection before send

- **Select all** — selects every **award-eligible** student currently shown in the list.
- **Deselect all** — clears selection.
- **Per-row checkbox** — staff can include or exclude **individual** students for the next send action.
- Sending applies **only to selected** students.

### 9.3 Preview (per student)

- **Preview** is available **for each student** (e.g. per-row or preview panel).
- Preview shows the rendered certificate (student name, program name, template from **Upload Certificate Template**) so staff can verify correctness **before** any email is sent.
- Preview does **not** mark the certificate as awarded until staff runs **Release / Send** (or equivalent).

### 9.4 Release: email with PDF attachment

- Action (e.g. **Send certificate(s)** or **Release**) sends an email to each **selected** student’s **email address**.
- **Attachment:** certificate as **PDF** (generated from the same preview).
- **Email body:** includes a **congratulations** message (copy **TBD** — may use institution default + program name + student name).
- Staff flow: **Preview** (optional per student) → confirm selection → **send** so the certificate is correct, then **release** to email.

### 9.5 Relationship to Program Content

- **Award Certificates** is the **primary** place for **bulk or selective** certificate distribution; any lighter “award” affordance inside **Program Content** (if retained) should align with the same PDF + email behavior or defer to this menu — **TBD**.

---

## 10. Non-functional

| Area | Requirement |
|------|-------------|
| **Performance** | Large trees paginate or lazy-load chapters **TBD**. |
| **Security** | Students only see programs they are enrolled in; authors only see allowed programs. |
| **Backward compatibility** | Existing Programs, Assessments, Student Fees, Graduation certificate email must not break; new tables/relations **additive**. |
| **Audit** | Optional: log who published/awarded certificate (**TBD**). |

---

## 11. Mandatory completion & gating (rules to confirm)

- **Mandatory chapter:** If not completed → **alert** until done.
- **Prerequisite:** Earlier chapter/lesson must be complete before access — **implementation order** (strict lock vs soft alert) **TBD**.
- **Completion signal:** Per-lesson **complete** button vs auto-complete on video % vs manual — **TBD**.

---

## 12. Data model (high level — implementation after approval)

- New entities: e.g. `ProgramSyllabus`, `ProgramSubject`, `ProgramChapter`, `ProgramLesson` with `type` enum and JSON/blob for type-specific payloads.
- Links: `Program` → subjects → chapters → lessons; `Assessment` optional FK from Quiz lesson.
- **Survey** may be new tables or JSON schema — **TBD**.
- **Certificate send:** record per student+program (sent at, sent by, attachment hash or blob ref) — supports **Award Certificates** list state and duplicate-send policy — **TBD**.

---

## 13. Open questions for review

1. **Program Hours** vs **Duration:** single field or duplicate? Use existing `Program.durationText` only?
2. **Fees (optional):** Link to **Fee Structure** rows or free text only?
3. **Subject model:** Reuse existing `Subject` + `Program` many-to-many or new `ProgramSubject`?
4. **Draft visibility:** Draft program vs draft chapter — default?
5. **Discussions:** Integrate with existing notifications or new thread model?
6. **PPT slide viewer:** Server-side conversion vs PDF-only upload?
7. **Certificate:** Same template as graduation certificate or separate “program completion” template?
8. **Award Certificates:** Should **Teacher** see the same program list as Principal or only programs they teach?
9. **Duplicate send:** Block resend, allow “resend”, or show “already sent” with audit only?

---

## 14. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product owner | | | |
| Engineering lead | | | |

---

*End of draft requirements.*
