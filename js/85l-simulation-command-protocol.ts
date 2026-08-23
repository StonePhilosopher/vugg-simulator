// ============================================================
// js/85l-simulation-command-protocol.ts — deterministic command/checkpoint host
// ============================================================
// The scientific engine remains synchronous one step at a time. This layer
// makes orchestration immutable and structured-clone-safe, so the same command
// messages can run on the main thread today or inside a dedicated worker later.

const SIMULATION_COMMAND_SCHEMA = 'vugg-simulation-command-v1';
const SIMULATION_CHECKPOINT_SCHEMA = 'vugg-simulation-checkpoint-v1';
const SIMULATION_WORKER_MESSAGE_SCHEMA = 'vugg-simulation-worker-message-v1';
const SIMULATION_CHECKPOINT_STORAGE_SCHEMA = 'vugg-simulation-checkpoint-storage-v1';
const SIMULATION_CHECKPOINT_STORAGE_KEYS = Object.freeze({
  primary: 'vugg.simulation.checkpoint.v1.primary',
  staging: 'vugg.simulation.checkpoint.v1.staging',
  backup: 'vugg.simulation.checkpoint.v1.backup',
});

function _simulationJsonClone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function _simulationDeepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as any)) _simulationDeepFreeze(child);
  return value;
}

function _simulationCommandId(payload: any): string {
  return sha256HexUtf8(JSON.stringify(payload));
}

function makeSimulationStartCommand(
  scenarioId: string,
  seed: number = 42,
  overrides: any = {},
): any {
  const payload = {
    schema: SIMULATION_COMMAND_SCHEMA,
    type: 'start',
    scenarioId: String(scenarioId),
    seed: Number.isFinite(seed) ? Math.trunc(seed) : 42,
    overrides: _simulationJsonClone(overrides || {}),
  };
  return _simulationDeepFreeze({ ...payload, commandId: _simulationCommandId(payload) });
}

function makeSimulationAdvanceCommand(steps: number): any {
  const payload = {
    schema: SIMULATION_COMMAND_SCHEMA,
    type: 'advance',
    steps: Math.max(0, Math.trunc(Number(steps) || 0)),
  };
  return _simulationDeepFreeze({ ...payload, commandId: _simulationCommandId(payload) });
}

function makeSimulationCancelCommand(reason: string = 'cancelled by caller'): any {
  const payload = { schema: SIMULATION_COMMAND_SCHEMA, type: 'cancel', reason: String(reason) };
  return _simulationDeepFreeze({ ...payload, commandId: _simulationCommandId(payload) });
}

function makeSimulationResumeCommand(): any {
  const payload = { schema: SIMULATION_COMMAND_SCHEMA, type: 'resume' };
  return _simulationDeepFreeze({ ...payload, commandId: _simulationCommandId(payload) });
}

function makeSimulationThermalSourceCommand(action: 'set' | 'remove' | 'clear', payload: any = {}): any {
  const normalizedAction = ['set', 'remove', 'clear'].includes(action) ? action : 'set';
  const body = normalizedAction === 'set'
    ? { source: _simulationJsonClone(payload || {}) }
    : normalizedAction === 'remove'
      ? { id: String(payload?.id ?? payload ?? '') }
      : {};
  const commandPayload = {
    schema: SIMULATION_COMMAND_SCHEMA,
    type: 'thermal_source',
    action: normalizedAction,
    ...body,
  };
  return _simulationDeepFreeze({
    ...commandPayload,
    commandId: _simulationCommandId(commandPayload),
  });
}

function makeSimulationThermalFieldCommand(config: any = {}): any {
  const commandPayload = {
    schema: SIMULATION_COMMAND_SCHEMA,
    type: 'thermal_field',
    config: _simulationJsonClone(config || {}),
  };
  return _simulationDeepFreeze({
    ...commandPayload,
    commandId: _simulationCommandId(commandPayload),
  });
}

