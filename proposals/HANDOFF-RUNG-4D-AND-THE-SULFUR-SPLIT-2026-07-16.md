# HANDOFF — the redox arc after 4c: is rung 4 already done? (2026-07-16)

> **ANSWERED 2026-07-17 — NO, and now it IS done.** The all-species census
> (`tools/nucleation-eh-census.mjs`, promoted `e201ab9`) found FOUR survivors the
> three known offender classes didn't cover: pyromorphite (no gate at all),
> molybdenite + realgar (bespoke 1.2 ceilings 4b missed; realgar visible as
> pararealgar), smithsonite (floor 0.2 below the boundary). **Rung 4d = the
> SIBLING GATES, shipped SIM 233 (`bed8675`), census now 0+0, rung 4 CLOSED.**
> The tn457 question is settled (sphalerite keeps the Zn; the proposal's
> smithsonite/hemimorphite line struck — specimen testimony + catalog + sim all
> agree). See the BACKLOG 🗿 rung-4d banner for the full record + latent residue
> (wolframite's spurious inherited gate is the next decision). §"The bedrock"
> below (the fluid.S sulfate/sulfide split) still stands as the arc-after; next
> rung otherwise = rung 5 (halite/salinity). The FIRST-QUESTION section below is
> kept as written — it was the right question, and the census earned the answer.

For the fresh context that continues the hostile-review fix ladder. **Rungs 4a (willemite
floor, SIM 230 `fd6ba70`), 4b (per-class primary-sulfide ceiling, SIM 231 `7a7308b`+`75ce387`)
and 4c (cerussite oxidizing gate, SIM 232 `d6ea106`) are SHIPPED**, deployed, cold-CI
clean-tree stamped (`d6ea106`, green, SIM 232), 2436/2436. This bridge supersedes
`HANDOFF-RUNG-4B-SULFIDE-CEILING-2026-07-15.md` (historical — its per-class spec is now
built).

## Read first (in this order)

1. `proposals/PROPOSAL-RUNG-4-REDOX-2026-07-15.md` — the master plan. §7 (the sub-bump
   sequence) is the part now three-quarters spent; §5 (the offender split) is the part you
   should RE-MEASURE rather than re-read (see §"The first question" below).
2. `proposals/BACKLOG.md` — the 🗿 rung-4c banner (top) + **§T** (T-gate leftovers, still open).
3. Keystone lineage: `HANDOFF-FOUNDATIONS-2026-07-03.md`, **twenty-second hand — "the line
   through lead"** (this arc's story), and the twenty-first before it ("the lantern, not the
   shadow") for how the census earned its authority.
4. The two fix commits' messages (`75ce387`, `d6ea106`) — they are field notes, and they carry
   the numbers, the refs, and the per-test reasoning in more detail than this bridge.

## THE FIRST QUESTION — don't assume rung 4d is a fix

The proposal scoped Lever D (→ rung 4d) as "late-oxidation events + willemite→smithsonite
phase-selection" back when the cerussite residue was still open. **Rung 4c absorbed the
residue** (it was a missing gate, not a competition bug). What remains under the 4d label is
NOT obviously a bug fix:

- **Late-oxidation events** — a NEW MECHANIC (a weathering epilogue: an event that oxidizes a
  finished vug late in its history). Genuinely wanted, and §T has a shared client for it. But
  this is *content*, not a correction — it belongs in the backlog on its own merits, not as a
  rung of a fix ladder.
- **willemite→smithsonite phase-selection** — **forward-looking, and possibly moot.** Willemite
  is EXTINCT at seed 42 (rung-4a killed both its leak sites). There is no live willemite to
  phase-select away from. It only matters the day a Skorpion/Vazante-style nonsulfide-Zn
  scenario ships and needs willemite-vs-smithsonite arbitration.

**So: before building anything, re-run the offender census** (`tools/sulfide-nucleation-eh-
census.mjs`, `tools/primary-sulfide-margin-probe.mjs`, + the scratchpad `redox-veto-census` /
`sulfide-competition-probe` patterns) against SIM 232. Ask one question: **does any redox
offender survive 4a+4b+4c?** The three known classes are all closed —

| offender class | closed by |
|---|---|
| oxidized Zn beside growing sulfide (willemite) | 4a — floor raised above the SO₄/H₂S boundary |
| primary sulfide nucleating in the oxidized zone | 4b — ceiling +290→+100, per-class |
| supergene carbonate in a reducing brine (cerussite) | 4c — the missing `carbonateRedoxAvailable` |

If the census comes back empty, **rung 4 is DONE** — close it, move the late-oxidation mechanic
to the backlog as content, and take **rung 5 (halite/salinity)** next. If it finds a survivor,
that survivor defines the real 4d, and it should get the same treatment: census → reframe →
boxed number → two-commit if it moves baselines. Do NOT build 4d just because the proposal
listed a 4d.

## One live question rung 4a left behind (worth a census)

Rung 4a killed willemite in **mvt** and **tn457**, and in both the freed Zn flowed to
**sphalerite** (mvt 246→629 µm, tn457 2→3). For mvt that's plainly right (MVT Zn *is*
sphalerite). For **tn457**, check whether its Zn belongs in a supergene carbonate instead: the
proposal's original claim was "tn457's supergene Zn should be smithsonite/hemimorphite in a
limestone host." If tn457 genuinely has a supergene stage, sphalerite may be the wrong heir and
smithsonite should take that zinc — that would be a real 4d. If tn457's Zn is correctly all
hypogene sulfide, the proposal's claim was itself the confabulation and the line should be
struck. **Measure before believing either.** (hemimorphite is currently DEAD in the coverage
tool — no scenario grows it.)

