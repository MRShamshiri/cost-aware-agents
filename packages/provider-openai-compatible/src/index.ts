import type { AgentProvider, ProviderRequest } from "@mrshamshiri/agent-core";

export interface OpenAICompatibleProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions): AgentProvider {
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  return {
    name: "openai-compatible",
    async generate(request: ProviderRequest) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          messages: request.messages,
        }),
      });

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      if (!response.ok) {
        throw new Error(`Provider request failed: ${response.status}`);
      }

      return {
        output: body.choices?.[0]?.message?.content ?? "",
        usage: {
          provider: "openai-compatible",
          model: options.model,
          inputTokens: body.usage?.prompt_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
        metadata: { baseUrl },
      };
    },
  };
}

export function createMockProvider(model = "mock-fast"): AgentProvider {
  return {
    name: "mock-openai-compatible",
    async generate(request) {
      const inputTokens = Math.max(1, Math.ceil(request.input.length / 4));
      return {
        output: `Mock response for: ${request.input}`,
        usage: {
          provider: "mock",
          model,
          inputTokens,
          outputTokens: 32,
        },
      };
    },
  };
}

