import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GraduationCap, BookOpen, BarChart3, Calendar, Shield, Sparkles } from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const role = (session.user as unknown as Record<string, unknown>).role as string;
    const paths: Record<string, string> = { STUDENT: "/student", TEACHER: "/teacher", PRINCIPAL: "/principal" };
    redirect(paths[role] || "/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <h1 className="text-xl font-bold text-indigo-600">Intellee College</h1>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Smart Assessment &<br />Learning Platform
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600">
            Create AI-powered quizzes, tests, and assignments. Track attendance, manage grades,
            and deliver results — all from one place.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white hover:bg-indigo-700 transition-colors shadow-md"
            >
              Start Free
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-gray-300 px-8 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Sparkles className="h-8 w-8 text-indigo-600" />,
                title: "AI-Powered Questions",
                desc: "Generate quizzes and tests using AI or import your own question banks.",
              },
              {
                icon: <BookOpen className="h-8 w-8 text-indigo-600" />,
                title: "Multiple Question Types",
                desc: "MCQ, short answer, and paragraph responses with auto and manual grading.",
              },
              {
                icon: <BarChart3 className="h-8 w-8 text-indigo-600" />,
                title: "Rich Analytics",
                desc: "Visual dashboards for pass/fail rates, student progress, and batch performance.",
              },
              {
                icon: <Calendar className="h-8 w-8 text-indigo-600" />,
                title: "Attendance Tracking",
                desc: "Daily attendance with holiday calendar, overrides, and exportable reports.",
              },
              {
                icon: <Shield className="h-8 w-8 text-indigo-600" />,
                title: "Role-Based Access",
                desc: "Separate dashboards for students, trainers, and principal with proper access control.",
              },
              {
                icon: <GraduationCap className="h-8 w-8 text-indigo-600" />,
                title: "Complete LMS",
                desc: "Programs, batches, subjects, fee tracking, PDF transcripts, and email scheduling.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        &copy; {new Date().getFullYear()} Intellee College. All rights reserved.
      </footer>
    </div>
  );
}
