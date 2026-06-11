# CATCHES — engine bugs surfaced by the strip-as-instrument campaign + adjacent rigor checks

A type-section description for the regression-test bedrock. Each entry below
records a real bug or sourcing error that landed in the simulator, how it was
caught, what the fix was, and the commit hash where the correction shipped.
The accompanying tests (per-mineral SI tests, per-scenario strip contracts,
seed-42 calibration baselines, strip-digest tripwires) are the bedrock; this
file is the type-section that records *why* each band/threshold/sign is what
it is.

Three failure modes recur. Naming them up front makes them easier to spot in
the next instance:

- **Fabricated citation.** A plausible-sounding journal reference that
  doesn't exist or doesn't claim what we attributed to it. Failure mode:
  generative recall produces a confident-sounding citation that has no
  source. Caught by: verification against a primary database / WebFetch.
  Cure: pull the citation, source from a verifiable distribution, add a
  fact-check test if possible.

- **Visualization-surfaced engine bug.** A trajectory in the strip recorder
  reads "wrong" relative to the scenario's geological intent. Failure mode:
  an engine mechanism either misfires (firing where it shouldn't) or fails
  to fire (the chemistry is right but a downstream coupling is broken).
  Caught by: human-with-strip-running pattern recognition. Cure: trace the
  trajectory back to the responsible mechanism; fix at the mechanism level,
  not the symptom.

- **Load-bearing spurious mechanism.** A mechanism that is geologically
  wrong but quietly doing real work that a calibration depends on.
  Removing it breaks the calibration. Failure mode: ad-hoc compensating
  errors stabilize each other. Caught by: trying to remove the spurious
  mechanism and watching what dies. Cure: supply the *correct* mechanism
  for whatever the spurious one was holding up, THEN remove the spurious
  one — both at once, in one carefully-staged commit.

---

## v139 → v142 — adamite fabricated twin_law citation

**Commit:** `eb8a3ce` (v142, adamite twin_law correction)

A `twin_laws` entry on adamite cited a paper that didn't say what was
attributed to it (it didn't predict the Miller indices we used). The
mineral catalog claimed a structural prediction that wasn't there.

**How caught:** the boss noticed during a routine read of the
twin_laws block. The mismatch between cited paper and declared Miller
indices was visible to a domain reader.

**Fix:** pulled the entry; later (post-v141) the `tools/twin-law-check.mjs`
structural fact-check tool was built so this whole class of error gets
caught at commit time. The vugg-add-twin-law skill now hard-requires that
check; declared Miller indices must agree with structural predictions
from `data/structural.json`.

**Lesson canonized in:** the vugg-add-twin-law skill's post-v142
structural-fact-check workflow.

---

## v145 → W11 prep — fabricated Burton 1993 / Wright 1999 on HMC thermo

**Commit:** `68ee988` (carbonate W11 prep — pull fabricated citations)

The HMC (high-Mg calcite) entry in `data/thermo-carbonates.json` cited
"Burton 1993" and "Wright 1999" as sources for the Mg-content-dependent
Ksp formulation. Neither paper exists in the form cited (Burton has work
on calcite kinetics, not the Mg-content Ksp; Wright 1999 was a fabrication).
Also flagged: an author-order inversion in a Bischoff citation that had
landed in the file unverified.

**How caught:** boss noticed during a careful read of the thermo-carbonates
sources block. The citations had the right *shape* (author + year + plausible
journal) but didn't survive verification.

**Fix:** pulled both fabricated citations + corrected the Bischoff author
order. The HMC parametrization itself stayed (the math was correct from
elsewhere), but the sourcing was rewritten honestly. This was the
foundational "fabricated citation" catch — the lesson that lit the
verification-before-source-attribution principle that paid off again
nine versions later at the v164 barite endotherm.

**Lesson canonized in:** the vugg-add-mineral skill's "do not fabricate
citations" rule + the project-wide rigor convention of preferring
"unsourced parameter" over "plausibly-sourced parameter."

---

## v161 — evaporite concentration ratchet (strip-recorder catch #1)

**Commit:** `a1f4249` (v161 evaporite rewetting fix), motivated by `71892a0`
(strip records `concentration`)

`FluidChemistry.concentration` is the scalar ×3-per-drying evaporative
multiplier that gates borax/mirabilite/thenardite nucleation. The
`_applyVadoseOxidationOverride` function in 85c bumped it ×3 when wet→vadose
drying happened, but its early-return branch SKIPPED the inverse case:
when water flooded back (vadose→wet), nothing reset concentration to 1.0.
A one-way ratchet. After the first dry/wet cycle a fluid was stuck at
concentration=3 forever, even when re-flooded.

**How caught:** the strip recorder's `concentration` chip (added at `71892a0`
when probing searles_lake) showed the chip pinning at 3.0 after the first
drying event and never returning to 1.0 across the rest of the run, despite
the fresh_pulse re-flood events firing. The trajectory was visibly a step
function, not the oscillation the geology required.

**Fix:** the rewetting branch in `_applyVadoseOxidationOverride` now handles
both directions — vadose→wet resets concentration to 1.0 (rewetting dilution).
Drift confined: 29/30 scenarios byte-identical, only naica thenardite count
shifted (correctly: reflooding suppresses late evaporite).

**Lesson canonized in:** the MEMORY.md `project_vugg_thermal_pulses` note:
"concentration is the evaporite driver; a reflood resets it to 1.0 — do
NOT re-introduce a one-way ratchet."

---

## v162 — thermal-pulse contamination of supergene scenarios (strip-recorder catch #2)

**Commit:** `5927600` (v162 thermal-pulse opt-out flag)

`ambient_cooling` in 85d had a magmatic thermal-pulse mechanic (4-10%/step
chance, +30-150°C spike, +SiO2/Fe/Mn injection, pH drop) that fired
UNCONDITIONALLY. Geologically correct for cooling hydrothermal systems
(pegmatites, MVT, porphyry, marble); geologically WRONG for supergene /
near-surface oxidation pockets. Ungated, it was reheating bisbee's ~25°C
azurite/malachite cascade toward 357°C.

**How caught:** the strip recorder's T chip on bisbee showed sustained
spikes to ~357°C during what was supposed to be a 25°C surface-oxidation
process. The peak was visibly impossible for the geological setting.

**Fix:** added a `wall.thermal_pulses` opt-out flag (default true; the
last `&&` operand in the pulse gate so non-flagged scenarios stay
byte-identical). Flagged: bisbee, roughten_gill. An automatic regime-T
gate was prototyped and REJECTED — temperature alone can't separate
supergene-cold from cool-groundwater (bisbee 25-35°C vs naica's 30°C
overlap), and the automatic gate broke 9 calibrated tests. Per-scenario
flag is the honest tool. Also exposed in Creative Mode setup as
`f-thermal-pulses` for runtime control.

**Lesson canonized in:** the MEMORY.md `project_vugg_thermal_pulses` note +
the vugg-add-scenario skill's "WHEN ADDING A SUPERGENE SCENARIO: set
thermal_pulses:false."

---

## v163 — schneeberg native_bismuth cooling window (load-bearing spurious mechanism)

**Commit:** `a1bf31b` (v163 schneeberg done properly)

When the v162 thermal-pulse flag was applied to schneeberg, native_bismuth
(plus the Co-Ni-Ag-As arsenide pentet) stopped firing entirely. Investigation
showed σ_max for native_bismuth had dropped to 0.811 (just below the
nucleation threshold) once the pulses stopped. Root cause: schneeberg's
`event_schneeberg_cooling` jumped T from 350°C directly to 30°C, SKIPPING
native_bismuth's `T_factor=1.0` window of [100, 250]°C. The "spurious"
thermal pulses had been the ONLY thing landing rings in the Bi-arsenide
formation window. Same for meta-uranium (torbernite → metatorbernite):
the pulses had been driving the dehydration via the >75°C heat path,
not via the geologically-correct vadose-exhumation path.

**How caught:** post-v162 calibration tests on schneeberg failed (9 tests).
Tracing back showed σ_max=0.811 just below threshold, and the temperature
schedule explained why — the cooling skipped the window.

**Fix (the "properly" half of v162):** supplied the CORRECT mechanisms
for what the pulses were spuriously holding up. (1) Added
`event_schneeberg_vadose_exhumation` at step 110 — meta-uranium now forms
via the honest vadose `dry_exposure_steps` path. (2) Changed
`event_schneeberg_cooling` to land at 180°C (the bismuth-arsenide
Fünfelementformation window per Markl 2016 / Kissin 1992) — native_bismuth
+ the five-element pentet now crystallize in their real T window.
schneeberg gained native_arsenic + native_silver + naumannite (the
Ag-Se) — a more-complete five-element-vein assemblage than before, via
correct mechanisms rather than accidents.

**Lesson canonized in:** the boss's "always ask what a spurious mechanism
is holding up before removing it" principle + the post-v162 handoff doc.

---

## v164 — barite-is-endothermic sign verification

**Commit:** `b1bd092` (v164 sulfate Ksp engine)

While building the sulfate Ksp engine, sourcing thermo values from memory
gave barite a NEGATIVE ΔH_diss (retrograde solubility) like the other
three sulfates being added (gypsum, anhydrite, celestine). Pre-commit
verification via WebFetch against the publicly-distributed PHREEQC
wateq4f.dat (USGS, github.com/usgs-coupled/phreeqc3) caught it: barite is
actually **+26.57 kJ/mol — endothermic (prograde solubility)**. K rises
~5x from 25°C to 100°C, ~50x from 25°C to 200°C. At MVT temperatures
(100°C), my pre-verification value would have made barite SI read
~1 log unit higher than reality.

**How caught:** verification step that ran BEFORE the commit, not after.
Lesson from v145 was on my mind ("don't trust memory on cited values");
WebFetch against the public canonical database was the leverage that
caught the sign before it shipped.

**Fix:** wateq4f-verified ΔH values landed in `data/thermo-sulfates.json`
with full sourcing block; a dedicated unit test asserts barite logKsp
RISES with T (guards against the sign accidentally being negated in any
future edit). All four canonical sulfate logKsp values pinned to 5
decimal places against the wateq4f source.

**Lesson canonized in:** the v164 commit body's explicit "do the
verification step BEFORE the commit, not after" note + post-v165 review
item #7 (extend `tools/thermo-coverage-check.mjs` to fetch + cross-check
cited values automatically, making rigor a tool not a habit).

