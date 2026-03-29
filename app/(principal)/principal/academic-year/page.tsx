import { redirect } from "next/navigation";

/** Legacy path: academic years are managed under /principal/academic-years */
export default function AcademicYearRedirectPage() {
  redirect("/principal/academic-years");
}
