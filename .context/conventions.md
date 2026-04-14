# Coding conventions

This file documents the established patterns for this codebase. Follow them when adding new code.

---

## API route patterns

### Auth gating

All protected API routes start with an auth check:

```typescript
const session = await auth();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Role-based checks use helpers from `lib/api-auth.ts`:

```typescript
const gate = await requirePrincipalPortal();
if (!gate.ok) return gate.response;
const session = gate.session;
```

For GET routes that use `auth()` directly, always add the portal access check as defense-in-depth:

```typescript
const session = await auth();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### Error handling

- Always wrap DB calls in try/catch for mutations (POST/PUT/DELETE).
- Never use empty `catch {}` blocks — always log with `console.error`.
- Catch block pattern: `catch (err: unknown) { console.error("[route] context:", err); return NextResponse.json({ error: "Internal error" }, { status: 500 }); }`
- For read-only GET routes, top-level try/catch is optional but preferred for production safety.

### Response shape

Consistent JSON response shapes:
- Success: `{ data: ..., ok: true }` or domain-specific `{ users: [...] }`
- Error: `{ error: "Human-readable message" }` with appropriate HTTP status

---

## File uploads

All file uploads go through `lib/file-upload.ts` → **Vercel Blob Storage**. Never write files to the local filesystem.

```typescript
import { uploadToBlob, TEMPLATE_ALLOWED_EXT, TEMPLATE_MAX_BYTES } from "@/lib/file-upload";

const result = await uploadToBlob({
  buffer: Buffer.from(await file.arrayBuffer()),
  originalName: file.name,
  allowedExt: TEMPLATE_ALLOWED_EXT,
  maxBytes: TEMPLATE_MAX_BYTES,
  folder: "templates",
});

if ("error" in result) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
// result.url is the public Vercel Blob URL — store this in the database
```

For profile pictures, use `uploadProfilePictureToBlob`:

```typescript
import { uploadProfilePictureToBlob } from "@/lib/file-upload";

const result = await uploadProfilePictureToBlob({ buffer, mimeType: file.type, userId });
if ("error" in result) { ... }
await db.user.update({ where: { id: userId }, data: { profilePicture: result.url } });
```

**Environment:** `BLOB_READ_WRITE_TOKEN` is required in production.

---

## Server components vs Client components

### Decision tree

Use a **Server Component** (no `"use client"`) when:
- Page only reads data and renders HTML
- No user interaction, event handlers, or client-side state
- Direct database access via Prisma is acceptable

Use a **Client Component** (`"use client"`) when:
- Needs `useState`, `useEffect`, `useCallback`, or other React hooks
- Needs browser APIs (localStorage, sessionStorage, events)
- Has interactive controls (modals, filters, forms that update locally)

### Preferred pattern for interactive pages

```
page.tsx (Server Component)
├── Fetch data directly from Prisma
├── Pass data as props to:
└── page-client.tsx (Client Component)
    └── Handles interactivity
```

Wrap client components in `<Suspense>` with skeleton fallbacks:

```tsx
<Suspense fallback={<SkeletonComponent />}>
  <HeavyClientComponent data={data} />
</Suspense>
```

---

## Data fetching in Client components

When client-side fetching is necessary (e.g. pagination, filters), use `useCallback`:

```tsx
const load = useCallback(async () => {
  const res = await fetch("/api/...");
  const data = await res.json();
  setData(data.items || []);
}, [dependency1, dependency2]);

useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void load();
}, [load]);
```

For effects with **multiple** `setState` calls in the body (where `eslint-disable-next-line` only covers one line), use block-level suppression:

```tsx
/* eslint-disable react-hooks/set-state-in-effect -- one-time sync from URL param */
useEffect(() => {
  setFoo("value");
  setBar("value");
}, [dep]);
/* eslint-enable react-hooks/set-state-in-effect */
```

**Never** define `async function load()` after the `useEffect` that calls it — this causes "cannot access variable before it is declared" hoisting errors.

---

## Loading & error boundaries

### Loading states

Each route group has a `loading.tsx` that renders a skeleton UI matching the page structure. This is automatically shown by Next.js during server component data fetching.

### Error boundaries

- `app/error.tsx` — app-level fallback with retry button
- `app/global-error.tsx` — catches root layout errors (includes `<html>` and `<body>`)
- Per-role `error.tsx` under `app/(student)/`, `app/(teacher)/`, `app/(principal)/`

In Next.js 16, the retry callback prop is `unstable_retry` (not `reset`):

```tsx
export default function ErrorPage({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <button onClick={unstable_retry}>Try again</button>;
}
```

---

## Images

Use `<Image>` from `next/image` instead of `<img>` everywhere.

For profile pictures that may be legacy base64 data URLs (existing DB data during migration), use `unoptimized`:

```tsx
<Image
  src={profilePicture}
  alt=""
  width={40}
  height={40}
  unoptimized={profilePicture.startsWith("data:")}
  className="h-10 w-10 rounded-full object-cover"
/>
```

For user-generated media URLs where the domain is not known (e.g. assessment question images), use `eslint-disable-next-line @next/next/no-img-element`.

Vercel Blob URLs are configured in `next.config.ts`:

```typescript
images: {
  remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
}
```

