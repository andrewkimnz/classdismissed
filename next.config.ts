import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the zero-config embedded demo database) ships a WASM binary that must
  // be loaded from node_modules, not bundled. It is never loaded in production
  // when DATABASE_URL is set.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: {
    // Photos are downscaled in the browser first, but leave headroom.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Lets you open the dev server from a phone on the same Wi-Fi (npm run dev).
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
