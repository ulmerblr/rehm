// The model behind every generated row. Stored on each row alongside its
// prompt_version and token counts so a run is reproducible and costed.
export const MODEL = "claude-opus-5";

// A small, fast, cheap model used only for the throwaway dream-list title. A
// title is disposable metadata, not analysis, so it does not warrant Opus cost.
export const TITLE_MODEL = "claude-haiku-4-5-20251001";

// Translation between two high-resource languages is mechanical work, and it
// runs over every piece of text the app generates. Opus costs five times as
// much per token and is not better at it. The record is never translated —
// only the display copy — so this model choice cannot affect the corpus.
export const TRANSLATION_MODEL = "claude-haiku-4-5-20251001";

// Capture surface for dreams recorded in the app (spoken into rehm).
export const CAPTURE_METHOD = "voice-rehm";

// Invite code for signup. Deliberately a committed, non-secret throwaway word
// (fewer than ten known friends) — not an env secret. Change it here and push
// to rotate. The signup route still compares it constant-time and rate limits
// attempts by IP.
export const SIGNUP_CODE = "eight-horses";
