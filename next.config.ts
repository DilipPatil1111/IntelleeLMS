import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Resend reads API key at runtime; keep it externalized from the Turbopack bundle. */
  serverExternalPackages: ["resend"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
