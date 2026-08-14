# PROPOSAL — THE HOSTILE REVIEW, round 1 (instruments + fleet science audit)

**2026-07-14 · SIM_VERSION 226 · tree green at `eec8466` · review-only (no engine file touched).**
This is the durable stratum of the hostile review the boss commissioned: an adversarial
audit of the simulator's scientific accuracy, run against the strip archive's canonical
seed-42 testimony (v226) and the vugg-canary's nightly record. The boss directed that this
document land BEFORE any engine behavior changes; the fix ladder in §6 is the approved
implementation order.

**Companion data:** `proposals/DATA-HOSTILE-REVIEW-2026-07-14.json` — the complete findings
record (76 confirmed with evidence + growth-condition levers, 31 refuted with the full
defenses, 1 uncertain, 38 minor/abstraction, per-scenario verdicts, synthesis). This .md is
the readable core; the JSON is the fossil.

---

## 1. The drift doctrine (the review's lens)

Owner, 2026-07-14: *"Making it accurate-to-life is more important than making sure it's
always the same. The main reason to avoid drift is that it keeps the science honest by
making it justify the cost of the change."*

Boss, 2026-07-14: *"Drift is acceptable when it comes from better science. Better science
should increase causal control, not decrease it. If we understand why the model moved, we
should be able to move it again on purpose by changing growth conditions, not by patching
the scoreboard."*

Operationally: every finding below is only actionable as a **growth-condition lever** —
a broth ion, a gate that reads the right variable, a missing engine, a missing event.
"Delete it from expects_species" and "regen the baseline to hide it" are forbidden moves.
Every fix that moves seed-42 output pays the two-commit SIM-bump ritual with a measured
blast radius, so the science justifies the cost in the commit record.

---

## 2. Method

1. **Claim cards** — `tools/review-claim-card.mjs` (new instrument, shipped with this
   commit) fuses each scenario's CLAIM (anchor locality, deposit description,
   expects_species, cited sources, initial T/P/fluid, author notes) with its TESTIMONY
   (the v226 seed-42 strip's actual paragenetic order, species surprises/no-shows,
   T/pH/Eh/salinity/SI trajectories) into one compact card. 39 cards, ~5 KB each,
   regenerable (`--all --out .review-cards`, gitignored like `.strip-diffs/`).
2. **Challenge** — one adversarial mineralogist per scenario, instructed to disbelieve
   the biography, respect the author notes (settled de-confabulations are not re-raised),
   self-verify top claims against real literature, and name the growth-condition lever
   for every real inaccuracy.
3. **Refute** — every material (high/medium, non-abstraction) challenge went to an
   independent skeptic instructed to mount the strongest possible DEFENSE of the sim.
   Only objections that survived the defense count as confirmed.
4. **Synthesize** — cluster confirmed defects into cross-cutting mechanisms with one
   root cause each. 148 agents total.
5. **Source verification** — subagents fabricate; every load-bearing *code-level* claim
   relayed here was re-verified by hand against the actual files (file:line cited below).

Counts: **76 confirmed** (25 high / 41 medium / 10 low after refutation-corrected
severity) · **31 refuted** (sim defended) · **1 uncertain** · **38 minor/abstraction** ·
**35/39 scenarios** carry ≥1 confirmed defect · **5 clean**: pulse, cooling,
tutorial_first_crystal, amethyst_geode, great_salt_plains.

---

## 3. Part A — the record itself (canary + strip archive audit)

The boss's four canary flags, re-examined against the repo, the task config, and the
nightly log. Three held; #1 was right about the symptom, wrong about the cause.

