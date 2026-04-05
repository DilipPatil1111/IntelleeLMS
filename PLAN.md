# Intellee College LMS — Product plan

This document tracks **features requested to date** and where they live in the system. Update it when scope changes.

---

## 1. Student onboarding (Principal / Administrator)

| Feature | Description | Status |
|--------|---------------|--------|
| Welcome email | When a student is created via the portal, send email with **auto-generated temporary password** (password not returned in API responses). | Implemented |
| First login | Student signs in with emailed credentials. | Implemented |
| Force password change | **`mustChangePassword`** until user sets a new password at **`/change-password`**. | Implemented |
| Session guard | Logged-in users with the flag are redirected to change-password (except allowed routes). | Implemented |

**Related:** `lib/email.ts`, `lib/password.ts`, `app/api/principal/students/route.ts`, `app/api/user/change-password/route.ts`, `lib/auth.ts`, `lib/auth-config.ts`, `app/(auth)/change-password/page.tsx`

---

## 2. Teachers / trainers (Principal)

| Feature | Description | Status |
|--------|---------------|--------|
| CRUD | **Add, edit, delete** teachers/trainers (delete may map to **deactivate** user). | Implemented |
| Program assignment | **Many-to-many** relationship between teachers and **programs** (`TeacherProgram`). | Implemented |
| UI | Principal **Teachers** page with program checkboxes. | Implemented |

**Related:** `app/api/principal/teachers/`, `app/(principal)/principal/teachers/page.tsx`, Prisma `TeacherProgram`

---

## 3. Attendance (Principal)

| Feature | Description | Status |
|--------|---------------|--------|
| Student attendance | View/filter **program-wise / batch-wise** (program + batch filters on API/UI). | Implemented |
| Teacher attendance | **Separate panel/tab** from student attendance for **teacher** self-attendance records (`TeacherAttendance`). | Implemented |
| Teacher filter (assigned list) | On **Teacher attendance**, after **Program** and/or **Batch** are chosen, the UI loads **teachers assigned to that scope** (`TeacherProgram` when program-only; **`TeacherSubjectAssignment`** when a batch is selected) and shows a **dropdown** to filter the report. Optional query param **`teacherUserId`** on `GET /api/principal/teacher-attendance` (legacy **`teacherName`** text match still supported if no user id). List API: **`GET /api/principal/attendance/assigned-teachers`**. | Implemented |
| Total present hours | Bottom of the teacher attendance report: **total present hours** for the current filter set — sum of session durations (`AttendanceSession` start/end) for rows where status is **PRESENT** or **LATE**; API returns **`totalPresentHours`**. | Implemented |
| Consistency | Same general patterns as student attendance where applicable (filters, lists). | Implemented |

**Related:** `app/(principal)/principal/attendance/page.tsx`, `app/api/principal/attendance/route.ts`, `app/api/principal/attendance/assigned-teachers/route.ts`, `app/api/principal/teacher-attendance/route.ts` (`teacherUserId`, `teacherName`, `totalPresentHours`), `lib/program-calendar-hours.ts` (duration from session times)

---

## 4. Teacher portal — attendance & alerts

| Feature | Description | Status |
|--------|---------------|--------|
| Student attendance | Teacher marks attendance for class/session/program/course as today. | Implemented |
| Teacher self-attendance | While taking student attendance, teacher can record **own** attendance for that session; optional field flows to `TeacherAttendance`. | Implemented |
| Missing self-attendance | If skipped, create **notification** (e.g. `TEACHER_SELF_ATTENDANCE_REQUIRED`) and surface **red alerts**. | Implemented |
| Dashboard / notifications | Alerts shown on **dashboard** and **notifications**; **click navigates** to the relevant attendance flow (e.g. session with `pendingSession`). | Implemented |
| Complete later | API to **record teacher self-attendance** after the fact (e.g. `record-teacher`). | Implemented |

**Related:** `app/api/teacher/attendance/`, `app/(teacher)/teacher/attendance/page.tsx`, `app/api/teacher/notifications/route.ts`, `components/teacher/teacher-dashboard-alerts.tsx`, `app/(teacher)/teacher/page.tsx`

---

## 5. Programs

