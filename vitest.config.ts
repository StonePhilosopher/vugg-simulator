// Vitest config — JS test harness for vugg-simulator.
//
// The shipped product is the JS bundle in index.html. The retired Python
// prototype is not a runtime or test dependency. This harness loads the dist/ tsc output (same files
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
    // Each worker evaluates the full multi-megabyte simulator bundle. The old
    // eight-worker cap was still unsafe on the local workstation: a measured
    // full run spawned eight 0.7-1.3 GB Node workers and consumed most system
    // RAM. Use one threads-pool worker and disable file parallelism so every
    // ordinary `vitest run`, `npm test`, and `npm run ci` is memory-safe by
    // default. This is slower, but it makes the automated release gate usable
    // and reproducible without relying on an operator to remember CLI flags.
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
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
