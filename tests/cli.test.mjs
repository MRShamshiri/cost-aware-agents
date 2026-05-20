import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

test("CLI renders markdown reports", () => {
  const result = spawnSync(
    process.execPath,
    ["packages/agent-cli/dist/cli.js", "report", "examples/basic-budget.json", "--format", "markdown"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Cost Report/);
});

test("CLI reports malformed JSON with file context", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "broken.json");
  writeFileSync(configPath, '{"pricing":', "utf8");

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid JSON in ".*broken\.json"\./);
});

test("CLI reports missing config files clearly", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "missing.json");

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not read config ".*missing\.json": file not found\./);
});

test("CLI reports missing --format values clearly", () => {
  const result = spawnSync(
    process.execPath,
    ["packages/agent-cli/dist/cli.js", "report", "examples/basic-budget.json", "--format"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing value for --format\./);
});

test("CLI validates required usage entries", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "invalid-usage.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      pricing: {
        models: {
          "mock-fast": {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        },
      },
      usage: [{}],
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid config at ".*invalid-usage\.json\.usage\[0\]\.model": expected a non-empty string\./);
});

test("CLI validates that pricing models are declared", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "missing-pricing-model.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      pricing: {
        models: {
          "mock-fast": {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        },
      },
      usage: [
        {
          model: "mock-slow",
          inputTokens: 1000,
          outputTokens: 2000,
        },
      ],
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid config at ".*missing-pricing-model\.json\.usage\[0\]\.model": model "mock-slow" is missing from pricing\.models\. Known models: mock-fast\./,
  );
});

test("CLI validates that pricing models are not empty", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "empty-pricing-models.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      pricing: {
        models: {},
      },
      usage: [
        {
          model: "mock-fast",
          inputTokens: 1000,
          outputTokens: 2000,
        },
      ],
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid config at ".*empty-pricing-models\.json\.pricing\.models": expected at least one model pricing entry\./);
});

test("CLI validates that token counts are non-negative integers", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "invalid-tokens.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      pricing: {
        models: {
          "mock-fast": {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        },
      },
      usage: [
        {
          model: "mock-fast",
          inputTokens: -1,
          outputTokens: 2000,
        },
      ],
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid config at ".*invalid-tokens\.json\.usage\[0\]\.inputTokens": expected a non-negative integer, received -1\./);
});

test("CLI validates that budget limits are positive", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "invalid-budget.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      budget: {
        limit: 0,
        currency: "USD",
      },
      pricing: {
        models: {
          "mock-fast": {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        },
      },
      usage: [
        {
          model: "mock-fast",
          inputTokens: 1000,
          outputTokens: 2000,
        },
      ],
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid config at ".*invalid-budget\.json\.budget\.limit": expected a positive number, received 0\./);
});

test("CLI validates that budget currency matches report currency", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "currency-mismatch.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      currency: "USD",
      budget: {
        limit: 0.05,
        currency: "EUR",
      },
      pricing: {
        models: {
          "mock-fast": {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        },
      },
      usage: [
        {
          model: "mock-fast",
          inputTokens: 1000,
          outputTokens: 2000,
        },
      ],
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid config at ".*currency-mismatch\.json\.budget\.currency": expected "USD" to match ".*currency-mismatch\.json\.currency"\./,
  );
});

test("CLI rejects unknown top-level config fields", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "unknown-top-level.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      pricing: {
        models: {
          "mock-fast": {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        },
      },
      usage: [
        {
          model: "mock-fast",
          inputTokens: 1000,
          outputTokens: 2000,
        },
      ],
      budegt: {
        limit: 0.05,
        currency: "USD",
      },
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid config at ".*unknown-top-level\.json": unknown field "budegt"\. Allowed fields: budget, currency, pricing, usage\./,
  );
});

test("CLI rejects unknown usage fields", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cost-aware-agent-cli-"));
  const configPath = path.join(fixtureDir, "unknown-usage-field.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      pricing: {
        models: {
          "mock-fast": {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        },
      },
      usage: [
        {
          model: "mock-fast",
          inputTokens: 1000,
          outputTokens: 2000,
          outputTokenz: 3000,
        },
      ],
    }),
    "utf8",
  );

  const result = spawnSync(process.execPath, ["packages/agent-cli/dist/cli.js", "report", configPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Invalid config at ".*unknown-usage-field\.json\.usage\[0\]": unknown field "outputTokenz"\. Allowed fields: inputTokens, metadata, model, outputTokens, provider\./,
  );
});