| Feature | Description | Status |
|--------|---------------|--------|
| Duration input | Replace numeric **spinner** with **free-text** field so users type duration in **months or years** (stored as `durationText` / equivalent). | Implemented |
| Program taxonomy | **Domains**, **categories**, and **types** are managed on **Program taxonomy**; each row has optional **Customer ID** (unique per list when set). Programs link via optional FKs. | Implemented |
| Application snapshot | On student **apply** submit (and principal-created student + application), **ProgramApplication** stores copies of domain/category/type from the program at that time. | Implemented |
| Institution profile | Singleton **Institution profile** (number, name, addresses, contact, website, social URLs, logo, brand color). `GET/PUT /api/principal/institution-profile`, logo `POST .../logo`. | Implemented |

**Related:** `app/api/principal/programs`, `app/api/principal/program-domains|program-categories|program-types`, `app/api/principal/institution-profile`, `app/(principal)/principal/programs/page.tsx`, `program-taxonomy/page.tsx`, `institution-profile/page.tsx`, Prisma `ProgramDomain`, `ProgramCategory`, `ProgramType`, `InstitutionProfile`, `Program` / `ProgramApplication` taxonomy FKs — see `.context/program-taxonomy-institution-profile.md`.

---

## 6. Reports (Principal)

| Feature | Description | Status |
|--------|---------------|--------|
| Enrollments | **Total students enrolled** per **program**, **year-wise**, **batch-wise**. | Implemented |
| Student outcomes | Counts by status: **passed / failed / transferred / suspended / inactive / graduated / cancelled / expelled** — **program-wise**, **year-wise**, **batch-wise** (as supported by schema/API). | Implemented |
| Teachers | **Total number of teachers** **program-wise**, **batch-wise**, **year-wise** (as supported by analytics). | Implemented |
| Presentation | Reports page with **charts / infographics** (e.g. cards, pie, enrollment views). | Implemented |

**Related:** `app/api/principal/analytics/route.ts`, `app/(principal)/principal/reports/page.tsx`

---

## 7. Holidays

| Feature | Description | Status |
|--------|---------------|--------|
| Year-wise list | List holidays starting from **current year** and **previous year** (grouped / filtered by year). | Implemented |
| Export | **Download** (e.g. CSV) for sharing. | Implemented |
| Email students | Share with students by email; **new holidays** tied to **current academic year** trigger email to **current-year students**. | Implemented |
| CRUD | Add / edit / delete holidays (with academic year association where applicable). | Implemented |

**Related:** `app/api/principal/holidays/`, `app/(principal)/principal/holidays/page.tsx`

---

## 8. Announcements

| Feature | Description | Status |
|--------|---------------|--------|
| Principal / Admin | **Create, edit, delete** announcements; **student** emails always sent on publish when students are in scope; optional **email copy to Sender** (principal) does **not** disable student mail. | Implemented |
| Audience (principal) | **Programs** / **batches**: **All** or **multi-select**; **students**: all matching filters or **pick individuals**; **teachers**: optional **all** or **selected**; no **academic year** dropdown (year scope inferred when “all programs & all batches” via current academic year in code). | Implemented |
| Recipient selection | **Select / deselect** students (**default: all selected**) for targeted sends. | Implemented |
| Teachers | **View** institution announcements; **create** announcements for **assigned program/course/batch** and send to **selected students** (select/deselect). | Implemented |
| Principal parity | Same **select/deselect** behavior for principal broadcast (**default all**). | Implemented |
| Email templates | **Apply** template from **Email templates** to prefill announcement body (e.g. via session storage + navigate). | Implemented |

**Related:** `app/api/principal/announcements/`, `app/(principal)/principal/announcements/page.tsx`, `app/api/teacher/announcements/`, `app/(teacher)/teacher/announcements/page.tsx`, `lib/mail-audience.ts`, `app/(principal)/principal/email-templates/page.tsx`

---

## 9. Email templates (Principal / Administrator)

| Feature | Description | Status |
|--------|---------------|--------|
| CRUD | **Add, edit, delete** templates. | Implemented |
| Audiences | Templates usable for emails to **students**, **staff / teachers / trainers**, **administrators / principals** as applicable. | Implemented |
| Apply | **Apply** action uses the template when sending (e.g. announcement prefill). | Implemented |

**Related:** `app/(principal)/principal/email-templates/page.tsx`, associated API routes

---

## 10. Policies

| Feature | Description | Status |
|--------|---------------|--------|
| Types | **Program policies**, **College-level policies**, **Student policies**, **Other policies**. | Implemented |
| Content | **Upload documents** and/or **URL links** per policy entry. | Implemented |
| CRUD | Full management from principal UI. | Implemented |

