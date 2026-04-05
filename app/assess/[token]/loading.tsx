export default function AssessmentLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-2xl animate-pulse space-y-6 px-4 py-8">
        <div className="h-8 w-64 mx-auto rounded-lg bg-gray-200" />
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="h-6 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-5/6 rounded bg-gray-100" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
        <div className="flex justify-between">
          <div className="h-10 w-24 rounded-lg bg-gray-200" />
          <div className="h-10 w-24 rounded-lg bg-indigo-100" />
        </div>
      </div>
    </div>
  );
}
