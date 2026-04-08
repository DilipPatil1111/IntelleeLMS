# Features Reference

Complete inventory of implemented features, their locations, and key files.

---

## Authentication & User Management

| Feature | Location |
|---|---|
| Login (Credentials) | `app/(auth)/login/page.tsx`, `lib/auth-config.ts` |
| Registration | `app/(auth)/register/page.tsx` |
| Forgot Password | `app/(auth)/forgot-password/page.tsx`, `app/api/auth/forgot-password/route.ts` |
| Reset Password | `app/(auth)/reset-password/page.tsx`, `app/api/auth/reset-password/route.ts` |
| Change Password | `app/change-password/`, handled within user profile pages |
| Role-based Access | `lib/portal-access.ts`, `lib/api-auth.ts` (requireStudentPortal, requireTeacherPortal, requirePrincipalPortal) |
| Portal Grants | `model UserPortalGrant` in `prisma/schema.prisma` — allows cross-portal access |
| Portal Switcher | `components/layout/portal-switcher.tsx` — switch between portals for users with grants |
| Portal Access Settings | `components/settings/portal-access-settings.tsx`, `app/api/principal/portal-grants/route.ts` |
| User Profile | `components/profile/my-profile-client.tsx` — shared across principal/teacher portals |
| Profile Picture Upload | `app/api/user/profile-picture/route.ts`, `app/api/student/profile-picture/route.ts` |

---

## Student Portal

### Dashboard
- **File:** `app/(student)/student/page.tsx`
- Stat cards (assessments, pending, avg score, attendance) with gradient variants
- Student journey progress indicator (`components/student/student-journey-progress.tsx`)
- Onboarding phase banner
- Program content completion alert
- Recent assessments with dot-badge status indicators
- Quick links with gradient card styling

### Apply to Program
- **File:** `app/(student)/student/apply/page.tsx`
- **API:** `app/api/student/apply/route.ts`
- Program taxonomy (domain, category, type) displayed when selecting a program

### Onboarding
- **Page:** `app/(student)/student/onboarding/page.tsx`
- **API:** `app/api/student/onboarding/route.ts`, `app/api/student/onboarding/upload/route.ts`
- Conditional pre-admission test (vocational programs only via `isVocational` flag)
- Upload Document / Mark Complete / Submit Later buttons
- Context-aware messages: enrolled students see pending steps list instead of "waiting for principal"
- Progress bar with step count adjusted for vocational/non-vocational
- Submission history tracked via `StudentSubmissionLog` model

### Multi-Program Support
- **Model:** `ProgramEnrollment` junction table (many-to-many User ↔ Program)
- **API:** `app/api/student/programs/route.ts` — lists all enrolled programs
- **Program Content:** `app/(student)/student/program/[programId]/page.tsx`
- **Program Selector:** `app/(student)/student/program/page.tsx` — program picker

### Program Content (Student View)
- **Page:** `app/(student)/student/program-content/page.tsx`
- **API:** `app/api/student/program-content/route.ts`, `[programId]/route.ts`
- Read-only view of program syllabus (subjects → chapters → lessons)
- Lesson completion tracking via `app/api/student/program-content/lessons/[lessonId]/complete/route.ts`
- Completion status via `app/api/student/program-content/status/route.ts`
- Model: `ProgramLessonCompletion` tracks per-student lesson progress

### Session Recordings (Student View)
- Displayed above Curriculum in `app/(student)/student/program/[programId]/page.tsx`
- Collapsible timeline with play-on-expand video player
- **API (read-only):** `app/api/student/session-recordings/route.ts`

### Assessments
- **List:** `app/(student)/student/assessments/page.tsx`, `assessments-list-client.tsx`
- **Take:** `app/(student)/student/assessments/[id]/take/page.tsx`, `take-assessment-client.tsx`
- Pagination (10 items per section)

### Results
- **Page:** `app/(student)/student/results/page.tsx`, `results-list-client.tsx`
- Institution logo in header
- Pagination

