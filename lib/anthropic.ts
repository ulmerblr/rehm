import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client. ANTHROPIC_API_KEY is read from the environment by the SDK
 * and is only ever used server-side (route handlers) — never shipped to the
 * client. Throws if the key is absent so a misconfiguration fails loudly.
 */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic();
}

/** Joins the text blocks of a message, ignoring thinking blocks. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
