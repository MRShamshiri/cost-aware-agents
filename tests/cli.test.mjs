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
