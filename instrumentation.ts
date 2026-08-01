// Runs once at server startup (Next instrumentation hook). Names every missing
// required env var explicitly in the server logs, so a misconfiguration is
// never just a vague user-facing "not fully configured" message.
//
// Auto-migration is NOT triggered here: instrumentation is bundled for the edge
// runtime too, and pulling in node:fs / node:url would break that build. It is
// triggered from the root layout instead (Node.js runtime only) via
// lib/migrate's ensureMigrated(), which memoizes so it runs once per instance.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // SIGNUP_CODE is a committed constant (lib/config.ts), not an env secret.
  const required = ["DATABASE_URL", "APP_ENCRYPTION_KEY", "SESSION_SECRET"];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.error(
      `[rehm] STARTUP: missing required env var(s): ${missing.join(", ")}. ` +
        "The app will reject actions that need them until they are set."
    );
  } else {
    console.log("[rehm] STARTUP: all required env vars present.");
  }
}
