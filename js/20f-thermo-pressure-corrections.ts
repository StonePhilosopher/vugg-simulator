// ============================================================
// js/20f-thermo-pressure-corrections.ts
// Reaction-specific carbonate/sulfate pressure corrections
// ============================================================
// The numeric grid is generated offline by tools/gen-thermo-pressure-grid.py
// from Reaktoro 2.13.0 + SUPCRTBL.  It contains delta-log10(K) relative to
// 1 bar at the same temperature, so the game's existing evidence-backed
// Ksp(T) curves remain the reference calibration.  Runtime interpolation is
// bounded: no pressure or temperature extrapolation, no interpolation across
// a water-density mask, and no proxy reaction for an absent solid species.

type ThermoPressureStatus =
  | 'active'
  | 'reference-pressure'
  | 'outside-temperature-envelope'
  | 'outside-pressure-grid'
  | 'masked-low-density'
  | 'unsupported-reaction'
  | 'not-tabulated'
  | 'invalid-input';

type ThermoPressureAssessment = {
  mineral: string;
  supported: boolean;
  active: boolean;
  status: ThermoPressureStatus;
  temperatureC: number;
  fluidPressureKbar: number;
  correctionLog10K: number;
  waterDensityGcm3: number | null;
  reaction: string | null;
  usableTemperatureC: readonly [number, number] | null;
  sourceModel: string;
  note: string;
};

type _ThermoGridBracket = { lo: number; hi: number; fraction: number };

function _thermoGridBracket(axis: readonly number[], value: number): _ThermoGridBracket | null {
  if (!Number.isFinite(value) || value < axis[0] || value > axis[axis.length - 1]) return null;
  for (let i = 0; i < axis.length; i++) {
    if (value === axis[i]) return { lo: i, hi: i, fraction: 0 };
    if (i < axis.length - 1 && value > axis[i] && value < axis[i + 1]) {
      return {
        lo: i,
        hi: i + 1,
        fraction: (value - axis[i]) / (axis[i + 1] - axis[i]),
      };
    }
  }
  return null;
}

function _thermoGridBilinear(
  rows: readonly (readonly (number | null)[])[],
  temperatureBracket: _ThermoGridBracket,
  pressureBracket: _ThermoGridBracket,
): number | null {
  const { lo: t0, hi: t1, fraction: ft } = temperatureBracket;
  const { lo: p0, hi: p1, fraction: fp } = pressureBracket;
  const q00 = rows[t0]?.[p0];
  const q01 = rows[t0]?.[p1];
  const q10 = rows[t1]?.[p0];
  const q11 = rows[t1]?.[p1];
  if (![q00, q01, q10, q11].every(value => typeof value === 'number' && Number.isFinite(value))) {
    return null;
  }
  const low = (q00 as number) + fp * ((q01 as number) - (q00 as number));
  const high = (q10 as number) + fp * ((q11 as number) - (q10 as number));
  return low + ft * (high - low);
}

