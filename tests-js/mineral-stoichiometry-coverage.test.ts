// tests-js/mineral-stoichiometry-coverage.test.ts — v120 audit guard.
//
// Every mineral engine MUST either:
//   (a) have an entry in MINERAL_STOICHIOMETRY (js/19-mineral-stoichiometry.ts), OR
//   (b) appear in the explicit DEFERRED_TUNE_REQUIRED list below WITH a
//       justification (typically: adding stoichiometry would shift the
//       rng cascade through baseline scenarios and break paragenesis pins,
//       so each deferred mineral needs scenario tune calibration).
//
// PURPOSE
// Without stoichiometry, growth doesn't debit the fluid composition and
// supersaturation never depletes from that mineral's own consumption —
// a silent free-energy gift. The v118 (TN457) gen-baseline run surfaced
// 23 such gifts via `[mass-balance] no stoichiometry for X` warnings.
// v120 (boss-approved Option 1) ships stoichiometry for 22 inactive-
// firing engines (zero cascade ripple) and EXPLICITLY DEFERS the 27
// active-firing engines via this list, where they wait for per-scenario
// tune commits (v121+).
//
// FAILURE MODE
// If a future engine ships without an entry AND without being added to
// DEFERRED_TUNE_REQUIRED, this test fails loud. That forces the
// stoichiometry decision through code review instead of silent omission.
//
// See proposals/HANDOFF-MINERAL-STOICHIOMETRY-BACKFILL.md for the
// per-mineral scenario mapping + tune-priority sequencing.

import { describe, expect, it } from 'vitest';

declare const MINERAL_ENGINES: any;

function getStoichiometryTable(): any {
  const direct = (globalThis as any).MINERAL_STOICHIOMETRY;
  if (!direct) {
    throw new Error('MINERAL_STOICHIOMETRY not on globalThis — verify tests-js/setup.ts EXPORTS includes it');
  }
  return direct;
}

// ============================================================
// DEFERRED_TUNE_REQUIRED — explicit list of minerals that have engine
// code but lack stoichiometry, gated on per-scenario tune calibration.
// ============================================================
// Adding stoichiometry for any of these in a commit MUST be accompanied
// by:
//   1. Removing the mineral from this list
//   2. Updating the affected scenarios' paragenesis pins (per the
//      HANDOFF doc's mineral -> scenario mapping)
//   3. Re-tuning the affected scenarios so canonical paragenesis still
//      fires (probe-diagnose-adjust-verify loop)
// One mineral per commit. Do NOT batch additions; v109 + abandoned v120
// prove that multiple stoichiometry additions cascade unpredictably.
const DEFERRED_TUNE_REQUIRED = new Set<string>([
  // Priority 1 — Jeffrey rodingite arc (v110-v115)
  'chrysotile', 'brucite', 'awaruite',
  'diopside', 'grossular', 'vesuvianite',
  'wollastonite', 'prehnite', 'pectolite', 'datolite',
  'tremolite', 'actinolite',
  // Priority 2 — Cumbria Pb-Zn-Ba-F supergene
  'caledonite', 'plumbogummite', 'pharmacolite', 'proustite',
  // Priority 3 — Tsumeb supergene + adjacent
  'dioptase', 'willemite', 'conichalcite', 'duftite', 'koettigite',
  'metacinnabar',
  // Priority 4 — Schneeberg + Colorado Plateau uranyl
  'uranophane',
  // Priority 5 — Naica, gem pegmatite, secondary firings
  'cassiterite', 'lepidolite', 'opal', 'pyrolusite', 'tigers_eye',
]);