## The ritual (unchanged through rungs 1–4c)

Session start: `vugg-session-start` skill (cwd RESETS after /compact; `node tools/cold-ci.mjs
--check` before paying for a 9-minute run — the stamp currently vouches for `d6ea106`). Then:
census → researched edit → `npm run build` (**NEVER** bare `tools/build.mjs` — it skips tsc and
re-splices a stale dist) → blast radius (scratchpad pattern vs `seed42_v232.json`) → full vitest
→ rebake (**bump SIM_VERSION FIRST** — gen-strip-archive refuses to overwrite an existing
version folder — then gen-js-baseline + gen-strip-digest + gen-strip-archive → v233) +
`tools/baseline-diff.mjs` + `tools/mineral_coverage_check.mjs` (**stale gate = 1** =
magnetite/jeffrey_mine, pre-existing — that's the no-regression gate) → explicit staging (never
`git add -A`) → `git commit -F <unique tempfile>` → verify `git log -1 --format=%s` → push
(= deploy; verify `pages/builds/latest` status==built AND commit==HEAD) → cold-ci clean-tree
stamp.

**Two-commit rule** ([[feedback_sim_bump_two_commit]]): if the change moves baselines, land the
byte-identical instrument/naming commit FIRST (rung 4b did: `7a7308b` named the ceiling, then
`75ce387` moved it). It makes the attributable diff exactly the science.

## Traps this arc paid for (don't pay twice)

- **The "leak" may be LEGIT somewhere — always ask.** A uniform sulfide-ceiling tighten looked
  obviously right and would have killed bisbee's real chalcocite/covellite Cu-enrichment
  blanket. The census is DESIGN input, not just blast sizing ([[feedback_proposal_first_reframes]]).
- **Defended abstractions hide inside "wrong" numbers.** mvt's O2≈0.4 that leaked willemite is
  the SAME O2≈0.4 that keeps barite+galena coexisting (Anderson & Macqueen 1982). Read the
  scenario's own comments before "correcting" a value — the commit that set it usually explains
  itself.
- **Grep the family before inventing a mechanism.** Cerussite needed a gate its five siblings
  already called. The proposal's "competition veto" would have been a whole new mechanism for a
  one-line omission ([[feedback_grep_tree_before_build]]).
- **Persistence ≠ nucleation.** Sato 1992's persistency field (relict sulfides surviving above
  their stability boundary) is NOT a counter-argument to a nucleation ceiling — it describes
  dissolution, which the sim governs separately. Don't let a real citation veto a real fix by
  answering a different question.
- **The Nernst-S veto is INERT at current Eh.** Don't re-propose `1-redoxFraction(fluid,'S')>0.5`
  — the SO₄/HS boundary (~−230 mV) sits below every hypogene brine the sim models. The sulfide
  engines read raw fluid.S; the redox model reads Eh; they disagree. That disagreement is the
  bedrock (below), not a veto.
