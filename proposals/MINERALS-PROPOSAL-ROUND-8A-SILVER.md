# Round 8a — Silver Suite

**Status:** Implementation proposal. Three new species: `acanthite`, `argentite`, `native_silver`. All chemistry already plumbed in `FluidChemistry` (Ag, S, O2). No schema bumps. Same pattern shape as Round 5 sulfates / Round 7 gemstones — commit-by-commit; tests inherit automatically; SIM_VERSION bumps once at the close.

**Template reference:** `proposals/vugg-mineral-template.md`

**Source-of-truth research files** (boss's commit `f2939da`):
- `research/research-acanthite.md`
- `research/research-argentite.md`
- `research/research-native-silver.md`

**Class:** `sulfide` (acanthite, argentite) | `native` (native_silver). `class_color` per the 12-class palette — never invent a hex.

**Schema readiness:** zero new FluidChemistry fields needed. Ag (already populated trace at Tsumeb / Bisbee / MVT), S, O2 all live. The dormant Ag pool currently sits at `~3 ppm` in Sweetwater Viburnum, `~5 ppm` in Tri-State, `trace` at Tsumeb — ready to feed all three engines once they ship.

**Scenarios most-likely-affected at seed-42:**
- `mvt` (Tri-State) — Ag=5 + S=60 → acanthite likely fires post-cooling
- `reactive_wall` (Sweetwater) — Ag=3 + S=60 → marginal acanthite chance
- `bisbee` — late stages where Ag is liberated from tetrahedrite oxidation
- `supergene_oxidation` (Tsumeb) — silver-rich locality; native_silver in reducing pockets

---

## Implementation pairing

Three commits + one closeout, in this order:

| Commit | Species | Mechanism |
|---|---|---|
| **8a-1** | `acanthite` | Standalone monoclinic Ag₂S engine. Low-T (50-170°C), reducing. Activates dormant Ag pool. **First Ag mineral in sim.** |
| **8a-2** | `argentite` + 173°C polymorph mechanic | Cubic Ag₂S (>173°C). Argentite → acanthite paramorph on cooling. **Novel mechanic in sim** — same fluid composition, two minerals separated by a temperature-driven phase transition. |
| **8a-3** | `native_silver` | Ag-S depletion mechanic. Wires/dendrites in S-poor reducing pockets. The Kongsberg-type. |
| **8a-4** | Locality realization audit + SIM_VERSION 7→8 + baseline regen + BACKLOG | Round closeout |

---

## 1. Acanthite — Ag₂S (monoclinic)

**Chemistry summary:**
- Required: Ag ≥ 0.5 ppm, S ≥ 5 ppm
- T range: 50-170°C, optimum 80-150°C (epithermal)
- pH 5-7, Eh moderately reducing, O2 < 0.3
- Inhibitors: high Fe (diverts Ag → tetrahedrite), high Cu (diverts → polybasite)

**Habits** (research file lists 2):
1. **pseudo-cubic** — paramorph from cooled argentite, retains cubic external form. The Guanajuato signature.
2. **thorn / spiky-prismatic** — primary low-T growth, the species' name comes from thorn-like aggregates.

**Paragenesis:**
- Forms AFTER: argentite (on cooling), primary Ag-bearing sulfides (galena, tetrahedrite)
- Forms BEFORE: native_silver (if S depletes), supergene Ag halides (cerargyrite — out of scope this round)
- Companions: galena, sphalerite, pyrite, tetrahedrite, calcite, quartz

**Color rules:** lead-gray to black, metallic; tarnishes deeper black. No fluorescence.

**Sim-specific notes:**
- Engine fires at the LOW end of the cooling cascade — most scenarios that have Ag also have galena (which forms much earlier); acanthite picks up after T drops past 170°C.
- Specifically Tsumeb's `scenario_supergene_oxidation` has Ag=trace + S available; should fire late.
- MVT Ag=5 + S=60 + cooling profile (140°C ambient with retrograde to lower T) — likely seed-42 hit.

---

## 2. Argentite — Ag₂S (cubic) + the 173°C polymorph mechanic

**Chemistry summary:** identical to acanthite (same compound, different polymorph). T range: > 173°C, optimum 200-400°C. Crystallizes only above the 173°C transition.

**Habits:**
1. **cubic** — sharp cubes, classic high-T form. Comstock Lode signature.
2. **octahedral** — rarer, growth-rate-dependent.
3. **arborescent** — dendritic / wire-like aggregates.

**The novel mechanic:** When a crystal of argentite exists and the simulation's temperature drops past 173°C, the crystal **converts in-place to acanthite** while retaining its external crystal form. This is a **paramorph** (same composition, different structure). Implementation pattern:

```python
def apply_thermal_decomposition(self, crystal, T):
    if crystal.mineral == "argentite" and T < 173:
        crystal.mineral = "acanthite"
        crystal.note = (crystal.note or "") + " — paramorph from cooled argentite"
        # Keep habit + dominant_forms unchanged so the cubic shape persists.
```

This is the **first in-place mineral conversion** in the sim. Existing `THERMAL_DECOMPOSITION` table handles destructive decomposition (calcite → CaO + CO₂); this is *non-destructive* and worth its own structural pattern (`PARAMORPH_TRANSITIONS` dict, or a hook in the per-step tick). Worth calling out for both the implementation reviewer and the test author.

**Sim-specific notes:**
- Argentite engine should only fire ABOVE 173°C — most scenarios that hit those temps are pegmatite / porphyry / gem_pegmatite, and those don't typically carry Ag. So argentite nucleation will be rare in seed-42.
- The paramorph mechanic is what makes argentite *visible* in the Library — we ship it as its own species, but in cooled scenarios the actually-observed crystal will display as acanthite (cubic habit preserved).
- Open design question for boss: do we want a "paramorph indicator" badge on the thumbnail? Same affordance as the twin badge (⟁) shipped in Phase 1b. Recommended: yes, with a little ring-arrow glyph (↻) for "this crystal transformed in place."

---

## 3. Native silver — Ag

**Chemistry summary:**
- Required: Ag ≥ 1.0 ppm (higher threshold than acanthite — needs supersaturation past sulfide complexes)
- T range: 50-300°C, optimum 100-200°C
- pH 5-7, Eh **strongly reducing**, S ≤ 2 ppm (the depletion gate — Ag forms native only when S is exhausted)
- Inhibitors: high S²⁻ (Ag → acanthite), high Cl⁻ (Ag → cerargyrite, out of scope)

**Habits** (research file lists 3 + a tarnish-clock mechanic):
1. **wire** — epithermal, low-T, open-vug. Kongsberg cathedral spires (>30 cm). The collector's prize.
2. **dendritic** — fern-like plates, moderate T, confined space. Cobalt Ontario type.
3. **massive** — nugget/hackly mass, high Ag concentration. Keweenaw type.

**The S-depletion gate** is the chemistry novelty:

```python
def supersaturation_native_silver(self) -> float:
    if self.fluid.Ag < 1.0:
        return 0
    if self.fluid.S > 2.0:
        return 0  # all Ag is going to acanthite — native impossible
    if self.fluid.O2 > 0.3:
        return 0  # too oxidizing — Ag stays in solution
    # ... rest of normal supersaturation math
```

This is **the inverse of the priority chains** we built for beryl/corundum. Beryl/corundum chains say "X takes priority over Y if X's chromophore is present"; native_silver says "X fires only when its competitor's reagent (S) is *absent*." Geologically authentic — native silver only ever forms in genuinely sulfide-depleted reducing zones.

**The tarnish clock** (research file's "Special Game Mechanic" section): native_silver crystals slowly accumulate an acanthite surface coating over geological time, even if the fluid stays reducing — atmospheric S compounds eventually reach the surface. Implementation: a per-step tarnish accumulator that, after N steps, switches the crystal's render to "tarnished native_silver" (different color tag, same engine). **Defer the tarnish clock to Round 8a-3b** — ship the basic engine first, add the tarnish overlay as a second commit if it lands cleanly.

**Sim-specific notes:**
- Tsumeb's `scenario_supergene_oxidation` — sulfide ore body has been oxidizing; some pockets locally reach S-depletion → native_silver candidate. Seed-42 needs to verify.
- Bisbee — argentian galena oxidation → released Ag could meet a reducing pocket. Less likely than Tsumeb at seed-42.
- Could be the basis for a future `scenario_kongsberg` (calcite-vein hosted, mesothermal, sulfide-poor) — pegmatite-of-silver scenario. Reserved for a later round.

---

## Cross-cutting implementation notes

### The polymorph-pair pattern

Argentite + acanthite share:
- The same `Ag` and `S` fluid consumption (same depletion math)
- The same color palette (both render as gray/black metallic)
- The same fluorescence (none)

But they differ in:
- T window (173°C boundary — strict)
- Crystal habit family (argentite cubic / acanthite monoclinic-or-cubic-paramorph)
- Spec entry (separate first-class species in `data/minerals.json`, separate engines, separate tests)

The `_silver_sulfide_base_sigma()` helper pattern (mirroring `_beryl_base_sigma()` / `_corundum_base_sigma()` from Rounds 7) holds the shared chemistry; each engine wraps it with its own T-window and exclusion logic. Same approach used in Round 7 — proven, refactor-safe.

### Library + thumbnail considerations

- All three species get the standard zone-viz + thumbnail treatment that Phase 1d ships.
- The 173°C polymorph mechanic means a single specimen may have its `mineral` field changed mid-simulation. The Crystal Inventory and Library views must read `crystal.mineral` at *display time* (not nucleation time). Already true in current renderers — no fix needed; just verify.
- Acanthite + native_silver both tarnish in the player's inventory if they sit through certain scenarios. Render note: a slight darkening overlay would add narrative truth. Defer to follow-up.

### Locality chemistry adjustments

After 8a-3 lands, add a `mineral_realizations_v8a_silver` block to `data/locality_chemistry.json` for each locality where Ag was previously dormant:
- `tri_state.mineral_realizations_v8a_silver.acanthite` — expected hit at seed-42
- `sweetwater_viburnum.mineral_realizations_v8a_silver.acanthite` — likely hit
- `tsumeb.mineral_realizations_v8a_silver.native_silver + acanthite` — both expected
- `bisbee.mineral_realizations_v8a_silver.acanthite` — late-stage candidate

If a locality's seed-42 doesn't fire as expected, document it as `absent_at_seed_42` with the diagnostic chain (e.g., "Ag depleted by tetrahedrite formation in step 23 before T cooled to acanthite window") — same pattern used for Mogok sapphire in Round 7.

---

## Automated testing expectations

Adding 3 species automatically gives **+24 parameterized tests** for free, via the existing pytest infrastructure:

- `tests/test_engine_gates.py` — 4 tests per species (method_exists, blocks_when_zero, fires_with_favorable_fluid, each_ingredient_necessary) = **+12**
- `tests/test_mineral_completeness.py` — 8 tests per species (required_fields, field_types, required_ingredients_match_fluid, trace_ingredients_match_fluid, narrate_function_exists, habit_variants_well_formed, T_ranges_well_formed, scenarios_are_real) = **+24** (some skip if optional fields are unset)

**One additional test specifically for this round** — the polymorph mechanic:

```python
def test_argentite_to_acanthite_paramorph(vugg):
    """At T=200°C an argentite crystal exists; cool past 173°C; assert
    its mineral attribute is now 'acanthite' but its habit is still
    cubic (paramorph preserves external form)."""
    # ... build a crystal manually with mineral='argentite', habit='cubic'
    # ... apply per-step T drop from 200 to 150 with the paramorph hook
    # ... assert crystal.mineral == 'acanthite'
    # ... assert crystal.habit == 'cubic'  # preserved!
    # ... assert 'paramorph' in (crystal.note or '')
```

This belongs in a new `tests/test_paramorph_transitions.py` file — first paramorph in the sim, deserves its own test module.

**Scenario regression baseline:** SIM_VERSION 7 → 8 in the closeout commit. `python tests/gen_baselines.py` regenerates `baselines/seed42_v8.json`. Expect new entries for `acanthite` (probably `mvt`, `reactive_wall`, `tsumeb`, `bisbee`) and `native_silver` (probably `tsumeb`). Argentite likely won't fire at seed-42 in any current scenario (no high-T Ag fluids today).

**Total test suite** post-Round-8a: 842 → ~870 passing (3 species × ~9 effective tests each + 1 paramorph test).

---

## Sources

The boss's research files are the primary specification. Cite as:
- `research/research-acanthite.md` (canonical commit `f2939da`)
- `research/research-argentite.md`
- `research/research-native-silver.md`

Additional references for the implementation reviewer:
- Hayba, D.O. & Bethke, P.M. (1985). "Geologic, Mineralogic, and Geochemical Characteristics of Volcanic-Hosted Epithermal Precious-Metal Deposits." *Reviews in Economic Geology* 2: 129–167.
- Petruk, W., Owens, D.R., Stewart, J.M., & Murray, E.J. (1974). "Observations on acanthite, aguilarite and naumannite." *Canadian Mineralogist* 12: 365–369.
- Kongsberg silver paragenesis: Bjørlykke, H. (1959). "The Kongsberg silver deposits." *Norges Geologiske Undersøkelse* 207.

---

🪨