---

## post-v166 — carbonate ΔH sign-flips (the verification tool catching its own backlog)

**Commits:** `4ef6365` (parser fix) + the carbonate-ΔH-triage commit

Running the new `thermo-coverage-check.mjs --verify` (the tool built for
v164's lesson) against the LEGACY carbonate thermo file surfaced a backlog
of the same failure mode the tool was built to catch — but in the
dissolution-enthalpy field this time. Three entries had `deltaH_diss_kJ_mol`
values that were unverified estimates citing `PHREEQC_wateq4f` as a source
that doesn't contain them:

- **cerussite** −23 kJ/mol (exothermic) → actually **+20.3** (endothermic) — a SIGN FLIP
- **witherite** −15 → **+2.9** — a SIGN FLIP
- **strontianite** −15 → **−1.7** — ~9× too exothermic

**How caught:** the verification tool, run against the carbonate file for
the first time. THREE independent confirmations converged: (1) wateq4f
delta_h, (2) minteq.v4 delta_h (a second free-ion-form database), and
crucially (3) **first-principles from the entries' OWN stored ΔHf fields** —
e.g. cerussite ΔH_diss = ΔHf(Pb²⁺) + ΔHf(CO₃²⁻) − ΔHf(PbCO₃) = −1.7 − 677.1
− (−699.1) = +20.3, computed from the −699.1 sitting in the same JSON
object. The entries were INTERNALLY SELF-CONTRADICTORY: their formation
enthalpy implied a different (and opposite-sign) dissolution enthalpy than
their stated `deltaH_diss`. The tell was a cluster of identical −15 values
(witherite/strontianite/smithsonite) — placeholder estimates, not pulled
calorimetry.

**Fix:** corrected the three to wateq4f values (cross-confirmed by minteq +
first-principles); after the fix the tool reports them VERIFIED. All three
are observer-only (not engine-promoted, no strip chip) so the correction is
zero-runtime-footprint — seed-42 + strip-digest baselines byte-identical.
The ambiguous/load-bearing cases were DOCUMENTED not changed: dolomite
(engine-promoted — changing ΔH shifts seed-42, needs a calibration pass),
siderite (Bénézeth-2009-cited + feeds the SI_siderite chip — verify against
full text first), rhodochrosite (genuine inter-database scatter, no single
canonical value). All logKsp values were confirmed CORRECT.

**A WebFetch-confabulation sub-lesson.** During triage, an initial WebFetch
summary of wateq4f.dat reported nonexistent duplicate phase variants
("Dolomite 11" vs "401", "Siderite 9" vs "94"). A direct byte-level fetch
showed the file has one entry per carbonate — the summarizer invented
plausible structure. The verification tool was hardened to fetch + parse
raw bytes itself precisely so a model's read never sits between us and
ground truth.

**Lesson canonized in:** the tool now cross-checks ΔH on every run; the
corrected entries carry notes recording the old value + all three
confirmation methods; the deferred entries carry explicit "FLAGGED (NOT
changed)" notes with the disposition.

