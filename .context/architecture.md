# Codebase architecture & setup

Concise reference for **quiz-app**: an institution-facing LMS-style web app (programs, batches, content, assessments, attendance, fees, admissions, certificates, communications, and Canva design integration).

## Stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS 4** |
| Data | **PostgreSQL** via **Prisma 7** (`@prisma/adapter-pg`) |
| Auth | **NextAuth v5** (JWT sessions, Credentials provider) |
| Validation | **Zod** (env schema + API boundaries) |
| Email | **Resend** via `lib/email.ts` (`sendEmail` helper) + `lib/email-signature.ts` (institution-branded signatures) |
| File Storage | **Vercel Blob** (`@vercel/blob`) — all uploads via `lib/file-upload.ts`, `lib/vercel-blob.ts` (`blobPut`/`blobDel`), private blob proxy at `/api/blob-download` |
| PDF | `@react-pdf/renderer` + `pdf-lib` (server-side certificate generation via `lib/certificate-generator.tsx`) |
| Charts | **Recharts** (lazy-loaded via `next/dynamic`) |
| Rich Text | **Tiptap** (program content lesson editor) |
| Design | **Canva** (optional OAuth2+PKCE integration for design creation/export) |
| Other | bcrypt (passwords), OpenAI (optional AI question generation) |

## Repository layout

```
quiz-app/
├── app/
│   ├── (auth)/              # login, register, forgot-password, …
│   │   └── loading.tsx      # auth loading skeleton
│   ├── (student)/student/   # student dashboards & flows
│   │   └── loading.tsx      # student portal loading skeleton
│   ├── (teacher)/teacher/   # teacher tools
│   │   └── loading.tsx      # teacher portal loading skeleton
│   ├── (principal)/principal/
│   │   └── loading.tsx      # principal portal loading skeleton
│   ├── api/                 # Route Handlers (REST-ish by role: principal/*, teacher/*, student/*, public/*, canva/*, cron/*)
│   ├── generated/prisma/    # Prisma client output (do not hand-edit)
│   ├── error.tsx            # App-level error boundary
│   ├── global-error.tsx     # Root layout error boundary
│   ├── not-found.tsx        # Custom 404 page
│   ├── layout.tsx, page.tsx, globals.css
│   └── assess/              # public assessment-taking routes
│       └── loading.tsx      # assessment loading skeleton
├── components/
│   ├── layout/              # sidebar, page-header, portal-switcher
│   ├── ui/                  # badge, button, card, data-table, empty-state, input, modal, pagination, select, stat-card, textarea
│   ├── certificates/        # certificate-templates-client
│   ├── canva/               # canva-design-studio
│   ├── program-content/     # admin-client, lesson-editor-modal, lesson-editor/* (rich text, quiz, survey, file upload)
│   ├── calendar/            # full-calendar-client-wrapper, full-program-calendar-client, program-calendar-grid
│   ├── attendance/          # principal-attendance-dashboard, attendance-program-grid-client
│   ├── document-vault/      # file-viewer
│   ├── session-recordings/  # session-recordings-manager
│   ├── settings/            # portal-access-settings
│   ├── profile/             # my-profile-client
│   ├── pdf/                 # assessment-results-pdf
│   ├── student/             # student-journey-progress
│   └── teacher/             # teacher-dashboard-alerts
├── hooks/                   # use-branding (institution branding hook)
├── lib/                     # db, auth, env, email, domain helpers, server actions
│   ├── file-upload.ts       # uploadToBlob / uploadProfilePictureToBlob (Vercel Blob)
│   ├── vercel-blob.ts       # blobPut / blobDel wrappers with token passthrough
│   ├── blob-url.ts          # Client-safe blob URL helper (private store proxy)
│   ├── blob-fetch.ts        # Server-side blob content fetcher
│   ├── canva.ts             # Canva OAuth helpers (PKCE, token exchange, refresh)
│   ├── certificate-generator.tsx  # PDF certificate generation (pdf-lib + react-pdf)
│   ├── certificate-number.ts      # Atomic auto-incrementing certificate numbers
│   ├── institution-profile.ts     # getOrCreateInstitutionProfile singleton
│   ├── document-vault.ts          # Document vault folder management & seeding
│   ├── program-content.ts         # Syllabus CRUD, completion, access control
│   ├── program-calendar-*.ts      # Calendar grid/hours/slot helpers
│   ├── email-signature.ts         # Institution-branded HTML email signature
│   ├── student-status.ts          # Student status lifecycle & transitions
│   ├── portal-access.ts           # Portal access checking
│   └── env.ts               # Zod env validation (imported via instrumentation.ts)
├── prisma/
│   ├── schema.prisma        # single source of truth for data model
│   ├── migrations/
│   └── seed.ts
├── instrumentation.ts       # Fail-fast env validation on server startup
├── proxy.ts                 # NextAuth + role-based path guards (was "middleware.ts" in older Next.js)
├── next.config.*, tsconfig.json, eslint.config.mjs, postcss
└── package.json             # build runs prisma generate + migrate deploy + next build
```

