# HANDOFF — the strip instrument kept finding bugs: evaporite rewetting + the thermal-pulse contamination

**Date:** 2026-05-29
**Scope:** Continued the strip-as-instrument campaign (see HANDOFF-STRIP-AS-INSTRUMENT-2026-05-28).
Best-data-first contract pass through the evaporite + supergene families surfaced
two real engine bugs and one large entangled scenario fix. Five commits, all on
`main`, pushed to `Syntaxswine/vugg-simulator`. SIM_VERSION 160 → 163.

---

## What shipped (5 commits)

- `71892a0` — **strip records `concentration`**, the evaporite driver the instrument
  was blind to. The strip recorded 58 chips but not `FluidChemistry.concentration`
  (the scalar ×3-per-drying evaporative multiplier that 85c `_applyVadoseOxidationOverride`
  keys borax/mirabilite/thenardite nucleation off). Recording/legend-only, no SIM bump.
  Probing searles_lake (now unclamped) is what made it visible.

- `a1f4249` — **v161: evaporite rewetting fix.** The `concentration` boost was a ONE-WAY
  RATCHET — `_applyVadoseOxidationOverride` early-returned on rising water, so nothing
  re-diluted it (searles pinned 1→3→9→clamp, never returned; the fresh_pulse-narrated
  redissolution never fired). Fixed: the override now handles both directions — a
  vadose→wet reflood resets `concentration` to 1.0. Drift confined: 29/30 byte-identical,
  only naica thenardite 10→3 (correct — reflooding suppresses late evaporite); searles
  byte-identical (the fix corrects the trajectory, not the seed-42 final census). +searles
  strip contract (concentration oscillation, a ratchet-regression guard) + searles in the
  digest.

- `b8d541c` — **supergene/bisbee strip contracts** (recording/test-only). bisbee (azurite→
  malachite→chrysocolla Cu-supergene) + supergene_oxidation (Tsumeb Pb-Zn-Cu gossan).
  Pinned the event-driven signals (O2 redox trend, pH acid↔buffer sawtooth, DIC azurite
  spike, SI_calcite undersaturation = limestone CO3 source, metal pulses). supergene_oxidation
  added to the digest (7 scenarios). **Bisbee's T trajectory surfaced the next bug.**

- `5927600` — **v162: thermal-pulse opt-out flag.** `ambient_cooling` (85d) fires a
  hydrothermal thermal-pulse mechanic (4-10%/step, +30-150°C reheat + SiO2/Fe/Mn inject +
  pH drop) UNCONDITIONALLY. Correct for cooling hydrothermal systems; wrong once a scenario
  reaches a supergene/near-surface regime. Ungated, it reheated bisbee's ~25°C
  azurite/malachite cascade toward **357°C** (seen on the strip T chip). Survey (all 30
  scenarios) found genuine contamination in bisbee/roughten_gill/schneeberg; warm-spring
  systems (naica/sulphur_bank/travertine) + all hot hydrothermal scenarios were pulsing
  at correct T. **An automatic regime-T gate was prototyped and REJECTED** — temperature
  can't separate supergene-cold from cool-groundwater (bisbee 25-35°C overlaps naica's
  post-mining 30°C), and it broke 9 calibrated tests on schneeberg+sulphur_bank whose
  pulses are load-bearing. Shipped the per-scenario `VugWall.thermal_pulses` flag (default
  true) + Creative-mode setup toggle (`f-thermal-pulses`); tagged bisbee + roughten_gill
  false. 28/30 byte-identical; both drift toward more-supergene-correct mineralogy
  (roughten_gill even gains plumbogummite, its type mineral).

- `a1bf31b` — **v163: schneeberg done properly.** v162 left schneeberg un-flagged because
  its calibration was load-bearing on the pulses. Two entangled dependencies, both fixed
  at the mechanism level: (1) **meta-U via dry air** — added `event_schneeberg_vadose_exhumation`
  (step 110, water table drops → vadose dry_exposure_steps path) so torbernite→metatorbernite
  + zeunerite→metazeunerite dehydrate honestly instead of via the spurious heat path;
  (2) **native_bismuth via its cooling window** — `supersaturation_native_bismuth` T_factor
  is 1.0 only in [100,250]°C; the old 350→30°C jump skipped it (σ_max without pulses 0.811,
  capped). `event_schneeberg_cooling` now lands at 180°C (the Fünfelementformation window),
  σ→1.351. 29/30 byte-identical; schneeberg gains the full Bi-Co-Ni-Ag-As five-element
  assemblage (+native_arsenic, +native_silver, +naumannite). schneeberg flagged too.

State at handoff: **full suite 1627/1627, 107 files; typecheck 0; build:check in sync.**