function thermoPressureAssessment(
  mineralId: string,
  temperatureC: number,
  fluidPressureKbar: number,
): ThermoPressureAssessment {
  const mineral = mineralId === 'gypsum' ? 'selenite' : mineralId;
  const temperature = Number(temperatureC);
  const pressure = Number(fluidPressureKbar);
  const grid = THERMO_PRESSURE_GRID;
  const sourceModel = grid.model_id;
  const reaction = (grid.reactions as any)[mineral] || null;
  const unsupported = (grid.unsupported as any)[mineral] || null;
  const base = {
    mineral,
    temperatureC: temperature,
    fluidPressureKbar: pressure,
    correctionLog10K: 0,
    waterDensityGcm3: null,
    sourceModel,
  };

  if (!Number.isFinite(temperature) || !Number.isFinite(pressure)) {
    return {
      ...base, supported: !!reaction, active: false, status: 'invalid-input',
      reaction: reaction?.equation || null,
      usableTemperatureC: reaction?.usable_temperature_C || null,
      note: 'Temperature and fluid pressure must both be finite.',
    };
  }
  if (!reaction) {
    return {
      ...base, supported: false, active: false,
      status: unsupported ? 'unsupported-reaction' : 'not-tabulated',
      reaction: null, usableTemperatureC: null,
      note: unsupported || 'No exact reaction-specific SUPCRTBL pressure grid is tabulated for this mineral.',
    };
  }

  const usable = reaction.usable_temperature_C as readonly [number, number];
  if (temperature < usable[0] || temperature > usable[1]) {
    return {
      ...base, supported: true, active: false, status: 'outside-temperature-envelope',
      reaction: reaction.equation, usableTemperatureC: usable,
      note: `Pressure correction inactive outside this reaction's ${usable[0]}-${usable[1]} C promoted Ksp(T) envelope; no extrapolation.`,
    };
  }
  const tb = _thermoGridBracket(grid.temperature_axis_C, temperature);
  const pb = _thermoGridBracket(grid.pressure_axis_kbar, pressure);
  if (!pb) {
    return {
      ...base, supported: true, active: false, status: 'outside-pressure-grid',
      reaction: reaction.equation, usableTemperatureC: usable,
      note: `Pressure correction inactive outside the ${grid.pressure_axis_kbar[0]}-${grid.pressure_axis_kbar[grid.pressure_axis_kbar.length - 1]} kbar SUPCRTBL grid; no extrapolation.`,
    };
  }
  if (!tb) {
    return {
      ...base, supported: true, active: false, status: 'outside-temperature-envelope',
      reaction: reaction.equation, usableTemperatureC: usable,
      note: 'Temperature is outside the generated SUPCRTBL grid; no extrapolation.',
    };
  }

  const density = _thermoGridBilinear(grid.water_density_g_cm3, tb, pb);
  const correction = _thermoGridBilinear(reaction.delta_log10_K_from_1bar, tb, pb);
  if (density == null || correction == null) {
    return {
      ...base, supported: true, active: false, status: 'masked-low-density',
      reaction: reaction.equation, usableTemperatureC: usable,
      note: `Grid cell crosses a water-density value below ${grid.validity.water_density_min_g_cm3} g/cm3; pressure correction is masked rather than interpolated through the near-critical low-density region.`,
    };
  }

  const atReference = Math.abs(pressure - grid.reference_pressure_kbar) < 1e-12;
  return {
    ...base,
    supported: true,
    active: true,
    status: atReference ? 'reference-pressure' : 'active',
    correctionLog10K: correction,
    waterDensityGcm3: density,
    reaction: reaction.equation,
    usableTemperatureC: usable,
    note: atReference
      ? 'At the 1-bar reference pressure; the generated pressure correction is zero.'
      : `SUPCRTBL reaction grid with bilinear interpolation; log10(Ksp) shifts by ${correction >= 0 ? '+' : ''}${correction.toFixed(3)} relative to 1 bar at the same temperature.`,
  };
}

function thermoPressureLogKCorrection(
  mineralId: string,
  temperatureC: number,
  fluidPressureKbar: number,
): number {
  const assessment = thermoPressureAssessment(mineralId, temperatureC, fluidPressureKbar);
  return assessment.active ? assessment.correctionLog10K : 0;
}

function getCarbonateLogKspAtPressure(
  mineralId: string,
  temperatureC: number,
  fluidPressureKbar: number,
  mgContent = 0,
): number {
  const base = getCarbonateLogKsp(mineralId, temperatureC, mgContent);
  if (!Number.isFinite(base)) return NaN;
  return base + thermoPressureLogKCorrection(mineralId, temperatureC, fluidPressureKbar);
}

function getSulfateLogKspAtPressure(
  mineralId: string,
  temperatureC: number,
  fluidPressureKbar: number,
): number {
  const canonical = mineralId === 'gypsum' ? 'selenite' : mineralId;
  const base = getSulfateLogKsp(canonical, temperatureC);
  if (!Number.isFinite(base)) return NaN;
  return base + thermoPressureLogKCorrection(canonical, temperatureC, fluidPressureKbar);
}
