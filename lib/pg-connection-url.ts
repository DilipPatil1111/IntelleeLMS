/**
 * pg v8+ warns when sslmode is require/prefer/verify-ca (treated as verify-full).
 * Set sslmode=verify-full explicitly to match behavior and silence the warning.
 * @see https://github.com/brianc/node-postgres/issues
 */
export function normalizePgConnectionString(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    const mode = u.searchParams.get("sslmode");
    if (mode === "require" || mode === "prefer" || mode === "verify-ca") {
      u.searchParams.set("sslmode", "verify-full");
    }
    return u.toString();
  } catch {
    return connectionString;
  }
}
