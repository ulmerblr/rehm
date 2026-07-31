// Single study subject until native auth + hub SSO land. dreams.user_id (and
// user_id on trend_runs) is the subject id, not a login. See README → Subject
// identity. Recorded dreams and trend runs carry this id.
export const SUBJECT_ID = "fdca5d25-96e9-40e9-b260-0e26bced492c";

// The model behind every generated row. Stored on each row alongside its
// prompt_version so a run is reproducible.
export const MODEL = "claude-opus-5";

// Capture surface for dreams recorded in the app (spoken into rehm).
export const CAPTURE_METHOD = "voice-rehm";
