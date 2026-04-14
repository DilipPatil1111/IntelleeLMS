# Product requirements document (PRD)

**Purpose:** Single reference for **product capabilities**, **feature tree**, and **data model** (aligned with `prisma/schema.prisma`). Update this document when shipping or scoping features so agents and humans share one source of truth.

**Product (working name):** Quiz App — institution operations platform combining admissions, academic structure, learning content, assessments, attendance, fees, certificates, communications, and design tools.

---

## 1. Vision & goals

- Give **principals** a single place to configure the institution, manage intake, compliance, certificates, and oversight.
- Let **teachers** deliver content, assessments, attendance, grading, certificates, and feedback within their assignments.
- Let **students** apply, onboard, follow programs, take assessments, track progress, and view notices and certificates.

**Non-goals (unless explicitly added later):** multi-tenant SaaS billing, native mobile apps, real-time video classrooms (unless integrated externally).

---

## 2. Roles & personas

| Role | Primary goals |
|------|----------------|
| **PRINCIPAL** | Institution settings, programs/batches/years, teachers & students, applications, status changes, policies, holidays, announcements, shared documents, reports/analytics, feedback inbox, onboarding review, certificate templates, award certificates, program content, program calendar, inspection binder, institution profile, program taxonomy, student fees |
| **TEACHER** | Subjects/modules/topics/content, assessments (draft → publish), grading, sharing assessments, student roster visibility, attendance sessions, teacher self-attendance, feedback, exports/reports, certificate templates, award certificates, program content, program calendar, holidays |
| **STUDENT** | Apply to program, onboarding steps, program view, topic progress, lesson completion, assessments, attendance view, feedback, notifications, pending actions, fees, profile, program content, program calendar |

---

## 3. Feature tree

```text
Institution & configuration
├── Institution settings (thresholds: attendance, marks, fees; certificate/transcript templates; contract sample; principal signature)
├── Institution profile (legal name, addresses, phone, email, website, social URLs, logo, brand color)
├── Academic year & holidays
├── Programs & batches
├── Program taxonomy (domains, categories, types — configurable lists with optional Customer ID)
├── Subjects → modules → topics → topic content (multi-type: text, video, document, …)
├── Teacher program assignment & teacher–subject–batch assignment
├── Policies & email templates
└── Portal grants (cross-role portal access management)

Program Content (Thinkific-style authoring)
├── Three-step flow: Programs list → Program detail (subjects + syllabus) → Curriculum (chapters + lessons)
├── Lesson types: Text, Video, PDF, Audio, Presentation, Quiz, Download, Survey, Multimedia
├── Chapter settings: mandatory, prerequisite, free preview, enable discussions
├── Draft / Published toggle per lesson
├── Quiz lessons link to existing Assessment system
├── Student view-only consumption with lesson completion tracking
└── Program completion → certificate eligibility → Award Certificates

Certificate Templates & Award Certificates
├── Certificate template CRUD (background image/PDF, configurable field positions, orientation, page size)
├── Canva integration for certificate background design (OAuth2+PKCE)
├── PDF generation (pdf-lib for PDF templates, @react-pdf/renderer for image templates)
├── Auto-incrementing certificate numbers (CertificateCounter)
├── Award Certificates: eligible student list → preview per student → bulk/selective send with PDF email attachment
├── Program completion certificates (ProgramCertificateSend) with deduplication
└── Certificate issuance tracking (CertificateIssued)

Program Calendar
├── Time slot management per program/batch (day + start/end time + session category)
├── Session categories: Theory, Practical, Slack, Project
├── Teacher assignment per slot with color coding
├── Full calendar view for all three portals (principal CRUD, teacher view + notify, student view-only)
└── Model: ProgramCalendarSlot

Admissions & student lifecycle
├── Public program listing / apply (with taxonomy display)
├── Program applications (status workflow)
├── Student profile (enrollment, program/batch, status lifecycle)
├── Status changes (cancelled, suspended, expelled, transferred, graduated, …) with email notifications
├── Student onboarding checklist (contract, IDs, fee proof, principal confirm)
├── Submission history tracking (StudentSubmissionLog per step)
└── Compliance-linked notifications (suspension reasons, etc.)

Assessments & grading
├── Assessment types (quiz, test, assignment, project, homework)
├── Questions (MCQ, short, paragraph), options, media, rubrics
├── Draft / publish / close / graded lifecycle
├── Per-student assignment (optional; else batch-wide)
├── Attempts & answers, auto + manual scoring
├── Assessment sharing between staff
├── Scheduled emails around assessments
├── Import questions (file + AI-assisted generation optional)
├── Detailed results with PDF export
└── Transcript / PDF-related exports

Attendance
├── Attendance sessions (subject + batch + date; holiday override)
├── Per-student records; teacher attendance per session (auto-marks teacher when marking students)
├── Program sheet attendance grid with chapter/session search filter
├── Principal attendance dashboard (consolidated view with total hours/days columns)
├── Student attendance view with multi-program selector and subject filtering
├── Attendance statuses: Present, Absent, Late (counted as Present), Excused (displayed as "P" with violet background)
├── Attendance excuse request flow: student → teacher/principal review → excused/denied/kept-absent
├── Holiday calendar by academic year (embedded in Full Calendar for students)
└── Attendance threshold alerts

Assessment Retake Requests
├── Student initiates retake request from Pending Actions for below-passing results
├── Teacher/principal reviews: approve retake (clears previous attempts), excuse for certificate, or deny
├── Approved retakes: previous attempts deleted, student can retake assessment
├── Email notifications to student and principals on resolution
└── Consolidated in Pending Actions menu for teacher/principal

Fees
├── Fee structures per program
├── Fee payments per student with receipt upload (Vercel Blob)
├── Principal payment confirmation with email notification (receipt attachment)
└── Student pending fees view with receipt history

Communications & engagement
├── In-app notifications (typed, with additions: calendar hours update, low attendance, feedback reply)
├── Announcements (scope by program/batch/year; email optional)
├── Feedback threads (student/teacher → principal reply, categories include student concern)
├── Shared documents (audience by role)
├── Canva design studio for shared document creation
└── Institution-branded email signatures

Inspection Binder (Document Vault)
├── Hierarchical folder structure by year + program + batch (13 default folders)
├── Folder scopes: GENERIC (shared), YEAR_SPECIFIC, BATCH_SPECIFIC
├── Auto-populated folders from student data (signed contracts, photo IDs, receipts, pre-admission tests)
├── Manual file uploads (no type/size restrictions)
├── File viewer (draggable, resizable, maximize/minimize, multi-format: PDF, images, Office docs)
├── Inspection notes per folder
├── Review Complete workflow → consolidated notes → email with attachment
└── Models: DocFolder, DocFile, InspectionNote

Platform & compliance
├── Auth (credentials), password change, optional must-change-password
├── Audit log
├── Cron/scheduled email sending (secured with CRON_SECRET bearer token)
├── Portal grants (PortalAccess model: assign cross-role portal access to any user)
├── File uploads via Vercel Blob Storage (three-layer architecture with private blob proxy)
├── Public branding API + client-side branding hook
├── Toast notification system (replaces all browser-level alerts across all portals)
├── Inline field-level validation and contextual error messaging
├── File upload validation (type whitelist + size limits on all upload routes)
├── Defense-in-depth auth checks on all API routes (role verification even on GET endpoints)
└── Canva OAuth2 integration (optional)
```

