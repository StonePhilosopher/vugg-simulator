# FINDING — the evidence chain binds a checkout's line endings, not committed content

**Status:** measured, and repaired in two passes. Pass one fixed the build gate and deliberately
stopped short of changing what a receipt means. The boss's review sent it back with the right
seam — **version the hashing policy** — so pass two normalises text in all three producing paths,
declares the rule in every receipt, keeps archived receipts legible under the rule that made them,
and only then bakes. `.gitattributes` is defence in depth and says so in its own header.
**Date:** 2026-08-18. Found while integrating Codex's `b62d85f` (SIM 271, sulfur valence
authority) onto canonical `main` at `420bf22`.

**Read §0 before §3.** The mechanism is not the one this document originally claimed, and the
number that claimed it is left in rather than deleted.

---

## 0. What is actually established

*This section describes the tree as found. §3 describes the repair.*

Every evidence path hashed **raw working-tree bytes**. The repository had **no `.gitattributes`**,
and this workstation runs `core.autocrlf=true`. So git stores every one of these files with **LF**
and writes **CRLF** only to the files a given checkout actually materialises — leaving a working
tree that is not uniform and never was:

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

## 3. The full inventory, and the versioned repair

The first pass fixed the bundle and stopped, on the reasoning that changing what a receipt means
was the boss's call. It was — and the call came back: **version the hashing policy, normalise text
in every producing path, keep archived receipts legible under the rule that made them, and only
then bake.** That is what is now in the tree.

The review named two remaining sites. There were three. `sha256File` does not live in
`evidence-runtime.mjs` at all — it lives in `tools/scenario-evidence-checkpoint.mjs`, and it is
the function behind **both** the 126 artifact hashes in every science receipt **and**
`gen-strip-archive`'s per-story `artifactSha256`. It is the widest of the three and the least
visible from either caller.

| site | what it hashed | now |
|---|---|---|
| `tools/evidence-runtime.mjs` | execution set, producer contracts, browser bundle | policy-aware; both schemas bumped |
| `tools/scenario-evidence-checkpoint.mjs` | the 126 artifacts, strip-story receipts | policy-aware |
| `tools/release-audit.mjs` | content + asset manifests, **including byte counts** | policy-aware; both schemas bumped |

`tools/hash-policy.mjs` is the single authority:

- `HASH_POLICY_RAW` — `vugg-hash-policy-raw-bytes-v0`, the historical rule nobody ever declared.
- `HASH_POLICY_LF` — `vugg-hash-policy-lf-normalised-v1`, current: text normalised before it is
  hashed *or counted*, binary untouched.
- Receipts now carry `hash_policy`. A receipt without one is read as **raw**, never as current —
  answering absence with today's rule would convict every archived receipt of drift it never had.
- Both evidence schemas were bumped (`execution-set-v1→v2`, `producer-contract-v2→v3`, and the
  receipt itself `v1→v2`). The schema string is folded into the digest, so a pre-policy digest and
  a post-policy one **cannot collide even where the files are identical** — which is the point.

**Binary is not negotiable.** `release-audit` receipts `.mp3`, `.jpg`, `.png` and `.svg` through
the same function as `data/*.json`; normalising an audio file would corrupt the very identity the
receipt exists to pin. Detection is git's own heuristic — a NUL byte within the first 8000 —
because agreeing with the tool that decides the on-disk endings is the only self-consistent
choice. Verified on the real asset, not only on a fixture: the `.mp3` receipt records 4 104 477
bytes, exactly its size on disk, while `data/minerals.json` fell from 965 779 to 946 683 — a drop
of 19 096, exactly its CR count.

### What the tests hold

`tests-js/hash-policy.test.ts`, 9 assertions, all against planted fixtures rather than repository
files — a test that hashed real files would only ever measure whichever endings this machine has,
which is the defect one level up. Every fixture pair is guarded as *different on disk* first, so
no assertion can pass by accident.

**Mutation-tested, one mutant per guard:**

| mutant | result |
|---|---|
| remove the binary exemption | 1 RED — *passes binary bytes through byte-for-byte* |
| answer an absent `hash_policy` with the current rule | 1 RED — *reads a receipt with no declared policy as raw* |

### One bug this caught in itself

`fileReceipt` was called as `.map(fileReceipt)`. `Array.prototype.map` passes `(value, index,
array)`, so the **array index arrived as the policy argument** and every content receipt would
have been hashed under policy `0`. It failed loudly and immediately — `bytesForHash` refuses an
unrecognised policy rather than falling back to a default. Had the parameter defaulted silently
on a bad value, that pass would have produced a complete, plausible, wrong manifest. An
instrument that refuses is worth more than one that copes.

---

## 4. `.gitattributes`: defence in depth, explicitly subordinate

Added, with `* text=auto eol=lf` plus explicit `binary` for the image/audio/font types. It is
written into the file itself that it is **not the authority**: it has no effect on a file a *tool*
writes with the other ending, and none at all on a tree checked out before it existed. Both of
those happened here. It reduces how often the two forms diverge; the policy is what makes the
divergence stop mattering. If they ever disagree, the policy is right.

---

## 5. What the merge proved on the way past

Worth recording, because it is the reassuring half and it was measured the same way:

- All **178 `js/` files** in the merged tree are byte-identical to Codex's. The engine came
  through untouched.
- Exactly **four files were changed by both sides** — the four conflicts. So no file anywhere in
  590 changed files was silently auto-merged into a hybrid.
- Everything the final bake rewrote reproduces Codex's content exactly: **0 of 41** strips,
  **0 of 41** claim-card JSONs, **0 of 41** claim-card MDs, **0 of 3** baselines differ.

**The science is portable. Only the receipts were not.** That is a narrow defect wearing an
alarming costume, and it is worth saying plainly before anyone reads the rest of this document
and concludes the simulator disagrees with itself across machines. It does not.

### The whole finding, in one diffstat

After the bake, `git status` reported all 126 artifacts as modified. Every one of them
**vanished on staging** — normalisation on `git add` produced the identical blob in each case.
What survived was two receipts and a one-line import.

```
 archive/evidence/v271.json                      | 21 +++++++++++----------
 data/generated/science-provenance-manifest.json | 24 ++++++++++++------------
 tools/gen-science-provenance-manifest.mjs       |  1 +
```

126 files that differ on disk and are *the same file in the repository*. Everything above is a
consequence of hashing the first sentence instead of the second.

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