function makeSimulationCavitySurfaceProviderCommand(
  kind: 'wall-mesh' | 'cavity-field' | 'cavity-field-production', opts: any = {},
): any {
  if (kind !== 'wall-mesh' && kind !== 'cavity-field' && kind !== 'cavity-field-production') {
    throw new RangeError(`unsupported cavity surface provider '${String(kind)}'`);
  }
  const providerKind = kind;
  const commandPayload: any = {
    schema: SIMULATION_COMMAND_SCHEMA,
    type: 'cavity_surface_provider',
    kind: providerKind,
  };
  if (providerKind === 'cavity-field') {
    commandPayload.resolution = Math.max(8, Math.min(128,
      Math.round(Number(opts.resolution) || 48)));
    commandPayload.isovalue = Number.isFinite(Number(opts.isovalue))
      ? Number(opts.isovalue) : 0;
  }
  return _simulationDeepFreeze({
    ...commandPayload,
    commandId: _simulationCommandId(commandPayload),
  });
}

function _simulationAssertCommand(command: any, expectedType?: string): void {
  if (!command || command.schema !== SIMULATION_COMMAND_SCHEMA) {
    throw new Error('invalid simulation command schema');
  }
  if (expectedType && command.type !== expectedType) {
    throw new Error(`expected ${expectedType} command, received ${command.type}`);
  }
  const { commandId: _ignored, ...payload } = command;
  if (command.commandId !== _simulationCommandId(payload)) {
    throw new Error('simulation command integrity mismatch');
  }
}

function _simulationFluidProjection(fluid: any): any {
  const out: any = {};
  for (const key of Object.keys(fluid || {}).sort()) {
    const value = fluid[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string' || typeof value === 'boolean' || value == null) out[key] = value;
  }
  return out;
}

function _simulationCanonicalProjection(value: any, seen = new Set<any>()): any {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'function' || typeof value === 'undefined') return undefined;
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const out = value.map(item => _simulationCanonicalProjection(item, seen));
    seen.delete(value);
    return out;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const out: any = {};
    for (const key of Object.keys(value).sort()) {
      const projected = _simulationCanonicalProjection(value[key], seen);
      if (projected !== undefined) out[key] = projected;
    }
    seen.delete(value);
    return out;
  }
  return String(value);
}

function _simulationCrystalProjection(crystal: any): any {
  return {
    id: crystal.crystal_id,
    mineral: crystal.mineral,
    active: !!crystal.active,
    dissolved: !!crystal.dissolved,
    buried: !!crystal._buried,
    totalGrowthUm: Number(crystal.total_growth_um) || 0,
    cLengthMm: Number(crystal.c_length_mm) || 0,
    aWidthMm: Number(crystal.a_width_mm) || 0,
    habit: crystal.habit || null,
    position: crystal.position || null,
    enclosedBy: crystal.enclosed_by ?? null,
    enclosedCrystals: _simulationCanonicalProjection(crystal.enclosed_crystals || []),
    enclosedAtStep: _simulationCanonicalProjection(crystal.enclosed_at_step || []),
    coatsFront: crystal.coats_front ?? null,
    surfaceFilm: _simulationCanonicalProjection(crystal._film || null),
    enclosureReceipt: _simulationCanonicalProjection(crystal.enclosure_receipt || null),
    liberationReceipt: _simulationCanonicalProjection(crystal.liberation_receipt || null),
    phaseTransitionHistory: _simulationCanonicalProjection(
      crystal.phase_transition_history || [],
    ),
    dehydrationHistory: _simulationCanonicalProjection(crystal.dehydration_history || []),
    paramorphOrigin: crystal.paramorph_origin || null,
    paramorphStep: crystal.paramorph_step ?? null,
    lightExposureSteps: crystal.light_exposure_steps ?? null,
    lightExposureRoute: crystal.light_exposure_route || null,
    dryExposureSteps: crystal.dry_exposure_steps ?? null,
    // Future-determining: growth engines dispatch the next habit from this
    // exact live terminal interface. An unavailable all-null summary must be
    // distinguishable from either a prior classified regime or no sample.
    liveMorphology: _simulationCanonicalProjection(crystal._morphology ?? null),
    nucleationTemperatureC: Number(crystal.nucleation_temp) || 0,
    wallAnchor: crystal.wall_anchor ? _simulationJsonClone(crystal.wall_anchor) : null,
    // Full canonical zone state is future-determining. In particular the
    // LIFO dissolution ledger reads accepted `_budget_inventory_per_um`,
    // remaining-solid thickness, trace stoichiometry, and Sr partition
    // receipts; a display-only subset cannot prove deterministic replay.
    zones: _simulationCanonicalProjection(crystal.zones || []),
  };
}