---

## 4. Schema model (conceptual)

**Legend:** Arrows are "many" side toward "one" unless noted.

```text
User (Role: STUDENT | TEACHER | PRINCIPAL)
├── Account, Session (NextAuth/OAuth-ready)
├── studentProfile → Program?, Batch?, StudentStatus, FeePayment[]
├── teacherProfile → TeacherProgram[], TeacherSubjectAssignment[]
├── attempts[], answers[], notifications[], auditLogs[]
├── feedback (author / about student or teacher / replies)
├── assessmentAssignments (AssessmentAssignedStudent)
├── topicProgress, attendanceRecords, programEnrollments[]
├── canvaAccount? (OAuth tokens)
├── studentSubmissionLogs[] (document upload history)
└── createdAssessments, announcementsCreated, …

InstitutionSettings (singleton row: defaults & template URLs — stored in Vercel Blob)
InstitutionProfile (singleton row: branding, contact info, logo, brand color)

PortalAccess (grants a user access to an additional portal by role string)

Program
├── Batch[] (per AcademicYear)
├── Subject[] → Module[] → Topic[] → TopicContent[]
├── ProgramSyllabus? (instructions, hours, fees, published toggle)
│   └── Subject → ProgramChapter[] → ProgramLesson[] (9 types)
│       └── ProgramLessonCompletion[] (per student)
├── FeeStructure[], ProgramApplication[], TeacherProgram[], Announcement[]
├── ProgramCalendarSlot[] (time slots with teacher, subject, session category)
├── ProgramDomain?, ProgramCategory?, ProgramType? (taxonomy)
└── ProgramCertificateSend[] (certificate delivery records)

CertificateTemplate
├── Background image/PDF, orientation, page size, field positions (JSON)
├── CertificateIssued[] (per student/program certificate number tracking)
└── CertificateCounter (auto-incrementing certificate numbers, INT001, INT002, ...)

Batch
├── students (StudentProfile), assessments, attendanceSessions, …

Assessment
├── Subject, Batch, creator User; optional Module, Topic (or free-text module/topic labels)
├── Question[] → QuestionOption[], Answer[]
├── Attempt[] (unique per student per assessment)
├── AssessmentShare[], ScheduledEmail[], AssessmentAssignedStudent[]

AttendanceSession → AttendanceRecord[], TeacherAttendance?

ProgramApplication → User (applicant), Program, Batch?

StudentOnboarding → User (one-to-one checklist & uploads)

CanvaAccount → User (one-to-one OAuth tokens for Canva integration)

DocFolder → DocFile[], InspectionNote[], children DocFolder[] (hierarchical)

AssessmentRetakeRequest → User (student), Assessment, resolvedBy User?

AttendanceExcuseRequest → User (student), AttendanceRecord, resolvedBy User?

Other: Holiday, Policy, SharedDocument, EmailTemplate, Announcement + AnnouncementRecipient, SessionRecording
```

