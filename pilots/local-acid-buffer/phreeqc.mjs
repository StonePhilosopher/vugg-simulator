import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertCell, applyGasCarbon, dissolveCalcite, TOL} from './ledger.mjs';

export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const REFERENCE = Object.freeze({
  version: 'PHREEQC-3.8.6-17100',
  url: 'https://water.usgs.gov/water-resources/software/PHREEQC/phreeqc-3.8.6-17100-x64.msi',
  packageSha256: '6e5f6697fa727f919eb4e7c1c2bc20e8c2717378aaf77731efd831ef66578243',
  // The executable/database pins are checked before any chemistry executes.
  executableSha256: 'd1cc2ad3ae66af8a95c3fbb605affc4d22149c8d5aab4239919792c524635006',
  databaseSha256: '3be63aa92ab61fffd70e4bdf39e488bc32c1c1eaa71e1b41a4bf2fd33c1f5624',
  officialExampleLfSha256: 'cef249a87c3f0c63b86ec3b2814981a84defeb15d3e70dee745271ff3e406cb9',
});
const n = value => {
  if (!Number.isFinite(value)) throw new Error('Nonfinite PHREEQC input');
  return value.toExponential(16);
};
export const HEADINGS = ['simulation', 'pH', 'waterKg', 'Ca', 'Na', 'Cl', 'C', 'FeII', 'FeIII', 'sulfate',
  'oxygenAtoms', 'alkalinity', 'calciteSI', 'logPCO2', 'charge'];
export const SELECTED = `SELECTED_OUTPUT
 -file selected.tsv
 -reset false
 -high_precision true
USER_PUNCH
 -headings ${HEADINGS.join(' ')}
 10 PUNCH SIM_NO, -LA("H+"), TOT("water"), TOTMOLE("Ca"), TOTMOLE("Na"), TOTMOLE("Cl"), TOTMOLE("C(4)"), TOTMOLE("Fe(2)"), TOTMOLE("Fe(3)"), TOTMOLE("S(6)"), TOTMOLE("O(0)"), ALK*TOT("water"), SI("Calcite"), SI("CO2(g)"), CHARGE_BALANCE
`;

export function speciationDeck(cells, boundary) {
  if (boundary !== 'closed-carbon' && boundary !== 'fixed-pCO2') throw new Error('Unknown carbon boundary');
  return SELECTED + cells.map((c, i) => {
    assertCell(c);
    const a = c.aqueous, molal = key => n(a[key]/c.waterKg);
    return `SOLUTION ${i+1} ${c.id}
 temp 25
 pressure 1
 units mol/kgw
 pH 7 charge
 Na ${molal('Na')}
 Cl ${molal('Cl')}
 Ca ${molal('Ca')}
 C(4) ${boundary === 'fixed-pCO2' ? `${n(Math.max(a.C/c.waterKg, 1e-20))} CO2(g) -3.5` : molal('C')}
 Fe(2) ${molal('FeII')}
 S(6) ${molal('sulfate')}
 O(0) ${n(2*a.O2/c.waterKg)}
 -water ${n(c.waterKg)}
END
`;
  }).join('');
}

export function parseSelected(text) {
  const lines = text.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/));
  if (lines.length < 2 || lines[0].join('|') !== HEADINGS.join('|')) throw new Error('Unexpected PHREEQC selected-output header');
  return lines.slice(1).map(values => {
    if (values.length !== HEADINGS.length || values.some(v => !Number.isFinite(Number(v)))) throw new Error('Invalid PHREEQC row');
    return Object.fromEntries(HEADINGS.map((k, i) => [k, Number(values[i])]));
  });
}

