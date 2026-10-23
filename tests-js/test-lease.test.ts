import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACQUIRE_ATTEMPTS, createMachineLease, defaultLeaseRoot, runTestLeaseStatus,
} from '../tools/test-lease-lib.mjs';

const roots: string[] = [];
const scratch = () => { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-test-lease-')); roots.push(p); return p; };
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const stamp = '2026-10-15T02:00:00.000Z';
const start = '2026-10-15T01:00:00.1234567Z';
const identity = (pid: number, started_at = start) => ({ pid, started_at });
const claimFile = (root: string, n = 1) => path.join(root, `claim-${String(n).padStart(8, '0')}.json`);
const closeFile = (root: string, n = 1) => path.join(root, `close-${String(n).padStart(8, '0')}.json`);
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p: string, value: any) => fs.writeFileSync(p, JSON.stringify(value));
const request = { runId: 'fixture-run', checkout: process.cwd() };

function fixture(options: any = {}) {
  const root = path.join(scratch(), 'shared-lease');
  let rows: any[] = [identity(10), identity(20), identity(30)];
  let time = Date.parse(stamp);
  const capture = vi.fn(async () => ({ status: 'available', observed_at: new Date(time).toISOString(), processes: rows }));
  const client = (pid = 10, overrides: any = {}) => createMachineLease({ root, platform: 'win32', selfPid: pid,
    capture, now: () => time, ...options, ...overrides });
  return { root, capture, client, rows: (value: any[]) => { rows = value; }, advance: (ms: number) => { time += ms; } };
}

describe('shared lease location and contract', () => {
  it('uses one ProgramData namespace independent of checkout and user TEMP', () => {
    for (const TEMP of ['C:\\users\\one\\temp', 'D:\\other-user']) {
      expect(defaultLeaseRoot({ platform: 'win32', env: { ProgramData: 'C:\\ProgramData', TEMP } }))
        .toBe('C:\\ProgramData\\VuggSimulator\\test-lease-v1');
    }
  });
  it.each([{}, { ProgramData: 'relative' }, { ProgramData: '\\\\server\\share' }, { ProgramData: 'C:\\bad\npath' }])(
    'never falls back to a private namespace when ProgramData is invalid: %j', env => {
      expect(defaultLeaseRoot({ platform: 'win32', env })).toBeNull();
    },
  );
  it.each(['linux', 'darwin'])('fails closed on unsupported %s without observing or writing', async platform => {
    const f = fixture();
    const client = f.client(10, { platform });
    expect(defaultLeaseRoot({ platform, env: { ProgramData: 'C:\\ProgramData' } })).toBeNull();
    expect((await client.inspect()).exit_code).toBe(2);
    expect((await client.acquire(request)).exit_code).toBe(2);
    expect((await client.release({})).exit_code).toBe(2);
    expect(f.capture).not.toHaveBeenCalled();
    expect(fs.existsSync(f.root)).toBe(false);
  });
  it('status is read-only and an available slot is not a cleanliness or test verdict', async () => {
    const f = fixture();
    expect(await f.client().inspect()).toMatchObject({ status: 'available', exit_code: 0,
      host_cleanliness: 'not-certified', full_suite_pass: false });
    expect(fs.existsSync(f.root)).toBe(false);
    expect(f.capture).not.toHaveBeenCalled();
  });
  it('acquires across checkouts, rejects reentry, and releases only the exact generation', async () => {
    const f = fixture();
    const a = f.client(), b = f.client(20);
    const held = await a.acquire(request);
    expect(held).toMatchObject({ status: 'acquired', exit_code: 0, lease: { generation: 1, owner: identity(10) } });
    const original = fs.readFileSync(claimFile(f.root));
    expect((await a.acquire(request)).status).toBe('busy');
    expect(await b.acquire({ ...request, checkout: path.join(scratch(), 'other-checkout') })).toMatchObject({ status: 'busy', exit_code: 1 });
    expect((await a.release(held.handle)).status).toBe('released');
    expect(fs.readFileSync(claimFile(f.root))).toEqual(original);
    const next = await b.acquire(request);
    expect(next).toMatchObject({ status: 'acquired', lease: { generation: 2, previous_token: held.lease.token } });
    expect((await a.release(held.handle)).status).toBe('already-closed');
    expect((await a.inspect()).lease.token).toBe(next.lease.token);
    expect((await b.release(next.handle)).status).toBe('released');
  });
  it.each([{ runId: '' }, { runId: '../escape' }, { runId: 'line\nbreak' }, { runId: 'x', checkout: 'relative' }])(
    'rejects an invalid run description before mutation: %j', async description => {
      const f = fixture();
      expect((await f.client().acquire(description)).exit_code).toBe(2);
      expect(fs.existsSync(f.root)).toBe(false);
    },
  );
});

