import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const tests = [];
let passed = 0;
let failed = 0;
const failures = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export async function runAll() {
  console.log(`\nRunning ${tests.length} tests...\n`);
  const cwd = process.cwd();
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`  PASS ${name}`);
    } catch (err) {
      failed++;
      failures.push({ name, err });
      console.log(`  FAIL ${name}\n       ${err.message?.split("\n")[0]}`);
    }
  }
  process.chdir(cwd);
  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    for (const f of failures) {
      console.log(`--- ${f.name} ---`);
      console.log(f.err.stack || f.err);
    }
    process.exit(1);
  }
}

export function tmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "avsar-test-"));
}

export { assert };
