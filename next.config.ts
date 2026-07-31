import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The temporary /api/migrate route reads the committed migrations/ files at
  // runtime; include them in that function's bundle.
  outputFileTracingIncludes: {
    "/api/migrate": ["./migrations/**/*"],
  },
};

export default nextConfig;
