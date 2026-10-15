/** Cooperative lease only. Admission, child adoption, and termination are separate. */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { captureProcessSnapshot } from './process-census-lib.mjs';

export const LEASE_SCHEMA = 'vugg-test-lease-v1';
export const ACQUIRE_ATTEMPTS = 8;
export const MAX_GENERATIONS = 10000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LABEL = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const claimName = n => `claim-${String(n).padStart(8, '0')}.json`;
const closeName = n => `close-${String(n).padStart(8, '0')}.json`;
const fail = () => { throw new Error('invalid-lease-journal'); };

// ProgramData is shared by checkouts/accounts, unlike TEMP or LOCALAPPDATA.
// A denied/missing configuration never falls back to a private per-user lease.
export function defaultLeaseRoot({ platform = process.platform, env = process.env } = {}) {
  const base = env.ProgramData;
  if (platform !== 'win32' || typeof base !== 'string' || !/^[a-zA-Z]:[\\/]/.test(base)
      || /[\x00-\x1f]/.test(base)) return null;
  return path.win32.join(base, 'VuggSimulator', 'test-lease-v1');
}

function validTime(value, precision) {
  if (typeof value !== 'string' || !new RegExp(`^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{${precision}}Z$`).test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19);
}
const validIdentity = p => p && Number.isSafeInteger(p.pid) && p.pid > 0 && validTime(p.started_at, 7);
const sameIdentity = (a, b) => a.pid === b.pid && a.started_at === b.started_at;
const result = (status, reason, lease = null, extra = {}) => ({
  schema: LEASE_SCHEMA, scope: 'cooperating-vugg-test-runners', host_cleanliness: 'not-certified',
  full_suite_pass: false, status, exit_code: status === 'busy' ? 1 : ['unknown', 'not-owner'].includes(status) ? 2 : 0,
  reason, lease, ...extra,
});

function validClaim(c, n) {
  return c?.schema === LEASE_SCHEMA && c.kind === 'claim' && c.generation === n
    && typeof c.token === 'string' && UUID.test(c.token)
    && (n === 1 ? c.previous_token === null : typeof c.previous_token === 'string' && UUID.test(c.previous_token))
    && validIdentity(c.owner) && validTime(c.created_at, 3)
    && Date.parse(c.owner.started_at) <= Date.parse(c.created_at)
    && typeof c.run_id === 'string' && LABEL.test(c.run_id) && typeof c.checkout === 'string' && path.isAbsolute(c.checkout)
    && c.checkout.length <= 4096 && !/[\x00-\x1f]/.test(c.checkout);
}

function validClose(end, claim) {
  if (end?.schema !== LEASE_SCHEMA || end.kind !== 'close' || end.generation !== claim.generation
      || end.token !== claim.token || !validTime(end.observed_at, 3)
      || Date.parse(end.observed_at) < Date.parse(claim.created_at)) return false;
  if (end.reason === 'released') return validIdentity(end.actor) && sameIdentity(end.actor, claim.owner);
  if (end.reason === 'owner-absent') return end.observed_owner === null;
  return end.reason === 'pid-reused' && validIdentity(end.observed_owner)
    && end.observed_owner.pid === claim.owner.pid && !sameIdentity(end.observed_owner, claim.owner);
}

/**
 * Immutable numbered claims + token-bound terminal records. No shared pathname
 * is ever removed or replaced. A stale releaser/reclaimer can only close its
 * original generation; it cannot expose, park, or erase a successor's claim.
 *
 * Publish a fully written, fsynced file with a same-volume hard link (EEXIST
 * elects one winner). Never substitute rename, overwrite, or copyFile here.
 * Interrupted staging files have no authority. No heartbeat grants expiry.
 * Requires a shared, trusted local filesystem with hard-link support; this is
 * coordination between cooperative clients, not protection against tampering.
 */
