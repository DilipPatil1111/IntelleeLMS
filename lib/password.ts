import { randomBytes } from "crypto";

/** Cryptographically secure temporary password for new accounts (12 chars). */
export function generateTemporaryPassword(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}
