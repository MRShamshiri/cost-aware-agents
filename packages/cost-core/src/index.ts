export type Currency = "USD" | string;

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export interface PricingConfig {
  models: Record<string, ModelPricing>;
}

export interface UsageRecord {
  provider?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  metadata?: Record<string, unknown>;
}

export interface CostLine {
  provider?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface CostEstimate {
  currency: Currency;
  totalCost: number;
  lines: CostLine[];
}

export interface Budget {
  limit: number;
  currency: Currency;
}

export interface BudgetResult {
  ok: boolean;
  budget: Budget;
  estimate: CostEstimate;
  overBy: number;
}

export interface ReportInput {
  currency?: Currency;
  pricing: PricingConfig;
  usage: UsageRecord[];
  budget?: Budget;
}

export function estimateCost(input: ReportInput): CostEstimate {
  const currency = input.currency ?? input.budget?.currency ?? "USD";
  const lines = input.usage.map((usage) => {
    const pricing = input.pricing.models[usage.model];
    if (!pricing) {
      throw new Error(`Missing pricing for model "${usage.model}".`);
    }

    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPer1M;

    return {
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  });

  return {
    currency,
    totalCost: roundMoney(lines.reduce((sum, line) => sum + line.totalCost, 0)),
    lines: lines.map((line) => ({
      ...line,
      inputCost: roundMoney(line.inputCost),
      outputCost: roundMoney(line.outputCost),
      totalCost: roundMoney(line.totalCost),
    })),
  };
}

export function checkBudget(estimate: CostEstimate, budget: Budget): BudgetResult {
  const overBy = roundMoney(Math.max(0, estimate.totalCost - budget.limit));
  return {
    ok: overBy === 0,
    budget,
    estimate,
    overBy,
  };
}

export function exportTrace(input: ReportInput, format: "json" | "markdown" = "json"): string {
  const estimate = estimateCost(input);
  const budget = input.budget ? checkBudget(estimate, input.budget) : null;

  if (format === "json") {
    return `${JSON.stringify({ estimate, budget }, null, 2)}\n`;
  }

  const rows = estimate.lines
    .map(
      (line) =>
        `| ${line.provider ?? "-"} | ${line.model} | ${line.inputTokens} | ${line.outputTokens} | ${formatMoney(
          line.totalCost,
          estimate.currency,
        )} |`,
    )
    .join("\n");

  return `# Cost Report

Total: **${formatMoney(estimate.totalCost, estimate.currency)}**

${budget ? `Budget: **${formatMoney(budget.budget.limit, budget.budget.currency)}** (${budget.ok ? "ok" : `over by ${formatMoney(budget.overBy, budget.budget.currency)}`})\n` : ""}
| Provider | Model | Input tokens | Output tokens | Cost |
| --- | --- | ---: | ---: | ---: |
${rows}
`;
}

export function roundMoney(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function formatMoney(value: number, currency: Currency): string {
  return `${value.toFixed(6)} ${currency}`;
}

