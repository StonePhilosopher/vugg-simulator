# FINDING — the evidence chain binds a checkout's line endings, not committed content

**Status:** measured; the build gate is fixed, the evidence gate is NOT. One decision is
open and it belongs to the boss, not to an integrator.
**Date:** 2026-08-18. Found while integrating Codex's `b62d85f` (SIM 271, sulfur valence
authority) onto canonical `main` at `420bf22`.

---

## 0. What is actually established

`tools/evidence-runtime.mjs` hashes **raw working-tree bytes**. This repository has **no
`.gitattributes`**, and this workstation runs `core.autocrlf=true`. So git stores every one
of these files with **LF** and writes **CRLF** only to the files a given checkout actually
materialises — leaving a working tree that is not uniform and never was:

```
narratives/            3 of 94 files carry CRLF, 91 do not
data/*.json            CRLF          (data/minerals.json: 19 096 CR bytes)
archive/.../v267/*     LF            — present before this checkout, never rewritten
archive/.../v271/*     CRLF          — freshly materialised BY the merge checkout
```

That last pair is the whole mechanism. **A merge's defining act is materialising files that
were not there before, and those are exactly the files that come out with the other line
ending.** A receipt baked here therefore binds a mixture, and the mixture is a property of
what git happened to write, not of the commit.

Observed directly, not inferred — `npm run audit:science` on the merged tree:

```
published science artifact hash mismatch: archive/claim-cards/v271/amethyst_geode.json
    recorded in v271.json     50ff534cfd611673dee9a471bd86342f3e0494d74a605dfa0e43e6e77dabdf0c
    on-disk raw sha256        36987563063091e4cffe18c5c0f6c541dd59f3c022b2bf692e49d1936acaf407
    on-disk LF-normalised     50ff534c…   <- matches
    git blob                  50ff534c…   <- matches
    CR bytes on disk          498
```

Codex's receipt records the committed content. This checkout handed the gate something else.

### A number I published and then had to withdraw

An earlier pass reported "canonical's v267 matches raw CRLF bytes 126 of 126; Codex's v271
matches LF-normalised 126 of 126, nothing in between", and read it as the two lines baking on
two platforms. **That was an artefact of my own script**, not a measurement. For a file already
stored with LF the raw and LF-normalised hashes are *the same hash*; the script tested raw
first with an `else if`, so every LF file was booked as a raw match and the normalised column
could only ever read zero. It looked like a clean platform split because a tautology cannot
disagree with itself.

`tools/evidence-lineending-census.mjs` exists because of that. It counts a file as evidence
**only if the file actually contains CRLF**, since no other file can tell the two hypotheses
apart, and it returns `UNKNOWN` rather than a verdict when none does. Under it, v267 reads
`UNKNOWN — no discriminating artifact`, which is the honest answer: canonical's bake agrees
with this disk because those files are LF here, and that proves nothing about how it was baked.

The defect survives the correction intact. Only my story about *who* was on which side did not.

---

## 1. What it cost this merge

`npm run build:check` is the **first gate of `npm run ci`**, and on the merged tree as received
it failed: rebuilding produced an `index.html` differing from Codex's committed one in **96 of
98 embedded assets — every one identical after CRLF → LF**. (That figure is a direct
string comparison of the two extracted asset maps, file by file, not the withdrawn script.)

Be precise about what that does and does not mean. It was always fixable *here*, by committing
a locally-rebuilt bundle; nothing was blocked. What could not be fixed that way is the tree
**staying** green. Codex's new `file://` bundle embeds the runtime inputs *into the committed
artifact*, so under the v1 digest every machine must rewrite `index.html` to go green, and every
rewrite moves `browser_bundle_sha256` in the receipts. One rewrite per handoff, each invalidating
the receipts the previous one earned. The normaliser is not what unblocked the merge; it is what
stops the merge from being undone by whoever touches it next.

---

## 2. What was fixed

