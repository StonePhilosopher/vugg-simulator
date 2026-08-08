import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

declare const THERMO_PRESSURE_GRID_DATA_SHA256: string;
declare function thermoPressureAssessment(mineral: string, temperatureC: number, pressureKbar: number): any;
declare function thermoPressureLogKCorrection(mineral: string, temperatureC: number, pressureKbar: number): number;
declare function getCarbonateLogKsp(mineral: string, temperatureC: number, mgContent?: number): number;
declare function getCarbonateLogKspAtPressure(mineral: string, temperatureC: number, pressureKbar: number, mgContent?: number): number;
declare function getSulfateLogKsp(mineral: string, temperatureC: number): number;
declare function getSulfateLogKspAtPressure(mineral: string, temperatureC: number, pressureKbar: number): number;
declare function carbonateSaturationIndex(mineral: string, fluid: any, temperatureC: number, mgContent?: number, pressureKbar?: number): number;
declare function sulfateSaturationIndex(mineral: string, fluid: any, temperatureC: number, pressureKbar?: number): number;
declare function evaluateCaSO4System(fluid: any, temperatureC: number, pressureKbar: number): any;
declare function _formationPressureChips(mineral: string, conditions: any): any[];
declare const FluidChemistry: any;

function canonicalJson(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

describe('SUPCRTBL pressure-grid artifact', () => {
  it('matches the versioned generated-data digest', () => {
    const artifact = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'data', 'generated', 'thermo-pressure-grid.json'),
      'utf8',
    ));
    const digest = createHash('sha256').update(canonicalJson(artifact.payload)).digest('hex');
    expect(digest).toBe(artifact.data_sha256);
    expect(THERMO_PRESSURE_GRID_DATA_SHA256).toBe(artifact.data_sha256);
    expect(Object.keys(artifact.payload.reactions)).toEqual([
      'calcite', 'aragonite', 'dolomite', 'siderite', 'rhodochrosite',
      'anhydrite', 'barite', 'celestine',
    ]);
  });

  it('reproduces reaction-specific SUPCRTBL pressure shifts rather than a universal multiplier', () => {
    const calcite = thermoPressureAssessment('calcite', 25, 4.4);
    const dolomite = thermoPressureAssessment('dolomite', 25, 4.4);
    const barite = thermoPressureAssessment('barite', 25, 4.4);
    expect(calcite).toMatchObject({ active: true, status: 'active', supported: true });
    expect(calcite.waterDensityGcm3).toBeCloseTo(1.13599, 4);
    expect(calcite.correctionLog10K).toBeCloseTo(3.3476, 3);
    expect(dolomite.correctionLog10K).toBeCloseTo(6.1699, 3);
    expect(barite.correctionLog10K).toBeCloseTo(2.6457, 3);
    expect(new Set([
      calcite.correctionLog10K.toFixed(3),
      dolomite.correctionLog10K.toFixed(3),
      barite.correctionLog10K.toFixed(3),
    ]).size).toBe(3);
  });

  it('interpolates only inside the grid and each promoted reaction envelope', () => {
    const p1 = thermoPressureLogKCorrection('calcite', 25, 1);
    const p2 = thermoPressureLogKCorrection('calcite', 25, 2);
    const midway = thermoPressureLogKCorrection('calcite', 25, 1.5);
    expect(midway).toBeCloseTo((p1 + p2) / 2, 8);
    expect(thermoPressureAssessment('calcite', 100, 4.4)).toMatchObject({
      active: false,
      status: 'outside-temperature-envelope',
      correctionLog10K: 0,
    });
    expect(thermoPressureAssessment('barite', 25, 9)).toMatchObject({
      active: false,
      status: 'outside-pressure-grid',
      correctionLog10K: 0,
    });
  });

  it('fails closed for absent and mixed endmembers', () => {
    expect(thermoPressureAssessment('selenite', 25, 4.4)).toMatchObject({
      supported: false,
      active: false,
      status: 'unsupported-reaction',
    });
    expect(thermoPressureAssessment('HMC', 25, 4.4).note).toContain('solid solution');
    expect(thermoPressureLogKCorrection('smithsonite', 25, 4.4)).toBe(0);
    expect(thermoPressureAssessment('quartz', 25, 4.4).status).toBe('not-tabulated');
  });
});

