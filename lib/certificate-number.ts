import { db } from "@/lib/db";

/**
 * Generates the next certificate number in the format INT001, INT002, etc.
 * Uses an atomic database counter to ensure uniqueness.
 */
export async function getNextCertificateNumber(prefix = "INT"): Promise<string> {
  const counter = await db.certificateCounter.upsert({
    where: { id: 1 },
    create: { id: 1, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  const num = counter.lastValue.toString().padStart(3, "0");
  return `${prefix}${num}`;
}
