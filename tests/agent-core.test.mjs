import assert from "node:assert/strict";
import { test } from "node:test";
import { createAgent } from "../packages/agent-core/dist/index.js";
import { createMockProvider } from "../packages/provider-openai-compatible/dist/index.js";

test("runs an agent and records trace usage", async () => {
  const agent = createAgent({
    provider: createMockProvider("mock-fast"),
    pricing: { models: { "mock-fast": { inputPer1M: 0.2, outputPer1M: 0.8 } } },
    budget: { limit: 0.05, currency: "USD" },
    tools: [{ name: "risk", run: () => "risk context" }],
  });

  const result = await agent.runAgent("tool:risk summarize release status");
  assert.match(result.output, /Mock response/);
  assert.equal(result.trace.events.some((event) => event.type === "tool"), true);
  assert.equal(result.trace.usage.length, 1);
  assert.equal(result.budget.ok, true);
});

