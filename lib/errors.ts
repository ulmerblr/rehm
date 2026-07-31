import Anthropic from "@anthropic-ai/sdk";

// Map Anthropic failures to plain language in the user's own terms. Raw API
// errors are never surfaced.
export function userFacingAnthropicError(err: unknown): { status: number; message: string } {
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 401, message: "Your API key isn't working. Check it in Settings." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      status: 429,
      message: "Anthropic is rate limiting your key. Wait a minute and try again.",
    };
  }
  if (err instanceof Anthropic.APIError) {
    const msg = String(err.message || "").toLowerCase();
    if (msg.includes("credit") || msg.includes("billing") || msg.includes("insufficient")) {
      return { status: 402, message: "Your Anthropic account is out of credits." };
    }
  }
  return {
    status: 502,
    message: "Something went wrong generating this. Try again in a moment.",
  };
}