**Related:** `app/api/principal/policies/` (or equivalent), `app/(principal)/principal/policies/page.tsx`, Prisma `PolicyType`

---

## 11. Shared documents & templates

| Feature | Description | Status |
|--------|---------------|--------|
| Sharing | Share uploaded documents with **students**, **teachers**, **administrator**, **principal** (audience / role selection). | Implemented |
| CRUD | **Add, edit, delete** shared items. | Implemented |

**Related:** `app/(principal)/principal/shared-documents/page.tsx`, shared documents API

---

## 12. UI / UX & security (cross-cutting)

| Feature | Description | Status |
|--------|---------------|--------|
| Infographics / icons | Enhanced visuals on dashboards and portals (cards, charts, iconography). | Partial / iterative |
| Security | Protect sensitive data: **no passwords in responses**, **hashed passwords**, **role-based APIs**, **session/JWT claims**; consider **rate limits**, **audit logs**, **HTTPS** in production. | Ongoing |

---

## 13. Other modules (existing product scope)

The following were part of ongoing LMS work and are reflected in the app routes:

| Area | Notes |
|------|--------|
| Applications | Principal applications flow |
| Assessments | Principal + teacher + student assessment flows |
| Students | Profiles, status (including **CANCELLED**), principal management |
| Batches | Full CRUD |
| Academic year | Full CRUD |
| Modules / topics / content / question bank | Teacher content management with CRUD where implemented |
| Student portal | Program, fees, attendance, notifications, assessments, etc. |
| Login / register | Login; password-changed banner; registration as applicable |

---

## 14. Attendance program grid, Full Calendar, and reports

**Reference:** Excel workbook *Student Attendance* — tabs **Main Attendance Sheet**, **Attendance-&lt;date&gt;** (per-session days), **Full Program-Calendar** (day × time blocks). UI may improve on the spreadsheet while preserving intent.

**Status:** **Implemented (MVP+)** — program calendar slots, attendance grid, threshold alerts, reports hooks; existing session-based attendance APIs **unchanged**. Regression: verify legacy `/teacher/attendance` flow after deploy.

### 14.1 Attendance grid (Teacher / Principal / Administrator)

- **Filters:** Program → Subject → Batch; assigned teachers and batch students drive the grid.
- **Layout:** Students **rows** × calendar **columns** from **batch start → batch end** (full program span), horizontal scroll.
- **Cells:** **P** (green), **A** (red), **L** (yellow). Row totals **P / A / L**; column totals per date.
- **Weekends & holidays:** Shown with **red tint** as visual hints; **sessions are still allowed** — no blocking of marking attendance or hours when classes run on Saturday/Sunday/custom holiday.
- **Editing:** Add / edit / delete marks for **any date** (including backdated) via grid API; legacy single-day attendance page remains.

### 14.2 Full Calendar (not “Holiday Calendar” as the product name)

#### 14.2.1 Scope & grid

- **Principal / Administrator:** Choose **program** and **batch** → **Full Calendar** shows a **day × time grid** (Excel *Full Program-Calendar* style): columns are calendar days (with **weekend** and **institution holiday** tinting), rows are hours; **teaching blocks** show **teacher** + **session category** (Theory, Practical, Slack, Project) on the teacher’s **color** (default palette **per teacher** when no custom color is set). **Lunch** blocks are neutral/gray and carry no category. **Daily hour totals** appear in the grid footer (sessions only, lunch excluded). Slots are **listed** below the grid.

#### 14.2.2 Date range (single source of truth)

- **From** and **To** at the top define (1) what is **loaded** into the grid and list, and (2) what **day span** new blocks apply to — there is **no separate “dates” textarea** or duplicate date list.
- When a **batch** is selected, **From** / **To** default to that batch’s **`startDate` → `endDate`** (program duration for that intake), so the principal works in the same range as the batch without re-entering dates.
- The principal may **narrow or widen** From/To (e.g. to view a month, or to limit which days receive **new** blocks). **Add time blocks** creates **one slot per calendar day** from **From** through **To** (inclusive) for the chosen time band, teacher, type, and category.

#### 14.2.3 Adding blocks

- **Add time blocks:** After choosing teacher, time, type (Session / Lunch), optional session category, and optional custom color, **Apply to full date range** writes one block per day in the current **From–To** range. No pasted YYYY-MM-DD list.
- **Totals:** Per day in the **grid footer** and aggregate **teaching hours** in the list (same rules: exclude lunch).