function simulationStateProjection(runtimeOrSim: any, rngStateOverride?: number): any {
  const runtime = runtimeOrSim?.sim ? runtimeOrSim : null;
  const sim = runtime ? runtime.sim : runtimeOrSim;
  const rngState = Number.isFinite(rngStateOverride)
    ? Number(rngStateOverride)
    : runtime && Number.isFinite(runtime.rngState)
      ? Number(runtime.rngState)
      : Number(rng?.state) || 0;
  const thermalGrid = sim?.wall_state?.voxelGridFor?.(sim);
  const dedicatedRngStates: any = {};
  for (const key of Object.keys(sim || {}).filter(key => /Rng$/.test(key)).sort()) {
    const state = Number(sim[key]?.state);
    if (Number.isFinite(state)) dedicatedRngStates[key] = state >>> 0;
  }
  return {
    simVersion: SIM_VERSION,
    modelDigest: MODEL_DIGEST,
    scenarioId: runtime?.origin?.scenarioId || sim?.conditions?._scenario?.id || null,
    seed: runtime?.origin?.seed ?? null,
    step: Number(sim?.step) || 0,
    rngState: rngState >>> 0,
    nucleationSharedState: Number(sim?._nucSharedState) >>> 0,
    dedicatedRngStates,
    movementController: sim?._movements ? {
      rngState: Number(sim._movements.rng?.state) >>> 0,
      movements: _simulationCanonicalProjection(sim._movements.movements || []),
      state: _simulationCanonicalProjection(sim._movements._state || []),
    } : null,
    temperatureC: Number(sim?.conditions?.temperature) || 0,
    pressureKbar: Number(sim?.conditions?.pressure) || 0,
    flowRate: Number(sim?.conditions?.flow_rate) || 0,
    fluidSurfaceHeightMm: sim?.conditions?.fluid_surface_height_mm == null
      ? null : Number(sim.conditions.fluid_surface_height_mm),
    fluid: _simulationFluidProjection(sim?.conditions?.fluid),
    ringTemperatures: (sim?.ring_temperatures || []).map((v: any) => Number(v) || 0),
    voxelTemperatures: (thermalGrid?.voxels || []).map(
      (voxel: any) => Number(voxel?.temperature) || 0,
    ),
    // Every radial voxel is canonical chemistry, including d>=1 reservoirs
    // that are neither the bulk fluid nor the d=0 wall-cell alias.
    voxelFluids: (thermalGrid?.voxels || []).map(
      (voxel: any) => _simulationFluidProjection(voxel?.fluid),
    ),
    thermalSources: _simulationJsonClone(sim?._thermalSources || []),
    thermalSourceCounter: Number(sim?._thermalSourceCounter) || 0,
    thermalFieldActivated: !!sim?._thermalFieldActivated,
    thermalFieldEnabled: sim?.conditions?._scenario?.thermal_field?.enabled !== false,
    thermalFieldConfig: _simulationJsonClone(sim?.conditions?._scenario?.thermal_field || null),
    wallRockThermalBufferC: _simulationJsonClone(
      sim?.conditions?._scenario?.wall_rock_thermal_buffer_C ?? null,
    ),
    wallBoundary: _simulationCanonicalProjection(sim?.conditions?.wall || null),
    ringFluids: (sim?.ring_fluids || []).map(_simulationFluidProjection),
    wallCellDepthsMm: (sim?.wall_state?.rings || []).flatMap(
      (ring: any[]) => (ring || []).map((cell: any) => Number(cell?.wall_depth) || 0),
    ),
    cavityEvolution: sim?.wall_state?.cavityEvolutionLedger?.()
      ? _simulationCanonicalProjection(sim.wall_state.cavityEvolutionLedger().toJSON()) : null,
    cavitySurfaceProvider: _simulationCanonicalProjection(
      sim?.wall_state?.cavitySurfaceAnchorProviderReceipt?.() || { kind: 'wall-mesh' },
    ),
    crystals: (sim?.crystals || []).map(_simulationCrystalProjection),
    enclosureLifecycle: _simulationCanonicalProjection(sim?._enclosureReceipts || []),
    carbonateBoundary: sim?._carbonateBoundaryState
      ? _simulationJsonClone(sim._carbonateBoundaryState) : null,
  };
}

