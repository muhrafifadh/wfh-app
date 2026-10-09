import type { NextConfig } from "next";

// Validate env vars at build/dev start — fail fast instead of at runtime.
import "./src/lib/env";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // There is no home page: "/" (and every post-sign-in fallback to it) lands on the dashboard.
  redirects: async () => [{ source: "/", destination: "/dashboard", permanent: false }],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
