import { describe, expect, it } from 'vitest';

declare function clampFluidPressureKbar(value: number): number;
declare function calciteAragoniteBoundaryKbar(temperatureC: number): number;
declare function aragoniteIsPressureStable(temperatureC: number, pressureKbar: number): boolean;
declare function al2sio5StablePolymorph(temperatureC: number, pressureKbar: number | null): string;
declare function al2sio5PhaseAssessment(temperatureC: number, pressureKbar: number | null): any;
declare function gypsumAnhydriteBoundaryC(pressureKbar: number): number;
declare function apophyllitePressureFactor(pressureKbar: number): number;
declare function quartzWaterDensityGcm3(temperatureC: number, pressureKbar: number): number | null;
declare function manningQuartzSolubilityPpm(temperatureC: number, pressureKbar: number): number | null;
declare function quartzPressureSolubilityAssessment(temperatureC: number, pressureKbar: number): any;
declare function applyDifferentialStressPulse(sim: any, stressMpa: number): any;
declare function _movementSetField(conditions: any, path: string, value: number): void;
declare const EVENT_REGISTRY: Record<string, (conditions: any) => string>;
declare const VugConditions: any;
declare const VugWall: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const StripRecorder: any;
declare const Crystal: any;
declare function setSeed(seed: number): void;