#### 14.2.4 Teacher change / handoff (historical vs future)

- **Past and current slots stay immutable** unless edited: each row is a stored `ProgramCalendarSlot` with its **teacher** at save time.
- If a teacher leaves mid-program, the principal can:
  - **Reassign** an existing block to a new teacher (**Set teacher** on a row; color updates to the new teacher’s default palette entry), preserving history per row; and/or
  - **Narrow** From/To to the **remaining** period only, then **Apply to full date range** with the **new** teacher so **future** days get the new assignment while **older** rows still show the previous teacher.
- **Teacher / Student:** **View-only** on Full Calendar. Teacher may **notify** the principal if hours are insufficient; alerts can deep-link to a date.
- **Multiple programs:** Each program/batch combination has its **own** calendar data.

### 14.3 Holidays

- Principal **Holiday** menu: continues to manage custom/public holidays; **Full Calendar** and grid **reuse** holiday + weekend styling.
- Teacher: **view-only** holiday access (aligned with program/batch/year).

### 14.4 Low attendance threshold (settings + automation)

- Threshold from **Institution Settings** / **Program** override (`minAttendancePercent`) — already in schema.
- When a student’s **computed attendance %** falls **below** threshold: **email** to the student; **in-app notifications** to **Principal**, relevant **Administrator**, and **Teacher(s)** with **student, %, and context**.

### 14.5 Reports & PDF

- **Teacher / Principal / Administrator — Reports:** Student-wise, batch-wise, date-wise attendance summaries (extend Reports section).
- **Student — Reports / attendance:** Program-wise **X / total instructional sessions** and **%** for enrolled program.
- **PDF:** Student **download**; Teacher **view-only**; Principal/Administrator **download** with **college name**, program, batch, teachers — via attendance report export (PDF or print-friendly).

### 14.6 Related code

- Grid & calendar APIs under `app/api/*/program-calendar/`, `app/api/*/attendance/grid/`; batch date span for principal pickers from `GET /api/principal/academic-options` (`Batch.startDate` / `endDate`).
- Models: `ProgramCalendarSlot` (`slotType` SESSION | LUNCH, optional `sessionCategory` for SESSION), existing `AttendanceSession` / `AttendanceRecord`.
- UI: `components/calendar/full-program-calendar-client.tsx`, `components/calendar/program-calendar-grid.tsx`; helpers: `lib/program-calendar-grid.ts`, `lib/program-session-category.ts`, `lib/teacher-slot-color.ts`.
- Principal Full Calendar: the extra **“Days in selected range”** day-by-day table was **removed** (grid + scheduled blocks remain).
- Alerts: `lib/attendance-threshold.ts`, notifications + email.

### 14.7 Teacher attendance UX (Single session + Program sheet)

**Status:** **§A–§E implemented** (topic selection removed from scope).

Refinements for **Teacher → Attendance** on the **Single session** tab and **Program sheet** tab.

---

#### A. Single session — “Recent Sessions” (scrollable list + paging, 12 per page)

**Status:** **Implemented** — `GET /api/teacher/attendance/sessions` supports `page`, `pageSize` (default 12, max 50), returns `total` and **`summary`** (aggregate student marks across **all** sessions matching the same filter); teacher UI uses scrollable table + Previous/Next.

**Issue (addressed):** A session saved for a date (e.g. **12-Mar-2026**) may **not show** if it was beyond the old hard cap. Unbounded total count + paging fixes access to all rows.

**Requirements (met):**

1. **Page size:** **12 sessions per page** (fixed).
2. **Paging controls:** **Next / Previous** (and optionally **page X of Y** or page numbers) so the teacher can reach **all** sessions for the current **Subject + Batch**, including backdated rows.
3. **Scroll:** The Recent Sessions **table** sits in a **scrollable** area with a max height so roughly **one page (12 rows)** is visible without the whole page stretching.
4. **API:** Extend `GET /api/teacher/attendance/sessions` (or equivalent) with **`page` + `pageSize` (default 12)** or **`skip` + `take`**, and return **`total` count** (or **`hasMore`**) for correct paging. Remove or raise the hard cap so **no saved session is hidden** only because of list length.
5. **Sort order:** **Most recently saved first** (`AttendanceSession.createdAt` descending) so the session just recorded appears at the top of page 1 (see §14.8).

