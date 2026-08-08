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

function _simulationCrystalProjection(crystal: any): any {
  return {
    id: crystal.crystal_id,
    mineral: crystal.mineral,
    active: !!crystal.active,
    dissolved: !!crystal.dissolved,
    totalGrowthUm: Number(crystal.total_growth_um) || 0,
    cLengthMm: Number(crystal.c_length_mm) || 0,
    aWidthMm: Number(crystal.a_width_mm) || 0,
    habit: crystal.habit || null,
    zones: (crystal.zones || []).map((zone: any) => ({
      thicknessUm: Number(zone.thickness_um) || 0,
      growthRate: Number(zone.growth_rate) || 0,
      note: zone.note || null,
      traceMn: Number(zone.trace_Mn) || 0,
      mgContent: Number(zone.mg_content) || 0,
    })),
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
  return {
    simVersion: SIM_VERSION,
    modelDigest: MODEL_DIGEST,
    scenarioId: runtime?.origin?.scenarioId || sim?.conditions?._scenario?.id || null,
    seed: runtime?.origin?.seed ?? null,
    step: Number(sim?.step) || 0,
    rngState: rngState >>> 0,
    temperatureC: Number(sim?.conditions?.temperature) || 0,
    pressureKbar: Number(sim?.conditions?.pressure) || 0,
    flowRate: Number(sim?.conditions?.flow_rate) || 0,
    fluid: _simulationFluidProjection(sim?.conditions?.fluid),
    ringTemperatures: (sim?.ring_temperatures || []).map((v: any) => Number(v) || 0),
    ringFluids: (sim?.ring_fluids || []).map(_simulationFluidProjection),
    wallCellRadii: (sim?.wall_state?.cells || []).map((cell: any) => Number(cell.radius_mm) || 0),
    crystals: (sim?.crystals || []).map(_simulationCrystalProjection),
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
