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
    // Each worker evaluates the full multi-megabyte simulator bundle. Leaving
    // Vitest at CPU-count parallelism created a dozen memory-heavy Node
    // processes and made unrelated 20-40 s scenario sweeps time out at
    // 60-150 s under contention. Bound the pool so CI is reproducible and the
    // workstation stays usable; this is managed parallelism, not serialization.
    maxWorkers: 8,
    // Generous default; the calibration sweep test runs 20 scenarios.
    // v175 (2026-06-03): doubled both. The strip recorder now also captures
    // the depletion-FLOOR channel (per-bin min for ion chips at the wall),
    // ~25% more chip reads when recording. Long recording-heavy scenarios
    // (sabkha_dolomitization, mvt determinism) sit near the old limits under
    // vitest's parallel CPU contention — they pass comfortably in isolation,
    // but the shared-worker wall-clock tips them over. SIM 247 adds executed
    // transformation testimony to those recorder-heavy runs. Two minutes is
    // still a finite hang detector while accommodating the bounded worker pool.
    testTimeout: 120000,
    hookTimeout: 180000,
  },
});