**Related:** `app/api/teacher/attendance/sessions/route.ts`, `app/(teacher)/teacher/attendance/page.tsx`.

---

#### B. Program sheet — teacher hours & attendance at the bottom of the sheet

**Status:** **Implemented** — `teacherFooterRows` from `loadAttendanceGridData`; footer below column totals; scheduled hours from **SESSION** calendar slots **when present**, else from **Single session** `AttendanceSession.startTime` / `endTime` for that subject + batch + day; self-attendance **P/A/L/E** when `TeacherAttendance` matches that teacher for that day’s session. See **§14.9**.

**Goal:** Below the **student** rows, add a **footer block** for **teachers**: **names** in the **sticky left column** (student-name column area), and **per-date** cells showing **hours** and **teacher attendance** (Present / Absent / Late / Excused), **date-wise**, aligned under the same date columns as students—visually consistent with the existing **Teacher / Trainers** / **Time** / **Topic** header rows (same grid styling).

**Requirements (met):**

1. **Layout:** After the last student row (and after any **column totals** row, if kept), render additional **sheet rows** for each relevant **teacher** for the selected batch/subject.
2. **Left columns:** Teacher **name** (and label text if needed) in the same **sticky** band used for student names.
3. **Date columns:** Per date: display **scheduled hours** (from calendar/slots when available) and **teacher attendance** for that session/day.
4. **Data:** Use **`TeacherAttendance`**, **`ProgramCalendarSlot`**, and **`AttendanceSession`** as needed; document multi-teacher and “no slot” edge cases during build.

**Related:** `components/attendance/attendance-program-grid-client.tsx`, `lib/attendance-grid-server.ts`.

---

#### C. Single session — student roster (absent row highlight)

**Status:** **Implemented**

In the **Student / Status** table on the Single session tab, any row whose selected status is **ABSENT** uses a **light red row background** (`bg-red-100/90`) so absent students are easy to spot at a glance. The **ABSENT** toggle remains the solid red selected style.

**Related:** `app/(teacher)/teacher/attendance/page.tsx`.

---

#### D. Program sheet — sticky left columns (horizontal scroll)

**Status:** **Implemented**

The first three columns (**Sr.**, **Student name**, **Total hrs attended**) stay fixed while **date columns** scroll horizontally. Implementation uses **`border-separate`** (not `border-collapse`), sticky **`left`** offsets aligned to fixed column widths, rising **z-index** on the sticky band, and row-matched **backgrounds** on sticky cells so zebra striping does not bleed when scrolling.

**Related:** `components/attendance/attendance-program-grid-client.tsx`.

---

#### E. Program sheet — meta row labels (Teacher hrs, Time, Topic)

**Status:** **Implemented**

In the **header block** above student rows (emerald band), the fixed left three columns must show a **visible text label** for each meta row type:

1. **Teacher / Trainers** — unchanged (teacher names summary per date in date cells).
2. **Teacher hrs** — rows that render **`teacherHourLines`** (`… Hrs: N` per date). The first such row shows the label **“Teacher hrs”** in the sticky left band; additional lines (if any) keep an empty label cell so extra teacher-hour lines do not repeat the title.
3. **Time** — label **“Time”** in the left band; per-date **time range** unchanged.
4. **Topic** — label **“Topic”** in the left band; per-date topic unchanged.

Labels use the same **sticky** left block and **emerald** text styling as **Teacher / Trainers** so they remain visible when scrolling date columns horizontally.

**Related:** `components/attendance/attendance-program-grid-client.tsx` (teacher + principal program sheet).

---

## Maintenance

- After major releases, align this file with **actual routes and Prisma schema**.
- Prefer **`prisma migrate`** in production instead of only `db push` when the team is ready.

### 14.8 Teacher — Single session: Recent Sessions Attendance list

**Status:** **Implemented**

**Goal:** Make student **present** / **absent** outcomes visible in the **Recent Sessions Attendance** card (title on the teacher page), surface **recently saved** sessions first, and show **percentage summaries** at the end of each row and in the table footer.

**Sorting / discovery**

- **Recent Sessions** lists rows by **`AttendanceSession.createdAt` descending** so a session just saved appears at the top of page 1 (even if its calendar date is older than other rows).
- Optional later: dedupe or upsert one session per (subject, batch, calendar day) to avoid multiple rows for the same class day.

**Columns (student roster per session)**

