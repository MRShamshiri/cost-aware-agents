# Cost-Aware Agents

Cost-Aware Agents is a TypeScript/npm toolkit for building LLM agents with budget enforcement, usage tracing, provider adapters, and CI-friendly cost reports.

It is built for teams that want agent experiments to stay observable and financially bounded from the first prototype.

## Packages

- `@mrshamshiri/cost-core`: pricing config, cost estimates, budget checks, reports
- `@mrshamshiri/agent-core`: agent runner, steps, tool calls, traces
- `@mrshamshiri/provider-openai-compatible`: OpenAI-compatible chat adapter
- `@mrshamshiri/provider-anthropic-like`: Anthropic-like adapter scaffold
- `@mrshamshiri/agent-cli`: CLI for reports and agent smoke runs

## Quick Start

```bash
npm install
npm test
node packages/agent-cli/dist/cli.js report examples/basic-budget.json --format markdown
```

## Library Example

```ts
import { createAgent } from "@mrshamshiri/agent-core";
import { createMockProvider } from "@mrshamshiri/provider-openai-compatible";

const agent = createAgent({
  provider: createMockProvider(),
  budget: { limit: 0.05, currency: "USD" },
  tools: []
});

const result = await agent.runAgent("Summarize the deployment risk.");
console.log(result.trace);
```

## Maintainer Notes

The public roadmap is intentionally practical: cost reports, eval hooks, tracing, provider adapters, CI integration, and examples that other repositories can actually depend on.

