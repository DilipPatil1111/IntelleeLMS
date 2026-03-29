import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Split search into tokens; each token must match at least one of name, email, or enrollment no.
 * So "Abhi P" matches firstName Abhi and lastName P; single-token queries behave as before.
 */
export function principalStudentSearchAndClauses(q: string): Prisma.UserWhereInput[] {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  return tokens.map((token) => ({
    OR: [
      { firstName: { contains: token, mode: "insensitive" } },
      { lastName: { contains: token, mode: "insensitive" } },
      { email: { contains: token, mode: "insensitive" } },
      { studentProfile: { is: { enrollmentNo: { contains: token, mode: "insensitive" } } } },
    ],
  }));
}
