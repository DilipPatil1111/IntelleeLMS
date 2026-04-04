"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PrincipalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[principal error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-4">Could not load this page. Please try again.</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={unstable_retry}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/principal"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
