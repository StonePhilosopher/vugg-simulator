// Vitest config — JS test harness for vugg-simulator.
//
// The shipped product is the JS bundle in index.html (Python in vugg/
// is dead code). This harness loads the dist/ tsc output (same files
// build.mjs concatenates into the bundle), evals it inside jsdom so
// fetch / DOM globals are available, and exposes the simulator's
// classes for tests to drive scenarios deterministically.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests-js/**/*.test.ts'],
    setupFiles: ['tests-js/setup.ts'],
    // Run bundle setup once per file rather than per test — eval is
    // expensive (~109 module concat + jsdom init).
    isolate: false,
    // Generous default; the calibration sweep test runs 20 scenarios.
    // v175 (2026-06-03): doubled both. The strip recorder now also captures
    // the depletion-FLOOR channel (per-bin min for ion chips at the wall),
    // ~25% more chip reads when recording. Long recording-heavy scenarios
    // (sabkha_dolomitization, mvt determinism) sit near the old limits under
    // vitest's parallel CPU contention — they pass comfortably in isolation,
    // but the shared-worker wall-clock tips them over. Doubling the headroom
    // is proportional to the heavier recorder and removes the load-flake the
    // floor channel widened, without masking real failures (a genuine hang
    // still trips 60s/120s).
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});
