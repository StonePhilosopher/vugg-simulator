#!/usr/bin/env node
/**
 * tools/born-grown-audit.mjs — the born / grown / visible audit of contracted species (mineral-recipe
 * review §6, the second step of the order adopted 2026-10-22).
 *
 * Scenario contracts count first APPEARANCE. tools/locality-envelope-audit.mjs reads the claim card's
 * paragenetic order (a nucleation or transformation event per species) and
 * tests-js/scenario-expectation-contracts.test.ts reads sim.crystals by name, so a crystal that
 * nucleates and never grows satisfies both. Review R9 is the live case: graduated competition
 * (js/44-graduated-competition.ts, cofactorBlocked) rations the five contracted fahlores of bisbee,
 * porphyry and schneeberg to 0 % on every step, because MINERAL_STOICHIOMETRY books Fe 1.5 and Zn 1.5
 * and those fluids carry no Zn. CI stays green.
 *
 * For each scenario's contracted species — the deterministic tier as tools/review-claim-card.mjs builds
 * it (expects_species, then deterministic_species) and statistical_species, read from
 * SCENARIOS[name]._json5_spec, the object the contract test reads — it classifies, per seed:
 *
 *   born      a nucleation as that species (VugSimulator.prototype.nucleate, the capture
 *             tools/birth-census.mjs uses), else "conversion" when the name arrives only by an in-place
 *             transformation (js/75: argentite → acanthite, borax → tincalconite, torbernite →
 *             metatorbernite …). Names are compared at the end of every step, so two conversions
 *             inside one step read as one.
 *   grown     a STORED zone thicker than zero, added while the crystal carried that name
 *             (Crystal.prototype.add_zone), else "inherited" when the crystal grew only under another
 *             name. "Has a zone" is not growth: zero-thickness zones are stored too (reaction
 *             overprints, masked stalls, the cavity clamp; the js/85-simulator.ts growth loop).
 *   visible   a surviving (not dissolved) crystal of that FINAL name whose longest dimension,
 *             max(c_length_mm, a_width_mm, total_growth_um / 1000), reaches 0.1 mm (micromount) or
 *             1 mm (eye-visible): the definition of PR #26's tools/assemblage-census.mjs, which also
 *             keeps crystals flagged enclosed_by apart.
 *   showcase  the role PR #26's story-pocket targets give the species in that scenario (primary,
 *             alternate, showpiece, companion, unsupported), else "n/a". Roles only — the verdicts
 *             belong to that PR's tools/showcase-scoreboard.mjs. The sidecar is read from
 *             --story-targets, else from this tree, else from git (refs/remotes/origin/review/
 *             locality-abundance); the report names the source and its hash.
 *
 * The stage matters. R9's probe history: a growth-budget probe first "cleared" the fahlores, because
 * the competition pass drops their zone before the budget ever sees it. "Grown" therefore reads the
 * stored-zone ledger, which lies after every stage that can drop a zone. Beside it the audit counts
 * each crystal's positive CANDIDATE zones — the engine's own proposal (_dryRunEngineForCrystal in pass
 * 1, _runEngineForCrystal otherwise), before competition, the growth budget, the fill dampener and the
 * clamps — and the competition's "edge-of-gate skip" log lines (run_step resets the log, so it is read
 * after every step). A candidate-stage reading would call every R9 fahlore grown.
 *
 * Controls (CONTROLS below), evaluated on every seed run and printed with the report:
 *   positive  the five R9 fahlores read born, not grown. If they do not, the audit measures the wrong
 *             stage — or R9 has landed, and R9's own commit turns this control into a negative one.
 *   negative  bisbee's malachite and azurite read grown and visible; sunnyside_american_tunnel's
 *             fahlores, the same species in a fluid with 120 ppm Zn, read grown.
 * Each control was shown to fail on a broken copy of this tool (2026-10-23, SIM 285): grading growth
 * by the candidate instead of the stored zone fails the positive control (all five fahlores read
 * grown), and dropping the zone capture fails both negative ones. Neither control alone catches both.
 *
 * Integrity: at seed 42 each run is compared with tests-js/baselines/seed42_v<SIM>.json through the
 * per-species summary of tools/gen-js-baseline.mjs (copied, not imported: that file is an evidence
 * producer and runs on import), so the audit shows that its wrappers did not move a run. Births are
 * compared per (scenario, species) with tools/birth-census.mjs's
 * .local-evidence/birth-census/birth-events.json when one from the same SIM version exists. Each
 * crystal's captured zone count must equal its zones.length; a mismatch is reported, never patched.
 *
 * PASSIVE instrument: reads, reports, exits 0 whatever it finds. Imports only tools/_harness.mjs and
 * node builtins (no evidence producer) and writes only .local-evidence/born-grown-audit/, the directory
 * the identity guard excludes: runs.jsonl (one row per scenario × seed; a row is reused unless --fresh
 * only when its audit version, SIM version and input digest — runtime formation, dist, data, the
 * harness, this file, dependency lock and current seed-42 reference bytes/presence — all match),
 * report.txt, report.json, report.md. Size tiers use unrounded millimetres; human-readable lengths
 * prefixed with ≈ are rounded for display only. External story roles are joined afresh after reuse.
 *
 * Usage:
 *   node tools/born-grown-audit.mjs                      # every scenario, seed 42 (~20 min)
 *   node tools/born-grown-audit.mjs bisbee schneeberg    # a subset
 *   node tools/born-grown-audit.mjs --seeds 1,2,42       # the locality-frequency panel
 *   node tools/born-grown-audit.mjs --fresh              # ignore the rows on disk
 *   options: --story-targets <file>, --birth-census <birth-events.json>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, '.local-evidence', 'born-grown-audit');
const AUDIT_VERSION = 2;
const RUNTIME = Object.freeze({node: process.version, v8: process.versions.v8, icu: process.versions.icu,
  platform: process.platform, arch: process.arch, locale: Intl.DateTimeFormat().resolvedOptions().locale});
// PR #26's size edges (tools/assemblage-census.mjs SIZE_EDGES_MM[0..1]) and its longest dimension: the
// renderer's c/a and the growth ledger's c-advance can differ by habit, and a collector sees the larger.
const MICRO_MM = 0.1;
const EYE_MM = 1;
const longestMm = (c) => Math.max(Number(c.c_length_mm) || 0, Number(c.a_width_mm) || 0,
  (Number(c.total_growth_um) || 0) / 1000);
const STORY_TARGETS = 'proposals/DATA-STORY-POCKET-TARGETS-2026-10-22.json';
const STORY_TARGETS_REF = 'refs/remotes/origin/review/locality-abundance';
const SKIP_LINE = /#(\d+): edge-of-gate skip — (.*)$/;

// R9's own commit (rung 6) turns the positive control negative: once fahlore's shared site takes what
// the cell offers, these five crystals must read grown.
const CONTROLS = [
  {
    kind: 'positive', expect: 'born, not grown',
    label: 'the R9 fahlores: Zn-free fluids, booked Zn 1.5, rationed to 0 % (review R9 counted 313 skips, 64/64/60/60/65)',
    pairs: [['bisbee', 'tetrahedrite'], ['bisbee', 'tennantite'], ['porphyry', 'tetrahedrite'],
      ['porphyry', 'tennantite'], ['schneeberg', 'tennantite']],
  },
  {
    kind: 'negative', expect: 'grown and visible',
    label: "bisbee's malachite and azurite, species known to grow there",
    pairs: [['bisbee', 'malachite'], ['bisbee', 'azurite']],
  },
  {
    kind: 'negative', expect: 'grown',
    label: 'the same fahlores where the fluid carries Zn (sunnyside_american_tunnel, 120 ppm)',
    pairs: [['sunnyside_american_tunnel', 'tetrahedrite'], ['sunnyside_american_tunnel', 'tennantite']],
  },
];
// "grown, converted": every crystal of the name grew and then changed name in place, so no crystal of
// it is left to see (the product carries the crystal); kept apart from dust and dissolution.
const STATUSES = ['not born', 'born, not grown', 'grown, converted', 'grown, not visible', 'grown, under 1 mm', 'visible'];

// ---- arguments ----
function parseSeeds(text) {
  const seeds = new Set();
  for (const part of String(text).split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`bad --seeds part: ${part}`);
    for (let s = Number(m[1]); s <= Number(m[2] ?? m[1]); s++) seeds.add(s);
  }
  return [...seeds].sort((a, b) => a - b);
}
const opts = { seeds: [42], fresh: false, storyTargets: null, scenarios: [],
  birthCensus: path.join(ROOT, '.local-evidence', 'birth-census', 'birth-events.json') };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--seeds') opts.seeds = parseSeeds(argv[++i]);
  else if (a === '--fresh') opts.fresh = true;
  else if (a === '--story-targets') opts.storyTargets = path.resolve(argv[++i]);
  else if (a === '--birth-census') opts.birthCensus = path.resolve(argv[++i]);
  else if (a === '--help' || a === '-h') {
    console.log('node tools/born-grown-audit.mjs [scenario …] [--seeds 1,2,42] [--fresh] [--story-targets <file>] [--birth-census <file>]');
    process.exit(0);
  } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
  else opts.scenarios.push(a);
}

const sha256 = (text) => crypto.createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');

// What a row depends on: the compiled bundle the harness evaluates, the data files it fetches, the
// harness, this tool's capture/classification code, actual runtime formation, dependency lock, and
// seed-42 comparison reference. Include an existing reference's path and bytes; its absence also
// changes this digest. Story roles are deliberately excluded: they are a fresh report-only join.
function inputDigest() {
  const files = [path.join(ROOT, 'tools', '_harness.mjs'), fileURLToPath(import.meta.url), path.join(ROOT, 'package-lock.json')];
  const walk = (dir) => {
    for (const n of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, n);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.js')) files.push(p);
    }
  };
  walk(path.join(ROOT, 'dist'));
  for (const n of fs.readdirSync(path.join(ROOT, 'data')).sort()) {
    if (/\.json5?$/.test(n)) files.push(path.join(ROOT, 'data', n));
  }
  const baselineFile = path.join(ROOT, 'tests-js', 'baselines', `seed42_v${SIM_VERSION}.json`);
  if (fs.existsSync(baselineFile)) files.push(baselineFile);
  const h = crypto.createHash('sha256');
  h.update('runtime-formation\0').update(JSON.stringify(RUNTIME)).update('\0');
  for (const f of files) {
    h.update(path.relative(ROOT, f).replaceAll('\\', '/')).update('\0');
    h.update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).update('\0');
  }
  return h.digest('hex');
}

// ---- bundle and capture ----
fs.mkdirSync(OUT, { recursive: true });
const h = await import(pathToFileURL(path.join(ROOT, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, Crystal, setSeed, SIM_VERSION, MODEL_DIGEST } = await h.loadSimBundle({
  toolName: 'born-grown-audit', extraExports: ['Crystal'],
});
const INPUTS = inputDigest();

// The wrappers read plain fields and call no simulator method, so a run is the run without them (the
// seed-42 baseline check below shows it). `cap` is the run being captured; one simulator at a time.
let cap = null;
const P = VugSimulator.prototype;
const origNucleate = P.nucleate;
P.nucleate = function (...a) {
  const c = origNucleate.apply(this, a);
  if (cap && c) {
    cap.byObj.set(c, { born: c.mineral, step: this.step, name: c.mineral, conv: [], z: {}, calls: {},
      cand: new Map(), pos: new Set(), skip: new Map(), inactive_from: null });
  }
  return c;
};
for (const m of ['_dryRunEngineForCrystal', '_runEngineForCrystal']) {
  const orig = P[m];
  if (typeof orig !== 'function') throw new Error(`VugSimulator.prototype.${m} is gone: the candidate stage cannot be read`);
  P[m] = function (engine, crystal) {
    const zone = orig.call(this, engine, crystal);
    // Read the thickness now: competition and the dampener later scale this object in place.
    const rec = cap?.byObj.get(crystal);
    if (rec) {
      const t = zone && typeof zone.thickness_um === 'number' ? zone.thickness_um : null;
      // Engine calls by outcome: no zone, zero, negative, positive.
      (rec.calls[crystal.mineral] ||= [0, 0, 0, 0])[t == null ? 0 : t > 0 ? 3 : t < 0 ? 2 : 1]++;
      if (t > 0 && !rec.cand.has(this.step)) rec.cand.set(this.step, crystal.mineral);
    }
    return zone;
  };
}
const origAddZone = Crystal.prototype.add_zone;
Crystal.prototype.add_zone = function (zone, ...rest) {
  const out = origAddZone.call(this, zone, ...rest);
  const rec = cap?.byObj.get(this);
  if (rec) {
    // After the call: add_zone applies the time scale to an unscaled zone, so this is what was stored.
    const t = Number(zone.thickness_um) || 0;
    const a = (rec.z[this.mineral] ||= [0, 0, 0, 0, 0]);  // positive n, µm; zero n; negative n, µm
    if (t > 0) { a[0]++; a[1] += t; rec.pos.add(cap.sim ? cap.sim.step : zone.step); }
    else if (t < 0) { a[3]++; a[4] -= t; }
    else a[2]++;
  }
  return out;
};

// tools/gen-js-baseline.mjs summarize(), verbatim in effect.
function baselineSummary(sim) {
  const out = {};
  for (const c of sim.crystals || []) {
    if (!out[c.mineral]) out[c.mineral] = { active: 0, dissolved: 0, total: 0, max_um: 0 };
    out[c.mineral].total++;
    if (c.dissolved) out[c.mineral].dissolved++;
    else out[c.mineral].active++;
    if (c.total_growth_um > out[c.mineral].max_um) out[c.mineral].max_um = Math.round(c.total_growth_um * 10) / 10;
  }
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}
const BASELINE_PATH = path.join(ROOT, 'tests-js', 'baselines', `seed42_v${SIM_VERSION}.json`);
const BASELINE = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : null;

function runOne(name, seed) {
  const t0 = Date.now();
  setSeed(seed);
  const s = SCENARIOS[name]();
  cap = { byObj: new WeakMap(), sim: null, errors: [], unknown: new Set() };
  const sim = new VugSimulator(s.conditions, s.events);
  cap.sim = sim;
  const steps = s.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    for (const line of sim.log || []) {
      const m = SKIP_LINE.exec(line);
      if (!m) continue;
      const c = sim.crystals.find((x) => x.crystal_id === Number(m[1]));
      const rec = c && cap.byObj.get(c);
      if (rec) rec.skip.set(sim.step, m[2]);
      else cap.errors.push(`step ${sim.step}: a skip line names crystal #${m[1]}, which no capture saw born`);
    }
    for (const c of sim.crystals) {
      const rec = cap.byObj.get(c);
      if (!rec) {
        if (!cap.unknown.has(c.crystal_id)) cap.errors.push(`crystal #${c.crystal_id} ${c.mineral} appeared without a nucleate() call`);
        cap.unknown.add(c.crystal_id);
      } else {
        if (c.mineral !== rec.name) {
          rec.conv.push([sim.step, rec.name, c.mineral]);
          rec.name = c.mineral;
        }
        // The growth loop skips an inactive crystal before its engine runs (enclosure, burial, dissolution).
        if (!c.active && rec.inactive_from == null) rec.inactive_from = sim.step;
      }
    }
  }
  const crystals = [];
  for (const c of sim.crystals) {
    const rec = cap.byObj.get(c);
    if (!rec) continue;
    const z = {};
    let n = 0;
    for (const [k, a] of Object.entries(rec.z)) {
      z[k] = [a[0], +a[1].toFixed(3), a[2], a[3], +a[4].toFixed(3)];
      n += a[0] + a[2] + a[3];
    }
    if (n !== c.zones.length) cap.errors.push(`crystal #${c.crystal_id} ${c.mineral}: ${n} zones captured, ${c.zones.length} stored`);
    const cand = {};  // name → [positive candidates, stored positive the same step, competition skips]
    for (const [st, k] of rec.cand) {
      const a = (cand[k] ||= [0, 0, 0]);
      a[0]++;
      if (rec.pos.has(st)) a[1]++;
      else if (rec.skip.has(st)) a[2]++;
    }
    crystals.push({
      id: c.crystal_id, born: rec.born, step: rec.step, final: c.mineral, conv: rec.conv, z, cand,
      calls: rec.calls, skips: rec.skip.size, why: [...new Set(rec.skip.values())],
      dissolved: !!c.dissolved, active: !!c.active, inactive_from: rec.inactive_from,
      enclosed: c.enclosed_by != null, L_mm: longestMm(c), um: +(Number(c.total_growth_um) || 0).toFixed(3),
    });
  }
  let baseline = 'n/a';
  if (seed === 42 && BASELINE?.[name]) {
    baseline = JSON.stringify(baselineSummary(sim)) === JSON.stringify(BASELINE[name]) ? 'reproduced' : 'differs';
  }
  const row = { schema: 'vugg-born-grown-audit-run-v1', audit: AUDIT_VERSION, sim_version: SIM_VERSION, runtime: RUNTIME,
    inputs: INPUTS, scenario: name, seed, steps, ms: Date.now() - t0, baseline, errors: cap.errors, crystals };
  cap = null;
  return row;
}

// ---- runs (resumable) ----
const runsPath = path.join(OUT, 'runs.jsonl');
if (opts.fresh && fs.existsSync(runsPath)) fs.rmSync(runsPath);
const rows = new Map();
if (fs.existsSync(runsPath)) {
  for (const line of fs.readFileSync(runsPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.audit === AUDIT_VERSION && r.sim_version === SIM_VERSION && r.inputs === INPUTS) rows.set(`${r.scenario}|${r.seed}`, r);
  }
}
const names = opts.scenarios.length ? [...new Set(opts.scenarios)] : Object.keys(SCENARIOS).sort();
const unknownNames = names.filter((n) => !SCENARIOS[n]);
if (unknownNames.length) throw new Error(`unknown scenario(s): ${unknownNames.join(', ')}`);
const t0 = Date.now();
for (const name of names) {
  for (const seed of opts.seeds) {
    const key = `${name}|${seed}`;
    if (rows.has(key)) continue;
    const row = runOne(name, seed);
    rows.set(key, row);
    fs.appendFileSync(runsPath, JSON.stringify(row) + '\n');
    console.log(`  ${name.padEnd(36)} seed ${String(seed).padStart(3)}  ${String(row.crystals.length).padStart(3)} crystals  ${(row.ms / 1000).toFixed(1).padStart(6)} s  baseline ${row.baseline}${row.errors.length ? `  ${row.errors.length} CAPTURE ERRORS` : ''}`);
  }
}

// ---- story-pocket roles ----
function loadStoryRoles() {
  let text = null;
  let source = null;
  const fromFile = (p) => {
    if (fs.existsSync(p)) { text = fs.readFileSync(p, 'utf8'); source = path.relative(ROOT, p).replaceAll('\\', '/'); }
  };
  if (opts.storyTargets) fromFile(opts.storyTargets);
  else {
    fromFile(path.join(ROOT, STORY_TARGETS));
    if (text == null) {
      try {
        const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
        const sha = git('rev-parse', '--verify', `${STORY_TARGETS_REF}^{commit}`).trim();
        text = git('show', `${sha}:${STORY_TARGETS}`);
        source = `${STORY_TARGETS_REF.replace('refs/remotes/', '')} @ ${sha.slice(0, 8)}:${STORY_TARGETS}`;
      } catch { text = null; }
    }
  }
  if (text == null) return { roles: null, source: 'none found (pass --story-targets)', sha256: null };
  let d;
  try { d = JSON.parse(text); } catch (e) { return { roles: null, source: `${source} unreadable: ${e.message}`, sha256: null }; }
  if (d.schema !== 'vugg-story-pocket-targets-v1') {
    return { roles: null, source: `${source} has schema ${d.schema}, not vugg-story-pocket-targets-v1`, sha256: null };
  }
  const roles = new Map();
  for (const [sc, entry] of Object.entries(d.scenarios || {})) {
    const m = new Map();
    for (const [sp, t] of Object.entries(entry?.species || {})) {
      if (t?.role) m.set(sp, { role: t.role, median_mm: t.size?.median ?? null, basis: t.size?.basis ?? null });
    }
    roles.set(sc, m);
  }
  return { roles, source, sha256: sha256(text) };
}
const story = loadStoryRoles();

// ---- classification ----
function contractOf(spec) {
  const list = (e) => (Array.isArray(e) ? e : []).map((x) => (typeof x === 'string' ? x : String(x?.mineral || ''))).filter(Boolean);
  return {
    positive: [
      ...list(spec.expects_species).map((m) => ({ mineral: m, tier: 'headline' })),
      ...list(spec.deterministic_species).map((m) => ({ mineral: m, tier: 'accessory' })),
      ...list(spec.statistical_species).map((m) => ({ mineral: m, tier: 'statistical' })),
    ],
    negative: [
      ...list(spec.aspirational_species).map((m) => ({ mineral: m, tier: 'aspirational' })),
      ...Object.keys(spec.excluded_species || {}).map((m) => ({ mineral: m, tier: 'excluded' })),
    ],
  };
}

function view(crystals, X) {
  const v = { nucleated: 0, conv_in: 0, conv_out: 0, carried: 0, grown_as: 0, grown_any: 0, ghosts: 0,
    pos_zones: 0, growth_um: 0, calls: [0, 0, 0, 0], cand: 0, cand_stored: 0, skipped: 0, inactive: 0,
    inactive_from: null, final: 0, surv: 0, dis: 0, n01: 0, n1: 0, n01_exp: 0, n1_exp: 0, max_mm: 0,
    max_exp_mm: 0, first_step: null, conv_from: {}, conv_to: {}, why: [] };
  const first = (s) => { if (v.first_step == null || s < v.first_step) v.first_step = s; };
  for (const c of crystals) {
    const into = c.conv.find((x) => x[2] === X);
    if (c.born === X) { v.nucleated++; first(c.step); }
    else if (into) { v.conv_in++; first(into[0]); v.conv_from[into[1]] = (v.conv_from[into[1]] || 0) + 1; }
    if (c.born === X || into) {
      v.carried++;
      const z = c.z[X];
      if (z && z[0] > 0) { v.grown_as++; v.pos_zones += z[0]; v.growth_um += z[1]; }
      if (Object.values(c.z).some((a) => a[0] > 0)) v.grown_any++;
      else v.ghosts++;  // a crystal that never stored a positive zone under any name
      (c.calls[X] || []).forEach((n, i) => { v.calls[i] += n; });
      const cd = c.cand[X];
      if (cd) { v.cand += cd[0]; v.cand_stored += cd[1]; v.skipped += cd[2]; }
      if (c.inactive_from != null) {
        v.inactive++;
        if (v.inactive_from == null || c.inactive_from < v.inactive_from) v.inactive_from = c.inactive_from;
      }
      for (const w of c.why) if (!v.why.includes(w)) v.why.push(w);
      if (c.final !== X) { v.conv_out++; v.conv_to[c.final] = (v.conv_to[c.final] || 0) + 1; }
    }
    if (c.final !== X) continue;
    v.final++;
    if (c.dissolved) { v.dis++; continue; }
    v.surv++;
    if (c.L_mm >= MICRO_MM) { v.n01++; if (!c.enclosed) v.n01_exp++; }
    if (c.L_mm >= EYE_MM) { v.n1++; if (!c.enclosed) v.n1_exp++; }
    if (c.L_mm > v.max_mm) v.max_mm = c.L_mm;
    if (!c.enclosed && c.L_mm > v.max_exp_mm) v.max_exp_mm = c.L_mm;
  }
  v.growth_um = +v.growth_um.toFixed(1);
  v.born = v.nucleated ? 'yes' : v.conv_in ? 'conversion' : 'no';
  v.grown = v.born === 'no' ? '-' : v.grown_as ? 'yes' : v.grown_any ? 'inherited' : 'no';
  v.visible = v.n1 ? '>=1 mm' : v.n01 ? '>=0.1 mm' : v.surv ? (v.max_mm > 0 ? 'dust' : 'zero size')
    : v.final ? 'dissolved' : v.carried ? 'converted' : '-';
  v.status = v.born === 'no' ? STATUSES[0] : v.grown === 'no' ? STATUSES[1]
    : v.n1 ? STATUSES[5] : v.n01 ? STATUSES[4] : v.visible === 'converted' ? STATUSES[2] : STATUSES[3];
  return v;
}

const seedsRun = opts.seeds;
const PRIMARY = seedsRun.includes(42) ? 42 : seedsRun[0];
const entries = [];
const negativeBirths = [];
for (const name of names) {
  const { positive, negative } = contractOf(SCENARIOS[name]._json5_spec || {});
  const roles = story.roles?.get(name) || null;
  for (const seed of seedsRun) {
    const row = rows.get(`${name}|${seed}`);
    for (const { mineral, tier } of positive) {
      const r = roles?.get(mineral) || null;
      entries.push({ scenario: name, seed, mineral, tier, role: r?.role ?? 'n/a',
        record_median_mm: r?.median_mm ?? null, record_basis: r?.basis ?? null, ...view(row.crystals, mineral) });
    }
    for (const { mineral, tier } of negative) {
      const v = view(row.crystals, mineral);
      if (v.born !== 'no') negativeBirths.push({ scenario: name, seed, mineral, tier, born: v.born, nucleated: v.nucleated, conv_in: v.conv_in });
    }
  }
}

// ---- controls ----
function controlVerdict(ctl, e) {
  if (!e) return null;
  if (ctl.expect === 'born, not grown') return e.status === 'born, not grown';
  if (ctl.expect === 'grown') return e.grown === 'yes';
  return e.grown === 'yes' && (e.visible === '>=1 mm' || e.visible === '>=0.1 mm');
}
const controls = [];
for (const ctl of CONTROLS) {
  for (const seed of seedsRun) {
    const items = ctl.pairs.map(([sc, m]) => {
      const e = entries.find((x) => x.scenario === sc && x.mineral === m && x.seed === seed);
      return { scenario: sc, mineral: m, ran: !!e, pass: controlVerdict(ctl, e), entry: e || null };
    });
    const ran = items.filter((i) => i.ran);
    if (!ran.length) continue;
    // A subset run judges the pairs it ran and says how many those were.
    controls.push({ kind: ctl.kind, label: ctl.label, expect: ctl.expect, seed,
      pass: ran.every((i) => i.pass), evaluated: ran.length, of: items.length, items });
  }
}

// ---- integrity ----
const allRows = names.flatMap((n) => seedsRun.map((s) => rows.get(`${n}|${s}`)));
const baselineTally = { reproduced: 0, differs: [], na: 0 };
for (const r of allRows) {
  if (r.baseline === 'reproduced') baselineTally.reproduced++;
  else if (r.baseline === 'differs') baselineTally.differs.push(`${r.scenario}@${r.seed}`);
  else baselineTally.na++;
}
const captureErrors = allRows.flatMap((r) => r.errors.map((e) => `${r.scenario}@${r.seed}: ${e}`));
let census;
if (!seedsRun.includes(42)) census = { status: 'not compared', note: 'birth-census runs seed 42 only, and this run has no seed 42' };
else if (!fs.existsSync(opts.birthCensus)) {
  census = { status: 'not compared', note: `no ${path.relative(ROOT, opts.birthCensus).replaceAll('\\', '/')} (run node tools/birth-census.mjs)` };
} else {
  const bc = JSON.parse(fs.readFileSync(opts.birthCensus, 'utf8'));
  if (bc.SIM_VERSION !== SIM_VERSION) census = { status: 'not compared', note: `birth-census is SIM ${bc.SIM_VERSION}, this tree SIM ${SIM_VERSION}` };
  else {
    const theirs = new Map();
    const theirScenarios = new Set();
    for (const ev of bc.events || []) {
      if (ev.error) continue;
      theirScenarios.add(ev.scenario);
      const k = `${ev.scenario}|${ev.mineral}`;
      theirs.set(k, (theirs.get(k) || 0) + 1);
    }
    const ours = new Map();
    for (const r of names.map((n) => rows.get(`${n}|42`))) {
      for (const c of r.crystals) ours.set(`${r.scenario}|${c.born}`, (ours.get(`${r.scenario}|${c.born}`) || 0) + 1);
    }
    const mismatches = [];
    let births = 0;
    for (const n of names) {
      const keys = new Set([...ours.keys(), ...theirs.keys()].filter((k) => k.startsWith(`${n}|`)));
      for (const k of keys) {
        const a = ours.get(k) || 0;
        const b = theirs.get(k) || 0;
        births += a;
        if (a !== b) mismatches.push(`${k.replace('|', ' ')}: audit ${a}, birth-census ${b}${theirScenarios.has(n) ? '' : ' (no birth-census events in this scenario: a subset run?)'}`);
      }
    }
    census = { status: mismatches.length ? 'MISMATCH' : 'match', scenarios: names.length, births, mismatches };
  }
}

// ---- report ----
const fmtMm = (x) => {
  const text = x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x >= 0.01 ? x.toFixed(3) : x > 0 ? x.toExponential(1) : '0';
  return Number(text) === x ? text : `≈${text}`;
};
const roleText = (e) => (e.role === 'n/a' ? '' : `, ${e.role}${e.record_median_mm != null ? ` — record median ${e.record_median_mm} mm (${e.record_basis})` : ''}`);
const tierLetter = { headline: 'H', accessory: 'D', statistical: 'S' };
const at = (seed) => entries.filter((e) => e.seed === seed);
const describeControl = (c) => c.items.map((i) => {
  const e = i.entry;
  if (!e) return `${i.scenario} ${i.mineral}: not run`;
  const cands = `${e.cand} positive candidate steps, ${e.skipped} competition skips, ${e.pos_zones} stored positive zones`;
  const size = e.surv ? `, largest ${fmtMm(e.max_mm)} mm` : '';
  return `${i.scenario} ${i.mineral}: ${e.status} (${e.nucleated} born; ${cands}${size}) ${i.pass ? 'ok' : 'FAILS'}`;
});
function listLines(es, kind) {
  return es.map((e) => {
    const head = `${e.scenario} ${e.mineral} (${tierLetter[e.tier]}${roleText(e)})`;
    if (kind === 'ghost') {
      const calls = e.calls.reduce((a, b) => a + b, 0);
      const engine = calls
        ? `engine ran ${calls}× (no zone ${e.calls[0]}, zero ${e.calls[1]}, negative ${e.calls[2]}, positive ${e.calls[3]})`
        : 'engine never ran';
      const stage = e.cand
        ? `; positive on ${e.cand} steps, ${e.skipped} skipped by competition, ${e.cand - e.cand_stored - e.skipped} dropped after it`
        : '';
      const inactive = e.inactive ? `; ${e.inactive} went inactive, first at step ${e.inactive_from}` : '';
      return `${head}: ${e.carried} crystal${e.carried === 1 ? '' : 's'}, first born step ${e.first_step}; ${engine}${stage}; 0 stored positive zones${inactive}${e.why.length ? `; "${e.why[0]}"` : ''}`;
    }
    if (kind === 'converted') {
      return `${head}: grown in ${e.grown_as} crystal(s), all converted in place to ${Object.entries(e.conv_to).map(([m, n]) => `${m} (${n})`).join(', ')}`;
    }
    if (kind === 'invisible') {
      const why = e.visible === 'dissolved' ? `all ${e.final} dissolved` : `${e.surv} surviving, largest ${fmtMm(e.max_mm)} mm`;
      return `${head}: grown${e.grown === 'inherited' ? ' (inherited)' : ''} in ${e.grown_as || e.grown_any} crystal(s), ${why}`;
    }
    return `${head}: largest ${fmtMm(e.max_mm)} mm, ${e.n01} of ${e.surv} surviving ≥ 0.1 mm${e.grown === 'inherited' ? ' (growth inherited)' : ''}`;
  });
}
const P42 = at(PRIMARY);
const lists = {
  ghosts: P42.filter((e) => e.status === 'born, not grown'),
  converted: P42.filter((e) => e.status === 'grown, converted'),
  invisible: P42.filter((e) => e.status === 'grown, not visible'),
  ghostCrystals: P42.filter((e) => e.ghosts > 0 && e.status !== 'born, not grown'),
  under1: P42.filter((e) => e.status === 'grown, under 1 mm'),
  notBorn: P42.filter((e) => e.status === 'not born'),
  enclosedOnly: P42.filter((e) => e.n1 > 0 && e.n1_exp === 0),
  byConversion: P42.filter((e) => e.born === 'conversion'),
};
const tally = {};
for (const tier of ['headline', 'accessory', 'statistical']) {
  tally[tier] = Object.fromEntries(STATUSES.map((s) => [s, P42.filter((e) => e.tier === tier && e.status === s).length]));
  tally[tier].pairs = P42.filter((e) => e.tier === tier).length;
}
const panel = seedsRun.length > 1 ? (() => {
  const out = [];
  const keyed = new Map();
  for (const e of entries) {
    const k = `${e.scenario}|${e.mineral}`;
    if (!keyed.has(k)) keyed.set(k, []);
    keyed.get(k).push(e);
  }
  for (const es of keyed.values()) {
    if (es.every((e) => e.status === 'visible')) continue;
    out.push(`${es[0].scenario} ${es[0].mineral} (${tierLetter[es[0].tier]}): ${es.map((e) => `s${e.seed} ${e.status}`).join('; ')}`);
  }
  return out;
})() : null;

const node = process.version;
const header = `BORN / GROWN / VISIBLE AUDIT — SIM ${SIM_VERSION}, seed${seedsRun.length > 1 ? 's' : ''} ${seedsRun.join(', ')}, ${names.length} scenarios, Node ${node}\n`
  + `inputs ${INPUTS.slice(0, 12)} (dist, data, harness, this tool), audit v${AUDIT_VERSION}; story roles: ${story.source}${story.sha256 ? ` (sha256 ${story.sha256.slice(0, 12)}, LF-normalised)` : ''}\n`;
const integrity = [
  `seed-42 baseline (${path.relative(ROOT, BASELINE_PATH).replaceAll('\\', '/')}): ${baselineTally.reproduced} of ${allRows.filter((r) => r.seed === 42).length} runs reproduced${baselineTally.differs.length ? `; DIFFERS: ${baselineTally.differs.join(', ')}` : ''}`,
  `births vs tools/birth-census.mjs: ${census.status}${census.note ? ` (${census.note})` : `, ${census.births} births over ${census.scenarios} scenarios${census.mismatches.length ? `; ${census.mismatches.join('; ')}` : ''}`}`,
  `capture failures: ${captureErrors.length}${captureErrors.length ? `\n    ${captureErrors.slice(0, 20).join('\n    ')}` : ''}`,
];
const verdict = (c) => `${c.pass ? 'PASS' : 'FAIL'}${c.evaluated < c.of ? ` (${c.evaluated} of ${c.of} pairs run)` : ''}`;
const controlLines = controls.map((c) => `${c.kind.toUpperCase()} seed ${c.seed}: ${verdict(c)} — ${c.label}; expect "${c.expect}"\n    ${describeControl(c).join('\n    ')}`);
const tallyLines = ['tier         pairs  ' + STATUSES.map((s) => s.padStart(19)).join('')]
  .concat(Object.entries(tally).map(([t, r]) => `${t.padEnd(12)} ${String(r.pairs).padStart(5)}  ${STATUSES.map((s) => String(r[s]).padStart(19)).join('')}`));
const section = (title, ls) => `${title} (${ls.length}):\n${ls.length ? ls.map((l) => `  ${l}`).join('\n') : '  (none)'}\n`;

let txt = header + '\n' + integrity.join('\n') + '\n\nCONTROLS\n' + controlLines.join('\n') + '\n\n';
txt += `SEED ${PRIMARY} TALLY over ${P42.length} contracted (scenario, species) pairs — H expects_species, D deterministic_species, S statistical_species\n${tallyLines.join('\n')}\n\n`;
const ghostCrystalTotal = P42.reduce((n, e) => n + e.ghosts, 0);
const ghostCrystalLine = `${ghostCrystalTotal} crystals of contracted species never stored a positive zone: `
  + `${lists.ghosts.reduce((n, e) => n + e.ghosts, 0)} in the ${lists.ghosts.length} species born but not grown, `
  + `${lists.ghostCrystals.reduce((n, e) => n + e.ghosts, 0)} beside grown crystals of ${lists.ghostCrystals.length} other species`;
txt += section('BORN, NOT GROWN — a nucleation, no stored positive zone', listLines(lists.ghosts, 'ghost'));
txt += section('GROWN, THEN CONVERTED IN PLACE — no crystal keeps the name (the product carries it)', listLines(lists.converted, 'converted'));
txt += section('GROWN, NOT VISIBLE — nothing of the name survives at ≥ 0.1 mm', listLines(lists.invisible, 'invisible'));
txt += section('GROWN, UNDER 1 MM — the largest survivor is ≥ 0.1 mm and < 1 mm', listLines(lists.under1, 'small'));
txt += section('NOT BORN at this seed', lists.notBorn.map((e) => `${e.scenario} ${e.mineral} (${tierLetter[e.tier]}${roleText(e)})`));
txt += section('VISIBLE ≥ 1 MM ONLY WHERE FLAGGED enclosed_by', lists.enclosedOnly.map((e) => `${e.scenario} ${e.mineral} (${tierLetter[e.tier]}): ${e.n1} ≥ 1 mm, all flagged; largest ${fmtMm(e.max_mm)} mm`));
txt += section('APPEARS ONLY BY CONVERSION', lists.byConversion.map((e) => `${e.scenario} ${e.mineral} (${tierLetter[e.tier]}): from ${Object.entries(e.conv_from).map(([m, n]) => `${m} (${n})`).join(', ')}; grown ${e.grown}; visible ${e.visible}`));
txt += section('NEGATIVE TIERS BORN (aspirational / excluded species that appeared)', negativeBirths.filter((b) => b.seed === PRIMARY).map((b) => `${b.scenario} ${b.mineral} (${b.tier}): ${b.nucleated} nucleated, ${b.conv_in} by conversion`));
txt += section(`GHOST CRYSTALS BESIDE GROWN ONES — ${ghostCrystalLine}`, lists.ghostCrystals.map((e) => `${e.scenario} ${e.mineral} (${tierLetter[e.tier]}): ${e.ghosts} of ${e.carried} never grew`));
if (panel) txt += section(`SEED PANEL ${seedsRun.join(', ')} — pairs not visible in every seed`, panel);
txt += `\nPER-SCENARIO TABLE (seed ${PRIMARY}): species tier role | born grown visible | crystals ghosts cand/skip/zones largest-mm\n`;
for (const name of names) {
  txt += `${name}\n`;
  for (const e of P42.filter((x) => x.scenario === name)) {
    txt += `  ${e.mineral.padEnd(16)} ${tierLetter[e.tier]} ${e.role.padEnd(11)} | ${e.born.padEnd(10)} ${e.grown.padEnd(9)} ${e.visible.padEnd(9)} | ${String(e.carried).padStart(3)} ${String(e.ghosts).padStart(3)} ${String(e.cand).padStart(4)}/${String(e.skipped).padStart(3)}/${String(e.pos_zones).padStart(4)} ${e.surv ? fmtMm(e.max_mm).padStart(8) : '       -'}  ${e.status}\n`;
  }
}

// Every seed's status counts over all tiers (a panel run only).
const STATUS_SHORT = { 'not born': 'absent', 'born, not grown': 'ghost', 'grown, converted': 'converted',
  'grown, not visible': '< 0.1 mm', 'grown, under 1 mm': '< 1 mm', visible: 'visible' };
const seedTally = seedsRun.map((seed) => [seed, at(seed).length, STATUSES.map((s) => at(seed).filter((e) => e.status === s).length)]);
const ghostKeys = [...new Set(entries.filter((e) => e.status === 'born, not grown').map((e) => `${e.scenario}|${e.mineral}`))];
const ghostAcross = ghostKeys.map((k) => {
  const es = entries.filter((e) => `${e.scenario}|${e.mineral}` === k);
  return `${es[0].scenario} ${es[0].mineral} (${tierLetter[es[0].tier]}): ${es.map((e) => `s${e.seed} ${STATUS_SHORT[e.status]}`).join(', ')}`;
});
if (seedsRun.length > 1) {
  txt += `\nSEED PANEL TALLY (all tiers): seed pairs ${STATUSES.join(' | ')}\n`
    + seedTally.map(([seed, n, counts]) => `  ${String(seed).padStart(4)} ${String(n).padStart(5)}  ${counts.join(' | ')}`).join('\n') + '\n';
  txt += section('PAIRS BORN BUT NOT GROWN AT ANY SEED', ghostAcross);
}

// The doc-ready fragment (the review's appendix): the seed-PRIMARY lists, the size lists grouped by
// scenario, the other seeds condensed to a tally and the ghosts.
const mdList = (ls) => (ls.length ? ls.map((l) => `- ${l}`).join('\n') : '- (none)');
const command = `node tools/born-grown-audit.mjs${opts.scenarios.length ? ` ${names.join(' ')}` : ''}${seedsRun.join(',') !== '42' ? ` --seeds ${seedsRun.join(',')}` : ''}`;
const short = (e) => `${e.mineral} (${tierLetter[e.tier]}${e.role === 'n/a' ? '' : `, ${e.role}`}`
  + `${e.record_median_mm != null && ['primary', 'alternate', 'showpiece'].includes(e.role) ? `, record ${e.record_median_mm} mm${e.record_basis === 'specimen-proxy' ? ' proxy' : ''}` : ''})`;
const byScenario = (es, fmt) => names.map((n) => [n, es.filter((e) => e.scenario === n)]).filter(([, g]) => g.length)
  .map(([n, g]) => `${n}: ${g.map(fmt).join('; ')}`);
let md = `**SIM ${SIM_VERSION}, seed${seedsRun.length > 1 ? 's' : ''} ${seedsRun.join(', ')}, ${names.length} scenarios** (\`${command}\`, Node ${node.replace(/^v/, '')}; inputs \`${INPUTS.slice(0, 12)}\`; story roles from ${story.source}).\n\n`;
md += `Integrity: ${integrity.map((l) => l.replace(/\n\s+/g, '; ')).join('; ')}.\n\n`;
md += 'Controls:\n';
for (const ctl of CONTROLS) {
  const cs = controls.filter((c) => c.label === ctl.label);
  if (!cs.length) continue;
  md += `- **${ctl.kind}: ${cs.map((c) => `${verdict(c)} at seed ${c.seed}`).join(', ')}** — ${ctl.label}; expect "${ctl.expect}".\n`;
  for (const c of cs) {
    if (c.seed === PRIMARY) md += describeControl(c).map((d) => `  - seed ${c.seed}: ${d}`).join('\n') + '\n';
    else md += `  - seed ${c.seed}: ${c.items.map((i) => `${i.scenario} ${i.mineral} ${i.entry ? STATUS_SHORT[i.entry.status] : 'not run'}${i.entry?.skipped ? ` (${i.entry.skipped} skips)` : ''}`).join('; ')}\n`;
  }
}
md += `\n| seed ${PRIMARY} | pairs | ${STATUSES.join(' | ')} |\n|---|---|${STATUSES.map(() => '---').join('|')}|\n`;
md += Object.entries(tally).map(([t, r]) => `| ${t} | ${r.pairs} | ${STATUSES.map((s) => r[s]).join(' | ')} |`).join('\n') + '\n\n';
md += 'H = expects_species, D = deterministic_species, S = statistical_species; a role is the PR #26 story-pocket role, "record" its median size target.\n\n';
md += `**Born, not grown (${lists.ghosts.length}):**\n${mdList(listLines(lists.ghosts, 'ghost'))}\n\n`;
md += `Crystal level: ${ghostCrystalLine}.\n\n`;
md += `**Grown, then converted in place (${lists.converted.length}):** ${lists.converted.map((e) => `${e.scenario} ${e.mineral} → ${Object.keys(e.conv_to).join(', ')}`).join('; ') || 'none'}.\n\n`;
md += `**Grown, not visible — nothing ≥ 0.1 mm survives (${lists.invisible.length}), largest survivor:**\n`
  + `${mdList(byScenario(lists.invisible, (e) => `${short(e)} ${e.visible === 'dissolved' ? `all ${e.final} dissolved` : `${fmtMm(e.max_mm)} mm`}`))}\n\n`;
md += `**Grown, under 1 mm (${lists.under1.length}), largest survivor in mm:**\n${mdList(byScenario(lists.under1, (e) => `${short(e)} ${fmtMm(e.max_mm)}`))}\n\n`;
md += `**Visible ≥ 1 mm only as crystals flagged \`enclosed_by\` (${lists.enclosedOnly.length})** — not visible under PR #26's stricter reading: `
  + `${lists.enclosedOnly.map((e) => `${e.scenario} ${e.mineral}`).join(', ') || 'none'}.\n`;
if (seedsRun.length > 1) {
  md += `\n**Seed panel ${seedsRun.join(', ')}** (all tiers):\n\n| seed | pairs | ${STATUSES.join(' | ')} |\n|---|---|${STATUSES.map(() => '---').join('|')}|\n`;
  md += seedTally.map(([seed, n, counts]) => `| ${seed} | ${n} | ${counts.join(' | ')} |`).join('\n') + '\n\n';
  md += `Pairs born but not grown at any seed (${ghostAcross.length}):\n${mdList(ghostAcross)}\n`;
}

fs.writeFileSync(path.join(OUT, 'report.txt'), txt);
fs.writeFileSync(path.join(OUT, 'report.md'), md);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({
  schema: 'vugg-born-grown-audit-report-v1', audit: AUDIT_VERSION, sim_version: SIM_VERSION, runtime: RUNTIME, node,
  model_digest_sha256: sha256(Array.isArray(MODEL_DIGEST) ? MODEL_DIGEST.join('\n') : String(MODEL_DIGEST)),
  inputs: INPUTS, seeds: seedsRun, scenarios: names, story_roles: { source: story.source, sha256: story.sha256 },
  integrity: { baseline: baselineTally, births: census, capture_errors: captureErrors },
  controls: controls.map((c) => ({ ...c, items: c.items.map(({ entry, ...i }) => ({ ...i, status: entry?.status ?? null })) })),
  tally, entries, negative_tier_births: negativeBirths,
}, null, 1));
console.log(`${header.trimEnd()}\n${integrity.join('\n')}\n${controls.map((c) => `${c.kind} seed ${c.seed}: ${verdict(c)}`).join(' · ')}\n`
  + `seed ${PRIMARY}: ${lists.ghosts.length} born-not-grown, ${lists.converted.length} grown-then-converted, ${lists.invisible.length} grown-not-visible, ${lists.under1.length} grown-under-1-mm of ${P42.length} pairs`
  + `${seedsRun.length > 1 ? `; born-not-grown by seed: ${seedTally.map(([seed, , counts]) => `s${seed} ${counts[1]}`).join(', ')}` : ''} `
  + `(${((Date.now() - t0) / 60000).toFixed(1)} min) → ${path.relative(ROOT, OUT).replaceAll('\\', '/')}/report.txt`);
