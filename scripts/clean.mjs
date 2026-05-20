import { rm } from "node:fs/promises";

const targets = [
  "packages/cost-core/dist",
  "packages/agent-core/dist",
  "packages/provider-openai-compatible/dist",
  "packages/provider-anthropic-like/dist",
  "packages/agent-cli/dist",
];

for (const target of targets) {
  await rm(target, { recursive: true, force: true });
}

console.log("cleaned");

