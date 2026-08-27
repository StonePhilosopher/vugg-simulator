// tests-js/movements.test.ts — geological MOVEMENTS engine (js/85j), Phase 0.
//
// Pins the PURE pieces: the seed-derived movement PRNG (reproducibility — the
// load-bearing property for baselines AND the crystal-cipher sub-project), the
// primitive shape operators (trend/pulse/step/mixing), and the controller's
// two contracts: (1) an EMPTY controller is a total no-op (the dark-scaffold
// sim-neutrality guarantee), (2) an active movement drives its field
// deterministically from the seed with bounded, mean-reverting texture.

import { describe, expect, it } from 'vitest';

declare const _makeMovementRng: any;
declare const _mvTrend: any;
declare const _mvPulse: any;
declare const _mvStep: any;
declare const _mvMixFraction: any;
declare const _evalMovementOps: any;
declare const movementFieldDomain: any;
declare const movementFieldRequiresSulfurBoundary: any;
declare const canonicalMovementFieldPath: any;
declare const _commissionMovementSpec: any;
declare const MovementController: any;
declare const _createMovementController: any;
declare const _pickOriginCell: any;
declare const FluidSpotField: any;

const conds = () => ({ temperature: 200, fluid: { pH: 6, Eh: 200, Ca: 236.25, reactiveSilicaFraction: 1 } });

describe('movements — seed-derived PRNG (reproducible randomness)', () => {
  it('same vugg seed → identical sequence; different seed → different', () => {
    const a = _makeMovementRng(58);
    const b = _makeMovementRng(58);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);                       // reproducible
    const c = _makeMovementRng(59);
    const seqC = Array.from({ length: 8 }, () => c());
    expect(seqC).not.toEqual(seqA);                   // seed actually matters
    for (const x of seqA) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });

  it('the salt makes the movement stream independent of same-seeded streams', () => {
    const moves = _makeMovementRng(58);                       // default 'MOVE' salt
    const other = _makeMovementRng(58, 0x700aa517);           // a different sub-stream
    expect(Array.from({ length: 6 }, () => moves()))
      .not.toEqual(Array.from({ length: 6 }, () => other()));
  });

  it('exposes and restores the exact mulberry cursor without changing its sequence', () => {
    const stream = _makeMovementRng(58);
    stream();
    const cursor = stream.state;
    const expectedNext = stream();
    stream.state = cursor;
    expect(stream()).toBe(expectedNext);
  });

  it('_pickOriginCell is seeded (reproducible), in-range, and seed-sensitive', () => {
    const cellCount = 1920;
    const a = _pickOriginCell(_makeMovementRng(58), cellCount);
    const b = _pickOriginCell(_makeMovementRng(58), cellCount);
    expect(a).toBe(b);                                        // same vugg seed → same origin cell
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(cellCount);
    expect(Number.isInteger(a)).toBe(true);
    const spread = [58, 59, 60, 61, 62].map((s) => _pickOriginCell(_makeMovementRng(s), cellCount));
    expect(new Set(spread).size).toBeGreaterThan(1);         // different cavities → varied origins
    expect(_pickOriginCell(_makeMovementRng(58), 0)).toBe(0); // degenerate cellCount is safe
  });
});

