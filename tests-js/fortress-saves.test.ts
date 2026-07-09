// tests-js/fortress-saves.test.ts — save system (93a-ui-saves.ts, 2026-07-08)
//
// The claim under test is the save system's whole premise: a save is a
// RECIPE (seed + action log + broth deltas), and replaying it through
// the real fortressStep path reproduces the run EXACTLY — same steps,
// same crystals, same zone counts, same fluid state. If any hidden
// input isn't captured (a Date.now() seed, a slider the recording
// missed, an rng consumer outside the replayed order), the fingerprint
// comparison here goes red.
//
// jsdom notes:
//  - setup.ts's DOM stub returns throwaway proxies for missing ids, so
//    broth sliders "don't exist" unless a test creates real elements.
//    fortressStep's finite-parse guard (added with this feature) skips
//    them identically on both sides of the save boundary. One REAL
//    slider (#broth-fe) is installed below to exercise the capture →
//    delta → replay path end to end.
//  - setFortressInstantLines(true) keeps the narrative-tempo player
//    synchronous — sim state is what's asserted, not pacing theater.
//  - Bundle-internal `let` bindings (fortressSim, fortressActive) are
//    read via the _live* accessors — the globalThis copies setup.ts
//    exports are load-time snapshots that go stale (the _liveRng
//    precedent).

import { beforeEach, describe, expect, it } from 'vitest';

declare function fortressBeginFromScenario(name: string, seed?: number): void;
declare function fortressBeginFromStarterFluid(presetId: string, seed?: number): void;
declare function fortressStep(action: string, payload?: any): void;
declare function fortressFinish(): void;
declare function fortressReset(): void;
declare function setFortressInstantLines(v: boolean): void;
declare function _liveFortressSim(): any;
declare function _liveFortressActive(): boolean;
declare function loadSaves(): any[];
declare function loadCrystals(): any[];
declare function loadLifetimeStats(): { crystals_collected: number; runs_finished: number };
declare function _saveManualNamed(name: string): any;
declare function loadSaveById(id: string): boolean;
declare function collectAllCrystals(crystals: any[], metaFn: any, opts?: any): { count: number; newSpecies: string[] };
declare function _libraryProgressHTML(opts?: any): string;

// Real broth sliders so the recording has something genuine to capture.
// Held by module-scoped references — setup.ts's DOM stub wraps
// document.querySelector so a "does it exist" query always returns a
// truthy stub, which would silently skip creation (elements must be
// REAL and appended for the bundle's realGetById fallback to find them).
//
// broth-temp matters specifically: its toSlider rounds (Math.round(T)),
// so after every action the slider holds a quantized ECHO of fractional
// sim temperature. The first live eye-check caught replay force-feeding
// that echo back into the sim (T 178.785 → 179); with this slider real,
// the fingerprint comparison below guards that class forever.
const _sliders: Record<string, HTMLInputElement> = {};
function ensureSlider(key: string, min: string, max: string, value: string): HTMLInputElement {
  let el = _sliders[key];
  if (!el || !el.isConnected) {
    el = document.createElement('input');
    el.id = 'broth-' + key;
    el.setAttribute('min', min);
    el.setAttribute('max', max);
    document.body.appendChild(el);
    _sliders[key] = el;
  }
  el.value = value;
  return el;
}
function ensureFeSlider(): HTMLInputElement {
  ensureSlider('temp', '25', '600', '300');
  return ensureSlider('fe', '0', '500', '0');
}

function fingerprint(sim: any) {
  return {
    step: sim.step,
    temperature: +sim.conditions.temperature.toFixed(6),
    pH: +sim.conditions.fluid.pH.toFixed(6),
    Fe: +sim.conditions.fluid.Fe.toFixed(6),
    Ca: +sim.conditions.fluid.Ca.toFixed(6),
    pressure: +sim.conditions.pressure.toFixed(6),
    crystals: (sim.crystals || []).map((c: any) => [
      c.mineral,
      +(c.c_length_mm || 0).toFixed(6),
      +(c.total_growth_um || 0).toFixed(4),
      (c.zones || []).length,
      !!c.twinned,
    ]),
  };
}

