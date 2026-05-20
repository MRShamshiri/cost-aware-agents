import assert from "node:assert/strict";
import { test } from "node:test";
import { checkBudget, estimateCost, exportTrace } from "../packages/cost-core/dist/index.js";

test("estimates model cost and checks budget", () => {
  const input = {
    currency: "USD",
    pricing: {
      models: {
        "mock-fast": { inputPer1M: 0.2, outputPer1M: 0.8 },
      },
    },
    budget: { limit: 0.01, currency: "USD" },
    usage: [{ provider: "mock", model: "mock-fast", inputTokens: 10000, outputTokens: 1000 }],
  };

  const estimate = estimateCost(input);
  assert.equal(estimate.totalCost, 0.0028);
  assert.equal(checkBudget(estimate, input.budget).ok, true);
  assert.match(exportTrace(input, "markdown"), /Cost Report/);
});