describe('MINERAL_STOICHIOMETRY coverage audit (v120)', () => {
  it('exposes MINERAL_STOICHIOMETRY via setup.ts EXPORTS', () => {
    const table = getStoichiometryTable();
    expect(table).toBeTruthy();
    expect(typeof table).toBe('object');
    expect(Object.keys(table).length).toBeGreaterThan(60);
  });

  it('every MINERAL_ENGINES key is either covered OR explicitly deferred', () => {
    const engines = (globalThis as any).MINERAL_ENGINES;
    expect(engines).toBeTruthy();
    const table = getStoichiometryTable();

    const uncovered: string[] = [];
    for (const mineral of Object.keys(engines)) {
      if (table[mineral]) continue;
      if (DEFERRED_TUNE_REQUIRED.has(mineral)) continue;
      uncovered.push(mineral);
    }

    if (uncovered.length > 0) {
      const msg =
        `MASS-BALANCE COVERAGE GAP: ${uncovered.length} mineral engine(s) ` +
        `lack a MINERAL_STOICHIOMETRY entry AND are not on the ` +
        `DEFERRED_TUNE_REQUIRED list. Either: (a) add an entry to ` +
        `js/19-mineral-stoichiometry.ts using the formula from data/minerals.json ` +
        `(omit O/H/pH/hydration per file conventions), OR ` +
        `(b) if adding stoichiometry would cascade through baseline ` +
        `scenarios, add the mineral to DEFERRED_TUNE_REQUIRED above + ` +
        `update proposals/HANDOFF-MINERAL-STOICHIOMETRY-BACKFILL.md ` +
        `with the affected scenarios and tune priority. Missing: ` +
        uncovered.sort().join(', ');
      throw new Error(msg);
    }
    expect(uncovered).toEqual([]);
  });

  it('DEFERRED list does not double-include minerals that already have entries', () => {
    const table = getStoichiometryTable();
    const collisions: string[] = [];
    for (const mineral of DEFERRED_TUNE_REQUIRED) {
      if (table[mineral]) collisions.push(mineral);
    }
    if (collisions.length > 0) {
      throw new Error(
        `DEFERRED list collision: ${collisions.length} mineral(s) appear in ` +
        `BOTH the DEFERRED_TUNE_REQUIRED list AND MINERAL_STOICHIOMETRY. When ` +
        `a tune commit adds the stoichiometry entry, it must REMOVE the ` +
        `mineral from the DEFERRED list. Colliding: ` + collisions.join(', ')
      );
    }
    expect(collisions).toEqual([]);
  });

  describe('v120 backfill spot-checks (inactive-firing subset)', () => {
    it('Carbonate-class additions: strontianite, witherite, hydrozincite, leadhillite', () => {
      const t = getStoichiometryTable();
      expect(t.strontianite).toEqual({ Sr: 1, CO3: 1 });
      expect(t.witherite).toEqual({ Ba: 1, CO3: 1 });
      expect(t.hydrozincite).toEqual({ Zn: 5, CO3: 2 });
      expect(t.leadhillite).toEqual({ Pb: 4, S: 1, CO3: 2 });
    });

    it('Sulfide-class additions: di-arsenide quartet + sulfosalts', () => {
      const t = getStoichiometryTable();
      expect(t.loellingite).toEqual({ Fe: 1, As: 2 });
      expect(t.rammelsbergite).toEqual({ Ni: 1, As: 2 });
      expect(t.safflorite).toEqual({ Co: 1, As: 2 });
      expect(t.skutterudite).toEqual({ Co: 1, As: 3 });
      expect(t.pyrargyrite).toEqual({ Ag: 3, Sb: 1, S: 3 });
      expect(t.enargite).toEqual({ Cu: 3, As: 1, S: 4 });
    });

    it('Oxide-class additions: chromite, rutile, coffinite', () => {
      const t = getStoichiometryTable();
      expect(t.chromite).toEqual({ Fe: 1, Cr: 2 });
      expect(t.rutile).toEqual({ Ti: 1 });
      expect(t.coffinite).toEqual({ U: 1, SiO2: 1 });
    });

    it('Silicate-class additions: Zn/Cu silicates + amphibole asbestos trio', () => {
      const t = getStoichiometryTable();
      expect(t.hemimorphite).toEqual({ Zn: 4, SiO2: 2 });
      expect(t.shattuckite).toEqual({ Cu: 5, SiO2: 4 });
      expect(t.amosite).toEqual({ Fe: 6, Mg: 1, SiO2: 8 });
      expect(t.anthophyllite).toEqual({ Mg: 6, Fe: 1, SiO2: 8 });
      expect(t.crocidolite).toEqual({ Na: 2, Fe: 5, SiO2: 8 });
    });

    it('Arsenate/Pb-Cu sulfate additions: austinite, bayldonite, legrandite, linarite', () => {
      const t = getStoichiometryTable();
      expect(t.austinite).toEqual({ Ca: 1, Zn: 1, As: 1 });
      expect(t.bayldonite).toEqual({ Cu: 3, Pb: 1, As: 2 });
      expect(t.legrandite).toEqual({ Zn: 2, As: 1 });
      expect(t.linarite).toEqual({ Pb: 1, Cu: 1, S: 1 });
    });
  });

  it('no entry uses raw O, raw H, or pH as a coefficient (file convention)', () => {
    const t = getStoichiometryTable();
    const banned = ['O', 'H', 'pH'];
    const violations: Array<{ mineral: string; field: string }> = [];
    for (const [mineral, coeffs] of Object.entries(t)) {
      if (!coeffs || typeof coeffs !== 'object') continue;
      // Skip __modes sub-tables and similar non-stoichiometry keys
      if (mineral.startsWith('__')) continue;
      // The MINERAL_DISSOLUTION_RATES table reuses some entries with
      // negative coefficients — that's fine. Just check the banned keys.
      for (const field of banned) {
        if ((coeffs as any)[field] != null) {
          violations.push({ mineral, field });
        }
      }
    }
    if (violations.length > 0) {
      throw new Error(
        `STOICHIOMETRY CONVENTION VIOLATION: ${violations.length} entry/entries ` +
        `use a banned field (O, H, or pH). Per js/19-mineral-stoichiometry.ts ` +
        `file header: O comes from water/redox, H is activity not mole, ` +
        `pH is not a reservoir. Violations: ` +
        violations.map(v => `${v.mineral}.${v.field}`).join(', ')
      );
    }
    expect(violations).toEqual([]);
  });

  it('DEFERRED list size matches HANDOFF doc count (28 minerals at v120)', () => {
    // Tracking number — if you reduce the list (tune commit lands), update
    // this number AND update the HANDOFF doc to reflect the new total.
    expect(DEFERRED_TUNE_REQUIRED.size).toBe(28);
  });
});