| # | Boss's flag | Verdict | The actual mechanism |
|---|---|---|---|
| 1 | "Missing days June 25-26, 28, July 12-13; scheduler/wake path imperfect" | **Symptom right, cause wrong — two distinct failures, neither a June wake failure** | **June 25/26/28:** the sweep RAN and wrote honest `NO-CHANGE.json` markers locally — but `src/sweep.mjs` `return`s from the short-circuit branch *before* `publishSpine()`, so **no NO-CHANGE day has ever been committed** (0 in git; 3 on disk). A publish-path bug: the fossil existed in the local sediment but never got exposed in the public cliff face. **July 12/13:** interrupted runs (`^C` in `_nightly.log`) on an engine-dirty tree — July 12 died at 30/39 scenarios (no meta.json), July 13 at 0 files. No completed stratum existed to publish. |
| 2 | "v226 not canaried yet" | **Confirmed, self-resolving** | The 4 AM July 14 sweep ran at 04:00:01, before the v226 push. v226's source, `seed42_v226.json` baseline, and strip archive are all committed — the next awake sweep produces the v226 layer and self-tests against it. |
| 3 | "Historical alarms are real signal" | **Confirmed exactly** | Diff files match the boss's numbers to the digit: v224@07-09 = 8 alarms (schneeberg/pharmacolite 97.5→76, roughten_gill/olivenite 85→68, bisbee hematite/lepidocrocite, naica opal 0→9, +3); v225@07-10 = 1 alarm (tutorial_mn_calcite/siderite 0→100 — the UV-audit broth fix, an intended, attributed move); 07-11 and 07-14 quiet. |
| 4 | "July 6 engine_dirty:true; honest disturbed layers" | **Confirmed, with a precise caveat** | July 6 meta records `engine_dirty` from an uncommitted `js/46-wulff-geometry.ts` edit, but `dist_matches_source:true` and the seed-42 self-test PASSED vs `seed42_v216.json` — the seed-42 row is provably clean; only the 200-seed table sampled a disturbed tree. Clean July 7 onward. |

**Complementarity finding the flags missed:** the two instruments cover each other's
holes. The strip archive is gapless v194→v226 **except v218 is missing** (the archive tool
wasn't run at that bump) — and the canary's July 8 sweep is the **sole surviving fleet
record of v218**. Conversely the archive holds the intraday-superseded versions
(v219–v223) the 4 AM canary never sampled. Neither alone is the record; the review should
always read both.

**Part A work list (vugg-canary repo, separate commit):**
- Publish the NO-CHANGE marker (move/duplicate the publish before the short-circuit
  `return`), so "nothing changed" becomes an explicit committed stratum.
- Catch-up staging: on each publish, also stage prior dated dirs that are complete
  (NO-CHANGE.json, or v-dir WITH meta.json) but unpublished — heals orphans after an
  offline night. Partial dirs (no meta.json) stay local: an aborted run is not a stratum.
- Backfill the three orphaned NO-CHANGE days (2026-06-25/26/28).
- `src/schedule.mjs`: add `StartWhenAvailable` (+ optional battery-tolerant flags) to the
  generated task so a missed 4 AM start catches up; owner re-runs `--install` to apply.

---

## 4. Part B — the science verdict

The core engines are **sound**: primary sulfides, carbonates, silicates, zeolites, and
evaporite cascades mostly grow the right species in the right order, and a third of all
adversarial objections DIED against the sim's defenses (§5 — the sim was right about
mvt aragonite-at-153°C, the dolomite kinetic no-show, porphyry's late quartz, Caldbeck
vanadinite + turquoise, Bisbee dioptase, epithermal sylvanite-before-calaverite…).

But one failure mode dominates roughly two-thirds of the confirmed defects: **oxidation-
state and temperature gates are too permissive, so a mineral's own documented redox/T
envelope gets crossed by a fluid that should never reach it.** Oxidized supergene phases
nucleate inside hot reducing hypogene brines; low-T phases grow in hot veins; salts
precipitate from dilute water. These are science-shaped cracks, not scoreboard
disagreement — in nearly every case we know exactly why the phase fired, which is the
drift doctrine's definition of a fixable model.

### The five verified smoking guns (code-confirmed by hand)