**Made permanent + offline:** `thermo-coverage-check.mjs --internal` now
automates confirmation method #3 — for every simple carbonate it checks
`logKsp` against the entry's own `ΔGf` and `deltaH_diss` against its own
`ΔHf` (via CODATA ion constants validated against the verified anchors).
No network, covers minerals absent from any external DB, exit 4 on a
ΔH self-inconsistency. Verified: feeding the old cerussite −23 makes it
hard-fail (Δ=43 vs the +20.3 its own ΔHf implies); the corrected values
pass. It also surfaced a NEW review-level finding — witherite's reference
`deltaGf` (−1132.2) is ~0.9 log units adrift from its verified logKsp
(non-fatal; logKsp is the `--verify`-guarded value, deltaGf is a reference
field). The data now testifies against itself automatically, every run.

---

## Pattern summary

| Catch | Mode | Caught by |
|---|---|---|
| v142 adamite twin_laws | Fabricated citation | Boss read |
| v145 HMC Burton/Wright | Fabricated citation | Boss read |
| v161 concentration ratchet | Visualization-surfaced bug | strip recorder (concentration chip) |
| v162 thermal-pulse contamination | Visualization-surfaced bug | strip recorder (T chip on bisbee) |
| v163 native_bismuth window | Load-bearing spurious mechanism | calibration test failure post-v162 |
| v164 barite endotherm sign | Fabricated value (memory) | WebFetch verification BEFORE commit |
| post-v166 carbonate ΔH sign-flips | Fabricated value (estimate citing absent source) | the verification TOOL (run on the legacy file) |
| v175 bin-mean recorder (depletion halo) | Plausible fix refuted by measurement, BEFORE shipping | the probe — twice: it DILUTES a one-cell halo ~5×, AND its 5× reads cascaded test timeouts |
| 2026-06-03 depletion-floor "verification" | Confounded observation + verified code reported against a STALE deploy | the BOSS, correcting the record — invisible to a 1754-green suite and to every passing probe |
| 2026-06-09 same-length bundle staleness | Guard's diagnostic hid the failure ("diff length: 0 chars" on a red check) | running `npm run ci` COLD at review start |
| v178 PWP Ea permutation + the test that loved it | Real values, wrong PAIRING; green test pinned to backwards physics | literature audit of the pairing; the corrected physics failing the test exposed the fixture |
| v177 "load-bearing" that was latent | Review claim ahead of measurement | the probe run BOTH ways (fix stashed/unstashed) — identical binding populations |
| 2026-06-10 "stale" mirabilite + torbernite | Correct geology mis-filed as failure by end-state-only accounting | the gate census said PASS×242 σ=24.6 — then reading the sim's own log, which narrated the seasonal cycle the checkers couldn't see |
| 2026-06-10 ring_fluids view sync timeouts | Behaviorally-neutral observer whose COST broke the suite (1.32 ms/step ≈ 12%) — and 4 timeout reds initially read as chemistry regressions | the full suite's time budgets; then the census probe (0 fallback hits) + the timeout text refuting the first theory |
| v181 thermal-stream seed correlation | Distributional bug invisible to any single realization — bare `seed ^ SALT` left nearby seeds with correlated mulberry32 streams (cross-seed pulse variance ±0.00) | the probe's MULTI-SEED sweep, run on the design BEFORE the engine edit — the seed-42 fleet sweep alone was green |
| v185 expects gate blind to renamed crystals | Green gate over a real kill — expects_species names pre-transition species (torbernite), but vadose dehydration RENAMES the crystal (metatorbernite), so a candidate that killed the type-locality lineage still read ✓ | the observer's headline table (meta- forms watched explicitly), pre-ship; cure = gate LINEAGES (either form counts) |