describe('movements — primitive shape operators (pure)', () => {
  it('TREND is a monotonic 0→1 smoothstep', () => {
    expect(_mvTrend(0)).toBeCloseTo(0, 6);
    expect(_mvTrend(1)).toBeCloseTo(1, 6);
    expect(_mvTrend(0.5)).toBeCloseTo(0.5, 6);
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.1) { const v = _mvTrend(u); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    expect(_mvTrend(0.5, false)).toBeCloseTo(0.5, 6);   // linear variant
    expect(_mvTrend(-1)).toBe(0); expect(_mvTrend(2)).toBe(1);   // clamped
  });

  it('PULSE peaks at its center and decays symmetrically', () => {
    expect(_mvPulse(0.5, 0.5, 0.1)).toBeCloseTo(1, 6);
    expect(_mvPulse(0.4, 0.5, 0.1)).toBeCloseTo(_mvPulse(0.6, 0.5, 0.1), 6); // symmetric
    expect(_mvPulse(0.5, 0.5, 0.1)).toBeGreaterThan(_mvPulse(0.7, 0.5, 0.1)); // decays
  });

  it('STEP is ~0 before the threshold and ~1 after', () => {
    expect(_mvStep(0.2, 0.5)).toBeCloseTo(0, 6);
    expect(_mvStep(0.8, 0.5)).toBeCloseTo(1, 6);
    expect(_mvStep(0.5, 0.5)).toBeCloseTo(0.5, 6);   // half at the threshold
  });

  it('_evalMovementOps sums operators; empty → 0', () => {
    expect(_evalMovementOps(undefined, 0.5)).toBe(0);
    expect(_evalMovementOps([], 0.5)).toBe(0);
    const d = _evalMovementOps([{ kind: 'trend', amp: -50 }, { kind: 'pulse', amp: 10, center: 0.5, width: 0.1 }], 0.5);
    expect(d).toBeCloseTo(-50 * 0.5 + 10 * 1, 6);     // -25 + 10 = -15
  });
});

describe('movements — controller: EMPTY is a total no-op (sim-neutral guarantee)', () => {
  it('isEmpty, and applyStep mutates nothing across many steps', () => {
    const ctl = new MovementController(undefined, 58);
    expect(ctl.isEmpty).toBe(true);
    const c = conds();
    const before = JSON.stringify(c);
    for (let s = 0; s < 50; s++) ctl.applyStep(c, s);
    expect(JSON.stringify(c)).toBe(before);            // byte-identical conditions
  });

  it('_createMovementController yields an empty controller when no scenario opts in', () => {
    const simNoMoves = { _seed: 42, conditions: { wall: { shape_seed: 58 }, _scenario: {} } };
    expect(_createMovementController(simNoMoves).isEmpty).toBe(true);
    const simMoves = { _seed: 42, conditions: { wall: { shape_seed: 58 }, _scenario: { movements: [{ field: 'temperature', startStep: 0, endStep: 5, ops: [{ kind: 'trend', amp: -10 }] }] } } };
    expect(_createMovementController(simMoves).isEmpty).toBe(false);
  });

  it('drivesFieldAt detects an active movement on a field (Phase 4c.3a redox-canonical gate)', () => {
    const ctl = new MovementController([
      { field: 'fluid.Eh', startStep: 5, endStep: 15, ops: [{ kind: 'trend', amp: 100 }] },
    ], 58);
    // exact dotted path, inside the window
    expect(ctl.drivesFieldAt('fluid.Eh', 5)).toBe(true);
    expect(ctl.drivesFieldAt('fluid.Eh', 14)).toBe(true);
    // bare leaf form also matches (run_step queries drivesFieldAt('Eh', step))
    expect(ctl.drivesFieldAt('Eh', 10)).toBe(true);
    // outside the window (start inclusive, end exclusive)
    expect(ctl.drivesFieldAt('Eh', 4)).toBe(false);
    expect(ctl.drivesFieldAt('Eh', 15)).toBe(false);
    // a different field is not driven
    expect(ctl.drivesFieldAt('temperature', 10)).toBe(false);
    // empty controller drives nothing
    expect(new MovementController(undefined, 58).drivesFieldAt('Eh', 10)).toBe(false);
  });
});