export function createMachineLease({
  root = defaultLeaseRoot(), platform = process.platform, selfPid = process.pid,
  capture = captureProcessSnapshot, now = Date.now, io = fs,
} = {}) {
  const supported = platform === 'win32' && typeof root === 'string' && path.isAbsolute(root);
  const file = name => path.join(root, name);

  function readJson(name, optional = false) {
    try {
      const stat = io.lstatSync(file(name));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) fail();
      return JSON.parse(io.readFileSync(file(name), 'utf8'));
    } catch (error) {
      if (optional && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  function readTip() {
    let names;
    try {
      const stat = io.lstatSync(root);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
      names = io.readdirSync(root);
    } catch (error) { if (error.code === 'ENOENT') return { claim: null, end: null }; throw error; }
    if (names.some(name => !/^(?:claim|close)-\d{8}\.json$/.test(name)
        && !/^pending-[0-9a-f-]{36}\.json$/.test(name))) fail();
    const claims = names.filter(name => name.startsWith('claim-')).sort();
    if (claims.length > MAX_GENERATIONS) fail();
    // Read every predecessor's terminal record before accepting a later claim.
    // Concurrent appends missed by this listing still collide at publication.
    let previous = null;
    let end = null;
    for (let i = 0; i < claims.length; i++) {
      if (claims[i] !== claimName(i + 1)) fail();
      const current = readJson(claims[i]);
      if (!validClaim(current, i + 1) || (previous && (!end || current.previous_token !== previous.token))) fail();
      end = readJson(closeName(i + 1), true);
      if (end && !validClose(end, current)) fail();
      previous = current;
    }
    // A close seen without its claim is partial/corrupt, never a free slot.
    if (names.some(name => name.startsWith('close-') && (Number(name.slice(6, 14)) < 1
        || Number(name.slice(6, 14)) > claims.length))) fail();
    return { claim: previous, end };
  }

  function publish(name, value) {
    const pending = file(`pending-${randomUUID()}.json`);
    let fd;
    let created = false;
    try {
      fd = io.openSync(pending, 'wx', 0o600);
      created = true;
      io.writeFileSync(fd, `${JSON.stringify(value)}\n`, 'utf8');
      io.fsyncSync(fd);
      io.closeSync(fd); fd = undefined;
      try { io.linkSync(pending, file(name)); return true; }
      catch (error) { if (error.code === 'EEXIST') return false; throw error; }
    } finally {
      if (fd !== undefined) io.closeSync(fd);
      // Only this operation's unique staging path, never a committed claim.
      if (created) try { io.unlinkSync(pending); } catch { /* inert staging residue */ }
    }
  }

  async function observe() {
    const began = now();
    const snapshot = await capture();
    const finished = now();
    if (snapshot?.status !== 'available' || !Array.isArray(snapshot.processes)
        || !validTime(snapshot.observed_at, 3) || Date.parse(snapshot.observed_at) < began
        || Date.parse(snapshot.observed_at) > finished) throw new Error('identity-unavailable');
    const ids = new Set();
    for (const row of snapshot.processes) {
      if (!Number.isSafeInteger(row?.pid) || row.pid < 0 || ids.has(row.pid)) throw new Error('identity-unavailable');
      ids.add(row.pid);
    }
    return snapshot;
  }

  function ownerState(claim, snapshot) {
    if (Date.parse(snapshot.observed_at) < Date.parse(claim.created_at)) return { status: 'unknown', reason: 'observation-predates-claim' };
    const row = snapshot.processes.find(p => p.pid === claim.owner.pid);
    if (!row) return { status: 'reclaimable', reason: 'owner-absent', observed_owner: null };
    if (!validIdentity(row) || Date.parse(row.started_at) > Date.parse(snapshot.observed_at)) {
      return { status: 'unknown', reason: 'owner-identity-unavailable' };
    }
    return sameIdentity(row, claim.owner) ? { status: 'busy', reason: 'owner-live' }
      : { status: 'reclaimable', reason: 'pid-reused', observed_owner: { pid: row.pid, started_at: row.started_at } };
  }

  function caller(snapshot) {
    const row = snapshot.processes.find(p => p.pid === selfPid);
    if (!validIdentity(row) || Date.parse(row.started_at) > Date.parse(snapshot.observed_at)) throw new Error('identity-unavailable');
    return { pid: row.pid, started_at: row.started_at };
  }

  async function inspect() {
    if (!supported) return result('unknown', 'unsupported-platform-or-shared-root');
    try {
      const { claim, end } = readTip();
      if (!claim || end) return result('available', 'no-open-cooperative-claim', claim);
      const state = ownerState(claim, await observe());
      return result(state.status, state.reason, claim);
    } catch { return result('unknown', 'journal-or-observation-unavailable'); }
  }

  async function acquire({ runId, checkout = process.cwd() } = {}) {
    if (!supported) return result('unknown', 'unsupported-platform-or-shared-root');
    if (typeof runId !== 'string' || !LABEL.test(runId) || typeof checkout !== 'string'
        || !path.isAbsolute(checkout) || checkout.length > 4096 || /[\x00-\x1f]/.test(checkout)) return result('unknown', 'invalid-run-description');
    try {
      io.mkdirSync(root, { recursive: true });
      for (let attempt = 0; attempt < ACQUIRE_ATTEMPTS; attempt++) {
        const { claim, end } = readTip();
        if (claim?.generation === MAX_GENERATIONS) return result('unknown', 'journal-capacity-reached', claim);
        // Fresh observation AFTER reading the immutable claim. A cached census
        // supplied before acquisition must not pronounce a new owner absent.
        const snapshot = await observe();
        const owner = caller(snapshot);
        if (claim && !end) {
          const state = ownerState(claim, snapshot);
          if (state.status !== 'reclaimable') return result(state.status, state.reason, claim);
          publish(closeName(claim.generation), { schema: LEASE_SCHEMA, kind: 'close',
            generation: claim.generation, token: claim.token, reason: state.reason,
            observed_at: snapshot.observed_at, observed_owner: state.observed_owner });
          // Re-read and validate the winner of concurrent closure attempts.
          if (!validClose(readJson(closeName(claim.generation)), claim)) fail();
        }
        const next = { schema: LEASE_SCHEMA, kind: 'claim', generation: (claim?.generation ?? 0) + 1,
          token: randomUUID(), previous_token: claim?.token ?? null, owner,
          created_at: new Date(now()).toISOString(), run_id: runId, checkout };
        if (!validClaim(next, next.generation)) fail();
        if (publish(claimName(next.generation), next)) return result('acquired', 'exclusive-cooperative-claim', next,
          { handle: { generation: next.generation, token: next.token } });
      }
      return result('unknown', 'contention-retry-limit');
    } catch { return result('unknown', 'journal-or-observation-unavailable'); }
  }

  async function release(handle) {
    if (!supported) return result('unknown', 'unsupported-platform-or-shared-root');
    if (!Number.isSafeInteger(handle?.generation) || handle.generation < 1 || handle.generation > MAX_GENERATIONS
        || typeof handle?.token !== 'string' || !UUID.test(handle.token)) return result('not-owner', 'invalid-handle');
    try {
      // Validate the journal, then operate ONLY on this handle's generation.
      readTip();
      const claim = readJson(claimName(handle.generation));
      if (!validClaim(claim, handle.generation) || claim.token !== handle.token) return result('not-owner', 'token-mismatch');
      const end = readJson(closeName(handle.generation), true);
      if (end) {
        if (!validClose(end, claim)) fail();
        return result('already-closed', 'generation-already-closed', claim);
      }
      const snapshot = await observe();
      const actor = caller(snapshot);
      if (!sameIdentity(actor, claim.owner)) return result('not-owner', 'caller-identity-mismatch', claim);
      const closing = { schema: LEASE_SCHEMA, kind: 'close', generation: claim.generation, token: claim.token,
        reason: 'released', observed_at: snapshot.observed_at, actor };
      if (!validClose(closing, claim)) fail();
      const won = publish(closeName(claim.generation), closing);
      if (!validClose(readJson(closeName(claim.generation)), claim)) fail();
      return result(won ? 'released' : 'already-closed', 'generation-closed', claim);
    } catch { return result('unknown', 'journal-or-observation-unavailable'); }
  }

  return { inspect, acquire, release };
}

export async function runTestLeaseStatus({ argv = process.argv.slice(2), lease = createMachineLease(), log = console.log, error = console.error } = {}) {
  const usage = 'node tools/test-lease.mjs [--status] [--json]';
  if (argv.length === 1 && argv[0] === '--help') { log(usage); return 0; }
  if (argv.some(arg => arg !== '--status' && arg !== '--json') || new Set(argv).size !== argv.length) { error(usage); return 2; }
  let report;
  try { report = await lease.inspect(); }
  catch { report = result('unknown', 'journal-or-observation-unavailable'); }
  log(argv.includes('--json') ? JSON.stringify(report, null, 2)
    : `[test-lease] ${report.status}: ${report.reason}. Read-only observation, not admission or a host-cleanliness certificate.`);
  return report.exit_code;
}
