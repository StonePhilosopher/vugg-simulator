// tests-js/scenario-menu-coverage.test.ts — guard test for the
// scenario-picker menus (born at the v116 retrospective, when 15 scenarios
// were invisible in the UI because the menus were hand-synced HTML).
//
// §10.5 tranches 2-3 (Door 3, 2026-07-10): the three CURATED menu surfaces
// now AUTO-GENERATE from data/scenarios.json5's `menu_layout` block (the
// js/94-ui-menu.ts populators, called at scenarios-load-complete). The
// former hardcoded HTML ships as EMPTY containers. So this test moved from
// parsing index.html to validating menu_layout — the single source of
// truth the migration created. What it guards:
//
//   1. SCENARIOS PICKER PANEL (#scenarios-panel-groups) — the FULL picker.
//      menu_layout.panel covers every scenario (incl. tutorials), grouped;
//      tutorials live in their own group; starter fluids are a 4th group.
//   2. LEGENDS "quick play" dropdown (#scenario) — §10.5 TRANCHE 1: derives
//      from SCENARIOS at load; static <select> ships EMPTY. (unchanged)
//   3. ZEN dropdown (#idle-scenario) — curated labels, bespoke order,
//      EXCLUDES tutorials; menu_layout.idle; static <select> ships EMPTY.
//   4. BEGIN tutorial buttons (#begin-tutorial-buttons) — guided runs;
//      menu_layout.begin_tutorials; static container ships EMPTY.
//
// TUTORIAL = scenario whose name starts with "tutorial_".

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDoc(): any {
  const raw = fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8');
  const stripped = raw
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped);
}
function readFile(...p: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...p), 'utf8');
}
const isTutorial = (name: string) => name.startsWith('tutorial_');

const doc = loadDoc();
const scenarios = Object.keys(doc.scenarios || {}).sort();
const nonTutorial = scenarios.filter(s => !isTutorial(s));
const tutorials = scenarios.filter(isTutorial);
const ml = doc.menu_layout;
const html = readFile('index.html');

describe('menu_layout: shape', () => {
  it('has panel / idle / begin_tutorials', () => {
    expect(ml, 'data/scenarios.json5 is missing the menu_layout block (Door 3 §10.5 t2-3)').toBeTruthy();
    expect(Array.isArray(ml.panel)).toBe(true);
    expect(Array.isArray(ml.idle)).toBe(true);
    expect(Array.isArray(ml.begin_tutorials)).toBe(true);
  });

  it('panel groups are the expected four keys in order', () => {
    expect(ml.panel.map((g: any) => g.key)).toEqual(['real_locality', 'test', 'tutorial_broth', 'starter_fluids']);
    for (const g of ml.panel) expect(typeof g.heading, `group ${g.key} needs a heading`).toBe('string');
  });
});

describe('Scenarios picker panel (menu_layout.panel): full coverage', () => {
  const scenarioGroups = ml.panel.filter((g: any) => g.buttons);
  const panelIds = scenarioGroups.flatMap((g: any) => g.buttons.map((b: any) => b.scenario));

  it('every scenario (INCLUDING tutorials) appears exactly once', () => {
    const set = new Set(panelIds);
    const missing = scenarios.filter(s => !set.has(s));
    const dups = panelIds.filter((id: string, i: number) => panelIds.indexOf(id) !== i);
    expect(missing, `scenarios with no picker button: ${missing.join(', ')}`).toEqual([]);
    expect(dups, `scenarios with duplicate buttons: ${dups.join(', ')}`).toEqual([]);
    expect(panelIds.length).toBe(scenarios.length);
  });

  it('no stale buttons (every button references a real scenario)', () => {
    const stale = panelIds.filter((id: string) => !scenarios.includes(id));
    expect(stale, `buttons referencing missing scenarios: ${stale.join(', ')}`).toEqual([]);
  });

  it('tutorial policy: the tutorial_broth group is exactly the tutorial_* scenarios', () => {
    const broth = ml.panel.find((g: any) => g.key === 'tutorial_broth').buttons.map((b: any) => b.scenario).sort();
    expect(broth).toEqual(tutorials);
    // and no tutorial leaks into the real-locality / test groups
    for (const key of ['real_locality', 'test']) {
      const leaked = ml.panel.find((g: any) => g.key === key).buttons.map((b: any) => b.scenario).filter(isTutorial);
      expect(leaked, `tutorial(s) in the ${key} group: ${leaked.join(', ')}`).toEqual([]);
    }
  });

  it('every panel button carries non-empty display text', () => {
    const blank = scenarioGroups.flatMap((g: any) => g.buttons).filter((b: any) => !b.text || !b.text.trim());
    expect(blank.map((b: any) => b.scenario)).toEqual([]);
  });

  it('starter_fluids group: 4 items, each preset + text', () => {
    const fl = ml.panel.find((g: any) => g.key === 'starter_fluids');
    expect(fl.fluids.length).toBe(4);
    for (const f of fl.fluids) {
      expect(typeof f.preset).toBe('string');
      expect(f.text && f.text.trim().length, `fluid ${f.preset} needs text`).toBeTruthy();
    }
  });
});

