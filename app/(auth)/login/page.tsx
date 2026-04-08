"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginUser } from "@/lib/actions/auth-actions";
import { AuthHeader } from "@/components/auth/auth-header";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginBanner() {
  const params = useSearchParams();
  if (params.get("passwordChanged") === "1") {
    return (
      <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
        Your password was updated. Sign in with your new password.
      </div>
    );
  }
  return null;
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await loginUser(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <AuthHeader subtitle="Sign in to your account" />

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <Suspense fallback={null}>
            <LoginBanner />
          </Suspense>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email Address"
              placeholder="you@example.com"
              required
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="Enter your password"
              required
            />
            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              Sign In
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Forgot your password?
            </Link>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
