import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const makeSimulationStartCommand: (scenarioId: string, seed?: number, overrides?: any) => any;
declare const makeSimulationAdvanceCommand: (steps: number) => any;
declare const makeSimulationCancelCommand: (reason?: string) => any;
declare const makeSimulationResumeCommand: () => any;
declare const startSimulationCommandRuntime: (command: any) => any;
declare const applySimulationCommand: (runtime: any, command: any) => any;
declare const createSimulationCheckpoint: (runtime: any) => any;
declare const restoreSimulationCommandRuntime: (checkpoint: any) => any;
declare const persistSimulationCheckpoint: (checkpoint: any, storage?: any) => any;
declare const recoverPersistedSimulationRuntime: (storage?: any) => any;
declare const runSimulationProgressively: (runtime: any, steps: number, opts?: any) => Promise<any>;
declare const simulationStateFingerprint: (runtime: any) => string;
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

  it('persists crash-safely and recovers the prior generation when primary is corrupt', () => {
    localStorage.clear();
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('cooling', 42));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(3));
    persistSimulationCheckpoint(createSimulationCheckpoint(runtime));
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(2));
    persistSimulationCheckpoint(createSimulationCheckpoint(runtime));

    localStorage.setItem('vugg.simulation.checkpoint.v1.primary', '{not-json');
    const recovered = recoverPersistedSimulationRuntime();
    expect(recovered.source).toBe('backup');
    expect(recovered.errors[0]).toContain('primary');
    expect(recovered.runtime.sim.step).toBe(3);
    expect(simulationStateFingerprint(recovered.runtime)).not.toBe(
      simulationStateFingerprint(runtime),
    );
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
