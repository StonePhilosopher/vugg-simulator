# PROPOSAL — the fluid.S sulfate/sulfide split (the bedrock arc) — 2026-07-17

**Status: awaiting approval.** The root the boss named during the hostile review — "sulfur
identity and the Eh gates disagree" — gets its foundation fix. This is the arc every redox
rung pointed at: once sulfur carries its own speciation, every boundary the ladder measured
(+100 mV and its per-class carve-outs) becomes a **consequence** instead of a policy.

## 1. The root, stated precisely

`fluid.S` is one number read two contradictory ways, 218 times across 32 files:

- **Sulfide consumers** (js/41 supersats ×66, js/91 nucleation ×16, native/As-sulfide
  branches) read it as reduced S (H₂S/HS⁻) — the stuff that builds ZnS/PbS/MoS₂.
- **Sulfate consumers** (js/40 supersats ×33, js/90 nucleation ×10) read the SAME ppm as
  SO₄²⁻ — the stuff that builds barite/anglesite/gypsum.

Both classes see the FULL pool, so every S-bearing fluid double-books its sulfur. The redox
arc (rungs 4a–4d) policed the worst symptoms with per-class Eh gates; the gates are correct
science but they are **policies** — each one hand-placed, each one a future
cerussite-pattern factory (the ~22 direct-O2 readers prove how policies drift).

## 2. The precedent — the v92 arsenic split (js/20c:380-452)

Already shipped, already load-bearing, already the template:

- `fluid.As` stays **total dissolved As** — "what scenario authors actually know."
- `arsenicOxidizedFraction(fluid)` derives the As(V) fraction at engine read time
  (sulfide-suppression lock + O2 ramp; Helz et al. 1995, Bowell et al. 2014).
- Two accessors — `arsenateAvailablePpm` / `arseniteAvailablePpm` — replaced direct reads
  per engine class, one class at a time.
- **No new state. No save-format change. No event authoring change.** Deterministic,
  seed-stable, byte-identical where the fraction is 0 or 1.

The S split follows this shape, with one deep difference (§4).

## 3. The census (SIM 234, seed 42 — tools/nucleation-eh-census.mjs full table)

Operating windows of every S-bearing species, nucleation-step Eh:

```
REDUCED-S consumers                     OXIDIZED-S consumers
species        minEh  maxEh  n          species        minEh  maxEh  n
galena          -150    +50  16         anglesite       +220   +322  14
sphalerite      -150    +50   8         brochantite     +174   +322  18
pyrite          -150    +76  10         linarite        +252   +252   2
marcasite       -111    +76   4         caledonite      +252   +290   4
chalcopyrite    -150    +44   2         leadhillite     +202   +202   2
molybdenite      +44    +44   3         jarosite        +290   +290   1
tetrahedrite    -150    +44   5         alunite         +290   +290   1
tennantite      -200    +44   5         mirabilite      +322   +322   2
arsenopyrite    -200      0  14         thenardite      +322   +322  41
acanthite       -200    +75  30         ---- the COEXISTENCE sulfates ----
proustite       -200    +69   8         BARITE           -21    +74  49  ← ALL of them
stibnite           0    +44   2         celestine         -8   +322  33
bismuthinite    -200    +44   5         anhydrite        +48   +322   8
cinnabar         +76    +76   6         selenite         +24   +322  24
orpiment        -150    +76   9
realgar          +69    +69   1         INTERMEDIATE / SPECIAL
pararealgar     -150    +76  12         native_sulfur    +76   +76    6  (sicily, S⁰)
greenockite      -68    +48  10         ---- the DEFENDED enrichment trio ----
hawleyite        -69    -69   1         bornite         -150   +111   5
cobaltite       -200   -200   4         chalcocite      -150   +193  10
                                        covellite       -111   +252  16
```

**The smoking number: barite, n=49, max +74.** The sim's ENTIRE barite population — mvt,
tn457, elmwood, wittichen, schneeberg — nucleates AT or BELOW the SO₄/H₂S boundary,
beside actively-growing galena (+50) and acanthite (wittichen: barite +74 at step 148,
acanthite +75 at 159). Low-Eh celestine (−8), anhydrite (+48), selenite (+24) ride the
same regime. This is not a bug to fix — it is the **MVT diagnostic assemblage** (Anderson
& Macqueen 1982) plus the five-element-vein assemblage, and any split that starves it is
wrong.

## 4. The physics that makes both sides real — kinetic disequilibrium

Aqueous SO₄²⁻/H₂S interconversion is **frozen at vug temperatures**. Ohmoto & Lasaga
(1982, GCA 46:1727–1745 — verified): the reaction is second-order
(R = k·[ΣSO₄][ΣS²⁻]), rate-limited by intramolecular exchange in thiosulfate, and fast
enough to equilibrate only at ~200–400°C laboratory conditions; below ~200°C the
half-life runs 10⁴–10⁹ years — longer than a vug's growth episode. TSR onsets only at
~100–140°C over geological time (Machel 2001, Sed. Geol. 140:143–175); below that, only
bacteria move sulfur across the divide.

So a basinal brine **inherits BOTH species** — evaporite/seawater sulfate AND
TSR-at-depth sulfide — and carries them together, out of equilibrium, through the ore
zone. Barite+galena coexistence is inherited disequilibrium, not shared identity. The
sim's current total-S is accidentally MORE right than a naive equilibrium split would be;
the honest model must keep that rightness while ending the double-booking.

## 5. Candidate partition functions — the would-it-starve verdicts

**A. Sharp equilibrium step at the boundary (+100 mV).** sulfateFraction ≈ 0 below,
1 above. Kills all 49 barite, mvt anhydrite, elmwood selenite, low-Eh celestine —
the MVT diagnostic dies. Also starves cinnabar/native_sulfur at exactly +76. **REJECTED
by census.**

