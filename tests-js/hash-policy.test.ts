// tests-js/hash-policy.test.ts — the rule that decides what a receipt describes.
//
// Every evidence hash in this repository used to read the bytes on disk, which
// made a receipt a statement about a CHECKOUT rather than about a commit. The
// repair was not "normalise everything" — it was to make the rule VERSIONED, so
// receipts baked before it stay legible under the rule they were baked with.
// These tests hold both halves of that: the new rule must be checkout-blind,
// and the old rule must still mean what it meant.
//
// Fixtures are planted in a temp directory rather than read from the tree. A
// test that hashed real repository files would only ever measure whichever line
// endings this machine happens to have — which is the same mistake, one level
// up, as the defect under test.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CURRENT_HASH_POLICY,
  HASH_POLICY_LF,
  HASH_POLICY_RAW,
  byteLengthForHash,
  bytesForHash,
  looksBinary,
  normalizeTextLf,
  policyOfReceipt,
  sha256File,
} from '../tools/hash-policy.mjs';

const planted: string[] = [];
const dir = () => {
  const made = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-hash-policy-'));
  planted.push(made);
  return made;
};
const write = (root: string, name: string, bytes: Buffer | string) => {
  const file = path.join(root, name);
  fs.writeFileSync(file, bytes);
  return file;
};

afterEach(() => {
  while (planted.length) fs.rmSync(planted.pop()!, { recursive: true, force: true });
});

describe('hash policy — the LF rule is blind to the checkout', () => {
  it('hashes CRLF and LF twins of the same text identically', () => {
    const root = dir();
    const lf = write(root, 'lf.json', '{\n  "a": 1\n}\n');
    const crlf = write(root, 'crlf.json', '{\r\n  "a": 1\r\n}\r\n');
    // Guard the fixture: equal bytes on disk would make the assertion vacuous.
    expect(fs.readFileSync(lf)).not.toEqual(fs.readFileSync(crlf));
    expect(sha256File(crlf, HASH_POLICY_LF)).toBe(sha256File(lf, HASH_POLICY_LF));
  });

  it('counts CRLF and LF twins as the same number of bytes', () => {
    // The count is not decoration. release-audit recorded one asset at 12 564
    // bytes on one checkout and 12 375 on another — a file with two sizes.
    const root = dir();
    const lf = write(root, 'lf.md', '# t\n\none\ntwo\n');
    const crlf = write(root, 'crlf.md', '# t\r\n\r\none\r\ntwo\r\n');
    expect(fs.statSync(crlf).size).toBeGreaterThan(fs.statSync(lf).size);
    expect(byteLengthForHash(crlf, HASH_POLICY_LF)).toBe(byteLengthForHash(lf, HASH_POLICY_LF));
  });

  it('leaves a file that is already LF untouched', () => {
    const root = dir();
    const lf = write(root, 'plain.md', 'one\ntwo\n');
    expect(bytesForHash(lf, HASH_POLICY_LF)).toEqual(fs.readFileSync(lf));
  });

  it('normalises CRLF and lone-CR text through the same builder authority', () => {
    const root = dir();
    const mixed = write(root, 'mixed.md', 'one\r\ntwo\rthree\n');
    expect(normalizeTextLf('one\r\ntwo\rthree\n')).toBe('one\ntwo\nthree\n');
    expect(bytesForHash(mixed, HASH_POLICY_LF).toString('utf8')).toBe('one\ntwo\nthree\n');
  });
});

describe('hash policy — binary is never normalised', () => {
  // release-audit receipts .mp3/.jpg/.png through the SAME function as
  // data/*.json. Normalising an audio file would corrupt the identity the
  // receipt exists to pin, and would do it silently.
  const audioish = () => Buffer.from([
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00,
    0x0d, 0x0a, 0x00, 0xff, 0xfb, 0x90, 0x0d, 0x0a, 0x00, 0x01,
  ]);

  it('recognises a NUL-bearing file as binary', () => {
    expect(looksBinary(audioish())).toBe(true);
    expect(looksBinary(Buffer.from('plain\r\ntext\r\n', 'utf8'))).toBe(false);
  });

  it('passes binary bytes through byte-for-byte even though they contain CRLF', () => {
    const root = dir();
    const blob = audioish();
    const file = write(root, 'clip.mp3', blob);
    // The fixture deliberately contains 0x0d 0x0a twice — a normaliser that
    // only checked for CRLF and not for binary would silently eat both.
    expect(bytesForHash(file, HASH_POLICY_LF)).toEqual(blob);
    expect(sha256File(file, HASH_POLICY_LF)).toBe(sha256File(file, HASH_POLICY_RAW));
  });
});

describe('hash policy — the historical rule still means what it meant', () => {
  it('raw policy keeps CRLF and LF twins distinct', () => {
    const root = dir();
    const lf = write(root, 'lf.json', '{\n}\n');
    const crlf = write(root, 'crlf.json', '{\r\n}\r\n');
    expect(sha256File(crlf, HASH_POLICY_RAW)).not.toBe(sha256File(lf, HASH_POLICY_RAW));
  });

  it('reads a receipt with no declared policy as the historical raw rule', () => {
    // Absence must resolve to the OLD rule. Answering it with today's would
    // convict every archived receipt of drift it never had.
    expect(policyOfReceipt({})).toBe(HASH_POLICY_RAW);
    expect(policyOfReceipt({ hash_policy: undefined })).toBe(HASH_POLICY_RAW);
    expect(policyOfReceipt({ hash_policy: HASH_POLICY_LF })).toBe(HASH_POLICY_LF);
  });

  it('refuses a policy it does not recognise instead of guessing one', () => {
    expect(() => policyOfReceipt({ hash_policy: 'vugg-hash-policy-from-the-future' }))
      .toThrow(/unknown hash policy/);
    const root = dir();
    const file = write(root, 'x.json', '{}\n');
    expect(() => bytesForHash(file, 'nonsense')).toThrow(/unknown hash policy/);
  });

  it('declares the LF rule as current, so a fresh bake is self-describing', () => {
    expect(CURRENT_HASH_POLICY).toBe(HASH_POLICY_LF);
  });
});
