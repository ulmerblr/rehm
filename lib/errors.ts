import Anthropic from "@anthropic-ai/sdk";

// Map Anthropic failures to plain language in the user's own terms. `detail`
// carries the underlying error text so an unexpected failure is diagnosable
// instead of hiding behind a generic message — it's shown as secondary text,
// never in place of the plain-language message.
export function userFacingAnthropicError(err: unknown): {
  status: number;
  message: string;
  detail: string;
} {
  const detail = err instanceof Error ? err.message : String(err);

  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 401, message: "Your API key isn't working. Check it in Settings.", detail };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      status: 429,
      message: "Anthropic is rate limiting your key. Wait a minute and try again.",
      detail,
    };
  }
  if (err instanceof Anthropic.APIError) {
    const msg = String(err.message || "").toLowerCase();
    if (msg.includes("credit") || msg.includes("billing") || msg.includes("insufficient")) {
      return { status: 402, message: "Your Anthropic account is out of credits.", detail };
    }
  }
  // A timeout here almost always means the serverless function's own time limit,
  // not Anthropic — name it so it isn't mistaken for a key or billing problem.
  if (/timeout|timed out|aborted/i.test(detail)) {
    return {
      status: 504,
      message: "That took too long and was cut off. Try a smaller scope.",
      detail,
    };
  }
  return {
    status: 502,
    message: "Something went wrong generating this. Try again in a moment.",
    detail,
  };
}