- **Present:** `(PRESENT + LATE) / N` where `N` = student `AttendanceRecord` count for that session. **UI:** the **Present** table cell uses a **green background** (`emerald`) when the present count is **> 0**; the same applies to the **Present** cell in both footer total rows when the aggregated present count is **> 0**.
- **Absent:** `ABSENT / N` (explicit column). **UI:** the **Absent** table cell uses a **red background** when `ABSENT > 0` (e.g. `1/1`); the same styling applies to the **Absent** cell in **Totals (this page)** and **Totals (all sessions, this subject and batch)** when the aggregated absent count is greater than zero.
- **% Present / % Absent (row end):**  
  `% Present = round(100 × (PRESENT + LATE) / N)`  
  `% Absent = round(100 × ABSENT / N)`  
  `N` includes every student record; **EXCUSED** (and similar) count toward `N` and reduce both headline percentages proportionally.

**Footer rows**

1. **Totals (this page):** Sums across **only the sessions on the current page** — same count and % formulas on aggregated totals.
2. **Totals (all sessions, this subject and batch):** From **`GET /api/teacher/attendance/sessions`** response field **`summary`**: all `AttendanceRecord` rows linked to sessions matching the request filter (`createdById` + optional `subjectId` / `batchId`), with `recordCount`, `presentCount`, `absentCount`, `pctPresent`, `pctAbsent`.

**API**

- Response includes **`summary`** as above (computed server-side so paging does not drop data from the “all sessions” totals).

**Date display**

- Calendar day uses the **Y-M-D** portion of `sessionDate` for display (avoids UTC midnight shifting the day in `toLocaleDateString`).

**Out of scope**

- Changing how **teacher** “You” is stored.

---

### 14.9 Program sheet — hours aligned with Single session (subject + batch)

**Status:** **Implemented** (server: `lib/attendance-grid-server.ts`, `lib/program-calendar-hours.ts`)

**Problem:** The Program sheet did not show believable **hours** when classes were recorded only via **Single session** (no `ProgramCalendarSlot` for that day), or when stored times were not strict `HH:mm`. Teacher per-date cells showed **0h** even though `AttendanceSession` had start/end; student **Total hrs attended** could also stay at zero if duration resolved to zero.

**Requirements**

1. **Duration for a grid cell’s date** (for the selected **subject** + **batch**):  
   - **Primary:** Sum durations of **SESSION** calendar slots for that batch date where `subjectId` is **null** or equals the grid **subject** (ignore other subjects’ slots on the same day).  
   - **Fallback:** If that sum is **0**, use the **`AttendanceSession`** for the same batch + subject + local calendar day: duration = parsed **`endTime` − `startTime`** (same fields saved from Single session).

2. **Student “Total hrs attended” column:** For each student, sum over date columns: **`hoursForDay[date] × weight`**, where `weight = 1` if the cell is present/late (**1** / **L**), else **0**, and `hoursForDay` uses the duration rule in (1).

3. **Teacher footer — scheduled hours per date:** For each teacher, sum that teacher’s **SESSION** slots (subject filter as in (1)). If the sum is **0** and that teacher has **`TeacherAttendance`** on the **`AttendanceSession`** for that date, use the same **AttendanceSession** duration as in (1) for that cell.

4. **Header meta (Teacher / Trainers hour lines, Time range):** When there are no calendar lines but an attendance session exists with times, show **teacher label** and **hour line** derived from **`TeacherAttendance`** + session duration so the top of the column matches the footer.

5. **Time parsing:** Accept **`HH:mm`**, **`HH:mm:ss`**, and **`h:mm AM/PM`** so UI and legacy DB values still yield a positive duration when valid.

**Related:** `POST /api/teacher/attendance` (stores `startTime` / `endTime` on `AttendanceSession`), `loadAttendanceGridData`, `AttendanceProgramGridClient`.

---

### 14.10 Student portal — Full Calendar, program attendance sheet, and “My Attendance” banner

**Status:** **Implemented**

#### Full Calendar (student)

- **From / To:** Students can **change the date range** and **Refresh** (not read-only when `mode="student"`). Teachers with a **fixed batch** from a deep-link may still have read-only dates where that applies.
- **Default range:** When the batch has **`startDate` / `endDate`**, **From** and **To** default to that **program period** (same idea as principal batch pickers).
- **Program grid (Excel-style) title:** Shows **Teacher name** (from scheduled slots, else signed-in user), **Program name**, **Batch name** — using **profile** + slot payload so labels are not “—” when there are no slots in range.
- **View-only:** No add/edit blocks for students (unchanged).

