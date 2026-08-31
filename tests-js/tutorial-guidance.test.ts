import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

declare const SCENARIOS: Record<string, any>;
declare function _tutorialActionTargetMatches(action: any, hit: Element): boolean;
declare function tutorialStateSnapshot(): any;
declare function startTutorial(name: string): Promise<void>;
declare function fortressReset(): void;
declare function fortressBeginFromScenario(name: string, seed?: number): any;
declare function fortressBeginFromStarterFluid(name: string, seed?: number): void;
declare function fortressBegin(): Promise<void>;
declare function startScenarioInCreative(name: string, seed?: number): Promise<any>;
declare function startStarterFluidInCreative(name: string): Promise<void>;
declare function runSimulation(): Promise<void>;
declare function cancelSimulationPlayback(): void;
declare function _claimSimulationLaunch(): any;
declare function _simulationLaunchAuthorityCurrent(authority: any): boolean;
declare function _validateSimulationLaunchAfterNarratives(authority: any): boolean;
declare function openNewGameMenu(): void;
declare function showTitleScreen(): void;
declare function showCallout(opts: any): void;
declare function _tutorialAdvance(): void;
declare function _tutorialRunBoundaryForAction(selector: string): boolean;
declare function fortressStep(action: string, payload?: any): void;
declare function topoThreeRendererEnabled(): boolean;
declare function topoSetThreeRendererEnabled(enabled: boolean, emitProduct?: boolean): boolean;
declare function helixOverlayEnabled(): boolean;
declare function helixSetOverlayEnabled(enabled: boolean, emitProduct?: boolean): boolean;
declare function _liveSaveActiveRecord(): any;
declare function _collectCrystalWithProductReceipt(crystal: any, meta: any, ev: any): boolean;
declare function _stripDurableRunReceipt(key: string, manifest: any, datasetDigest: string): any;
declare function stripDurableDatasetDigest(dataset: any): Promise<string>;
declare function stripDatasetMatchesDurableRunReceipt(key: string, dataset: any, receipt: any): Promise<boolean>;
declare function _tutorialStripReceiptMatches(hit: Element, receipt: any): boolean;
declare function _stripOpenStoredRow(
  body: HTMLElement, row: HTMLElement, key: string,
  loader?: (key: string) => Promise<any>, renderer?: (body: HTMLElement, dataset: any) => void,
): Promise<boolean>;
declare const SIM_VERSION: number;
declare const MODEL_DIGEST: string;

afterEach(() => {
  cancelSimulationPlayback();
  fortressReset();
  localStorage.clear();
  vi.restoreAllMocks();
  document.querySelectorAll('[data-tutorial-test]').forEach(node => node.remove());
});

function advanceTutorialTo(index: number): void {
  while (tutorialStateSnapshot()?.step_index < index) _tutorialAdvance();
}

function specimen(mineral = 'topaz'): any {
  return {
    crystal_id: 7,
    mineral,
    nucleation_step: 3,
    nucleation_temp: 380,
    c_length_mm: 0.4,
    a_width_mm: 0.2,
    total_growth_um: 400,
    habit: 'prismatic',
    dominant_forms: [],
    twinned: false,
    zones: [{
      step: 4, temperature: 380, thickness_um: 400, growth_rate: 1,
    }],
  };
}

