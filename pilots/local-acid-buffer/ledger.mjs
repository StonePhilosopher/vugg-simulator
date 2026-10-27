// Isolated experiment. No imports from, or exports to, the shipped simulator.
export const WATER_KG_PER_MOL = 0.01801528;
export const COMPONENTS = ['Ca', 'C', 'FeII', 'sulfate', 'O2', 'Na', 'Cl', 'alkalinity'];
export const TOL = 2e-11; // mol (eq for alkalinity), independent of pH
const copy = x => structuredClone(x);
const nonnegative = (x, name) => {
  if (!Number.isFinite(x) || x < 0) throw new Error(`Invalid ${name}`);
  return x;
};

export function assertCell(c) {
  if (!c || typeof c.id !== 'string' || !/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(c.id)
    || !(c.waterKg > 0) || !Number.isFinite(c.waterKg)) throw new Error('Invalid cell/water');
  for (const k of COMPONENTS) {
    if (!Number.isFinite(c.aqueous[k]) || (k !== 'alkalinity' && c.aqueous[k] < 0)) throw new Error(`Invalid aqueous ${k}`);
  }
  for (const k of ['pyrite', 'calcite', 'ferricHydroxide']) nonnegative(c.solid[k], k);
  for (const k of ['pyriteOxidized', 'ferrousOxidized', 'calciteDissolved', 'acidProduced', 'O2Consumed', 'waterConsumed', 'carbonFromGas']) {
    if (!Number.isFinite(c.ledger[k]) || (k !== 'carbonFromGas' && c.ledger[k] < 0)) throw new Error(`Invalid ledger ${k}`);
  }
  // Charge reference: Ca2+, Fe2+, Na+, Cl-, SO4(2-). Carbon and water
  // speciation/hydrolysis are solved downstream; pH is never an input here.
  const a = c.aqueous;
  if (Math.abs(a.alkalinity - (2*a.Ca + 2*a.FeII + a.Na - a.Cl - 2*a.sulfate)) > TOL) {
    throw new Error('Alkalinity/component charge-reference mismatch');
  }
  const l = c.ledger;
  for (const [key, expected] of Object.entries({acidProduced: 2*l.pyriteOxidized + 2*l.ferrousOxidized,
    O2Consumed: 3.5*l.pyriteOxidized + 0.25*l.ferrousOxidized,
    waterConsumed: l.pyriteOxidized + 2.5*l.ferrousOxidized})) {
    if (Math.abs(l[key] - expected) > TOL) throw new Error(`Reaction ledger mismatch: ${key}`);
  }
  return c;
}

export function cell({id, waterKg = 1, pyrite = 0, calcite = 0, aqueous = {}}) {
  return assertCell({id, waterKg, aqueous: {Ca: 0, C: 0, FeII: 0, sulfate: 0, O2: 0, Na: 0, Cl: 0,
    alkalinity: 0, ...aqueous}, solid: {pyrite, calcite, ferricHydroxide: 0},
    ledger: {pyriteOxidized: 0, ferrousOxidized: 0, calciteDissolved: 0, acidProduced: 0,
      O2Consumed: 0, waterConsumed: 0, carbonFromGas: 0}});
}

function spendWater(c, mol) {
  // Retain a finite positive solvent inventory. This is net pathway water,
  // not a claim to solve the complete H/O isotope/solvation inventory.
  c.waterKg -= mol * WATER_KG_PER_MOL;
  c.ledger.waterConsumed += mol;
}

export function oxidizePyrite(input, requestedMol) {
  assertCell(input); nonnegative(requestedMol, 'requested oxidation');
  const c = copy(input);
  // FeS2 + 3.5 O2 + H2O -> Fe2+ + 2 SO4(2-) + 2 H+.
  const accepted = Math.min(requestedMol, c.solid.pyrite, c.aqueous.O2/3.5,
    c.waterKg/WATER_KG_PER_MOL * (1 - 1e-9));
  c.solid.pyrite -= accepted;
  c.aqueous.FeII += accepted;
  c.aqueous.sulfate += 2*accepted;
  c.aqueous.O2 = Math.max(0, c.aqueous.O2 - 3.5*accepted);
  c.aqueous.alkalinity -= 2*accepted;
  c.ledger.pyriteOxidized += accepted;
  c.ledger.acidProduced += 2*accepted;
  c.ledger.O2Consumed += 3.5*accepted;
  spendWater(c, accepted);
  return {cell: assertCell(c), acceptedMol: accepted, requestedMol};
}

