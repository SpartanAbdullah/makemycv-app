// Aggregate test runner — `npm test`.
//
// Discovers every `test:*` script in package.json and runs each sequentially
// via `npm run`, failing fast on the first non-zero exit. Discovery (rather
// than a hardcoded list) means a new bespoke suite is picked up the moment
// its script is added — the list below can never drift out of date.
//
// Suites run in package.json declaration order, which keeps the fast pure
// TypeScript suites first and the slower pdf-smoke render last.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const suites = Object.keys(pkg.scripts ?? {}).filter((name) =>
  name.startsWith("test:"),
);

if (suites.length === 0) {
  console.error("run-all-tests: no test:* scripts found in package.json");
  process.exit(1);
}

const startedAt = Date.now();
const failed = [];

// No fail-fast (changed 2026-08-02, audit A-W5-016). Exiting on the first
// failure meant one broken suite hid every other result, so a CI run told you
// about exactly one bug per round-trip. Run everything, report at the end.
for (const [i, suite] of suites.entries()) {
  console.log(`\n──── ${suite} (${i + 1}/${suites.length}) ────`);
  const result = spawnSync("npm", ["run", suite], {
    cwd: root,
    stdio: "inherit",
    // npm is npm.cmd on Windows; shell:true resolves it on every platform.
    shell: true,
  });
  if (result.status !== 0) failed.push(suite);
}

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

if (failed.length > 0) {
  console.error(
    `\nrun-all-tests: ${failed.length} of ${suites.length} suites FAILED ` +
      `in ${seconds}s — ${failed.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `\nrun-all-tests: all ${suites.length} suites passed in ${seconds}s.`,
);
