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
| Change Password | Handled within user profile pages |
| Role-based Access | `lib/portal-access.ts`, `lib/api-auth.ts` (requireStudentPortal, requireTeacherPortal, requirePrincipalPortal) |
| Portal Grants | `model UserPortalGrant` in `prisma/schema.prisma` — allows cross-portal access |

---

## Student Portal

### Dashboard
- **File:** `app/(student)/student/page.tsx`
- Stat cards (assessments, pending, avg score, attendance) with gradient variants
- Student journey progress indicator
- Onboarding phase banner
- Program content completion alert
- Recent assessments with dot-badge status indicators
- Quick links with gradient card styling

### Apply to Program
- **File:** `app/(student)/student/apply/page.tsx`
- **API:** `app/api/student/apply/route.ts`

### Onboarding
- **Page:** `app/(student)/student/onboarding/page.tsx`
- **API:** `app/api/student/onboarding/route.ts`, `app/api/student/onboarding/upload/route.ts`
- Conditional pre-admission test (vocational programs only via `isVocational` flag)
- Upload Document / Mark Complete / Submit Later buttons
- Context-aware messages: enrolled students see pending steps list instead of "waiting for principal"
- Progress bar with step count adjusted for vocational/non-vocational

### Multi-Program Support
- **Model:** `ProgramEnrollment` junction table (many-to-many User ↔ Program)
- **API:** `app/api/student/programs/route.ts` — lists all enrolled programs
- **Program Content:** `app/(student)/student/program/[programId]/page.tsx`
- **Program Selector:** `app/(student)/student/program/page.tsx` — program picker

### Session Recordings (Student View)
- Displayed above Curriculum in `app/(student)/student/program/[programId]/page.tsx`
- Collapsible timeline with play-on-expand video player
- **API (read-only):** `app/api/student/session-recordings/route.ts`

### Assessments
- **List:** `app/(student)/student/assessments/page.tsx`, `assessments-list-client.tsx`
- **Take:** `app/(student)/student/assessments/[id]/take/page.tsx`
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
- Program attendance grid embed
- Pagination (15 per page)

### Full Calendar
- **Page:** `app/(student)/student/full-calendar/page.tsx`, `full-calendar-multi-program.tsx`
- Multi-program selector
- Uses `FullProgramCalendarClient` with `fixedBatchId`

### Pending Actions
- **Page:** `app/(student)/student/pending-actions/page.tsx`
- **API:** `app/api/student/pending-actions/route.ts`
- High-priority alerts banner with count
- Sections: pending assessments (HIGH), below-passing results (HIGH), attendance alerts (HIGH), pending documents (HIGH), fees
- Contact principal/administrator messages for below-passing marks and low attendance
- Document upload/replace with version history
- Receipt upload with amount

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

---

## Teacher Portal

### Dashboard
- **File:** `app/(teacher)/teacher/page.tsx`
- Stat cards, recent submissions, pass-rate guards

### Assessments
- **CRUD:** `app/api/teacher/assessments/route.ts`, `[id]/route.ts`
- **Copy:** `app/api/teacher/assessments/[id]/copy/route.ts`
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
- Uses shared `ProgramContentAdminClient`

### Reports
- **Page:** `app/(teacher)/teacher/reports/page.tsx`
- Division-by-zero guard on pass threshold

### Other
- Question Bank, Grading, Attendance, Full Calendar, Students, Subjects, Modules, Announcements, Award Certificates, Settings

---

## Principal Portal

### Dashboard
- **File:** `app/(principal)/principal/page.tsx`

### Applications
- **Page:** `app/(principal)/principal/applications/page.tsx`
- **Enrollment API:** `app/api/principal/applications/[id]/route.ts`
- Creates `ProgramEnrollment` record on enrollment via transaction

### Students
- **Page:** `app/(principal)/principal/students/page.tsx`
- Pagination (15 per page)
- **Create/Update APIs** create `ProgramEnrollment` records

### Session Recordings
- **Page:** `app/(principal)/principal/session-recordings/page.tsx`
- **API:** `app/api/principal/session-recordings/route.ts` (GET, POST)
- **Delete API:** `app/api/principal/session-recordings/[id]/route.ts`
- Full upload/delete management

### Other
- Feedback (with pagination), Onboarding Review, All Assessments, Teachers, User Management (paginated), Attendance, Full Calendar, Program Content, Award Certificates, Institution Profile, Academic Years, Batches, Reports, Holidays, Email Templates, Announcements, Policies, Shared Documents, Inspection Binder, Student Fees (paginated), Settings

---

## Shared / Cross-Cutting

### Reusable UI Components
| Component | File | Notes |
|---|---|---|
| `Pagination` | `components/ui/pagination.tsx` | First/prev/next/last, ellipsis, total count |
| `StatCard` | `components/ui/stat-card.tsx` | Variants: default, indigo, emerald, amber, rose |
| `Badge` | `components/ui/badge.tsx` | Variants with optional dot indicator |
| `Card` | `components/ui/card.tsx` | Hover shadow transition |
| `EmptyState` | `components/ui/empty-state.tsx` | Icon, title, description, action |
| `Button` | `components/ui/button.tsx` | Variants: primary, secondary, danger, ghost, outline |
| `Select` / `Input` / `Textarea` | `components/ui/` | Standard form controls |
| `PageHeader` | `components/layout/page-header.tsx` | Title, description, optional actions slot |
| `Sidebar` | `components/layout/sidebar.tsx` | Role-based nav with session recordings links |

### Session Recordings Manager
- **Shared component:** `components/session-recordings/session-recordings-manager.tsx`
- Used by both teacher and principal pages
- Program selector, upload form, paginated list, delete

### Email
- **Utility:** `lib/email.ts` (Resend integration)
- Password reset emails, onboarding notifications, recording deletion alerts

### Database
- **ORM:** Prisma 7 with PostgreSQL
- **Schema:** `prisma/schema.prisma`
- Key models: User, StudentProfile, ProgramEnrollment, SessionRecording, Assessment, Attempt, AttendanceRecord, StudentOnboarding, Feedback, etc.

### File Storage
- **Utility:** `lib/file-upload.ts` (Vercel Blob)
- Video uploads up to 200 MB, documents up to 12 MB

### Navigation
- **Sidebar:** `components/layout/sidebar.tsx`
- Student: 14 nav items
- Teacher: 17 nav items (includes Session Recordings)
- Principal: 22 nav items (includes Session Recordings)
