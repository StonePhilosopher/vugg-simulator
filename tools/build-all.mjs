#!/usr/bin/env node
/**
 * tools/build-all.mjs — fail-closed narrative generation/audit, followed by
 * `tsc -p tsconfig.json`, followed by `tools/build.mjs` only after both gates
 * succeed. A stale dist tree must never be spliced into index.html.
 *
 * Phase B1.5 expects this layout:
 *   tsc -p tsconfig.json    →   build/**\/*.js   (exit 0 required)
 *   tools/build.mjs         →   inlines build/**\/*.js into index.html
 *
 * Pass --check to check both generated narrative-manifest drift and the
 * bundled index.html without rewriting either source artifact.
 */

import { runBuildAll } from './build-all-lib.mjs';

process.exit(runBuildAll());
