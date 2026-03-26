import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Resend reads API key at runtime; keep it externalized from the Turbopack bundle. */
  serverExternalPackages: ["resend"],
};

export default nextConfig;