describe('Zen dropdown (menu_layout.idle): non-tutorials, bespoke order', () => {
  it('first entry is the random head option', () => {
    expect(ml.idle[0].value).toBe('random');
    expect(ml.idle[0].text.trim().length).toBeTruthy();
  });

  it('every NON-TUTORIAL scenario has exactly one idle entry', () => {
    const idleIds = ml.idle.filter((o: any) => o.scenario).map((o: any) => o.scenario);
    const set = new Set(idleIds);
    const missing = nonTutorial.filter(s => !set.has(s));
    const dups = idleIds.filter((id: string, i: number) => idleIds.indexOf(id) !== i);
    expect(missing, `non-tutorial scenarios missing from zen dropdown: ${missing.join(', ')}`).toEqual([]);
    expect(dups, `duplicate idle entries: ${dups.join(', ')}`).toEqual([]);
  });

  it('tutorials are EXCLUDED, and no stale entries', () => {
    const idleIds = ml.idle.filter((o: any) => o.scenario).map((o: any) => o.scenario);
    expect(idleIds.filter(isTutorial), 'tutorial(s) leaked into zen dropdown').toEqual([]);
    expect(idleIds.filter((id: string) => !scenarios.includes(id)), 'stale idle entries').toEqual([]);
  });

  it('every idle entry carries a curated label', () => {
    const blank = ml.idle.filter((o: any) => !o.text || !o.text.trim());
    expect(blank).toEqual([]);
  });
});

describe('Begin tutorial buttons (menu_layout.begin_tutorials): guided runs', () => {
  it('each references a real scenario that has a guided tutorial (steps)', () => {
    for (const t of ml.begin_tutorials) {
      const spec = doc.scenarios[t.scenario];
      expect(spec, `begin tutorial references missing scenario '${t.scenario}'`).toBeTruthy();
      expect(spec.tutorial, `'${t.scenario}' is in Begin tutorials but has no tutorial block`).toBeTruthy();
      expect(Array.isArray(spec.tutorial.steps) && spec.tutorial.steps.length > 0,
        `'${t.scenario}' tutorial has no steps`).toBe(true);
      expect(t.text && t.text.trim().length, `begin tutorial '${t.scenario}' needs text`).toBeTruthy();
    }
  });
});

describe('Render invariants (index.html): static surfaces ship EMPTY, generated at runtime', () => {
  it('#scenario (quick play) ships empty — §10.5 tranche 1', () => {
    const m = html.match(/<select[^>]+id="scenario"[\s\S]*?<\/select>/);
    expect(m, '#scenario select not found').toBeTruthy();
    expect(/<option\s/.test(m![0]), '#scenario must ship empty (auto-generated)').toBe(false);
  });

  it('#idle-scenario (zen) ships empty — §10.5 tranche 3', () => {
    const m = html.match(/<select[^>]+id="idle-scenario"[\s\S]*?<\/select>/);
    expect(m, '#idle-scenario select not found').toBeTruthy();
    expect(/<option\s/.test(m![0]), '#idle-scenario must ship empty (auto-generated)').toBe(false);
  });

  it('#scenarios-panel-groups + #begin-tutorial-buttons ship as empty containers', () => {
    expect(html.includes('<div id="scenarios-panel-groups"></div>'),
      '#scenarios-panel-groups must be an empty container (panel auto-generates)').toBe(true);
    expect(html.includes('<div class="menu-buttons" id="begin-tutorial-buttons"></div>'),
      '#begin-tutorial-buttons must be an empty container (buttons auto-generate)').toBe(true);
  });
});

describe('Populator wiring: the generators exist and run at load', () => {
  const menuSrc = readFile('js', '94-ui-menu.ts');
  const eventsSrc = readFile('js', '70-events.ts');

  it('#scenario populator exists, excludes tutorials, is called at load (tranche 1)', () => {
    expect(menuSrc).toMatch(/function _populateScenarioDropdowns\(/);
    expect(menuSrc).toMatch(/function _populateScenarioDropdowns\([\s\S]{0,600}startsWith\('tutorial_'\)/);
    expect(eventsSrc).toMatch(/_scenariosJson5Ready = true;[\s\S]{0,900}_populateScenarioDropdowns/);
  });

  it('the three tranche 2-3 populators exist and read MENU_LAYOUT', () => {
    for (const fn of ['_populateScenariosPanel', '_populateIdleScenarioDropdown', '_populateBeginTutorials']) {
      expect(menuSrc, `${fn} missing`).toMatch(new RegExp(`function ${fn}\\(`));
      expect(menuSrc, `${fn} should read MENU_LAYOUT`).toMatch(new RegExp(`function ${fn}\\([\\s\\S]{0,400}MENU_LAYOUT`));
    }
    expect(eventsSrc, 'MENU_LAYOUT must be assigned from the parsed doc').toMatch(/MENU_LAYOUT = doc\.menu_layout/);
    for (const fn of ['_populateScenariosPanel', '_populateIdleScenarioDropdown', '_populateBeginTutorials']) {
      expect(eventsSrc, `${fn} not called at load`).toMatch(new RegExp(fn));
    }
  });

  it('zen-mode random picker (js/98a-ui-zen.ts) filters tutorial_* keys', () => {
    const src = readFile('js', '98a-ui-zen.ts');
    const hasFilter = /Object\.keys\(SCENARIOS\)\.filter\([^)]*tutorial_/.test(src) ||
                      /startsWith\(['"]tutorial_['"]\)/.test(src);
    expect(hasFilter, "zen random pick must skip tutorial_* (boss directive 2026-05-20)").toBe(true);
  });
});