### Attendance
- **Page:** `app/(student)/student/attendance/page.tsx`, `attendance-page-client.tsx`
- Multi-program selector (when enrolled in multiple programs)
- Subject and date-range filters
- Attendance stats with colored stat card variants
- Program attendance grid embed (`components/attendance/attendance-program-grid-client.tsx`)
- Pagination (15 per page)

### Full Calendar
- **Page:** `app/(student)/student/full-calendar/page.tsx`, `full-calendar-multi-program.tsx`
- **API:** `app/api/student/program-calendar/route.ts`
- Multi-program selector
- Uses `FullProgramCalendarClient` with `fixedBatchId`

### Pending Actions
- **Page:** `app/(student)/student/pending-actions/page.tsx`
- **API:** `app/api/student/pending-actions/route.ts`
- High-priority alerts banner with count
- Sections: pending assessments (HIGH), below-passing results (HIGH), attendance alerts (HIGH), pending documents (HIGH), fees
- Contact principal/administrator messages for below-passing marks and low attendance
- Document upload/replace with version history via `StudentSubmissionLog`
- Receipt upload with amount
- **Receipt API:** `app/api/student/pending-actions/upload-receipt/route.ts`
- **Receipt fetch:** `app/api/student/pending-actions/receipt/[id]/route.ts`

### Fees
- **Page:** `app/(student)/student/fees/page.tsx`

### Feedback
- **Page:** `app/(student)/student/feedback/page.tsx`
- Send feedback (category, title, message, optional teacher)
- Feedback history with pagination (10 per page)

### Notifications
- **Page:** `app/(student)/student/notifications/page.tsx`, `notifications-list-client.tsx`
- Pagination (15 per page)

### Holidays
- **Page:** `app/(student)/student/holidays/page.tsx`
- **API:** `app/api/student/holidays/route.ts`

### Profile
- **Page:** `app/(student)/student/profile/page.tsx`

---

## Teacher Portal

### Dashboard
- **File:** `app/(teacher)/teacher/page.tsx`
- Stat cards, recent submissions, pass-rate guards
- Dashboard alerts (`components/teacher/teacher-dashboard-alerts.tsx`)

### Assessments
- **CRUD:** `app/api/teacher/assessments/route.ts`, `[id]/route.ts`
- **Copy:** `app/api/teacher/assessments/[id]/copy/route.ts`
- **Publish:** `app/api/teacher/assessments/[id]/publish/route.ts`
- **Share:** `app/api/teacher/assessments/[id]/share/route.ts`
- **Schedule email:** `app/api/teacher/assessments/[id]/schedule-email/route.ts`
- **Students:** `app/api/teacher/assessments/[id]/students/route.ts`
- **Submissions:** `[id]/submissions-table-client.tsx` (paginated, 15 per page)
- Cascading delete in transactions

### Session Recordings
- **Page:** `app/(teacher)/teacher/session-recordings/page.tsx`
- **API:** `app/api/teacher/session-recordings/route.ts` (GET, POST)
- **Delete API:** `app/api/teacher/session-recordings/[id]/route.ts` (sends email alert to principal)
- Upload UI with title, date, duration, video file
- Paginated list with delete

### Program Content
- **Page:** `app/(teacher)/teacher/program-content/page.tsx`
- Uses shared `ProgramContentAdminClient` (`components/program-content/program-content-admin-client.tsx`)
- Lesson editor modal with specialized editors: rich text, quiz builder, survey builder, file upload area
- **APIs:** Full CRUD under `app/api/teacher/program-content/*` (subjects, chapters, lessons, syllabus, uploads, quiz linking)
- Subject delete request flow: `app/api/teacher/program-content/subjects/[subjectId]/delete-request/route.ts`

### Certificate Templates
- **Page:** `app/(teacher)/teacher/certificate-templates/page.tsx`
- Uses shared `CertificateTemplatesClient` (`components/certificates/certificate-templates-client.tsx`)
- **APIs:** Full CRUD under `app/api/teacher/certificate-templates/*` (list, create, update, delete, upload, generate, preview, send)
- Background image upload, configurable field positions, PDF generation
- Canva design integration (connect account, create designs, export as template background)

