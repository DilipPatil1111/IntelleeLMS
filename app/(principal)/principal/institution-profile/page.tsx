"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blobFileUrl } from "@/lib/blob-url";
import { invalidateBrandingCache } from "@/hooks/use-branding";

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
  brandingDisplayMode: string;
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
  brandingDisplayMode: "LOGO_WITH_TEXT",
};

const BRANDING_MODES = [
  { value: "LOGO_ONLY", label: "Logo only", desc: "Display only the uploaded logo image" },
  { value: "TEXT_ONLY", label: "Text only", desc: "Display only the institution name" },
  { value: "LOGO_WITH_TEXT", label: "Logo + Text", desc: "Display the logo alongside the institution name" },
] as const;

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      invalidateBrandingCache();
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

            {/* Branding display mode */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Branding display mode</p>
              <p className="text-xs text-gray-500 mb-3">Choose how your institution branding appears on the login page, sidebar, and emails.</p>
              <div className="grid grid-cols-3 gap-3">
                {BRANDING_MODES.map((mode) => {
                  const selected = profile.brandingDisplayMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, brandingDisplayMode: mode.value }))}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        selected
                          ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className={`block text-sm font-medium ${selected ? "text-indigo-700" : "text-gray-700"}`}>
                        {mode.label}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">{mode.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live preview */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
              <div className="rounded-lg border border-gray-200 bg-gray-900 p-4 flex items-center gap-3">
                {(profile.brandingDisplayMode === "LOGO_ONLY" || profile.brandingDisplayMode === "LOGO_WITH_TEXT") && profile.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={blobFileUrl(profile.logoUrl, "logo", true)} alt="" className="h-8 w-auto object-contain" />
                )}
                {(profile.brandingDisplayMode === "TEXT_ONLY" || profile.brandingDisplayMode === "LOGO_WITH_TEXT") && (
                  <span className="text-lg font-bold text-indigo-400">{profile.legalName || "Institution Name"}</span>
                )}
                {!profile.logoUrl && profile.brandingDisplayMode !== "TEXT_ONLY" && (
                  <span className="text-xs text-gray-500 italic">No logo uploaded — upload one above</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">This is how branding will appear in the sidebar. Login page and emails use a similar layout.</p>
            </div>
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
