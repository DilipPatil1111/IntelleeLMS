import { redirect } from "next/navigation";

/** Legacy route — program content is now accessible under My Program. */
export default function ProgramContentRedirectPage() {
  redirect("/student/program");
}
