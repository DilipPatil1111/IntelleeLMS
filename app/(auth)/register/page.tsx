"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { registerUser } from "@/lib/actions/auth-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">Intellee College</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
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
              options={[
                { value: "STUDENT", label: "Student" },
                { value: "TEACHER", label: "Trainer / Teacher" },
                { value: "PRINCIPAL", label: "Principal / Admin" },
              ]}
              placeholder="Select your role"
              required
            />
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