function simulationStateFingerprint(runtimeOrSim: any): string {
  return sha256HexUtf8(JSON.stringify(simulationStateProjection(runtimeOrSim)));
}

function _simulationAppendCommand(runtime: any, command: any): void {
  const copy = _simulationJsonClone(command);
  const prior = runtime.commandLog[runtime.commandLog.length - 1];
  if (copy.type === 'advance' && prior?.type === 'advance') {
    runtime.commandLog[runtime.commandLog.length - 1] = makeSimulationAdvanceCommand(
      prior.steps + copy.steps,
    );
  } else {
    runtime.commandLog.push(copy);
  }
}

function startSimulationCommandRuntime(startCommand: any): any {
  _simulationAssertCommand(startCommand, 'start');
  const factory = SCENARIOS?.[startCommand.scenarioId];
  if (typeof factory !== 'function') throw new Error(`unknown scenario '${startCommand.scenarioId}'`);
  rng = new SeededRandom(startCommand.seed);
  const scenarioData = factory(_simulationJsonClone(startCommand.overrides));
  const sim = new VugSimulator(scenarioData.conditions, scenarioData.events);
  const spec = factory._json5_spec ?? null;
  return {
    schema: 'vugg-simulation-runtime-v1',
    origin: _simulationJsonClone(startCommand),
    scenarioSpecHash: scenarioSpecHash(spec),
    scenarioData,
    sim,
    commandLog: [_simulationJsonClone(startCommand)],
    rngState: rng.state >>> 0,
    status: 'ready',
    cancelReason: null,
  };
}

