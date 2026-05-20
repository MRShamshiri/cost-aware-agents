import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

