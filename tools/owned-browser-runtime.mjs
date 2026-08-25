import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const OWNED_BROWSER_RUNTIME_SCHEMA = 'vugg-owned-devtools-browser-runtime-v2';

const DIGEST_CACHE = new Map();

export function browserExecutableCandidates({
  platform = process.platform,
  env = process.env,
} = {}) {
  const configured = env.VUGG_BROWSER_BIN ? [env.VUGG_BROWSER_BIN] : [];
  if (platform === 'win32') {
    return [
      ...configured,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
  }
  if (platform === 'darwin') {
    return [
      ...configured,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    ...configured,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

export function findOwnedBrowserExecutable(options = {}) {
  const browser = browserExecutableCandidates(options)
    .find(candidate => candidate && existsSync(candidate));
  if (!browser) {
    throw new Error(
      'No Chrome/Edge/Chromium executable found. Set VUGG_BROWSER_BIN to an installed browser.',
    );
  }
  return path.resolve(browser);
}

function executableSha256(file) {
  const stat = statSync(file);
  const cacheKey = `${file}|${stat.size}|${stat.mtimeMs}`;
  const cached = DIGEST_CACHE.get(cacheKey);
  if (cached) return cached;
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  DIGEST_CACHE.set(cacheKey, digest);
  return digest;
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

export function ownedBrowserExecutableIdentity(executable = findOwnedBrowserExecutable()) {
  const resolved = path.resolve(executable);
  if (!existsSync(resolved)) throw new Error(`owned browser executable is missing: ${resolved}`);
  return Object.freeze({
    executable_name: path.basename(resolved).toLowerCase(),
    executable_sha256: executableSha256(resolved),
  });
}

export function attestOwnedDevToolsBrowserRuntime({
  configuredExecutable,
  devToolsOwnerExecutable,
  browserProduct,
  protocolVersion,
}) {
  const configured = ownedBrowserExecutableIdentity(configuredExecutable);
  const owner = ownedBrowserExecutableIdentity(devToolsOwnerExecutable);
  if (JSON.stringify(configured) !== JSON.stringify(owner)) {
    throw new Error(
      `configured browser executable does not match the DevTools port owner (${configured.executable_name}/${configured.executable_sha256} != ${owner.executable_name}/${owner.executable_sha256})`,
    );
  }
  const receipt = Object.freeze({
    schema: OWNED_BROWSER_RUNTIME_SCHEMA,
    ...owner,
    devtools_browser_product: browserProduct,
    devtools_protocol_version: protocolVersion,
  });
  verifyOwnedDevToolsBrowserRuntime(receipt);
  return receipt;
}

// Published evidence is portable: offline verification validates the frozen
// owner receipt rather than requiring the review host to install the same
// browser binary. The live workflow separately reconstructs this receipt from
// the actual DevTools listening PID and refuses launcher/owner mismatches.
export function verifyOwnedDevToolsBrowserRuntime(receipt) {
  if (!exactKeys(receipt, [
    'schema', 'executable_name', 'executable_sha256',
    'devtools_browser_product', 'devtools_protocol_version',
  ])
      || receipt.schema !== OWNED_BROWSER_RUNTIME_SCHEMA
      || typeof receipt.executable_name !== 'string'
      || !/^(?:chrome|msedge|chromium)(?:\.exe)?$/.test(receipt.executable_name)
      || typeof receipt.executable_sha256 !== 'string'
      || !/^[0-9a-f]{64}$/.test(receipt.executable_sha256)
      || typeof receipt.devtools_browser_product !== 'string'
      || !/^(?:Chrome|HeadlessChrome|Microsoft Edge|Chromium)\/\d+\.\d+\.\d+\.\d+$/.test(
        receipt.devtools_browser_product,
      )
      || typeof receipt.devtools_protocol_version !== 'string'
      || !/^\d+\.\d+$/.test(receipt.devtools_protocol_version)) {
    throw new Error('owned DevTools browser runtime receipt is invalid');
  }
  return true;
}
