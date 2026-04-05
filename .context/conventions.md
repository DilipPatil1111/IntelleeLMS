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
const { session, error, status } = await requirePrincipalPortal(req);
if (error) return NextResponse.json({ error }, { status });
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