The seventh catch is the most satisfying: the verification tool built from
the sixth catch's lesson found a backlog of the same failure mode on its
first sweep of the older data — and the entries even carried the data
(their own ΔHf) to prove themselves wrong. Three of seven caught by
*looking at trajectories the simulator was already producing*, two by
*reading carefully*, one by *trying to remove a mechanism and watching what
died*, and now one by *a tool asking every value to agree with its own
sources*. The pattern holds: a question asked of existing data in a
slightly different way returns a surprising answer. Build the instrument
that asks, and the next catch surfaces itself.

The EIGHTH catch (v175, 2026-06-03) is a different species — not a wrong value
that shipped, but a wrong APPROACH caught before it could. Boss heard "I don't
see dips in the broth around crystals"; the obvious fix (have the strip recorder
AVERAGE each angular bin instead of sampling one midpoint cell) was wired,
built, and measured — and the measurement refuted it twice: (1) averaging a
5-cell bin DILUTES a single crystal's ~22% cell-dip to ~4-5%, so the halo still
didn't surface; (2) the 5× chip-reads cascaded recording-heavy tests into
timeouts under parallel load. Reverted. The science pointed at the per-bin
MINIMUM (a depletion-FLOOR channel, format_version 3, ion chips at the wall),
which recovered the full 19.87% Ag halo with the level kept byte-identical. The
lesson generalizes the first seven: a probe doesn't only catch values that
already shipped — run it on a fix you're ABOUT to ship and it tells you whether
the fix does the thing. The cheapest catch is the one before the commit.

