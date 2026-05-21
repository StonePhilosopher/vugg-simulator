# 04: Implementation Notes for Builder

**Date:** 2026-05-21
**Audience:** Builder (future self or other developer)
**Prerequisites:** Understanding of v125 architecture, mineral engines, stoichiometry, run_step loop

---

## Architecture Overview

### Current Flow (v125)

```
run_step():
  for each mineral in MINERAL_ENGINES (fixed order):
    calculate σ from fluid
    if σ > threshold:
      grow()
      debit fluid
  next mineral
```

### New Flow (v126+)

```
run_step():
  // Phase 1: Calculate initiative
  initiative_results = []
  for each mineral in MINERAL_ENGINES:
    calculate σ from fluid
    if σ <= 0: continue  // can't nucleate
    base = baseInitiative(σ)
    modifiers = calculateModifiers(mineral, σ, fluid)
    final = base + sum(modifiers.map(m => m.value))
    initiative_results.push({mineral, base, modifiers, final})
  
  // Phase 2: Sort by initiative
  sort initiative_results by final (descending)
  
  // Phase 3: Grow in initiative order
  for each result in sorted_results:
    recalculate σ from current fluid  // IMPORTANT: fluid may have changed
    if σ <= threshold: continue  // edge-of-gate dropped below
    grow()
    debit fluid
  
  // Phase 4: Log
  log initiative order for debugging
```

---

## Key Implementation Decisions

### 1. When to Recalculate σ

**Option A: Once per step (before initiative)**
- Pro: Fast, simple
- Con: Doesn't capture competition — mineral A's growth doesn't affect mineral B's σ before B acts

**Option B: After each mineral (during initiative loop)**
- Pro: Captures competition accurately
- Con: Slower, more complex, may cause cascade loops

**Recommendation:** Option B. The whole point of initiative is that order matters. If we don't recalculate σ after each mineral, the initiative order is cosmetic.

**Optimization:** Cache σ calculations. If fluid hasn't changed since last calculation, reuse. Most minerals won't change fluid enough to affect others.

### 2. Tiebreaking

When two minerals have equal final initiative:

**Option A: Base σ wins**
- Higher base σ = higher growth potential = should go first

**Option B: Surface energy wins**
- Lower γ = faster nucleation = should go first

**Option C: Random**
- More naturalistic, less predictable
- Con: Breaks determinism

**Recommendation:** Option A (base σ) for deterministic mode. Option C (random) for stochastic mode (future).

### 3. Edge-of-Gate Handling

A mineral that passes initiative but then fails σ recalc:

```typescript
// In sorted initiative loop:
for (const result of sortedResults) {
  const currentσ = calculateSigma(result.mineral, fluid);
  const threshold = getThreshold(result.mineral);
  
  if (currentσ <= threshold) {
    log(`${result.mineral} passed initiative (${result.final}) but failed σ recalc (${currentσ} <= ${threshold})`);
    continue;  // skip this mineral this step
  }
  
  grow(result.mineral, currentσ);
  debitFluid(result.mineral);
}
```

**Why this matters:** A mineral might have high initiative (high σ initially) but after earlier minerals deplete the fluid, its σ drops below threshold. This is realistic — a mineral that "almost" got to nucleate loses its window.

### 4. Feature Flag

```typescript
// In js/15-version.ts or config
const USE_INITIATIVE = SIM_VERSION >= 126;

// Or URL param
const useInitiative = new URLSearchParams(window.location.search).get('initiative') !== 'off';
```

**Migration strategy:**
- v126: Implement, flag-gated, default OFF
- v127: Enable in select scenarios, compare baselines
- v128: Enable globally if baselines acceptable
- v129: Remove flag, initiative is default

### 5. Performance

Initiative adds overhead:
- Calculate σ for all minerals (already done)
- Calculate modifiers (new)
- Sort results (new)
- Recalculate σ during loop (new)

