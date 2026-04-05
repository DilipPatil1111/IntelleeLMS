export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md animate-pulse space-y-4 p-8">
        <div className="h-8 w-32 mx-auto rounded-lg bg-gray-200" />
        <div className="h-12 rounded-lg bg-gray-100" />
        <div className="h-12 rounded-lg bg-gray-100" />
        <div className="h-10 rounded-lg bg-indigo-100" />
      </div>
    </div>
  );
}