function applySimulationCommand(runtime: any, command: any): any {
  _simulationAssertCommand(command);
  if (!runtime?.sim) throw new Error('simulation runtime is not initialized');
  if (command.type === 'start') throw new Error('start requires a new runtime');
  if (command.type === 'cancel') {
    runtime.status = 'cancelled';
    runtime.cancelReason = command.reason;
    _simulationAppendCommand(runtime, command);
    return { status: runtime.status, step: runtime.sim.step, reason: runtime.cancelReason };
  }
  if (command.type === 'resume') {
    if (runtime.status === 'complete') throw new Error('completed simulation cannot resume');
    runtime.status = 'ready';
    runtime.cancelReason = null;
    _simulationAppendCommand(runtime, command);
    return { status: runtime.status, step: runtime.sim.step };
  }
  if (command.type === 'thermal_source') {
    let result: any = null;
    if (command.action === 'set') result = runtime.sim.setThermalSource(command.source);
    else if (command.action === 'remove') result = runtime.sim.removeThermalSource(command.id);
    else if (command.action === 'clear') result = runtime.sim.clearThermalSources();
    else throw new Error(`unsupported thermal source action '${command.action}'`);
    _simulationAppendCommand(runtime, command);
    return {
      status: runtime.status,
      step: runtime.sim.step,
      thermalSources: _simulationJsonClone(runtime.sim._thermalSources || []),
      result: _simulationJsonClone(result),
      fingerprint: simulationStateFingerprint(runtime),
    };
  }
  if (command.type === 'thermal_field') {
    const result = runtime.sim.configureThermalField(command.config);
    _simulationAppendCommand(runtime, command);
    return {
      status: runtime.status,
      step: runtime.sim.step,
      thermalFieldConfig: _simulationJsonClone(result),
      fingerprint: simulationStateFingerprint(runtime),
    };
  }
  if (command.type === 'cavity_surface_provider') {
    if (command.kind !== 'wall-mesh' && command.kind !== 'cavity-field'
        && command.kind !== 'cavity-field-production') {
      throw new RangeError(`unsupported cavity surface provider '${String(command.kind)}'`);
    }
    if (command.kind !== 'cavity-field-production') {
      // Since v266 topology is immutable production state, not an action. Keep
      // decoding these legacy command shapes so rejection is explicit, but do
      // not mutate the provider, command log, RNG, or fingerprint.
      throw new RangeError(
        'Cartesian production cavity authority is fixed before nucleation; '
        + `provider '${command.kind}' cannot replace it`,
      );
    }
    const result = runtime.sim.enableProductionCavityAuthority();
    // Compatibility no-op only. New checkpoints start with the authority
    // already installed and therefore never depend on replaying this command.
    return {
      status: runtime.status,
      step: runtime.sim.step,
      cavitySurfaceProvider: _simulationJsonClone(result),
      fingerprint: simulationStateFingerprint(runtime),
    };
  }
  if (command.type !== 'advance') throw new Error(`unsupported simulation command '${command.type}'`);
  if (runtime.status === 'cancelled') {
    return { status: 'cancelled', step: runtime.sim.step, executedSteps: 0, lastLog: [] };
  }
  rng = new SeededRandom(0);
  rng.state = runtime.rngState >>> 0;
  let lastLog: string[] = [];
  runtime.status = 'running';
  for (let i = 0; i < command.steps; i++) lastLog = runtime.sim.run_step();
  runtime.rngState = rng.state >>> 0;
  _simulationAppendCommand(runtime, command);
  runtime.status = 'ready';
  return {
    status: runtime.status,
    step: runtime.sim.step,
    executedSteps: command.steps,
    lastLog,
    fingerprint: simulationStateFingerprint(runtime),
  };
}

function createSimulationCheckpoint(runtime: any): any {
  if (!runtime?.sim) throw new Error('simulation runtime is not initialized');
  const payload: any = {
    schema: SIMULATION_CHECKPOINT_SCHEMA,
    simVersion: SIM_VERSION,
    modelDigest: MODEL_DIGEST,
    scenarioSpecHash: runtime.scenarioSpecHash,
    origin: _simulationJsonClone(runtime.origin),
    commandLog: _simulationJsonClone(runtime.commandLog),
    status: runtime.status,
    cancelReason: runtime.cancelReason,
    completedSteps: runtime.sim.step,
    rngState: runtime.rngState >>> 0,
    stateFingerprint: simulationStateFingerprint(runtime),
  };
  payload.integrityHash = sha256HexUtf8(JSON.stringify(payload));
  return _simulationDeepFreeze(payload);
}

function restoreSimulationCommandRuntime(checkpointInput: any): any {
  const checkpoint = _simulationJsonClone(checkpointInput);
  if (checkpoint?.schema !== SIMULATION_CHECKPOINT_SCHEMA) throw new Error('invalid checkpoint schema');
  const integrityHash = checkpoint.integrityHash;
  delete checkpoint.integrityHash;
  if (integrityHash !== sha256HexUtf8(JSON.stringify(checkpoint))) throw new Error('checkpoint integrity mismatch');
  if (checkpoint.simVersion !== SIM_VERSION || checkpoint.modelDigest !== MODEL_DIGEST) {
    throw new Error('checkpoint model identity mismatch');
  }
  const start = checkpoint.commandLog?.[0];
  const runtime = startSimulationCommandRuntime(start);
  if (runtime.scenarioSpecHash !== checkpoint.scenarioSpecHash) throw new Error('checkpoint scenario identity mismatch');
  for (const command of checkpoint.commandLog.slice(1)) {
    if (command.type === 'cancel') {
      runtime.status = 'cancelled';
      runtime.cancelReason = command.reason;
      _simulationAppendCommand(runtime, command);
    } else if (command.type === 'resume') {
      runtime.status = 'ready';
      runtime.cancelReason = null;
      _simulationAppendCommand(runtime, command);
    } else {
      applySimulationCommand(runtime, command);
    }
  }
  if (runtime.sim.step !== checkpoint.completedSteps
      || runtime.rngState !== checkpoint.rngState
      || simulationStateFingerprint(runtime) !== checkpoint.stateFingerprint) {
    throw new Error('checkpoint deterministic replay mismatch');
  }
  runtime.status = checkpoint.status;
  runtime.cancelReason = checkpoint.cancelReason;
  return runtime;
}

