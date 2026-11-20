import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    // Leave room for form encoding around the Inbox's 1 MiB response.
    serverActions: { bodySizeLimit: "2mb" },
  },
};
export default nextConfig;
