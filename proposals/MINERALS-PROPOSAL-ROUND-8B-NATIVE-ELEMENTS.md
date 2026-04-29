# Round 8b — Native Element Trio

**Status:** Implementation proposal. Three new species: `native_arsenic`, `native_sulfur`, `native_tellurium`. All chemistry already plumbed in `FluidChemistry` (As, S, Te). No schema bumps. Ships immediately after Round 8a; can also ship in parallel since there's no chemistry overlap with the silver suite.

**Template reference:** `proposals/vugg-mineral-template.md`

**Source-of-truth research files** (boss's commit `f2939da`):
- `research/research-native-arsenic.md`
- `research/research-native-sulfur.md`
- `research/research-native-tellurium.md`

**Class:** All three are `native` — share `class_color: "#eb13eb"` (same as molybdate per the 12-class palette; native elements are rare and share the slot). Existing examples in sim: `native_copper`, `native_gold`, `native_bismuth`. Round 8b makes the native-element family larger and more diverse — three different reasons elements end up native (depletion-driven, fumarole-degassing, residue-after-tellurides).

**Schema readiness:** zero new fields needed. As, S, Te all already declared. Te is currently dormant in the sim (populated trace at Bingham via Au-Te coupling backlog item, but no engine consumes it yet) — this round activates the Te pool.

**Scenarios most-likely-affected at seed-42:**
- `sabkha_dolomitization` (Coorong) — high biogenic S, low metals at certain depths → native_sulfur fumarole/biogenic candidate
- `bisbee` — late stages where As is liberated from arsenopyrite oxidation but reducing pockets locally exclude Fe → native_arsenic candidate
- `porphyry` (Bingham) — Au-Te association; if Te trace is added per the existing backlog item, native_tellurium becomes seed-42-realistic
- `supergene_oxidation` (Tsumeb) — local S depletion zones → minor native_sulfur

---

## Implementation pairing

Three commits + closeout. Order chosen so each commit can be tested in isolation against an existing scenario:

| Commit | Species | Anchor scenario | Mechanism |
|---|---|---|---|
| **8b-1** | `native_sulfur` | sabkha_dolomitization | Biogenic / fumarole low-T S precipitation. Stable α-S below 95.5°C. The Sicilian sulfur. |
| **8b-2** | `native_arsenic` | bisbee | Reducing depletion mechanic — As accumulates only when Fe-arsenide and S-arsenide pathways are saturated/depleted. |
| **8b-3** | `native_tellurium` | porphyry (with Te trace bumped per existing backlog) | Telluride-residue mechanic — Te crystallizes only when all metal-tellurides have formed and Te keeps arriving. |
| **8b-4** | Locality realization audit + closeout | All affected localities | Add `mineral_realizations_v8b_native` blocks; SIM_VERSION bump only if 8a hasn't already taken 7→8. |

---

## 1. Native sulfur — S

**Chemistry summary:**
- Required: S ≥ 100 ppm (high — needs near-saturation)
- T range: 20-119°C (above 119°C goes liquid; above 95.5°C is β-S, below is α-S — both rendered as "native_sulfur" in this round; β/α distinction deferred)
- pH 0-5 (acidic — H₂S-dominated)
- Eh near the H₂S/SO₄²⁻ boundary (~Eh 0 to +200 mV) — the "synproportionation window" where partial oxidation of H₂S meets partial reduction of SO₄²⁻
- Inhibitors: Fe²⁺, Cu²⁺, Pb²⁺ (all preferentially bind S into sulfides)

**Habits** (research file lists):
1. **euhedral_dipyramidal** — the iconic Sicilian Caltanissetta yellow crystals. Low-T, slow growth, biogenic.
2. **botryoidal_crust** — fumarolic deposition; bulbous yellow coating on volcanic vents.
3. **massive** — bedded sulfur in evaporite cap rocks (Texas/Louisiana salt domes).

**Paragenesis:**
- Forms AFTER: H₂S degassing from magma OR bacterial sulfate reduction (BSR)
- Forms BEFORE: barite/gypsum if later oxidized; melanterite (FeSO₄·7H₂O) if Fe arrives
- Companions: celestine, calcite, aragonite, gypsum, cinnabar, pyrite, galena

**Color rules:** sulfur-yellow (#f5d030) to honey-amber. No fluorescence in the sim.

**Sim-specific notes:**
- Coorong (`sabkha_dolomitization`) currently has S=2700 (the celestine-driver value) and O2=1.5 — that's strongly oxidizing, so MOST of the S is sulfate. But the early-stage anaerobic / biogenic phase modeled by `ev_anaerobic_buildup` (if it exists in the scenario) could produce a brief synproportionation window. May need a small scenario tweak in 8b-4 to fire native_sulfur at seed-42.
- Volcanic fumarole pattern is paragenetically distinct — could anchor a future `scenario_volcanic_fumarole` (Solfatara di Pozzuoli, Hawaii's Halemaumau). Reserved for later round.
- The simplest seed-42 hit is via `scenario_supergene_oxidation` at Tsumeb where massive sulfide oxidation produces local S accumulation — but Tsumeb's Fe is high, so most S goes to scorodite/jarosite first. Marginal hit at best.

---

## 2. Native arsenic — As

**Chemistry summary:**
- Required: As ≥ 5 ppm (high)
- T range: 100-350°C, optimum 150-300°C (hydrothermal, NOT supergene)
- pH 4-7, Eh strongly reducing (Eh -200 to +50 mV), O2 < 0.1
- Inhibitors: **S²⁻ is the highest-priority inhibitor** (As → realgar / orpiment / arsenopyrite); Fe (As → arsenopyrite)

**Habits:**
1. **botryoidal** — the dominant form, often called "arsenic-shot" in old mining literature. Concentric reniform masses with bright metallic gray fresh surface, dark gray weathered.
2. **massive** — granular metallic veins, no crystal form.
3. **dendritic** (rare) — open-vug spray.

**Paragenesis:**
- Forms AFTER: arsenopyrite, realgar, orpiment, nickeline, cobaltite (As-bearing primary minerals consume As first; native As is the *overflow*)
- Forms BEFORE: arsenolite (As₂O₃), scorodite (FeAsO₄·2H₂O — already in sim) — both are oxidation products
- Companions: arsenopyrite, nickeline, safflorite, native bismuth, native silver, calcite, barite, galena

**Color rules:** bright metallic tin-white on fresh fracture; tarnishes to dark gray then black within hours. No fluorescence.

**Sim-specific notes:**
- The "depletion overflow" mechanic is the geological lesson: native_arsenic forms in the same reducing zones that produce arsenopyrite, but only after the available Fe and S have been consumed. So the engine fires LATE in any As-bearing scenario, after arsenopyrite has eaten the Fe.
- Bisbee + Tsumeb are the two seed-42 candidates. Both have high primary As but also high Fe — arsenopyrite will dominate. Native As probably fires only in late dissolution-event zones.
- Worth a scenario-tweak: bump As in `scenario_radioactive_pegmatite` (currently 0) to add a third As-bearing scenario where Fe is locally low (pegmatite Fe values are typically lower than porphyry / supergene).

---

## 3. Native tellurium — Te

**Chemistry summary:**
- Required: Te ≥ 0.5 ppm (low — Te is itself rare; "high concentration" in the research is >10 ppm but >0.5 catches realistic epithermal)
- T range: 100-400°C, optimum 150-300°C
- pH 4-7, Eh reducing to mildly reducing (-200 to +50 mV)
- Inhibitors: **Au, Ag, Cu, Pb, Bi, Hg are all higher-priority than native Te** — they form tellurides first (calaverite, sylvanite, hessite, altaite, tetradymite, coloradoite). Native Te is the *residue* after these are saturated.

**Habits:**
1. **prismatic_acicular** — slender silver-white columns. Cripple Creek classic.
2. **massive** — granular metallic blebs.
3. **dendritic** — open-vug spray, similar to native silver wire.

**Paragenesis:**
- Forms AFTER: telluride minerals (calaverite, sylvanite, hessite, altaite, tetradymite, coloradoite) — all OUT OF SCOPE for this round, but the dependency means native Te fires in scenarios where those have already crystallized. Without them, "native Te" effectively means "all the Te in the fluid" since nothing else consumes it.
- Forms BEFORE: tellurites, tellurates (oxidation-zone)
- Companions: calaverite, sylvanite, hessite, native gold, pyrite, quartz, fluorite

**Color rules:** silvery white with pinkish or yellowish tinge; metallic. Tarnishes slowly. No fluorescence.

**Sim-specific notes:**
- **Te is currently dormant in the sim** — Bingham's chemistry could carry trace Te per the existing BACKLOG item ("Au-Te coupling — calaverite/sylvanite for Bingham"). That backlog implementation depends on this round, NOT vice versa. We can ship native_tellurium with Te=0 by default, then the Te-coupling round bumps Bingham's Te trace and native_tellurium fires automatically.
- For a seed-42 hit at this round's commit time, we need to populate at least one scenario with Te ≥ 0.5 ppm. Options:
  - Add Te to Bingham's chemistry now (small forward-compat tweak)
  - Or accept that native_tellurium ships as a "no seed-42 fires" species, available via the favorable_fluid test path only — same situation as some Round 7 species (e.g., violet sapphire pre-Tanzania-scenario).
- Recommended: bump Bingham Te trace to 0.05 ppm in 8b-3 — pre-positions for the future Au-Te coupling round.

---

## Cross-cutting implementation notes

### The "depletion overflow" pattern

All three species share the same geological story: an element that prefers to bond with something else (S for sulfur, Fe/S for arsenic, metals for tellurium) ends up native only when *all of its preferred partners are saturated or absent*. The supersaturation function has a natural shape:

```python
def supersaturation_native_X(self) -> float:
    if self.fluid.X < threshold:
        return 0
    if self.fluid.<inhibitor> > inhibitor_max:
        return 0  # all X is going to <competing mineral> instead
    if self.fluid.O2 > redox_max:
        return 0  # too oxidizing — X stays in solution
    # ... rest of normal supersaturation math (T window, etc.)
```

Same shape as `supersaturation_native_silver` from Round 8a. Three new functions follow the pattern with their respective inhibitor (S for Ag, S/Fe for As, metal-tellurides for Te).

### Native-element shared code

Round 8b is the second batch of native elements (after `native_copper`, `native_gold`, `native_bismuth` already in sim). Worth introducing a `_native_element_dissolution(crystal, conditions, step, element_field, oxidation_threshold=0.5)` shared helper for the dissolution branch — three species would use it. Same refactor pattern we did for `_beryl_family_dissolution`.

### Tarnish considerations

Native arsenic tarnishes within hours of fresh exposure (As surface oxidizes to arsenolite). Native tellurium tarnishes slowly (Te surface oxidizes to TeO₂ rind). Native sulfur is stable indefinitely under normal conditions. The tarnish clock pattern reserved from Round 8a (native_silver) generalizes here — when implemented, native_arsenic and native_tellurium share the mechanic. Defer to a follow-up commit.

### Locality chemistry adjustments

After 8b-3 lands, add `mineral_realizations_v8b_native_elements` blocks:
- `coorong_sabkha.mineral_realizations_v8b_native_elements.native_sulfur` — biogenic candidate; expected at seed-42 if BSR window opens
- `bisbee.mineral_realizations_v8b_native_elements.native_arsenic` — late-stage candidate
- `bingham_canyon.mineral_realizations_v8b_native_elements.native_tellurium` — pending the 0.05 ppm Te bump
- `tsumeb.mineral_realizations_v8b_native_elements.native_arsenic` — possible local pocket

Document `absent_at_seed_42` cases with the diagnostic chain, same pattern as Round 7 sapphire.

---

## Automated testing expectations

**+24 parameterized tests** for free (4 + 8 per species × 3 species). Same infrastructure as every prior round.

**Two species-specific tests worth writing:**

1. **Native silver / native arsenic / native tellurium share the depletion-overflow gate.** A small parameterized test checking that each fires **only** when its inhibitor is below threshold:

```python
@pytest.mark.parametrize("species,inhibitor_field,inhibitor_threshold", [
    ("native_silver", "S", 2.0),
    ("native_arsenic", "S", 5.0),
    ("native_tellurium", "Au", 1.0),  # any telluride-forming metal
])
def test_native_element_blocked_by_inhibitor(vugg, species, inhibitor_field, inhibitor_threshold):
    """Each native-element engine must return σ=0 when its inhibitor is above
    threshold, regardless of how much of the element itself is in fluid."""
    # ... build a favorable fluid with the inhibitor maxed; assert sigma == 0
```

2. **Native sulfur synproportionation window** — fires only at moderate Eh, not at extremes:

```python
def test_native_sulfur_eh_window(vugg):
    """Native sulfur requires Eh near the H₂S/SO₄²⁻ boundary. Should NOT
    fire at fully reducing (O2=0) or fully oxidizing (O2=1.5)."""
    # ... three test cases with O2=0, O2=0.5, O2=1.5; only middle should fire
```

Both belong in `tests/test_engine_gates.py` as additional checks beyond the standard 4-test harness.

**Scenario regression:** If 8a already bumped SIM_VERSION 7→8, 8b ships *without* a version bump (additive only — new species don't shift existing scenario outputs *unless* we tweak Coorong's anaerobic window or Bingham's Te trace). If we do tweak either, bump 8 → 9 in the closeout.

**Total test suite** post-Round-8b: ~870 (8a) → ~895 passing.

---

## Sources

The boss's research files are the primary specification:
- `research/research-native-arsenic.md` (canonical commit `f2939da`)
- `research/research-native-sulfur.md`
- `research/research-native-tellurium.md`

Additional references for the implementation reviewer:
- Mosier, D.L. & Berger, V.I. (2009). "Volcanogenic native sulfur deposits." *USGS Open-File Report* 2009-1175.
- Cooke, D.R., Hollings, P., & Walshe, J.L. (2005). "Giant porphyry deposits: characteristics, distribution, and tectonic controls." *Economic Geology* 100: 801–818. [Relevant for tellurium-bearing porphyry-related epithermal context]
- Tooth, B., Ciobanu, C.L., Green, L., O'Neill, B., & Brugger, J. (2011). "Bi-melt formation and gold scavenging from hydrothermal fluids: An experimental study." *Geochimica et Cosmochimica Acta* 75: 5423–5443. [Bi-Te-Au scavenging, paragenetic context for native Te]

---

🪨
