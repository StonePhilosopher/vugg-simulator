import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const makeSimulationStartCommand: (scenarioId: string, seed?: number, overrides?: any) => any;
declare const makeSimulationAdvanceCommand: (steps: number) => any;
declare const makeSimulationCancelCommand: (reason?: string) => any;
declare const makeSimulationResumeCommand: () => any;
declare const makeSimulationCavitySurfaceProviderCommand: (kind: any, opts?: any) => any;
declare const startSimulationCommandRuntime: (command: any) => any;
declare const applySimulationCommand: (runtime: any, command: any) => any;
declare const createSimulationCheckpoint: (runtime: any) => any;
declare const restoreSimulationCommandRuntime: (checkpoint: any) => any;
declare const persistSimulationCheckpoint: (checkpoint: any, storage?: any) => any;
declare const recoverPersistedSimulationRuntime: (storage?: any) => any;
declare const runSimulationProgressively: (runtime: any, steps: number, opts?: any) => Promise<any>;
declare const simulationStateFingerprint: (runtime: any) => string;
declare const _topoCavitySurfaceSource: any;
declare const createSimulationWorkerEndpoint: (send: (message: any) => void) => (message: any) => Promise<void>;

describe('immutable simulation command/checkpoint protocol', () => {
  it('defaults the run seed to 42 without overriding the scenario-authored shape seed', () => {
    const command = makeSimulationStartCommand('tutorial_travertine');
    expect(command.seed).toBe(42);
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.overrides)).toBe(true);
    const runtime = startSimulationCommandRuntime(command);
    expect(runtime.origin.seed).toBe(42);
    expect(runtime.sim.conditions.wall.shape_seed).toBe(
      SCENARIOS.tutorial_travertine().conditions.wall.shape_seed,
    );
  });

  it('has identical state for one-shot, chunked, checkpoint-restored, and resumed runs', async () => {
    const start = makeSimulationStartCommand('cooling', 42);
    const direct = startSimulationCommandRuntime(start);
    applySimulationCommand(direct, makeSimulationAdvanceCommand(12));

    const chunked = startSimulationCommandRuntime(start);
    const progress: number[] = [];
    await runSimulationProgressively(chunked, 12, {
      chunkSteps: 3,
      yieldFn: async () => {},
      onProgress: (row: any) => progress.push(row.completed),
    });
    expect(progress).toEqual([3, 6, 9, 12]);
    expect(simulationStateFingerprint(chunked)).toBe(simulationStateFingerprint(direct));

    const encoded = JSON.stringify(createSimulationCheckpoint(chunked));
    const restored = restoreSimulationCommandRuntime(JSON.parse(encoded));
    expect(simulationStateFingerprint(restored)).toBe(simulationStateFingerprint(direct));
    expect(restored.commandLog.filter((c: any) => c.type === 'advance')).toHaveLength(1);

    const cancelled = startSimulationCommandRuntime(start);
    let yielded = false;
    const stopped = await runSimulationProgressively(cancelled, 12, {
      chunkSteps: 2,
      yieldFn: async () => {
        if (!yielded) {
          yielded = true;
          applySimulationCommand(cancelled, makeSimulationCancelCommand('test cancellation'));
        }
      },
    });
    expect(stopped).toMatchObject({ status: 'cancelled', completed: 2 });
    const recoveredCancelled = restoreSimulationCommandRuntime(
      JSON.parse(JSON.stringify(stopped.checkpoint)),
    );
    applySimulationCommand(recoveredCancelled, makeSimulationResumeCommand());
    applySimulationCommand(recoveredCancelled, makeSimulationAdvanceCommand(10));
    expect(simulationStateFingerprint(recoveredCancelled)).toBe(simulationStateFingerprint(direct));
  });

  it('rejects command/checkpoint tampering', () => {
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    const command = JSON.parse(JSON.stringify(makeSimulationAdvanceCommand(2)));
    command.steps = 3;
    expect(() => applySimulationCommand(runtime, command)).toThrow('integrity mismatch');

    const checkpoint = JSON.parse(JSON.stringify(createSimulationCheckpoint(runtime)));
    checkpoint.completedSteps = 999;
    expect(() => restoreSimulationCommandRuntime(checkpoint)).toThrow('checkpoint integrity mismatch');
  });

  it('rejects obsolete topology commands without mutating state or checkpoint history', () => {
    expect(() => makeSimulationCavitySurfaceProviderCommand('mystery'))
      .toThrow(/unsupported cavity surface provider/i);
    const start = makeSimulationStartCommand('cooling', 42);
    const runtime = startSimulationCommandRuntime(start);
    const baseline = simulationStateFingerprint(runtime);
    const activate = makeSimulationCavitySurfaceProviderCommand(
      'cavity-field', { resolution: 20, isovalue: 0 },
    );
    const baselineLog = JSON.stringify(runtime.commandLog);
    expect(() => applySimulationCommand(runtime, activate))
      .toThrow(/fixed before nucleation/i);
    expect(runtime.sim.wall_state.cavitySurfaceAnchorProviderReceipt()).toMatchObject({
      kind: 'cavity-field', resolution: 48, isovalue: 0,
    });
    expect(simulationStateFingerprint(runtime)).toBe(baseline);
    expect(JSON.stringify(runtime.commandLog)).toBe(baselineLog);
    const restored = restoreSimulationCommandRuntime(
      JSON.parse(JSON.stringify(createSimulationCheckpoint(runtime))),
    );
    expect(simulationStateFingerprint(restored)).toBe(simulationStateFingerprint(runtime));
    expect(restored.sim.wall_state.cavitySurfaceAnchorProviderReceipt())
      .toEqual(runtime.sim.wall_state.cavitySurfaceAnchorProviderReceipt());

    // Presentation capability/fallback is not part of simulation authority.
    // Reading the exact renderer source cannot change the command-derived state.
    const beforeRenderRead = simulationStateFingerprint(runtime);
    const source = _topoCavitySurfaceSource(runtime.sim.wall_state, runtime.sim, false, 48);
    expect(source.providerAuthority).toBe(true);
    expect(simulationStateFingerprint(runtime)).toBe(beforeRenderRead);
    expect(() => restoreSimulationCommandRuntime(
      JSON.parse(JSON.stringify(createSimulationCheckpoint(runtime))),
    )).not.toThrow();

    expect(() => applySimulationCommand(
      runtime, makeSimulationCavitySurfaceProviderCommand('wall-mesh'),
    )).toThrow(/fixed before nucleation/i);
    expect(simulationStateFingerprint(runtime)).toBe(baseline);
    expect(JSON.stringify(runtime.commandLog)).toBe(baselineLog);
  });

  it('treats the legacy production-selection command as an idempotent compatibility no-op', () => {
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    const baseline = simulationStateFingerprint(runtime);
    const baselineLog = JSON.stringify(runtime.commandLog);
    const command = makeSimulationCavitySurfaceProviderCommand(
      'cavity-field-production', { resolution: 8, isovalue: 0.5 },
    );
    // Presentation knobs are deliberately absent from the production command.
    expect(command).not.toHaveProperty('resolution');
    expect(command).not.toHaveProperty('isovalue');
    const result = applySimulationCommand(runtime, command);
    expect(result.cavitySurfaceProvider).toMatchObject({
      contract: {
        scientific_resolution: 48,
        isovalue: 0,
        volume_model: 'cartesian-field-freudenthal-volume-v2',
      },
      provider: {
        kind: 'cavity-field',
        resolution: 48,
        isovalue: 0,
      },
    });
    expect(simulationStateFingerprint(runtime)).toBe(baseline);
    expect(JSON.stringify(runtime.commandLog)).toBe(baselineLog);
    const fingerprint = baseline;
    const restored = restoreSimulationCommandRuntime(
      JSON.parse(JSON.stringify(createSimulationCheckpoint(runtime))),
    );
    expect(simulationStateFingerprint(restored)).toBe(fingerprint);
    expect(restored.sim.wall_state._cavityProductionAuthorityContract)
      .toEqual(runtime.sim.wall_state._cavityProductionAuthorityContract);
    expect(() => applySimulationCommand(
      runtime, makeSimulationCavitySurfaceProviderCommand('wall-mesh'),
    )).toThrow(/fixed before nucleation/i);

    const late = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    applySimulationCommand(late, makeSimulationAdvanceCommand(1));
    const lateFingerprint = simulationStateFingerprint(late);
    const lateLog = JSON.stringify(late.commandLog);
    expect(() => applySimulationCommand(late, command)).not.toThrow();
    expect(simulationStateFingerprint(late)).toBe(lateFingerprint);
    expect(JSON.stringify(late.commandLog)).toBe(lateLog);
  });

  it('fingerprints canonical local chemistry, dedicated RNG streams, and dissolution inventories', () => {
    const fresh = () => startSimulationCommandRuntime(
      makeSimulationStartCommand('cooling', 42),
    );

    const localChemistry = fresh();
    const localBaseline = simulationStateFingerprint(localChemistry);
    const localGrid = localChemistry.sim.wall_state.voxelGridFor(localChemistry.sim);
    const interior = localGrid.voxels.find((voxel: any) => voxel.depthIdx === 1);
    interior.fluid.Ba += 0.125;
    expect(simulationStateFingerprint(localChemistry)).not.toBe(localBaseline);

    const thermalCursor = fresh();
    const cursorBaseline = simulationStateFingerprint(thermalCursor);
    thermalCursor.sim._thermalRng.random();
    expect(simulationStateFingerprint(thermalCursor)).not.toBe(cursorBaseline);

    const orientationCursor = fresh();
    const orientationBaseline = simulationStateFingerprint(orientationCursor);
    orientationCursor.sim._orientRng();
    expect(simulationStateFingerprint(orientationCursor)).not.toBe(orientationBaseline);

    const nucleationSeed = fresh();
    const nucleationSeedBaseline = simulationStateFingerprint(nucleationSeed);
    nucleationSeed.sim._nucSharedState = (nucleationSeed.sim._nucSharedState + 1) >>> 0;
    expect(simulationStateFingerprint(nucleationSeed)).not.toBe(nucleationSeedBaseline);

    const movementCursor = startSimulationCommandRuntime(
      makeSimulationStartCommand('mvt', 42),
    );
    applySimulationCommand(movementCursor, makeSimulationAdvanceCommand(1));
    const movementCursorBaseline = simulationStateFingerprint(movementCursor);
    movementCursor.sim._movements.rng();
    expect(simulationStateFingerprint(movementCursor)).not.toBe(movementCursorBaseline);

    const movementState = startSimulationCommandRuntime(
      makeSimulationStartCommand('mvt', 42),
    );
    applySimulationCommand(movementState, makeSimulationAdvanceCommand(1));
    const movementStateBaseline = simulationStateFingerprint(movementState);
    movementState.sim._movements._state[0].ou += 0.001;
    expect(simulationStateFingerprint(movementState)).not.toBe(movementStateBaseline);

    const dissolutionLedger = fresh();
    dissolutionLedger.sim.crystals.push({
      crystal_id: 999, mineral: 'aragonite', active: true, dissolved: false,
      zones: [{
        thickness_um: 10,
        _remaining_solid_um: 10,
        _budget_inventory_per_um: { Ca: 0.1, CO3: 0.1, Sr: 0.001 },
        sr_partition: { effectiveDistributionCoefficient: 1.38 },
      }],
    });
    const ledgerBaseline = simulationStateFingerprint(dissolutionLedger);
    dissolutionLedger.sim.crystals.at(-1).zones[0]._budget_inventory_per_um.Sr += 1e-6;
    expect(simulationStateFingerprint(dissolutionLedger)).not.toBe(ledgerBaseline);

    const enclosure = fresh();
    enclosure.sim.crystals.push({
      crystal_id: 1001,
      mineral: 'pyrite',
      active: false,
      dissolved: false,
      _buried: false,
      position: 'on calcite #1000',
      enclosed_by: 1000,
      enclosed_crystals: [],
      enclosed_at_step: [],
      coats_front: true,
      _film: { mineral: 'pyrite', phi_term: 0.08, phi_prism: 0, step: 4 },
      enclosure_receipt: { schema: 'enclosure-receipt-v1', step: 4 },
      liberation_receipt: null,
      zones: [{ step: 1, thickness_um: 1 }],
    });
    enclosure.sim._enclosureReceipts.push({
      schema: 'enclosure-receipt-v1',
      event: 'enclosed',
      step: 4,
      host_crystal_id: 1000,
      guest_crystal_id: 1001,
    });
    let enclosureBaseline = simulationStateFingerprint(enclosure);
    for (const mutate of [
      () => { enclosure.sim.crystals.at(-1)._buried = true; },
      () => { enclosure.sim.crystals.at(-1).position = 'vug wall'; },
      () => { enclosure.sim.crystals.at(-1).enclosed_by = 999; },
      () => { enclosure.sim.crystals.at(-1).enclosed_crystals.push(7); },
      () => { enclosure.sim.crystals.at(-1).enclosed_at_step.push(4); },
      () => { enclosure.sim.crystals.at(-1).coats_front = false; },
      () => { enclosure.sim.crystals.at(-1)._film.phi_term = 0.04; },
      () => { enclosure.sim.crystals.at(-1).enclosure_receipt.step = 5; },
      () => { enclosure.sim.crystals.at(-1).liberation_receipt = { schema: 'liberation-receipt-v1', step: 6 }; },
      () => { enclosure.sim._enclosureReceipts[0].step = 5; },
    ]) {
      mutate();
      const next = simulationStateFingerprint(enclosure);
      expect(next).not.toBe(enclosureBaseline);
      enclosureBaseline = next;
    }

    const transition = fresh();
    transition.sim.crystals.push({
      crystal_id: 1002,
      mineral: 'pararealgar',
      active: true,
      dissolved: false,
      paramorph_origin: 'realgar',
      paramorph_step: 70,
      light_exposure_steps: 60,
      light_exposure_route: 'excavated',
      dry_exposure_steps: 0,
      phase_transition_history: [{
        schema: 'light-induced-transformation-v1',
        step: 70,
        from: 'realgar',
        to: 'pararealgar',
        driver: 'visible-light-isomerization',
        exposure_route: 'excavated',
        exposure_steps: 60,
        threshold_steps: 60,
      }],
      dehydration_history: [],
      zones: [{ step: 1, thickness_um: 1 }],
    });
    let transitionBaseline = simulationStateFingerprint(transition);
    for (const mutate of [
      () => { transition.sim.crystals.at(-1).phase_transition_history[0].step = 71; },
      () => { transition.sim.crystals.at(-1).dehydration_history.push({ step: 72 }); },
      () => { transition.sim.crystals.at(-1).paramorph_origin = 'orpiment'; },
      () => { transition.sim.crystals.at(-1).paramorph_step = 71; },
      () => { transition.sim.crystals.at(-1).light_exposure_steps = 61; },
      () => { transition.sim.crystals.at(-1).light_exposure_route = 'surface'; },
      () => { transition.sim.crystals.at(-1).dry_exposure_steps = 1; },
    ]) {
      mutate();
      const next = simulationStateFingerprint(transition);
      expect(next).not.toBe(transitionBaseline);
      transitionBaseline = next;
    }

    const morphology = fresh();
    morphology.sim.crystals.push({
      crystal_id: 1003,
      mineral: 'pyrite',
      active: true,
      dissolved: false,
      _morphology: {
        status: 'unavailable-nonfinite-post-step',
        unavailable_reason: 'nonfinite-post-step-sigma',
        sigma_basis: 'post-step-unavailable',
        post_step_sigma: null,
        regime: null,
        form: null,
        surf_sigma: null,
      },
      zones: [{ step: 1, thickness_um: 1 }],
    });
    const unavailableBaseline = simulationStateFingerprint(morphology);
    morphology.sim.crystals.at(-1)._morphology = {
      status: 'classified',
      unavailable_reason: null,
      sigma_basis: 'post-step',
      post_step_sigma: 1.2,
      regime: 'spiral_smooth',
      form: 'cubic',
      surf_sigma: 1.2,
    };
    const smoothFingerprint = simulationStateFingerprint(morphology);
    expect(smoothFingerprint).not.toBe(unavailableBaseline);
    morphology.sim.crystals.at(-1)._morphology.regime = 'dendritic';
    morphology.sim.crystals.at(-1)._morphology.surf_sigma = 5;
    expect(simulationStateFingerprint(morphology)).not.toBe(smoothFingerprint);
  });

  it('preserves future-determining live morphology through checkpoint replay and continuation', () => {
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('mvt', 42));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(40));
    const pyrite = runtime.sim.crystals.find((crystal: any) =>
      crystal.mineral === 'pyrite' && crystal._morphology?.status === 'classified');
    expect(pyrite).toBeTruthy();
    const checkpoint = JSON.parse(JSON.stringify(createSimulationCheckpoint(runtime)));
    const restored = restoreSimulationCommandRuntime(checkpoint);
    const restoredPyrite = restored.sim.crystals.find((crystal: any) =>
      crystal.crystal_id === pyrite.crystal_id);
    expect(restoredPyrite?._morphology).toEqual(pyrite._morphology);
    expect(simulationStateFingerprint(restored)).toBe(simulationStateFingerprint(runtime));

    applySimulationCommand(runtime, makeSimulationAdvanceCommand(2));
    applySimulationCommand(restored, makeSimulationAdvanceCommand(2));
    expect(simulationStateFingerprint(restored)).toBe(simulationStateFingerprint(runtime));
  });

  it('persists crash-safely and recovers the prior generation when primary is corrupt', () => {
    localStorage.clear();
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(3));
    persistSimulationCheckpoint(createSimulationCheckpoint(runtime));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(2));
    persistSimulationCheckpoint(createSimulationCheckpoint(runtime));

    localStorage.setItem('vugg.simulation.checkpoint.v2.primary', '{not-json');
    const recovered = recoverPersistedSimulationRuntime();
    expect(recovered.source).toBe('backup');
    expect(recovered.generation).toBe(1);
    expect(recovered.errors[0]).toContain('primary');
    expect(recovered.runtime.sim.step).toBe(3);
    expect(simulationStateFingerprint(recovered.runtime)).not.toBe(
      simulationStateFingerprint(runtime),
    );
  });

  it('recovers a newer valid staging generation instead of an older valid primary', () => {
    const values = new Map<string, string>();
    let failPrimary = false;
    const storage = {
      getItem(key: string) { return values.get(key) ?? null; },
      setItem(key: string, value: string) {
        if (failPrimary && key === 'vugg.simulation.checkpoint.v2.primary') {
          throw new Error('simulated interruption before primary commit');
        }
        values.set(key, value);
      },
      removeItem(key: string) { values.delete(key); },
    };

    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(3));
    const first = persistSimulationCheckpoint(createSimulationCheckpoint(runtime), storage);
    expect(first.generation).toBe(1);

    applySimulationCommand(runtime, makeSimulationAdvanceCommand(2));
    failPrimary = true;
    expect(() => persistSimulationCheckpoint(createSimulationCheckpoint(runtime), storage))
      .toThrow('simulated interruption');

    const recovered = recoverPersistedSimulationRuntime(storage);
    expect(recovered).toMatchObject({ source: 'staging', generation: 2 });
    expect(recovered.runtime.sim.step).toBe(5);
    expect(simulationStateFingerprint(recovered.runtime))
      .toBe(simulationStateFingerprint(runtime));
  });

  it('accepts byte-identical same-generation copies with documented primary priority', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem(key: string) { return values.get(key) ?? null; },
      setItem(key: string, value: string) { values.set(key, value); },
      removeItem(key: string) { values.delete(key); },
    };
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(3));
    persistSimulationCheckpoint(createSimulationCheckpoint(runtime), storage);
    const primary = values.get('vugg.simulation.checkpoint.v2.primary');
    expect(primary).toBeTruthy();
    values.set('vugg.simulation.checkpoint.v2.staging', primary!);

    const recovered = recoverPersistedSimulationRuntime(storage);
    expect(recovered).toMatchObject({ source: 'primary', generation: 1, errors: [] });
    expect(simulationStateFingerprint(recovered.runtime))
      .toBe(simulationStateFingerprint(runtime));
  });

  it('fails closed on divergent independently valid envelopes at one generation', () => {
    const makeStorage = () => {
      const values = new Map<string, string>();
      return {
        values,
        storage: {
          getItem(key: string) { return values.get(key) ?? null; },
          setItem(key: string, value: string) { values.set(key, value); },
          removeItem(key: string) { values.delete(key); },
        },
      };
    };
    const a = makeStorage();
    const b = makeStorage();
    const runtimeA = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    const runtimeB = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    applySimulationCommand(runtimeA, makeSimulationAdvanceCommand(3));
    applySimulationCommand(runtimeB, makeSimulationAdvanceCommand(4));
    persistSimulationCheckpoint(createSimulationCheckpoint(runtimeA), a.storage);
    persistSimulationCheckpoint(createSimulationCheckpoint(runtimeB), b.storage);
    a.values.set(
      'vugg.simulation.checkpoint.v2.staging',
      b.values.get('vugg.simulation.checkpoint.v2.primary')!,
    );

    const recovered = recoverPersistedSimulationRuntime(a.storage);
    expect(recovered.runtime).toBeNull();
    expect(recovered.source).toBeNull();
    expect(recovered.errors).toContain(
      'generation 1: divergent authenticated checkpoint envelopes',
    );
  });

  it('ignores a corrupt staging role when a lower valid generation survives', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem(key: string) { return values.get(key) ?? null; },
      setItem(key: string, value: string) { values.set(key, value); },
      removeItem(key: string) { values.delete(key); },
    };
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(3));
    persistSimulationCheckpoint(createSimulationCheckpoint(runtime), storage);
    values.set('vugg.simulation.checkpoint.v2.staging', '{corrupt-newer-looking-slot');

    const recovered = recoverPersistedSimulationRuntime(storage);
    expect(recovered).toMatchObject({ source: 'primary', generation: 1 });
    expect(recovered.errors.some((message: string) => message.startsWith('staging:'))).toBe(true);
    expect(simulationStateFingerprint(recovered.runtime))
      .toBe(simulationStateFingerprint(runtime));
  });

  it('reduces structured-clone worker messages one bounded chunk at a time', async () => {
    const messages: any[] = [];
    const endpoint = createSimulationWorkerEndpoint(message => messages.push(
      JSON.parse(JSON.stringify(message)),
    ));
    await endpoint({
      schema: 'vugg-simulation-worker-message-v1', requestId: 'start',
      command: makeSimulationStartCommand('cooling', 42),
    });
    expect(messages.at(-1)).toMatchObject({ ok: true, requestId: 'start' });
    await endpoint({
      schema: 'vugg-simulation-worker-message-v1', requestId: 'advance', maxChunkSteps: 3,
      command: makeSimulationAdvanceCommand(7),
    });
    expect(messages.at(-1)).toMatchObject({
      ok: true, requestId: 'advance',
      result: { executedSteps: 3, remainingSteps: 4, step: 3 },
    });

    const resumedMessages: any[] = [];
    const resumedEndpoint = createSimulationWorkerEndpoint(message => resumedMessages.push(message));
    await resumedEndpoint({
      schema: 'vugg-simulation-worker-message-v1', requestId: 'restore-advance', maxChunkSteps: 2,
      checkpoint: messages.at(-1).checkpoint,
      command: makeSimulationAdvanceCommand(2),
    });
    expect(resumedMessages.at(-1)).toMatchObject({
      ok: true, result: { executedSteps: 2, step: 5 },
    });
  });
});