describe('guided tutorial target authority', () => {
  it('rejects the wrong crystal, partial search, wrong platter mineral, and wrong recording', () => {
    const row = document.createElement('div');
    row.className = 'inv-crystal';
    row.dataset.mineral = 'quartz';
    const collect = document.createElement('button');
    collect.className = 'inv-collect-btn';
    row.appendChild(collect);

    expect(_tutorialActionTargetMatches({ dataset: { mineral: 'calcite' } }, row)).toBe(false);
    expect(_tutorialActionTargetMatches({ dataset: { mineral: 'quartz' } }, row)).toBe(true);
    expect(_tutorialActionTargetMatches({
      within: { selector: '.inv-crystal', dataset: { mineral: 'topaz' } },
    }, collect)).toBe(false);
    row.dataset.mineral = 'topaz';
    expect(_tutorialActionTargetMatches({
      within: { selector: '.inv-crystal', dataset: { mineral: 'topaz' } },
    }, collect)).toBe(true);

    const search = document.createElement('input');
    search.value = 'top';
    expect(_tutorialActionTargetMatches({ valueNormalized: 'topaz' }, search)).toBe(false);
    search.value = '  ToPaZ  ';
    expect(_tutorialActionTargetMatches({ valueNormalized: 'topaz' }, search)).toBe(true);
    search.value = 'stale-shape-seed';
    expect(_tutorialActionTargetMatches({ valueExact: '' }, search)).toBe(false);
    search.value = '';
    expect(_tutorialActionTargetMatches({ valueExact: '' }, search)).toBe(true);

    const select = document.createElement('select');
    for (const mineral of ['sphalerite', 'barite']) {
      const option = document.createElement('option');
      option.dataset.mineral = mineral;
      option.textContent = mineral;
      select.appendChild(option);
    }
    select.selectedIndex = 0;
    expect(_tutorialActionTargetMatches({ selectedDataset: { mineral: 'barite' } }, select)).toBe(false);
    select.selectedIndex = 1;
    expect(_tutorialActionTargetMatches({ selectedDataset: { mineral: 'barite' } }, select)).toBe(true);

    const dataset = document.createElement('div');
    dataset.dataset.scenarioId = 'tutorial_first_crystal';
    dataset.dataset.seed = '42';
    expect(_tutorialActionTargetMatches({
      dataset: { scenarioId: 'tn457_barite_pulses', seed: '42' },
    }, dataset)).toBe(false);
    dataset.dataset.scenarioId = 'tn457_barite_pulses';
    expect(_tutorialActionTargetMatches({
      dataset: { scenarioId: 'tn457_barite_pulses', seed: '42' },
    }, dataset)).toBe(true);
  });

  it('binds every mineral-specific authored explanation to its exact UI target', () => {
    const first = SCENARIOS.tutorial_first_crystal._json5_spec.tutorial.steps;
    const mn = SCENARIOS.tutorial_mn_calcite._json5_spec.tutorial.steps;
    const shigar = SCENARIOS.shigar_pegmatite._json5_spec.tutorial.steps;
    const reading = SCENARIOS.tn457_barite_pulses._json5_spec.tutorial.steps;

    expect(first.find((step: any) => step.action?.selector === '.inv-crystal')
      ?.action.dataset).toEqual({ mineral: 'quartz' });
    expect(mn.find((step: any) => step.action?.selector === '.inv-crystal')
      ?.action.dataset).toEqual({ mineral: 'calcite' });
    expect(shigar.find((step: any) => step.action?.selector === '.inv-collect-btn')
      ?.action.within).toEqual({ selector: '.inv-crystal', dataset: { mineral: 'topaz' } });
    expect(shigar.find((step: any) => step.action?.selector === '#lib-search')
      ?.action.valueNormalized).toBe('topaz');
    expect(reading.find((step: any) => step.action?.selector === '#groove-crystal-select')
      ?.action.selectedDataset).toEqual({ mineral: 'barite' });
    expect(reading.find((step: any) => step.action?.selector === '.strip-view-datasetrow')
      ?.action.dataset).toEqual({ scenarioId: 'tn457_barite_pulses', seed: '42' });
    expect(reading.find((step: any) => step.action?.selector === '.strip-view-datasetrow')
      ?.action.latestStoredStrip).toBe(true);
    expect(shigar.find((step: any) => step.action?.selector === '.inv-collect-btn')
      ?.action.event).toBe('vugg:crystal-collected');
    const viewActions = first.filter((step: any) =>
      step.action?.event === 'vugg:tutorial-view-state-committed');
    expect(viewActions.map((step: any) => step.action.productState)).toEqual([
      { control: 'topo-three-renderer', beforeEnabled: true, afterEnabled: false },
      { control: 'topo-three-renderer', beforeEnabled: false, afterEnabled: true },
      { control: 'helix-overlay', beforeEnabled: false, afterEnabled: true },
      { control: 'helix-overlay', beforeEnabled: true, afterEnabled: false },
    ]);
    const acid = SCENARIOS.tutorial_travertine._json5_spec.tutorial.steps
      .find((step: any) => step.action?.productAction === 'carbonate-acid-titration');
    expect(acid.action).toEqual({
      event: 'vugg:fortress-fluid-action-committed',
      selector: '.action-grid',
      productAction: 'carbonate-acid-titration',
    });
    for (const spec of [
      SCENARIOS.shigar_pegmatite._json5_spec,
      SCENARIOS.tn457_barite_pulses._json5_spec,
    ]) {
      expect(spec.tutorial.preset).toMatchObject({ shapeSeed: '', cavitySize: 'any' });
      const grow = spec.tutorial.steps.find((step: any) => step.action?.selector === '#btn-grow');
      expect(grow.action.context).toEqual(expect.arrayContaining([
        { selector: '#shape-seed', valueExact: '' },
        { selector: '#cavity-size', valueExact: 'any' },
      ]));
    }
  });

  it('teaches Saves as the sixth quick-nav door with the real save/load policy', () => {
    const steps = SCENARIOS.tutorial_first_crystal._json5_spec.tutorial.steps;
    const intro = steps.find((step: any) => step.anchor === '#mode-toggle');
    const libraryIndex = steps.findIndex((step: any) => step.anchor === '#mode-library');
    const savesIndex = steps.findIndex((step: any) => step.anchor === '#mode-saves');
    const homeIndex = steps.findIndex((step: any) => step.anchor === '#mode-home');
    const saves = steps[savesIndex];
    const home = steps[homeIndex];

    expect(intro?.text).toContain('Six doors');
    expect(savesIndex).toBeGreaterThan(libraryIndex);
    expect(savesIndex).toBeLessThan(homeIndex);
    expect(readFileSync(join(process.cwd(), 'index.html'), 'utf8')).toContain('id="mode-saves"');
    expect(saves?.spotlight).toBe('#mode-toggle');
    expect(saves?.text).toContain('rolling autosave after every accepted action');
    expect(saves?.text).toContain('named manual copy');
    expect(saves?.text).toContain('Loading restores the run recipe and state');
    expect(saves?.text).toContain('tutorial overlay intentionally does not resume');
    expect(home?.text).toContain('ends the tutorial overlay');
    expect(home?.text).toContain('geological run remains available through Saves');
  });

  it('renders the Saves lesson as a real continue step anchored to its quick-nav control', async () => {
    const steps = SCENARIOS.tutorial_first_crystal._json5_spec.tutorial.steps;
    const savesIndex = steps.findIndex((step: any) => step.anchor === '#mode-saves');
    const savesButton = document.createElement('button');
    savesButton.id = 'mode-saves';
    savesButton.dataset.tutorialTest = 'saves-anchor';
    document.body.appendChild(savesButton);

    await startTutorial('tutorial_first_crystal');
    advanceTutorialTo(savesIndex);
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(tutorialStateSnapshot()).toMatchObject({
      step_index: savesIndex,
      current_trigger: 'continue',
    });
    expect(savesButton?.classList.contains('tutorial-callout-anchor-highlight')).toBe(true);
    expect(document.querySelector('.tutorial-callout-text')?.textContent)
      .toContain('rolling autosave after every accepted action');
  });

  it('keeps the Shigar lesson aligned with authenticated seed-42 products', () => {
    const strip = JSON.parse(readFileSync(
      join(process.cwd(), 'archive', 'strips', 'v280', 'shigar_pegmatite.json'),
      'utf8',
    ));
    const minerals = new Set((strip.executed_testimony.habit_morphology || [])
      .filter((row: any) => Number(row.total_growth_um) > 0)
      .map((row: any) => String(row.mineral)));
    const tutorialText = SCENARIOS.shigar_pegmatite._json5_spec.tutorial.steps
      .map((step: any) => String(step.text || '')).join('\n');
    expect(minerals.has('topaz')).toBe(true);
    expect(minerals.has('beryl')).toBe(false);
    expect(tutorialText).toContain('Seed 42 forms no beryl');
    expect(tutorialText).toContain('Pick one of the topazes');
    expect(tutorialText).not.toMatch(/aquamarine (and press|card:|it grew)/i);
  });

  it('binds a strip row to the exact current durable production dataset', async () => {
    const manifest = {
      format_version: 4,
      sim_version: SIM_VERSION,
      model_digest: MODEL_DIGEST,
      scenario_id: 'tn457_barite_pulses',
      scenario_spec_hash: 'a'.repeat(64),
      seed: 42,
      recorded_at: 123456,
      duration_steps: 110,
      axes: { steps: 110, angular_indices: 24, height_positions: 16 },
      chips: [],
    };
    const key = 'tn457_barite_pulses@42#123456';
    const dataset = {
      manifest, chip_data: new Uint8Array([1, 2, 3]), nucleation_events: [],
    };
    const receipt = _stripDurableRunReceipt(
      key, manifest, await stripDurableDatasetDigest(dataset),
    );
    const row = document.createElement('div');
    Object.assign(row.dataset, {
      scenarioId: receipt.scenario_id,
      seed: String(receipt.seed),
      simVersion: String(receipt.sim_version),
      modelDigest: receipt.model_digest,
      scenarioSpecHash: receipt.scenario_spec_hash,
      storageKey: receipt.key,
      recordedAt: String(receipt.recorded_at),
      manifestDigestSha256: receipt.manifest_digest_sha256,
      datasetDigestSha256: receipt.dataset_digest_sha256,
    });
    expect(_tutorialStripReceiptMatches(row, receipt)).toBe(true);
    expect(await stripDatasetMatchesDurableRunReceipt(key, dataset, receipt)).toBe(true);
    for (const field of [
      'storageKey', 'manifestDigestSha256', 'datasetDigestSha256', 'simVersion', 'modelDigest',
    ]) {
      const original = row.dataset[field];
      row.dataset[field] = `${original}-old`;
      expect(_tutorialStripReceiptMatches(row, receipt)).toBe(false);
      row.dataset[field] = original!;
    }
    const tampered = { ...dataset, chip_data: new Uint8Array([1, 2, 4]) };
    expect(await stripDatasetMatchesDurableRunReceipt(key, tampered, receipt)).toBe(false);
  });

  it('emits strip-open success only after a stored dataset loads', async () => {
    const body = document.createElement('div');
    const row = document.createElement('div');
    const opened = vi.fn();
    const render = vi.fn();
    row.addEventListener('vugg:strip-opened', opened);
    expect(await _stripOpenStoredRow(body, row, 'missing', async () => null, render)).toBe(false);
    expect(opened).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    await expect(_stripOpenStoredRow(body, row, 'broken', async () => {
      throw new Error('readback denied');
    }, render)).rejects.toThrow(/readback denied/);
    expect(opened).not.toHaveBeenCalled();
    const dataset = { manifest: { scenario_id: 'tn457_barite_pulses' } };
    expect(await _stripOpenStoredRow(body, row, 'current', async () => dataset, render)).toBe(true);
    // An arbitrary readable row still opens, but cannot emit the exact
    // current-run product event without a byte-bound receipt.
    expect(opened).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith(body, dataset);
  });

  it('emits tutorial collection success only after the specimen is durably accepted', () => {
    const button = document.createElement('button');
    button.className = 'inv-collect-btn';
    const row = document.createElement('div');
    row.className = 'inv-crystal';
    row.dataset.mineral = 'topaz';
    row.appendChild(button);
    document.body.appendChild(row);
    const success = vi.fn();
    button.addEventListener('vugg:crystal-collected', success);
    const crystal = specimen();
    const ev = { currentTarget: button };

    vi.stubGlobal('prompt', vi.fn(() => null));
    expect(_collectCrystalWithProductReceipt(crystal, { mode: 'simulation', scenario: 'shigar_pegmatite', seed: 42 }, ev)).toBe(false);
    expect(success).not.toHaveBeenCalled();

    vi.stubGlobal('prompt', vi.fn(() => 'Karakoram topaz'));
    expect(_collectCrystalWithProductReceipt(crystal, { mode: 'simulation', scenario: 'shigar_pegmatite', seed: 42 }, ev)).toBe(true);
    expect(success).toHaveBeenCalledTimes(1);
    expect(success.mock.calls[0][0].detail).toMatchObject({
      mineral: 'topaz', crystal_id: 7,
      record_id: expect.stringMatching(/^cry-/),
    });
  });
});

