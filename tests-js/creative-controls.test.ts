import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

afterEach(() => {
  document.getElementById('creative-control-fixture')?.remove();
});

describe('Creative chemistry control contract', () => {
  it('registers every visible setup chemistry slider exactly once', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const visibleIds = Array.from(
      parsed.querySelectorAll('#creative-chemistry-controls input[type="range"][id^="f-"]'),
    )
      .map(el => el.id)
      .sort();

    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    const registeredIds = Object.values(registry).map((entry: any) => entry.id).sort();
    expect(registeredIds).toEqual(visibleIds);
    expect(new Set(registeredIds).size).toBe(registeredIds.length);
    for (const id of visibleIds) {
      expect(parsed.querySelector(`label[for="${id}"]`), id).not.toBeNull();
    }
  });

  it('round-trips every slider through canonical FluidChemistry state', () => {
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    const fixture = document.createElement('div');
    fixture.id = 'creative-control-fixture';
    document.body.appendChild(fixture);

    let ordinal = 1;
    const expected: Record<string, number> = {};
    for (const [prop, control] of Object.entries(registry) as Array<[string, any]>) {
      const input = document.createElement('input');
      input.id = control.id;
      input.type = 'range';
      const canonical = prop === 'pH' ? 6.4 : prop === 'reactiveSilicaFraction' ? 0.41 : ordinal++;
      input.min = '0';
      input.max = '1000';
      input.value = String(canonical * control.scale);
      fixture.appendChild(input);

      const value = document.createElement('span');
      value.id = control.id + '-val';
      fixture.appendChild(value);
      expected[prop] = canonical;
    }

    const params = (globalThis as any).readCreativeChemistryControls();
    const fluid = new (globalThis as any).FluidChemistry(params);
    for (const [prop, value] of Object.entries(expected)) {
      expect(fluid[prop]).toBe(value);
    }

    const changed = Object.fromEntries(
      Object.keys(registry).map((prop, index) => [
        prop,
        prop === 'pH' ? 7.2 : prop === 'reactiveSilicaFraction' ? 0.41 : index + 40,
      ]),
    );
    (globalThis as any).syncCreativeChemistryControls(changed);
    const roundTrip = (globalThis as any).readCreativeChemistryControls();
    expect(roundTrip).toEqual({
      ...changed,
      sulfurPoolsExplicit: false,
      nativeSulfurPathway: null,
    });
  });

  it('uses the same complete fluid registry for setup and live editing', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    const expectedLiveIds = Object.values(registry)
      .map((entry: any) => `broth-${entry.liveKey}`)
      .sort();

    for (const id of expectedLiveIds) {
      expect(parsed.getElementById(id), id).not.toBeNull();
    }
    expect(Object.keys(registry)).toHaveLength(48);

    const authored = new Set<string>();
    for (const makeScenario of Object.values((globalThis as any).SCENARIOS) as any[]) {
      for (const field of Object.keys(makeScenario._json5_spec.initial.fluid || {})) authored.add(field);
    }
    const authoredMetadata = new Set(['sulfateInherited', 'sulfurPoolsExplicit', 'nativeSulfurPathway']);
    const authoredLevers = [...authored].filter(field => !authoredMetadata.has(field)).sort();
    expect(authoredLevers).toEqual(Object.keys(registry).sort());
  });

  it('defines canonical physical bounds and precision for every chemistry lever', () => {
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    for (const [field, control] of Object.entries(registry) as Array<[string, any]>) {
      expect(control.label, `${field}.label`).toBeTruthy();
      expect(['major', 'trace', 'ligand', 'redox', 'physical'], `${field}.group`).toContain(control.group);
      expect(Number.isFinite(control.min), `${field}.min`).toBe(true);
      expect(Number.isFinite(control.max), `${field}.max`).toBe(true);
      expect(control.max, `${field}.range`).toBeGreaterThan(control.min);
      expect(control.step, `${field}.step`).toBeGreaterThan(0);
      expect(control.scale, `${field}.scale`).toBeGreaterThan(0);
      expect(control.step * control.scale, `${field}.raw step`).toBeCloseTo(1, 10);
    }
  });

  it('attaches provenance, coupling, consumers, and a causal gameplay probe to every lever', () => {
    const source = fs.readFileSync(path.join(ROOT, 'js', '97-ui-fortress.ts'), 'utf8');
    expect(source).toContain('STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.kind');
    expect(source).toContain('STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.preserves');
    expect(source).toContain('STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.limitation');
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    const causalProbe = (globalThis as any).creativeChemistryCausalProbe;
    for (const [field, control] of Object.entries(registry) as Array<[string, any]>) {
      expect(control.evidence?.provenance?.length, `${field}.provenance`).toBeGreaterThan(0);
      expect(control.evidence?.coupling, `${field}.coupling`).toBeTruthy();
      expect(control.evidence?.consumers?.length, `${field}.consumers`).toBeGreaterThan(0);
      const low = causalProbe(field, control.min);
      const high = causalProbe(field, control.max);
      expect(low.fluid_value, `${field}.low UI adapter`).toBe(control.min);
      expect(high.fluid_value, `${field}.high UI adapter`).toBe(control.max);
      expect(high.route, `${field}.production route`).not.toMatch(/unimplemented|invalid/);
      expect(Number.isFinite(low.signal), `${field}.causal low`).toBe(true);
      expect(Number.isFinite(high.signal), `${field}.causal high`).toBe(true);
      expect(high.signal, `${field}.causal response`).not.toBe(low.signal);
      expect(high.consumer_mutated, `${field}.consumer mutation`).toBe(true);
      expect(high.forward_route, `${field}.forward route`).toMatch(/supersaturation|grow_|Morphology|Eh/);
      expect(low.forward_observed, `${field}.forward low observed`).toBe(true);
      expect(high.forward_observed, `${field}.forward high observed`).toBe(true);
      expect(Number.isFinite(low.forward_signal), `${field}.forward low`).toBe(true);
      expect(Number.isFinite(high.forward_signal), `${field}.forward high`).toBe(true);
      expect(high.forward_signal, `${field}.forward response`).not.toBe(low.forward_signal);
    }
  });

  it('uses geochemical roles instead of misclassifying majors and state variables as trace/ligand', () => {
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    expect(registry.Mg.group).toBe('major');
    expect(registry.Na.group).toBe('major');
    expect(registry.K.group).toBe('major');
    expect(registry.O2.group).toBe('redox');
    expect(registry.salinity.group).toBe('physical');
  });

  it('pairs every Creative setup slider with an exact physical-value input', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const fixture = document.createElement('div');
    fixture.id = 'creative-control-fixture';
    fixture.appendChild(document.importNode(parsed.getElementById('fortress-setup')!, true));
    document.body.appendChild(fixture);
    (globalThis as any).installCreativeSetupExactInputs();
    const setup = document.getElementById('fortress-setup')!;
    const sliders = Array.from(setup.querySelectorAll('input[type="range"]')) as HTMLInputElement[];
    expect(sliders.length).toBeGreaterThan(50);
    for (const slider of sliders) {
      const exact = document.getElementById(slider.id + '-exact') as HTMLInputElement | null;
      expect(exact, slider.id).not.toBeNull();
      expect(exact?.type, slider.id).toBe('number');
      expect(exact?.getAttribute('aria-label'), slider.id).toMatch(/^Exact /);
    }

    const pH = document.getElementById('f-ph') as HTMLInputElement;
    const exactPH = document.getElementById('f-ph-exact') as HTMLInputElement;
    exactPH.value = '7.2';
    exactPH.dispatchEvent(new Event('change'));
    expect(pH.value).toBe('72');
    expect((globalThis as any).readCreativeChemistryControls().pH).toBe(7.2);
  });

  it('search recognizes full chemistry names and hides non-matches', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const fixture = document.createElement('div');
    fixture.id = 'creative-control-fixture';
    fixture.appendChild(document.importNode(parsed.getElementById('fortress-setup')!, true));
    document.body.appendChild(fixture);
    (globalThis as any).installCreativeSetupExactInputs();

    (globalThis as any).filterCreativeSetupChemistry('germanium');
    expect((document.getElementById('f-ge')!.closest('.setup-row') as HTMLElement).hidden).toBe(false);
    expect((document.getElementById('f-fe')!.closest('.setup-row') as HTMLElement).hidden).toBe(true);
    (globalThis as any).filterCreativeSetupChemistry('');
  });

  it('edits every live chemistry range exactly without old live-range clipping', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const fixture = document.createElement('div');
    fixture.id = 'creative-control-fixture';
    const sourceBody = parsed.getElementById('broth-body')!;
    fixture.appendChild(document.importNode(sourceBody, true));
    document.body.appendChild(fixture);
    (globalThis as any).fortressBeginFromScenario('cooling', 8127);
    const sim = (globalThis as any)._liveFortressSim();
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    for (const control of Object.values(registry) as any[]) {
      const slider = document.getElementById(`broth-${control.liveKey}`) as HTMLInputElement;
      const exact = document.getElementById(`broth-${control.liveKey}-exact`) as HTMLInputElement;
      expect(exact, control.liveKey).not.toBeNull();
      expect(Number(slider.max), `${control.liveKey}.max`).toBe(control.max * control.scale);
      expect(Number(exact.step), `${control.liveKey}.step`).toBe(control.step);
    }

    const exactFe = document.getElementById('broth-fe-exact') as HTMLInputElement;
    exactFe.value = '375';
    exactFe.dispatchEvent(new Event('change'));
    expect(sim.conditions.fluid.Fe).toBe(375);
    expect((document.getElementById('broth-fe') as HTMLInputElement).value).toBe('375');
  });

  it('reconfigures every live control copy when stale or duplicate DOM survives a rerender', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const fixture = document.createElement('div');
    fixture.id = 'creative-control-fixture';
    const sourceBody = parsed.getElementById('broth-body')!;
    fixture.appendChild(document.importNode(sourceBody, true));
    fixture.appendChild(document.importNode(sourceBody, true));
    document.body.appendChild(fixture);

    for (const body of Array.from(fixture.querySelectorAll('#broth-body'))) {
      const stale = document.createElement('input');
      stale.type = 'number';
      stale.id = 'broth-fe-exact';
      stale.step = '0';
      body.querySelector('#broth-fe')?.insertAdjacentElement('afterend', stale);
    }

    (globalThis as any).fortressBeginFromScenario('cooling', 8128);
    const feExactCopies = Array.from(fixture.querySelectorAll<HTMLInputElement>('#broth-fe-exact'));
    expect(feExactCopies).toHaveLength(2);
    expect(feExactCopies.map(input => Number(input.step))).toEqual([1, 1]);
    expect(feExactCopies.every(input => input.dataset.brothExactBound === '1')).toBe(true);
  });

  it('represents every authored starting value without HTML range clipping', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const registry = (globalThis as any).CREATIVE_CHEMISTRY_CONTROLS;
    const scenarios = (globalThis as any).SCENARIOS;

    for (const [scenarioId, makeScenario] of Object.entries(scenarios) as Array<[string, any]>) {
      const initial = makeScenario._json5_spec.initial;
      const temp = parsed.getElementById('broth-temp') as HTMLInputElement;
      expect(initial.temperature_C, `${scenarioId}.temperature_C`).toBeGreaterThanOrEqual(Number(temp.min));
      expect(initial.temperature_C, `${scenarioId}.temperature_C`).toBeLessThanOrEqual(Number(temp.max));
      const pressure = parsed.getElementById('broth-pressure') as HTMLInputElement;
      expect(initial.pressure_kbar * 100, `${scenarioId}.pressure_kbar`).toBeGreaterThanOrEqual(Number(pressure.min) - 1e-9);
      expect(initial.pressure_kbar * 100, `${scenarioId}.pressure_kbar`).toBeLessThanOrEqual(Number(pressure.max) + 1e-9);

      for (const [field, value] of Object.entries(initial.fluid || {}) as Array<[string, number]>) {
        const control = registry[field];
        if (!control) {
          expect(['sulfateInherited', 'sulfurPoolsExplicit', 'nativeSulfurPathway']).toContain(field);
          continue;
        }
        const live = parsed.getElementById(`broth-${control.liveKey}`) as HTMLInputElement;
        const setup = parsed.getElementById(control.id) as HTMLInputElement;
        const raw = value * control.scale;
        expect(raw, `${scenarioId}.fluid.${field} live min`).toBeGreaterThanOrEqual(Number(live.min));
        expect(raw, `${scenarioId}.fluid.${field} live max`).toBeLessThanOrEqual(Number(live.max));
        expect(raw, `${scenarioId}.fluid.${field} setup min`).toBeGreaterThanOrEqual(Number(setup.min));
        expect(raw, `${scenarioId}.fluid.${field} setup max`).toBeLessThanOrEqual(Number(setup.max));
      }
    }
  });

  it('rejects unknown fluid keys instead of silently dropping geology', () => {
    const Fluid = (globalThis as any).FluidChemistry;
    expect(() => new Fluid({ SO4: 5 })).toThrow(/Unknown FluidChemistry field: SO4/);
  });

  it('does not feed untouched synchronized sliders back into scenario state', () => {
    (globalThis as any).fortressBeginFromScenario('sabkha_dolomitization', 8128);
    const sim = (globalThis as any)._liveFortressSim();
    const before = Object.fromEntries(
      Object.keys(sim.conditions.fluid).map(key => [key, sim.conditions.fluid[key]]),
    );
    expect(before.Na).toBe(10500);
    expect(before.Cl).toBe(18000);
    expect(before.S).toBe(2700);

    // Heat is a zero-time temperature intervention. Before the fix, its
    // pre-action blanket sync clipped Na/Cl/S even though no broth control was
    // touched.
    (globalThis as any).fortressStep('heat');
    const after = Object.fromEntries(
      Object.keys(sim.conditions.fluid).map(key => [key, sim.conditions.fluid[key]]),
    );
    expect(after).toEqual(before);
  });

  it('resolves setup boundary and host controls into canonical simulation parameters', () => {
    const fixture = document.createElement('div');
    fixture.id = 'creative-control-fixture';
    document.body.appendChild(fixture);
    const add = (id: string, value: string, type = 'range') => {
      const el = document.createElement('input');
      el.id = id;
      el.type = type;
      if (type === 'range') {
        el.min = '-100000';
        el.max = '100000';
      }
      el.value = value;
      fixture.appendChild(el);
      return el;
    };
    const select = (id: string, value: string) => {
      const el = document.createElement('select');
      el.id = id;
      const option = document.createElement('option');
      option.value = value;
      el.appendChild(option);
      el.value = value;
      fixture.appendChild(el);
    };

    select('f-host-composition', 'dolomite');
    select('f-architecture', 'cleft');
    add('f-vug-diameter', '325');
    add('f-host-thickness', '1200');
    add('f-wall-fe', '4100');
    add('f-wall-mn', '900');
    add('f-wall-mg', '2300');
    add('f-wall-reactivity', '14');
    add('f-cooling-rate', '3');
    add('f-diffusion-rate', '2');
    add('f-primary-bubbles', '4');
    add('f-secondary-bubbles', '9');
    add('f-shape-seed', '77');
    add('f-gamma-host', '35');
    add('f-flow-rate', '27');
    add('f-porosity', '18');
    add('f-water-table', '625');
    add('f-pco2', '-200');
    add('f-graphitic', '', 'checkbox').checked = true;
    add('f-open-system', '', 'checkbox').checked = true;
    add('f-open-atmosphere', '', 'checkbox').checked = true;
    add('f-thermal-pulses', '', 'checkbox').checked = false;

    const result = (globalThis as any).readCreativeGeologicalControls({});
    expect(result.wallOpts).toMatchObject({
      composition: 'dolomite', architecture: 'cleft', alpine_cleft: true,
      vug_diameter_mm: 325, thickness_mm: 1200,
      wall_Fe_ppm: 4100, wall_Mn_ppm: 900, wall_Mg_ppm: 2300,
      reactivity: 1.4, cooling_rate: 0.3, inter_ring_diffusion_rate: 0.02,
      primary_bubbles: 4, secondary_bubbles: 9, shape_seed: 77,
      gamma_host: 0.35, graphitic: true, open_system: true,
      thermal_pulses: false,
    });
    expect(result.conditionOpts).toEqual({ flow_rate: 2.7, porosity: 0.18 });
    expect(result.initialWaterTablePct).toBe(62.5);
    expect(result.scenarioOpts.open_to_atmosphere).toBe(true);
    expect(result.scenarioOpts.atmospheric_pCO2_bar).toBeCloseTo(0.01, 8);
    expect(result.scenarioOpts.carbonate_boundary).toMatchObject({
      mode: 'open',
      spatial_model: 'equal_volume_fully_mixed',
    });
  });

  it('applies live environmental and host edits to their physics-bearing state', () => {
    (globalThis as any).fortressBeginFromScenario('chiastolite_hornfels', 8129);
    const sim = (globalThis as any)._liveFortressSim();
    const set = (key: string, value: string) => (globalThis as any).setBrothValue(key, value);

    set('water', '375');
    set('pressure', '275');
    set('porosity', '22');
    set('cooling', '7');
    set('diameter', '240');
    set('diffusion', '3');
    set('pco2', '-200');
    set('host', 'dolomite');
    set('open_atmosphere', '1');
    set('open_system', '1');
    set('graphitic', '0');

    expect(sim.conditions.fluid_surface_height_mm).toBeCloseTo(sim.wall_state.ring_count * 0.375, 8);
    expect(sim.conditions.pressure).toBe(2.75);
    expect(sim.conditions.porosity).toBe(0.22);
    expect(sim.conditions.wall.cooling_rate).toBe(0.7);
    expect(sim.conditions.wall.vug_diameter_mm).toBe(240);
    expect(sim.wall_state.vug_diameter_mm).toBe(240);
    expect(sim.inter_ring_diffusion_rate).toBe(0.03);
    expect(sim.conditions.wall.inter_ring_diffusion_rate).toBe(0.03);
    expect(sim.conditions._scenario.atmospheric_pCO2_bar).toBeCloseTo(0.01, 8);
    expect(sim.conditions._scenario.open_to_atmosphere).toBe(true);
    expect(sim._carbonateBoundaryState).toBeTruthy();
    expect(sim._carbonateBoundaryState.mode).toBe('open');
    expect(sim.conditions.wall.composition).toBe('dolomite');
    expect(sim.wall_state.composition).toBe('dolomite');
    expect(sim.conditions.wall.open_system).toBe(true);
    expect(sim.conditions.wall.graphitic).toBe(false);
  });

  it('does not expose the retired fixed-DIC carbon-solver-off path', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    expect(parsed.getElementById('f-carbon-boundary')).toBeNull();
    expect(parsed.getElementById('broth-carbon_boundary')).toBeNull();
    expect(html).not.toContain('open (legacy if solver off)');
    (globalThis as any).fortressBeginFromScenario('cooling', 8130);
    const sim = (globalThis as any)._liveFortressSim();
    expect(sim._carbonateBoundaryState).toBeTruthy();
    expect(sim.conditions._scenario.carbonate_boundary.initial_DIC_mol_kg).toBeGreaterThan(0);
    expect(sim.conditions._scenario.carbonate_boundary.reduced_alkalinity_eq_per_kg)
      .toEqual(expect.any(Number));
  });

  it('keeps authored preset wall defaults visible in the exact setup controls', () => {
    const fixture = document.createElement('div');
    fixture.id = 'creative-control-fixture';
    fixture.innerHTML = `
      <div id="preset-grid"></div><div id="preset-desc"></div>
      <input id="f-vug-diameter" type="range" min="0" max="10000" value="999">
      <input id="f-host-thickness" type="range" min="0" max="10000" value="999">
      <input id="f-wall-fe" type="range" min="0" max="20000" value="999">
      <input id="f-wall-mn" type="range" min="0" max="20000" value="999">
      <input id="f-wall-mg" type="range" min="0" max="20000" value="999">
      <select id="f-size-class"><option value="preset">preset</option><option value="cave">cave</option></select>
    `;
    document.body.appendChild(fixture);
    (fixture.querySelector('#f-size-class') as HTMLSelectElement).value = 'cave';

    (globalThis as any).selectPreset('mvt');
    expect((fixture.querySelector('#f-vug-diameter') as HTMLInputElement).value).toBe('40');
    expect((fixture.querySelector('#f-wall-fe') as HTMLInputElement).value).toBe('3000');
    expect((fixture.querySelector('#f-wall-mn') as HTMLInputElement).value).toBe('800');
    expect((fixture.querySelector('#f-size-class') as HTMLSelectElement).value).toBe('preset');

    (globalThis as any).selectPreset('carbonate');
    expect((fixture.querySelector('#f-vug-diameter') as HTMLInputElement).value).toBe('30');
    expect((fixture.querySelector('#f-wall-fe') as HTMLInputElement).value).toBe('1500');
    expect((fixture.querySelector('#f-wall-mg') as HTMLInputElement).value).toBe('800');
  });

  it('schedules a replayable geological trajectory through the movement engine', () => {
    (globalThis as any).setFortressInstantLines(true);
    (globalThis as any).fortressBeginFromScenario('cooling', 8130);
    const sim = (globalThis as any)._liveFortressSim();
    const beforeCount = sim.conditions._scenario.movements?.length || 0;

    (globalThis as any).fortressStep('schedule_movement', {
      field: 'porosity', operator: 'trend', value: 0.6,
      delay: 0, duration: 4, clampMin: 0, clampMax: 1, origin: 'global',
    });
    expect(sim.conditions._scenario.movements).toHaveLength(beforeCount + 1);
    expect(sim.conditions._scenario.movements.at(-1)).toMatchObject({
      field: 'porosity', startStep: 1, endStep: 5, origin: 'global',
    });

    (globalThis as any).fortressStep('wait');
    (globalThis as any).fortressStep('wait');
    expect(sim.conditions.porosity).toBeGreaterThan(0);
    expect(sim.conditions.porosity).toBeLessThanOrEqual(1);
  });

  it('appends a trajectory without restarting an active geological history', () => {
    (globalThis as any).setFortressInstantLines(true);
    (globalThis as any).fortressBeginFromScenario('cooling', 8134);
    const sim = (globalThis as any)._liveFortressSim();
    (globalThis as any).fortressStep('wait');
    const existingCount = sim.conditions._scenario.movements.length;
    const activeState = sim._movements._state[0];
    expect(activeState.started).toBe(true);

    (globalThis as any).fortressStep('schedule_movement', {
      field: 'flow_rate', operator: 'pulse', value: 1.5,
      delay: 0, duration: 5, origin: 'global',
    });

    expect(sim.conditions._scenario.movements).toHaveLength(existingCount + 1);
    expect(sim._movements.movements).toHaveLength(existingCount + 1);
    expect(sim._movements._state).toHaveLength(existingCount + 1);
    expect(sim._movements._state[0]).toBe(activeState);
    expect(sim._movements._state[0].started).toBe(true);
  });

  it('builds, seals, and breaches an explicit feeder network', () => {
    (globalThis as any).fortressBeginFromScenario('cooling', 8131);
    const sim = (globalThis as any)._liveFortressSim();
    (globalThis as any).fortressStep('configure_feeders', {
      deposition: true,
      spots: [
        { cell: 0, kind: 'geyser', supply: 2.4, decayBonus: 1.1 },
        { cell: 10, kind: 'crack', supply: 1, decayBonus: 1.8 },
        { cell: 999999, kind: 'hotspot' },
      ],
    });
    expect(sim._fluidSpots.spots).toHaveLength(2);
    expect(sim._fluidSpotsDeposition).toBe(true);
    expect(sim._fluidSpots.spots[0]).toMatchObject({ cell: 0, kind: 'geyser', supply: 2.4 });

    (globalThis as any).fortressStep('toggle_feeders', { action: 'seal', kind: 'geyser' });
    expect(sim._fluidSpots.spots.find((s: any) => s.kind === 'geyser').open).toBe(false);
    expect(sim._fluidSpots.spots.find((s: any) => s.kind === 'crack').open).toBe(true);
    (globalThis as any).fortressStep('toggle_feeders', { action: 'breach', kind: 'geyser' });
    expect(sim._fluidSpots.openSpots()).toHaveLength(2);
  });

  it('sets spatial zone chemistry on the mesh and derives spatial nucleation', () => {
    (globalThis as any).fortressBeginFromScenario('cooling', 8133);
    const sim = (globalThis as any)._liveFortressSim();
    (globalThis as any).fortressStep('set_zone_chemistry', {
      zone: 'floor', field: 'Ca', value: 777,
    });
    const mesh = sim.wall_state.meshFor(sim);
    const columns = sim.wall_state.cells_per_ring;
    const floorCells = mesh.cells.filter((_cell: any, index: number) =>
      sim.wall_state.ringOrientation(Math.floor(index / columns)) === 'floor');
    const nonFloorCells = mesh.cells.filter((_cell: any, index: number) =>
      sim.wall_state.ringOrientation(Math.floor(index / columns)) !== 'floor');

    expect(sim.conditions.wall.zone_chemistry.floor.Ca).toBe(777);
    expect(floorCells.length).toBeGreaterThan(0);
    expect(floorCells.every((cell: any) => cell.fluid.Ca === 777)).toBe(true);
    expect(nonFloorCells.some((cell: any) => cell.fluid.Ca !== 777)).toBe(true);
    expect(sim.conditions.wall.per_vertex_nucleation).toBe(true);
    expect(sim.wall_state.per_vertex_nucleation).toBe(true);

    (globalThis as any).fortressStep('set_zone_chemistry', {
      zone: 'floor', field: 'Ca', clear: true,
    });
    expect(sim.conditions.wall.zone_chemistry).toBeNull();
    expect(sim.conditions.wall.per_vertex_nucleation).toBe(false);
  });

  it('records Creative deformation/film and rejects unsupported physical etch', () => {
    (globalThis as any).fortressBeginFromScenario('cooling', 8132);
    const sim = (globalThis as any)._liveFortressSim();
    sim.crystals.push({
      active: true, dissolved: false, enclosed_by: null, mineral: 'quartz',
      crystal_id: 999, total_growth_um: 100, zones: [{ step: -1, thickness_um: 100 }],
    });

    (globalThis as any).fortressStep('apply_deformation', {
      style: 'shear', magnitude: 0.7, minerals: ['quartz'],
    });
    (globalThis as any).fortressStep('apply_etch', {
      duration_days: 4, minerals: ['quartz'],
    });
    (globalThis as any).fortressStep('apply_film', {
      mineral: 'chlorite', prism: 0.35, term: 0.2, minerals: ['quartz'],
    });

    expect(sim._deformationEvents.at(-1)).toMatchObject({ style: 'shear', magnitude: 0.7 });
    expect(sim._etchEvents.at(-1)).toMatchObject({ duration_days: 4, physical: true });
    expect(sim._etchEvents.at(-1)).not.toHaveProperty('style');
    expect(sim._lastPhysicalEtch).toMatchObject({ considered: 1, accepted: 0, rejected: 1 });
    expect(sim._lastPhysicalEtch.receipts[0].rejection)
      .toBe('no_face_matched_evidence_bounded_rate_model');
    expect(sim.crystals[0]._film).toMatchObject({ mineral: 'chlorite', phi_prism: 0.35, phi_term: 0.2 });
  });
});

