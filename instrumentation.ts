/**
 * Next.js instrumentation file — runs once on server startup (both Node.js and edge runtimes).
 * Importing env here causes fail-fast validation of required environment variables before the
 * app accepts any requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
  }
}
