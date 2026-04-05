"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProfilePictureUploadProps {
  currentPicture: string | null;
  initials: string;
  userName: string;
}

export function ProfilePictureUpload({ currentPicture, initials, userName }: ProfilePictureUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/student/profile-picture", { method: "POST", body: formData });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardContent>
        <div className="flex items-center gap-6 py-2">
          {currentPicture ? (
            <Image src={currentPicture} alt={userName} width={80} height={80} unoptimized={currentPicture.startsWith("data:")} className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-100" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-2xl font-bold ring-2 ring-indigo-50">
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500 mb-3">JPG, PNG or WebP. Max 5MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              isLoading={uploading}
            >
              Change Photo
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
