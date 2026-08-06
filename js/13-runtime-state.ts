// ============================================================
// js/13-runtime-state.ts — single global rng + the time-compression scale
// ============================================================
// Two `let` globals that other modules read+write: the seeded PRNG
// instance used by every randomness call site, and the time-scale
// multiplier (5× = ~50,000 years/step in Simulation/Creative,
// 1× = ~10,000 in Groove). Loads after 10-seeded-random.ts so the
// SeededRandom class is declared, before 85-simulator.ts so the
// simulator's constructor can read them.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

let rng = new SeededRandom(Date.now());
// Time compression: each step represents more geological time at higher values.
// 5× = ~50,000 years/step (Simulation/Creative), 1× = ~10,000 years/step (Groove).
// Physics are identical — the clock is different, not the chemistry.
let timeScale = 5.0;

function getSimulationTimeScale(): number {
  return timeScale;
}

function setSimulationTimeScale(scale: number): number {
  const next = Number(scale);
  if (!Number.isFinite(next) || next <= 0) throw new RangeError('time scale must be a positive finite number');
  timeScale = next;
  return timeScale;
}