---

## What I learned

1. **The strip instrument keeps earning its keep.** Two real engine bugs this session
   (the concentration ratchet, the thermal-pulse contamination) were both surfaced by
   *looking at a strip trajectory* — the concentration chip and the T chip — not by any
   other test. "A visualization is a latent test instrument" held for the third and fourth time.

2. **Beware load-bearing spurious mechanisms.** Both the rewetting ratchet AND the thermal
   pulses were doing real (if geologically wrong) work that scenario calibrations silently
   depended on. The thermal-pulse fix couldn't just be flipped off — schneeberg's meta-U
   and native_bismuth were *both* propped up by it, and "fixing properly" meant supplying
   the correct mechanisms (vadose dehydration; the 180°C cooling window). Always ask what a
   "spurious" mechanism is holding up before removing it.

3. **The flag beat the clever automatic gate.** I prototyped a regime-temperature gate
   (suppress pulses when the event-driven regime is cold). It was elegant but WRONG: a flat
   temperature threshold can't tell a 25°C supergene pocket from 30°C cool groundwater, and
   it broke 9 calibrated tests. The boss's instinct for a per-scenario opt-out flag was the
   honest tool — geology is a property of the scenario, not derivable from temperature alone.

4. **Survey before you swing.** The all-scenarios thermal-pulse survey (count cold-regime
   pulses + reheat magnitude per scenario) turned "this is probably broad" into "exactly
   bisbee/roughten_gill/schneeberg are contaminated; naica/sulphur_bank/travertine are
   warm-correct." That scoping is what made the confined fix possible.

5. **The strip is carbonate-instrumented.** Its SI chips are calcite/aragonite/dolomite/
   HMC/siderite. For the SULFATE evaporites (naica selenite, searles thenardite) and the
   metal-sulfide/oxide systems, the strip shows T/ions/pH/concentration but NOT the
   saturation index of the headline minerals. A sulfate-SI extension (gypsum/anhydrite/
   barite/celestine) would make naica/searles/sulphur_bank SI-legible — the clearest
   next instrument upgrade.

---

## What I hope to achieve next

1. **Continue the contract campaign** through the remaining best-data scenarios:
   gem_pegmatite (B/Li/F), naica (selenite — but see sulfate-SI gap), marble (carbonate,
   full strip signal + it drifted in the merge), the evaporite brines re-probe.
2. **Sulfate-SI chips** (gypsum/anhydrite/barite/celestine SI) — the biggest instrument
   gap; would light up the evaporite + barite-vein families.
3. **The thermal-pulse survey flagged ouro_preto** as a minor contaminated case (1 cold
   pulse → 77°C, brief late oxidation). Decide whether it warrants flagging too.
4. **The deferred per-vertex placement flip** (carried from the prior handoff) — now
   verifiable against the geology via the strip instrument before committing.
5. **Seasonal-cycling driver for zoned_dripstone_cave** (carried from the prior handoff).

---

## For the next builder — gotchas + load-bearing facts

- **`wall.thermal_pulses` (default true)** — supergene/near-surface scenarios set it false
  to suppress the `ambient_cooling` magmatic thermal-pulse mechanic. Currently flagged:
  bisbee, roughten_gill, schneeberg. Creative Mode exposes the toggle (`f-thermal-pulses`
  checkbox in the setup first screen → `wallOpts.thermal_pulses`). Adding a supergene
  scenario? Set it false.
- **`concentration` is the evaporite driver** (the ×3-per-drying multiplier). The strip
  records it now. v161: a reflood (vadose→wet) resets it to 1.0 (rewetting dilution). Do
  NOT re-introduce a one-way ratchet.
- **schneeberg's `cooling` event now lands at 180°C** (the bismuth-arsenide window), not
  30°C. native_bismuth + the Co-Ni-Ag-As arsenides need [100,250]°C (T_factor=1.0). Its
  meta-U comes from `event_schneeberg_vadose_exhumation` (step 110), NOT the heat path.
- **The thermal pulse is geologically CORRECT for hydrothermal scenarios** (pegmatites,
  porphyry, MVT, marble, epithermal — they keep pulses on). Only supergene/near-surface
  scenarios opt out. Don't gate it globally.
- **Strip digest now covers 7 scenarios** (+searles_lake, +supergene_oxidation) and 7 chips
  (+concentration). `tools/strip-chip-envelope.mjs`, `strip-probe.mjs`, `gen-strip-digest.mjs`
  workflow unchanged.
- **The strip is carbonate-SI-only.** Don't read sulfate/silicate saturation from it.
- **Merge housekeeping:** boss still promotes Syntaxswine→StonePhilosopher.