### Award Certificates
- **Page:** `app/(teacher)/teacher/award-certificates/page.tsx`
- Uses shared `AwardCertificatesClient` (`components/program-content/award-certificates-client.tsx`)
- **APIs:** `app/api/teacher/award-certificates/*` (list eligible, preview, send)
- Select students, preview per-student certificate, bulk email with PDF attachment

### Reports
- **Page:** `app/(teacher)/teacher/reports/page.tsx`
- Division-by-zero guard on pass threshold
- **Export:** `app/api/teacher/reports/export/route.ts`

### Holidays
- **Page:** `app/(teacher)/teacher/holidays/page.tsx`
- **API:** `app/api/teacher/holidays/route.ts`
- Program filter, pagination

### Full Calendar
- **Page:** `app/(teacher)/teacher/full-calendar/page.tsx`
- **API:** `app/api/teacher/program-calendar/route.ts`
- Hour update notifications: `app/api/teacher/program-calendar/notify/route.ts`

### Other Teacher Features
- Question Bank, Grading, Attendance, Students, Subjects, Modules, Announcements, Feedback, Settings, My Profile
- **Transcript:** `app/api/teacher/transcript/[studentId]/route.ts`
- **Notifications:** `app/api/teacher/notifications/route.ts`
- Program taxonomy (domains/categories/types) CRUD mirroring principal APIs

---

## Principal Portal

### Dashboard
- **File:** `app/(principal)/principal/page.tsx`
- **Analytics:** `app/api/principal/analytics/route.ts`, `app/api/principal/stats/route.ts`

### Applications
- **Page:** `app/(principal)/principal/applications/page.tsx`
- **Enrollment API:** `app/api/principal/applications/[id]/route.ts`
- Creates `ProgramEnrollment` record on enrollment via transaction

### Students
- **Page:** `app/(principal)/principal/students/page.tsx`
- Pagination (15 per page)
- **Create/Update APIs** create `ProgramEnrollment` records
- **Status management:** `app/api/principal/students/[id]/status/route.ts` with `lib/student-status.ts` (lifecycle transitions, notifications via `lib/student-status-email.ts`)
- **Binder document management:** `app/api/principal/students/[id]/binder-document/route.ts`
- **Onboarding confirm:** `app/api/principal/students/[id]/onboarding/confirm/route.ts`

### Student Fees
- **Page:** `app/(principal)/principal/student-fees/page.tsx`
- **API:** `app/api/principal/students/fees/route.ts`
- **Per-student detail:** `app/api/principal/students/[id]/fees/route.ts`
- **Confirm payment:** `app/api/principal/students/[id]/fees/confirm/route.ts`
- Student-wise fee summary (total/paid/pending), receipt viewing, payment confirmation with email

### Session Recordings
- **Page:** `app/(principal)/principal/session-recordings/page.tsx`
- **API:** `app/api/principal/session-recordings/route.ts` (GET, POST)
- **Delete API:** `app/api/principal/session-recordings/[id]/route.ts`
- Full upload/delete management

### Program Content
- **Page:** `app/(principal)/principal/program-content/page.tsx`
- Uses shared `ProgramContentAdminClient`
- Full CRUD: subjects, chapters, lessons with all lesson types
- **APIs:** Full CRUD under `app/api/principal/program-content/*`

### Certificate Templates
- **Page:** `app/(principal)/principal/certificate-templates/page.tsx`
- Uses shared `CertificateTemplatesClient`
- **APIs:** Full CRUD under `app/api/principal/certificate-templates/*`
- Same capabilities as teacher (plus full template management)

### Award Certificates
- **Page:** `app/(principal)/principal/award-certificates/page.tsx`
- **APIs:** `app/api/principal/award-certificates/*` (list eligible, preview, send)