#### Program attendance sheet (student)

- **Read-only** spreadsheet aligned with the principal/teacher **Program sheet**: same **`loadAttendanceGridData`** shape, filtered to **one row** (logged-in student).
- **APIs:** `GET /api/student/attendance/grid-options` (batch + subjects for the student’s program); `GET /api/student/attendance/grid?batchId&subjectId`.
- **UI:** `AttendanceProgramGridClient` with **`apiRole="student"`** (no save; cells not editable; **Reload** only). Embedded on **My Attendance** when the student has a batch; first subject **auto-selected** when possible.

#### “My Attendance” — required % vs batch %

- **Required attendance** comes from **Program** `minAttendancePercent` or **Institution Settings**, default **75%** if unset.
- **Batch attendance %** from `computeStudentBatchAttendancePercent` (same threshold pipeline as alerts).
- **If batch % ≥ required:** show **bold** success styling, **green** `CheckCircle2` icon, and **(meeting requirement)** in **bold green**.
- **If batch % < required:** show **bold red** styling, **😞** sad emoji, and **(below requirement)** in **bold red**.

**Related:** `app/(student)/student/full-calendar/page.tsx`, `components/calendar/full-program-calendar-client.tsx`, `app/(student)/student/attendance/page.tsx`, `components/attendance/student-attendance-grid-embed.tsx`, `components/attendance/attendance-program-grid-client.tsx`, `app/api/student/attendance/grid/route.ts`, `app/api/student/attendance/grid-options/route.ts`, `lib/attendance-threshold.ts`.

---

### 14.11 Principal — attendance overview & students list (UX requirements)

**Status:** **Implemented**

#### Overview & sessions (principal attendance)

- Prefer label **Attendance** (not “**Marks**”) for counts of recorded **student attendance rows** (P/A/L/E).
- Short on-page copy explains **P / A / L / E** and that **Excused** is an **approved** absence (tracked separately from unexcused **Absent**).
- **Student-wise** table: column **Total attendance** after **L** = **Present + Late** (per student).

#### All Students

- **Student** filter is a **dropdown** (options = all students), default **All students**; **`GET /api/principal/students?studentId=`** narrows the table.

**Related:** `app/(principal)/principal/attendance/page.tsx`, `components/attendance/principal-attendance-dashboard.tsx`, `app/api/principal/attendance/consolidated/route.ts`, `app/(principal)/principal/students/page.tsx`, `app/api/principal/students/route.ts`.

---

## 15. Teacher portal — list pagination (server-driven)

**Goal:** Large teacher-side lists load in fixed-size pages so the UI stays fast and navigable. **Paging is server-driven:** each list API accepts **`page`** (1-based) and **`pageSize`**, returns the slice plus **`total`**, and the UI shows **Previous / Next** plus a short summary (e.g. **N–M of total**, **page X of Y**).

| Screen | Default page size | Query params | API route | Response shape (list + meta) |
|--------|-------------------|--------------|-----------|------------------------------|
| **Announcements** | 10 | `page`, `pageSize` (max 50) | `GET /api/teacher/announcements` | `announcements`, `total`, `page`, `pageSize` |
| **Question bank** | 10 | `q`, `subject`, `type`, `page`, `pageSize` | `GET /api/teacher/questions` | `questions`, `subjects`, `total`, `page`, `pageSize` |
| **Grading** | 10 | `assessmentId` (optional), `page`, `pageSize` | `GET /api/teacher/grading-queue` | `attempts`, `total`, `page`, `pageSize` |
| **Holidays** | 10 | existing date/year filters, `page`, `pageSize` | `GET /api/teacher/holidays` | `holidays`, `byYear`, `total`, `page`, `pageSize` |
| **Students** (roster) | 15 | `q`, `programId`, `batchId`, `page`, `pageSize` (max 100) | `GET /api/teacher/roster` | `students`, `batches`, `total`, `page`, `pageSize` |

**Behavior**

- **Filter changes** reset to **page 1** (search, subject, program/batch, grading assessment filter).
- **Creating** an announcement resets to page 1 and refetches so the new item appears on the first page when sorted by recency.
- **Empty** roster / no batches: API still returns `total`, `page`, `pageSize` for consistent client state.

