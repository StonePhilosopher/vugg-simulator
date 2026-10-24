// Bounded evidence for PR #28's existing b4b575b6 correction. No model changes.
// node tools/recipe-rung1-audit.mjs --base-root <pinned checkout> [--out <local directory>]
// Runs all 41 scenarios at seeds 1, 2, 42, serially, in fresh bounded children.
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gzipSync, gunzipSync} from 'node:zlib';
import {assertCommissionedEvidenceRuntime, assertIndexMatchesDist,
  runtimeExecutionDigest, nodeRuntimeIdentity} from './evidence-runtime.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SELF = fileURLToPath(import.meta.url);
const CORRECTION = 'b4b575b6c6d930ff7cf38d9a7bf8457ef2763b3c';
export const PREVIOUS_TEMPERATURE_FLOORS = Object.freeze({
  pyrite: 100, chalcopyrite: 180, bornite: 80, native_silver: 50,
});
const SEEDS = [1, 2, 42];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};

// The old bound is temporarily restored on the same gate object, then removed
// in finally. This changes no source and cannot leak into a subsequent run.
// Include exact decision boundaries and both adjacent sides: mid-range bonuses
// can FALL when the normalization changes to 50 C, even as the low-T penalty goes.
export function initiativeDeltaAudit({MINERAL_GATES_REGISTRY: gates,
  temperatureInitiativeModifier: temperature, computeInitiative: initiative}) {
  return Object.entries(PREVIOUS_TEMPERATURE_FLOORS).map(([mineral, oldMin]) => {
    const gate = gates[mineral];
    assert.ok(gate && !Object.hasOwn(gate, 'T_min'), `${mineral}: corrected gate still has a floor`);
    const oldSpan = gate.T_max - oldMin;
    const boundaries = [-20, 800, oldMin, gate.T_max, gate.T_optimal,
      ...[10, 25, oldSpan * 0.2, oldSpan * 0.5].flatMap(d => [gate.T_optimal - d, gate.T_optimal + d])];
    const points = [...new Set(boundaries.flatMap(t => [t - 1e-6, t, t + 1e-6])
      .filter(t => t >= -20 && t <= 800))].sort((a, b) => a - b);
    const samples = points.map(T => {
      const after = temperature(mineral, {temperature: T}).value;
      const afterTotal = initiative(mineral, 2, {temperature: T}, Object.keys(PREVIOUS_TEMPERATURE_FLOORS)).finalInitiative;
      let before, beforeTotal;
      try {
        gate.T_min = oldMin;
        before = temperature(mineral, {temperature: T}).value;
        beforeTotal = initiative(mineral, 2, {temperature: T}, Object.keys(PREVIOUS_TEMPERATURE_FLOORS)).finalInitiative;
      } finally { delete gate.T_min; }
      assert.ok(Math.abs((afterTotal - beforeTotal) - (after - before)) < 1e-12);
      return {temperature_C: T, before, after, delta: after - before};
    });
    return {mineral, previous_floor_C: oldMin, ceiling_C: gate.T_max, optimal_C: gate.T_optimal,
      previous_normalization_C: oldSpan, corrected_normalization_C: 50, samples};
  });
}

function inputIdentity(root) {
  assertIndexMatchesDist(root);
  return {execution_sha256: runtimeExecutionDigest(root),
    harness_sha256: sha(fs.readFileSync(path.join(root, 'tools/_harness.mjs'))),
    runtime: nodeRuntimeIdentity()};
}

function nativeSelf() {
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$taskProcess = Get-Process -Id ([int]$env:VUGG_RECIPE_AUDIT_PID); '
      + '[pscustomobject]@{pid=$taskProcess.Id;creation_ticks=$taskProcess.StartTime.ToUniversalTime().ToFileTimeUtc().ToString();executable=$taskProcess.Path}|ConvertTo-Json -Compress'],
  {encoding: 'utf8', windowsHide: true, timeout: 10_000, env: {...process.env, VUGG_RECIPE_AUDIT_PID: String(process.pid)}}));
}