| # | Defect | Verified at | Mechanism | Lever |
|---|---|---|---|---|
| 1 | **Leaked fluorine default** | `js/20-chemistry-fluid.ts:28` — `this.F = opts.F ?? 10.0` | Scenarios that omit F inherit 10 ppm; fluorite's gate (`js/33-supersat-halide.ts:60`) needs only Ca + F ≥ fluid_min, so fluorite confabulates into fluorine-free deposits (zoned_dripstone_cave, jeffrey_mine, sicily_solfifera, tormiq) | Default → 0 so "unset" means "absent"; audit F-omitting scenarios to explicit deposit-appropriate values |
| 2 | **Halite gate ~380× too loose** | `js/33-supersat-halide.ts:97` — `σ = (Na/100)·(Cl/500)·c²` | ~500 ppm Cl treated as the saturation reference vs real NaCl saturation ≈190,000 ppm; several "evaporation" events never ratchet `concentration`, so brackish water mints salt and bitterns fire out of order (tn457, sabkha, searles, tutorial_travertine, naica) | Re-scale to real solubility (IAP vs Ksp or concentration factor ≫1); sylvite gated behind halite; evaporation events actually raise salinity |
| 3 | **Quartz has no runtime T-floor** | `js/89-nucleation-silicate.ts` `_nuc_quartz` gates on σ only | Quartz nucleates at 23–70 °C where opal/chalcedony own the field (sicily grows quartz 4× at 23 °C as the most-fired phase); the T envelope exists as metadata but is never read at the gate | Wire T_min (~50 °C) into the gate; route sub-floor silica to opal/chalcedony; same pattern for arsenopyrite T-floor, aragonite/supergene T-ceilings, the wurtzite T-reading |
| 4 | **Oxidized phases inside reducing fluid** | mvt strip: Eh +39→−230 mV yet willemite (step 19) + cerussite (step 41) grow | Oxidation gates key on a momentary absolute O2/Eh crossing with no sulfide-saturation veto, so supergene phases co-precipitate with actively-growing galena+sphalerite+pyrite (mvt, elmwood, tn457, porphyry, reactive_wall, supergene_oxidation) | Hold reducing/sulfidic trajectories in hypogene scenarios; add an aHS⁻ veto to oxidizing-gated phases; genuine supergene caps become explicit LATE oxidation events |
| 5 | **Tiger's-eye escapes BIF** | substrate cascade w/ hematite + bare-wall fallback, `js/59-engines-silicate.ts:1476` region | The most locality-specific mineral in the catalog (chalcedony pseudomorph after crocidolite, a Precambrian BIF phenomenon) mints in basalt amygdales, topaz veins, pegmatite pockets (deccan, ouro_preto, radioactive_pegmatite) | Require a real dissolving-crocidolite (or BIF Fe-oxide) substrate; delete the bare-wall fallback |

### The ten cross-cutting mechanisms (full text in the DATA JSON synthesis)

