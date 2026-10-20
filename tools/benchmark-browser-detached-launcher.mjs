// Internal child of benchmark-browser-cleanup-probe.mjs. It deliberately exits
// while Chrome survives, reproducing Windows launchers that detach the browser.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findOwnedBrowserExecutable } from './owned-browser-runtime.mjs';

const [profile, runId] = process.argv.slice(2);
if (!profile || path.dirname(profile) !== path.resolve(os.tmpdir())
    || !path.basename(profile).startsWith('vugg-cleanup-probe-')
    || JSON.parse(readFileSync(path.join(profile, 'probe-owner.json'), 'utf8')).runId !== runId) {
  throw new Error('Detached launcher requires its fresh probe-owned profile');
}
const child = spawn(findOwnedBrowserExecutable(), [
  '--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-component-update',
  '--disable-sync', '--no-sandbox', '--mute-audio', 'about:blank',
], { detached: true, stdio: 'ignore', windowsHide: true });
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('spawn', () => { console.log(JSON.stringify({ spawned_pid: child.pid })); child.unref(); });