---

## Heavy component lazy loading

Use `next/dynamic` with `ssr: false` for chart and calendar components:

```typescript
const PrincipalCharts = dynamic(
  () => import("./principal-charts").then((m) => ({ default: m.PrincipalCharts })),
  { loading: () => <ChartSkeleton />, ssr: false }
);
```

---

## Email sending

All email goes through `lib/email.ts`'s `sendEmail` helper. Never instantiate `Resend` directly in route handlers:

```typescript
import { sendEmail } from "@/lib/email";

const result = await sendEmail({ to, subject, html, text });
if (!result.ok) { console.error("[context] Email failed:", result.error); }
```

---

## Cron endpoint security

The `/api/cron/send-emails` endpoint requires a `CRON_SECRET` env variable. Pass it as `Authorization: Bearer <secret>` when triggering from Vercel cron or external schedulers.

---

## Navigation (no sessionStorage)

Pass data between pages using URL search params, not `sessionStorage`:

```typescript
// Sender page
const params = new URLSearchParams({ subject: t.subject, body: t.body });
router.push(`/principal/announcements?${params.toString()}`);

// Receiver page — read from searchParams (useState initializer)
const subjectParam = searchParams.get("subject");
const [form, setForm] = useState(() => ({
  title: subjectParam?.slice(0, 200) ?? "",
  ...
}));
```

---

## Toast notifications (no browser alerts)

Never use `window.alert()`, `window.confirm()`, or `window.prompt()`. Use the toast system instead:

```tsx
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast-container";

function MyComponent() {
  const { toasts, toast, dismiss } = useToast();

  function handleAction() {
    try {
      // ... action ...
      toast("Saved successfully!", "success");
    } catch {
      toast("Something went wrong", "error");
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      {/* ... rest of component ... */}
    </>
  );
}
```

Tones: `"success"`, `"error"`, `"warning"`, `"info"` (default). Toasts auto-dismiss after 5 seconds.

---

## Embeddable component pattern

When a feature needs to appear both as a standalone page and as a tab within another page, extract the content into a named export with an `embedded` prop:

```tsx
// page.tsx
export function FeatureManager({ embedded = false }: { embedded?: boolean }) {
  return (
    <>
      {!embedded && <PageHeader title="Feature" />}
      {/* ... component content ... */}
    </>
  );
}

export default function FeaturePage() {
  return <FeatureManager />;
}
```

The standalone page calls `<FeatureManager />` (header shown). Tabbed pages call `<FeatureManager embedded />` (header hidden, parent provides framing). Used by: `SubjectsManager`, `HolidaysManager`, `RetakeRequestsClient`, `AttendanceExcusesClient`.

---

## Shared components across portals

When a feature exists in both principal and teacher portals (e.g., certificate templates, program content, award certificates, session recordings), extract a shared client component under `components/`:

```
components/certificates/certificate-templates-client.tsx   → used by principal & teacher
components/program-content/program-content-admin-client.tsx → used by principal & teacher
components/program-content/award-certificates-client.tsx    → used by principal & teacher
components/session-recordings/session-recordings-manager.tsx → used by principal & teacher
```

The page files pass role-specific API prefixes (e.g., `/api/principal/...` vs `/api/teacher/...`) to the shared component.

---

## Vercel Blob private access

For private Vercel Blob files, use the three-layer architecture:

- **Server-side reads:** Use `lib/blob-fetch.ts` (`fetchBlobAsBuffer`) for PDF generation, email attachments, etc.
- **Server-side writes:** Use `lib/vercel-blob.ts` (`blobPut`/`blobDel`) which passes `BLOB_READ_WRITE_TOKEN`.
- **Client-side display:** Use `lib/blob-url.ts` (`blobFileUrl`) which routes private URLs through `/api/blob-download`.

```typescript
// Client: display a private blob file
import { blobFileUrl } from "@/lib/blob-url";
<a href={blobFileUrl(file.fileUrl)}>Download</a>

// Server: fetch blob content for PDF/email
import { fetchBlobAsBuffer } from "@/lib/blob-fetch";
const buffer = await fetchBlobAsBuffer(url);
```

---

## Certificate PDF generation

Two code paths depending on template background type:

```typescript
import { isPdfUrl } from "@/lib/certificate-generator";

if (isPdfUrl(template.backgroundUrl, template.backgroundFileName)) {
  // PDF template → pdf-lib overlay
  buffer = await generateCertificateFromPdfTemplate({ pdfUrl, orientation, pageSize, fields, data });
} else {
  // Image template → @react-pdf/renderer
  /* eslint-disable react-hooks/error-boundaries -- server-side PDF generation */
  buffer = await renderToBuffer(<CertificatePdf ... />);
  /* eslint-enable react-hooks/error-boundaries */
}
```

The `react-hooks/error-boundaries` rule fires on JSX inside try/catch in route handlers; suppress with block-level disable since these are server-side, not React components.

---

## TeacherProgram queries

`TeacherProgram` uses `teacherProfileId`, not `userId`. To query by the current user:

```typescript
const teacherPrograms = await db.teacherProgram.findMany({
  where: { teacherProfile: { userId: session.user.id } },
  select: { programId: true, program: { select: { id: true, name: true } } },
});
```
