import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-black text-indigo-100 mb-2 select-none">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
