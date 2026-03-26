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
| Teacher attendance | **Separate panel/tab** from student attendance for **teacher** attendance records. | Implemented |
| Consistency | Same general patterns as student attendance where applicable (filters, lists). | Implemented |

**Related:** `app/(principal)/principal/attendance/page.tsx`, `app/api/principal/attendance/route.ts`, `app/api/principal/teacher-attendance/route.ts`

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

**Related:** `app/api/principal/programs`, `app/(principal)/principal/programs/page.tsx`, Prisma `Program.durationText`

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
| Principal / Admin | **Create, edit, delete** announcements; sends to **current year all students** by email by default. | Implemented |
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

## Maintenance

- After major releases, align this file with **actual routes and Prisma schema**.
- Prefer **`prisma migrate`** in production instead of only `db push` when the team is ready.

*Last updated: aligns with features requested through the Intellee College LMS scope (student email onboarding, teachers M:N programs, dual attendance, teacher self-attendance alerts, program duration text, analytics reports, holidays + email, announcements with selection + templates, typed policies, shared documents, email templates, UI/security notes).*