### Program Taxonomy
- **Page:** `app/(principal)/principal/program-taxonomy/page.tsx`
- **APIs:** domains (`app/api/principal/program-domains/*`), categories (`app/api/principal/program-categories/*`), types (`app/api/principal/program-types/*`)
- Tabs for Domains, Categories, Types; CRUD with optional Customer ID and sort order

### Institution Profile
- **Page:** `app/(principal)/principal/institution-profile/page.tsx`
- **API:** `app/api/principal/institution-profile/route.ts`
- **Logo upload:** `app/api/principal/institution-profile/logo/route.ts`
- Singleton record: institution number, legal name, addresses, phone, email, website, social URLs, logo, brand color

### Inspection Binder (Document Vault)
- **Page:** `app/(principal)/principal/inspection-binder/page.tsx` (redirect from `/principal/document-vault`)
- **APIs:** Full CRUD under `app/api/principal/document-vault/*` (folders, files, notes, seed, review-draft, review-complete, copy, auto-files)
- **File viewer:** `components/document-vault/file-viewer.tsx` (draggable, resizable, maximize/minimize, multi-format)
- Hierarchical folder structure by year + program + batch
- Auto-populated folders from student data (signed contracts, photo IDs, payment receipts, pre-admission tests)
- Inspection notes with consolidated email (Review Complete workflow)
- Models: `DocFolder`, `DocFile`, `InspectionNote`
- **Recipients:** `app/api/principal/inspection-recipients/route.ts`

### Full Calendar (Program Calendar)
- **Page:** `app/(principal)/principal/full-calendar/page.tsx`
- **APIs:** `app/api/principal/program-calendar/route.ts`, `[id]/route.ts`, `teachers/route.ts`
- Time slot management with session categories (THEORY, PRACTICAL, SLACK, PROJECT)
- Teacher assignment, color coding
- Model: `ProgramCalendarSlot`

### Settings
- **Page:** `app/(principal)/principal/settings/page.tsx`
- **APIs:** `app/api/principal/settings/route.ts`
- **Signature:** `app/api/principal/settings/signature/route.ts`, `signature/upload/route.ts`
- **Template upload:** `app/api/principal/settings/upload/route.ts`
- Compliance thresholds (attendance, marks, fees), certificate/transcript templates, contract samples

### Other Principal Features
- Feedback (with pagination), Onboarding Review, All Assessments (detailed results + PDF export), Teachers, User Management (paginated, search via `app/api/principal/users-search/route.ts`), Attendance (consolidated + grid), Batches, Reports, Holidays, Email Templates, Announcements, Policies, Shared Documents, My Profile
- **Teacher Attendance:** `app/api/principal/teacher-attendance/route.ts`, `[id]/route.ts`
- **Academic options:** `app/api/principal/academic-options/route.ts`

---

## Canva Integration

| Feature | Location |
|---|---|
| OAuth2+PKCE Flow | `app/api/canva/authorize/route.ts`, `app/api/canva/callback/route.ts` |
| Connection Status | `app/api/canva/status/route.ts` |
| Disconnect | `app/api/canva/disconnect/route.ts` |
| Create Design | `app/api/canva/create-design/route.ts` |
| List Designs | `app/api/canva/designs/route.ts` |
| Export Design | `app/api/canva/export/route.ts` |
| Design Studio UI | `components/canva/canva-design-studio.tsx` |
| OAuth Helpers | `lib/canva.ts` (PKCE, token exchange, refresh) |
| Model | `CanvaAccount` in `prisma/schema.prisma` |

Canva integration is optional. Requires `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI` env vars. Used within Certificate Templates pages for creating certificate backgrounds.

---

## Shared / Cross-Cutting