**B. Kinetics-honest partition (RECOMMENDED, Phase-1 shape).** Derived, As-template,
no new state:

```
sulfurReducedFraction(fluid, T):
  center = the measured SO₄/H₂S boundary (Eh_b ≈ +76 mV = ehFromO2(0.4))
  width  = kinetic-disequilibrium width, T-dependent:
           T < ~150°C  : WIDE sigmoid + floors — fraction clamped to
                         [F_min, 1−F_min], F_min ≈ 0.15 (inherited mixtures;
                         a frozen fluid never runs either species to zero)
           150–250°C   : width and floors taper (TSR waking up)
           T > ~250°C  : approaches the equilibrium step (Ohmoto-Lasaga
                         fast-exchange regime)
  sulfideAvailablePpm = S × reducedFraction; sulfateAvailablePpm = S × (1−reducedFraction)
```

At barite's fleet window (−21..+74, T 90–150°C) the sulfate fraction runs ~0.30–0.50 —
combined with barite's existing `s_f = min(S/40, 2.5)` cap, mvt's S=200 still saturates
the factor (60–100 ppm ≫ 40): **the MVT diagnostic survives arithmetically**, not by
exemption. The supergene sulfates (+174..+322) see fraction ≈ 1−F_min..1: unchanged. The
hypogene sulfides (−200..+76) see ~0.5–0.85 of S — their fluid_min floors (5–50 ppm)
need the per-species check the Phase-S0 instrument computes BEFORE any engine migrates.

**C. Full two-pool state** (`S_ox`/`S_red` fields, per-step relaxation toward the
T-dependent equilibrium, dissolution feeding each pool, per-event authoring). The
complete model — and the only shape that can natively express the **enrichment trio's**
food source (chalcocite/covellite/bornite at +111..+252 consume sulfide RELEASED BY
DISSOLVING primaries into an oxidizing fluid — a transient B cannot fully represent,
since B's floor is a standing fraction, not a decaying pulse). Phase-3-if-needed, decided
by the S2 census, not now. Costs: save format, event authoring, scenario audits ×39.

## 6. What becomes emergent vs what stays deliberate

- **Emergent under B**: the +100 primary-sulfide ceilings (sulfideAvailablePpm falls
  toward the floor above the boundary — fresh ZnS starves out of arithmetic, not decree);
  the supergene sulfates' O2_min floors; smithsonite/cerussite-class asymmetries keep
  their own carbonate gates (different anion — untouched by this arc).
- **Stays deliberate (Phase-3 candidates, censused per class)**: the enrichment trio
  (dissolution-fed transient — keep its carve-out until C or an explicit source term);
  sicily's native_sulfur at +76 (synproportionation NEEDS both species present — B's
  floors actually serve it; verify); cinnabar's documented O2 tolerance; the v92 As
  thioarsenite lock currently reads total `fluid.S > 50` — it should eventually read
  sulfideAvailablePpm (a one-line re-coupling with its own blast check, sequenced in S2).

## 7. Migration ladder (instruments-first, one class per bump)

- **S0 — instrument + inert functions (byte-identical commit).**
  `tools/sulfur-speciation-census.mjs`: per scenario × step, Eh/T/S and what each
  candidate fraction yields; per-species would-it-starve table at the fleet's recorded
  operating points. The derived functions land defined-but-unused. Zero baseline motion.
- **S1 — the sulfate class migrates** to `sulfateAvailablePpm` (barite first, its own
  census; then celestine/anhydrite/selenite; then the supergene Pb-Cu sulfates, which
  should be near-byte-identical at fraction≈1). SIM bump, blast radius, canary
  pre-registration per the house ritual.
- **S2 — the sulfide class migrates** to `sulfideAvailablePpm`; the per-species +100
  ceilings retire ONE AT A TIME, each retirement proven redundant by the census (the
  gate-retirement is the payoff: policy → consequence). As-lock re-coupling lands here.
- **S3 — the edge ecology**: enrichment trio, native_sulfur synproportionation, any
  survivor that needed the two-pool truth → decide C on evidence.

Every phase: `npm run build` → blast vs prior baseline → full vitest → bump-first rebake
→ explicit staging → dense commit → deploy-verify → cold-ci stamp → both standing census
gates re-run (`nucleation-eh-census` + `halite-saturation-census`).

## 8. Acceptance criteria (pre-registered)

Zero expects_species lost fleet-wide. The coexistences preserved BY ARITHMETIC:
mvt barite+galena, wittichen barite+acanthite, sicily native_sulfur, elmwood
selenite+sphalerite. The enrichment trio alive at bisbee/roughten_gill/supergene_ox.
Stale gate 1. Every retired gate accompanied by its redundancy proof in the commit.

## 9. Open questions for the boss

1. **F_min (the disequilibrium floor)** — 0.15 is a placeholder; the S0 instrument will
   propose a measured value (smallest floor that keeps every legit consumer fed).
2. **T taper anchors** — 150/250°C from Ohmoto-Lasaga/Machel; happy to tighten from
   literature if the fork matters at any live scenario (only porphyry + schneeberg run hot).
3. Sequencing: S0 is safe to build on approval (byte-identical); S1 is the first
   baseline-moving commit.

Refs: Ohmoto & Lasaga 1982 GCA 46:1727 (kinetics — the load-bearing citation, verified);
Machel 2001 Sed. Geol. 140:143 (TSR/BSR regimes); Anderson & Macqueen 1982 (MVT
coexistence, in-repo canon); Helz et al. 1995 GCA 59:4591 (the As-lock precedent's
citation, js/20c); the v92 As split (js/20c:380-452) as the implementation template.

*Proposed by the twenty-third hand, 2026-07-17, on the ladder's completed rungs.*
