"use client";

import { useBranding } from "@/hooks/use-branding";

export function AuthHeader({ subtitle }: { subtitle: string }) {
  const { logoUrl, legalName, brandingDisplayMode, loaded } = useBranding();

  const showLogo = logoUrl && (brandingDisplayMode === "LOGO_ONLY" || brandingDisplayMode === "LOGO_WITH_TEXT");
  const showText = legalName && (brandingDisplayMode === "TEXT_ONLY" || brandingDisplayMode === "LOGO_WITH_TEXT");

  return (
    <div className="text-center mb-8">
      {!loaded ? (
        /* Reserve space while loading to prevent layout shift */
        <div className="h-14" />
      ) : (
        <>
          <div className="flex items-center justify-center gap-3">
            {showLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={legalName ?? "Logo"}
                className="h-14 w-auto object-contain"
              />
            )}
            {showText && (
              <h1 className="text-3xl font-bold text-indigo-600">{legalName}</h1>
            )}
          </div>
          {!showLogo && !showText && (
            <h1 className="text-3xl font-bold text-indigo-600">Welcome</h1>
          )}
        </>
      )}
      <p className="text-gray-500 mt-2">{subtitle}</p>
    </div>
  );
}