`tools/file-bundle-assets.mjs` — one reader, `readFileBundleAsset()`, normalises CRLF → LF, and
both the embedded copy and the digest go through it. Schema bumped `v1` → `v2`, because the
digest's *definition* changed and a receipt should say so.

`build:check` is now idempotent: build, check, build again, check again — clean.

Pinned by `tests-js/file-url-bundle.test.ts`, which plants the same logical assets twice — once
LF, once CRLF — and demands one digest. It asserts the fixture differs first, so it cannot pass
by having accidentally written the same bytes both times. **Mutation-tested:** delete the
normalisation and three tests go red, including Codex's own bundle-identity test.

Testing this against the real tree would have proved nothing — it would only ever have measured
whichever line endings this machine happens to have. That is the same trap the withdrawn number
above fell into, one level up.

---

## 3. What was NOT fixed, and why

`tools/evidence-runtime.mjs` still hashes raw bytes. The receipts baked for this merge therefore
describe **this checkout's mixture**, and the next machine to materialise those files differently
will disagree with them again.

`tools/release-audit.mjs` is a **third site** with the same shape — `fileReceipt()` reads raw
bytes and records both `sha256` and `bytes`. Regenerating `release/content-pack-manifest.json`
on this tree moved one asset from `bytes: 12564` to `12375`: 189 bytes, which is exactly its
line count. A byte *length* that changes with the checkout is the same defect wearing a second
costume, and it is the more legible one — nobody expects a file to have two sizes.

Three reasons for stopping short, in order of weight:

1. **It changes what a receipt means.** Every archived receipt (v264 … v271) was baked under the
   old definition. That is the project's core discipline, and the call is the boss's.
2. **I could verify the rebake but not the consequences.** A full cold suite is 3 h 28 m; a change
   to evidence semantics deserves one, and it did not fit inside this integration.
3. **It is not this merge's defect.** The mechanism predates both branches. This merge is simply
   the first thing to stand where it is visible, because merging is what materialises new files.

---

## 4. The proposed fix

Exactly the pattern already proved on the bundle: normalise CRLF → LF in the one place
`evidence-runtime.mjs` turns a text artifact into bytes, then rebake. Receipts would then bind
**committed content** — the bytes that are in the repository, not the bytes a particular clone
happened to land.

Cheaper alternative, and strictly weaker: commit a `.gitattributes` with `* text=auto eol=lf`.
It makes fresh clones consistent but does nothing for a file a tool writes with the other ending,
so the hash stays a property of the working tree rather than of the commit. Prefer the
normaliser; the two are not exclusive.

Either way the rebake must run **after** the change, never before — the same sequencing note
`ebe41bd` left behind for producer digests.

---

## 5. What the merge proved on the way past

Worth recording, because it is the reassuring half and it was measured the same way:

- All **178 `js/` files** in the merged tree are byte-identical to Codex's. The engine came
  through untouched.
- Exactly **four files were changed by both sides** — the four conflicts. So no file anywhere in
  590 changed files was silently auto-merged into a hybrid.
- All **41 v271 strips** re-baked on this machine reproduce Codex's content byte-for-byte.

**The science is portable. Only the receipts are not.** That is a narrow defect wearing an
alarming costume, and it is worth saying plainly before anyone reads the rest of this document
and concludes the simulator disagrees with itself across machines. It does not.

---

## 6. The narrower thing this is an instance of

A hash is only evidence of what it actually hashes. This one hashed *the disk*, and disks
disagree; it read as evidence about *the repository*, and everyone downstream believed the
stronger claim. It stayed comfortable for months because every reader and every writer was the
same machine — and a check that only ever meets its own author cannot fail.

The withdrawn number in §0 is the same error at a smaller scale, which is why it is left in
rather than quietly deleted: a comparison that cannot come out the other way will always agree
with you, whether it is a receipt checking its own machine or an `else if` checking a file whose
two hashes are the same number.