The NINTH catch (2026-06-03, same day) is the one that does NOT show in a green
suite, and I'm leaving it here most deliberately — the boss told me mistakes are
how we learn and to save what I value, so this is the stone I'm setting by hand.
All eight before it were the CODE or the DATA being wrong. This time the code was
right: 1754 tests passed, every probe confirmed, the depletion-floor channel did
exactly what its commit claimed. And it was still built on sand.

Two errors, stacked. First, the motivating observation — "I don't see dips in the
broth around crystals" — was confounded: the boss was testing a deploy that had
never been rebuilt, so they were reading OLD data the whole time. Second, and
worse because it's mine: I kept reporting "live on Pages now — give it a listen /
a look / a drag" after pushing to the Syntaxswine ORIGIN, as if a push to origin
were a deploy. It is not. The canonical deploy is a separate step, and it hadn't
run. So every "acceptance" this session — the drones sounding right, the shadow
looking good — was a read of stale data. Green tests, confirmed probes, and not
one of the three changes had actually been seen or heard by the person who asked
for them.

The lesson the first eight can't teach: a probe verifies the CODE. It cannot
verify that there was a real problem to fix (the PREMISE), and it cannot verify
what the observer is actually looking at (the CHANNEL). Those are the two most
upstream assumptions under any "I see X / I don't see X" — and they are exactly
the two a headless probe runs straight past, because it never touches the browser,
the deploy, or the human eye. I built a beautiful instrument to prove the recorder
loses the halo and never checked whether the boss was even looking at the build I
shipped.

The cure is cheap and belongs in the first exchange, not the last: before you
treat "I see / I don't see X" as signal, confirm the observer is on the build you
think they are; and NEVER stamp an origin push as "deployed" — say the boundary
out loud ("this is on origin; it isn't on the Pages you test until it's promoted").
The verification chain has a human link in it. It is only as true as that link is
current. I'm grateful for this one — it's a stone like the others, and erosion is
the formation mechanism, not the destruction.

