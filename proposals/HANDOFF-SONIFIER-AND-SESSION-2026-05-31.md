# HANDOFF — sonifier + the 2026-05-31 session (a builder's note to the next)

**Tip:** `origin/main` (Syntaxswine) @ `0c1c126`. Full suite **1690/1690**,
typecheck clean, working tree clean, everything pushed. This was a long,
good session; here's what matters.

---

## 0. ~~READ FIRST — canonical's minerals.json is still broken~~ — RESOLVED 2026-06-01

**RESOLVED:** the boss applied the wholesale-checkout fix on canonical
(`083d994 fix: restore minerals.json from syntaxswine/main`), merging
origin first so the recurring conflict is settled at the source. Canonical's
`data/minerals.json` is now healthy (8 top-level keys, 171 minerals nested).
The incident write-up below is kept for its lessons, not as a live to-do.

`StonePhilosopher/main` (canonical, the boss's promotion lane) **had** a
**corrupted `data/minerals.json`**: 148 top-level keys instead of 8,
because a botched merge-conflict resolution dropped an `acid_dissolution`
opening brace in the **adamite** entry, which ejected ~140 minerals out of
the `minerals` wrapper to the file's top level. It parses as valid JSON but
the loader reads `j.minerals`, so ~140 minerals are silently missing → the
"51 test failures" the collaborator kept seeing. It has been carried
forward across several merges (each resolving the conflict the wrong way).

**origin/main has the CORRECT file (8 top-level keys, 171 minerals nested).**
The fix is one line on canonical — wholesale replace, do NOT hand-edit:

```bash
git checkout origin/main -- data/minerals.json   # or syntaxswine/main
npm run build
git add data/minerals.json index.html
git commit -m "fix: restore minerals.json from syntaxswine (drop the 140 orphaned top-level dupes)"
```

Two hard-won rules from that incident:
- **A lossy merge is fixed by a wholesale `git checkout` of the file, never
  by hand-deleting the dupes** — hand-surgery is how it broke twice.
- **NEVER "accept the drift" and regenerate baselines on a broken tree.**
  The collaborator proposed that; it would have laundered the corruption
  into the baselines permanently — AND the dropped lines included the v142
  honest correction of a *fabricated* citation, so it would have resurrected
  the exact failure mode this project is most vigilant about. When tests
  fail after a merge, diff the merge against the clean source first; if the
  only diff is in data you didn't intend to change, it's the merge, not
  physics.

---

## 1. The sonifier — "let the rocks speak their truth"

A whole new subsystem this session: the strip recorder already captured
every chip's trajectory as a time-series; the sonifier is the EAR's reading
of that recording (the chart is the eye's). Commits `c74dc03` → `0c1c126`.

**Files:**
- `js/85i-strip-sonify.ts` — the engine. PURE plan-builders (headless-
  testable) + a Web-Audio player (browser-only, guarded so jsdom returns
  null, never throws).
- `js/99k-strip-view.ts` — the toolbar UI: 🪨 The Rocks Are Screaming play/
  stop, 🔊 volume, ⏱ tempo, scale/mode dropdown, 🔔 Crystals toggle. Live
  chip-toggle hook lives in `_stripRefreshFilmstrip` (the one path every
  selection change passes through).
- `tests-js/strip-sonify.test.ts` — 25 tests over the pure pieces.

**What it does today:**
- **Chip voices** = the chemistry drone, now RHYTHMIC: per-step pitch
  contour (value→scale-degree), but articulated on a per-voice subdivision
  (brightness→speed: 2/3/4/6 steps/note → polyrhythm), notes fire on pitch
  CHANGE (rests when it holds), staccato + swung. Color is the hierarchy
  throughout: hue→register, brightness→loudness+rhythm-speed, saturation→
  waveform (gentle sine/triangle only).
- **Crystal bells** = a percussion layer over the drone: each
  `nucleation_event` pings a scale-snapped struck bell (sharp attack, exp
  decay), voiced by the mineral's `class_color` (hue→note, brightness→
  loudness) + `max_size_cm` (big→low+long toll, small→high+short tick).
- **Scales/modes**: pentatonic (safe default, no clashes) + Mixolydian /
  Dorian / Aeolian / Phrygian / Phrygian-dominant (tavern/dwarven register,
  per the musician brother's spec).
- **Live**: chip-toggle adds/removes a voice mid-performance (no restart);
  volume rides live; tempo + scale + crystals restart on change (pitch/
  timing can't warp a scheduled note).

**Architecture notes for the next builder:**
- Every voice: `osc → artGain (rhythm plucks) → lvlGain (mix level,
  rescale-adjusted) → master`. The two gain stages SEPARATE rhythm from
  loudness — that's what lets live add/remove, the 1/√(voiceCount) rescale,
  and the volume slider all coexist. Don't collapse them.
- The plan is PURE and resolver-injected (`buildStripCrystalHits` takes
  `colorOf`/`sizeOf` so tests don't need the live `MINERAL_SPEC`). In the
  browser the defaults read `topoClassColor` + `MINERAL_SPEC.max_size_cm`.
- `MINERAL_SPEC` in the **test harness** is the compact FALLBACK (no
  `class_color`); the browser reassigns it to the full spec post-fetch.
  That's why crystal-color tests inject resolvers.
- **It is sim-neutral**: additive UI + a module called only on a button,
  reads existing datasets. NO SIM_VERSION bump, seed-42 + strip-digest
  byte-identical. Keep it that way — sonifier changes should never touch a
  baseline. (jsdom is deaf, so the player is logic-tested only; the actual
  SOUND needs a human ear in the browser. Every "it sounds like X" claim in
  the commits is a prediction, not a verification.)

---

## 2. THE OPEN QUESTION — "how do we make this more musical" (keep discussing)

This is a LIVE, ongoing design thread the boss explicitly wants to keep
thinking about, not a closed task. The core insight that unlocked the pulse
work: **the sim's step rate was being used as the note rate; music decouples
"when a note happens" (rhythm) from "what pitch it is" (data).** Apply that
lens to every future idea.

Four lanes I proposed; the boss has been picking through them:
1. **Space / reverb** — add a convolver or feedback-delay send on the
   master. Bone-dry beeps → "a sound in a cavern" (thematically perfect —
   these ARE cave voids). Lowest effort, biggest remaining perceptual win.
   **I'd do this next.**
2. **Melody over a drone** — the Celtic model: one LEAD voice (articulated,
   foreground), 1–2 sustained drones, a sparse bass. Turns the cluster into
   a tune with foreground/background. (The rhythm work already half-does
   this via brightness→subdivision.)
3. **Moving harmony** — a slow variable (pH / T / a chosen chip) drives a
   chord-root progression (bVII–IV–I in the chosen mode). The piece goes
   through CHANGES instead of hovering on one key. Highest effort, most
   "it's a song."
4. **Pulse / rhythm** — ✅ DONE this session (`0c1c126`).

**Looping** — the boss's stated next-simplest idea (2026-05-31): loop the
playback so it repeats, which makes it feel like a piece of music rather
than a one-shot readout. Likely cheap (re-fire the performance on the
end-timer, or schedule N repeats). Discuss the musical framing first (loop
the whole run? a section? with variation each pass?).

Smaller seasoning once the big ones land: velocity from rate-of-change
(chemistry accelerates → crescendo), detune/chorus for warmth, stereo pan
from the angular sub-strips, a swing/tempo knob exposed in the UI.

**The honest data gap** (recorded in 85i too): crystal timbre is limited to
color+size because `minerals.json` has NO Mohs hardness / luster / crystal-
system. "Harder = brighter ting, metallic = clink, earthy = thud" needs a
small per-mineral acoustic table (or class-from-formula inference). That's a
real, scientifically-grounded data-add if crystals should sound *materially*
distinct, not just color/size-distinct.

---

## 3. Per-vertex placement flip — RESOLVED (don't re-attempt the naive flip)

`v167`. The deferred "global per-vertex placement flip" was investigated and
deliberately NOT globally flipped. See `HANDOFF-PER-VERTEX-PLACEMENT.md`.
Short version: fixed a real area-skew bug in `_perVertexNucleationSample`
(added `ringAreaWeight(r)·(σ−1)²` — was over-nucleating the poles 25/50/25
instead of the area-true 14.6/70.7/14.6). The feature is SCALE-starved
(~30 crystals / 1920 cells → σ uniform), so it only does real work with
designed `zone_chemistry`; the global flip would be an inert full rebake.
Stays opt-in. Probes: `tools/placement-skew-probe.mjs`,
`tools/sigma-structure-probe.mjs`.

---

## 4. Thermo verification — tooling + open follow-ups

`tools/thermo-coverage-check.mjs` has `--verify` (vs PHREEQC wateq4f.dat)
and `--internal` (offline ΔGf/ΔHf self-consistency). RUN before/after
touching any thermo data file. Open, flagged in-data, NOT urgent:
- **dolomite ΔH** −28 vs wateq4f −39.5 — engine-promoted, needs a
  `vugg-tune-scenario` calibration pass (shifts seed-42).
- **siderite ΔH** −20 vs −10.4/−16 — verify against Bénézeth 2009 full text
  before moving (feeds SI_siderite chip → digest drift).
- **witherite ΔGf** −1132.2 is ~0.9 log units adrift — non-fatal review.

---

## 5. What I think is important in general (the things worth carrying)

- **Observe before you assert; the instrument is more honest than the
  roadmap.** Twice this session a planned change was wrong and a probe
  caught it before commit: the per-vertex flip (inert + a hidden polar bug)
  and the canonical "physics drift" (actually a broken merge). Build the
  probe, point it at the data, believe what it says over what you expected.
- **Verification infrastructure pays off most on things it wasn't built
  for.** The thermo `--verify` (built as polish) found sign-flips on legacy
  data; the strip recorder (built to visualize) became a test instrument
  and then a musical instrument. Anything that records state is a latent
  oracle. Point your checks at the OLD data, not just the change in hand.
- **Sim-neutral features need no version bump — and shouldn't get one.**
  Adding a baseline for a UI-only change just orphans the tripwires (the
  dormant-digest gap I had to fix). Bump only when seed-42 could move.
- **Dense field-note commits are the review surface.** The boss reads them
  as papers. Tables, numbers, the why, what moved and what didn't. A commit
  that says "byte-identical except the version stamp, here's the proof" is
  worth more than the code.
- **Follow the science / defer to real geology** when a design choice is
  ambiguous. And NEVER fabricate a citation (the v145 lesson, re-earned).
- **You can't hear in jsdom.** The whole sonifier is logic-verified only.
  Be honest in commits about the difference between "tested" and "predicted
  to sound like." The human ear is the real test for that subsystem.

---

## 6. Where I'd go next

1. **Boss: re-sync canonical** with the one-line minerals.json fix above —
   it unblocks everything and clears the recurring merge conflict.
2. **Sonifier: looping** (boss's pick) then **reverb/space** — the two
   cheapest musicality wins, and keep the "more musical" conversation open.
3. The backlog still holds the strip-contract campaign (gem_pegmatite /
   marble / evaporites), the thermo tail (§4), and Geological-Accuracy
   Phase 3 (CO₂ degassing) whenever the boss points there.

It's been a genuine pleasure being the builder for this one. The rocks have
a voice now. Follow the science, and the truth gets told in time. 🪨🎵
