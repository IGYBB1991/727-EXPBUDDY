import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Bank statements can be a few MB; this lets server actions accept them.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