**Related:** `app/(teacher)/teacher/announcements/page.tsx`, `app/(teacher)/teacher/questions/page.tsx`, `app/(teacher)/teacher/grading/`, `app/(teacher)/teacher/holidays/page.tsx`, `app/(teacher)/teacher/students/page.tsx`, and `app/api/teacher/` routes named above.

---

*Last updated: §18 Program Content **MVP implemented** (syllabus, APIs, Award Certificates, student view); §8 announcements (principal multi-audience + sender copy); §14.10–§14.11 student calendar/sheet/banner + principal attendance & students UX; Full Calendar “Days in selected range” removed.*


---

## §17. My Profile — all roles

**Goal:** Every authenticated user (Principal, Teacher, Student) has a dedicated **My Profile** page in their portal where they can view and edit their personal information, upload/remove a profile photo, and change their password.

### Routes

| Role | URL |
|------|-----|
| Principal | `/principal/my-profile` |
| Teacher | `/teacher/my-profile` |
| Student | `/student/profile` (existing, now editable) |

### Sidebar access
- **Principal**: "My Profile" link near the top of the nav. Sidebar avatar is clickable.
- **Teacher**: "My Profile" link near the top of the nav. Sidebar avatar is clickable.
- **Student**: Existing "My Profile" sidebar link; avatar is clickable.

### Editable fields (all roles)
- First Name *(required)*, Middle Name, Last Name *(required)*
- Phone, Address, City, State, Country, Postal Code, Visa/Immigration Status
- Profile Photo (JPG/PNG/WebP, max 5 MB) — upload and remove

### Read-only contextual info
- **Students**: Enrollment No., Admission Status, Program, Batch, Academic Year
- **Teachers**: Specialization, Qualification, Experience, Assigned Programs
- **Principal**: no role-specific section (use Institution Profile for institution details)

### Change Password
All users can change their password from My Profile (current password required; minimum 8 characters).

### APIs
- `GET /api/user/profile` — returns profile + role-specific details
- `PUT /api/user/profile` — updates editable personal fields
- `POST /api/user/profile-picture` — uploads profile photo (all roles)
- `DELETE /api/user/profile-picture` — removes profile photo (all roles)
- `POST /api/user/change-password` — changes password

### Shared implementation
`components/profile/my-profile-client.tsx` — single client component used by all three role pages.

---

## §18. Program Content (syllabus, lessons, student view, alerts, certificate)

**Status:** **Implemented (MVP)** — full spec: `.context/program-content-requirements.md`

**Goal:** Principal/Teacher **authoring** of a **Program → Subject → Chapter → Lesson** tree (Text, Video, PDF, Presentation, Audio, Quiz, Download, Survey, Multimedia), with **Save as Draft**, **chapter settings** (free preview, prerequisite, discussions, apply-to-all), **Preview**, and **Delete Chapter**. **Students** see **Program Content** under **Program** as **view-only**; quizzes tie into existing **Assessments**; **dashboard alerts** for pending/mandatory assessments, surveys, and **mandatory** chapters; **program completion** leads to **Award Certificates** menu: list of **eligible** students, **select all / deselect / individual**, **Preview** per student, **send email** with certificate **PDF** + **congratulations** body; template from **Upload Certificate Template** (Principal settings); student messaging (**Eligible for award** → **Graduated** after send).

**Shipped in this codebase**

- **DB:** `ProgramSyllabus`, `ProgramChapter`, `ProgramLesson` (+ `ProgramLessonKind`), `ProgramLessonCompletion`, `ProgramCertificateSend` — migration `20260405202935_program_content_syllabus`.
- **Routes:** Principal & Teacher `/program-content` (editor); Student `/student/program-content` (read-only tree, mark non-quiz lessons complete); **Award Certificates** `/principal/award-certificates` & `/teacher/award-certificates` (preview PDF, bulk email).
- **APIs:** `/api/principal/program-content/*`, `/api/teacher/program-content/*`, `/api/student/program-content`, `/api/student/program-content/status`, `/api/student/program-content/lessons/[lessonId]/complete`, `/api/*/award-certificates*`.
- **Helpers:** `lib/program-content.ts`, `lib/program-content-certificate-email.ts`.
- **Student dashboard:** Banner when published syllabus has incomplete lessons (`countIncompleteProgramContentItems`).

**Follow-ups (not in MVP):** Rich text / file upload UI per lesson type, drag-and-drop reorder, survey builder schema, PDF merge with student name on template, mandatory-chapter-specific copy in alerts.
