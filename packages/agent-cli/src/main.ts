import { readFile } from "node:fs/promises";
import { createAgent } from "@mrshamshiri/agent-core";
import { checkBudget, estimateCost, exportTrace, type ReportInput } from "@mrshamshiri/cost-core";
import { createMockProvider } from "@mrshamshiri/provider-openai-compatible";

export async function main(argv: string[]): Promise<void> {
  if (argv.length === 0 && process.env.INPUT_CONFIG) {
    argv = ["report", process.env.INPUT_CONFIG, "--format", process.env.INPUT_FORMAT ?? "markdown"];
  }

  const command = argv[0] ?? "help";
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "report") {
    const configPath = argv[1];
    if (!configPath) throw new Error("Usage: cost-aware-agent report <config.json> [--format json|markdown]");
    const format = readFlag(argv, "--format") ?? "json";
    if (format !== "json" && format !== "markdown") throw new Error("--format must be json or markdown");
    const input = await readConfig(configPath);
    const output = exportTrace(input, format);
    process.stdout.write(output);
    if (input.budget) {
      const result = checkBudget(estimateCost(input), input.budget);
      if (!result.ok) process.exitCode = 2;
    }
    return;
  }

  if (command === "run") {
    const prompt = argv.slice(1).join(" ") || "Summarize the current deployment risk.";
    const pricing = { models: { "mock-fast": { inputPer1M: 0.2, outputPer1M: 0.8 } } };
    const budget = { limit: 0.05, currency: "USD" };
    const agent = createAgent({
      provider: createMockProvider("mock-fast"),
      pricing,
      budget,
      tools: [
        {
          name: "risk",
          run: () => "Known risks: budget drift, missing tracing, and unreviewed prompts.",
        },
      ],
    });
    const result = await agent.runAgent(prompt);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.budget && !result.budget.ok) process.exitCode = 2;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function readConfig(configPath: string): Promise<ReportInput> {
  return JSON.parse(await readFile(configPath, "utf8")) as ReportInput;
}

function readFlag(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function printHelp(): void {
  process.stdout.write(`cost-aware-agent

Commands:
  report <config.json> [--format json|markdown]
  run [prompt...]
`);
}
