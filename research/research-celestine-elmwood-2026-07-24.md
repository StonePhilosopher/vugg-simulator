# Research — the Elmwood celestine blanket (the S2 celestine tranche)

2026-07-24. Boss GO: "lets start on celestine... following the science will likely involve
doing more research." This note is that research + the seed-42 census that reshaped the
tranche. Companion to the S1 record (`aeff2fb`) and the S-split proposal
(`PROPOSAL-FLUID-S-SPLIT-2026-07-17.md`).

## 1. What the rock says

- **The boss's specimen (#103941, Elmwood):** "the celestine formation is fibrous and
  white, and seemingly holds the specimen together like a glue" — a late BINDING phase
  spread between/under the calcite + fluorite + galena, not discrete crystals.
- **mindat, Elmwood locality (boss-surfaced):** "Barium-bearing Celestine,
  (Sr,Ba)SO₄ — habit: FIBROUS, colour: white — initially identified as anglesite."
  Photos: silky radiating fibrous sprays, white-to-cream cauliflower/nodular masses ON
  sphalerite, tiny white spherules dusted over fibrous sprays. Associated (photo data):
  sphalerite 7, baryte 6 (incl. Sr-bearing baryte var.), calcite 3.
- **Jensen, Mineralogical Record (1996)** documents barian celestine at the Elmwood
  deposit (the locality's reference citation; via mindat's reference list).
- **Timing:** mindat notes pockets of "calcite on barian celestine" (2017 finds) → the
  celestine is pre/syn the late calcite stage; the specimen's "glue on the bottom" reads
  the same. LATE, after the main sulfide+fluorite ore stage, around the carbonate stage.

## 2. What the literature says

**Hanor, J.S. (2000) "Barite–Celestine Geochemistry and Environments of Formation."
Reviews in Mineralogy & Geochemistry 40:193–275** — the canonical review.
- Barite–celestine is a COMPLETE solid solution; natural intermediates are RARE and
  typically strongly zoned rather than homogeneous (experimental precipitation of
  intermediates 18–185 °C). "Barian celestine" / "barytocelestine" = the Sr-dominant
  intermediates. The sim's ba_ratio > 0.25 note-threshold is comfortably inside this.
- **The Sr source for carbonate-hosted celestine is the host carbonate itself:**
  aragonite (~7,000–10,000 ppm Sr) converting to low-Sr calcite, and dolomitization of
  Sr-bearing limestone, EXPEL Sr into pore brines; celestine precipitates where those
  Sr-charged brines meet sulfate. The largest celestine deposits are diagenetic
  replacements + open-space fill in carbonate-evaporite sequences. This is exactly
  Elmwood's setting (Ordovician Stones River / Knox carbonates, MVT district).

**Fibrous habit — two mechanisms in the literature, only one fits:**
- *Antitaxial/crack-seal fibrous veins* (satin-spar gypsum model; Bons & Montenari and
  the fibrous-vein literature): fibers grow in a CONFINED opening crack, no growth
  competition, growth tracks dilation. WRONG mechanism here — Elmwood celestine coats
  OPEN cavity surfaces.
