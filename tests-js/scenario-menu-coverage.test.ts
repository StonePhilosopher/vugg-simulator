// tests-js/scenario-menu-coverage.test.ts — guard test for the
// chronic-bug scenario-menu coverage gap (caught at v116 retrospective).
//
// PROBLEM: data/scenarios.json5 holds the scenario data, but the
// scenario PICKER menus in index.html are hardcoded with onclick handlers
// and <option> entries. Every scenario added via vugg-add-scenario skill
// must ALSO be added to the menus manually — and historically wasn't.
// Before this test landed, 15 scenarios in the codebase were invisible
// in the UI menus.
//
// THREE MENU SURFACES (each with different tutorial-policy):
//
//   1. SCENARIOS PICKER PANEL (scenarios-panel, Creative mode buttons).
//      The "full picker." MUST contain every scenario including tutorials.
//      Tutorials live in a dedicated subsection.
//
//   2. LEGENDS-CONTROLS DROPDOWN (#scenario, the at-top-of-page
//      "quick play" selector). EXCLUDES tutorials — quick play is for
//      running real scenarios, not guided introductions.
//      §10.5 TRANCHE 1 (2026-07-07): this surface AUTO-GENERATES from
//      SCENARIOS at load-complete (_populateScenarioDropdowns in
//      js/94-ui-menu.ts). The static <select> must ship EMPTY; the
//      tests below guard the single-source-of-truth invariant + the
//      populator's existence, call site, and tutorial exclusion.
//
//   3. ZEN MODE DROPDOWN (#idle-scenario). EXCLUDES tutorials —
//      zen mode is the screensaver-style infinite run; tutorials
//      don't belong in a screensaver.
//
// Plus zen mode's 'random' picker in js/98a-ui-zen.ts must filter
// tutorial_* keys (separate non-test guarantee — checked via code
// review, not this test).
//
// TUTORIAL = scenario whose name starts with "tutorial_".
//
// The vugg-add-scenario skill §10.5 documents which menus need which
// scenarios. This test guards the skill.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadScenarioNames(): string[] {
  const raw = fs.readFileSync(path.join(ROOT, 'data', 'scenarios.json5'), 'utf8');
  // Same JSONC-stripping the bundle uses (sufficient for spec parsing)
  const stripped = raw
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
  const parsed = JSON.parse(stripped);
  return Object.keys(parsed.scenarios || {}).sort();
}

