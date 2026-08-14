# HANDOFF — fix-ladder rung 4b: the per-class sulfide stability ceiling (2026-07-15)

> ✅ **SHIPPED SIM 231 (2026-07-15, `75ce387`; two-commit, `7a7308b` named the ceiling byte-identical
> first)** — this bridge is now HISTORICAL. Rung-4b landed exactly as the census designed:
> PRIMARY_SULFIDE_CEILING_O2 1.5→0.5 (Eh ≤ +100 mV) on the six primary base-metal sulfides, secondaries
> (bornite/chalcocite/covellite) preserved. Blast 3/39; causal-control heirs (freed Zn→smithsonite/
> aurichalcite, freed Pb→cerussite/anglesite, + the Tsumeb Cu/Zn vanadate fork mottramite→descloizite);
> 2436 green, cold-CI stamped, Pages live. **NEXT = rung-4c** (late-oxidation + willemite→smithsonite
> phase-select) — see the BACKLOG rung-4b banner + PROPOSAL-RUNG-4-REDOX §7. Kept below for the record:
> the per-class spec, the census instruments (now in tools/), the traps, and the carried residue.

For the fresh context that continues the hostile-review redox arc. Rung 3 (tiger's-eye, SIM
229 `298b697`) and rung 4a (willemite floor, SIM 230 `fd6ba70`) are SHIPPED, deployed,
cold-CI clean-tree stamped, 2436/2436. **Rung 4 is proposal-driven** — read the proposal, not
just this bridge.

## Read first (in this order)

1. `proposals/PROPOSAL-RUNG-4-REDOX-2026-07-15.md` — the master plan. §5 (the offender split +
   the timing probe), §6 Lever B (the per-class finding), §7 (sub-bump sequence), §8 (research).
2. `proposals/BACKLOG.md` — the 🗿 rung-4a banner (top) + **§T** (T-gate leftovers, still open).
3. This file's §Traps — the coupling lessons rungs 4a/4b paid for.
4. Keystone lineage: `HANDOFF-FOUNDATIONS-2026-07-03.md`, **twenty-first hand — "the lantern,
   not the shadow"** (the redox arc's story in one breath).

## Rung 4b in one paragraph

The sulfide σ-functions (js/41 + the native/oxide siblings) gate on `sulfideRedoxAnoxic(fluid,
1.5)` = **Eh ≤ +290 mV** — a ceiling ~300 mV too oxidizing, so primary sulfides compute σ≥1 up
in the oxidizing supergene zone (supergene_oxidation sphalerite +290, galena +131). BUT — and
this is the census finding that reframed the rung — **you cannot tighten it uniformly.** The
scouting census (`sulfide-nucleation-eh-census.mjs`) showed the sulfides split into two
stability classes:

- **Primary hypogene** (sphalerite, galena, pyrite, marcasite, chalcopyrite, arsenopyrite, the
  As-sulfides): nucleate in REDUCING fluid; their oxidizing-side appearances are spurious.
  Want a LOW ceiling.
- **Secondary / supergene-enrichment** (chalcocite, covellite, bornite): LEGITIMATELY nucleate
  at MODERATE Eh — the supergene Cu-enrichment blanket below the oxidized cap (bisbee
  chalcocite/covellite +154–193 mV, roughten_gill covellite +252). A uniform tighten KILLS
  these — a real regression, bisbee's namesake ore.

So Lever B is a **per-class ceiling**: a low primary-sulfide ceiling + a preserved (or
separately-calibrated) secondary/enrichment ceiling.