function summary(sim) {
  const species = {};
  for (const c of sim.crystals) {
    const s = species[c.mineral] ||= {total: 0, active: 0, dissolved: 0, positive_zones: 0, booked_mm3: 0, max_growth_um: 0};
    s.total++; s.active += c.active ? 1 : 0; s.dissolved += c.dissolved ? 1 : 0;
    s.positive_zones += c.zones.filter(z => z.thickness_um > 0).length;
    s.booked_mm3 += Number(c._volume_mm3) || 0;
    s.max_growth_um = Math.max(s.max_growth_um, Number(c.total_growth_um) || 0);
  }
  return {step: sim.step, temperature_C: sim.conditions.temperature, pH: sim.conditions.fluid.pH,
    cavity_diameter_mm: sim.wall_state.vug_diameter_mm,
    species: Object.fromEntries(Object.entries(species).sort(([a], [b]) => a.localeCompare(b)))};
}

// Output is raw scientific projection + booked volume, not a mesh or rounded
// per-species count. RNG, zones, chemistry, boundaries, contacts and histories
// remain in simulationStateProjection. The timeline keeps intermediate growth.
async function runCase(root, scenario, seed, file, expected) {
  assert.equal(sha(fs.readFileSync(SELF)), expected.producer_sha256, 'Audit producer changed');
  const identity = inputIdentity(root);
  assert.deepEqual(identity, expected.inputs);
  const h = await import(pathToFileURL(path.join(root, 'tools/_harness.mjs')).href);
  const api = await h.loadSimBundle({toolName: 'recipe-rung1-audit', extraExports: ['simulationStateProjection']});
  const helper = {owner: 'PR28-recipe-correction-validation', purpose: `${scenario} seed ${seed}`,
    ...nativeSelf(), project: root, port: null, started_utc: new Date().toISOString(),
    intended_expiry: 'one authored scenario run; external timeout 20 minutes',
    stop_method: 'normal exit; retained ChildProcess handle on timeout', status: 'running'};
  write(file + '.helper.json', helper);
  const started = performance.now();
  let peakRss = process.memoryUsage().rss;
  try {
    api.setSeed(seed);
    const s = api.SCENARIOS[scenario]();
    assert.ok(Number.isInteger(s.defaultSteps) && s.defaultSteps > 0, 'Authored duration is required');
    const sim = new api.VugSimulator(s.conditions, s.events);
    const timeline = [];
    for (let step = 0; step < s.defaultSteps; step++) {
      sim.run_step();
      const growth = sim.crystals.map(c => [c.crystal_id, c.mineral, c.active, c.dissolved, c.habit,
        c.total_growth_um, c.c_length_mm, c.a_width_mm, c._volume_mm3, c.zones.length, c.zones.at(-1)]);
      timeline.push(sha(JSON.stringify(growth)));
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
      if (peakRss > 1.5 * 1024 ** 3) throw new Error('Scenario worker exceeded 1536 MiB RSS');
    }
    const projection = api.simulationStateProjection(sim);
    const volumes = sim.crystals.map(c => ({id: c.crystal_id, booked_mm3: Number(c._volume_mm3) || 0}));
    const raw = Buffer.from(JSON.stringify({projection, volumes}));
    const compressed = gzipSync(raw);
    fs.writeFileSync(file + '.state.json.gz', compressed);
    assert.deepEqual(inputIdentity(root), identity, 'Input bytes changed during the run');
    const result = {...expected, scenario, seed, duration_steps: s.defaultSteps,
      projection_sha256: sha(raw), timeline_sha256: sha(JSON.stringify(timeline)), timeline,
      state_gzip_sha256: sha(compressed), summary: summary(sim), elapsed_ms: performance.now() - started,
      peak_rss_bytes: Math.max(peakRss, process.resourceUsage().maxRSS * 1024)};
    write(file, result);
    helper.status = 'passed';
  } catch (error) { helper.status = 'failed'; helper.error = error.stack; throw error; }
  finally { helper.finished_utc = new Date().toISOString(); write(file + '.helper.json', helper); }
}

