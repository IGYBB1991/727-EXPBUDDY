import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { anthropicApiKey, claudeModel } from "@/lib/env";

// The only file that talks to Claude. Everything here runs on the server.

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ apiKey: anthropicApiKey() });
  return client;
}

export class ClaudeError extends Error {}

// Sends one request and returns the validated JSON, asking once more if the
// answer doesn't fit the schema (or doesn't pass `check`).
export async function askForJson<S extends z.ZodType>({
  system,
  content,
  schema,
  check,
  maxTokens = 16000,
  effort = "low",
}: {
  system: string;
  content: Anthropic.ContentBlockParam[] | string;
  schema: S;
  check?: (value: z.infer<S>) => string | null;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  let lastProblem = "no answer";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await getClient().messages.parse({
        model: claudeModel(),
        max_tokens: maxTokens,
        output_config: { effort, format: zodOutputFormat(schema) },
        system,
        messages: [{ role: "user", content }],
      });
      if (response.stop_reason === "refusal") {
        lastProblem = "Claude declined the request";
        continue;
      }
      if (response.stop_reason === "max_tokens") {
        lastProblem = "the answer was cut off";
        continue;
      }
      const parsed = schema.safeParse(response.parsed_output);
      if (!parsed.success) {
        lastProblem = "the answer didn't match the expected format";
        continue;
      }
      const problem = check?.(parsed.data) ?? null;
      if (problem) {
        lastProblem = problem;
        continue;
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new ClaudeError("The Claude API key isn't valid. Check ANTHROPIC_API_KEY.");
      }
      if (error instanceof Anthropic.BadRequestError || attempt === 1) {
        throw new ClaudeError(`Claude request failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Rate limits, timeouts and server errors: the SDK has already retried;
      // try once more ourselves.
      lastProblem = error instanceof Error ? error.message : String(error);
    }
  }
  throw new ClaudeError(`Claude couldn't help: ${lastProblem}`);
}