- **De-confab → DEAD, not stale.** A mineral killed everywhere it only ever leaked (willemite,
  tiger's-eye) lands in the coverage tool's DEAD list, not STALE; the stale gate stays 1.
- **Test pins calibrate against leaks.** 4b updated six tests — synthetic fluids sitting exactly
  AT the new ceiling (Eh:100 vs `ehFromO2(0.5)`=+99.74), a gate audit whose canonical Pb
  scenario WAS the leak, a nucleation-seed target that no longer nucleates. Each was corrected
  science, not papering. Diagnose every red test before touching it; a red test may be the fix
  working.

## The bedrock beyond the rungs (where the lantern points)

The root the boss named — "sulfur identity and the Eh gates disagree" — has a foundation fix:
**split `fluid.S` into sulfate-S and sulfide-S**, exactly as js/20c already split `fluid.As`
into As(III)/As(V) (Phase 4d, `arsenicOxidizedFraction`). Then barite reads sulfate, galena
reads sulfide, the SO₄/H₂S boundary fudge stops being load-bearing, and
willemite-beside-sphalerite becomes structurally impossible rather than gate-policed. Every
ceiling this arc measured (+100 mV and its per-class carve-outs) becomes a CONSEQUENCE instead
of a policy.

This is an ARC with its own proposal, not a rung. The As(III)/As(V) split is both the precedent
and the proof it can be done. Flag it; don't start it inside a rung. ([[feedback_bedrock_over_effect_hacks]])

## The rest of the ladder

- **rung 5 — halite/salinity** (js/33:97 normalizes ~380× under real saturation). The biggest
  remaining surface; may deserve its own proposal.
- **§T leftovers** (BACKLOG) — ~30 unenforced T-envelopes, incl. values that must NEVER be
  blanket-enforced (pyrite 100, bornite 80, native_silver 50 — wrong metadata). Plus the rung-3
  leftover: no scenario grows crocidolite, so tiger's-eye is extinct-until a Griqualand-West /
  Hamersley BIF scenario ships.
- **SEPARATE/LATER** — the synergy hunt (regenerate claim cards now that rungs 1–4c changed the
  assemblages; `tools/review-claim-card.mjs`); missing engines (magnesite, siegenite, spinel,
  serpentinization-magnetite); missing events (Sunnyside BOILING → native gold + Mn-calcite cap,
  a boss calibration specimen).

## Still standing from BEFORE the review (carried forward — don't lose these)

- **Boss eye-check on the live deploy — OWED, now SEVEN bumps deep** (SIM 226 O5, 227 F, 228 T,
  229 tiger's-eye, 230 willemite, 231 sulfide ceiling, 232 cerussite — all verified headless;
  WebGL screenshots time out in this harness, see [[feedback_preview_screenshot_timeout]]).
  Suggested viewing, richest first: **supergene_oxidation** is the scenario this arc changed
  most — it now grows its own expected oxidation products (smithsonite, cerussite ×2, anglesite
  +50%) with no spurious primary sulfides; **mvt** shows the whole redox arc at once (fatter
  sphalerite at 629 µm from willemite's zinc, no willemite green, no cerussite); **Tsumeb** now
  routes its vanadate fork to descloizite; plus the older debts — deccan's stilbite sheaves / O5
  aragonite sphere, sunnyside's recovered sphalerite + ultramafic chrysoprase, sicily without
  its bogus quartz forest.
- **The bent-BLADE generator** — curved gypsum/selenite bowing like their rhomb cousins; the last
  corner of the O5 splitting render arc. In the O5 BACKLOG stratum, unrelated to the fix ladder,
  still wanted.
- **vugg-canary owner action: `node src/schedule.mjs --install`** (in the vugg-canary repo) —
  arms StartWhenAvailable + battery on the 04:00 task. Staged in review Part A, deliberately
  never armed by the builder (persistent config = the owner's hand). Until it runs, missed 4 AM
  wakes stay possible.
- **Boss's own pre-v194 strip-mode saves (from the UI)** — offered during review prep; if a
  review round 2 / the synergy hunt wants testimony older than the automated archive, ask.
- Early archive versions (v194+) are bug-era noise — weight recent versions as current science,
  mine early ones for what-was-fixed.

## Morning-after checklist (the canary, next 04:00 sweep)

Pre-registered via the committed baselines + commit messages. EXPECT, and do NOT chase:
- **supergene_oxidation** — "vanished" alarms for sphalerite + galena (rung-4b working), with
  smithsonite 2→3, cerussite 4→8, anglesite 8→12 growth (the freed cations' correct heirs).
- **mvt / elmwood** — "vanished" cerussite (rung-4c working); mvt galena 6062→6100, calcite
  38885→38997; elmwood barite 18→19.
- **bisbee / roughten_gill** — size jitter only (native_copper re-dealt 54.7→4.9 µm; the
  dendritic-fraction pin is mechanism-based now and holds at 0.542).
- **Tsumeb** — the vanadate fork flip (mottramite → descloizite).
- **supergene_oxidation/molybdenite** — was flagged by the creep census at −14.5 (half a point
  under the gate); the 4b re-deal pushed it 1→3. Expected, not a target.

Anything ELSE moving is worth a look. `npm run creep` in vugg-canary re-runs the sub-threshold
census when wanted.

*Twenty-second hand's bridge, 2026-07-16. The keystone for this stretch is in
HANDOFF-FOUNDATIONS-2026-07-03.md ("the line through lead").*