function _validateSimulationCheckpointIntegrity(checkpointInput: any): any {
  const checkpoint = _simulationJsonClone(checkpointInput);
  if (checkpoint?.schema !== SIMULATION_CHECKPOINT_SCHEMA) {
    throw new Error('invalid checkpoint schema');
  }
  const integrityHash = checkpoint.integrityHash;
  delete checkpoint.integrityHash;
  if (integrityHash !== sha256HexUtf8(JSON.stringify(checkpoint))) {
    throw new Error('checkpoint integrity mismatch');
  }
  if (checkpoint.simVersion !== SIM_VERSION || checkpoint.modelDigest !== MODEL_DIGEST) {
    throw new Error('checkpoint model identity mismatch');
  }
  return { ...checkpoint, integrityHash };
}

function _encodeSimulationCheckpointEnvelope(checkpointInput: any): string {
  const checkpoint = _validateSimulationCheckpointIntegrity(checkpointInput);
  const payload: any = {
    schema: SIMULATION_CHECKPOINT_STORAGE_SCHEMA,
    writtenAt: new Date().toISOString(),
    checkpoint,
  };
  payload.integrityHash = sha256HexUtf8(JSON.stringify(payload));
  return JSON.stringify(payload);
}

function _decodeSimulationCheckpointEnvelope(encoded: string): any {
  const envelope = JSON.parse(encoded);
  if (envelope?.schema !== SIMULATION_CHECKPOINT_STORAGE_SCHEMA) {
    throw new Error('invalid checkpoint storage schema');
  }
  const integrityHash = envelope.integrityHash;
  delete envelope.integrityHash;
  if (integrityHash !== sha256HexUtf8(JSON.stringify(envelope))) {
    throw new Error('checkpoint storage integrity mismatch');
  }
  return _validateSimulationCheckpointIntegrity(envelope.checkpoint);
}

// Crash-safe, two-generation local persistence.  A new envelope is written to
// staging first, the prior valid primary is copied to backup, and primary is
// replaced last.  Recovery considers all three slots, so interruption at any
// individual localStorage write still leaves at least one validated generation.
function persistSimulationCheckpoint(checkpoint: any, storage: any = globalThis.localStorage): any {
  if (!storage?.getItem || !storage?.setItem) throw new Error('checkpoint storage unavailable');
  const encoded = _encodeSimulationCheckpointEnvelope(checkpoint);
  storage.setItem(SIMULATION_CHECKPOINT_STORAGE_KEYS.staging, encoded);
  const prior = storage.getItem(SIMULATION_CHECKPOINT_STORAGE_KEYS.primary);
  if (prior) {
    try {
      _decodeSimulationCheckpointEnvelope(prior);
      storage.setItem(SIMULATION_CHECKPOINT_STORAGE_KEYS.backup, prior);
    } catch (_e) { /* never replace a known-good backup with corrupt primary */ }
  }
  storage.setItem(SIMULATION_CHECKPOINT_STORAGE_KEYS.primary, encoded);
  if (storage.removeItem) storage.removeItem(SIMULATION_CHECKPOINT_STORAGE_KEYS.staging);
  return _simulationDeepFreeze({
    key: SIMULATION_CHECKPOINT_STORAGE_KEYS.primary,
    checkpoint: _simulationJsonClone(checkpoint),
  });
}

