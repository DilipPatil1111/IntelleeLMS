"use client";

import { AuthHeader } from "@/components/auth/auth-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
      } else {
        setSent(true);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <AuthHeader subtitle="Reset your password" />

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
              <p className="text-sm text-gray-600">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Check your inbox and spam folder.
              </p>
              <p className="text-xs text-gray-400 mt-2">The link expires in 1 hour.</p>
              <Link
                href="/login"
                className="inline-block mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <p className="text-sm text-gray-600 mb-6">
                Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Email Address"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                  Send Reset Link
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-500">
                Remember your password?{" "}
                <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