describe('responsive and accessible shell contracts', () => {
  it('makes every title mode card a native keyboard-operable control', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const cards = parsed.querySelectorAll('.title-modes button.title-mode-card');
    expect(cards).toHaveLength(6);
    for (const card of Array.from(cards)) {
      expect(card.getAttribute('type')).toBe('button');
      expect(card.textContent?.trim().length).toBeGreaterThan(0);
      expect(card.getAttribute('onclick')).toMatch(/switchMode/);
    }
    expect(html).toMatch(/\.title-mode-card:focus-visible\s*\{[\s\S]*?outline:/);
  });

  it('keeps all Begin choices inside the New Game panel', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const panel = parsed.getElementById('new-game-panel');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('Or jump straight in.');
    expect(panel?.querySelector('button[onclick="openScenariosPicker()"]')).not.toBeNull();
    expect(panel?.querySelector('button[onclick="showTitleScreen()"]')).not.toBeNull();
  });

  it('gives symbol-only topology controls accessible names', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const symbolButtons = parsed.querySelectorAll(
      '.topo-zoom-ctrls button, .topo-slice-ctrls button, .topo-camera-ctrls button, #topo-replay-btn, #topo-replay-bar button',
    );
    expect(symbolButtons.length).toBeGreaterThan(0);
    for (const button of Array.from(symbolButtons)) {
      expect(button.getAttribute('aria-label'), button.outerHTML).toBeTruthy();
    }
  });

  it('associates every Creative setup input with its visible label', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const controls = parsed.querySelectorAll('#fortress-setup input[id], #fortress-setup select[id]');
    expect(controls.length).toBeGreaterThan(0);
    for (const control of Array.from(controls)) {
      expect(parsed.querySelector(`label[for="${control.id}"]`), control.id).not.toBeNull();
    }
  });

  it('contains explicit narrow-screen overflow safeguards', () => {
    expect(html).toMatch(/\.title-logo\s*\{[\s\S]*?max-width:\s*100%[\s\S]*?letter-spacing:\s*0\.2em/);
    expect(html).toMatch(/\.mode-toggle\s*\{[\s\S]*?flex-wrap:\s*wrap/);
    expect(html).toMatch(/\.setup-row input\[type="range"\]\s*\{[\s\S]*?min-width:\s*0/);
  });

  it('keeps phone buttons and exact-value fields at a 44px touch target', () => {
    expect(html).toMatch(/@media \(max-width: 600px\) \{[\s\S]*?button,[\s\S]*?input\[type="number"\][\s\S]*?min-height:\s*44px/);
    expect(html).toMatch(/\.topo-zoom-btn\s*\{\s*width:\s*44px;\s*height:\s*44px;/);
    expect(html).toMatch(/\.topo-camera-ctrls\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  });
});

describe('Simulation playback lifecycle', () => {
  it('removes a hidden continue gate when playback is cancelled', () => {
    const output = document.createElement('div');
    output.id = 'playback-cancel-fixture';
    document.body.appendChild(output);
    let resumed = 0;

    (globalThis as any)._insertContinuePrompt(
      output,
      'prologue',
      () => { resumed++; },
    );
    expect(output.querySelector('.narrative-continue-pill')).not.toBeNull();

    (globalThis as any).cancelSimulationPlayback();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(resumed).toBe(0);
    expect(output.querySelector('.narrative-continue-pill')).toBeNull();
    output.remove();
  });
});
