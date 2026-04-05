# Product requirements document (PRD)

**Purpose:** Single reference for **product capabilities**, **feature tree**, and **data model** (aligned with `prisma/schema.prisma`). Update this document when shipping or scoping features so agents and humans share one source of truth.

**Product (working name):** Quiz App — institution operations platform combining admissions, academic structure, learning content, assessments, attendance, fees, and communications.

---

## 1. Vision & goals

- Give **principals** a single place to configure the institution, manage intake, compliance, and oversight.
- Let **teachers** deliver content, assessments, attendance, grading, and feedback within their assignments.
- Let **students** apply, onboard, follow programs, take assessments, and view progress and notices.

**Non-goals (unless explicitly added later):** multi-tenant SaaS billing, native mobile apps, real-time video classrooms (unless integrated externally).

---

## 2. Roles & personas

| Role | Primary goals |
|------|----------------|
| **PRINCIPAL** | Institution settings, programs/batches/years, teachers & students, applications, status changes, policies, holidays, announcements, shared documents, reports/analytics, feedback inbox, onboarding review |
| **TEACHER** | Subjects/modules/topics/content, assessments (draft → publish), grading, sharing assessments, student roster visibility, attendance sessions, teacher self-attendance, feedback, exports/reports |
| **STUDENT** | Apply to program, onboarding steps, program view, topic progress, assessments, attendance view, feedback, notifications, profile |

---

## 3. Feature tree

```text
Institution & configuration
├── Institution settings (thresholds: attendance, marks, fees; certificate/transcript templates; contract sample)
├── Academic year & holidays
├── Programs & batches
├── Subjects → modules → topics → topic content (multi-type: text, video, document, …)
├── Teacher program assignment & teacher–subject–batch assignment
└── Policies & email templates

Admissions & student lifecycle
├── Public program listing / apply
├── Program applications (status workflow)
├── Student profile (enrollment, program/batch, status lifecycle)
├── Status changes (cancelled, suspended, expelled, transferred, graduated, …)
├── Student onboarding checklist (contract, IDs, fee proof, principal confirm)
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
└── Transcript / PDF-related exports where implemented

Attendance
├── Attendance sessions (subject + batch + date; holiday override)
├── Per-student records; teacher attendance per session
└── Holiday calendar by academic year

Fees
├── Fee structures per program
└── Fee payments per student

Communications & engagement
├── In-app notifications (typed)
├── Announcements (scope by program/batch/year; email optional)
├── Feedback threads (student/teacher → principal reply); categories include student concern (teacher)
└── Shared documents (audience by role)

Platform & compliance
├── Auth (credentials), password change, optional must-change-password
├── Audit log
├── Cron/scheduled email sending (secured with CRON_SECRET bearer token)
├── Portal grants (PortalAccess model: assign cross-role portal access to any user)
└── File uploads via Vercel Blob Storage (no local disk writes)
```

---

## 4. Schema model (conceptual)

**Legend:** Arrows are “many” side toward “one” unless noted.

```text
User (Role: STUDENT | TEACHER | PRINCIPAL)
├── Account, Session (NextAuth/OAuth-ready)
├── studentProfile → Program?, Batch?, StudentStatus, FeePayment[]
├── teacherProfile → TeacherProgram[], TeacherSubjectAssignment[]
├── attempts[], answers[], notifications[], auditLogs[]
├── feedback (author / about student or teacher / replies)
├── assessmentAssignments (AssessmentAssignedStudent)
├── topicProgress, attendanceRecords, …
└── createdAssessments, announcementsCreated, …

InstitutionSettings (singleton row: defaults & template URLs — stored in Vercel Blob)

PortalAccess (grants a user access to an additional portal by role string)

Program
├── Batch[] (per AcademicYear)
├── Subject[] → Module[] → Topic[] → TopicContent[]
├── FeeStructure[], ProgramApplication[], TeacherProgram[], Announcement[]

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

Other: Holiday, Policy, SharedDocument, EmailTemplate, Announcement + AnnouncementRecipient
```

**Enums (behavioral):** e.g. `StudentStatus`, `ApplicationStatus`, `AssessmentStatus`, `AttemptStatus`, `NotificationType`, `FeedbackCategory`, `SuspensionReason` — see `prisma/schema.prisma` for the authoritative list.

---

## 5. Product capabilities summary

| Area | Capabilities |
|------|----------------|
| **Identity & access** | Email/password login; JWT sessions; role-restricted routes; portal grants (cross-role access via `PortalAccess`); profile fields; optional forced password change |
| **Academics** | Programs with compliance thresholds; academic years; batches; subjects/modules/topics; rich topic content; teacher scope by program and batch |
| **Admissions** | Applications with review workflow; linkage to program and optional batch |
| **Students** | Enrollment numbers; status lifecycle and notes; onboarding artifacts; fee payment records |
| **Assessments** | Full CRUD lifecycle; scheduling; per-student targeting; grading; sharing; imports and optional AI assist |
| **Attendance** | Session-based; student and teacher attendance; holidays |
| **Fees** | Structures and payments (amounts, dates, references) |
| **Comms** | Notifications, announcements, feedback with principal reply, shared documents |
| **Reporting & analytics** | Principal/teacher reporting and analytics endpoints (exact metrics evolve with product) |
| **Audit** | User-attributed audit log entries for accountability |

---

## 6. How to keep this PRD current

1. **New feature:** Add a bullet under §3 and, if user-visible, a row or note in §5.
2. **Schema change:** Update §4 and ensure `prisma/schema.prisma` matches; migrations are the implementation source of truth for field-level detail.
3. **Deprecations:** Mark features as deprecated in §3/§5 rather than deleting immediately, with a short replacement note.

---

*Last aligned with repository structure and `prisma/schema.prisma`. Updated after full codebase audit (Apr 2026): Vercel Blob storage migration, portal grants, ESLint cleanup, loading/error boundaries, cron security.*
