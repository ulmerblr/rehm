import Anthropic from "@anthropic-ai/sdk";

/** Joins the text blocks of a message, ignoring thinking blocks. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Token usage for cost tracking. */
export function usageOf(message: Anthropic.Message): { input: number; output: number } {
  return {
    input: message.usage?.input_tokens ?? 0,
    output: message.usage?.output_tokens ?? 0,
  };
}
