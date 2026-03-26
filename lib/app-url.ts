/**
 * Base URL for server-generated links (emails, etc.).
 * On Vercel, set NEXT_PUBLIC_APP_URL to your canonical URL, or rely on VERCEL_URL.
 */
export function getServerAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}