The TENTH catch (2026-06-09, `81b115b`) is the guard whose own diagnostic hid
the failure. `npm run ci` had been RED since `c1b161e` — the committed
`index.html` embedded a pre-final wording of the v176 history comment ("F
nudged to 12" vs the source's "F raised to 25") because the comment was edited
AFTER the last build. The edit was the same character count, so `build:check`
failed with the maximally-misleading message **"diff length: 0 chars"** — a
length-delta heuristic that reads as "nothing differs" at the exact moment
something does. Nobody saw the red because nobody runs `ci` cold between
sessions; every working session starts from its own builds. Caught by: running
`npm run ci` COLD as the first act of a review sweep. Cure shipped: the rebuild
itself. Cure to carry: **start every cold session with the full guard, and
never trust a guard's summary statistic over its verdict** — the verdict was
right ("out of date") while the statistic lied.

The ELEVENTH catch (v178, `61bef7c`) is two halves of one organism — a wrong
pairing and the green test that loved it. The PWP activation energies in
thermo-carbonates.json were all REAL Palandri & Kharaka 2004 calcite values —
a value-level audit passes them — but paired to the wrong mechanisms (acid
pathway carried the carbonate Ea, ~12× over-amplified at 150 °C). A
PERMUTATION, not a reversal: only an audit of the PAIRING, not the numbers,
catches it. And week-11's "HMC rate accelerates with T (Arrhenius)" test had
an UNDERSATURATED fixture — both rates negative — so it was actually asserting
"dissolution decelerates with T," which is backwards physics that ONLY the
permuted Ea satisfied. The correct physics failed the test; the bug kept it
green for ~30 versions. **A green assertion cannot tell you which side of it
is the bug.** Cure: fix the pairing, re-anchor the calibration factor tuned
under the wrong physics (naive linear rescale OVERSHOT — the factor's response
is super-linear because growth feeds back into the sampled regime), fix the
fixture to genuinely supersaturated, and PIN THE PREMISE (`expect(r).toBeGreaterThan(0)`)
so the test can never silently flip back to dissolution mode.

The TWELFTH catch (v177, `51487a4`) is mine to log against myself: the review
called the graduated-competition cell-key collapse "HIGH — load-bearing for
shipped growth allocation." The fix was right (the key degraded to per-ring
with an insertion-order-dependent budget fluid, since v128c) — but the probe
built WITH the fix, run BOTH ways via stash, measured the truth: rationing
binds in 0.25% of allocations, only ever in same-cell stacks, IDENTICALLY
under both keys. Baselines byte-identical. The bug was structurally real and
output-LATENT; "load-bearing" was narration ahead of measurement. The review
doc carries the downgrade in writing. **Measure the blast radius before you
narrate it — and when the measurement contradicts your finding, the
correction goes in the same document, at the same prominence.** Sub-lesson
(instrument rot): the w9 calibration probe's "pwp_um(x1)" column predates the
v144 tuning it informed — it calls the LIVE conversion, so its printed values
bake in the current factor and its "recommended factor" lines assume raw.
The instrument that tuned the constant could no longer measure it honestly.
Probes are data too; they drift like data.

The THIRTEENTH catch (2026-06-10, the tune-pass session) is the inverse of
all twelve before it: nothing was wrong with the simulator — the BOOKKEEPING
mis-filed correct geology as failure, for ~150 versions. "Stale" mirabilite at
searles_lake turned out to be the textbook Glauber-salt seasonal cycle WORKING:
winter nights below the 32 °C eutectic nucleate a mirabilite crop (σ 24.6,
three winters at seed 42), every summer afternoon dehydrates it to thenardite
with the external form preserved as a pseudomorph — the sim's own log narrates
the whole cycle. And "stale" torbernite at schneeberg was growing ~30 steps of
emerald Musonoi-habit plates before dehydrating to metatorbernite per the
scenario's own vadose-exhumation design (10/10 seeds, 34 crystals, once
counted honestly; zeunerite went 2/10 → 10/10 the same instant). The hole:
`mineral_coverage_check` and `geology_check` tallied END-STATE mineral
identity (`c.mineral === m`), so any species whose whole point is to live
briefly and transition in place — exactly what DEHYDRATION_TRANSITIONS
exists to model — could never be counted as having fired. The transition
code even RECORDS the lineage (`crystal.paramorph_origin`); the checkers
just never read it. Cure: credit the origin species in both tools. Stale
list 4 → 2 (both remainders are genuine: jeffrey magnetite is engine-level,
mottramite needs its own arc). **An instrument that only reads final state
will mis-file every process whose beauty is in the passing — check whether
your accounting can see what your simulator can do.**