function recoverPersistedSimulationRuntime(storage: any = globalThis.localStorage): any {
  if (!storage?.getItem) return { runtime: null, checkpoint: null, source: null, errors: ['checkpoint storage unavailable'] };
  const errors: string[] = [];
  for (const source of ['primary', 'staging', 'backup']) {
    const key = (SIMULATION_CHECKPOINT_STORAGE_KEYS as any)[source];
    const encoded = storage.getItem(key);
    if (!encoded) continue;
    try {
      const checkpoint = _decodeSimulationCheckpointEnvelope(encoded);
      const runtime = restoreSimulationCommandRuntime(checkpoint);
      return { runtime, checkpoint, source, errors };
    } catch (error: any) {
      errors.push(`${source}: ${error?.message || String(error)}`);
    }
  }
  return { runtime: null, checkpoint: null, source: null, errors };
}

async function runSimulationProgressively(
  runtime: any,
  steps: number,
  opts: any = {},
): Promise<any> {
  const total = Math.max(0, Math.trunc(Number(steps) || 0));
  const chunkSteps = Math.max(1, Math.trunc(Number(opts.chunkSteps) || 4));
  const yieldFn = typeof opts.yieldFn === 'function'
    ? opts.yieldFn : () => new Promise<void>(resolve => setTimeout(resolve, 0));
  let completed = 0;
  while (completed < total) {
    if (opts.signal?.aborted || runtime.status === 'cancelled') {
      if (runtime.status !== 'cancelled') applySimulationCommand(
        runtime, makeSimulationCancelCommand(opts.signal?.reason || 'aborted'),
      );
      break;
    }
    const count = Math.min(chunkSteps, total - completed);
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(count));
    completed += count;
    if (typeof opts.onProgress === 'function') {
      opts.onProgress(_simulationJsonClone({
        completed, total, step: runtime.sim.step,
        checkpoint: createSimulationCheckpoint(runtime),
      }));
    }
    if (completed < total) await yieldFn();
  }
  return {
    status: runtime.status,
    completed,
    total,
    checkpoint: createSimulationCheckpoint(runtime),
  };
}

// One-message/one-chunk worker reducer. The closure returned below is a real
// worker endpoint when wired to self.postMessage, and is directly testable in
// jsdom without starting background processes.
function createSimulationWorkerEndpoint(send: (message: any) => void): (message: any) => Promise<void> {
  let runtime: any = null;
  return async (message: any) => {
    if (message?.schema !== SIMULATION_WORKER_MESSAGE_SCHEMA) {
      send({ schema: SIMULATION_WORKER_MESSAGE_SCHEMA, ok: false, error: 'invalid_worker_message_schema' });
      return;
    }
    try {
      const command = message.command;
      if (command?.type === 'start') runtime = startSimulationCommandRuntime(command);
      else if (message.checkpoint && !runtime) runtime = restoreSimulationCommandRuntime(message.checkpoint);
      if (!runtime) throw new Error('worker runtime not started');
      let result: any;
      if (command.type === 'advance') {
        const chunk = Math.min(command.steps, Math.max(1, Math.trunc(message.maxChunkSteps || 4)));
        result = applySimulationCommand(runtime, makeSimulationAdvanceCommand(chunk));
        result.remainingSteps = command.steps - chunk;
      } else if (command.type !== 'start') result = applySimulationCommand(runtime, command);
      else result = { status: runtime.status, step: runtime.sim.step };
      send({
        schema: SIMULATION_WORKER_MESSAGE_SCHEMA,
        requestId: message.requestId ?? null,
        ok: true,
        result: _simulationJsonClone(result),
        checkpoint: createSimulationCheckpoint(runtime),
      });
    } catch (error: any) {
      send({
        schema: SIMULATION_WORKER_MESSAGE_SCHEMA,
        requestId: message.requestId ?? null,
        ok: false,
        error: error?.message || String(error),
      });
    }
  };
}