**Expected cost:** ~10-20% slower per step
**Mitigation:**
- Only recalculate σ for minerals that might be affected by the last debit
- Cache modifier calculations (temperature/surface energy don't change within a step)
- Use simple array sort, not fancy data structures

### 6. Testing Strategy

#### Unit Tests
```typescript
// tests-js/initiative.test.ts
describe('base initiative', () => {
  test('σ = 0 → initiative = 0', () => {
    expect(baseInitiative(0)).toBe(0);
  });
  test('σ = 1.0 → initiative ≈ 10', () => {
    expect(baseInitiative(1.0)).toBeCloseTo(10, 0);
  });
  test('σ = 2.0 → initiative > σ = 1.0', () => {
    expect(baseInitiative(2.0)).toBeGreaterThan(baseInitiative(1.0));
  });
});

describe('temperature modifier', () => {
  test('calcite at 80°C → +2', () => {
    const fluid = { temperature: 80 };
    expect(temperatureModifier('calcite', fluid)).toBe(2);
  });
  test('opal at 40°C → +2', () => {
    const fluid = { temperature: 40 };
    expect(temperatureModifier('opal', fluid)).toBe(2);
  });
  test('quartz at 40°C → -2', () => {
    const fluid = { temperature: 40 };
    expect(temperatureModifier('quartz', fluid)).toBe(-2);
  });
});

describe('edge-of-gate modifier', () => {
  test('σ = 0.9·σ_crit → -2', () => {
    expect(edgeOfGateModifier(0.9, 1.0)).toBe(-2);
  });
  test('σ = 1.05·σ_crit → -2', () => {
    expect(edgeOfGateModifier(1.05, 1.0)).toBe(-2);
  });
  test('σ = 2.0·σ_crit → +1', () => {
    expect(edgeOfGateModifier(2.0, 1.0)).toBe(1);
  });
});
```

#### Integration Tests
```typescript
// tests-js/initiative-paragenesis.test.ts
describe('initiative changes paragenesis order', () => {
  test('opal wins over quartz at low T', () => {
    const fluid = { temperature: 40, SiO2: 500 };
    const results = runStepWithInitiative(fluid);
    const opalIdx = results.findIndex(r => r.mineral === 'opal');
    const quartzIdx = results.findIndex(r => r.mineral === 'quartz');
    expect(opalIdx).toBeLessThan(quartzIdx);
  });
  
  test('shared-cation competition reduces initiative', () => {
    const fluid = { Cu: 50, Zn: 50 };
    const results = runStepWithInitiative(fluid);
    const dioptase = results.find(r => r.mineral === 'dioptase');
    const brochantite = results.find(r => r.mineral === 'brochantite');
    // Both have Cu competition, so both have reduced initiative
    expect(dioptase.final).toBeLessThan(dioptase.base);
    expect(brochantite.final).toBeLessThan(brochantite.base);
  });
});
```

#### Baseline Comparison
```typescript
// tests-js/initiative-baseline.test.ts
describe('initiative baseline drift', () => {
  test('simple scenarios remain byte-identical', () => {
    // tutorial_first_crystal, stalactite_demo, etc.
  });
  
  test('dense suites drift predictably', () => {
    // supergene_oxidation, schneeberg
    // Accept drift if it improves paragenesis realism
  });
});
```

---

## Code Structure

### New Files

```
js/
  20-initiative.ts           # Initiative calculation module
  20-initiative-modifiers.ts # Modifier functions (temp, edge, surface, competition)
  
tests-js/
  initiative.test.ts           # Unit tests
  initiative-paragenesis.test.ts  # Integration tests
  initiative-baseline.test.ts     # Baseline drift tests
  
research/INITIATIVE-VARIABLE/
  01-geochemical-grounding.md
  02-v125-cascade-analysis.md
  03-modifier-calibration.md
  04-implementation-notes.md   # this file
  05-open-questions.md
```

### Modified Files

```
js/15-version.ts              # Add v126 initiative arc docs
js/19-mineral-stoichiometry.ts # Competition modifier needs stoichiometry keys
data/minerals.json            # Add preferredTempRange, criticalSupersaturation, surfaceEnergy
js/99-legacy-bundle.ts        # Wire initiative sort into run_step
tests-js/calibration.test.ts  # Add initiative-gated comparison
```

---

## Migration Path

### Step 1: Infrastructure (v126)
- Create `js/20-initiative.ts` with base initiative + modifier framework
- Add spec fields to `data/minerals.json` (top 20 minerals only)
- Gate behind feature flag
- Add unit tests

### Step 2: Calibration (v127)
- Run seed-42 baselines with initiative enabled
- Adjust modifier values until drift is acceptable
- Add top 50 mineral spec fields

### Step 3: Dense Suite Fixes (v128)
- Focus on supergene_oxidation, schneeberg, roughten_gill
- Competition penalty should reduce cascade severity
- Accept some drift as "improved realism"

### Step 4: Substrate/Epitaxy (v129)
- Add substrate modifier
- Test overgrowth scenarios (TN457 barite on sphalerite)

### Step 5: Enable Globally (v130)
- Remove feature flag
- Initiative is default behavior
- Update all baselines

---

## Debugging

### Initiative Trace Log

```typescript
// Add to run_step when initiative enabled
console.log('=== Initiative Order ===');
for (const r of sortedResults) {
  const modStr = r.modifiers.map(m => `${m.source}:${m.value}`).join(', ');
  console.log(`${r.mineral}: base=${r.base.toFixed(1)} mods=[${modStr}] final=${r.final.toFixed(1)}`);
}
```

### Visual Debug Panel

In the UI, add a toggleable panel showing:
- Current step's initiative order
- Each mineral's σ, σ_crit, modifiers
- Why a mineral skipped (failed σ recalc? initiative too low?)

This helps the builder (and Professor) understand why paragenesis unfolds the way it does.

---

## Bottom Line

The implementation is straightforward:
1. Calculate initiative (base + modifiers)
2. Sort
3. Grow in order
4. Recalculate σ after each mineral

The complexity is in **calibration** — getting the modifier values right so that baselines drift predictably and paragenesis improves. The builder should expect 2-3 versions of tuning before dense suites stabilize.

The v125 cascade data is the calibration target. If the initiative system correctly predicts which minerals cascaded and which didn't, it's working.

— 🪨✍️
