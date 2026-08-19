// tests-js/hash-policy-callers.test.ts — does every CONSUMER route through the policy?
//
// tests-js/hash-policy.test.ts establishes the primitive: LF and CRLF twins hash
// alike, binary is exempt, an absent declaration means raw. It proves nothing
// about whether anyone calls it. That gap was not hypothetical — after the
// policy landed with "one authority", a repository-wide census still found three
// live raw-working-tree hashes on the receipt chain:
//
//   tools/review-claim-card.mjs          strip_sha256 on every claim card
//   tools/gen-science-provenance-manifest.mjs   strips, locality receipts,
//                                        the aggregate receipt, the pressure verifier
//   tools/locality-envelope-audit.mjs    the frequency baseline and every strip
//
// None is a diagnostic. Claim cards and the manifest are BAKE OUTPUTS, and the
// locality audit is a canonical verifier. So these tests are about callers, and
// each one says plainly what it can and cannot prove.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cardStripDigest, stripBytesForCard } from '../tools/review-claim-card.mjs';
import { auditFleet } from '../tools/locality-envelope-audit.mjs';
import { CURRENT_HASH_POLICY, HASH_POLICY_RAW, sha256File } from '../tools/hash-policy.mjs';
import { LOCALITY_FREQUENCY_SEEDS } from '../tools/locality-frequency-contract.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planted: string[] = [];
const tempRoot = (tag: string) => {
  const made = fs.mkdtempSync(path.join(os.tmpdir(), `vugg-callers-${tag}-`));
  planted.push(made);
  return made;
};
const eolise = (text: string, eol: string) => text.split('\n').join(eol);

afterEach(() => {
  while (planted.length) fs.rmSync(planted.pop()!, { recursive: true, force: true });
});

describe('claim cards — strip_sha256 is a function of content', () => {
  const STRIP = '{\n  "scenario": "x",\n  "seed": 42,\n  "steps": 200\n}\n';

  const plantStrip = (eol: string) => {
    const root = tempRoot(eol === '\n' ? 'lf' : 'crlf');
    const file = path.join(root, 'strip.json');
    fs.writeFileSync(file, eolise(STRIP, eol));
    return file;
  };

  it('digests a CRLF strip and an LF strip identically', () => {
    const lf = plantStrip('\n');
    const crlf = plantStrip('\r\n');
    expect(fs.readFileSync(lf)).not.toEqual(fs.readFileSync(crlf));
    expect(cardStripDigest(crlf)).toBe(cardStripDigest(lf));
    // And the bytes the card is BUILT from are the same bytes it pins, so the
    // card body and its digest cannot come from different readings of the file.
    expect(stripBytesForCard(crlf)).toEqual(stripBytesForCard(lf));
  });

  it('still separates strips whose content genuinely differs', () => {
    // The negative control. Without it, a digest that ignored the file entirely
    // would satisfy the test above.
    const root = tempRoot('control');
    const a = path.join(root, 'a.json');
    const b = path.join(root, 'b.json');
    fs.writeFileSync(a, STRIP);
    fs.writeFileSync(b, STRIP.replace('200', '201'));
    expect(cardStripDigest(a)).not.toBe(cardStripDigest(b));
  });

  it('honours the historical raw rule when asked for it', () => {
    const lf = plantStrip('\n');
    const crlf = plantStrip('\r\n');
    expect(cardStripDigest(crlf, HASH_POLICY_RAW)).not.toBe(cardStripDigest(lf, HASH_POLICY_RAW));
  });
});