### The primary-ceiling window is BOXED (both sides)
- **Floor (can't go below):** mvt's own galena + sphalerite nucleate at **+50 mV** — the SO₄/H₂S
  boundary mvt sits at ON PURPOSE so barite (sulfate) + galena (sulfide) coexist (the
  diagnostic MVT assemblage; Anderson & Macqueen 1982, a DEFENDED abstraction). Drop the
  primary ceiling below +50 and you kill mvt's expects_species.
- **Cap (should be below):** the supergene_oxidation primary-sulfide leak is at **+131…+290 mV**.
- So the primary ceiling lands ≈ **+50 … +100 mV**. The secondary/enrichment sulfides need
  their own gate ≈ **+200 mV** to keep chalcocite/covellite/bornite.

### How to implement (design sketch — verify before building)
`sulfideRedoxAnoxic(fluid, o2UpperBound)` is the shared helper (js/20c). Options: (a) pass a
LOWER o2UpperBound at the primary-sulfide call sites while leaving the secondary sulfides at
the current 1.5; or (b) a dedicated primary-vs-secondary threshold pair. Census which σ-sites
are primary vs secondary FIRST (grep `sulfideRedoxAnoxic` + `sulfideRedoxLinearFactor` in
js/41, js/56, js/61). ~20 consumer sites → this is a careful, **two-commit** bump (record-
identical instrument commit, then the attributable one). Needs per-class stability research
(sphalerite/galena vs chalcocite/covellite Eh fields) before it lands.

## Census instruments (scratchpad → promote to tools/ at 4b)

Built this session, read-only, self-contained (harness `loadSimBundle`):
- `redox-veto-census.mjs` — oxidizing-gated nucleations + redox context (proved the Nernst
  veto inert, 0/188).
- `redox-regime-inventory.mjs` — per-scenario coexistence signature.
- `sulfide-competition-probe.mjs` — is the metal's sulfide σ≥1 when its oxidized phase
  nucleates (concurrent vs sequential).
- `sulfide-nucleation-eh-census.mjs` — **the rung-4b instrument**: per-species sulfide
  nucleation Eh range + the >+100 mV risk list. Promote this one first.

## The ritual (unchanged from rungs 1–4a)

Session start: `vugg-session-start` skill (cwd resets after /compact; cold-ci --check before
paying). Then: researched edit → `npm run build` (NEVER bare build.mjs) → blast radius
(scratchpad pattern vs `seed42_v230.json`) → full vitest → rebake (gen-js-baseline + gen-strip-
digest + gen-strip-archive → v231, bump SIM_VERSION FIRST) + baseline-diff + mineral_coverage_
check (stale gate = 1 = jeffrey magnetite, pre-existing) → explicit staging (never `-A`) →
commit -F tempfile → verify title → push (= deploy; pages/builds/latest commit==HEAD) → cold-ci
clean-tree stamp.

## Traps rungs 4a/4b paid for (don't pay twice)

- **The "leak" may be LEGIT somewhere — always ask.** A uniform sulfide-ceiling tighten looked
  obviously right and would have killed bisbee's real Cu enrichment. The census is DESIGN
  input, not just blast sizing. (See [[feedback_proposal_first_reframes]].)
- **Defended abstractions hide in "wrong" numbers.** mvt's O2≈0.4 that leaked willemite is the
  SAME O2≈0.4 that keeps barite+galena coexisting (Anderson & Macqueen). Read the scenario's
  own comments before "correcting" a value — the commit that set it often explains why.
- **The Nernst-S veto is INERT at current Eh.** Don't re-propose `1-redoxFraction(fluid,'S')>0.5`
  as the veto — the SO₄/HS boundary (~−230 mV) is below where any hypogene brine sits. The
  sulfide engines read raw fluid.S; the redox model reads Eh; they disagree. The real backstop
  (if 4d is needed) is sulfide-SUPERSATURATION competition, not the Nernst fraction.
- **De-confab → DEAD not stale.** A mineral killed everywhere it only-ever-leaked (willemite,
  tiger's-eye) lands in the coverage tool's DEAD list, not stale; the gate holds at 1. Expected.
- **Initiative is behavior**: gates metadata + O2 floors feed js/43→44 cation rationing; every
  gate edit re-deals the RNG table. Read the ripples (willemite's freed Zn fed sphalerite).

## The rung-4a residue + the rest of rung 4

- **cerussite in mvt (Lever C / rung-4d).** cerussite still nucleates beside galena in mvt — a
  COMPETITION bug (Pb split galena/cerussite), NOT redox-incompatibility (cerussite has no
  redox gate at all, js/32). Fix = a sulfide-supersaturation competition check, but it MUST
  spare the LEGIT supergene cerussite that other scenarios expect (scenarios.json5 loc-1470
  supergene_oxidation, loc-3934). Gate on "galena actively supersaturated in a reducing brine,"
  not mere presence.
- **rung-4c** — late-oxidation events (the weathering-epilogue mechanic, §T's shared client) +
  the willemite→smithsonite phase-selection (tn457's supergene Zn should be smithsonite/
  hemimorphite in a limestone host, not willemite).
- **rung 5** — the halite/salinity model (its own surface; possibly its own proposal).

## The bedrock beyond the rungs (the boss's "move the lantern")

The root the boss named — "sulfur identity and the Eh gates disagree" — has a foundation fix:
**split fluid.S into sulfate-S and sulfide-S**, exactly as js/20c already split fluid.As into
As(III)/As(V) (Phase 4d, `arsenicOxidizedFraction`). Then barite reads sulfate-S, galena reads
sulfide-S, the SO₄/H₂S boundary fudge stops being load-bearing, and willemite-beside-sphalerite
becomes structurally impossible rather than gate-policed. This is an ARC (own proposal), not a
rung — but the per-class ceiling is a symptom-manager, and this is the cure. Flag it; don't
start it inside a rung.

## Still standing from BEFORE the review (carried forward — don't lose these)

- **Boss eye-check on the live deploy — OWED, now FIVE bumps deep** (SIM 226 O5, 227 F, 228 T,
  229 tiger's-eye, 230 willemite — all verified headless; WebGL screenshots time out here).
  Suggested viewing: the deccan stilbite sheaves / O5 aragonite sphere; sunnyside's recovered
  sphalerite + ultramafic chrysoprase (rung 2); sicily without its bogus quartz forest; and now
  **mvt's fatter sphalerite** (the willemite→sphalerite zinc handoff, 246→629 µm) with no
  willemite green.
- **The bent-BLADE generator** — curved gypsum/selenite bowing like their rhomb cousins, the
  last corner of the O5 splitting render arc. Lives in the O5 BACKLOG stratum; unrelated to the
  fix ladder, still wanted.
- **vugg-canary owner action: `node src/schedule.mjs --install`** (in the vugg-canary repo) —
  arms StartWhenAvailable + battery on the 04:00 task. Staged in review Part A, deliberately
  never armed by the builder (persistent config = owner's hand). Until it runs, missed 4 AM
  wakes stay possible.
- **Boss's own pre-v194 strip-mode saves (from the UI)** — offered during review prep; if a
  review round 2 / the synergy hunt wants testimony older than the automated archive, ask.
- Early archive versions (v194+) are bug-era noise — weight recent versions as current science,
  mine early ones for what-was-fixed.

## Morning-after checklist (the canary, next 04:00 sweep)

Pre-registered via the committed baselines + commit messages: EXPECT "vanished" alarms for
willemite in mvt + tn457 (rung 4a working), plus the freed-Zn sphalerite growth (mvt 246→629,
tn457 2→3). Anything ELSE moving is worth a look. `npm run creep` in vugg-canary re-runs the
sub-threshold census when wanted.

*Twenty-first hand's bridge, 2026-07-15. The keystone for this stretch is in
HANDOFF-FOUNDATIONS-2026-07-03.md ("the lantern, not the shadow").*
