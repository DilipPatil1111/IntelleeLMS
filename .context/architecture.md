# Codebase architecture & setup

Concise reference for **quiz-app**: an institution-facing LMS-style web app (programs, batches, content, assessments, attendance, fees, admissions, communications).

## Stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS 4** |
| Data | **PostgreSQL** via **Prisma 7** (`@prisma/adapter-pg`) |
| Auth | **NextAuth v5** (JWT sessions, Credentials provider) |
| Validation | **Zod** |
| Email | **Resend** (optional keys in env) |
| Other | bcrypt (passwords), Recharts (analytics), `@react-pdf/renderer`, OpenAI (optional AI question generation) |

## Repository layout

```
quiz-app/
├── app/
│   ├── (auth)/              # login, register, forgot-password, …
│   ├── (student)/student/   # student dashboards & flows
│   ├── (teacher)/teacher/   # teacher tools
│   ├── (principal)/principal/
│   ├── api/                 # Route Handlers (REST-ish by role: principal/*, teacher/*, student/*, public/*, cron/*)
│   ├── generated/prisma/    # Prisma client output (do not hand-edit)
│   ├── layout.tsx, page.tsx, globals.css
│   └── assess/              # public assessment-taking routes (if present)
├── components/              # layout shell, sidebar, student widgets, reusable ui/*
├── lib/                     # db, auth, env, email, domain helpers, server actions
├── prisma/
│   ├── schema.prisma        # single source of truth for data model
│   ├── migrations/
│   └── seed.ts
├── middleware.ts            # NextAuth + role-based path guards
├── next.config.*, tsconfig.json, eslint, postcss
└── package.json             # build runs prisma generate + migrate deploy + next build
```

## Request flow

1. **Middleware** applies NextAuth and enforces: public routes (`/`, `/login`, `/register`, `/assess/...`), mandatory password change, and **role ↔ path** alignment (`/student` → STUDENT; `/teacher` → TEACHER or PRINCIPAL; `/principal` → PRINCIPAL).
2. **Pages** live under route groups; shared chrome uses `components/layout/*`.
3. **Mutations / reads** use **Route Handlers** under `app/api/**/route.ts` and **Server Actions** in `lib/actions/*` where appropriate.
4. **Database** access is centralized in `lib/db.ts` (singleton `PrismaClient` in dev to survive HMR).

## Architectural strengths (as implemented)

- **Clear role boundaries** in URLs and APIs (`principal/`, `teacher/`, `student/`), reducing accidental cross-role access.
- **Schema-first domain**: Prisma models cover academics, assessments, attendance, fees, applications, onboarding, notifications, audit.
- **Typed env** (`lib/env.ts` + Zod) fails fast on misconfiguration.
- **Auth config split** (`auth-config.ts` vs `auth.ts`) keeps middleware edge-safe (no Prisma in middleware callbacks that must run on Edge).
- **Custom Prisma output** to `app/generated/prisma` keeps generated code colocated with the app.

## Scalability & maintainability practices

| Practice | In this repo |
|----------|----------------|
| Single DB client instance | `lib/db.ts` global in non-prod |
| Migrations as truth | `prisma migrate` in build pipeline |
| API surface by domain | Split handlers by principal/teacher/student reduces merge conflicts and clarifies ownership |
| Validation at boundaries | Zod in actions and routes where used |
| Indexes & relations | Defined in `schema.prisma` (e.g. feedback, assessments); extend as query patterns grow |
| Background / scheduled work | `app/api/cron/send-emails` pattern (ensure cron auth in production) |

**Suggested directions as load grows:** extract shared API auth helpers (role checks per handler), add rate limiting on public and auth endpoints, consider a job queue for email instead of synchronous sends, read replicas or caching for heavy analytics (`principal/analytics`, reports), and feature flags for risky paths.

## Local development

- Requires `DATABASE_URL`, `AUTH_SECRET`; optional `RESEND_*`, `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL`.
- Scripts: `npm run dev`, `db:migrate`, `db:seed`, `db:studio`.

## Next.js note

This project uses a **current Next.js major** with App Router conventions; consult `node_modules/next/dist/docs/` when unsure about APIs (see `AGENTS.md`).
