"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blobFileUrl } from "@/lib/blob-url";

type Profile = {
  institutionNumber: string | null;
  legalName: string | null;
  permanentAddress: string | null;
  mailingAddress: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  socialFacebookUrl: string | null;
  socialLinkedInUrl: string | null;
  socialTwitterUrl: string | null;
  socialInstagramUrl: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

const empty: Profile = {
  institutionNumber: null,
  legalName: null,
  permanentAddress: null,
  mailingAddress: null,
  phone: null,
  email: null,
  website: null,
  socialFacebookUrl: null,
  socialLinkedInUrl: null,
  socialTwitterUrl: null,
  socialInstagramUrl: null,
  logoUrl: null,
  brandColor: null,
};

export default function InstitutionProfilePage() {
  const [profile, setProfile] = useState<Profile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/principal/institution-profile");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.profile) {
      setProfile({ ...empty, ...data.profile });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/principal/institution-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage({ tone: "ok", text: "Institution profile saved." });
      if (data.profile) setProfile({ ...empty, ...data.profile });
    } else {
      setMessage({ tone: "err", text: (data as { error?: string }).error || "Save failed." });
    }
    setSaving(false);
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/principal/institution-profile/logo", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data as { url?: string }).url) {
      setProfile((p) => ({ ...p, logoUrl: (data as { url: string }).url }));
      setMessage({ tone: "ok", text: "Logo uploaded — save the form to persist the URL." });
    } else {
      setMessage({ tone: "err", text: (data as { error?: string }).error || "Upload failed." });
    }
  }

  function field<K extends keyof Profile>(key: K, v: string) {
    setProfile((p) => ({ ...p, [key]: v || null }));
  }

  if (loading) {
    return <p className="p-6 text-gray-500">Loading…</p>;
  }

  return (
    <>
      <PageHeader
        title="Institution profile"
        description="Master details for your institution (branding, contact, addresses). Used for display and integrations; does not replace compliance settings."
        actions={
          <Button onClick={() => void save()} isLoading={saving}>
            Save
          </Button>
        }
      />

      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.tone === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Institution number"
              value={profile.institutionNumber ?? ""}
              onChange={(e) => field("institutionNumber", e.target.value)}
              placeholder="e.g. REG-12345"
            />
            <Input
              label="Legal / display name"
              value={profile.legalName ?? ""}
              onChange={(e) => field("legalName", e.target.value)}
              placeholder="e.g. Intellee College"
            />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Logo</p>
              {profile.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={blobFileUrl(profile.logoUrl, "logo", true)} alt="" className="h-16 w-auto mb-2 rounded border border-gray-200" />
              )}
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
              <Button type="button" variant="outline" size="sm" onClick={() => logoInput.current?.click()}>
                Upload logo
              </Button>
              <Input
                className="mt-2"
                label="Logo URL (or use upload above)"
                value={profile.logoUrl ?? ""}
                onChange={(e) => field("logoUrl", e.target.value)}
              />
            </div>
            <Input
              label="Brand color (hex)"
              value={profile.brandColor ?? ""}
              onChange={(e) => field("brandColor", e.target.value)}
              placeholder="#4f46e5"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Phone"
              value={profile.phone ?? ""}
              onChange={(e) => field("phone", e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={profile.email ?? ""}
              onChange={(e) => field("email", e.target.value)}
            />
            <Input
              label="Website"
              value={profile.website ?? ""}
              onChange={(e) => field("website", e.target.value)}
              placeholder="https://"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Addresses</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Textarea
              label="Permanent address"
              value={profile.permanentAddress ?? ""}
              onChange={(e) => field("permanentAddress", e.target.value)}
              className="min-h-[100px]"
            />
            <Textarea
              label="Mailing address"
              value={profile.mailingAddress ?? ""}
              onChange={(e) => field("mailingAddress", e.target.value)}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Social links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input
              label="Facebook URL"
              value={profile.socialFacebookUrl ?? ""}
              onChange={(e) => field("socialFacebookUrl", e.target.value)}
            />
            <Input
              label="LinkedIn URL"
              value={profile.socialLinkedInUrl ?? ""}
              onChange={(e) => field("socialLinkedInUrl", e.target.value)}
            />
            <Input
              label="X / Twitter URL"
              value={profile.socialTwitterUrl ?? ""}
              onChange={(e) => field("socialTwitterUrl", e.target.value)}
            />
            <Input
              label="Instagram URL"
              value={profile.socialInstagramUrl ?? ""}
              onChange={(e) => field("socialInstagramUrl", e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button onClick={() => void save()} isLoading={saving}>
          Save institution profile
        </Button>
      </div>
    </>
  );
}