describe('guided tutorial run ownership', () => {
  it('makes locked controls semantically inert and restores their accessible state', async () => {
    const locked = document.createElement('button');
    locked.className = 'action-btn act-water';
    locked.dataset.tutorialTest = 'semantic-lock';
    locked.setAttribute('tabindex', '3');
    const activated = vi.fn();
    locked.addEventListener('click', activated);
    document.body.appendChild(locked);

    await startTutorial('tutorial_first_crystal');
    expect(locked.disabled).toBe(true);
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(locked.getAttribute('tabindex')).toBe('-1');
    expect(locked.dataset.tutorialLocked).toBe('true');

    locked.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }));
    locked.click();
    expect(activated).not.toHaveBeenCalled();

    fortressReset();
    expect(locked.disabled).toBe(false);
    expect(locked.hasAttribute('aria-disabled')).toBe(false);
    expect(locked.getAttribute('tabindex')).toBe('3');
    expect(locked.dataset.tutorialLocked).toBeUndefined();
  });

  it('canonicalizes and receipts the exact Grand Tour viewer transitions', async () => {
    const topo = document.createElement('button');
    topo.id = 'topo-three-btn';
    topo.dataset.tutorialTest = 'viewer-state';
    const helix = document.createElement('button');
    helix.id = 'helix-overlay-btn';
    helix.dataset.tutorialTest = 'viewer-state';
    document.body.append(topo, helix);

    topoSetThreeRendererEnabled(false, false);
    helixSetOverlayEnabled(true, false);
    expect(topoThreeRendererEnabled()).toBe(false);
    expect(helixOverlayEnabled()).toBe(true);

    await startTutorial('tutorial_first_crystal');
    expect(topoThreeRendererEnabled()).toBe(true);
    expect(helixOverlayEnabled()).toBe(false);
    expect(topo.getAttribute('aria-pressed')).toBe('true');
    expect(helix.getAttribute('aria-pressed')).toBe('false');

    const steps = SCENARIOS.tutorial_first_crystal._json5_spec.tutorial.steps;
    const firstTopo = steps.findIndex((step: any) =>
      step.action?.productState?.control === 'topo-three-renderer');
    advanceTutorialTo(firstTopo);
    expect(tutorialStateSnapshot()?.step_index).toBe(firstTopo);
    expect(topo.disabled).toBe(false);
    expect(helix.disabled).toBe(true);

    expect(topoSetThreeRendererEnabled(false, true)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(tutorialStateSnapshot()?.step_index).toBe(firstTopo + 1);
    expect(topoThreeRendererEnabled()).toBe(false);

    advanceTutorialTo(firstTopo + 2);
    expect(topoSetThreeRendererEnabled(true, true)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(tutorialStateSnapshot()?.step_index).toBe(firstTopo + 3);

    expect(helix.disabled).toBe(false);
    expect(helixSetOverlayEnabled(true, true)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(helixOverlayEnabled()).toBe(true);

    const closeHelix = steps.findIndex((step: any) =>
      step.action?.productState?.control === 'helix-overlay'
        && step.action.productState.afterEnabled === false);
    advanceTutorialTo(closeHelix);
    expect(helixSetOverlayEnabled(false, true)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(tutorialStateSnapshot()?.step_index).toBe(closeHelix + 1);
    expect(helixOverlayEnabled()).toBe(false);
  });

  it('emits carbonate success only after the titration and spatial authority close', async () => {
    const grid = document.createElement('div');
    grid.className = 'action-grid';
    grid.dataset.tutorialTest = 'acid-product';
    document.body.appendChild(grid);
    const products: any[] = [];
    grid.addEventListener('vugg:fortress-fluid-action-committed', (event: any) => {
      products.push(event.detail);
    });

    await startTutorial('tutorial_travertine');
    fortressStep('drain');
    fortressStep('tweak_acidify');
    expect(products).toHaveLength(0);

    await startTutorial('tutorial_travertine');
    fortressStep('tweak_acidify');
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      schema: 'fortress-fluid-action-product-v1',
      product: 'carbonate-acid-titration',
      action: 'tweak_acidify',
      spatial_authority_schema: 'player-fluid-spatial-intervention-v1',
      spatial_authority_scope: 'canonical-nonvadose-voxel-volume',
      spatial_authority_closed: true,
      carbonate_transaction_kind: 'ph_titration',
      carbonate_transactions_before_action: 0,
      carbonate_preparation_transfer_count: 0,
    });
    expect(products[0].after_pH).toBeLessThan(products[0].before_pH);

    // The full Travertine lesson reaches Acid immediately after step 50.
    // Accepted calcite/aragonite shells are still queued for the carbonate
    // boundary preparation at that point. The product must bind those exact
    // intervening transfers instead of silently withholding tutorial success.
    await startTutorial('tutorial_travertine');
    const fullLessonSim = (window as any).vugg.fortressSim;
    for (let step = 0; step < 50; step++) fullLessonSim.run_step();
    const transactionCountBefore = fullLessonSim._carbonateBoundaryState.transactions.length;
    fortressStep('tweak_acidify');
    expect(products).toHaveLength(2);
    expect(products[1].carbonate_transactions_before_action).toBe(transactionCountBefore);
    expect(products[1].carbonate_preparation_transfer_count).toBeGreaterThan(0);
    expect(products[1].carbonate_transaction_index).toBe(
      products[1].carbonate_transactions_before_action
        + products[1].carbonate_preparation_transfer_count,
    );
    const preparation = fullLessonSim._carbonateBoundaryState.transactions.slice(
      products[1].carbonate_transactions_before_action,
      products[1].carbonate_transaction_index,
    );
    expect(preparation.length).toBe(products[1].carbonate_preparation_transfer_count);
    expect(preparation.every((row: any) => row.ok === true && row.kind === 'solid_transfer')).toBe(true);
  });

  it('canonicalizes stale shape and cavity overrides for both legends lessons', async () => {
    // jsdom's bundle harness returns fresh proxies for absent product DOM, so
    // install the real command controls before startTutorial writes them.
    const scenario = document.createElement('select');
    scenario.id = 'scenario';
    for (const value of ['shigar_pegmatite', 'tn457_barite_pulses']) {
      const option = document.createElement('option');
      option.value = value;
      scenario.appendChild(option);
    }
    const seed = document.createElement('input');
    seed.id = 'seed';
    const steps = document.createElement('input');
    steps.id = 'steps';
    const shapeSeed = document.createElement('input');
    shapeSeed.id = 'shape-seed';
    const cavitySize = document.createElement('select');
    cavitySize.id = 'cavity-size';
    for (const value of ['any', 'cave']) {
      const option = document.createElement('option');
      option.value = value;
      cavitySize.appendChild(option);
    }
    for (const node of [scenario, seed, steps, shapeSeed, cavitySize]) {
      node.dataset.tutorialTest = 'complete-command-preset';
      document.body.appendChild(node);
    }

    for (const name of ['shigar_pegmatite', 'tn457_barite_pulses']) {
      shapeSeed.value = '31337';
      cavitySize.value = 'cave';
      expect(shapeSeed.value).toBe('31337');
      expect(cavitySize.value).toBe('cave');

      await startTutorial(name);
      expect(shapeSeed.value).toBe('');
      expect(cavitySize.value).toBe('any');
      const steps = SCENARIOS[name]._json5_spec.tutorial.steps;
      const growIndex = steps.findIndex((step: any) => step.action?.selector === '#btn-grow');
      advanceTutorialTo(growIndex);
      const grow = steps[growIndex].action;
      for (const condition of grow.context) {
        const node = document.querySelector(condition.selector) as HTMLInputElement | HTMLSelectElement;
        expect(_tutorialActionTargetMatches(condition, node)).toBe(true);
      }
      fortressReset();
    }
  });

  it('Reset removes lexical progress, callout chrome, locks, and spotlights before setup', async () => {
    await startTutorial('tutorial_first_crystal');
    expect(tutorialStateSnapshot()).toMatchObject({ mode: 'fortress', step_index: 0 });
    expect(document.body.classList.contains('tutorial-active')).toBe(true);
    const allow = document.createElement('button');
    allow.dataset.tutorialTest = 'allow';
    allow.className = 'tutorial-allow';
    const spotlight = document.createElement('div');
    spotlight.dataset.tutorialTest = 'spotlight';
    spotlight.className = 'tutorial-spotlight';
    document.body.append(allow, spotlight);
    showCallout({ anchor: allow, text: 'live tutorial chrome', progress: '1/1' });
    expect(document.querySelectorAll('.tutorial-callout')).toHaveLength(1);
    expect(document.querySelectorAll('.tutorial-allow')).toHaveLength(1);
    expect(document.querySelectorAll('.tutorial-spotlight')).toHaveLength(1);

    fortressReset();
    expect(tutorialStateSnapshot()).toBeNull();
    expect(document.body.classList.contains('tutorial-active')).toBe(false);
    expect(document.querySelectorAll('.tutorial-allow')).toHaveLength(0);
    expect(document.querySelectorAll('.tutorial-spotlight')).toHaveLength(0);
    expect(document.querySelectorAll('.tutorial-callout')).toHaveLength(0);
    expect((window as any).vugg.fortressSim).toBeNull();
    expect(_liveSaveActiveRecord()).toBeNull();
  });

  it('starting a different authored run owns a fresh tutorial-free lifecycle', async () => {
    await startTutorial('tutorial_first_crystal');
    expect(tutorialStateSnapshot()).not.toBeNull();
    fortressBeginFromScenario('tutorial_mn_calcite', 42);
    expect(tutorialStateSnapshot()).toBeNull();
    expect(document.body.classList.contains('tutorial-active')).toBe(false);
  });

  it('does not resurrect a lesson when Reset wins during async scenario boot', async () => {
    const pending = startTutorial('tutorial_first_crystal');
    fortressReset();
    await pending;
    expect(tutorialStateSnapshot()).toBeNull();
    expect(document.body.classList.contains('tutorial-active')).toBe(false);
    expect((window as any).vugg.fortressSim).toBeNull();
    expect(_liveSaveActiveRecord()).toBeNull();
  });

  it('does not overwrite a replacement run when it wins during async tutorial boot', async () => {
    const pending = startTutorial('tutorial_first_crystal');
    fortressBeginFromScenario('mvt', 42);
    const replacement = (window as any).vugg.fortressSim;
    const replacementSave = _liveSaveActiveRecord();
    await pending;
    expect(tutorialStateSnapshot()).toBeNull();
    expect((window as any).vugg.fortressSim).toBe(replacement);
    expect(_liveSaveActiveRecord()?.id).toBe(replacementSave?.id);
    expect(_liveSaveActiveRecord()?.origin?.scenario).toBe('mvt');
  });

  it('tears down on New Game, Home, Starter, and Custom run boundaries', async () => {
    await startTutorial('tutorial_first_crystal');
    openNewGameMenu();
    expect(tutorialStateSnapshot()).toBeNull();

    await startTutorial('tutorial_first_crystal');
    showTitleScreen();
    expect(tutorialStateSnapshot()).toBeNull();

    await startTutorial('tutorial_first_crystal');
    fortressBeginFromStarterFluid('clean', 42);
    expect(tutorialStateSnapshot()).toBeNull();

    await startTutorial('tutorial_first_crystal');
    await fortressBegin();
    expect(tutorialStateSnapshot()).toBeNull();
  });

  it('authorizes only the first exact legends Grow and rejects changed setup or later Grow', async () => {
    await startTutorial('shigar_pegmatite');
    advanceTutorialTo(4);
    const scenario = document.createElement('select');
    scenario.id = 'scenario';
    const shigarOption = document.createElement('option');
    shigarOption.value = 'shigar_pegmatite';
    shigarOption.textContent = 'Shigar';
    scenario.appendChild(shigarOption);
    scenario.selectedIndex = 0;
    const seed = document.createElement('input');
    seed.id = 'seed';
    seed.value = '42';
    const steps = document.createElement('input');
    steps.id = 'steps';
    steps.value = '70';
    const shapeSeed = document.createElement('input');
    shapeSeed.id = 'shape-seed';
    shapeSeed.value = '';
    const cavitySize = document.createElement('select');
    cavitySize.id = 'cavity-size';
    const anySize = document.createElement('option');
    anySize.value = 'any';
    cavitySize.appendChild(anySize);
    cavitySize.value = 'any';
    const grow = document.createElement('button');
    grow.id = 'btn-grow';
    for (const node of [scenario, seed, steps, shapeSeed, cavitySize, grow]) {
      node.dataset.tutorialTest = 'grow-authority';
    }
    document.body.append(scenario, seed, steps, shapeSeed, cavitySize, grow);
    const growAction = SCENARIOS.shigar_pegmatite._json5_spec.tutorial.steps[4].action;
    expect(tutorialStateSnapshot()).toMatchObject({ mode: 'legends', step_index: 4, current_trigger: 'action' });
    for (const condition of growAction.context) {
      const node = document.querySelector(condition.selector) as HTMLInputElement | HTMLSelectElement;
      const expected = Object.prototype.hasOwnProperty.call(condition, 'valueExact')
        ? condition.valueExact : condition.valueNormalized;
      expect({
        selector: condition.selector,
        value: node?.value,
        expected,
        matches: _tutorialActionTargetMatches(condition, node),
      }).toEqual({
        selector: condition.selector,
        value: expected,
        expected,
        matches: true,
      });
    }
    expect(_tutorialActionTargetMatches(growAction, grow)).toBe(true);
    expect(_tutorialRunBoundaryForAction('#btn-grow')).toBe(true);
    expect(tutorialStateSnapshot()?.step_index).toBe(4);
    expect(_tutorialRunBoundaryForAction('#btn-grow')).toBe(false);
    expect(tutorialStateSnapshot()?.step_index).toBe(4);
    _tutorialAdvance();
    expect(_tutorialRunBoundaryForAction('#btn-grow')).toBe(false);
    expect(tutorialStateSnapshot()).toBeNull();

    await startTutorial('shigar_pegmatite');
    advanceTutorialTo(4);
    scenario.value = 'shigar_pegmatite';
    seed.value = '41';
    expect(_tutorialRunBoundaryForAction('#btn-grow')).toBe(false);
    expect(tutorialStateSnapshot()).toBeNull();

    await startTutorial('shigar_pegmatite');
    advanceTutorialTo(4);
    scenario.value = 'shigar_pegmatite';
    seed.value = '42';
    const authoredShape = document.getElementById('shape-seed') as HTMLInputElement;
    authoredShape.value = '8675309';
    expect(_tutorialRunBoundaryForAction('#btn-grow')).toBe(false);
    expect(tutorialStateSnapshot()).toBeNull();
  });

  it('advances the Shigar collection explanation on product success, never raw intent', async () => {
    await startTutorial('shigar_pegmatite');
    advanceTutorialTo(11);
    const row = document.createElement('div');
    row.className = 'inv-crystal';
    row.dataset.mineral = 'topaz';
    row.dataset.crystalId = '7';
    const button = document.createElement('button');
    button.className = 'inv-collect-btn';
    row.appendChild(button);
    document.body.appendChild(row);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(tutorialStateSnapshot()?.step_index).toBe(11);
    button.dispatchEvent(new CustomEvent('vugg:crystal-collected', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(tutorialStateSnapshot()?.step_index).toBe(11);
    row.dataset.collectedRecordId = 'cry-committed';
    button.dispatchEvent(new CustomEvent('vugg:crystal-collected', {
      bubbles: true,
      detail: { mineral: 'topaz', crystal_id: 8, record_id: 'cry-wrong' },
    }));
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(tutorialStateSnapshot()?.step_index).toBe(11);
    button.dispatchEvent(new CustomEvent('vugg:crystal-collected', {
      bubbles: true,
      detail: { mineral: 'topaz', crystal_id: 7, record_id: 'cry-committed' },
    }));
    await new Promise(resolve => setTimeout(resolve, 1));
    expect(tutorialStateSnapshot()?.step_index).toBe(12);
  });

  it('cancels every ordinary async run launcher when Home wins its await', async () => {
    const scenario = startScenarioInCreative('tutorial_first_crystal', 42);
    showTitleScreen();
    await scenario;
    expect((window as any).vugg.fortressSim).toBeNull();
    expect(_liveSaveActiveRecord()).toBeNull();

    const starter = startStarterFluidInCreative('clean');
    showTitleScreen();
    await starter;
    expect((window as any).vugg.fortressSim).toBeNull();
    expect(_liveSaveActiveRecord()).toBeNull();

    const custom = fortressBegin();
    showTitleScreen();
    await custom;
    expect((window as any).vugg.fortressSim).toBeNull();
    expect(_liveSaveActiveRecord()).toBeNull();
  });

  it('does not resurrect a pending Simulation Grow after New Game wins', async () => {
    const scenario = document.createElement('select');
    scenario.id = 'scenario';
    const option = document.createElement('option');
    option.value = 'cooling';
    option.textContent = 'Cooling';
    scenario.appendChild(option);
    const seed = document.createElement('input');
    seed.id = 'seed';
    seed.value = '42';
    const steps = document.createElement('input');
    steps.id = 'steps';
    steps.value = '1';
    const shapeSeed = document.createElement('input');
    shapeSeed.id = 'shape-seed';
    const cavitySize = document.createElement('select');
    cavitySize.id = 'cavity-size';
    const anySize = document.createElement('option');
    anySize.value = 'any';
    cavitySize.appendChild(anySize);
    cavitySize.value = 'any';
    const output = document.createElement('div');
    output.id = 'output';
    for (const node of [scenario, seed, steps, shapeSeed, cavitySize, output]) {
      node.dataset.tutorialTest = 'pending-grow';
      document.body.appendChild(node);
    }
    expect(scenario.value).toBe('cooling');
    const pending = runSimulation();
    openNewGameMenu();
    await pending;
    expect((window as any).vugg.legendsSim).toBeNull();
    expect((window as any).vugg.legendsSimulationCheckpoint ?? null).toBeNull();
    expect(document.querySelectorAll('.simulation-precompute')).toHaveLength(0);

    // Positive construction control: the same fully valid setup does build
    // when no newer boundary invalidates its launch generation.
    await runSimulation();
    expect((window as any).vugg.legendsSim?.step).toBe(1);
    const dump = (window as any).vugg.dumpSpecimen();
    expect(dump).toMatchObject({ scenario: 'cooling', seed: 42, total_steps: 1 });
    expect(dump.shape_seed).toBe((window as any).vugg.legendsSim.conditions.wall.shape_seed);
  });

  it('carries the one-use exact Grow claim across a delayed narrative continuation', async () => {
    await startTutorial('shigar_pegmatite');
    advanceTutorialTo(4);
    const scenario = document.createElement('select');
    scenario.id = 'scenario';
    const option = document.createElement('option');
    option.value = 'shigar_pegmatite';
    scenario.appendChild(option);
    const coolingOption = document.createElement('option');
    coolingOption.value = 'cooling';
    scenario.appendChild(coolingOption);
    const seed = document.createElement('input');
    seed.id = 'seed';
    seed.value = '42';
    const steps = document.createElement('input');
    steps.id = 'steps';
    steps.value = '70';
    const shapeSeed = document.createElement('input');
    shapeSeed.id = 'shape-seed';
    const cavitySize = document.createElement('select');
    cavitySize.id = 'cavity-size';
    const anySize = document.createElement('option');
    anySize.value = 'any';
    cavitySize.appendChild(anySize);
    cavitySize.value = 'any';
    const grow = document.createElement('button');
    grow.id = 'btn-grow';
    for (const node of [scenario, seed, steps, shapeSeed, cavitySize, grow]) {
      node.dataset.tutorialTest = 'delayed-grow';
      document.body.appendChild(node);
    }

    const authority = _claimSimulationLaunch();
    // This is the cold-load ordering the browser's capture listener creates:
    // the click has synchronously launched Grow, then the deferred action
    // advances while runSimulation is still suspended at its first await.
    _tutorialAdvance();
    await Promise.resolve();
    expect(authority).toMatchObject({ tutorial_run_owned: true });
    expect(_simulationLaunchAuthorityCurrent(authority)).toBe(true);
    expect(tutorialStateSnapshot()).toMatchObject({ mode: 'legends', step_index: 5 });

    for (const mutate of [
      () => { seed.value = '41'; },
      () => { steps.value = '69'; },
      () => { scenario.value = 'cooling'; },
      () => { shapeSeed.value = '88'; },
      () => { cavitySize.value = 'cave'; },
    ]) {
      await startTutorial('shigar_pegmatite');
      advanceTutorialTo(4);
      scenario.value = 'shigar_pegmatite';
      seed.value = '42';
      steps.value = '70';
      shapeSeed.value = '';
      cavitySize.value = 'any';
      const changed = _claimSimulationLaunch();
      expect(changed).toMatchObject({ tutorial_run_owned: true });
      mutate();
      _tutorialAdvance();
      await Promise.resolve();
      expect(_simulationLaunchAuthorityCurrent(changed)).toBe(false);
      expect(_validateSimulationLaunchAfterNarratives(changed)).toBe(false);
      expect(tutorialStateSnapshot()).toBeNull();
    }
  });
});