- *Spherulitic / radiating-fibrous growth on open surfaces* (Sunagawa, "Crystals:
  Growth, Morphology and Perfection"; Gránásy et al. 2005 "Growth and Form of
  Spherulites"): growth-front branching/splitting produces radial fibrous aggregates;
  IMPURITY co-ions (notably divalent foreign cations) promote the branching — the
  growth front splits because the incorporated foreign ion strains the lattice and
  poisons straight-front propagation. **The Ba²⁺ co-ion IS that impurity**: Elmwood's
  celestine grows from a Ba-bearing fluid (the sim's own zone notes already read
  "Ba-substituted (barytocelestine intermediate)"), and the mindat record ties the
  fibrous habit to exactly the Ba-bearing variety. Same conceptual family as the sim's
  existing O5 impurity-poisoning bedrock (DeYoreo σ*(φ)) — an impurity re-shaping the
  growth mode.

## 3. What the sim says (seed-42 census, 2026-07-24, live-browser per-step probe)

Method: fresh elmwood seed 42; each step record (T, Sr, Ba, S, sulfateAvailablePpm,
σ_celestine raw, σ_celestine with S swapped to the sulfate pool) — the S0-census swap
method applied to celestine.

| window | T °C | Sr | Ba | S raw | S sulfate-pool | σ raw | σ split |
|---|---|---|---|---|---|---|---|
| steps 1–73 | 120→100 | 10 | 18→28 | 100–117 | 44–52 | **0.90** (sub-1 plateau) | 0.40–0.43 |
| steps 74–98 | 100→88 | 10 | 28 | 93–106 | 42–48 | **1.00–1.08** (the only live window) | 0.44–0.51 |
| steps 99–200 | 88→53 | 10 | 28 | 68–93 | 31–42 | 0.73–0.99 | 0.33–0.44 |

- The live window opens at step 74 BECAUSE the vein cools through 100 °C (the engine's
  T<100 ×1.2 low-T factor) — geologically right-shaped (late, cool). The two celestines
  nucleate at steps 86/88, grow ~1 µm/step on σ-excess ≤0.08, total 8.3/7.6 µm. Dust.
- **Sr is flat at 10 ppm the whole run** → sr_f = 10/15 = 0.67. The scenario has NO Sr
  event; the broth's initial Sr is the entire supply. THIS is the real starvation.
- **S2 preview: σ_split peaks at 0.51 → celestine goes EXTINCT under the migration**
  (sulfate fraction ≈ 0.44 of total S in elmwood's mildly-reducing broth). A bare
  barite-style re-anchor (÷40 → ≈÷18) restores only the status quo: 8 µm specks.
- Ba-ratio: 28/10 = 2.8 ≫ the 0.25 barytocelestine threshold for the whole run (with a
  late Sr release to ~30, ratio ≈ 0.9 — still comfortably fibrous-territory).

## 4. The reframe (the census steered the fix shape — again)

The original diversions design ("fibrous gate + blanket render") treated the SIZE as a
rendering problem. The census says otherwise: **celestine is Sr-starved by scenario
omission, and S2 kills it outright.** The literature supplies the missing mechanism —
the host carbonates' own diagenetic Sr. So the tranche gains a part the original design
didn't have:

**The late Sr release event (elmwood scenario).** Geologically: the vug's carbonate
walls (aragonitic/Sr-rich limestone recrystallizing to calcite + dolomitizing) expel Sr
into the cooling pore brine during the late carbonate stage — Hanor's canonical
mechanism, in the deposit class where it's textbook. Sim shape: a declared
`elmwood_diagenetic_sr` event in the late stage (around/before the T<100 window opens)
lifting fluid.Sr 10 → ~30–40. NOT a free sulfate pulse (the no-meteoric-pulse rule is
untouched — S is not moved); the same declared-influx pattern as wittichen's
meteoric_sulfate but for a DIFFERENT element with direct literature support. sr_f then
reads 2.0 (capped) instead of 0.67 → the late window carries an honest fibrous mass
instead of dust.

## 5. The S2 celestine tranche (revised, one commit, 5 parts)

1. **Migrate** supersaturation_celestine to sulfateAvailablePpm.
2. **Re-anchor** s_f ÷40 → measured (≈÷18; census: sulfate fraction 0.44) — same
   "calibrated against pre-split effective sulfate" framing as barite's ÷20.
3. **Late Sr release event** in the elmwood scenario (Hanor mechanism, §4) — the food.
   Boss sign-off needed (scenario edit).
4. **Ba-fibrous habit gate**: ba_ratio > 0.25 → 'fibrous' (radiating fibrous white;
   the barytocelestine note already fires there). KEEP the Sicilian S>200 fibrous
   branch (real for sicily_solfifera). Grounding: mindat's fibrous Ba-bearing Elmwood
   celestine + the impurity-branching mechanism (§2).
5. **Druzy-blanket render**: fibrous celestine as a spreading white carpet between
   crystals (the "glue") — cluster-carpet/lateral treatment via the chalcedony
   botryoidal + _druzyClusterSpec machinery, not discrete needles.

Acceptance: elmwood celestine reads as a white fibrous blanket at the late stage;
sicily's fibrous celestine unregressed; madagascar-nodular + Lake-Erie-bladed branches
unregressed; no other scenario births celestine (Sr stays scenario-local).

## 6. Open questions for the boss

- **The Sr event** — approve the scenario edit? (It's the load-bearing part; without it
  the tranche just preserves dust more honestly.)
- Magnitude taste: Sr → 30 (sr_f 2.0, capped) is the minimal honest lift; the fibrous
  mass size then rides the growth window (~25 steps × the re-anchored rate).
- Does celestine's blanket belong VISIBLY under/around the late calcite (the specimen's
  read), i.e. should the render treatment prioritize wall-contact spread over height?

*Sources: Hanor 2000 RiMG 40:193–275 (pubs.geoscienceworld.org/msa/rimg/article/40/1/193);
Jensen 1996 Mineralogical Record (Elmwood barian celestine, via mindat loc-4125 refs);
mindat.org Baryte-Celestine Series min-8613 + Elmwood locality celestine entry;
Gránásy et al. 2005 "Growth and Form of Spherulites" (growth-front nucleation/branching);
Sunagawa, "Crystals: Growth, Morphology and Perfection" (impurity-driven branching,
polyhedral→spherulitic morphodrome); fibrous-vein lit (antitaxial satin spar — noted as
the WRONG mechanism for open-surface druse).*