describe('pressure science primitives', () => {
  it('keeps fluid pressure inside the researched model envelope', () => {
    expect(clampFluidPressureKbar(-10)).toBe(0.001);
    expect(clampFluidPressureKbar(2.25)).toBe(2.25);
    expect(clampFluidPressureKbar(99)).toBe(4.4);
    expect(new VugConditions({ pressure: -10 }).pressure).toBe(0.001);
    expect(new VugConditions({ pressure: 99 }).pressure).toBe(4.4);
    const moving = { pressure: 1.5 };
    _movementSetField(moving, 'pressure', 9);
    expect(moving.pressure).toBe(4.4);
    _movementSetField(moving, 'pressure', -2);
    expect(moving.pressure).toBe(0.001);
  });

  it('selects the deep/cold aragonite field without disturbing shallow Mg kinetics', () => {
    expect(calciteAragoniteBoundaryKbar(25)).toBeCloseTo(2.98889054, 7);
    expect(calciteAragoniteBoundaryKbar(158)).toBeCloseTo(2.43018414, 7);
    expect(calciteAragoniteBoundaryKbar(200)).toBeCloseTo(2.43015054, 7);
    expect(calciteAragoniteBoundaryKbar(300)).toBeCloseTo(2.77087054, 7);
    expect(aragoniteIsPressureStable(100, 4.4)).toBe(true);
    expect(aragoniteIsPressureStable(200, 4.4)).toBe(true);
    expect(aragoniteIsPressureStable(400, 4.4)).toBe(false);
    expect(aragoniteIsPressureStable(25, 2.9)).toBe(false);
  });

  it('routes Al2SiO5 with rock pressure and preserves experimental uncertainty', () => {
    const probes: Array<[number, number, string]> = [
      [480, 4.4, 'kyanite'],
      [545, 4.4, 'uncertain'],
      [600, 4.4, 'uncertain'],
      [575, 1.0, 'andalusite'],
      [700, 2.0, 'uncertain'],
      [150, 0.5, 'unconstrained'],
    ];
    for (const [temperature, pressure, expected] of probes) {
      expect(al2sio5StablePolymorph(temperature, pressure), `${temperature}°C / ${pressure} kbar`).toBe(expected);
    }
    expect(al2sio5StablePolymorph(650, 4.4)).toBe('sillimanite');
    expect(al2sio5StablePolymorph(600, null)).toBe('unconstrained');
    expect(al2sio5PhaseAssessment(700, 2.0).nominalPhase).toBe('andalusite');
  });

  it('does not let cavity-fluid pressure move the metamorphic phase field', () => {
    const wall = new VugWall({ confining_pressure_kbar: 1.5 });
    const fluid = new FluidChemistry({
      Al: 45, SiO2: 350, Na: 10, K: 15, B: 0, pH: 6.5, salinity: 1,
    });
    const conditions = new VugConditions({ temperature: 650, pressure: 0.1, wall, fluid });
    const lowFluidPressureSigma = conditions.supersaturation_andalusite();
    conditions.pressure = 4.4;
    expect(conditions.supersaturation_andalusite()).toBeCloseTo(lowFluidPressureSigma, 12);
    expect(lowFluidPressureSigma).toBeGreaterThan(0);
    wall.confining_pressure_kbar = 4.4;
    expect(conditions.supersaturation_andalusite()).toBe(0);
  });

  it('follows the cited Grimsel D1-to-D3 unloading path instead of pinning peak pressure', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.grimsel_alpine_cleft();
    const sim = new VugSimulator(conditions, events);
    expect(sim.conditions.pressure).toBeCloseTo(4.4, 8);
    expect(sim.conditions.wall.confining_pressure_kbar).toBeCloseTo(4.4, 8);
    for (let i = 0; i < defaultSteps; i++) sim.run_step();
    expect(sim.conditions.pressure).toBeCloseTo(2.3, 2);
    expect(sim.conditions.wall.confining_pressure_kbar).toBeCloseTo(2.3, 2);
    expect(sim.crystals.some((c: any) => c.mineral === 'aragonite')).toBe(false);
    expect(sim.crystals.length).toBeGreaterThan(0);
    expect(sim.crystals.every((c: any) => Number.isFinite(c._stress_orientation_unit))).toBe(true);
  });

  it('reports the pure-water gypsum/anhydrite equilibrium line without replacing kinetics', () => {
    expect(gypsumAnhydriteBoundaryC(0.01)).toBeCloseTo(58.147, 3);
    // The research packet and implementation agree on the direct arithmetic.
    expect(gypsumAnhydriteBoundaryC(4.4)).toBeCloseTo(122.68, 2);
  });

  it('replaces apophyllite’s unsupported hard cutoff with a nonzero soft weighting', () => {
    expect(apophyllitePressureFactor(0.05)).toBe(1);
    expect(apophyllitePressureFactor(1.5)).toBe(1);
    expect(apophyllitePressureFactor(2.0)).toBeLessThan(1);
    expect(apophyllitePressureFactor(2.0)).toBeGreaterThan(0);
    expect(apophyllitePressureFactor(4.4)).toBeGreaterThan(0);
  });

  it('uses the commissioned IAPWS/Manning pressure observable for deep quartz', () => {
    expect(quartzWaterDensityGcm3(300, 0.5)).toBeCloseTo(0.77648, 5);
    expect(quartzWaterDensityGcm3(300, 4.4)).toBeCloseTo(0.97761, 5);
    expect(quartzWaterDensityGcm3(450, 0.5)).toBeCloseTo(0.40204, 5);
    expect(quartzWaterDensityGcm3(450, 4.4)).toBeCloseTo(0.87877, 5);
    expect(manningQuartzSolubilityPpm(300, 0.5)).toBeCloseTo(727, -1);
    expect(manningQuartzSolubilityPpm(300, 4.4)).toBeCloseTo(1199, -1);
    expect(manningQuartzSolubilityPpm(450, 0.5)).toBeCloseTo(931, -1);
    expect(manningQuartzSolubilityPpm(450, 4.4)).toBeCloseTo(4945, -1);
    expect(quartzPressureSolubilityAssessment(450, 4.4).pressureFactor).toBeGreaterThan(5);

    const deep = new VugConditions({
      temperature: 450, pressure: 4.4,
      fluid: new FluidChemistry({ SiO2: 2000, pH: 7 }),
    });
    const shallow = new VugConditions({
      temperature: 450, pressure: 0.5,
      fluid: new FluidChemistry({ SiO2: 2000, pH: 7 }),
    });
    expect(deep.supersaturation_quartz()).toBe(0);
    expect(shallow.supersaturation_quartz()).toBeGreaterThan(1);
  });

  it('does not masquerade a 0.50-kbar boundary value as shallow-fluid science', () => {
    expect(quartzWaterDensityGcm3(350, 0.05)).toBeNull();
    expect(manningQuartzSolubilityPpm(350, 0.05)).toBeNull();
    const assessment = quartzPressureSolubilityAssessment(350, 0.05);
    expect(assessment).toMatchObject({
      active: false,
      equilibriumPpm: null,
      waterDensityGcm3: null,
      pressureClampedLow: true,
      status: 'outside-pressure-grid',
    });
    expect(assessment.note).toContain('reference-only');

    const shallow = new VugConditions({
      temperature: 350, pressure: 0.05,
      fluid: new FluidChemistry({ SiO2: 1200, pH: 7 }),
    });
    // The declared legacy temperature relation is 1000 ppm at 350 C.
    expect(shallow.silica_equilibrium(350)).toBe(1000);
  });
});

