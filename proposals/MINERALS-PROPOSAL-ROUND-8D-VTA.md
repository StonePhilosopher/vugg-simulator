# Round 8d — Vanadate, Tungstate, Arsenate Suite

**Status:** Implementation proposal. Five new species: `descloizite`, `mottramite`, `raspite`, `stolzite`, `olivenite`. All chemistry already plumbed (Pb, Zn, Cu, V, W, As, Fe, O2). No schema bumps. **Heaviest of the Round 8 sub-rounds** — 5 species, three small chemistry families. Worth splitting into sub-commits but should ship as a single proposal.

**Template reference:** `proposals/vugg-mineral-template.md`

**Source-of-truth research files** (boss's commit `f2939da`):
- `research/research-descloizite.md`
- `research/research-mottramite.md`
- `research/research-raspite.md`
- `research/research-stolzite.md`
- `research/research-olivenite.md`

**Class assignments:**
- `descloizite` (PbZnVO₄(OH)) — `phosphate` (vanadates fold here per template §1)
- `mottramite` (PbCu(VO₄)(OH)) — `phosphate`
- `raspite` (PbWO₄ monoclinic) — `molybdate` (tungstates fold with molybdates per template; both share the same XO₄²⁻ anion family)
- `stolzite` (PbWO₄ tetragonal) — `molybdate`
- `olivenite` (Cu₂AsO₄(OH)) — `arsenate`

**Schema readiness:** zero new fields needed. V (existing — currently powers ruby-violet sapphire flag from Round 7), W (already declared, currently dormant), As (existing — powers arsenopyrite/scorodite), Pb / Zn / Cu / Fe / O2 all live.

**Scenarios most-likely-affected at seed-42:**
- `supergene_oxidation` (Tsumeb) — Tsumeb is THE locality for descloizite + mottramite. Both highly likely to fire at seed-42.
- `supergene_oxidation` for olivenite — Cu + As both present at Tsumeb in oxidation zone.
- `bisbee` — Cu + As supergene → olivenite likely
- Tungstates: NO scenario currently carries W > 0. Seed-42 hit requires a scenario tweak (or the W stays as an "available via favorable_fluid test" species pre-tuning).

---

## Implementation pairing

Five engine commits in three small families + one closeout:

| Commit | Family | Species | Mechanism |
|---|---|---|---|
| **8d-1** | Vanadates | `descloizite` + `mottramite` | Pb-Zn-V vs Pb-Cu-V solid-solution pair. **Tsumeb's diagnostic vanadate suite.** Activates dormant V → vanadate paragenesis. |
| **8d-2** | Tungstates | `raspite` + `stolzite` | PbWO₄ dimorphs (raspite monoclinic, stolzite tetragonal). Same compound, same chemistry; different crystal systems. **First polymorph pair after argentite/acanthite.** |
| **8d-3** | Arsenate | `olivenite` | Cu₂AsO₄(OH). The Cu-arsenate analog of adamite (Zn-arsenate, already in sim). Standalone — no dimorph pairing. |
| **8d-4** | Scenario tuning + locality realizations + SIM_VERSION + baseline regen | All affected scenarios | Add W to a Pb-bearing scenario for tungstate seed-42 hits. Update Tsumeb realization blocks. |

---

## 1. Descloizite + Mottramite — the Pb-V solid-solution pair

These two share enough that they belong in the same commit + same engine helper:

| Property | Descloizite | Mottramite |
|---|---|---|
| Formula | Pb(Zn,Cu)VO₄(OH) | Pb(Cu,Zn)VO₄(OH) |
| Required: | Pb ≥ 100, Zn ≥ 50, V ≥ 10 | Pb ≥ 100, Cu ≥ 50, V ≥ 10 |
| T range | 20-80°C (supergene) | 20-80°C (supergene) |
| pH | 5-8 | 5-8 |
| Eh | Oxidizing | Oxidizing |
| Color | dark cherry-red to brown | yellow-green to dark green |
| Habit | dipyramidal, drusy crusts | radiating tufts, drusy, botryoidal |
| Stability fork | dominates when Zn > Cu | dominates when Cu > Zn |

**The solid-solution mechanic:** descloizite and mottramite form a continuous series. In a fluid carrying both Cu and Zn:
- Cu/Zn > 1 → mottramite
- Cu/Zn < 1 → descloizite
- Cu/Zn ≈ 1 → either, color-zoned

Implementation pattern — shared `_pb_vanadate_base_sigma()` helper, two engines with the metal-ratio fork:

```python
def supersaturation_descloizite(self) -> float:
    if self.fluid.Cu > self.fluid.Zn:
        return 0  # mottramite takes priority
    if self.fluid.Pb < 100 or self.fluid.Zn < 50 or self.fluid.V < 10:
        return 0
    return self._pb_vanadate_base_sigma() * min(self.fluid.Zn / 100.0, 2.0)

def supersaturation_mottramite(self) -> float:
    if self.fluid.Zn >= self.fluid.Cu:
        return 0  # descloizite takes priority
    # ... similar
```

**Habits** (research files list 3-4 each):

*Descloizite:*
1. **dipyramidal** — sharp pseudo-octahedral crystals (Berg Aukas Namibia signature)
2. **drusy_crust** — cherry-red coating on cavity walls
3. **botryoidal** — bulbous reniform masses

*Mottramite:*
1. **radiating_tufts** — yellow-green spray (Tsumeb/Mammoth-St. Anthony Arizona)
2. **drusy** — green crust on Pb-Cu oxidation zones
3. **botryoidal** — same shape family as descloizite

**Paragenesis:** Both form in the supergene oxidation zone of Pb-Zn or Pb-Cu deposits where wall-rock vanadium has been mobilized. Forms AFTER primary sulfides (galena, sphalerite, chalcopyrite) have oxidized. Forms BEFORE later carbonate (cerussite, malachite) replacements. Companions: vanadinite, wulfenite, cerussite, anglesite, hemimorphite, limonite, calcite.

**Sim-specific notes:**
- **Tsumeb ALREADY has V=trace populated** in the Round 7 audit (V is needed for the violet-sapphire flag at Mogok and was incidentally added to Tsumeb's chemistry). Plus Tsumeb has Pb + Zn + Cu in abundance. Both species expected to fire at seed-42.
- The Cu/Zn fork is geologically authentic — Tsumeb's mottramite-dominant zone vs Berg Aukas's descloizite-dominant zone is exactly that ratio.
- After 8d-1 lands, the existing `_narrate_vanadinite` should reference descloizite + mottramite as paragenetic companions (currently vanadinite stands alone in the narrator).

---

## 2. Raspite + Stolzite — the PbWO₄ dimorphs

Same compound (PbWO₄), different crystal systems. Chemistry-identical engines, T-window differs slightly:

| Property | Raspite (monoclinic) | Stolzite (tetragonal) |
|---|---|---|
| Required: | Pb ≥ 100, W ≥ 5 | Pb ≥ 100, W ≥ 5 |
| T range | 10-50°C (rare; the monoclinic polymorph) | 10-100°C (more thermodynamically stable in supergene zone) |
| Stability gate | Forms specifically when conditions favor monoclinic — typically lower T, higher pH | Forms over a wider T window; the dominant PbWO₄ polymorph |
| Color | light yellow to amber | yellow to red-brown |
| Habit | tabular blades, very rare | dipyramidal pseudo-octahedra, the dominant form |

**The polymorph mechanic:** Both can form together; raspite is RARE compared to stolzite (raspite is the metastable polymorph in surface conditions). For the sim:
- Stolzite is the default — fires when Pb + W are above threshold in supergene oxidizing fluid
- Raspite has an additional gate making it rarer (e.g., higher pH 6.5-8.0, or a low-σ stochastic gate so it fires only ~10% of the time when chemistry allows stolzite)

This is **different** from the argentite ↔ acanthite transition (Round 8a):
- Argentite/acanthite: same compound, T-DRIVEN paramorph (one converts to the other when temperature crosses 173°C)
- Raspite/stolzite: same compound, but they CO-EXIST in nature — both stable at ambient T; the choice is kinetically controlled, not thermodynamically. Sim should reflect this with two independent engines + a stochastic prefer-stolzite weighting.

**Sim-specific notes:**
- **W is currently dormant in EVERY scenario.** No seed-42 hit possible until the scenario-tuning step in 8d-4. Possible tweaks:
  - Add W=20 to `bisbee` (Bisbee has documented trace W in some hypogene phases per Graeme et al.)
  - Add W=15 to `tsumeb` (Tsumeb has minor scheelite documented per Strunz 1959)
  - Both keep W trace; both produce seed-42 stolzite/raspite if chemistry crosses threshold.
- Both raspite + stolzite form ONLY in supergene Pb-bearing systems where wall-rock tungsten (typically scheelite CaWO₄ or wolframite Fe-MnWO₄, neither in sim) has been oxidized and mobilized.
- This is the **first tungstate family in the sim**. Pure educational value — gives players a distinct mineral category they haven't seen.

**Habits:**
- Raspite: tabular blades, monoclinic
- Stolzite: dipyramidal pseudo-octahedra (looks octahedral despite tetragonal — like scorodite + corundum-family habit projection)

---

## 3. Olivenite — Cu₂AsO₄(OH)

**Chemistry summary:**
- Required: Cu ≥ 50, As ≥ 10
- T range: 10-50°C, optimum 20-40°C (low-T supergene)
- pH 4-7
- Eh oxidizing, O2 > 0.5
- Inhibitors: high Fe³⁺ (competes for AsO₄³⁻ → scorodite); high CO₃²⁻ (Cu → malachite/azurite)

**Habits:**
1. **acicular_radial** — slender olive-green needles in radiating clusters. The species name comes from the "olive" green color.
2. **botryoidal_crust** — bulbous green coating
3. **prismatic** — short stubby crystals

**Paragenesis:**
- Forms AFTER: arsenopyrite, tennantite, enargite (primary As-bearing sulfides) oxidize to release As; chalcopyrite/bornite/chalcocite oxidize to release Cu
- Forms BEFORE: oxidation continues → malachite/azurite (carbonate phases) replace olivenite if CO₃²⁻ rises
- Companions: malachite, azurite, libethenite (Cu phosphate analog — not in sim), clinoclase, **adamite (Zn-arsenate)** — the natural pairing
- Companions in sim: malachite, azurite, adamite, scorodite, cuprite, native_copper

**Color rules:** dark olive-green to forest-green (Cu chromophore). Some specimens almost black. No fluorescence.

**Sim-specific notes:**
- Olivenite is the **Cu twin of adamite** (already in sim — Zn₂AsO₄(OH)). Adamite-olivenite is a partial solid-solution series. Same mechanic possible:
  - Pure olivenite: Cu/Zn high, fully dark green
  - Pure adamite: Cu/Zn low, yellow-green to honey-yellow
  - Cu-bearing adamite ("cuproadamite"): intermediate green, already mentioned in adamite spec entry
- The existing adamite engine narrates "cuproadamite green" in zones with high Cu — that pathway was a pre-emptive nod to olivenite. After 8d-3 lands, when Cu > Zn, olivenite fires; otherwise adamite fires. Solid-solution dispatch shape:

```python
def supersaturation_olivenite(self) -> float:
    if self.fluid.Zn > self.fluid.Cu:
        return 0  # adamite takes priority
    if self.fluid.Cu < 50 or self.fluid.As < 10:
        return 0
    # ... rest of supersaturation
```

- Tsumeb + Bisbee both have Cu + As in supergene oxidation zone → both candidates for seed-42 hit.

---

## Cross-cutting implementation notes

### Three different polymorph/solid-solution patterns

Round 8d showcases three distinct geological pairing mechanics:

| Pair | Same? | Mechanism | Sim pattern |
|---|---|---|---|
| Argentite ↔ Acanthite (Round 8a) | Same compound | T-driven paramorph (173°C) | One engine fires; per-step thermal hook converts crystal in-place |
| Descloizite ↔ Mottramite (8d-1) | Solid solution | Cu/Zn ratio fork | Two engines, exclusion preconditions check the ratio |
| Raspite ↔ Stolzite (8d-2) | Polymorphs | Kinetic preference (both stable; stolzite favored) | Two engines, both can fire from same fluid; stolzite has higher nucleation probability |
| Olivenite ↔ Adamite (8d-3 + existing) | Solid solution | Cu/Zn ratio fork | Two engines, exclusion preconditions check the ratio (adamite already exists) |

The pattern library now covers the major paragenetic-pair archetypes. Worth documenting as a section in `proposals/vugg-mineral-template.md` once Round 8 ships.

### Testing the dispatchers

Each fork has a critical "the other one should fire instead" test:

```python
def test_descloizite_blocked_when_Cu_dominant(vugg):
    """Descloizite needs Zn > Cu; if Cu > Zn, mottramite fires instead."""
    # ... build fluid with Pb=200, Zn=50, Cu=200, V=20
    # ... assert sigma_descloizite == 0 AND sigma_mottramite > 0

def test_olivenite_blocked_when_Zn_dominant(vugg):
    """Olivenite needs Cu > Zn; if Zn > Cu, adamite fires instead."""
    # ... build fluid with Cu=20, Zn=200, As=20
    # ... assert sigma_olivenite == 0 AND sigma_adamite > 0
```

Both are species-specific tests in `tests/test_engine_gates.py`. Three new tests total (descloizite, mottramite, olivenite — one ratio-fork test each + adamite verification).

### Locality chemistry adjustments

After 8d-4 lands, add `mineral_realizations_v8d_vta` blocks:

- `tsumeb.mineral_realizations_v8d_vta`: descloizite, mottramite, olivenite all present (full Tsumeb V + As suite); raspite + stolzite fire if W bumped
- `bisbee.mineral_realizations_v8d_vta`: olivenite, possibly mottramite (depending on local Zn / V availability)
- Mark `intentionally_zero` for V/W in scenarios where they are correctly absent (e.g., MVT, Cruzeiro pegmatite, gem_pegmatite — though the latter has Cr/V from biotite-schist contact)

### Update existing narrators

After 8d-1 lands, `_narrate_vanadinite` should mention descloizite + mottramite as paragenetic companions. After 8d-3 lands, `_narrate_adamite` should mention olivenite as the Cu twin (and `_narrate_olivenite` should mention adamite as the Zn twin). Quick refactor — one paragraph each.

---

## Automated testing expectations

**+40 parameterized tests** (4 + 8 per species × 5 species) for free.

**Three species-specific tests added** (the dispatcher forks above).

**One round-level integration test:**

```python
def test_tsumeb_full_vta_assemblage(vugg):
    """Post-Round-8d, Tsumeb at seed-42 should produce the full vanadate-
    arsenate assemblage: descloizite + mottramite (V suite), olivenite
    (Cu-As suite), alongside the existing scorodite + adamite + cerussite
    + smithsonite chain. Validates Tsumeb's encyclopedic secondary-
    mineral assembly is faithfully simulated."""
    # ... read tests/baselines/seed42_v<N>.json
    # ... assert all four V/As species + the existing chain present at Tsumeb
```

This is the round's pedagogical payoff — Tsumeb in the sim becomes a faithful mini-encyclopedia of supergene mineralogy.

**Scenario regression:** Bumping W in one scenario + small Cu-Zn-V tweaks at Tsumeb → SIM_VERSION bump (cumulative for the Round 8 close — could be 8a/8b/8c all cumulative, or 8d alone takes 7→8 if it's the first to ship).

**Total test suite** post-Round-8d: ~925 → ~975 passing (5 species × ~9 tests + 3 dispatcher tests + 1 integration).

---

## Sources

The boss's research files are the primary specification:
- `research/research-descloizite.md` (canonical commit `f2939da`)
- `research/research-mottramite.md`
- `research/research-raspite.md`
- `research/research-stolzite.md`
- `research/research-olivenite.md`

Additional references for the implementation reviewer:
- Strunz, H. (1959). *Tsumeb, seine Erze und Sekundärmineralien*. Vienna: Mineralogical Society. [Tsumeb is the type/master locality for descloizite + mottramite + many other species]
- Embrey, P.G. & Symes, R.F. (1987). *Minerals of Cornwall and Devon*. London: British Museum. [Cornish olivenite paragenesis]
- Lombaard, A.F., Günzel, A., Innes, J., & Krüger, T.L. (1986). "The Tsumeb Lead-Copper-Zinc-Silver Deposit, South West Africa/Namibia." *Mineral Deposits of Southern Africa* 2: 1761–1782. [Tsumeb deep paragenesis]
- Birch, W.D. (2006). "Raspite occurrences and crystal habit." *The Mineralogical Record* 37(3): 257–266. [Type-locality study of raspite at Broken Hill, Australia]

---

🪨
