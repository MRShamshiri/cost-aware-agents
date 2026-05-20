import type { AgentProvider } from "@mrshamshiri/agent-core";

export interface AnthropicLikeProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function createAnthropicLikeProvider(options: AnthropicLikeProviderOptions): AgentProvider {
  return {
    name: "anthropic-like",
    async generate(request) {
      const response = await fetch(`${options.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": options.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          messages: request.messages.filter((message) => message.role !== "system"),
          system: request.messages.find((message) => message.role === "system")?.content,
        }),
      });
      const body = (await response.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      if (!response.ok) {
        throw new Error(`Provider request failed: ${response.status}`);
      }
      return {
        output: body.content?.map((part) => part.text ?? "").join("") ?? "",
        usage: {
          provider: "anthropic-like",
          model: options.model,
          inputTokens: body.usage?.input_tokens ?? 0,
          outputTokens: body.usage?.output_tokens ?? 0,
        },
        metadata: { baseUrl: options.baseUrl },
      };
    },
  };
}