// Report every changed leaf (bounded by a count, with the raw states retained
// and hashed). Never relabel a changed run as an equivalent baseline.
export function changedLeaves(before, after, at = '', out = {count: 0, examples: []}) {
  if (Object.is(before, after)) return out;
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) changedLeaves(before[key], after[key], at ? `${at}.${key}` : key, out);
  } else {
    out.count++;
    if (out.examples.length < 100) out.examples.push({path: at, before: before ?? null, after: after ?? null});
  }
  return out;
}

async function runAudit(baseRoot, out) {
  assertCommissionedEvidenceRuntime();
  const correctionPresent = spawnSync('git', ['merge-base', '--is-ancestor', CORRECTION, 'HEAD'], {cwd: ROOT, windowsHide: true});
  assert.equal(correctionPresent.status, 0, 'Original isolated correction commit must remain an ancestor');
  const inputs = {before: inputIdentity(baseRoot), after: inputIdentity(ROOT)};
  const producer = sha(fs.readFileSync(SELF));
  const key = sha(JSON.stringify({inputs, producer, seeds: SEEDS}));
  const dir = path.join(out, key);
  fs.mkdirSync(dir, {recursive: true});
  const h = await import(pathToFileURL(path.join(ROOT, 'tools/_harness.mjs')).href);
  const api = await h.loadSimBundle({toolName: 'recipe-rung1-audit-plan', extraExports: [
    'MINERAL_GATES_REGISTRY', 'temperatureInitiativeModifier', 'computeInitiative']});
  const scenarios = Object.keys(api.SCENARIOS).sort();
  assert.equal(scenarios.length, 41, 'This audit commissions the existing 41-scenario fleet');
  const initiative = initiativeDeltaAudit(api);
  const identity = {schema: 'vugg-recipe-rung1-audit-v1', inputs, producer_sha256: producer,
    trust: 'local-reproduction-not-independent-attestation',
    correction_commit: CORRECTION, seeds: SEEDS, scenarios};
  write(path.join(dir, 'identity.json'), identity);
  write(path.join(out, 'latest.json'), {directory: dir});
  const cases = [];
  for (const scenario of scenarios) for (const seed of SEEDS) {
    const pair = {};
    for (const arm of ['before', 'after']) {
      const file = path.join(dir, `${scenario}-${seed}-${arm}.json`);
      const expected = {inputs: inputs[arm], producer_sha256: producer};
      if (fs.existsSync(file)) {
        const stored = read(file);
        assert.deepEqual(stored.inputs, expected.inputs);
        assert.equal(stored.producer_sha256, producer);
        assert.equal(stored.scenario, scenario); assert.equal(stored.seed, seed);
        const compressed = fs.readFileSync(file + '.state.json.gz');
        assert.equal(sha(compressed), stored.state_gzip_sha256);
        assert.equal(sha(gunzipSync(compressed)), stored.projection_sha256);
        assert.equal(sha(JSON.stringify(stored.timeline)), stored.timeline_sha256);
        assert.equal(stored.timeline.length, stored.duration_steps);
        pair[arm] = stored;
      } else {
        const expectedFile = file + '.inputs.json'; write(expectedFile, expected);
        const log = fs.openSync(file + '.log', 'w');
        try {
          const child = spawnSync(process.execPath, ['--max-old-space-size=1024', SELF, '--case',
            arm === 'before' ? baseRoot : ROOT, scenario, String(seed), file, expectedFile],
          {cwd: ROOT, windowsHide: true, stdio: ['ignore', log, log], timeout: 20 * 60_000});
          if (child.error) throw child.error;
          assert.equal(child.status, 0, `${scenario}/${seed}/${arm} failed; see ${file}.log`);
          const helper = read(file + '.helper.json');
          write(file + '.helper.json', {...helper, exit_observed: true, exit_status: child.status});
        } finally { fs.closeSync(log); }
        pair[arm] = read(file);
      }
    }
    const same = pair.before.projection_sha256 === pair.after.projection_sha256
      && pair.before.timeline_sha256 === pair.after.timeline_sha256;
    const row = {scenario, seed, unchanged: same,
      before: {projection_sha256: pair.before.projection_sha256, timeline_sha256: pair.before.timeline_sha256},
      after: {projection_sha256: pair.after.projection_sha256, timeline_sha256: pair.after.timeline_sha256},
      first_changed_step: pair.before.timeline.findIndex((v, i) => v !== pair.after.timeline[i]) + 1 || null};
    if (!same) {
      const state = arm => JSON.parse(gunzipSync(fs.readFileSync(path.join(dir, `${scenario}-${seed}-${arm}.json.state.json.gz`))).toString());
      row.summary_changes = changedLeaves(pair.before.summary, pair.after.summary);
      row.scientific_changes = changedLeaves(state('before'), state('after'));
    }
    cases.push(row);
    console.log(`${cases.length}/123 ${scenario}@${seed}: ${same ? 'UNCHANGED' : 'CHANGED'}`);
    write(path.join(dir, 'progress.json'), {completed: cases.length, total: 123, changed: cases.filter(c => !c.unchanged), last: row});
  }
  assert.deepEqual(inputIdentity(ROOT), inputs.after);
  assert.deepEqual(inputIdentity(baseRoot), inputs.before);
  assert.equal(sha(fs.readFileSync(SELF)), producer, 'Audit producer changed during the panel');
  const report = {...identity, base_head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: baseRoot, encoding: 'utf8'}).trim(),
    candidate_head_at_measurement: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim(),
    comparison: {runs_per_arm: cases.length, unchanged: cases.filter(c => c.unchanged).length, changed: cases.filter(c => !c.unchanged).length},
    initiative, cases, boundaries: ['Seeds 1, 2, 42 are a bounded panel, not proof over every seed or custom fluid.',
      'Initiative audit reports both penalty removal and narrower 50 C bonus normalization; no re-tuning.',
      'No renderer, mesh, or display scaling participates in the scenario comparison.']};
  write(path.join(dir, 'report.json'), report);
  console.log(JSON.stringify(report.comparison));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  if (process.argv[2] === '--case') {
    assertCommissionedEvidenceRuntime();
    await runCase(path.resolve(process.argv[3]), process.argv[4], Number(process.argv[5]), process.argv[6], read(process.argv[7]));
  } else {
    const args = process.argv.slice(2);
    const get = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
    const base = get('--base-root');
    if (!base || args.some((a, i) => i % 2 === 0 && !['--base-root', '--out'].includes(a)))
      throw new Error('Usage: node tools/recipe-rung1-audit.mjs --base-root <pinned checkout> [--out <local directory>]');
    const out = path.resolve(get('--out') || path.join(ROOT, '.local-evidence/recipe-rung1-audit'));
    assertCommissionedEvidenceRuntime();
    const helper = {owner: 'PR28-recipe-correction-validation', purpose: 'serial three-seed, two-arm scenario comparison',
      ...nativeSelf(), project: ROOT, port: null, started_utc: new Date().toISOString(),
      intended_expiry: 'immediately after the 123 paired cases complete',
      stop_method: 'normal completion; preserve identity-bound per-case outputs before interruption', status: 'running'};
    write(path.join(out, 'coordinator-helper.json'), helper);
    try { await runAudit(path.resolve(base), out); helper.status = 'passed'; }
    catch (error) { helper.status = 'failed'; helper.error = error.stack; throw error; }
    finally { helper.finished_utc = new Date().toISOString(); write(path.join(out, 'coordinator-helper.json'), helper); }
  }
}
