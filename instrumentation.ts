// Runs once at server startup (Next instrumentation hook). Names every missing
// required env var explicitly in the server logs, so a misconfiguration is
// never just a vague user-facing "not fully configured" message.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const required = [
    "DATABASE_URL",
    "APP_ENCRYPTION_KEY",
    "SESSION_SECRET",
    "SIGNUP_CODE",
  ];
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
