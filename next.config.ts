import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",

  // Optimize for production
  reactStrictMode: true,

  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