// Grown = collectable by the collectAllCrystals gate.
function grownCount(sim: any): number {
  return (sim.crystals || []).filter(
    (c: any) => (c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0,
  ).length;
}

beforeEach(() => {
  localStorage.clear();
  setFortressInstantLines(true);
  fortressReset();
  ensureFeSlider();
});

describe('fortress save system (93a) — event-sourced replay', () => {
  it('round-trips a run exactly: seed + actions + broth deltas → identical fingerprint', () => {
    fortressBeginFromScenario('cooling', 424242);
    expect(loadSaves().length).toBe(1); // autosave opened at begin
    expect(loadSaves()[0].kind).toBe('auto');

    // A varied run: time, temperature verbs, a broth-slider change
    // mid-run (the re-sync loop feeds it to the sim on the next
    // action), pH tweaks, a seismic tap (rng-consuming twinning roll).
    fortressStep('wait');
    fortressStep('wait');
    fortressStep('heat');
    fortressStep('wait_10');
    ensureFeSlider().value = '120';
    fortressStep('wait');
    fortressStep('tweak_acidify');
    fortressStep('wait');
    fortressStep('tap');
    fortressStep('wait');

    const simA = _liveFortressSim();
    const before = fingerprint(simA);
    expect(before.step).toBeGreaterThan(0);
    expect(before.Fe).toBeGreaterThan(0); // the slider injection reached the sim

    const manual = _saveManualNamed('round-trip probe');
    expect(manual).toBeTruthy();
    expect(manual.kind).toBe('manual');
    // The broth delta for Fe must be IN the action log (not just final state).
    const hasFeDelta = manual.actions.some((a: any) => a.b && a.b.fe === '120');
    expect(hasFeDelta).toBe(true);

    fortressReset();
    ensureFeSlider().value = '0'; // dirty the slider — replay must restore it
    expect(_liveFortressSim()).toBeNull();

    expect(loadSaveById(manual.id)).toBe(true);
    const after = fingerprint(_liveFortressSim());
    expect(after).toEqual(before);
  });

  it('starter-fluid runs round-trip too (wall shape_seed derives from the run seed)', () => {
    fortressBeginFromStarterFluid('carbonate', 777001);
    for (let i = 0; i < 6; i++) fortressStep('wait');
    fortressStep('cool');
    for (let i = 0; i < 4; i++) fortressStep('wait');

    const before = fingerprint(_liveFortressSim());
    const manual = _saveManualNamed('starter probe');
    fortressReset();
    expect(loadSaveById(manual.id)).toBe(true);
    expect(fingerprint(_liveFortressSim())).toEqual(before);
  });

  it('the rolling autosave updates in place on every action', () => {
    fortressBeginFromScenario('cooling', 11);
    const id0 = loadSaves()[0].id;
    fortressStep('wait');
    fortressStep('wait');
    let saves = loadSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].id).toBe(id0);
    expect(saves[0].actions.length).toBe(2);
    fortressStep('heat');
    saves = loadSaves();
    expect(saves[0].actions.length).toBe(3);
    expect(saves[0].status).toBe('in-progress');
  });

  it('Narrate, Collect & Save: finish collects every crystal, seals the save, bumps lifetime counters — once', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const sim = _liveFortressSim();
    const grown = grownCount(sim);
    expect(grown).toBeGreaterThan(0); // cooling grows quartz early

    fortressFinish();

    // Collected: every grown crystal is marked + in the Library.
    for (const c of sim.crystals) {
      if ((c.total_growth_um || 0) > 0.1 || (c.zones || []).length > 0) {
        expect(c._collectedRecordId).toBeTruthy();
      }
    }
    expect(loadCrystals().length).toBe(grown);

    // Saved: the autosave sealed as finished.
    const saves = loadSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].status).toBe('finished');
    expect(saves[0].collected.length).toBe(grown);

    // Scored: the lifetime counters moved.
    const stats = loadLifetimeStats();
    expect(stats.crystals_collected).toBe(grown);
    expect(stats.runs_finished).toBe(1);

    // Idempotence: a second click must not double anything.
    fortressFinish();
    expect(loadCrystals().length).toBe(grown);
    expect(loadLifetimeStats().runs_finished).toBe(1);
  });

  it('a finished save restores as a finished run (re-narrated, nothing re-collected or re-counted)', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    fortressFinish();
    const sealed = loadSaves()[0];
    const libBefore = loadCrystals().length;
    const statsBefore = loadLifetimeStats();

    expect(loadSaveById(sealed.id)).toBe(true);

    expect(_liveFortressActive()).toBe(false); // run is over — actions stay sealed
    expect(loadCrystals().length).toBe(libBefore); // no duplicate specimens
    expect(loadLifetimeStats()).toEqual(statsBefore); // no double count
    // The replayed crystals remember their Library records.
    const marked = _liveFortressSim().crystals.filter((c: any) => c._collectedRecordId).length;
    expect(marked).toBe(sealed.collected.length);
  });

  it('lifetime crystals_collected never decrements — deleting a specimen does not un-find it', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const res = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    expect(res.count).toBeGreaterThan(0);
    expect(loadLifetimeStats().crystals_collected).toBe(res.count);

    // jsdom's confirm() is a no-op stub, so delete the way the Library
    // ultimately does (filter + persist) — the stat must hold.
    const rec = loadCrystals()[0];
    localStorage.setItem('vugg-crystals-v1', JSON.stringify(loadCrystals().filter(c => c.id !== rec.id)));
    expect(loadCrystals().length).toBe(res.count - 1);
    expect(loadLifetimeStats().crystals_collected).toBe(res.count);
  });

  it('collectAllCrystals returns {count,newSpecies}; a second silent batch is a clean zero', () => {
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const res = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    expect(typeof res.count).toBe('number');
    expect(Array.isArray(res.newSpecies)).toBe(true);
    expect(res.newSpecies.length).toBeGreaterThan(0); // first collect of these species
    const again = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    expect(again).toEqual({ count: 0, newSpecies: [] });
  });

  it('the collection banner carries the lifetime total; home-screen variant is numeric from zero (boss ask 2026-07-08)', () => {
    const strip = (html: string) => html.replace(/<[^>]+>/g, '');

    // Fresh profile, home-screen variant: real zeros, not teaching prose.
    const zero = strip(_libraryProgressHTML({ numericWhenEmpty: true }));
    expect(zero).toMatch(/0 \/ \d+ species \(0%\)/);
    expect(zero).toMatch(/0 \/ \d+ twinned variants \(0%\)/);
    expect(zero).toContain('0 crystals all-time');
    expect(zero).not.toContain('Empty');

    // Library default keeps the teaching prose when nothing was ever found.
    expect(strip(_libraryProgressHTML())).toContain('Empty — grow a vugg');

    // Collect a run → the total lands in both variants.
    fortressBeginFromScenario('cooling', 424242);
    for (let i = 0; i < 14; i++) fortressStep('wait');
    const res = collectAllCrystals(_liveFortressSim().crystals, () => ({ mode: 'creative' }), { silent: true });
    const after = strip(_libraryProgressHTML());
    expect(after).toContain(`${res.count} crystal${res.count === 1 ? '' : 's'} all-time`);

    // Wipe the shelf: prose returns, but the life list survives — the
    // specimens are gone, the finding of them isn't.
    localStorage.setItem('vugg-crystals-v1', JSON.stringify([]));
    const wiped = strip(_libraryProgressHTML());
    expect(wiped).toContain('Empty — grow a vugg');
    expect(wiped).toContain(`${res.count} crystal${res.count === 1 ? '' : 's'} all-time`);
  });
});
