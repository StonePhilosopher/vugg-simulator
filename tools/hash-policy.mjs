/**
 * tools/hash-policy.mjs — the single authority on what bytes a receipt describes.
 *
 * Every evidence hash in this repository used to read `fs.readFileSync(file)`
 * and hash whatever was on disk. That is not a property of the commit. There is
 * no `.gitattributes` here, so with `core.autocrlf=true` git stores LF and
 * writes CRLF only to the files a checkout actually MATERIALISES — and
 * materialising files that were not there before is precisely what a merge
 * does. The working tree is not uniform and never was: on the tree that
 * produced this module, 3 of 94 narratives carried CRLF and 91 did not, the
 * freshly merged `archive/.../v271/*` came out CRLF while `v267/*` sat there
 * from before as LF, and `audit:science` duly rejected an artifact of Codex's
 * whose receipt recorded the committed bytes.
 *
 * So the policy is VERSIONED rather than silently changed. A receipt now says
 * which rule produced it, historical receipts keep the rule they were baked
 * under, and a verifier applies the receipt's own policy instead of assuming
 * today's. Fossilising a second generation of receipts under an unstated rule
 * is the failure this module exists to prevent.
 *
 *   HASH_POLICY_RAW  the historical, never-declared rule: hash bytes as found.
 *                    Receipts with no `hash_policy` field were baked under it.
 *   HASH_POLICY_LF   the explicit rule: text is LF-normalised before it is
 *                    hashed OR counted; binary is passed through untouched.
 *
 * BINARY IS NOT NEGOTIABLE. `tools/release-audit.mjs` receipts `.mp3` assets
 * through the same path as `data/*.json`, and normalising an audio file would
 * corrupt the very identity the receipt exists to pin. Detection uses git's own
 * heuristic — a NUL byte inside the first 8000 — because agreeing with the tool
 * that decides the on-disk line endings is the only self-consistent choice.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

/** Hash bytes exactly as they sit on disk. What every receipt before 2026-08-18 used. */
export const HASH_POLICY_RAW = 'vugg-hash-policy-raw-bytes-v0';

/** LF-normalise text before hashing or counting; leave binary alone. */
export const HASH_POLICY_LF = 'vugg-hash-policy-lf-normalised-v1';

/** What a bake performed today declares. */
export const CURRENT_HASH_POLICY = HASH_POLICY_LF;

export const HASH_POLICIES = Object.freeze([HASH_POLICY_RAW, HASH_POLICY_LF]);

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const BINARY_SNIFF_BYTES = 8000;

/**
 * A receipt that does not name its policy was baked before policies existed, so
 * it means raw. Absence is answered with the historical rule, never with the
 * current one — reading an old receipt under a new rule would silently convict
 * it of drift it never had.
 */
export function policyOfReceipt(receipt) {
  const declared = receipt?.hash_policy;
  if (!declared) return HASH_POLICY_RAW;
  if (!HASH_POLICIES.includes(declared)) {
    throw new Error(`unknown hash policy in receipt: ${declared}`);
  }
  return declared;
}

/** git's heuristic: a NUL byte within the first 8000 means binary. */
export function looksBinary(bytes) {
  return bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}

/**
 * The bytes a given policy says this file consists of. Everything that hashes
 * or measures a file goes through here, so a digest and a byte count can never
 * disagree about which rule they followed.
 */
export function bytesForHash(file, policy = CURRENT_HASH_POLICY) {
  const raw = fs.readFileSync(file);
  if (policy === HASH_POLICY_RAW) return raw;
  if (policy !== HASH_POLICY_LF) throw new Error(`unknown hash policy: ${policy}`);
  if (looksBinary(raw)) return raw;
  const text = raw.toString('utf8');
  return text.includes(CR + LF) ? Buffer.from(text.split(CR + LF).join(LF), 'utf8') : raw;
}

export function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(file, policy = CURRENT_HASH_POLICY) {
  return sha256Bytes(bytesForHash(file, policy));
}

/**
 * The size a receipt should record. Kept beside the digest deliberately: a byte
 * COUNT that moves with the checkout is the same defect in a more legible
 * costume, and release-audit recorded one asset at 12 564 bytes on one tree and
 * 12 375 on another — a difference of 189, exactly its line count.
 */
export function byteLengthForHash(file, policy = CURRENT_HASH_POLICY) {
  return bytesForHash(file, policy).length;
}
