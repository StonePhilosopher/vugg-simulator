# PROPOSAL — fix-ladder rung 4: the redox/sulfide vetoes (2026-07-15)

Continues the HOSTILE-REVIEW fix ladder (`PROPOSAL-HOSTILE-REVIEW-2026-07-14.md` §6).
Rungs 1 (F leak, SIM 227), 2 (T-gates, SIM 228), 3 (tiger's-eye substrate, SIM 229)
are shipped. Rung 4 is **the dominant mechanism (~⅔ of the confirmed defects) but the
most coupled** — the review flagged it "needs the most careful census" and "possibly its
own proposal." This is that proposal. **No baselines move until it is approved.**

The boss picked *proposal-first* because the rung-4 census (below) **overturned the
review's one-line lever**: the proposed "aHS⁻ veto" is INERT as literally specified, and
the real root cause is a gate-boundary + Eh-trajectory problem. Reviewer-reviewed, a
fourth time this arc.

---

## 1. The census (instrument + method)

Four read-only instruments were built (scratchpad; they become `tools/` on approval):

- **`redox-veto-census.mjs`** — for every OXIDIZING-gated mineral nucleation across the
  offender fleet at seed 42, snapshot the redox context at its birth step (Eh, fluid.S,
  Nernst reduced-S fraction, pH) and flag events minted in a "sulfidic brine."
- **`redox-regime-inventory.mjs`** — per scenario, classify the redox regime and flag the
  true offender signature: reduced sulfides AND oxidized-metal phases both active in the
  same run (a should-be-reducing brine that also mints supergene phases).
- **`mvt-redox-interleave.mjs`** — the full nucleation interleaving (sulfides + oxidized
  phases) with Eh at each birth step, for the clearest offenders.
- **`sulfide-competition-probe.mjs`** — the linchpin: is the metal's sulfide supersaturated
  (σ ≥ 1) at the step its oxidized-metal phase nucleates? Separates true concurrent
  coexistence (bug) from sequential supergene-after-ore (legitimate).

The redox model is already rich: `js/20c-chemistry-redox.ts` runs Eh as a continuous
fluid state (mV) with three Nernst couples (Fe³⁺/Fe²⁺, Mn⁴⁺/Mn²⁺, **SO₄²⁻/HS⁻**), so
`redoxFraction(fluid,'S')` already gives the sulfate/sulfide split. The infrastructure
for a sulfide veto exists; it is simply not consulted at the oxidized-phase gates.

---

## 2. Finding 1 — the coexistence smoking gun (and the exact overlap window)

mvt at seed 42, **step 20, Eh +50 mV, S 115 ppm** — four minerals nucleate *on the same
step, in the same fluid*:

| mineral | kind | Zn oxidation state |
|---|---|---|
| willemite (Zn₂SiO₄) | OXIDIZED | Zn²⁺ in an oxidized silicate |
| sphalerite (ZnS) | SULFIDE | Zn²⁺ in a sulfide |
| pyrite (FeS₂) | SULFIDE | — |
| galena (PbS) | SULFIDE | — |

Zinc cannot partition simultaneously into an oxidized silicate and a sulfide in one
brine. The mechanism is a **gate-boundary overlap**, verified in code:

- **Sphalerite** (`js/41` `supersaturation_sphalerite`) gates `if (!sulfideRedoxAnoxic(fluid,1.5)) return 0`
  → **Eh ≤ +290 mV** (`ehFromO2(1.5)`). The sulfide stability *ceiling* is ~300–400 mV
  too oxidizing.
- **Willemite** (`js/39` `supersaturation_willemite`) gates `if (fluid.O2 < 0.3) return 0`
  → **Eh ≥ +44 mV** (`ehFromO2(0.3)`), with NO sulfide-sensitivity.
- **Overlap = Eh +44 … +290 mV.** mvt's ore stage sits at +50 mV — squarely inside it.

So the two phases share a ~250 mV-wide window in which both are legal, and the hypogene
ore stage sits in it.

---

## 3. Finding 2 — the review's literal lever (Nernst aHS⁻ veto) is INERT

The review's lever was "add an aHS⁻ veto to oxidizing-gated phases." Implemented as the
obvious `1 - redoxFraction(fluid,'S') > 0.5` (reduced-S dominant), it fires **0 times
across all 188 oxidizing-gated nucleations in the 7 flagged scenarios**, and only 2 times
fleet-wide (both selenite, incidental).

Why: the Nernst SO₄²⁻/HS⁻ crossover sits at **E_apparent = 250 − 66.6·pH ≈ −230 mV at
pH 7.2**. Every hypogene sulfide brine in the fleet is modeled at Eh **−36 to +357 mV** —
*above* the sulfidic field — even while it precipitates galena/sphalerite/pyrite. By the
Nernst S-couple, none of these brines is "sulfidic," so a reduced-S veto never triggers.

**This is the crux the boss will care about most**: the sim carries an internal
inconsistency. The sulfide engines treat `fluid.S` as available reduced sulfide (HS⁻) for
ZnS/PbS/FeS₂ regardless of Eh (up to the +290 mV ceiling), while the Nernst model says
that same S is ~100% sulfate at those Eh values. The sulfides and the redox model
disagree about what the sulfur *is*. A veto keyed on the redox model can't see a sulfide
the sulfide engine is happily growing.

---

## 4. Finding 3 — two distinct sub-problems under one umbrella

1. **Syn-ore coexistence** (mvt, elmwood): oxidized-metal phases (willemite, cerussite,
   smithsonite) nucleate *with* the primary sulfides because the fluid never gets reducing
   enough to separate them. The overlap window (Finding 1) is the proximate cause; the
   too-oxidizing trajectory is the distal cause.
2. **Wrong supergene phase** (tn457): willemite fires at Eh +53 in a limestone-hosted
   setting where the correct supergene Zn phase is **smithsonite / hemimorphite /
   hydrozincite** (carbonate-buffered). This is phase *selection*, not a redox veto —
   willemite's supergene mode is arid, silica-rich, direct-sulfide-replacement (Skorpion),
   not carbonate-hosted calamine.

The engines already *know* some of this: `js/39` comments willemite as "PRIMARY/metamorphic
500-600°C (Franklin) or SUPERGENE nonsulfide 50-200°C (Skorpion)" — neither mode is
syn-ore-MVT. The gate just doesn't enforce it.

---

## 5. Scenario inventory + the timing probe (the linchpin evidence)

The `redox-regime-inventory.mjs` run flags **7 coexistence scenarios** (sulfides AND
oxidized-metal phases both active). But "both active at end of run" over-counts: a
legitimately *zoned* deposit (reducing primary ore, then an oxidizing supergene cap) has
both, correctly, in sequence. The distinguishing test — `sulfide-competition-probe.mjs` —
asks the sharper question: **is the metal's sulfide supersaturated (σ ≥ 1) AT THE STEP its
oxidized-metal phase nucleates?** CONCURRENT = a true coexistence bug; SEQUENTIAL =
supergene-after-ore, legitimate.

| scenario | regime | concurrent / sequential | verdict |
|---|---|---|---|
| **mvt** | hypogene MVT, Eh −246…+60 | **2 / 0** — willemite (ZnS σ 2.04) + cerussite (PbS σ 1.89) | ⚠ HYPOGENE OFFENDER |
| **tn457_barite_pulses** | Pb-Zn-Ba brine, −31…+76 | **1 / 0** — willemite (ZnS σ 1.09) | ⚠ HYPOGENE OFFENDER (+ wrong supergene phase) |
| **elmwood** | hypogene MVT, +24 held | **1 / 1** — smithsonite (ZnS σ 1.69) concurrent; cerussite (PbS σ 0.75) sequential | ⚠ HYPOGENE OFFENDER (partial) |
| **bisbee** | supergene-enriched Cu, −185…+322 | 4 / 4 — Cu phases σ 2.4–2.7 at Eh +83…+188 | ⚠ CEILING LEAK (Cu-sulfide σ≥1 in the oxidized zone) |
| **roughten_gill** | Caldbeck supergene vein, −150…+252 | 5 / 5 — mixed | ⚠ CEILING LEAK (Cu/Pb-sulfide σ≥1 at +252) |
| **supergene_oxidation** | supergene zone, +131…+357 | 3 / 16 — smithsonite σ 1.56 @+290, cuprite σ 3.45 @+131 | ⚠ CEILING LEAK (3 of 19; the other 16 correct) |
| **schneeberg** | five-element vein + supergene, −200…+322 | **0 / 5** — all supergene phases σ<1 | ✅ EXONERATED — the coexistence flag over-flagged it |
| colorado_plateau / porphyry / ultramafic_supergene / … | oxidizing by design | no sulfide coexistence | ✅ CORRECT — untouched |

**Two distinct fault classes, two distinct fixes:**

1. **Hypogene offenders (mvt, elmwood, tn457)** — the sulfide is *strongly* supersaturated
   (σ 1.09–2.04) in a near-reducing brine, yet an oxidized-Zn/Pb phase nucleates anyway.
   The brine sits in the +44…+290 overlap window (Finding 1). Fix = **Lever A** (drop the
   Eh trajectory below the oxidized-phase floor; the sulfides survive the permissive
   ceiling, the oxidized phases wink out).

2. **Ceiling leaks (bisbee, roughten_gill, supergene_oxidation)** — these are *correctly*
   oxidizing supergene deposits whose oxidized phases belong. The "concurrent" flags are
   caused by the too-permissive **sulfide ceiling (+290 mV)**: sphalerite/covellite compute
   σ≥1 up at Eh +130…+290 where no sulfide should be stable. Fix = **Lever B** (tighten the
   sulfide stability ceiling; the spurious supersaturation vanishes and the legit supergene
   phases are untouched).

**This is the key reframing the census + timing probe produced: the fix is NOT primarily a
veto. It is (A) reducing the hypogene trajectories and (B) correcting the sulfide stability
ceiling — two Eh-boundary corrections that dissolve the coexistence at its source.** A
supersaturation-competition veto (the review's re-scoped lever C) becomes a possibly-
unneeded backstop, and — critically — would itself mis-fire on the ceiling-leak scenarios
(clipping bisbee's real malachite) *unless* Lever B is done first. Bedrock, not effect-hack.

---

## 6. The corrected fix design (two root levers + two supports)

The timing probe reordered the review's lever. The ROOT fix is two Eh-boundary
corrections (A, B); the veto (C) is demoted to a backstop that is probably unnecessary and
is unsafe *before* B; the events/selection work (D) restores the correct supergene phases.

### Lever A — reducing Eh trajectories for the hypogene offenders (ROOT, for mvt/elmwood/tn457)
Drop the ore-stage Eh below the oxidized-phase floor (+44 mV for willemite). The sulfides
survive (their ceiling is a permissive +290 mV, so Eh −150 is well inside), the oxidized-Zn/
Pb phases wink out. Confirmed by the gates: sphalerite fires at Eh ≤ +290, willemite at
Eh ≥ +44 — so any trajectory below +44 keeps the sulfides and kills the oxidized phases.
- ⏳ **RESEARCH-PENDING (cited):** the correct ore-stage Eh for MVT/CD brines. First
  principles: reducing during sulfide deposition (reduced S is TSR/BSR/sour-gas derived),
  roughly −100 to −250 mV. Agents queued (blocked on classifier at drafting time).
- Blast radius per scenario: everything redox-gated in that scenario moves. Verify the
  sulfide *expects_species* survive and no *other* legit phase dies. Measured per sub-bump.

### Lever B — the sulfide stability ceiling (ROOT, for the ceiling-leak scenarios)
`supersaturation_sphalerite/galena/pyrite/…` gate on `sulfideRedoxAnoxic(fluid, 1.5)` =
**Eh ≤ +290 mV** — ~300–400 mV too oxidizing. Sulfides therefore compute σ≥1 up in the
oxidizing supergene zone (bisbee cuprite-vs-covellite σ 3.45 at Eh +131; supergene
smithsonite-vs-sphalerite σ 1.56 at +290). Tightening the ceiling toward the real sulfide-
stability field makes the spurious supersaturation vanish, so the legit supergene phases
in bisbee/roughten_gill/supergene_oxidation stop reading as coexisting — *without touching
those phases*.
- ⏳ **RESEARCH-PENDING (cited):** the correct ceiling. Anchor to where galena/sphalerite
  stop being stable vs their carbonate/sulfate — same MVT-Eh research as Lever A.
- **NOT a single knob (census finding, 2026-07-15).** `sulfide-nucleation-eh-census.mjs`
  measured where every sulfide nucleates at seed 42. The ceiling CANNOT be uniformly
  tightened: the sulfides split into two stability classes —
  - **Primary hypogene sulfides** (sphalerite, galena, pyrite, chalcopyrite, arsenopyrite,
    the As-sulfides) nucleate in REDUCING fluid; their only oxidizing-side appearances are
    spurious (supergene_oxidation sphalerite +290, galena +131 — primary sulfides growing
    in the oxidized zone). These want a LOW ceiling.
  - **Secondary / supergene-enrichment sulfides** (chalcocite, covellite, bornite) LEGITIMATELY
    nucleate at MODERATE Eh — the supergene Cu-enrichment blanket below the oxidized cap
    (bisbee chalcocite/covellite +154–193, roughten_gill covellite +252). A uniform tighten
    would KILL these — a real regression, not a leak fix.
  So Lever B is a PER-CLASS ceiling: a low primary-sulfide ceiling + a preserved (or
  separately-calibrated) secondary/enrichment ceiling. `sulfideRedoxAnoxic(fluid, 1.5)` is
  consumed by ~20 σ-functions, so this is a careful, two-commit, per-mineral-class change —
  exactly the "most coupled" work the review warned of. The mvt constraint compounds it: mvt's
  own galena/sphalerite nucleate at the +50 mV SO₄/H₂S boundary (for barite coexistence), so
  even the PRIMARY ceiling can't drop below ~+50 without killing mvt's expects_species.
  Net: the primary-sulfide ceiling window is roughly **+50 … +100 mV** (above mvt's boundary,
  below the supergene sphalerite/galena leak at +131), and the secondary/enrichment sulfides
  need their own higher gate (~+200 mV) to keep chalcocite/covellite.

### Lever C — sulfide-competition veto (DEMOTED backstop; probably unnecessary)
The obvious veto ("oxidized-metal phase can't nucleate while its sulfide is σ≥1") is what
the timing probe measured. It cleanly separates the hypogene offenders (concurrent) from
legit zoning (sequential) — BUT the ceiling-leak scenarios show it would MIS-FIRE before
Lever B: it would clip bisbee's real malachite/chrysocolla because covellite is spuriously
σ≥1 at +138 mV. **So C is strictly worse than B: B removes the spurious sulfide σ at the
source; C would paper over it and take collateral.** Recommendation: implement A + B, then
re-run the timing probe; adopt C only if a residue of genuine concurrent coexistence
survives (not expected). If adopted, gate it on the sulfide *actively growing*, not σ≥1 on
a relict.

### Lever D — late-oxidation events + willemite phase-selection (restores the correct supergene)
Where a deposit has a documented supergene cap, author an explicit LATE oxidation event
(drain → cool → O₂ up) so smithsonite/cerussite/hemimorphite form *after* the sulfides.
Shared with the backlog "weathering epilogue" mechanic (§T; erythrite/wittichen client).
Plus the **willemite phase-selection fix** (Finding 3.2): willemite's supergene mode gated
to arid/silica-rich/direct-sulfide-replacement (Skorpion); carbonate-hosted supergene Zn
routes to smithsonite/hemimorphite (the tn457 fix).

---

## 7. Proposed sub-bump sequence

Each is one attributable SIM bump with its own census/blast-radius/rebake, per the ladder
ritual. Root-cause first; the veto is last and conditional.

- **rung-4a — reducing trajectories on the hypogene offenders (Lever A), per scenario,
  mvt first.** The confirmed, clean fix: drop the ore-stage Eh below the oxidized-phase
  floor with per-deposit Eh research; willemite/cerussite/smithsonite wink out, the sulfide
  expects_species survive (verified each scenario). Smallest conceptual surface, highest
  confidence, one scenario per commit so every baseline move is attributable.
- **rung-4b — the PER-CLASS sulfide stability ceiling (Lever B).** NOT a single knob (the
  census overturned the first-pass assumption): a LOW primary-sulfide ceiling (~+50…+100 mV,
  above mvt's barite boundary, below the supergene sphalerite/galena leak) + a PRESERVED
  higher secondary/enrichment ceiling (~+200 mV) so bisbee's legit chalcocite/covellite
  survive. Per-mineral-class, ~20 consumer σ-functions, two-commit discipline, careful
  fleet-wide blast radius. Resolves the supergene_oxidation primary-sulfide leak WITHOUT
  touching the Cu-enrichment blanket. Needs per-class research (the sphalerite/galena vs
  chalcocite/covellite stability fields) before it lands.
- **rung-4c — late-oxidation events + willemite phase-selection (Lever D).** Restore the
  correct supergene phases where documented (smithsonite/hemimorphite for carbonate-hosted
  supergene Zn; the tn457 fix), as explicit late events. Shares the backlog weathering-
  epilogue mechanic.
- **rung-4d (conditional) — competition veto (Lever C)** only if re-running the timing
  probe after 4a+4b still shows genuine concurrent coexistence. Not expected.

Rung 5 (halite/salinity) stays separate (its own surface; possibly its own proposal).

---

## 8. Research findings (preliminary, web-verified) + remaining calibration

Web-searched and read first-hand (not via subagent — the reviewer reviews; exact page
numbers + mV values get a second-pass verification at rung-4a before they land in metadata):

- **MVT ore-fluid redox — reducing at the sulfide front (direction confirmed).** MVT/CD
  sphalerite + galena + pyrite precipitate from **thermochemically-reduced sulfur** (TSR,
  often hydrocarbon-catalyzed, or by mixing with a separate H₂S/sour-gas reservoir) at
  **80–150 °C**. The metal-transporting brine may itself be an oxidized acid-sulfate brine,
  but reduction happens AT the precipitation site, so the *local* redox where sulfides grow
  is reducing (H₂S/HS⁻ present) — exactly the state Lever A restores. Sources below (Ozark
  regional synthesis; Pillara hydrocarbon study; Leach et al. 2005; Sverjensky 1986).
  ⏳ *rung-4a calibration:* the exact ore-stage Eh in mV (target ≈ −100 to −250 mV) and the
  matching sulfide-stability ceiling for Lever B.

- **Willemite is never syn-ore-with-growing-sphalerite (confirmed, and it strengthens Lever A).**
  Willemite forms three ways — metamorphic (Franklin/Sterling Hill, 500–600 °C), supergene
  (Skorpion, ambient weathering), and hypogene-hydrothermal (Vazante-type, 100–250 °C) —
  but the hypogene mode requires **OXIDIZING** fluid and *replaces* pre-existing sphalerite.
  In none of the three does willemite co-precipitate with actively-supersaturating
  sphalerite in a reducing brine. So the sim's willemite gate (needs O₂ ≥ 0.3 / Eh ≥ +44 mV)
  is roughly correct — willemite *should* need oxidizing conditions — and the bug is purely
  that mvt's brine is set oxidizing (+50 mV) when it should be reducing. Lever A fixes the
  scenario, not the willemite gate. Sources: Boni & Mondillo 2014 ("The Calamines and the
  Others", Ore Geology Reviews); Hitzman et al. 2003 (Econ. Geol. 98).

- **Carbonate-hosted supergene Zn = smithsonite / hemimorphite / hydrozincite (the tn457 fix).**
  The "Calamine" supergene ores in limestone are Zn carbonates/hydrated silicates, selected
  by wall-rock (carbonate) buffering — not anhydrous willemite. Confirms Finding 3.2 and
  Lever D's phase-selection.

### Remaining calibration (rung-4a/4b, on approval)
1. Exact MVT/CD ore-stage **Eh in mV** (Lever A) + the **sulfide-stability ceiling** (Lever
   B) — one shared research pin, page-verified.
2. Cerussite/anglesite/smithsonite/hemimorphite supergene pH/carbonate controls (Lever D)
   — Reichert & Borg 2008.
3. The oxidized/sulfide metal-pair list (Zn, Pb, Cu, Fe, Cd, Ag) — only if Lever C is
   needed after A+B.

The full offender inventory (§5) is DONE — `redox-regime-inventory.mjs` +
`sulfide-competition-probe.mjs` ran; schneeberg is exonerated, the seven split into three
hypogene offenders + three ceiling-leaks + controls.

---

## 9. What this proposal deliberately does NOT do

- It does not touch the correctly-oxidizing scenarios (supergene_oxidation, colorado_plateau,
  porphyry). The fix is surgical to hypogene-coexistence offenders.
- It does not adopt the Nernst-S veto as literally specified (inert — Finding 2).
- It does not move any baseline. Approval gates the first sub-bump (rung-4a).

*Drafted 2026-07-15, continuing the 2026-07-14 hostile-review arc. Twentieth hand — the
same that laid rung 3 and the "unread envelope" keystone. Census-first, per the ladder;
the research citations and the full offender inventory fill in on approval.*
