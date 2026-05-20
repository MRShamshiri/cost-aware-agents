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
  const raw = await readConfigFile(configPath);
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const details = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Invalid JSON in "${configPath}".${details}`);
  }

  return validateReportInput(parsed, configPath);
}

function readFlag(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function printHelp(): void {
  process.stdout.write(`cost-aware-agent

Commands:
  report <config.json> [--format json|markdown]
  run [prompt...]
`);
}

function validateReportInput(value: unknown, configPath: string): ReportInput {
  const root = expectRecord(value, configPath);
  const pricing = expectRecord(root.pricing, `${configPath}.pricing`);
  const pricingModels = expectRecord(pricing.models, `${configPath}.pricing.models`);
  const pricingModelNames = Object.keys(pricingModels);
  const usageValue = root.usage;

  if (pricingModelNames.length === 0) {
    throw new Error(`Invalid config at "${configPath}.pricing.models": expected at least one model pricing entry.`);
  }

  if (!Array.isArray(usageValue) || usageValue.length === 0) {
    throw new Error(`Invalid config at "${configPath}.usage": expected a non-empty array.`);
  }

  const usage = usageValue.map((entry, index) => validateUsageRecord(entry, `${configPath}.usage[${index}]`, pricingModelNames));
  const currency = root.currency === undefined ? undefined : expectString(root.currency, `${configPath}.currency`);
  const budget = root.budget === undefined ? undefined : validateBudget(root.budget, `${configPath}.budget`);
  if (currency && budget && currency !== budget.currency) {
    throw new Error(
      `Invalid config at "${configPath}.budget.currency": expected "${currency}" to match "${configPath}.currency".`,
    );
  }

  const models = Object.fromEntries(
    Object.entries(pricingModels).map(([modelName, modelPricing]) => [modelName, validateModelPricing(modelPricing, `${configPath}.pricing.models.${modelName}`)]),
  );

  return {
    currency,
    budget,
    usage,
    pricing: { models },
  };
}

function validateBudget(value: unknown, path: string): NonNullable<ReportInput["budget"]> {
  const budget = expectRecord(value, path);
  return {
    limit: expectPositiveNumber(budget.limit, `${path}.limit`),
    currency: expectString(budget.currency, `${path}.currency`),
  };
}

function validateUsageRecord(value: unknown, path: string, knownModels: string[]): ReportInput["usage"][number] {
  const usage = expectRecord(value, path);
  const provider = usage.provider === undefined ? undefined : expectString(usage.provider, `${path}.provider`);
  const metadata = usage.metadata === undefined ? undefined : expectRecord(usage.metadata, `${path}.metadata`);
  const model = expectKnownModel(usage.model, `${path}.model`, knownModels);

  return {
    provider,
    metadata,
    model,
    inputTokens: expectNonNegativeInteger(usage.inputTokens, `${path}.inputTokens`),
    outputTokens: expectNonNegativeInteger(usage.outputTokens, `${path}.outputTokens`),
  };
}

function validateModelPricing(value: unknown, path: string): ReportInput["pricing"]["models"][string] {
  const pricing = expectRecord(value, path);
  return {
    inputPer1M: expectNonNegativeNumber(pricing.inputPer1M, `${path}.inputPer1M`),
    outputPer1M: expectNonNegativeNumber(pricing.outputPer1M, `${path}.outputPer1M`),
  };
}

async function readConfigFile(configPath: string): Promise<string> {
  try {
    return await readFile(configPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "ENOENT") {
        throw new Error(`Could not read config "${configPath}": file not found.`);
      }

      if (code === "EACCES" || code === "EPERM") {
        throw new Error(`Could not read config "${configPath}": permission denied.`);
      }
    }

    const details = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Could not read config "${configPath}".${details}`);
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Invalid config at "${path}": expected an object.`);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid config at "${path}": expected a non-empty string.`);
  }

  return value;
}

function expectKnownModel(value: unknown, path: string, knownModels: string[]): string {
  const model = expectString(value, path);
  if (!knownModels.includes(model)) {
    throw new Error(
      `Invalid config at "${path}": model "${model}" is missing from pricing.models. Known models: ${knownModels.join(", ")}.`,
    );
  }

  return model;
}

function expectFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid config at "${path}": expected a finite number.`);
  }

  return value;
}

function expectNonNegativeNumber(value: unknown, path: string): number {
  const number = expectFiniteNumber(value, path);
  if (number < 0) {
    throw new Error(`Invalid config at "${path}": expected a non-negative number, received ${number}.`);
  }

  return number;
}

function expectPositiveNumber(value: unknown, path: string): number {
  const number = expectFiniteNumber(value, path);
  if (number <= 0) {
    throw new Error(`Invalid config at "${path}": expected a positive number, received ${number}.`);
  }

  return number;
}

function expectNonNegativeInteger(value: unknown, path: string): number {
  const number = expectFiniteNumber(value, path);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid config at "${path}": expected a non-negative integer, received ${number}.`);
  }

  return number;
}
