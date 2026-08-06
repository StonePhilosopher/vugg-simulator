#!/usr/bin/env node
/**
 * tools/build-all.mjs — fail-closed `tsc -p tsconfig.json`, followed by
 * `tools/build.mjs` only after compilation succeeds. A stale dist tree must
 * never be spliced into index.html after a compiler failure.
 *
 * Phase B1.5 expects this layout:
 *   tsc -p tsconfig.json    →   build/**\/*.js   (exit 0 required)
 *   tools/build.mjs         →   inlines build/**\/*.js into index.html
 *
 * Pass --check to forward to tools/build.mjs (CI guard for stale index.html).
 */

import { runBuildAll } from './build-all-lib.mjs';

process.exit(runBuildAll());