### Reusable UI Components
| Component | File | Notes |
|---|---|---|
| `Pagination` | `components/ui/pagination.tsx` | First/prev/next/last, ellipsis, total count |
| `StatCard` | `components/ui/stat-card.tsx` | Variants: default, indigo, emerald, amber, rose |
| `Badge` | `components/ui/badge.tsx` | Variants: default, success, warning, danger, info, secondary; optional dot indicator |
| `Card` | `components/ui/card.tsx` | Hover shadow transition |
| `EmptyState` | `components/ui/empty-state.tsx` | Icon, title, description, action |
| `Button` | `components/ui/button.tsx` | Variants: primary, secondary, danger, ghost, outline |
| `Select` / `Input` / `Textarea` | `components/ui/` | Standard form controls |
| `Modal` | `components/ui/modal.tsx` | Dialog overlay |
| `DataTable` | `components/ui/data-table.tsx` | Tabular data display |
| `PageHeader` | `components/layout/page-header.tsx` | Title, description, optional actions slot |
| `Sidebar` | `components/layout/sidebar.tsx` | Role-based nav with all feature links |
| `PortalSwitcher` | `components/layout/portal-switcher.tsx` | Cross-portal navigation for users with grants |

### Session Recordings Manager
- **Shared component:** `components/session-recordings/session-recordings-manager.tsx`
- Used by both teacher and principal pages
- Program selector, upload form, paginated list, delete

### Certificate Templates Client
- **Shared component:** `components/certificates/certificate-templates-client.tsx`
- Used by both teacher and principal certificate template pages
- Full CRUD, background upload, field editor, preview, send, Canva design studio integration

### Award Certificates Client
- **Shared component:** `components/program-content/award-certificates-client.tsx`
- Used by both teacher and principal award certificate pages
- Eligible student list, per-student preview, bulk/selective send with PDF email attachment

### Program Content Admin Client
- **Shared component:** `components/program-content/program-content-admin-client.tsx`
- Used by both teacher and principal program content pages
- Three-step flow: programs list → program detail (subjects + syllabus) → curriculum (chapters + lessons)
- Lesson editor modal with type picker (9 types) and specialized editors

### Program Calendar
- **Components:** `components/calendar/full-program-calendar-client.tsx`, `program-calendar-grid.tsx`, `full-calendar-client-wrapper.tsx`
- Shared across all three portals (principal full CRUD, teacher view + notify, student view-only)

### Email
- **Utility:** `lib/email.ts` (Resend integration)
- **Signature:** `lib/email-signature.ts` (institution-branded HTML signature)
- Password reset, onboarding notifications, recording deletion alerts, certificate sends, payment confirmations, feedback replies, status change notifications

### Database
- **ORM:** Prisma 7 with PostgreSQL
- **Schema:** `prisma/schema.prisma`
- Key models: User, StudentProfile, TeacherProfile, ProgramEnrollment, SessionRecording, Assessment, Attempt, AttendanceRecord, StudentOnboarding, Feedback, CertificateTemplate, CertificateIssued, CertificateCounter, ProgramSyllabus, ProgramChapter, ProgramLesson, ProgramLessonCompletion, ProgramCertificateSend, ProgramCalendarSlot, ProgramDomain, ProgramCategory, ProgramType, InstitutionProfile, CanvaAccount, DocFolder, DocFile, InspectionNote, StudentSubmissionLog, etc.

### File Storage
- **Utility:** `lib/file-upload.ts` (Vercel Blob)
- **Wrappers:** `lib/vercel-blob.ts` (`blobPut`/`blobDel`), `lib/blob-url.ts` (client-safe URL), `lib/blob-fetch.ts` (server-side fetch)
- Video uploads up to 200 MB, documents up to 12 MB

### Public APIs
| API | Purpose |
|---|---|
| `app/api/public/branding/route.ts` | Institution branding (logo, name, color) without auth |
| `app/api/public/programs/route.ts` | Public program listing for applications |

### Branding Hook
- **Hook:** `hooks/use-branding.ts`
- Client-side fetch and cache of institution branding data (logo, name, color, display mode)

### Navigation
- **Sidebar:** `components/layout/sidebar.tsx`
- Student: ~15 nav items (includes Program Content, Pending Actions)
- Teacher: ~18 nav items (includes Session Recordings, Certificate Templates, Award Certificates, Program Content, Full Calendar)
- Principal: ~25 nav items (includes all teacher items plus Inspection Binder, Student Fees, Program Taxonomy, Institution Profile, User Management)