describe('differential stress is not fluid pressure', () => {
  const crystals = (mineral: string, start: number) => Array.from({ length: 64 }, (_, i) => ({
    mineral,
    crystal_id: start + i,
    twinned: false,
    total_growth_um: 100,
    zones: [{}, {}, {}],
  }));

  it('mechanically twins only minerals with measured CRSS and leaves fluid pressure unchanged', () => {
    const sim = {
      step: 12,
      conditions: { pressure: 2.25, temperature: 180, wall: { shape_seed: 77 } },
      crystals: [
        ...crystals('calcite', 0),
        ...crystals('dolomite', 100),
        ...crystals('quartz', 200),
      ],
    };
    const result = applyDifferentialStressPulse(sim, 500);

    expect(sim.conditions.pressure).toBe(2.25);
    expect(result.timescale).toBe('instantaneous threshold evaluation');
    expect(result.duration_steps).toBeUndefined();
    expect(sim.crystals.some((c: any) => c.mineral === 'calcite' && c._mechanical_twinned)).toBe(true);
    expect(sim.crystals.some((c: any) => c.mineral === 'dolomite' && c._mechanical_twinned)).toBe(true);
    expect(sim.crystals.some((c: any) => c.mineral === 'quartz' && c._mechanical_twinned)).toBe(false);
    const calcite = sim.crystals.find((c: any) => c.mineral === 'calcite' && c._mechanical_twinned);
    const dolomite = sim.crystals.find((c: any) => c.mineral === 'dolomite' && c._mechanical_twinned);
    expect(calcite.twinned).toBe(false);
    expect(calcite._deformation).toMatchObject({ kind: 'etwin', atStep: 12 });
    expect(calcite._twin_density_per_mm).toBeCloseTo((500 / 19.5) ** 2, 8);
    expect(dolomite._twin_density_per_mm).toBeUndefined();
  });

  it('keeps a 50 MPa pulse below dolomite CRSS for every orientation', () => {
    const sim = {
      step: 4,
      conditions: { pressure: 1.4, temperature: 120, wall: { shape_seed: 9 } },
      crystals: crystals('dolomite', 0),
    };
    applyDifferentialStressPulse(sim, 50);
    expect(sim.crystals.every((c: any) => !c._mechanical_twinned)).toBe(true);
    expect(sim.conditions.pressure).toBe(1.4);
  });

  it('keeps grain orientation stable across clock time without a zone-count gate', () => {
    const makeSim = (step: number, zones: any[]) => ({
      step,
      conditions: { pressure: 1.4, temperature: 120, wall: { shape_seed: 91 } },
      crystals: Array.from({ length: 32 }, (_, i) => ({
        mineral: 'calcite', crystal_id: i, zones: [...zones], twinned: false,
        total_growth_um: 100,
      })),
    });
    const early = makeSim(2, [{}]);
    const late = makeSim(202, [{}, {}, {}, {}]);
    applyDifferentialStressPulse(early, 100);
    applyDifferentialStressPulse(late, 100);
    expect(early.crystals.map((c: any) => c._resolved_shear_mpa ?? null))
      .toEqual(late.crystals.map((c: any) => c._resolved_shear_mpa ?? null));
    expect(early.crystals.some((c: any) => c._mechanical_twinned)).toBe(true);
    expect(early._stressEvents[0].evaluated_crystals).toHaveLength(32);
  });

  it('turns tectonic shock into a transient stress request, not a pressure spike', () => {
    const conditions: any = { pressure: 3.2, temperature: 220 };
    const message = EVENT_REGISTRY.tectonic_shock(conditions);
    expect(conditions.pressure).toBe(3.2);
    expect(conditions.temperature).toBe(235);
    expect(conditions._pending_stress_pulse).toEqual({ sigma_diff_mpa: 50 });
    expect(message).toContain('fluid pressure does not rise');
  });

  it('archives executed pressure/phase series and stress outcomes instead of reconstructing claims', () => {
    setSeed(4242);
    const { conditions, events } = SCENARIOS.mvt();
    const sim = new VugSimulator(conditions, events);
    const recorder = new StripRecorder(sim, { duration_steps: 2, angular_indices: 1 });
    sim._stripRecorder = recorder;
    sim.run_step();

    const witness = new Crystal({
      mineral: 'calcite', crystal_id: 99001, nucleation_step: -1,
      wall_anchor: { ringIdx: 0, cellIdx: 0, phi: 0, theta: 0 },
    });
    witness.total_growth_um = 100;
    witness.zones = [{}];
    sim.crystals.push(witness);
    applyDifferentialStressPulse(sim, 500);
    witness.paramorph_origin = 'pharmacolite';
    witness.mineral = 'haidingerite';
    witness.paramorph_step = sim.step;
    witness.dehydration_driver = 'test dry-exposure dehydration';
    sim.run_step();

    const dataset = recorder.finalize();
    expect(dataset.pressure_phase_testimony).toHaveLength(2);
    expect(dataset.pressure_phase_testimony[0]).toMatchObject({
      step: 0,
      fluid_pressure_kbar: expect.any(Number),
      confining_pressure_kbar: expect.any(Number),
      calcite_aragonite: {
        boundary_kbar: expect.any(Number),
        secure_aragonite: expect.any(Boolean),
      },
      al2sio5: expect.any(Object),
      gypsum_anhydrite: { pure_water_boundary_C: expect.any(Number) },
    });
    expect(dataset.stress_event_testimony).toHaveLength(1);
    expect(dataset.stress_event_testimony[0].event_id).toMatch(/^stress-/);
    expect(dataset.stress_event_testimony[0].evaluated_crystals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          crystal_id: 99001,
          mineral: 'calcite',
          outcome: expect.stringMatching(/twinned|below_crss/),
        }),
      ]),
    );
    expect(dataset.transformation_event_testimony).toEqual([
      expect.objectContaining({
        crystal_id: 99001,
        from: 'pharmacolite',
        to: 'haidingerite',
        mechanism: 'test dry-exposure dehydration',
      }),
    ]);
  });
});
