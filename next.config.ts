import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Migrations are read from disk at runtime — by instrumentation.ts at server
  // boot (auto-migrate) and by the /api/migrate fallback. Static tracing can't
  // see those dynamic fs reads, so include the migrations/ files in every
  // server function's bundle.
  outputFileTracingIncludes: {
    "/**": ["./migrations/**/*"],
  },
};

export default nextConfig;