export function oxidizeFerrous(input, requestedMol) {
  assertCell(input); nonnegative(requestedMol, 'requested ferrous oxidation');
  const c = copy(input);
  // Fe2+ + 0.25 O2 + 2.5 H2O -> Fe(OH)3(s) + 2 H+.
  // A prescribed endpoint, not a prediction of phase/rate/passivation.
  const accepted = Math.min(requestedMol, c.aqueous.FeII, c.aqueous.O2/0.25,
    c.waterKg/(2.5*WATER_KG_PER_MOL) * (1 - 1e-9));
  c.aqueous.FeII -= accepted;
  c.aqueous.O2 = Math.max(0, c.aqueous.O2 - 0.25*accepted);
  c.solid.ferricHydroxide += accepted;
  c.aqueous.alkalinity -= 2*accepted;
  c.ledger.ferrousOxidized += accepted;
  c.ledger.acidProduced += 2*accepted;
  c.ledger.O2Consumed += 0.25*accepted;
  spendWater(c, 2.5*accepted);
  return {cell: assertCell(c), acceptedMol: accepted, requestedMol};
}

export function dissolveCalcite(input, acceptedMol) {
  assertCell(input); nonnegative(acceptedMol, 'calcite dissolution');
  if (acceptedMol > input.solid.calcite) throw new Error('Calcite inventory exceeded');
  const c = copy(input);
  c.solid.calcite -= acceptedMol;
  c.aqueous.Ca += acceptedMol;
  c.aqueous.C += acceptedMol;
  c.aqueous.alkalinity += 2*acceptedMol;
  c.ledger.calciteDissolved += acceptedMol;
  return assertCell(c);
}

export function exchangeWater(left, right, fraction) {
  assertCell(left); assertCell(right);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 0.5) throw new Error('Exchange fraction must be in [0, 0.5]');
  const a = copy(left), b = copy(right);
  // Exchange the same mass of solvent both ways, at donor molalities.
  // This is an authored two-reservoir operator, not a calibrated D or dt.
  const kg = fraction * Math.min(a.waterKg, b.waterKg);
  const transferred = {};
  for (const k of COMPONENTS) {
    const delta = kg * (left.aqueous[k]/left.waterKg - right.aqueous[k]/right.waterKg);
    a.aqueous[k] -= delta;
    b.aqueous[k] += delta;
    transferred[k] = delta; // signed A -> B, mol or eq
  }
  return {cells: [assertCell(a), assertCell(b)], exchangedWaterKg: kg, transferred};
}

export function applyGasCarbon(input, carbonMol) {
  assertCell(input); nonnegative(carbonMol, 'aqueous carbon');
  const c = copy(input), delta = carbonMol - c.aqueous.C;
  c.aqueous.C = carbonMol;
  c.ledger.carbonFromGas += delta;
  return assertCell(c);
}

export function inventory(cells) {
  const total = {Fe: 0, S: 0, Ca: 0, C: 0, Na: 0, Cl: 0, O2: 0, waterKg: 0, alkalinity: 0};
  for (const c of cells) {
    assertCell(c);
    const a = c.aqueous, s = c.solid, l = c.ledger;
    total.Fe += a.FeII + s.pyrite + s.ferricHydroxide;
    total.S += a.sulfate + 2*s.pyrite;
    total.Ca += a.Ca + s.calcite;
    total.C += a.C + s.calcite - l.carbonFromGas;
    total.Na += a.Na; total.Cl += a.Cl;
    total.O2 += a.O2 + l.O2Consumed;
    total.waterKg += c.waterKg + l.waterConsumed*WATER_KG_PER_MOL;
    // Conserved acid-base bookkeeping, not conservation of free H+ or pH.
    total.alkalinity += a.alkalinity + l.acidProduced - 2*l.calciteDissolved;
  }
  return total;
}

export function assertConserved(before, cells) {
  const after = inventory(cells), residual = {};
  if (!before || Object.keys(before).length !== Object.keys(after).length) throw new Error('Incomplete initial inventory');
  for (const k of Object.keys(after)) {
    if (!Number.isFinite(before[k])) throw new Error(`Invalid initial ${k}`);
    residual[k] = after[k] - before[k];
    if (Math.abs(residual[k]) > TOL) throw new Error(`Nonconserved ${k}: ${residual[k]}`);
  }
  return residual;
}

export const REACTIONS = {
  pyriteToFerrous: {FeS2: -1, O2: -3.5, H2O: -1, 'Fe2+': 1, 'SO4--': 2, 'H+': 2},
  ferrousToHydroxide: {'Fe2+': -1, O2: -0.25, H2O: -2.5, 'Fe(OH)3': 1, 'H+': 2},
  calciteDissolution: {CaCO3: -1, 'Ca2+': 1, 'CO3--': 1},
};
