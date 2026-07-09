// tools/o5-film-census.mjs — W-F O5a instrument (pre-registration census).
//
// O5's masking gate (js/44b sigmaStarForCoverage, behind O5_MASKING_ENABLED) is
// recorded-but-unread in O5a. Before O5b flips the flag, this probe answers the
// pre-registration question the two-commit discipline requires: WHICH scenarios
// carry `_film` at seed 42, and how much — so O5b's baseline movers are bounded
// in advance (a scenario with zero film MUST stay byte-identical when the gate
// goes live; only film-carrying scenarios may move).
//
// Two film writers exist in O5a:
//   1. the event `film:` dusting directive (js/85d) — NO fleet scenario uses it
//      yet (Sweetwater, O5b's first content, is unbuilt), so this column is 0
//      today; the tool scans SCENARIOS for the directive so it lights up the day
//      Sweetwater lands.
//   2. O4b `coats_front` enclosures (js/85c writer 2) — a guest nucleated ON its
//      host deposits termination-film on the host. These fire on the CURRENT
//      fleet (14 fleet-wide at seed 42 per the O4b census), so this is O5's
//      organic film today.
//
// Pure read: runs each scenario, inspects `_film` on the final crystal list +
// the scenario's declared events. No RNG, no mutation, byte-identical to a plain
// run (O5a itself is byte-identical — this only observes it).
//
// Usage: node tools/o5-film-census.mjs [--seed N] [--verbose]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const VERBOSE = process.argv.includes('--verbose');

const bundle = await loadSimBundle({ toolName: 'o5-film-census' });
const { SCENARIOS, VugSimulator, setSeed } = bundle;

const rows = [];
let fleetFilmed = 0, fleetDirectives = 0;

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { continue; }

  // Directive scan (writer 1): does this scenario declare any `film:` dusting?
  const directives = (scen.events || []).filter((e) => e && e.film).map((e) => ({
    step: e.step, mineral: e.film.mineral || 'chlorite',
    prism: e.film.prism ?? 0, term: e.film.term ?? 0,
    minerals: e.film.minerals || 'all',
  }));

  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();

  // Writer 2 (+ writer 1 if any) result: which crystals ended with `_film`.
  const filmed = sim.crystals.filter((c) => c && c._film);
  const coatsFront = filmed.filter((c) => {
    // A film whose mineral != a dusting mineral AND the host has coats_front
    // guests is a writer-2 (front-coating) film. Simple heuristic for the census.
    return sim.crystals.some((g) => g.enclosed_by === c.crystal_id) === false
      && (c.enclosed_crystals && c.enclosed_crystals.length > 0);
  });
  const phiTerms = filmed.map((c) => c._film.phi_term || 0).filter((x) => x > 0);

  if (filmed.length || directives.length) {
    fleetFilmed += filmed.length;
    fleetDirectives += directives.length;
    rows.push({ name, filmed: filmed.length, directives, phiTerms,
      hostsWithGuests: coatsFront.length, crystals: sim.crystals.length,
      samples: filmed.slice(0, 6).map((c) => ({
        id: c.crystal_id, m: c.mineral, film: c._film.mineral,
        t: +(c._film.phi_term || 0).toFixed(2), p: +(c._film.phi_prism || 0).toFixed(2),
        step: c._film.step,
      })) });
  }
}

const fmtRange = (a) => a.length
  ? `${Math.min(...a).toFixed(2)}–${Math.max(...a).toFixed(2)}` : '—';

console.log(`\nO5 FILM CENSUS — seed ${SEED} (pre-registration for the O5b gate)`);
console.log('='.repeat(78));
if (!rows.length) {
  console.log('No scenario carries _film at this seed. (Expected until O4b coats_front');
  console.log('enclosures fire and/or a film: directive scenario like Sweetwater lands.)');
} else {
  console.log('scenario                      filmed  film:dir  φ_term range   host-coats');
  console.log('-'.repeat(78));
  rows.sort((a, b) => b.filmed - a.filmed);
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(28)}  ${String(r.filmed).padStart(6)}  ${String(r.directives.length).padStart(8)}` +
      `  ${fmtRange(r.phiTerms).padStart(12)}  ${String(r.hostsWithGuests).padStart(9)}`,
    );
    for (const d of r.directives) {
      console.log(`${''.padEnd(28)}  · film: directive step ${d.step} — ${d.mineral} prism ${d.prism} term ${d.term} on ${Array.isArray(d.minerals) ? d.minerals.join('/') : d.minerals}`);
    }
    if (VERBOSE) {
      for (const s of r.samples) {
        console.log(`${''.padEnd(30)}#${s.id} ${s.m}: film=${s.film} φt=${s.t} φp=${s.p} @step ${s.step}`);
      }
    }
  }
  console.log('-'.repeat(78));
  console.log(`TOTAL: ${fleetFilmed} crystals filmed across ${rows.length} scenario(s); ${fleetDirectives} film: directive(s) fleet-wide.`);
}
console.log('\nPRE-REGISTRATION: when O5b flips O5_MASKING_ENABLED, ONLY the scenarios listed');
console.log('above may move in the baseline; all others must stay byte-identical.');
console.log('');
