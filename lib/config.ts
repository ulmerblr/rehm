// The model behind every generated row. Stored on each row alongside its
// prompt_version and token counts so a run is reproducible and costed.
export const MODEL = "claude-opus-5";

// Capture surface for dreams recorded in the app (spoken into rehm).
export const CAPTURE_METHOD = "voice-rehm";

// Invite code for signup. Deliberately a committed, non-secret throwaway word
// (fewer than ten known friends) — not an env secret. Change it here and push
// to rotate. The signup route still compares it constant-time and rate limits
// attempts by IP.
export const SIGNUP_CODE = "eight-horses";