function loadMenuButtonScenarios(): Set<string> {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = new Set<string>();
  // Allow digits in the captured group — scenario names like
  // `tn457_barite_pulses` (v118) carry the specimen number in them.
  const re = /startScenarioInCreative\(['"]([a-z0-9_]+)['"]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return out;
}

function loadOptionsFromSelect(selectId: string): Set<string> {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(new RegExp(`<select[^>]+id="${selectId}"[\\s\\S]*?<\\/select>`));
  if (!m) return new Set();
  const block = m[0];
  const out = new Set<string>();
  // Allow digits — scenario names like `tn457_barite_pulses` carry numbers.
  const re = /<option\s+value="([a-z0-9_]+)"/g;
  let opt: RegExpExecArray | null;
  while ((opt = re.exec(block)) !== null) out.add(opt[1]);
  return out;
}

function isTutorial(name: string): boolean {
  return name.startsWith('tutorial_');
}

describe('Scenario menu coverage (v116 guard test)', () => {
  const scenarios = loadScenarioNames();
  const nonTutorialScenarios = scenarios.filter(s => !isTutorial(s));
  const tutorialScenarios = scenarios.filter(isTutorial);
  const menuButtons = loadMenuButtonScenarios();
  const legendsDropdown = loadOptionsFromSelect('scenario');     // "quick play"
  const idleDropdown = loadOptionsFromSelect('idle-scenario');   // zen mode

  it('Scenarios picker panel: every scenario (INCLUDING tutorials) has a startScenarioInCreative() button', () => {
    const missing = scenarios.filter(s => !menuButtons.has(s));
    if (missing.length > 0) {
      const msg =
        `MENU GAP (scenarios-panel buttons): ${missing.length} scenario(s) in ` +
        `data/scenarios.json5 have NO <button onclick="startScenarioInCreative('...')"> ` +
        `entry in index.html (around line 2657-2700). The Scenarios picker panel ` +
        `is the FULL picker and must contain every scenario including tutorials. ` +
        `Per vugg-add-scenario skill §10.5. Missing: ` + missing.join(', ');
      throw new Error(msg);
    }
    expect(missing).toEqual([]);
  });

  it('Legends-controls quick-play dropdown #scenario: ships EMPTY — options auto-generate from SCENARIOS (§10.5 tranche 1)', () => {
    // A hand-added static option would silently fight the populator
    // (it wipes the select at load-complete) — enforce the single
    // source of truth instead of the old manual-sync contract.
    const staticOptions = [...legendsDropdown];
    if (staticOptions.length > 0) {
      const msg =
        `STATIC OPTION(S) in #scenario: the quick-play dropdown auto-generates ` +
        `from SCENARIOS at load-complete (_populateScenarioDropdowns, ` +
        `js/94-ui-menu.ts) — hand-added <option>s are wiped at boot and mask ` +
        `the real list during tests. Remove: ` + staticOptions.join(', ');
      throw new Error(msg);
    }
    expect(staticOptions).toEqual([]);
  });

  it('#scenario populator: exists, excludes tutorials, and is called at scenarios-load-complete', () => {
    // The tutorial-EXCLUSION rule (boss directive 2026-05-20: tutorials
    // don't belong in quick play) moved from static HTML into the
    // populator — assert it against the source that now owns it.
    const menuSrc = fs.readFileSync(path.join(ROOT, 'js', '94-ui-menu.ts'), 'utf8');
    const eventsSrc = fs.readFileSync(path.join(ROOT, 'js', '70-events.ts'), 'utf8');
    expect(menuSrc).toMatch(/function _populateScenarioDropdowns\(/);
    expect(menuSrc).toMatch(/function _populateScenarioDropdowns\([\s\S]{0,600}startsWith\('tutorial_'\)/);
    expect(eventsSrc).toMatch(/_scenariosJson5Ready = true;[\s\S]{0,500}_populateScenarioDropdowns/);
  });

  it('Zen mode dropdown #idle-scenario: every NON-TUTORIAL has an <option>', () => {
    const missing = nonTutorialScenarios.filter(s => !idleDropdown.has(s));
    if (missing.length > 0) {
      const msg =
        `DROPDOWN GAP (#idle-scenario zen mode): ${missing.length} non-tutorial ` +
        `scenario(s) have NO <option value="..."> entry in the <select id="idle-scenario"> ` +
        `dropdown in index.html (around line 3532). Zen mode is the screensaver-` +
        `style infinite run; users should be able to pick from the full scenario ` +
        `catalog (minus tutorials). Per vugg-add-scenario skill §10.5. Missing: ` +
        missing.join(', ');
      throw new Error(msg);
    }
    expect(missing).toEqual([]);
  });

  it('Zen mode dropdown #idle-scenario: tutorials are EXCLUDED', () => {
    const accidentalTutorials = tutorialScenarios.filter(s => idleDropdown.has(s));
    if (accidentalTutorials.length > 0) {
      const msg =
        `TUTORIAL LEAKAGE (#idle-scenario zen mode): ${accidentalTutorials.length} ` +
        `tutorial scenario(s) accidentally appear in the zen-mode dropdown. ` +
        `Per boss directive 2026-05-20, tutorials must be EXCLUDED from zen mode ` +
        `(screensaver shouldn't randomly pop up tutorial intros). Remove these: ` +
        accidentalTutorials.join(', ');
      throw new Error(msg);
    }
    expect(accidentalTutorials).toEqual([]);
  });

  it('Zen mode random picker (js/98a-ui-zen.ts) filters tutorial_* keys', () => {
    // The 'random' value in the #idle-scenario dropdown triggers
    // idleCreateSim's random-pick branch. That code path must filter
    // tutorial_* from Object.keys(SCENARIOS), otherwise tutorials
    // can still leak in via the random pick.
    const src = fs.readFileSync(path.join(ROOT, 'js', '98a-ui-zen.ts'), 'utf8');
    const hasFilter = /Object\.keys\(SCENARIOS\)\.filter\([^)]*tutorial_/.test(src) ||
                      /startsWith\(['"]tutorial_['"]\)/.test(src);
    if (!hasFilter) {
      throw new Error(
        `js/98a-ui-zen.ts idleCreateSim 'random' branch does NOT filter tutorial_* ` +
        `from Object.keys(SCENARIOS). Per boss directive 2026-05-20, zen mode ` +
        `random selection must skip tutorials. Add a .filter(k => !k.startsWith('tutorial_')) ` +
        `to the random-pick branch.`
      );
    }
    expect(hasFilter).toBe(true);
  });

  it('No stale menu buttons (button references a scenario that no longer exists)', () => {
    const scenarioSet = new Set(scenarios);
    const stale = [...menuButtons].filter(s => !scenarioSet.has(s));
    if (stale.length > 0) {
      const msg =
        `STALE MENU BUTTONS: ${stale.length} startScenarioInCreative('...') ` +
        `button(s) in index.html reference scenarios that no longer exist in ` +
        `data/scenarios.json5. Remove the stale buttons OR add the scenarios ` +
        `back. Stale: ` + stale.join(', ');
      throw new Error(msg);
    }
    expect(stale).toEqual([]);
  });
});