**Enums (behavioral):** e.g. `StudentStatus` (APPLIED, ACCEPTED, ENROLLED, COMPLETED, GRADUATED, RETAKE, CANCELLED, SUSPENDED, EXPELLED, TRANSFERRED), `ApplicationStatus` (PENDING, UNDER_REVIEW, ACCEPTED, REJECTED, ENROLLED), `AssessmentStatus`, `AttemptStatus`, `AttendanceStatus` (PRESENT, ABSENT, LATE, EXCUSED), `AttendanceExcuseStatus` (PENDING, EXCUSED, DENIED, KEPT_ABSENT), `NotificationType` (includes CALENDAR_HOURS_UPDATE_REQUEST, LOW_ATTENDANCE_STUDENT, LOW_ATTENDANCE_STAFF, FEEDBACK_REPLY), `FeedbackCategory` (includes STUDENT_CONCERN), `SuspensionReason`, `ProgramCalendarSlotType` (SESSION, LUNCH), `ProgramSessionCategory` (THEORY, PRACTICAL, SLACK, PROJECT), `ProgramLessonKind` (TEXT, VIDEO, PDF, AUDIO, PRESENTATION, QUIZ, DOWNLOAD, SURVEY, MULTIMEDIA), `StudentSubmissionKind` (SIGNED_CONTRACT, GOVERNMENT_ID, ONBOARDING_FEE_PROOF, FEE_RECEIPT), `FolderScope` (GENERIC, YEAR_SPECIFIC, BATCH_SPECIFIC) — see `prisma/schema.prisma` for the authoritative list.

---

## 5. Product capabilities summary

| Area | Capabilities |
|------|----------------|
| **Identity & access** | Email/password login; JWT sessions; role-restricted routes; portal grants (cross-role access via `PortalAccess`); profile fields; optional forced password change; portal switcher UI |
| **Academics** | Programs with compliance thresholds; academic years; batches; subjects/modules/topics; rich topic content; teacher scope by program and batch; program taxonomy (domains, categories, types) |
| **Program Content** | Thinkific-style authoring (subjects → chapters → lessons with 9 content types); draft/publish; lesson completion tracking; program syllabus with metadata; student read-only view |
| **Program Calendar** | Per-program/batch time slots with session categories; teacher assignment; color-coded full calendar view across all portals |
| **Admissions** | Applications with review workflow; taxonomy snapshot; linkage to program and optional batch |
| **Students** | Enrollment numbers; status lifecycle with email notifications; onboarding artifacts; fee payment records with receipts; submission history tracking |
| **Certificates** | Template management with background images/PDFs; Canva design integration; configurable field positions; auto-incrementing numbers; per-student preview and send; program completion certificates |
| **Attendance** | Session-based; student and teacher attendance (auto-marks teacher); program sheet grid with chapter/session search; holidays; consolidated dashboards with total hours/days; threshold alerts; excuse request workflow (student → teacher/principal review) |
| **Fees** | Structures and payments; receipt uploads; principal confirmation with email + attachment |
| **Inspection Binder** | Hierarchical document vault by year/program/batch; auto-populated from student data; inspection notes; Review Complete workflow with consolidated email |
| **Assessments** | Full CRUD lifecycle; scheduling; per-student targeting; grading; sharing; imports and optional AI assist; detailed results with PDF export; retake request workflow (student → teacher/principal review: approve/excuse/deny) |
| **Comms** | Notifications (typed), announcements, feedback with principal reply (student concern category), shared documents, Canva design studio, institution-branded email signatures, toast notifications (inline, auto-dismissing) |
| **Reporting & analytics** | Principal/teacher reporting and analytics endpoints; assessment results PDF export; transcript generation |
| **Audit** | User-attributed audit log entries for accountability |
| **Canva** | Optional OAuth2+PKCE integration for design creation/export; used for certificate backgrounds and shared documents |

---

## 6. How to keep this PRD current

1. **New feature:** Add a bullet under §3 and, if user-visible, a row or note in §5.
2. **Schema change:** Update §4 and ensure `prisma/schema.prisma` matches; migrations are the implementation source of truth for field-level detail.
3. **Deprecations:** Mark features as deprecated in §3/§5 rather than deleting immediately, with a short replacement note.

---

*Last aligned with repository structure and `prisma/schema.prisma`. Updated after full codebase audit (Apr 2026): certificate templates, Canva integration, program content, program calendar, inspection binder, student submission logs, program taxonomy, institution profile, blob storage architecture, public branding, portal switcher, toast notification system, attendance enhancements (auto-teacher marking, excuse requests, program sheet filters), retake request workflow, pending actions consolidation (teacher/principal), sidebar menu consolidation (session recordings into program content tabs, subjects into teacher program content tab, holidays into full calendar tab), principal dashboard redesign (student status breakdowns, financial overview, program-wise pass rates), security hardening (file upload validation, defense-in-depth auth checks).*
