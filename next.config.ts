import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The seed route reads the committed seed/ files at runtime; include them in
  // that function's bundle so the verbatim transcripts ship to Vercel.
  outputFileTracingIncludes: {
    "/api/seed": ["./seed/**/*"],
  },
};

export default nextConfig;