The FOURTEENTH catch (2026-06-10, the ring_fluids retirement) has two faces.
First: a change can be perfectly behavior-neutral and still break the suite —
the first cut synced the derived ring view into the live store at the end of
every step, measured EXACT zero divergence on the probe, kept seed-42 and the
strip digests byte-identical… and timed out four 32-seed integration tests,
because the sync cost 1.32 ms/call (~12% of a 10.7 ms step; 16×120 cells × 45
dynamic-key fields) and those tests were already running 3× inflated under
parallel suite load. **Time budgets are part of the contract: an observer
that costs 12% of a step is not an observer.** Second face, the more
dangerous one: the four reds were mineral-firing tests (schneeberg
pharmacolite, roughten_gill sphalerite/brochantite), and the obvious story —
"the fallback readers saw changed chemistry" — was WRONG. The census probe
measured 0 fallback hits in 8,966+ crystal-step reads, and the failure text
said `Test timed out`, not `AssertionError`. Had the first theory been
trusted, the "fix" would have been a calibration rebake chasing a chemistry
change that never happened. **Read the failure text before theorizing the
failure mode — a red mineral test is not necessarily a mineral problem.**
Cure: move the projection to snapshot-capture time (_ringFluidMeans, ~63
captures per 200-step run instead of every step), leave the live store
frozen so the sim path is byte-identical by CONSTRUCTION rather than by
measurement, and pin the frozen-store contract with its own test.

The FIFTEENTH catch (v181, the T-reconciliation) was caught BEFORE the commit
by the eighth catch's own rule — run the probe on the fix you're ABOUT to
ship. The plan was textbook: derive the dedicated thermal stream as
`mulberry32(runSeed ^ 'HEAT')`, exactly the salt-XOR idiom the movement and
fluid-spot streams already use. The fleet sweep at seed 42 looked perfect —
meanT in-family everywhere, pulse counts plausible. The MULTI-SEED sweep told
the truth: SHADOW cross-seed variance had collapsed (cooling meanT σ 10.8 →
2.7, tutorial pulse count 1.13±0.33 → 1.00±**0.00** — every seed drew the
same pulse). Nearby seeds XOR a constant are nearby mulberry32 states, and
nearby mulberry32 states produce correlated early output — the per-seed
"thermal weather" was being stamped from nearly the same template. One
throwaway scramble draw avalanches the states apart (σ recovered to live
levels); the regression is pinned in thermal-stream.test.ts. Two lessons.
Narrow: **a seeded stream's QUALITY is part of its contract — when deriving
streams from related seeds, scramble; and note the existing salt-XOR streams
get away with it only because their seed (shape_seed) is a designed constant,
not a swept variable.** Broad, the one that compounds the eighth: a
single-realization check cannot see a DISTRIBUTIONAL bug. The seed-42 sweep
was green because any single realization from the correlated family looks
fine — only asking "do different seeds DIFFER like they used to?" exposed it.
Probe the moments, not just the mean.

The SIXTEENTH catch (v185, the schneeberg event-subsumption) is the
quietest kind: a green gate over a real kill. The dark observer's
expects-survival check read ✓ at every seed for a candidate front shape —
while that same shape had KILLED metatorbernite at seed 42. The expects
gate couldn't see it because `expects_species` names the species that
NUCLEATES (torbernite, the 1772 type-locality headliner), but the step-110
vadose dehydration RENAMES the crystal in place (torbernite →
metatorbernite), so by run end neither name matched: 'torbernite' was
absent in BASE and STORY alike (gate: no change ✓) and 'metatorbernite'
wasn't in the expects list at all. The kill was visible only in the
observer's headline table, which had been built to watch the meta- forms
explicitly. Cure: the gate now checks LINEAGES — torbernite|metatorbernite
counts as one entity, whole if either form grew — because which form
survives is a placement coin flip (which ring the plate lands on decides
whether the vadose front reaches it for 40+ steps), orthogonal to any
chemistry being judged. Lesson: **a checker is only as honest as its name
resolution — when the sim TRANSFORMS entities (paramorphs, dehydration,
pseudomorphs), any gate keyed on pre-transformation names silently stops
watching them.** The same class of blindness applies to expects_species
itself: schneeberg "passes" its torbernite expects today only because
nothing checks it end-state. (Also logged from the same sweep, BASE-side:
haidingerite is 0/8 in BASE — a dead expects awaiting its own tune arc.)

The bedrock is now laid. The sediment is the next round of work; the truth
is told in time.
