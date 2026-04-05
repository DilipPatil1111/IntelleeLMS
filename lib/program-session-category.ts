import { ProgramSessionCategory as ProgramSessionCategoryEnum } from "@/app/generated/prisma/enums";
import type { ProgramSessionCategory } from "@/app/generated/prisma/enums";

export const SESSION_CATEGORIES = Object.values(ProgramSessionCategoryEnum) as ProgramSessionCategory[];

export function isProgramSessionCategory(v: string): v is ProgramSessionCategory {
  return (SESSION_CATEGORIES as readonly string[]).includes(v);
}

export function sessionCategoryLabel(c: ProgramSessionCategory | string | null | undefined): string {
  switch (c) {
    case "THEORY":
      return "Theory";
    case "PRACTICAL":
      return "Practical";
    case "SLACK":
      return "Slack";
    case "PROJECT":
      return "Project";
    default:
      return "Session";
  }
}

/** Text color for category label inside a colored cell (high contrast on dark teacher colors). */
export function sessionCategoryTextClass(c: ProgramSessionCategory | string | null | undefined): string {
  switch (c) {
    case "THEORY":
      return "text-amber-200";
    case "PRACTICAL":
      return "text-emerald-200";
    case "SLACK":
      return "text-orange-200";
    case "PROJECT":
      return "text-fuchsia-200";
    default:
      return "text-white/90";
  }
}
