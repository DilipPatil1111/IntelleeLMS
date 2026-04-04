import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ProfilePictureUpload } from "./profile-picture-upload";

export default async function StudentProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      studentProfile: {
        include: {
          program: true,
          batch: { include: { academicYear: true } },
        },
      },
    },
  });

  if (!user) redirect("/login");

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;

  const fields = [
    { label: "First Name", value: user.firstName },
    { label: "Middle Name", value: user.middleName || "—" },
    { label: "Last Name", value: user.lastName },
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone || "—" },
    { label: "Address", value: user.address || "—" },
    { label: "City", value: user.city || "—" },
    { label: "State", value: user.state || "—" },
    { label: "Country", value: user.country || "—" },
    { label: "Postal Code", value: user.postalCode || "—" },
    { label: "Visa Status", value: user.visaStatus || "—" },
    {
      label: "Enrollment No.",
      value: user.studentProfile?.enrollmentNo || "—",
    },
    {
      label: "Program",
      value: user.studentProfile?.program?.name || "Not assigned",
    },
    {
      label: "Batch",
      value: user.studentProfile?.batch?.name || "Not assigned",
    },
    {
      label: "Academic Year",
      value: user.studentProfile?.batch?.academicYear?.name || "—",
    },
  ];

  return (
    <>
      <PageHeader
        title="My Profile"
        description="View your personal and academic information"
      />

      <ProfilePictureUpload
        currentPicture={user.profilePicture}
        initials={initials}
        userName={`${user.firstName} ${user.lastName}`}
      />

      <Card>
        <CardContent>
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
            {user.profilePicture ? (
              <Image
                src={user.profilePicture}
                alt=""
                width={64}
                height={64}
                unoptimized={user.profilePicture.startsWith("data:")}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xl font-bold">
                {initials}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {user.firstName}{" "}
                {user.middleName ? user.middleName + " " : ""}
                {user.lastName}
              </h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {fields.map((field) => (
              <div key={field.label}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {field.label}
                </p>
                <p className="mt-1 text-sm text-gray-900">{field.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
