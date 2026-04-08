"use client";

import { AuthHeader } from "@/components/auth/auth-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Invalid Reset Link</h2>
        <p className="text-sm text-gray-600">
          This password reset link is invalid or incomplete. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Password Reset Successful</h2>
        <p className="text-sm text-gray-600">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Link
          href="/login?passwordChanged=1"
          className="inline-block mt-4 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-600 mb-6">
        Enter your new password below.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="password"
          name="password"
          type="password"
          label="New Password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          id="confirm"
          name="confirm"
          type="password"
          label="Confirm Password"
          placeholder="Re-enter your new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" size="lg" isLoading={loading}>
          Reset Password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <AuthHeader subtitle="Set a new password" />

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <Suspense fallback={<div className="animate-pulse space-y-4"><div className="h-10 bg-gray-100 rounded" /><div className="h-10 bg-gray-100 rounded" /><div className="h-10 bg-indigo-100 rounded" /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
