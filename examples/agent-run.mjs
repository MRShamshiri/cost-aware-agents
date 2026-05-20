import { createAgent } from "../packages/agent-core/dist/index.js";
import { createMockProvider } from "../packages/provider-openai-compatible/dist/index.js";

const agent = createAgent({
  provider: createMockProvider(),
  pricing: { models: { "mock-fast": { inputPer1M: 0.2, outputPer1M: 0.8 } } },
  budget: { limit: 0.05, currency: "USD" },
});

const result = await agent.runAgent("Summarize why budget-aware agents matter.");
console.log(JSON.stringify(result.trace, null, 2));

