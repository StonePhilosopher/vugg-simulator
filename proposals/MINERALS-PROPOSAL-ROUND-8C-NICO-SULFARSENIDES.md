# Round 8c — Ni-Co Sulfarsenide Cascade

**Status:** Implementation proposal. Three new species: `cobaltite`, `millerite`, `nickeline`. All chemistry already plumbed (Co, Ni, As, S). No schema bumps. Activates the dormant Co + Ni fields and unlocks the Cobalt-Ontario-type paragenetic class — the cobalt-nickel-silver vein assemblage that historically produced ~50% of world Co (Cobalt, Ontario; ~1900-1930s) and continues at Bou Azzer (Morocco) and Khetri (India).

**Template reference:** `proposals/vugg-mineral-template.md`

**Source-of-truth research files** (boss's commit `f2939da`):
- `research/research-cobaltite.md`
- `research/research-millerite.md`
- `research/research-nickeline.md`

**Class:** `sulfide` for `millerite` (NiS), `nickeline` (NiAs is technically an arsenide but classed with sulfides in the 12-class palette since the sim doesn't have a separate arsenide class). `cobaltite` is `sulfide` (CoAsS — sulfarsenide). All three share `class_color: "#7feb13"`.

**Schema readiness:** zero new fields needed. Co + Ni already declared (currently dormant — populated only at Bisbee Co=trace and possibly other localities; Ni currently 0 in all scenarios). This round activates BOTH dormant pools.

**Scenarios most-likely-affected at seed-42:**
- After this round, any scenario carrying Ni or Co at meaningful trace (>40 ppm Ni, >50 ppm Co) will fire one of the three.
- **The chemistry isn't there yet at seed-42.** Bisbee carries Co=trace per the existing `mineral_realizations_v3_expansion.erythrite` block (Co bloom from supergene Co), but the trace is below the 50 ppm threshold cobaltite needs. Most Round 8c species ship as "absent at seed-42, fires under favorable_fluid test path" — a scenario-tuning round (8c-4) bumps Co/Ni in a couple of scenarios to enable seed-42 hits.

---

## Implementation pairing

Three engine commits + one scenario-tuning + closeout:

| Commit | Species | Mechanism |
|---|---|---|
| **8c-1** | `nickeline` | NiAs hydrothermal arsenide. The "copper-red" Ni mineral. 200-500°C, reducing. Needs Ni + As both. |
| **8c-2** | `millerite` | NiS capillary needles. The "hair pyrites" — diagnostic acicular sprays. Lower T (100-400°C), reducing. Needs Ni + S, with the constraint that S can't be too high (excess S → pentlandite/pyrrhotite — but those aren't in the sim, so the constraint is implicit). |
| **8c-3** | `cobaltite` | CoAsS sulfarsenide cubes. 300-600°C, reducing. Three-element gate (Co + As + S all required). The display species — cobaltite cubes from Cobalt, Ontario are gem-grade silvery-white. |
| **8c-4** | Scenario tuning + locality realizations + SIM_VERSION + baseline regen | Bumps Bisbee Ni + Co to functional thresholds; activates seed-42 hits; documents `absent_at_seed_42` for unaffected localities. |

---

## 1. Nickeline — NiAs

**Chemistry summary:**
- Required: Ni ≥ 40 ppm, As ≥ 40 ppm
- T range: 200-500°C, optimum 300-450°C (hydrothermal + medium-grade metamorphic)
- pH 4-7, Eh reducing (arsenide stability requires low O2)
- Inhibitors: high S (Ni → millerite); Cu (Ni → pentlandite); Sb (Ni → breithauptite)

**Habits:**
1. **massive** — granular pinkish-red metallic, the bread-and-butter form. Cobalt Ontario veins.
2. **reniform_botryoidal** — bulbous masses with mammillary structure.
3. **prismatic** (rare) — well-formed crystals are uncommon; "tabletop" specimens exist but are collector-grade rarities.

**Paragenesis:**
- Forms AFTER: primary Ni-Fe sulfides (pentlandite — not in sim) breakdown; olivine breakdown in ultramafics
- Forms BEFORE: annabergite (already in sim — supergene Ni arsenate), erythrite if Co present
- Companions: millerite, cobaltite, skutterudite (out of scope), native silver, native bismuth, calcite, quartz

**Color rules:** copper-red on fresh fracture (the "kupfernickel" / "false copper" name from medieval miners — they thought it was copper ore that "wouldn't smelt"). Tarnishes to gray within days.

**Sim-specific notes:**
- Nickeline → annabergite weathering pathway is the sim's existing erythrite analog. After cobaltite + nickeline ship, the existing `_narrate_annabergite` and `_narrate_erythrite` should be refreshed to reference the primary parent (currently the narrators describe these as "supergene Ni/Co arsenates" without naming nickeline/cobaltite as the source).
- Bisbee already has annabergite at seed-42 — adding nickeline + Ni populated at 50+ ppm in Bisbee would let the *primary → secondary* paragenetic chain fire end-to-end at seed-42. Big pedagogical win.

---

## 2. Millerite — NiS

**Chemistry summary:**
- Required: Ni ≥ 50 ppm, S ≥ 30 ppm
- T range: 100-400°C, optimum 200-350°C
- pH 6-9 (near-neutral to slightly alkaline)
- Eh reducing, O2 < 0.2
- Inhibitors: excess S (→ pentlandite/pyrrhotite — neither in sim, so this is a soft constraint); Cu (→ pentlandite paths)

**Habits:**
1. **acicular_radial** — the diagnostic habit. Hair-thin radiating needles, sometimes called "hair pyrites." Silvery brass-yellow with iridescent tarnish. Halls Gap (Kentucky) sphere geodes are the signature collector form.
2. **capillary** — even thinner than acicular; furry-tuft aggregates.
3. **massive** (rare) — coarse-grained replacement of pentlandite during metamorphism.

**Paragenesis:**
- Forms AFTER: pentlandite breakdown during low-grade metamorphism; serpentinization of ultramafics releases Ni
- Forms BEFORE: heazlewoodite (Ni₃S₂, even more reduced; not in sim); annabergite (oxidation product — already in sim)
- Companions: heazlewoodite, pentlandite, pyrrhotite, nickeline, calcite, quartz, dolomite

**Color rules:** brass-yellow to bronze-yellow; tarnishes iridescent rainbow then dark. "Capillary" surface tension visual is the signature — looks like steel wool.

**Sim-specific notes:**
- The capillary habit is **a new visual primitive in the sim** — currently no acicular-by-default species (selenite has fibrous, but not the radiating-tufts profile). Worth a topo-renderer note: millerite's wall-spread is high (~0.6) and void-reach moderate (~0.5), but the *aspect ratio* (length:width) is extreme. Existing `vector: dendritic` covers it best.
- Halls Gap geodes (Kentucky) are the iconic locality — millerite needles inside calcite-lined geodes from Mississippian limestone. Could anchor a future `scenario_kentucky_geode` (low-T carbonate-hosted Ni). Reserved for later.
- For the seed-42 path: adding Ni=80 + S=60 to a future "carbonate-hosted Ni" scenario would fire millerite immediately. Without that scenario, Ni-bearing scenario tweaks at Bisbee (Bisbee has S already; just needs Ni bump) would do it.

---

## 3. Cobaltite — CoAsS

**Chemistry summary:**
- Required: Co ≥ 50 ppm, As ≥ 100 ppm, S ≥ 50 ppm — **all three simultaneously** (the toughest gate of the three Round 8c species)
- T range: 300-600°C, optimum 400-500°C (high-T hydrothermal + contact metamorphic)
- pH 5-7
- Eh reducing
- Inhibitors: high O2 (sulfarsenides destabilize)

**Habits:**
1. **euhedral_cubic** — the iconic Cobalt Ontario habit. Silvery-white isometric cubes with striated faces (like pyrite striations). Display-grade gem.
2. **pyritohedral** — 5-sided faces — the "diploid" habit shared with pyrite.
3. **massive** — granular silver-white veinlets.

**Paragenesis:**
- Forms AFTER: initial pyrite/arsenopyrite (Co is later-stage, residual in hydrothermal fluids)
- Forms BEFORE: erythrite (Co₃(AsO₄)₂·8H₂O — already in sim — its supergene oxidation product)
- Companions: arsenopyrite, pyrite, chalcopyrite, sphalerite, magnetite, skutterudite, calcite, quartz

**Color rules:** silvery-white to rose-red metallic. Distinctive from pyrite by color (cobaltite is whiter/cooler) and by tarnish (cobaltite tarnishes pinkish, pyrite goes brassy).

**Sim-specific notes:**
- Cobaltite → erythrite is the *primary → supergene* pair just like nickeline → annabergite. Once cobaltite ships, the existing `_narrate_erythrite` should reference cobaltite as the source rather than the current generic "Co-arsenide weathering."
- The three-element gate is the strictest in the sim after Round 7 sapphire's blue (Fe + Ti) and corundum's SiO₂-undersaturated. Worth flagging in the test author's mind: `test_blocks_when_all_ingredients_zero` will work as expected, but the favorable-fluid search needs to populate Co + As + S simultaneously, which the current search handles (it iterates over required_ingredients keys).
- High-T (400-500°C) makes cobaltite a CONTACT METAMORPHIC species — not seed-42-active in any current scenario except possibly `marble_contact_metamorphism` (Mogok) IF Co + As + S were present. Mogok's chemistry is currently Cr/Fe/Ti-dominant (ruby/sapphire); adding trace Co + As + S there is geologically defensible (skarn cobaltite occurrences exist) but a stretch. Better candidate: bump the Bisbee deep-hypogene phase to higher T momentarily during the early steps to clear the cobaltite window.

---

## Cross-cutting implementation notes

### The dormant-element activation

Co + Ni are both currently dormant in the sim. Round 8c is the round that turns them on. Implementation steps:

1. Engines + spec entries land first (8c-1, 8c-2, 8c-3) — three new species become test-callable but never fire at seed-42.
2. Scenario chemistry tweaks land in 8c-4:
   - Bisbee: add Ni=70, bump Co=trace → Co=80
   - Bisbee: optionally bump As (currently in trace) to ensure cobaltite + nickeline + erythrite + annabergite all see threshold
   - Optionally tweak `scenario_radioactive_pegmatite` for high-T Ni-Co scenarios
3. Baseline regen catches the new realizations.

This is the same "ship engine, then activate" pattern Round 5 used for barite/celestine (sulfates landed before the MVT O2 bump that enabled them).

### Refresh existing narrators

After 8c lands, the existing `_narrate_erythrite` and `_narrate_annabergite` should reference their primary parents (cobaltite + nickeline). Quick refactor — one extra paragraph each. Worth doing in the same round so the parent-product narrative chain reads end-to-end.

```python
# In _narrate_erythrite, add:
parts.append(
    "Erythrite is what cobaltite becomes when it weathers. The parent "
    "cobaltite cubes (silvery-white in the unweathered ore) oxidize to "
    "release Co²⁺ and AsO₄³⁻; together they crystallize as erythrite's "
    "diagnostic crimson-pink prisms. Bou Azzer (Morocco) and Cobalt, "
    "Ontario both show the full primary → supergene chain visible in "
    "outcrop."
)
```

### Locality chemistry adjustments

After 8c-4 lands, add `mineral_realizations_v8c_nico_sulfarsenides` blocks for any locality where Ni or Co was bumped:

- `bisbee.mineral_realizations_v8c_nico_sulfarsenides.cobaltite + nickeline + (existing) annabergite + (existing) erythrite` — full chain
- Document `absent_at_seed_42` for `tsumeb` (Tsumeb is Pb-Zn-Cu-As, no significant Co/Ni — correctly absent), `tri_state` (MVT, no Co/Ni), `cruzeiro` (pegmatite, no Co/Ni), etc.

The `intentionally_zero` block on each affected locality should be updated:
```json
{
  "Co": "below cobaltite gate (<50 ppm) — Tri-State brine carries no Co",
  "Ni": "below nickeline/millerite gate — no Ni in MVT brine source"
}
```

This keeps the schema-completeness audit clean.

---

## Automated testing expectations

**+24 parameterized tests** (4 + 8 per species × 3) for free.

**Three species-specific tests worth adding:**

1. **The three-element gate for cobaltite:**

```python
def test_cobaltite_requires_all_three(vugg):
    """Cobaltite (CoAsS) needs Co + As + S simultaneously. Drop any one
    to zero and σ must be 0."""
    # ... three subtests, each zeroing one of Co/As/S; assert all return 0
```

2. **The dormant-element-zero-sigma sanity check** — until a scenario carries Ni > 40 ppm, no nickeline / millerite should fire in any seed-42 scenario:

```python
def test_round_8c_dormant_until_scenario_tuned(vugg):
    """Pre-tweak: nickeline + millerite + cobaltite never fire in
    any seed-42 baseline scenario. Becomes obsolete after 8c-4 lands."""
    # ... iterate all SCENARIOS; assert no zone count > 0 for any of the three
```

This test gets DELETED in the same commit that 8c-4 enables seed-42 hits — it's a temporary pre-tweak guardrail, not a permanent test.

3. **The primary → supergene chain integrity** — after 8c-4 lands, Bisbee should show cobaltite + nickeline + (existing) erythrite + annabergite all in seed-42 output:

```python
def test_bisbee_full_nico_chain(vugg):
    """Post-Round-8c, Bisbee at seed-42 should produce cobaltite (primary,
    high-T phase) + erythrite (its supergene oxidation product), AND
    nickeline (primary) + annabergite (its supergene product). Validates
    the full primary → secondary chain is engineered correctly."""
    # ... read tests/baselines/seed42_v<N>.json; assert all four present
```

This is the round's pedagogical signature — the chain reads correctly in the live game.

**Scenario regression:** Bumping Ni + Co at Bisbee is a chemistry change → SIM_VERSION bump (8 → 9 if 8a/8b have already taken 7→8, or 7→8 if 8c ships first). Baseline regen + commit alongside.

**Total test suite** post-Round-8c: ~895 → ~925 passing.

---

## Sources

The boss's research files are the primary specification:
- `research/research-cobaltite.md` (canonical commit `f2939da`)
- `research/research-millerite.md`
- `research/research-nickeline.md`

Additional references for the implementation reviewer:
- Petruk, W. (1971). "The silver-arsenide deposits of the Cobalt-Gowganda region, Ontario." *Canadian Mineralogist* 11: 1–7. [The classic Cobalt Ontario paragenesis study]
- Markl, G., Marks, M.A.W., Holzäpfel, J., & Wenzel, T. (2014). "Major and trace element composition of fluorites from Schwarzwald: implications for sources, hydrothermal fluid evolution and post-depositional alteration." *Mineralogy and Petrology* 108: 745–770. [Vein-deposit Co paragenesis context]
- Pirajno, F. (2009). *Hydrothermal Processes and Mineral Systems*. Springer. [Chapter on Five Element / NiCoAg veins covers Cobalt Ontario, Bou Azzer, Khetri]

---

🪨