## Request flow

1. **Proxy** (`proxy.ts`) applies NextAuth and enforces: public routes (`/`, `/login`, `/register`, `/assess/...`), mandatory password change, and **role ↔ path** alignment (`/student` → STUDENT; `/teacher` → TEACHER or PRINCIPAL; `/principal` → PRINCIPAL).
2. **Pages** live under route groups; shared chrome uses `components/layout/*`.
3. **Mutations / reads** use **Route Handlers** under `app/api/**/route.ts`.
4. **Database** access is centralized in `lib/db.ts` (singleton `PrismaClient` in dev to survive HMR).
5. **File uploads** all go through `lib/file-upload.ts` / `lib/vercel-blob.ts` → Vercel Blob Storage. Private blobs proxied through `/api/blob-download`. Blob URLs are stored in the database.

## Blob storage architecture

Three-layer architecture for Vercel Blob:
- **`lib/vercel-blob.ts`** — Server-only `blobPut`/`blobDel` with `BLOB_READ_WRITE_TOKEN` passthrough
- **`lib/blob-fetch.ts`** — Server-side blob content fetcher (for PDF generation, email attachments)
- **`lib/blob-url.ts`** — Client-safe helper; routes private blob URLs through `/api/blob-download` proxy
- **`/api/blob-download`** — Authenticated proxy for private Vercel Blob files

## Error & loading strategy

- **`loading.tsx`** files exist for every route group (`(student)`, `(teacher)`, `(principal)`, `(auth)`) and for `/assess/[token]` — shows skeleton UIs during server component data fetching.
- **`error.tsx`** exists at app root and per role group — client-side error boundaries with retry button.
- **`global-error.tsx`** catches root layout errors.
- **`not-found.tsx`** provides a custom 404 page.
- Heavy client components (Recharts charts, calendar grid) are wrapped in **`<Suspense>`** and loaded with **`next/dynamic`** (`ssr: false`) to reduce initial bundle size.

## Architectural strengths (as implemented)

- **Clear role boundaries** in URLs and APIs (`principal/`, `teacher/`, `student/`), reducing accidental cross-role access.
- **Portal grants** system: `PortalAccess` model enables cross-role access (e.g., ADMIN can access student/teacher/principal portals). Managed via `components/settings/portal-access-settings.tsx`.
- **Schema-first domain**: Prisma models cover academics, assessments, attendance, fees, applications, onboarding, notifications, certificates, program content, calendars, document vault, audit.
- **Typed env** (`lib/env.ts` + Zod) fails fast on misconfiguration — validated at startup via `instrumentation.ts`.
- **Auth config split** (`auth-config.ts` vs `auth.ts`) keeps proxy edge-safe (no Prisma in proxy callbacks that must run on Edge).
- **Custom Prisma output** to `app/generated/prisma` keeps generated code colocated with the app.
- **Vercel Blob** for all file storage — three-layer architecture with private blob proxy, production-ready for serverless.
- **Institution branding** — `hooks/use-branding.ts` + `/api/public/branding` provides client-side branding (logo, name, color) without auth.

## Scalability & maintainability practices

| Practice | In this repo |
|----------|----------------|
| Single DB client instance | `lib/db.ts` global in non-prod |
| Migrations as truth | `prisma migrate` in build pipeline |
| API surface by domain | Split handlers by principal/teacher/student reduces merge conflicts and clarifies ownership |
| Validation at boundaries | Zod in env; API routes guard with `auth()` + role checks |
| Indexes & relations | Defined in `schema.prisma`; extend as query patterns grow |
| Background / scheduled work | `app/api/cron/send-emails` — secured with `CRON_SECRET` bearer token |
| Code splitting | `next/dynamic` for Recharts and calendar; `<Suspense>` boundaries on client-component pages |
| Shared components | Certificate templates, session recordings, program content, attendance grid — reused across principal and teacher portals |

**Suggested directions as load grows:** add rate limiting on public and auth endpoints, consider a job queue for email instead of synchronous sends, read replicas or caching for heavy analytics (`principal/analytics`, reports), and feature flags for risky paths.

## Local development

- Requires `DATABASE_URL`, `AUTH_SECRET`; optional `RESEND_FROM_EMAIL`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`.
- Production requires `BLOB_READ_WRITE_TOKEN` (Vercel Blob), `CRON_SECRET` (cron endpoint security).
- Optional: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI` (Canva design integration).
- Scripts: `npm run dev`, `db:migrate`, `db:seed`, `db:studio`.
- See `.env.example` for all variables.

## Next.js note

This project uses **Next.js 16** App Router. Key difference from older versions: `middleware.ts` is now `proxy.ts`. Error boundaries use `unstable_retry` (not `reset`). Consult `node_modules/next/dist/docs/` when unsure about APIs (see `AGENTS.md`).
