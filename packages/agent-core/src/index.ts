import { checkBudget, estimateCost, type Budget, type PricingConfig, type UsageRecord } from "@mrshamshiri/cost-core";

export interface ProviderRequest {
  input: string;
  messages: AgentMessage[];
}

export interface ProviderResponse {
  output: string;
  usage: UsageRecord;
  metadata?: Record<string, unknown>;
}

export interface AgentProvider {
  name: string;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface AgentTool {
  name: string;
  description?: string;
  run(input: string): Promise<string> | string;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface AgentTraceEvent {
  type: "model" | "tool" | "budget";
  at: string;
  name: string;
  input?: string;
  output?: string;
  usage?: UsageRecord;
  metadata?: Record<string, unknown>;
}

export interface AgentTrace {
  id: string;
  startedAt: string;
  finishedAt: string;
  input: string;
  output: string;
  events: AgentTraceEvent[];
  usage: UsageRecord[];
}

export interface AgentConfig {
  provider: AgentProvider;
  budget?: Budget;
  pricing?: PricingConfig;
  tools?: AgentTool[];
  system?: string;
}

export interface AgentRunResult {
  output: string;
  trace: AgentTrace;
  budget?: ReturnType<typeof checkBudget>;
}

export function createAgent(config: AgentConfig) {
  return {
    runAgent: (input: string) => runAgent(input, config),
  };
}

export async function runAgent(input: string, config: AgentConfig): Promise<AgentRunResult> {
  const startedAt = new Date().toISOString();
  const messages: AgentMessage[] = [
    ...(config.system ? [{ role: "system" as const, content: config.system }] : []),
    { role: "user", content: input },
  ];
  const events: AgentTraceEvent[] = [];

  for (const tool of config.tools ?? []) {
    if (input.includes(`tool:${tool.name}`)) {
      const output = await tool.run(input);
      messages.push({ role: "tool", content: output });
      events.push({
        type: "tool",
        at: new Date().toISOString(),
        name: tool.name,
        input,
        output,
      });
    }
  }

  const response = await config.provider.generate({ input, messages });
  events.push({
    type: "model",
    at: new Date().toISOString(),
    name: config.provider.name,
    input,
    output: response.output,
    usage: response.usage,
    metadata: response.metadata,
  });

  const usage = events.flatMap((event) => (event.usage ? [event.usage] : []));
  const trace: AgentTrace = {
    id: `trace_${Date.now().toString(36)}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    input,
    output: response.output,
    events,
    usage,
  };

  const budget =
    config.budget && config.pricing
      ? checkBudget(estimateCost({ currency: config.budget.currency, budget: config.budget, pricing: config.pricing, usage }), config.budget)
      : undefined;

  return { output: response.output, trace, budget };
}