describe('exact process identity and conservative reclaim', () => {
  it('never expires a live owner, even after days without a heartbeat', async () => {
    const f = fixture();
    const held = await f.client().acquire(request);
    f.advance(7 * 86400000);
    expect(await f.client(20).acquire(request)).toMatchObject({ status: 'busy', reason: 'owner-live', lease: held.lease });
    expect(fs.existsSync(closeFile(f.root))).toBe(false);
  });
  it.each(['absent', 'recycled'])('reclaims only a proven ended lifetime (%s)', async kind => {
    const f = fixture();
    const first = await f.client().acquire(request);
    const rows = [identity(20)];
    if (kind === 'recycled') rows.push(identity(10, '2026-10-15T01:00:00.1234568Z'));
    f.rows(rows);
    expect((await f.client(20).inspect()).status).toBe('reclaimable');
    expect(fs.existsSync(closeFile(f.root))).toBe(false);
    const next = await f.client(20).acquire(request);
    expect(next).toMatchObject({ status: 'acquired', lease: { generation: 2 } });
    expect(read(closeFile(f.root))).toMatchObject({ token: first.handle.token,
      reason: kind === 'absent' ? 'owner-absent' : 'pid-reused' });
    expect(fs.readFileSync(claimFile(f.root), 'utf8')).toContain(first.handle.token);
  });
  it.each([null, '2026-10-15T01:00:00.123Z', 'not-a-time', '2026-10-16T01:00:00.1234567Z'])(
    'refuses to reclaim an unreadable/imprecise/future owner start: %j', async started_at => {
      const f = fixture(); await f.client().acquire(request);
      f.rows([{ pid: 10, started_at }, identity(20)]);
      expect((await f.client(20).acquire(request)).status).toBe('unknown');
      expect(fs.existsSync(closeFile(f.root))).toBe(false);
    },
  );
  it.each([
    null, { status: 'unavailable', reason: 'secret-command' },
    { status: 'available', observed_at: stamp, processes: null },
    { status: 'available', observed_at: stamp, processes: [identity(20), identity(20)] },
    { status: 'available', observed_at: stamp, processes: [identity(-1), identity(20)] },
    { status: 'available', observed_at: '2026-10-15T01:59:59.999Z', processes: [identity(20)] },
    { status: 'available', observed_at: '2026-10-15T02:00:00.001Z', processes: [identity(20)] },
  ])('rejects incomplete, stale, or future observations: %j', async snapshot => {
    const f = fixture(); await f.client().acquire(request);
    const report = await f.client(20, { capture: async () => snapshot }).acquire(request);
    expect(report).toMatchObject({ status: 'unknown', exit_code: 2 });
    expect(JSON.stringify(report)).not.toContain('secret-command');
    expect(fs.existsSync(closeFile(f.root))).toBe(false);
  });
  it('does not treat failed observation as an empty process list', async () => {
    const f = fixture(); await f.client().acquire(request);
    expect(await f.client(20, { capture: async () => { throw new Error('secret stdout'); } }).inspect())
      .toMatchObject({ status: 'unknown', exit_code: 2 });
  });
  it('rejects a cached snapshot even when its timestamp does not predate the claim', async () => {
    const f = fixture(); await f.client().acquire(request); f.advance(1000);
    const capture = async () => ({ status: 'available', observed_at: stamp, processes: [identity(20)] });
    expect((await f.client(20, { capture }).acquire(request)).status).toBe('unknown');
    expect(fs.existsSync(closeFile(f.root))).toBe(false);
  });
  it('requires a caller lifetime and never persists raw process metadata', async () => {
    const f = fixture(); f.rows([identity(20)]);
    expect((await f.client().acquire(request)).status).toBe('unknown');
    f.rows([{ ...identity(10), command: '--password=secret', extra: 'raw-data' }]);
    const held = await f.client().acquire(request);
    expect(held.status).toBe('acquired');
    expect(fs.readFileSync(claimFile(f.root), 'utf8')).not.toMatch(/secret|raw-data|command/);
  });
  it('rejects a wrong token, a different caller, and a recycled caller on release', async () => {
    const f = fixture(); const a = f.client(); const held = await a.acquire(request);
    expect((await a.release({ ...held.handle, token: '12345678-1234-4234-8234-123456789abc' })).status).toBe('not-owner');
    expect((await f.client(20).release(held.handle)).status).toBe('not-owner');
    f.rows([identity(10, '2026-10-15T01:00:00.1234568Z')]);
    expect((await a.release(held.handle)).status).toBe('not-owner');
    expect(fs.existsSync(closeFile(f.root))).toBe(false);
  });
  it.each([null, {}, { generation: -1, token: 'x' }, { generation: 1, token: '../elsewhere' }])(
    'refuses unsafe release handles %j', async handle => {
      const f = fixture(); expect((await f.client().release(handle)).status).toBe('not-owner');
      expect(fs.existsSync(f.root)).toBe(false);
    },
  );
});