export function assertSpeciation(c, row, boundary) {
  assertCell(c);
  if (!['closed-carbon', 'fixed-pCO2'].includes(boundary)) throw new Error('Unknown carbon boundary');
  for (const [key, expected] of Object.entries({waterKg: c.waterKg, Ca: c.aqueous.Ca,
    Na: c.aqueous.Na, Cl: c.aqueous.Cl,
    FeII: c.aqueous.FeII, FeIII: 0, sulfate: c.aqueous.sulfate, oxygenAtoms: 2*c.aqueous.O2,
    alkalinity: c.aqueous.alkalinity, ...(boundary === 'closed-carbon' ? {C: c.aqueous.C} : {})})) {
    if (!Number.isFinite(row[key]) || (key !== 'alkalinity' && row[key] < 0)
      || Math.abs(row[key] - expected) > TOL) throw new Error(`Speciation changed ${key}`);
  }
  if (!Number.isFinite(row.pH) || row.pH < 0 || row.pH > 14 || !Number.isFinite(row.calciteSI)
    || !(row.C >= 0) || !Number.isFinite(row.charge) || Math.abs(row.charge) > TOL) throw new Error('Unresolved local speciation');
  // PHREEQC's gas fugacity correction at 25 C/1 atm offsets this by ~7.6e-7.
  if (boundary === 'fixed-pCO2' && (!Number.isFinite(row.logPCO2) || Math.abs(row.logPCO2 + 3.5) > 2e-6)) throw new Error('Wrong fixed-pCO2 endpoint');
  return row;
}

export function createPhreeqc({executable, database, workdir}) {
  function assertDependencies() {
    for (const [file, pin] of [[executable, REFERENCE.executableSha256], [database, REFERENCE.databaseSha256]]) {
      if (sha256(fs.readFileSync(file)) !== pin) throw new Error(`Uncommissioned PHREEQC dependency: ${file}`);
    }
  }
  assertDependencies();
  fs.mkdirSync(workdir, {recursive: true});
  const transcript = [], cache = new Map();
  function run(input, selectedFile = 'selected.tsv') {
    if (!['selected.tsv', 'ex5.sel'].includes(selectedFile)) throw new Error('Invalid reference output name');
    const dir = fs.mkdtempSync(path.join(workdir, 'call-'));
    fs.writeFileSync(path.join(dir, 'input.pqi'), input);
    assertDependencies();
    const p = spawnSync(executable, ['input.pqi', 'output.txt', database], {
      cwd: dir, encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 4*1024*1024,
    });
    if (p.error || p.status !== 0 || /ERROR:/i.test(p.stderr + p.stdout)) {
      throw new Error(`PHREEQC failed (${p.status}): ${p.error?.message || p.stderr?.slice(-1600)}`);
    }
    const selected = fs.readFileSync(path.join(dir, selectedFile), 'utf8');
    transcript.push({input, selected, selectedFile});
    return selected;
  }
  function speciate(c, boundary) {
    const input = speciationDeck([c], boundary);
    if (!cache.has(input)) {
      const rows = parseSelected(run(input));
      if (rows.length !== 1 || rows[0].simulation !== 1) throw new Error('Unexpected PHREEQC solution identity/count');
      cache.set(input, assertSpeciation(c, rows[0], boundary));
    }
    const observation = structuredClone(cache.get(input));
    assertSpeciation(c, observation, boundary);
    const next = boundary === 'fixed-pCO2' ? applyGasCarbon(c, observation.C) : structuredClone(c);
    return {cell: next, observation};
  }
  return {run, speciate, transcript, assertDependencies};
}

export function equilibrateCalcite(input, boundary, speciate) {
  // Dissolution-only, local equilibrium endpoint. No elapsed time/rate law.
  const initial = speciate(input, boundary);
  if (initial.observation.calciteSI >= -1e-9 || input.solid.calcite === 0) {
    return {...initial, dissolvedMol: 0, endpoint: input.solid.calcite === 0 ? 'no-calcite' : 'not-undersaturated'};
  }
  const full = speciate(dissolveCalcite(input, input.solid.calcite), boundary);
  if (full.observation.calciteSI <= 0) {
    return {...full, dissolvedMol: input.solid.calcite, endpoint: 'calcite-exhausted'};
  }
  let lo = 0, hi = input.solid.calcite, accepted;
  for (let i=0; i<64; i++) {
    const mid = (lo+hi)/2;
    const trial = speciate(dissolveCalcite(input, mid), boundary);
    if (Math.abs(trial.observation.calciteSI) <= 1e-9) { accepted = {...trial, dissolvedMol: mid}; break; }
    if (trial.observation.calciteSI < 0) lo = mid; else hi = mid;
  }
  if (!accepted) throw new Error('Calcite equilibrium did not converge; no result accepted');
  return {...accepted, endpoint: 'calcite-equilibrium'};
}
