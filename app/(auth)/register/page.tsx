"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { registerUser } from "@/lib/actions/auth-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ProgramOpt = {
  id: string;
  name: string;
  code: string;
  batches: { id: string; name: string }[];
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("STUDENT");
  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [programId, setProgramId] = useState("");

  useEffect(() => {
    fetch("/api/public/programs")
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs || []))
      .catch(() => {});
  }, []);

  const batchOptions = useMemo(() => {
    const p = programs.find((x) => x.id === programId);
    return (p?.batches || []).map((b) => ({ value: b.id, label: b.name }));
  }, [programs, programId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await registerUser(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/login?registered=true");
    }
  }

  const programOptions = programs.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">Intellee College</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="firstName" name="firstName" label="First Name" placeholder="John" required />
              <Input id="middleName" name="middleName" label="Middle Name" placeholder="M." />
            </div>
            <Input id="lastName" name="lastName" label="Last Name" placeholder="Doe" required />
            <Input id="email" name="email" type="email" label="Email" placeholder="you@example.com" required />
            <Input id="password" name="password" type="password" label="Password" placeholder="Min 6 characters" required />
            <Input id="phone" name="phone" type="tel" label="Phone Number" placeholder="+1 234 567 890" />
            <Input id="country" name="country" label="Country" placeholder="Canada" />
            <Select
              id="role"
              name="role"
              label="Register As"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={[
                { value: "STUDENT", label: "Student (apply for a program)" },
                { value: "TEACHER", label: "Trainer / Teacher" },
                { value: "PRINCIPAL", label: "Principal / Admin" },
              ]}
              placeholder="Select your role"
              required
            />

            {role === "TEACHER" && (
              <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <p className="text-sm font-medium text-violet-900">Programs you can teach</p>
                <p className="text-xs text-gray-600">
                  Select one or more programs. A principal will assign you to specific subjects and batches after review — you will appear under <strong>Unassigned teachers</strong> until then.
                </p>
                <div className="flex flex-wrap gap-2">
                  {programs.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" name="programIds" value={p.id} />
                      {p.name}
                    </label>
                  ))}
                </div>
                {programs.length === 0 && (
                  <p className="text-xs text-amber-800">No programs are available yet. Contact the college — you can still register and an admin will link programs later.</p>
                )}
              </div>
            )}

            {role === "STUDENT" && (
              <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <p className="text-sm font-medium text-indigo-900">Program application</p>
                <p className="text-xs text-gray-600">
                  Your request will appear under <strong>Applications</strong> for the principal. You can sign in as an applicant until you are enrolled.
                </p>
                <Select
                  id="programId"
                  name="programId"
                  label="Program / course"
                  options={programOptions}
                  placeholder="Select a program"
                  required
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                />
                <Select
                  id="batchId"
                  name="batchId"
                  label="Preferred batch (optional)"
                  options={batchOptions}
                  placeholder={programId ? "Select a batch" : "Select a program first"}
                  disabled={!programId}
                />
                <Textarea
                  id="personalStatement"
                  name="personalStatement"
                  label="Message / statement (optional)"
                  placeholder="Tell us why you want to join this program..."
                  rows={3}
                />
                <Input id="visaStatus" name="visaStatus" label="Visa status (optional)" placeholder="e.g. Study permit" />
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
