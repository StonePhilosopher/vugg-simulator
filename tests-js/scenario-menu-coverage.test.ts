// tests-js/scenario-menu-coverage.test.ts — guard test for the
// chronic-bug scenario-menu coverage gap (caught at v116 retrospective).
//
// PROBLEM: data/scenarios.json5 holds the scenario data, but the
// scenario PICKER menu in index.html is hardcoded with onclick handlers.
// Every scenario added via vugg-add-scenario skill must ALSO be added
// to the menu manually — and historically wasn't. Before this test
// landed, 15 scenarios in the codebase were invisible in the UI menu:
//   epithermal_telluride, jeffrey_mine, marble_contact_metamorphism,
//   naica_geothermal, roughten_gill, searles_lake, sicily_solfifera,
//   stalactite_demo, sulphur_bank, sunnyside_american_tunnel,
//   tutorial_first_crystal, tutorial_mn_calcite, tutorial_travertine,
//   ultramafic_supergene, zoned_dripstone_cave
//
// This test asserts: every scenario in scenarios.json5 has BOTH a
// startScenarioInCreative('...') button AND an <option value="..."/>
// dropdown entry in index.html. Future scenario commits that forget
// the menu-update step will see this test fail.
//
// The vugg-add-scenario skill now includes a step for updating the
// menu (added at v116 retrospective). This test guards the skill.

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
  const re = /startScenarioInCreative\(['"]([a-z_]+)['"]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return out;
}

function loadMenuDropdownScenarios(): Set<string> {
  // The dropdown lives inside <select id="scenario"> ... </select>.
  // Extract that block, then pull <option value="...">  entries.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<select[^>]+id="scenario"[\s\S]*?<\/select>/);
  if (!m) return new Set();
  const block = m[0];
  const out = new Set<string>();
  const re = /<option\s+value="([a-z_]+)"/g;
  let opt: RegExpExecArray | null;
  while ((opt = re.exec(block)) !== null) out.add(opt[1]);
  return out;
}

describe('Scenario menu coverage (v116 guard test)', () => {
  const scenarios = loadScenarioNames();
  const menuButtons = loadMenuButtonScenarios();
  const menuDropdown = loadMenuDropdownScenarios();

  it('every scenario in scenarios.json5 has a startScenarioInCreative() button in index.html', () => {
    const missing = scenarios.filter(s => !menuButtons.has(s));
    if (missing.length > 0) {
      const msg =
        `MENU GAP: ${missing.length} scenario(s) in data/scenarios.json5 have NO ` +
        `<button onclick="startScenarioInCreative('...')"> entry in index.html ` +
        `(around line 2657-2690). Per vugg-add-scenario skill §menu-update, ` +
        `add a button entry whenever you add a scenario. Missing: ` +
        missing.join(', ');
      throw new Error(msg);
    }
    expect(missing).toEqual([]);
  });

  it('every scenario in scenarios.json5 has an <option> in the #scenario dropdown', () => {
    const missing = scenarios.filter(s => !menuDropdown.has(s));
    if (missing.length > 0) {
      const msg =
        `DROPDOWN GAP: ${missing.length} scenario(s) in data/scenarios.json5 have NO ` +
        `<option value="..."> entry in the <select id="scenario"> dropdown in ` +
        `index.html (around line 2710-2725). Per vugg-add-scenario skill ` +
        `§menu-update, add a dropdown <option> entry whenever you add a scenario. ` +
        `Missing: ` + missing.join(', ');
      throw new Error(msg);
    }
    expect(missing).toEqual([]);
  });

  it('every menu button entry has a corresponding scenario in scenarios.json5 (no stale buttons)', () => {
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
