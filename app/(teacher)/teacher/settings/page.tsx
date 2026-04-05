import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeacherSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account settings" />
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">My Profile</p>
              <p className="text-xs text-gray-500 mt-0.5">Update your name, contact details, photo and password.</p>
            </div>
            <Link
              href="/teacher/my-profile"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Go to profile →
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
