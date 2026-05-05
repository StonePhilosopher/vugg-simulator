#!/usr/bin/env node
/**
 * tools/build-all.mjs — `tsc -p tsconfig.json` followed by `tools/build.mjs`,
 * with type errors treated as informational (not build-blocking).
 *
 * Why: the seed code in js/00-bundle.ts is 22k lines of pre-existing JS
 * that's now under TypeScript. Until each module is properly typed, we
 * expect a few hundred errors. We still want them visible — but tsc's
 * non-zero exit on errors must not stop the splice step, otherwise
 * index.html falls behind the source tree.
 *
 * Phase B1.5 expects this layout:
 *   tsc -p tsconfig.json    →   build/**\/*.js   (still emits even with errors)
 *   tools/build.mjs         →   inlines build/**\/*.js into index.html
 *
 * Pass --check to forward to tools/build.mjs (CI guard for stale index.html).
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Run tsc by invoking its bundled bin script directly with `node` —
// avoids the cross-platform headaches of finding npx/npm on PATH and
// works whether or not node_modules/.bin is on PATH.
const TSC_ENTRY = join(ROOT, "node_modules", "typescript", "bin", "tsc");

console.log("[build-all] running tsc…");
const tsc = spawnSync(process.execPath, [TSC_ENTRY, "-p", "tsconfig.json"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (tsc.status !== 0) {
  console.warn(
    `[build-all] tsc reported errors (exit ${tsc.status}) — continuing anyway. Fix them iteratively.`
  );
}

console.log("[build-all] running tools/build.mjs…");
const args = ["tools/build.mjs", ...process.argv.slice(2)];
const splice = spawnSync(process.execPath, args, {
  cwd: ROOT,
  stdio: "inherit",
});
process.exit(splice.status ?? 1);