describe('locality-envelope audit — verifies under the declared rule', () => {
  // A real integration: auditFleet takes a `root`, so the whole verifier runs
  // against a planted tree. The fixture is deliberately minimal, so the audit
  // reports other errors too; the assertions are on the ONE error this path
  // owns, which keeps the test about hashing rather than about fixture fidelity.
  const STRIP_BODY = '{\n  "scenario": "demo",\n  "seed": 42\n}\n';
  const STRIP_ERROR = 'archived strip bytes differ from pinned SHA-256';

  const plantFleet = (eol: string, { policy = CURRENT_HASH_POLICY, corruptStrip = false } = {}) => {
    const root = tempRoot(eol === '\n' ? 'fleet-lf' : 'fleet-crlf');
    const version = 99;
    fs.mkdirSync(path.join(root, 'archive', 'strips', `v${version}`), { recursive: true });
    fs.mkdirSync(path.join(root, 'archive', 'claim-cards', `v${version}`), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests-js', 'baselines'), { recursive: true });
    fs.mkdirSync(path.join(root, 'data', 'generated'), { recursive: true });

    const stripPath = path.join(root, 'archive', 'strips', `v${version}`, 'demo.json');
    fs.writeFileSync(stripPath, eolise(STRIP_BODY, eol));

    const frequencyPath = path.join(root, 'tests-js', 'baselines', `locality_frequency_v${version}.json`);
    fs.writeFileSync(frequencyPath, eolise(JSON.stringify({
      schema: 'vugg-locality-frequency-baseline-v1', sim_version: version,
      model_digest: 'demo-model', seeds: [...LOCALITY_FREQUENCY_SEEDS],
      scenarios: { demo: { locality_frequency_spec_hash: 'spec' } },
    }, null, 2) + '\n', eol));

    // The pinned numbers are computed under `policy`, exactly as the real
    // producers would have computed them — and BEFORE any corruption, so the
    // negative control pins the honest strip and then finds a different one on
    // disk. Corrupting first would have made the card vouch for the corruption,
    // which is how that control came to report zero errors on its first run.
    const stripSha = sha256File(stripPath, policy);
    if (corruptStrip) fs.writeFileSync(stripPath, eolise(STRIP_BODY.replace('42', '43'), eol));
    fs.writeFileSync(path.join(root, 'archive', 'claim-cards', `v${version}`, 'demo.json'),
      eolise(JSON.stringify({
        schema: 'vugg-claim-card-v3', hash_policy: policy, scenario: 'demo',
        sim_version: version, model_digest: 'demo-model',
        scenario_spec_hash: 'spec', strip_sha256: stripSha,
      }, null, 2) + '\n', eol));

    fs.writeFileSync(path.join(root, 'data', 'generated', 'science-provenance-manifest.json'),
      eolise(JSON.stringify({
        schema: 'vugg-science-provenance-manifest-v6', hash_policy: policy,
        sim_version: version, model_digest: 'demo-model',
        locality_frequency: {
          path: path.relative(root, frequencyPath).replaceAll('\\', '/'),
          sha256: sha256File(frequencyPath, policy),
        },
        scenarios: [{
          id: 'demo', scenario_spec_hash: 'spec', locality_frequency_spec_hash: 'spec',
          archive: { sim_version: version, model_digest: 'demo-model', strip_sha256: stripSha },
        }],
      }, null, 2) + '\n', eol));
    return { root, version };
  };

  const stripErrors = (fleet: { root: string; version: number }) =>
    auditFleet({ root: fleet.root, version: fleet.version })
      .results.flatMap((r: any) => r.errors)
      .filter((e: string) => e.includes(STRIP_ERROR));

  it('accepts a CRLF checkout and an LF checkout alike', () => {
    const lf = plantFleet('\n');
    const crlf = plantFleet('\r\n');
    // Guard the fixture: identical bytes would make this vacuous.
    expect(fs.readFileSync(path.join(crlf.root, 'archive', 'strips', 'v99', 'demo.json')))
      .not.toEqual(fs.readFileSync(path.join(lf.root, 'archive', 'strips', 'v99', 'demo.json')));
    expect(stripErrors(lf)).toEqual([]);
    expect(stripErrors(crlf)).toEqual([]);
  });

  it('still catches a strip whose bytes really did change', () => {
    // Negative control: an audit that never reports this error would pass the
    // test above while verifying nothing at all.
    expect(stripErrors(plantFleet('\r\n', { corruptStrip: true })).length).toBe(1);
  });

  it('reads a historical raw-policy fleet under RAW, not under the current rule', () => {
    // The declaration is obeyed even when it is the older rule. Getting this
    // backwards would convict every archived card of drift it never had.
    expect(stripErrors(plantFleet('\r\n', { policy: HASH_POLICY_RAW }))).toEqual([]);
  });

  it('names a policy disagreement instead of reporting it as digest drift', () => {
    const fleet = plantFleet('\r\n');
    const cardPath = path.join(fleet.root, 'archive', 'claim-cards', 'v99', 'demo.json');
    const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
    card.hash_policy = HASH_POLICY_RAW;
    fs.writeFileSync(cardPath, JSON.stringify(card, null, 2) + '\n');
    const errors = auditFleet({ root: fleet.root, version: fleet.version })
      .results.flatMap((r: any) => r.errors);
    expect(errors.some((e: string) => e.includes('hash policy'))).toBe(true);
  });
});

describe('no raw working-tree hash survives on the receipt chain', () => {
  // The generalising guard, and the only instrument that covers
  // gen-science-provenance-manifest.mjs — that file has no
  // invoked-directly guard, so importing it would run the whole generator and
  // call process.exit. A source check is a weaker kind of evidence than an
  // execution check and is written here as exactly that: it proves no CALLER
  // takes the raw path, not that the policy is correct. hash-policy.mjs itself
  // is excluded, because being the one place that reads raw bytes is its job.
  const CHAIN = [
    'tools/evidence-runtime.mjs',
    'tools/scenario-evidence-checkpoint.mjs',
    'tools/science-evidence-receipt.mjs',
    'tools/gen-science-provenance-manifest.mjs',
    'tools/locality-envelope-audit.mjs',
    'tools/review-claim-card.mjs',
    'tools/release-audit.mjs',
    'tools/file-bundle-assets.mjs',
  ];

  // THE RULE, and why it is this one rather than a pattern for "read near hash":
  // the first draft looked for a bare read within 400 characters of a `sha256(raw)`
  // and MISSED a deliberately reintroduced raw read, because the read and the
  // hash sit ~1800 characters apart with a block of validation between them. The
  // 400 was a guess, and a guessed window is a guard that reports clean because
  // it did not look far enough.
  //
  // `fs.readFileSync(p)` with no encoding returns a Buffer; with `'utf8'` it
  // returns a string for parsing. Across these eight files there is no reason to
  // hold a Buffer except to hash it — measured, not assumed: every one of them
  // currently has zero. So the rule is simply "no bare Buffer reads here", which
  // needs no distance heuristic and cannot be outrun by refactoring.
  //
  // Paren-balanced, because `fs.readFileSync(path.join(a, b), 'utf8')` defeats a
  // naive `\([^)]*\)` — that mistake made an earlier count report four bare reads
  // that were all perfectly encoded.
  const readFileSyncArgs = (source: string) => {
    const out: string[] = [];
    const tag = 'fs.readFileSync(';
    let i = source.indexOf(tag);
    while (i >= 0) {
      let depth = 1;
      let p = i + tag.length;
      while (p < source.length && depth > 0) {
        const c = source[p];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        p++;
      }
      out.push(source.slice(i + tag.length, p - 1));
      i = source.indexOf(tag, p);
    }
    return out;
  };
  const bareBufferReads = (source: string) =>
    readFileSyncArgs(source).filter(args => !/['"]utf8['"]/.test(args));

  it.each(CHAIN)('%s takes no raw Buffer read', (relative) => {
    const source = fs.readFileSync(path.join(REPO, relative), 'utf8');
    expect(bareBufferReads(source), `${relative}: bare Buffer read(s) — hash via hash-policy.mjs`)
      .toEqual([]);
  });

  it('hash-policy.mjs is the one place that may read raw bytes', () => {
    // The exemption is asserted, not assumed. If this ever reached zero the rule
    // above would be vacuous, because nothing would be reading files at all.
    const source = fs.readFileSync(path.join(REPO, 'tools/hash-policy.mjs'), 'utf8');
    expect(bareBufferReads(source).length).toBeGreaterThan(0);
  });

  it('the detector fires on the exact code that slipped past its predecessor', () => {
    // Regression pin for the miss described above: a bare read whose hash is far
    // away, and the two inline forms.
    const farApart = `raw = fs.readFileSync(receiptPath);${'\n// filler'.repeat(120)}\nsha256(raw);`;
    expect(bareBufferReads(farApart).length).toBe(1);
    expect(bareBufferReads("createHash('sha256').update(fs.readFileSync(p))").length).toBe(1);
    expect(bareBufferReads('sha256(fs.readFileSync(pressureVerifierPath))').length).toBe(1);
    // ...and stays quiet on the encoded forms, including the nested-call shape.
    expect(bareBufferReads("fs.readFileSync(path.join(a, b), 'utf8')")).toEqual([]);
  });
});

describe('the committed artifacts declare their rule', () => {
  it('the science-provenance manifest names a policy', () => {
    // gen-science-provenance-manifest.mjs cannot be imported, so this checks the
    // artifact it produced rather than the code that produced it.
    const manifest = JSON.parse(fs.readFileSync(
      path.join(REPO, 'data', 'generated', 'science-provenance-manifest.json'), 'utf8'));
    expect(manifest.hash_policy).toBe(CURRENT_HASH_POLICY);
  });

  it('every current claim card names the same policy as the manifest', () => {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(REPO, 'data', 'generated', 'science-provenance-manifest.json'), 'utf8'));
    const dir = path.join(REPO, 'archive', 'claim-cards', `v${manifest.sim_version}`);
    const cards = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
    expect(cards.length).toBeGreaterThan(0);
    for (const name of cards) {
      const card = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      expect(card.hash_policy, `${name} hash_policy`).toBe(manifest.hash_policy);
    }
  });
});
