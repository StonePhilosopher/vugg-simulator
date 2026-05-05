// ============================================================
// js/10-seeded-random.ts — Mulberry32 deterministic PRNG
// ============================================================
// SeededRandom — 32-bit state PRNG, mirrors the seed-42 stream in Python. Used by the simulator for reproducible scenarios.
//
// Phase B3 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS (no import/export);
// every top-level declaration is a global available to later modules.

// ============================================================
// SEEDED PRNG (Mulberry32)
// ============================================================
class SeededRandom {
  state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next() {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(lo, hi) {
    return lo + this.next() * (hi - lo);
  }
  random() {
    return this.next();
  }
}