describe('immutable publication, interruptions, and corruption', () => {
  it.each(['writeFileSync', 'fsyncSync', 'linkSync'])(
    'never exposes a partial claim when %s fails', async operation => {
      const f = fixture();
      const io = { ...fs, [operation]: () => { throw Object.assign(new Error('private detail'), { code: 'EACCES' }); } };
      const report = await f.client(10, { io }).acquire(request);
      expect(report).toMatchObject({ status: 'unknown', exit_code: 2 });
      expect(JSON.stringify(report)).not.toContain('private detail');
      expect(fs.existsSync(claimFile(f.root))).toBe(false);
      expect((await f.client(20).acquire(request)).status).toBe('acquired');
    },
  );
  it('treats post-publication interruption as a held lease until the owner ends', async () => {
    const f = fixture();
    const io = { ...fs, linkSync: (from: string, to: string) => { fs.linkSync(from, to); throw new Error('interrupted after commit'); } };
    expect((await f.client(10, { io }).acquire(request)).status).toBe('unknown');
    expect((await f.client(20).acquire(request)).status).toBe('busy');
    f.rows([identity(20)]);
    expect((await f.client(20).acquire(request)).status).toBe('acquired');
  });
  it('ignores abandoned private staging files without deleting them or using age', async () => {
    const f = fixture(); fs.mkdirSync(f.root);
    const p = path.join(f.root, 'pending-12345678-1234-4234-8234-123456789abc.json');
    fs.writeFileSync(p, '{');
    expect((await f.client().acquire(request)).status).toBe('acquired');
    expect(fs.readFileSync(p, 'utf8')).toBe('{');
  });
  it.each(['malformed', 'gap', 'wrong-token', 'wrong-predecessor', 'open-predecessor', 'foreign-entry', 'oversized'])(
    'fails closed on %s journal state instead of erasing it', async kind => {
      const f = fixture(); const a = f.client(); const held = await a.acquire(request);
      if (kind === 'malformed') fs.writeFileSync(claimFile(f.root), '{');
      if (kind === 'gap') fs.renameSync(claimFile(f.root), claimFile(f.root, 2));
      if (kind === 'wrong-token') write(closeFile(f.root), { schema: held.lease.schema, kind: 'close', generation: 1, token: 'wrong' });
      if (['wrong-predecessor', 'open-predecessor'].includes(kind)) {
        if (kind === 'wrong-predecessor') await a.release(held.handle);
        write(claimFile(f.root, 2), { ...held.lease, generation: 2,
          previous_token: kind === 'wrong-predecessor' ? '12345678-1234-4234-8234-123456789abc' : held.lease.token });
      }
      if (kind === 'foreign-entry') fs.writeFileSync(path.join(f.root, 'lease.json'), '{}');
      if (kind === 'oversized') fs.writeFileSync(claimFile(f.root), ' '.repeat(17000));
      const before = fs.readdirSync(f.root).map(name => [name, fs.readFileSync(path.join(f.root, name), 'utf8')]);
      expect((await f.client(20).acquire(request)).status).toBe('unknown');
      expect(fs.readdirSync(f.root).map(name => [name, fs.readFileSync(path.join(f.root, name), 'utf8')])).toEqual(before);
    },
  );
  it('leaves an open claim intact when release cannot be persisted', async () => {
    const f = fixture(); const held = await f.client().acquire(request);
    const io = { ...fs, linkSync: () => { throw new Error('write denied'); } };
    expect((await f.client(10, { io }).release(held.handle)).status).toBe('unknown');
    expect((await f.client(20).acquire(request)).status).toBe('busy');
  });
  it('rejects an otherwise valid completion record belonging to another token', async () => {
    const f = fixture(); const held = await f.client().acquire(request);
    await f.client().release(held.handle);
    write(closeFile(f.root), { ...read(closeFile(f.root)), token: '12345678-1234-4234-8234-123456789abc' });
    expect((await f.client(20).acquire(request)).status).toBe('unknown');
    expect(fs.existsSync(claimFile(f.root, 2))).toBe(false);
  });
  it('fails closed on denied shared storage instead of falling back to a private directory', async () => {
    const f = fixture();
    const io = { ...fs, mkdirSync: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
    expect((await f.client(10, { io }).acquire(request)).status).toBe('unknown');
    expect(f.capture).not.toHaveBeenCalled();
    expect(fs.existsSync(f.root)).toBe(false);
  });
  it('bounds contention retries without overwriting an existing publication', async () => {
    const f = fixture();
    const linkSync = vi.fn(() => { throw Object.assign(new Error('occupied'), { code: 'EEXIST' }); });
    expect(await f.client(10, { io: { ...fs, linkSync } }).acquire(request))
      .toMatchObject({ status: 'unknown', reason: 'contention-retry-limit' });
    expect(linkSync).toHaveBeenCalledTimes(ACQUIRE_ATTEMPTS);
  });
});

describe('racing clients never displace a successor', () => {
  it('elects one winner from simultaneous acquisitions', async () => {
    const f = fixture();
    const results = await Promise.all([10, 20, 30].map(pid => f.client(pid).acquire(request)));
    expect(results.filter(r => r.status === 'acquired')).toHaveLength(1);
    expect(results.filter(r => r.status === 'busy')).toHaveLength(2);
    expect(fs.readdirSync(f.root)).toEqual(['claim-00000001.json']);
  });
  it('a delayed reclaimer cannot close or move the next owner', async () => {
    const f = fixture(); await f.client().acquire(request);
    f.rows([identity(20), identity(30)]);
    let resume: () => void;
    let arrived: () => void;
    const paused = new Promise<void>(resolve => { arrived = resolve; });
    const gate = new Promise<void>(resolve => { resume = resolve; });
    let first = true;
    const slow = f.client(20, { capture: async () => { const snapshot = await f.capture();
      if (first) { first = false; arrived(); await gate; } return snapshot; } });
    const delayed = slow.acquire(request);
    await paused;
    const winner = await f.client(30).acquire(request);
    expect(winner.status).toBe('acquired');
    const winnerBytes = fs.readFileSync(claimFile(f.root, 2));
    resume();
    expect((await delayed).status).toBe('busy');
    expect(fs.readFileSync(claimFile(f.root, 2))).toEqual(winnerBytes);
    expect(fs.existsSync(closeFile(f.root, 2))).toBe(false);
  });
  it('a delayed release and repeated old handles never open a successor slot', async () => {
    const f = fixture(); const held = await f.client().acquire(request);
    let resume: () => void;
    let arrived: () => void;
    const paused = new Promise<void>(resolve => { arrived = resolve; });
    const gate = new Promise<void>(resolve => { resume = resolve; });
    const slow = f.client(10, { capture: async () => { const snapshot = await f.capture(); arrived(); await gate; return snapshot; } });
    const delayed = slow.release(held.handle); await paused;
    await f.client().release(held.handle);
    const winner = await f.client(20).acquire(request);
    const before = fs.readFileSync(claimFile(f.root, 2));
    resume();
    expect((await delayed).status).toBe('already-closed');
    expect((await f.client().release(held.handle)).status).toBe('already-closed');
    expect((await f.client(30).acquire(request)).status).toBe('busy');
    expect((await f.client().inspect()).lease.token).toBe(winner.handle.token);
    expect(fs.readFileSync(claimFile(f.root, 2))).toEqual(before);
    expect(fs.existsSync(closeFile(f.root, 2))).toBe(false);
  });
  it('arbitrates actual competing Node processes across separate checkout directories', async () => {
    const root = scratch(); const journal = path.join(root, 'journal');
    const moduleUrl = pathToFileURL(path.resolve('tools/test-lease-lib.mjs')).href;
    const source = `import { createMachineLease } from ${JSON.stringify(moduleUrl)};
      // Task-owned fixture; no children/ports; IPC stop and an 8s automatic expiry.
      const expiry = setTimeout(() => process.exit(2), 8000);
      let lease, handle;
      process.on('message', async msg => {
        if (msg.kind === 'go') {
          lease = createMachineLease({ root: msg.root, platform: 'win32', capture: async () => ({
            status: 'available', observed_at: new Date().toISOString(), processes: msg.rows }) });
          const result = await lease.acquire({ runId: 'process-fixture', checkout: process.cwd() });
          handle = result.handle; process.send({ status: result.status, pid: process.pid });
        } else if (msg.kind === 'stop') {
          if (handle) await lease.release(handle);
          clearTimeout(expiry); process.disconnect();
        }
      });
      process.send({ ready: true, pid: process.pid });`;
    const script = path.join(root, 'contender.mjs'); fs.writeFileSync(script, source);
    const message = (child: any) => new Promise<any>((resolve, reject) => {
      const finish = (error: Error | null, value?: any) => {
        clearTimeout(timer); child.off('message', received); child.off('error', failed); child.off('exit', ended);
        error ? reject(error) : resolve(value);
      };
      const received = (value: any) => finish(null, value);
      const failed = (error: Error) => finish(error);
      const ended = () => finish(new Error('fixture exited before replying'));
      const timer = setTimeout(() => finish(new Error('fixture message timeout')), 4000);
      child.once('message', received); child.once('error', failed); child.once('exit', ended);
    });
    const children: any[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const cwd = path.join(root, `checkout-${i}`); fs.mkdirSync(cwd);
        const child = spawn(process.execPath, [script], { cwd, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
        const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
        const ready = message(child);
        children.push({ child, exited, ready });
      }
      const ready: any[] = await Promise.all(children.map(c => c.ready));
      const fixtureStart = new Date(Date.now() - 60000).toISOString().replace('Z', '0000Z');
      const rows = ready.map(c => identity(c.pid, fixtureStart));
      const outcomes = children.map(({ child }) => message(child));
      for (const { child } of children) child.send({ kind: 'go', root: journal, rows });
      const results = await Promise.all(outcomes);
      expect(results.filter(r => r.status === 'acquired')).toHaveLength(1);
      expect(results.filter(r => r.status === 'busy')).toHaveLength(2);
      expect(read(claimFile(journal)).owner.pid).toBe(results.find(r => r.status === 'acquired').pid);
    } finally {
      for (const { child } of children) if (child.connected) child.send({ kind: 'stop' }, () => {});
      const exits = await Promise.all(children.map(c => c.exited));
      expect(exits).toEqual(children.map(() => ({ code: 0, signal: null })));
    }
    expect(fs.existsSync(closeFile(journal))).toBe(true);
  }, 15000);
});

describe('read-only status command', () => {
  it.each([['available', 0], ['busy', 1], ['unknown', 2], ['reclaimable', 0]])('preserves %s / %i', async (status, exit_code) => {
    const log = vi.fn(); const inspect = vi.fn(async () => ({ status, exit_code }));
    expect(await runTestLeaseStatus({ argv: ['--status', '--json'], lease: { inspect }, log })).toBe(exit_code);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ status, exit_code });
    expect(inspect).toHaveBeenCalledTimes(1);
  });
  it.each([['--help'], ['--release'], ['--allow-busy'], ['--json', '--json']])('does not inspect for %j', async (...argv) => {
    const inspect = vi.fn(); const log = vi.fn(); const error = vi.fn();
    expect(await runTestLeaseStatus({ argv, lease: { inspect }, log, error })).toBe(argv[0] === '--help' ? 0 : 2);
    expect(inspect).not.toHaveBeenCalled();
  });
  it('reports thrown inspection as unknown', async () => {
    expect(await runTestLeaseStatus({ argv: [], lease: { inspect: async () => { throw new Error('private'); } }, log: () => {} })).toBe(2);
  });
  it.each([0, 1, 2])('the executable awaits and preserves async exit %i', code => {
    const root = scratch();
    fs.copyFileSync(path.resolve('tools/test-lease.mjs'), path.join(root, 'test-lease.mjs'));
    fs.writeFileSync(path.join(root, 'test-lease-lib.mjs'), `export async function runTestLeaseStatus() { await Promise.resolve(); return ${code}; }`);
    const child = spawnSync(process.execPath, [path.join(root, 'test-lease.mjs')], { timeout: 5000, windowsHide: true, encoding: 'utf8' });
    expect(child.error).toBeUndefined(); expect(child.signal).toBeNull(); expect(child.status).toBe(code);
  });
});
