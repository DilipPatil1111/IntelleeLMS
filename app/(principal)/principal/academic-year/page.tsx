import { redirect } from "next/navigation";

/** Academic years are managed when creating batches; the standalone tab was removed as redundant. */
export default function AcademicYearRedirectPage() {
  redirect("/principal/batches");
}