describe('movements — controller: active movement drives its field', () => {
  const coolingSpec = [{ field: 'temperature', startStep: 0, endStep: 10, ops: [{ kind: 'trend', amp: -50 }] }];

  it('a cooling TREND lowers temperature monotonically over its window, then stops', () => {
    const ctl = new MovementController(coolingSpec, 58);
    const c = conds();
    const temps: number[] = [];
    for (let s = 0; s < 15; s++) { ctl.applyStep(c, s); temps.push(c.temperature); }
    expect(temps[0]).toBeCloseTo(200, 6);              // base at u=0
    expect(temps[9]).toBeLessThan(temps[0]);           // cooled by end of window
    expect(temps[9]).toBeGreaterThan(150 - 1);         // approaches base-50
    for (let i = 1; i < 10; i++) expect(temps[i]).toBeLessThanOrEqual(temps[i - 1] + 1e-9);
    expect(temps[14]).toBeCloseTo(temps[9], 6);        // inactive after endStep → held
  });

  it('drives a NESTED field path (fluid.pH)', () => {
    const ctl = new MovementController([{ field: 'fluid.pH', startStep: 0, endStep: 4, ops: [{ kind: 'trend', amp: -2 }] }], 58);
    const c = conds();
    for (let s = 0; s < 4; s++) ctl.applyStep(c, s);
    expect(c.fluid.pH).toBeLessThan(6);                // acidified
    expect(c.temperature).toBe(200);                   // untouched
  });

  it('is REPRODUCIBLE from the seed and seed-SENSITIVE under texture', () => {
    const spec = [{ field: 'fluid.Eh', startStep: 0, endStep: 30, ops: [{ kind: 'trend', amp: 100 }], texture: { theta: 0.4, sigma: 6 } }];
    const run = (seed: number) => {
      const ctl = new MovementController(spec, seed); const c = conds(); const out: number[] = [];
      for (let s = 0; s < 30; s++) { ctl.applyStep(c, s); out.push(c.fluid.Eh); }
      return out;
    };
    expect(run(58)).toEqual(run(58));                  // same seed → identical (bit-reproducible)
    expect(run(59)).not.toEqual(run(58));              // different seed → different texture
  });

  it('texture is mean-reverting (bounded), not a wandering random walk', () => {
    const ctl = new MovementController([{ field: 'fluid.Eh', startStep: 0, endStep: 400, base: 200, texture: { theta: 0.4, sigma: 6 } }], 58);
    const c = conds();
    let maxDev = 0;
    for (let s = 0; s < 400; s++) { ctl.applyStep(c, s); maxDev = Math.max(maxDev, Math.abs(c.fluid.Eh - 200)); }
    expect(maxDev).toBeGreaterThan(0);                 // it actually moves
    expect(maxDev).toBeLessThan(60);                   // but reverts — never wanders far (OU, not a walk)
  });

  it('respects clampMin / clampMax', () => {
    const ctl = new MovementController([{ field: 'temperature', startStep: 0, endStep: 5, ops: [{ kind: 'trend', amp: -500 }], clampMin: 25 }], 58);
    const c = conds();
    for (let s = 0; s < 5; s++) ctl.applyStep(c, s);
    expect(c.temperature).toBeGreaterThanOrEqual(25);  // floored
  });

  it('enforces canonical solute domains even when an authored schedule omits or weakens its clamp', () => {
    expect(movementFieldDomain('fluid.Ca')).toEqual({
      min: 0,
      authority: 'nonnegative-dissolved-inventory',
    });
    expect(movementFieldDomain('fluid.pH')).toMatchObject({ min: 0, max: 14 });
    expect(movementFieldDomain('fluid.reactiveSilicaFraction')).toMatchObject({ min: 0, max: 1 });
    expect(movementFieldDomain('fluid.Eh')).toEqual({ authority: 'signed-redox-potential' });

    const ctl = new MovementController([{
      field: 'fluid.Ca', startStep: 0, endStep: 5, base: 236.25,
      ops: [{ kind: 'trend', amp: -1000, ease: false }],
      clampMin: -5000,
    }], 58);
    const c = conds();
    for (let s = 0; s < 5; s++) ctl.applyStep(c, s);
    expect(c.fluid.Ca).toBe(0);
    expect(c.fluid.pH).toBe(6);

    const signed = new MovementController([{
      field: 'fluid.Eh', startStep: 0, endStep: 2, base: 20,
      ops: [{ kind: 'trend', amp: -200, ease: false }],
    }], 58);
    signed.applyStep(c, 1);
    expect(c.fluid.Eh).toBeLessThan(0);
  });

  it('commissions authored and player movement rows from the same derived authority', () => {
    const commissioned = _commissionMovementSpec({
      field: 'fluid.Ca', startStep: 0, endStep: 5,
      clampMin: -99, domainAuthority: 'forged-authority',
    });
    expect(commissioned).toMatchObject({
      field: 'fluid.Ca',
      clampMin: 0,
      domainAuthority: 'nonnegative-dissolved-inventory',
    });
    const ctl = new MovementController([{
      field: 'fluid.reactiveSilicaFraction', startStep: 0, endStep: 5,
    }], 58);
    expect(ctl.movements[0]).toMatchObject({
      clampMin: 0,
      clampMax: 1,
      domainAuthority: 'dissolved-silica-fraction-domain',
    });
    for (const field of [
      'fluid.S', 'fluid.S_sulfide', 'fluid.S_sulfate', 'fluid.S_elemental',
      'fluid.sulfurPoolsExplicit', 'fluid.sulfateInherited', 'fluid.nativeSulfurPathway',
    ]) {
      expect(movementFieldRequiresSulfurBoundary(field)).toBe(true);
      expect(() => _commissionMovementSpec({ field, startStep: 0, endStep: 5 }))
        .toThrow(/valence-specific sulfur boundary/);
      const bare = field.slice('fluid.'.length);
      expect(movementFieldRequiresSulfurBoundary(bare)).toBe(true);
      expect(() => new MovementController([{
        field: bare, origin: 'cell', originCell: 0, startStep: 0, endStep: 2,
        base: 0, ops: [{ kind: 'trend', amp: 200, ease: false }],
      }], 58)).toThrow(/valence-specific sulfur boundary/);
    }
  });

  it('applies the canonical domain after player offsets and to cell-origin feeders', () => {
    const global = new MovementController([{
      field: 'fluid.Ca', startStep: 0, endStep: 5, base: 10,
    }], 58);
    expect(global.applyPlayerDelta('fluid.Ca', 1, -50)).toBeTruthy();
    const c = conds();
    global.applyStep(c, 1);
    expect(c.fluid.Ca).toBe(0);

    const cellFluid = { Ca: 4 };
    const mesh = { cells: [{ fluid: cellFluid }] };
    const sim = { wall_state: { meshFor: () => mesh } };
    const cell = new MovementController([{
      field: 'fluid.Ca', origin: 'cell', originCell: 0,
      startStep: 0, endStep: 2, base: 4,
      ops: [{ kind: 'trend', amp: -20, ease: false }],
    }], 58);
    cell.applyStep(c, 1, sim);
    expect(cellFluid.Ca).toBe(0);

    const bareCellFluid = { Ca: 4, reactiveSilicaFraction: 0.9, pH: 2 };
    const bareSim = { wall_state: { meshFor: () => ({ cells: [{ fluid: bareCellFluid }] }) } };
    const bareCa = new MovementController([{
      field: 'Ca', origin: 'cell', originCell: 0,
      startStep: 0, endStep: 2, base: 4,
      ops: [{ kind: 'trend', amp: -20, ease: false }],
    }], 58);
    expect(bareCa.movements[0].field).toBe('fluid.Ca');
    expect(canonicalMovementFieldPath('Ca')).toBe('fluid.Ca');
    expect(movementFieldDomain('Ca')).toEqual(movementFieldDomain('fluid.Ca'));
    bareCa.applyStep(c, 1, bareSim);
    expect(bareCellFluid.Ca).toBe(0);

    const bareFraction = new MovementController([{
      field: 'reactiveSilicaFraction', origin: 'cell', originCell: 0,
      startStep: 0, endStep: 2, base: 0.9,
      ops: [{ kind: 'trend', amp: 1, ease: false }],
    }], 58);
    bareFraction.applyStep(c, 1, bareSim);
    expect(bareCellFluid.reactiveSilicaFraction).toBe(1);

    const barePH = new MovementController([{
      field: 'pH', origin: 'cell', originCell: 0,
      startStep: 0, endStep: 2, base: 2,
      ops: [{ kind: 'trend', amp: -20, ease: false }],
    }], 58);
    barePH.applyStep(c, 1, bareSim);
    expect(bareCellFluid.pH).toBe(0);
  });

  it('carries a player Heat delta on top of an absolute authored temperature curve', () => {
    const spec = [{
      field: 'temperature', startStep: 0, endStep: 100, base: 180,
      ops: [{ kind: 'trend', amp: -20 }],
    }];
    const waitOnly = new MovementController(spec, 58);
    const intervened = new MovementController(spec, 58);
    const baseline = conds();
    const heated = conds();
    baseline.temperature = 180;
    heated.temperature = 205; // visible Heat result before Advance
    const receipt = intervened.applyPlayerDelta('temperature', 1, 25);
    expect(receipt).toMatchObject({
      schema: 'movement-player-offset-v2',
      movement_index: 0,
      field: 'temperature',
      first_geology_step: 1,
      applied_delta: 25,
      offset_before: 0,
      offset_after: 25,
      offset_application: 'after-authored-texture-and-clamp',
    });
    waitOnly.applyStep(baseline, 1);
    intervened.applyStep(heated, 1);
    expect(heated.temperature - baseline.temperature).toBeCloseTo(25, 12);
    expect(heated.temperature).toBeGreaterThan(204.9);
    // The offset remains part of the choice while the authored movement keeps
    // its own cooling shape.
    waitOnly.applyStep(baseline, 50);
    intervened.applyStep(heated, 50);
    expect(heated.temperature - baseline.temperature).toBeCloseTo(25, 12);
  });

  it('names the last overlapping owner while carrying the field choice across handoff', () => {
    const ctl = new MovementController([
      { field: 'temperature', startStep: 0, endStep: 20, base: 180 },
      { field: 'temperature', startStep: 5, endStep: 10, base: 220 },
    ], 58);
    const receipt = ctl.applyPlayerDelta('temperature', 6, -5);
    expect(receipt).toMatchObject({ movement_index: 1, offset_after: -5 });
    expect(ctl._state[0].playerOffset).toBe(-5);
    expect(ctl._state[1].playerOffset).toBe(-5);
    const c = conds();
    ctl.applyStep(c, 6);
    expect(c.temperature).toBe(215); // later owner
    ctl.applyStep(c, 12);
    expect(c.temperature).toBe(175); // earlier owner resumes; choice survives
    expect(ctl.applyPlayerDelta('fluid.pH', 6, 1)).toBeNull();
    expect(ctl.applyPlayerDelta('temperature', 30, 1)).toBeNull();
  });

  it('applies a player choice after authored clamps instead of silently erasing it', () => {
    const ctl = new MovementController([{
      field: 'temperature', startStep: 0, endStep: 5, base: 20, clampMin: 25,
    }], 58);
    const c = conds();
    expect(ctl.applyPlayerDelta('temperature', 1, 5)).toBeTruthy();
    ctl.applyStep(c, 1);
    expect(c.temperature).toBe(30);
  });

  it('does not reinterpret a cell-origin feeder as an erased global control', () => {
    const ctl = new MovementController([{
      field: 'fluid.B', origin: 'cell', startStep: 0, endStep: 10,
      ops: [{ kind: 'trend', amp: 10 }],
    }], 58);
    expect(ctl.applyPlayerDelta('fluid.B', 1, 4)).toBeNull();
    expect(ctl._state[0].playerOffset).toBe(0);
  });

  it('does not double-count an intervention when a base-less global window first activates', () => {
    const ctl = new MovementController([{
      field: 'temperature', startStep: 1, endStep: 5,
      ops: [{ kind: 'trend', amp: -4, ease: false }],
    }], 58);
    const c = conds();
    c.temperature = 205; // visible 180 -> 205 action already applied
    expect(ctl.applyPlayerDelta('temperature', 1, 25)).toBeTruthy();
    ctl.applyStep(c, 1);
    expect(c.temperature).toBe(205); // 180 baseline + window-start 0 + 25 choice
    expect(ctl._state[0].base).toBe(180);
  });

  it('carries field authority into appended movements and an empty-controller rebuild', () => {
    const original = new MovementController([{
      field: 'temperature', startStep: 0, endStep: 20, base: 180,
    }], 58);
    expect(original.applyPlayerDelta('temperature', 1, 25)).toBeTruthy();
    original.addMovement({
      field: 'temperature', startStep: 1, endStep: 20,
      ops: [{ kind: 'trend', amp: 0 }],
    });
    expect(original._state[1].playerOffset).toBe(25);

    const rebuilt = new MovementController([], 58, original.playerOffsetsSnapshot());
    rebuilt.addMovement({ field: 'temperature', startStep: 1, endStep: 20 });
    expect(rebuilt._state[0].playerOffset).toBe(25);
    expect(rebuilt.applyPlayerDelta('temperature', 1, 5)).toMatchObject({
      offset_before: 25, offset_after: 30,
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 2c.1 — SPATIAL ORIGIN injection (origin:'cell'). A movement can pin ONE
// seeded fluid-spot cell's per-vertex mesh fluid (a fixed-composition feeder)
// instead of setting the bulk field; the step-end diffusion then carries it
// outward → a near→far gradient (one-sided growth). These pin the contract at
// the controller level (the engine's _injectCellField / _resolveOriginCell);
// the gradient-over-distance is proven empirically by
// tools/fluid-spot-origin-observe.mjs (acid pinned at the feeder, relaxing out).
// ---------------------------------------------------------------------------
describe("movements — controller: origin:'cell' spatial injection (Phase 2c.1)", () => {
  // A minimal mock mesh: n cells, each with an independent flat fluid (mirrors
  // the Tranche-4c per-cell clones the real WallMesh binds).
  const mockMesh = (n: number) =>
    ({ cells: Array.from({ length: n }, () => ({ fluid: { pH: 6.8, Eh: 200 } })) });
  // A mock sim exposing only what applyStep's cell path reads: the mesh handle
  // (wall_state.meshFor) and the seeded spot set (_fluidSpots).
  const mockSim = (mesh: any, spots: any[] | null) =>
    ({ wall_state: { meshFor: () => mesh }, _fluidSpots: spots ? new FluidSpotField(spots) : null });
  const cellSpec = (extra: any = {}) =>
    [{ field: 'fluid.pH', startStep: 0, endStep: 4, base: 6.8, ops: [{ kind: 'trend', amp: -3 }], origin: 'cell', ...extra }];

  it('pins ONLY the explicit origin cell; leaves bulk cells AND conditions untouched', () => {
    const mesh = mockMesh(6);
    const sim = mockSim(mesh, null);
    const ctl = new MovementController(cellSpec({ originCell: 2 }), 58);
    const c = conds();
    for (let s = 0; s < 4; s++) ctl.applyStep(c, s, sim);
    expect(mesh.cells[2].fluid.pH).toBeLessThan(6.8);  // origin acidified (feeder source)
    expect(mesh.cells[0].fluid.pH).toBe(6.8);          // neighbor untouched (diffusion is the sim's job)
    expect(mesh.cells[5].fluid.pH).toBe(6.8);          // far cell untouched
    expect(c.fluid.pH).toBe(6);                         // CONDITIONS untouched → global path NOT taken
    expect(c.temperature).toBe(200);                   // nothing else moved
  });

  it('resolves the origin to an OPEN fluid-spot when no explicit cell is given (pinned + cached)', () => {
    const mesh = mockMesh(10);
    const sim = mockSim(mesh, [
      { cell: 3, kind: 'crack', open: false, supply: 1, decayBonus: 1.6 },  // CLOSED — must be skipped
      { cell: 7, kind: 'geyser', open: true, supply: 1.8, decayBonus: 1.2 },
    ]);
    const ctl = new MovementController(cellSpec(), 58);
    const c = conds();
    for (let s = 0; s < 4; s++) ctl.applyStep(c, s, sim);
    expect(ctl._state[0].originCell).toBe(7);          // resolved to the OPEN spot, cached once
    expect(mesh.cells[7].fluid.pH).toBeLessThan(6.8);  // the feeder cell got pinned
    expect(mesh.cells[3].fluid.pH).toBe(6.8);          // the closed spot's cell is inert
    expect(c.fluid.pH).toBe(6);                         // conditions untouched
  });

  it('falls back to a valid wall cell when there are no open spots (still local, still no bulk write)', () => {
    const mesh = mockMesh(8);
    const sim = mockSim(mesh, []);                      // empty spot set
    const ctl = new MovementController(cellSpec(), 58);
    const c = conds();
    for (let s = 0; s < 4; s++) ctl.applyStep(c, s, sim);
    const oc = ctl._state[0].originCell;
    expect(oc).toBeGreaterThanOrEqual(0);
    expect(oc).toBeLessThan(8);                         // _pickOriginCell stayed in range
    expect(mesh.cells[oc].fluid.pH).toBeLessThan(6.8);  // some single cell got pinned
    expect(c.fluid.pH).toBe(6);                         // conditions still untouched
  });

  it("degrades to the GLOBAL path when no sim handle is passed (back-compat with 2-arg callers)", () => {
    const ctl = new MovementController(cellSpec(), 58);
    const c = conds();
    for (let s = 0; s < 4; s++) ctl.applyStep(c, s);   // legacy 2-arg call, sim undefined
    expect(c.fluid.pH).toBeLessThan(6.8);              // origin:'cell' safely fell back to setting conditions
  });

  it("a same-spec origin:'cell' movement is reproducible (resolved cell pinned from the seed)", () => {
    const resolve = (seed: number) => {
      const mesh = mockMesh(12);
      const sim = mockSim(mesh, [
        { cell: 2, kind: 'crack', open: true, supply: 1, decayBonus: 1.6 },
        { cell: 9, kind: 'hotspot', open: true, supply: 1.4, decayBonus: 1.3 },
      ]);
      const ctl = new MovementController(cellSpec(), seed);
      const c = conds();
      for (let s = 0; s < 4; s++) ctl.applyStep(c, s, sim);
      return ctl._state[0].originCell;
    };
    expect(resolve(58)).toBe(resolve(58));             // same cavity seed → same feeder
    expect([2, 9]).toContain(resolve(58));             // and it's one of the open spots
  });

  it("resolves to the most EQUATORIAL open feeder (Phase 2c.3 — halo coincides with cluster)", () => {
    // Two open feeders: one near-polar (ring 14, low area weight), one equatorial
    // (ring 7, area weight 1). The injected halo should land at the equatorial vent —
    // it delivers to the most wall AND is where crystals form, so the halo coincides
    // with the deposition cluster instead of a crystal-free polar feeder.
    const N = 10, R = 16;
    const mesh = mockMesh(N * R);
    const sim = {
      wall_state: {
        meshFor: () => mesh,
        cells_per_ring: N,
        ringAreaWeight: (r: number) => Math.sin(Math.PI * (r + 0.5) / R),
      },
      _fluidSpots: new FluidSpotField([
        { cell: 14 * N + 3, kind: 'hotspot', open: true, supply: 1.4, decayBonus: 1.3 }, // polar
        { cell: 7 * N + 5, kind: 'hotspot', open: true, supply: 1.4, decayBonus: 1.3 },  // equator
      ]),
    };
    const ctl = new MovementController(cellSpec(), 58);
    const c = conds();
    ctl.applyStep(c, 0, sim);
    expect(ctl._state[0].originCell).toBe(7 * N + 5);   // equatorial feeder wins
  });
});
