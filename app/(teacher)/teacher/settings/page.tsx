import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeacherSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account settings"
      />
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Settings and preferences will be available here.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