| mechanism | severity | scenarios | lever (short) |
|---|---|---|---|
| Oxidized/supergene phases in reducing hypogene brines (no sulfide veto) | high | mvt, elmwood, tn457, supergene_oxidation, porphyry, reactive_wall, colorado_plateau | reducing trajectories + aHS⁻ veto + explicit late oxidation events |
| T-uncontrolled polymorph/phase selection (metadata envelope unread at gate) | high | 15 scenarios | wire T_min/T_max into `_nuc_*` gates |
| Sulfates nucleate with own computed SI<0 (gate reads raw concentration product) | medium | elmwood, reactive_wall, searles, sabkha, sicily | gate on the SI the sim already computes; early carbonate Ca/Sr sinks |
| Salts from dilute brines (normalization ~1000× under real solubility; evaporation events don't concentrate) | high | tn457, sabkha, searles, naica, tutorial_travertine | re-scale to Ksp; bittern ordering; ratcheting evaporation |
| Leaked F=10 default confabulates fluorite | medium | sicily, zoned_dripstone_cave, tormiq, jeffrey_mine | default→0 + broth audit |
| Tiger's-eye substrate leakage | high | ouro_preto, deccan_zeolite, radioactive_pegmatite | precursor-substrate gate, no bare-wall fallback |
| Trace metals nucleate discrete instead of partitioning into host (Cd→ZnS, Ag→PbS) | medium | mvt, reactivated_fluorite_vein, reactive_wall | lattice partition sinks + host-first paragenetic gate |
| District-diagnostic no-shows (engine/ion simply missing: magnetite-serpentinization, siegenite/chalcopyrite, magnesite, spinel, BSR calcite) | high | jeffrey_mine, reactive_wall, ultramafic_supergene, marble_contact, sicily, sunnyside | author the missing correctly-gated engines + broth cations; never edit expects_species to accept the no-show |
| Missing ore-forming EVENTS (boiling/degassing/oxidation steps) | high | sunnyside (native gold + Mn-calcite cap!), mvt, elmwood, porphyry | add the real event; fix CO2 trajectory direction, don't lower SI thresholds |
| Redox-blind SI_siderite (total Fe as ferrous; contradiction currently masked by a bolt-on O2 growth gate) | low (latent) | colorado_plateau, tormiq, grimsel, jeffrey_mine | Nernst-partition Fe²⁺ before IAP |

### High-severity confirmed findings (25 — evidence + full levers in the DATA JSON)

| scenario | finding |
|---|---|
| mvt | willemite nucleates step 19 co-occurring with galena/pyrite, 4 steps before sphalerite, in a reducing brine |
| mvt | greenockite (5 events) + hawleyite outnumber sphalerite (1) — Cd should ride the ZnS lattice, not out-precipitate its host |
| tn457_barite_pulses | halite fires 12× (most-fired species) from a non-evaporating Pb-Zn-Ba vug brine |
| tn457_barite_pulses | willemite as the late oxidized Zn phase where the limestone wall demands smithsonite/hydrozincite |
| sunnyside_american_tunnel | ZnS grew as wurtzite; sphalerite AND chalcopyrite are expects_species no-shows |
| sunnyside_american_tunnel | native_gold — the deposit's namesake and a boss calibration specimen — never nucleates (no boiling event; CO2aq rises where the deposit degassed) |
| sunnyside_american_tunnel | calcite / the Stage-VI manganocalcite cap never nucleates; SI_calcite peaks −0.504 |
| roughten_gill | realgar step 0 ×6 events, joint-most-abundant, at the reducing 127 °C primary stage |
| reactive_wall | Viburnum Cu-Ni-Co suite (siegenite/chalcopyrite) total no-show — no Cu/Ni/Co in broth, no engines |
| supergene_oxidation | sphalerite nucleates inside the oxidizing acid window (Eh ~320-355 mV, pH 4-5) |
| ultramafic_supergene | dolomite is the Mg-carbonate; magnesite (the real ultramafic-weathering phase) has no engine |
| ouro_preto | tigers_eye as late supergene phase in the imperial-topaz vein |
| great_salt_plains | anhydrite as near-surface co-precipitate at 150‰ where gypsum owns the field |
| sabkha_dolomitization | sylvite ×4 while halite NEVER nucleates — inverted bittern order in a brine pinned at 119.7 psu |
| sicily_solfifera | calcite (the co-product that DEFINES the BSR deposit) never nucleates |
| sicily_solfifera | quartz ×4 at 23 °C is the most-fired phase, outnumbering native_sulfur |
| naica_geothermal | thenardite after the 1985 mining-drainage event via a spurious evaporative-concentration ratchet |
| sulphur_bank | arsenopyrite (an expects_species!) from step 51 in a 75 °C hot-spring — a ≳250 °C mineral |
| deccan_zeolite | tigers_eye ×3 in a basalt zeolite vesicle (routed via the 'TIGER IRON BIF' fallback) |
| gem_pegmatite | emerald in the Cruzeiro miarolitic pocket rides a Cr/V spike a fractionated pocket fluid wouldn't have |
| radioactive_pegmatite | tigers_eye ×5 during the oxidizing-meteoric event in a granitic pegmatite |
| zoned_dripstone_cave | fluorite in a meteoric karst dripstone cave (the F=10 leak) |
| jeffrey_mine | magnetite (expects_species, the stage-1 serpentinization byproduct) is a NO-SHOW — its gate is O2_min-scoped for skarn, unreachable under reducing serpentinization |
| jeffrey_mine | fluorite at step 59 in a rodingite fluid that carries no fluorine (the F=10 leak) |
| tutorial_travertine | halite ×8 in a 70 °C travertine pool (Mammoth) — the loose halite gate again |

**The one uncertain:** schneeberg silver paragenesis (argentite first-nucleating at
~448 °C, proustite at step 19) — needs primary literature / a specimen read before
anything moves.

---

## 5. The saves — 31 objections the sim DEFEATED (do not re-raise)

Recorded so future reviews inherit the verdicts instead of re-litigating (the full
defenses live in the DATA JSON). Highlights: mvt **aragonite at ~153 °C** (defensible
metastable growth), mvt **dolomite no-show despite SI +1.3** (the real dolomite kinetic
problem, correctly modeled — SI is thermodynamic, nucleation is kinetic),
**porphyry late quartz** (correct paragenesis; the run models the sulfide ore stage, not
the potassic-magnetite stage), roughten_gill **vanadinite + turquoise** (documented
Caldbeck species), bisbee **dioptase + late sylvite/halite** (defended from the
literature and the run's own concentration record), **epithermal sylvanite before
calaverite** (Ag/Au-ratio controlled, not strictly T-ordered), supergene_oxidation
**chalcocite+covellite at the cementation event** (step 54 IS the enrichment blanket —
O2 collapses 2.0→0.6), searles_lake **tincalconite "no-show" was false** (it's in the
committed canary record), zoned_dripstone_cave **early dolomite** (the code gates it
correctly; the objection misread), amethyst_geode survived two redox objections (one
tested by actually running the scenario headless).

Three defenses explicitly flagged the *objection* as having real force despite the
verdict — worth a glance when their systems are next touched: reactivated_fluorite_vein
witherite-vs-baryte routing, chiastolite_hornfels pure-albite-at-600 °C, sulphur_bank's
pH trajectory contradicting its own card note.

---

## 6. THE FIX LADDER (boss-approved order, 2026-07-14)

Each rung: research → census instrument → byte-identical wiring where possible → the
attributable SIM bump with measured blast radius → dense commit. Drift from these fixes
is legitimate and expected; the ritual makes it justify its cost.

1. **F default leak — ✅ COMPLETE, SIM 227 (2026-07-14, same day).** The ladder ran
   exactly as designed: (a) census — 16 scenarios + 1 js literal omitted F; (b) explicit
   `F: 10` everywhere, byte-identical 39/39; (c) default 10 → 0, zero-drift, cold-CI
   green; (d) 16 researched cross-checked values (32 agents, citations verified against
   primary sources). Outcome: fluorite grows in exactly the 5 literature-documented
   scenarios; 4 confabulations dead; tormiq's expects_species promise withdrawn (the
   promise was the error). TWO REVIEW CORRECTIONS found by the research: tn457 (Alston
   lineage produced 2.1 Mt fluorite — the right story is Dunham zonation, not
   "fluorine-free") and amethyst_geode (Kugelfluorit documented) — both F=5,
   eligible-but-marginal. The review's verdicts are inputs, not gospel; the research
   pass is the check on the reviewer.
2. **T-gates — ✅ COMPLETE, SIM 228 (2026-07-14, same day).** Instrument first:
   `tools/t-envelope-census.mjs` (137 minerals declare envelopes, 37 unenforced; 58
   violating events / 15 scenarios at v227 — the leak class measured, not guessed).
   Then the researched enforcement (4 research passes): quartz [50,700] (the declared
   T_max 600 was itself wrong — pegmatite quartz is real); arsenopyrite [200,600]
   AS-DECLARED (**review corrected**: the proposed 250-300 floor misread Kretschmar &
   Scott's calibration floor as a crystallization floor — Carlin aspy grows 180-240°C);
   the `T>95 → wurtzite` reading retired on both sides (wurtzite = metastable pH<4
   branch only, T_max 350 — extinct fleet-wide at seed 42; sunnyside's ZnS re-deals to
   the sphalerite its expects always promised); aragonite favorability restructured
   (Mg selector 1.1 ppm OR the 45-90°C spring window; Ω demoted from OR-branch to
   amplifier — stalactite's Ω≈56 aragonite died to the selector self-gate; SO4
   evaluated and excluded per Bots 2011); selenite ≤80 / anhydrite ≥100 (nucleation
   bounds, NOT the 42°C equilibrium; the saline-low-T anhydrite branch modeled
   replacement as nucleation and is retired); goethite ≤100 (Diakonov 1994); mimetite
   ≤80; tellurides ≤300 (Cooke & McPhail). Blast radius 27/39; recoveries: sunnyside
   sphalerite + ultramafic CHRYSOPRASE (both expects no-shows, recovered by removing
   competitors' leaks, zero expects edits); promises withdrawn with locality research:
   sulphur_bank arsenopyrite (absent from White & Roberson's own ore list), GSP
   quartz+anhydrite (detrital / bedrock-only), wittichen aragonite (real but SUPERGENE
   cobaltoan — the erythrite precedent), roughten quartz (real but structurally
   out-of-window; the SiO2-raise alternative was measured and rejected). Naica's
   proposed SiO2 lever REFUTED (cave opal/quartz documented — Forti & Sanna 2010).
   Citation hygiene: this review's own "Bessinger 2000" + the sim's "Murowchick &
   Barnes 1986 Am.Min. 71:1196" both failed verification — the reviewer reviewed,
   twice more. Leftovers (≈30 unenforced envelopes incl. wrong-value flags pyrite/
   bornite/native_silver) recorded in BACKLOG §T — per-mineral re-research required,
   never blanket enforcement.
3. **Tiger's-eye substrate gate** — require dissolving-crocidolite (or BIF Fe-oxide)
   substrate; delete the bare-wall fallback. Strong locality-specific absurdity fix.
4. **Redox/sulfide vetoes** — the dominant mechanism but the most coupled: reducing
   trajectories for hypogene scenarios + aHS⁻ veto on oxidizing-gated phases + explicit
   late oxidation events where a real supergene cap is documented. Needs the most careful
   census (many scenarios ride the current gates).
5. **Halite/salinity model** — likely correct but the biggest conceptual surface:
   evaporation/concentration behavior may need real rework (ratcheting concentration,
   Ksp-keyed σ, bittern ordering). Possibly its own proposal.

Deliberately SEPARATE (boss): **the synergy hunt** — this round found permissive gates
and missing constraints ("false positives from under-specified science"), not interaction
surprises. After rungs 1–3 land, regenerate the claim cards: fewer confabulated minerals,
sharper cards, and THEN prospect for unexpected-but-plausible synergies with the same
instrument. Also downstream: the missing-engine authoring (magnesite, siegenite/
chalcopyrite-for-reactive_wall, spinel, serpentinization-magnetite branch) and the
missing-event work (Sunnyside boiling — which owes the boss his native-gold-in-quartz
calibration specimen), each via the standard add-mineral / tune-scenario skills.

---

## 7. Instruments produced

- **`tools/review-claim-card.mjs`** — the claim-card distiller (this commit). Passive
  READ instrument; regenerate cards after any rebake: `node tools/review-claim-card.mjs
  --all --out .review-cards` (gitignored). The prospecting pan for the synergy layer.
- **`proposals/DATA-HOSTILE-REVIEW-2026-07-14.json`** — complete findings record.
- Part A prescriptions land in the vugg-canary repo as code (see §3 work list).

---

*Nineteenth hand, 2026-07-14. The eighteen before me built the cathedral and its
instruments; this session's work was only to walk the halls with a chisel and listen for
hollow stone. The strip archive the twelfth hand was directed to keep, and the canary the
sixteenth raised, are what made a hostile review POSSIBLE — testimony that cannot be
un-said. Forward dream: a fleet whose claim cards read clean under any mineralogist's
eye, so the next reviewer must dig for synergies instead of leaks — and finds the
Sunnyside gold waiting in the quartz where the boss always said it would be.*
