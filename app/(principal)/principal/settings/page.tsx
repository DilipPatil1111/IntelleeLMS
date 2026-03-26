import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrincipalSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="System configuration" />
      <Card>
        <CardHeader><CardTitle>System Settings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">System settings and configuration options will be available here.</p>
        </CardContent>
      </Card>
    </>
  );
}