describe('pressure correction consumers', () => {
  const carbonateFluid = () => new FluidChemistry({
    Ca: 900, Mg: 700, Fe: 100, Mn: 100, CO3: 1200,
    Na: 20, Cl: 30, pH: 8, salinity: 1, O2: 0.1,
  });
  const sulfateFluid = () => new FluidChemistry({
    Ca: 1200, Ba: 100, Sr: 100, S: 1200,
    Na: 20, Cl: 30, pH: 7, salinity: 1, O2: 1,
  });

  it('adds delta-logK to the existing 1-bar Ksp calibration', () => {
    expect(getCarbonateLogKspAtPressure('calcite', 25, 4.4)
      - getCarbonateLogKsp('calcite', 25)).toBeCloseTo(3.3476, 3);
    expect(getSulfateLogKspAtPressure('barite', 25, 4.4)
      - getSulfateLogKsp('barite', 25)).toBeCloseTo(2.6457, 3);
  });

  it('lowers carbonate and supported sulfate SI by the exact Ksp shift', () => {
    const carbonate = carbonateFluid();
    const calciteAt1Bar = carbonateSaturationIndex('calcite', carbonate, 25, 0, 0.001);
    const calciteDeep = carbonateSaturationIndex('calcite', carbonate, 25, 0, 4.4);
    expect(calciteAt1Bar - calciteDeep).toBeCloseTo(3.3476, 3);

    const sulfate = sulfateFluid();
    const bariteAt1Bar = sulfateSaturationIndex('barite', sulfate, 25, 0.001);
    const bariteDeep = sulfateSaturationIndex('barite', sulfate, 25, 4.4);
    expect(bariteAt1Bar - bariteDeep).toBeCloseTo(2.6457, 3);
    // Gypsum remains explicitly uncorrected because its solid is absent from
    // the selected SUPCRTBL database; the independent phase boundary still
    // consumes pressure in evaluateCaSO4System.
    expect(sulfateSaturationIndex('selenite', sulfate, 25, 4.4))
      .toBeCloseTo(sulfateSaturationIndex('selenite', sulfate, 25, 0.001), 10);
  });

  it('threads pressure through the authoritative CaSO4 evaluator', () => {
    const sulfate = sulfateFluid();
    const shallow = evaluateCaSO4System(sulfate, 120, 0.001);
    const deep = evaluateCaSO4System(sulfate, 120, 4.4);
    expect(shallow.anhydriteSI - deep.anhydriteSI)
      .toBeCloseTo(thermoPressureLogKCorrection('anhydrite', 120, 4.4), 8);
    expect(deep.phase.boundaryC).toBeGreaterThan(shallow.phase.boundaryC);
  });

  it('surfaces both active and unsupported pressure science in Creative diagnosis', () => {
    const calciteChips = _formationPressureChips('calcite', {
      temperature: 25, pressure: 4.4, fluid: carbonateFluid(),
    });
    expect(calciteChips.some(chip => chip.text.includes('Ksp ΔlogK +3.348'))).toBe(true);
    expect(calciteChips.some(chip => chip.note.includes('no constant reaction-volume shortcut'))).toBe(true);

    const gypsumChips = _formationPressureChips('selenite', {
      temperature: 25, pressure: 4.4, fluid: sulfateFluid(),
    });
    expect(gypsumChips.some(chip => chip.text.includes('no exact Ksp pressure grid'))).toBe(true);
    expect(gypsumChips.some(chip => chip.text.includes('CaSO4 field'))).toBe(true);
  });
});
