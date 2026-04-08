"use client";

import { useEffect, useState } from "react";

export type BrandingDisplayMode = "LOGO_ONLY" | "TEXT_ONLY" | "LOGO_WITH_TEXT";

export interface Branding {
  logoUrl: string | null;
  legalName: string | null;
  brandColor: string | null;
  brandingDisplayMode: BrandingDisplayMode;
  loaded: boolean;
}

const DEFAULT_BRANDING: Branding = {
  logoUrl: null,
  legalName: null,
  brandColor: null,
  brandingDisplayMode: "LOGO_WITH_TEXT",
  loaded: false,
};

let cachedBranding: Branding | null = null;
let fetchPromise: Promise<void> | null = null;

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(cachedBranding ?? DEFAULT_BRANDING);

  useEffect(() => {
    if (cachedBranding?.loaded) {
      setBranding(cachedBranding);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetch("/api/public/branding")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to fetch branding");
          return r.json();
        })
        .then((data) => {
          cachedBranding = {
            logoUrl: data.logoUrl ?? null,
            legalName: data.legalName ?? null,
            brandColor: data.brandColor ?? null,
            brandingDisplayMode: data.brandingDisplayMode ?? "LOGO_WITH_TEXT",
            loaded: true,
          };
        })
        .catch(() => {
          cachedBranding = { ...DEFAULT_BRANDING, loaded: true };
        })
        .finally(() => {
          fetchPromise = null;
        });
    }

    fetchPromise.then(() => {
      if (cachedBranding) setBranding(cachedBranding);
    });
  }, []);

  return branding;
}

/** Invalidate the client-side branding cache (call after saving Institution Profile). */
export function invalidateBrandingCache() {
  cachedBranding = null;
  fetchPromise = null;
}
