# MINERALS-PROPOSAL-ROUND-9 — Supergene Carbonates + Uranium Suite

**Status:** Research complete, awaiting builder implementation
**Minerals:** 5 new species
**New mechanics:** broth-ratio branching (Cu:Zn determines which mineral nucleates)
**Paragenetic context:** Supergene oxidation zone continuation

---

## Species List

### 1. Rosasite — (Cu,Zn)₂(CO₃)(OH)₂
- **Crystal system:** Monoclinic
- **Habit:** Velvety blue-green botryoidal spheres, radiating fibrous internal structure
- **Hardness:** 4
- **Color:** Blue-green (Cu-dominant)
- **Luster:** Silky to vitreous
- **Mechanic:** **Broth-ratio branching** — nucleates when Cu:Zn > 1 in the fluid. Competes directly with aurichalcite; the ratio determines which forms
- **Growth environment:** Supergene oxidation zone, Cu-Zn sulfide deposits
- **Paragenesis:** chalcopyrite + sphalerite → weather → Cu²⁺ + Zn²⁺ + CO₃²⁻ → rosasite (if Cu>Zn) OR aurichalcite (if Zn>Cu)
- **Research file:** `memory/research-rosasite.md`

### 2. Aurichalcite — (Zn,Cu)₅(CO₃)₂(OH)₆
- **Crystal system:** Monoclinic
- **Habit:** Delicate pale blue-green tufted sprays, acicular crystal aggregates
- **Hardness:** 2
- **Color:** Pale blue-green, sky blue (Zn-dominant)
- **Luster:** Pearly to silky
- **Mechanic:** **Broth-ratio branching** — nucleates when Zn:Cu > 1. The mirror twin of rosasite; same parent fluid, different outcome
- **Growth environment:** Supergene oxidation zone, same as rosasite
- **Paragenesis:** Same parent weathering sequence; Zn dominance produces aurichalcite instead of rosasite
- **Named for:** Plato's mythical orichalcum — the lost metal of Atlantis. The mineral is the oxidation product of the ore that may have been orichalcum
- **Research file:** `memory/research-aurichalcite.md`

### 3. Torbernite — Cu(UO₂)₂(PO₄)₂·8-12H₂O
- **Crystal system:** Tetragonal
- **Habit:** Thin emerald-green tabular plates, micaceous habit, can flake
- **Hardness:** 2-2.5
- **Color:** Emerald green (Cu + U chromophore)
- **Luster:** Vitreous, pearly on cleavage
- **Mechanic:** **Anion competition** — nucleates when phosphate is the dominant anion at a U⁶⁺ oxidation site. Competes with zeunerite (arsenate) and carnotite (vanadate) for the same uranyl ion
- **Growth environment:** Oxidation zone of uranium deposits, granite pegmatites
- **Special:** Dehydrates irreversibly to meta-torbernite (loses water layers, structure collapses). Radioactive (gamma emitter). Non-fluorescent (Cu²⁺ quenches)
- **Research file:** `memory/research-torbernite.md`

### 4. Carnotite — K₂(UO₂)₂(VO₄)₂·3H₂O
- **Crystal system:** Monoclinic (appears orthorhombic in crust habit)
- **Habit:** Canary yellow earthy crusts, powdery coatings, rarely crystalline
- **Hardness:** ~2 (soft, earthy)
- **Color:** Canary yellow to greenish-yellow (UO₂²⁺ + V chromophore)
- **Luster:** Dull, earthy to waxy
- **Mechanic:** **Anion competition** — nucleates when vanadate dominates. The V-branch of the uranium oxidation suite
- **Growth environment:** Sandstone-hosted uranium deposits (Colorado Plateau type), oxidized vanadium-uranium ores
- **Special:** Principal uranium ore mineral in the American West. Non-fluorescent (vanadate matrix quenches). Radioactive. Dehydrates to meta-carnotite
- **Research file:** `memory/research-carnotite.md`

### 5. Zeunerite — Cu(UO₂)₂(AsO₄)₂·10-16H₂O
- **Crystal system:** Tetragonal
- **Habit:** Emerald-green tabular tablets, isostructural with torbernite
- **Hardness:** 2-2.5
- **Color:** Emerald green (visually identical to torbernite)
- **Luster:** Vitreous, pearly
- **Mechanic:** **Anion competition** — nucleates when arsenate dominates. The As-branch of the uranium suite. Isostructural with torbernite; distinguishable only by anion content
- **Growth environment:** Oxidation zone of arsenic-bearing uranium deposits
- **Special:** Dehydrates to meta-zeunerite. Radioactive. Non-fluorescent. Visually indistinguishable from torbernite without chemical tests — "the arsenic twin"
- **Research file:** `memory/research-zeunerite.md`

---

## New Mechanics

### Broth-Ratio Branching
The first mineral pair where the **ratio of elements in the fluid** determines which species nucleates, rather than the presence/absence of a single element.

- Rosasite: Cu/(Cu+Zn) > 0.5
- Aurichalcite: Zn/(Cu+Zn) > 0.5

Both consume the same elements. Once one nucleates, it locks up the limiting reagent, preventing the other from forming nearby. This creates spatial zonation — rosasite near copper-rich zones, aurichalcite near zinc-rich zones, with a mixing boundary.

Implementation: check `conditions.fluid` Cu and Zn concentrations at nucleation. Branch based on ratio.

### Anion Competition (Uranium Suite)
Three minerals competing for the same U⁶⁺ cation, differentiated only by which anion (PO₄³⁻, AsO₄³⁻, VO₄³⁻) dominates at the nucleation site.

- Torbernite: phosphate dominant
- Zeunerite: arsenate dominant
- Carnotite: vanadate dominant

Same implementation pattern as broth-ratio branching, but checking anion concentrations. Creates natural zonation in uranium deposits based on local anion availability.

---

## Groupings for Builder

**Pair 1 (broth-ratio branching):** rosasite + aurichalcite — implement together, same mechanic, test the ratio threshold

**Pair 2 (anion competition):** torbernite + zeunerite — isostructural, implement together, test phosphate vs arsenate branching

**Singleton:** carnotite — different crystal system, different habit, same anion-competition mechanic as pair 2 but tested independently

---

## Paragenetic Context

These minerals extend the existing supergene oxidation zone:
- **Existing:** chalcocite → cuprite → native_copper → malachite → azurite (copper oxidation chain)
- **Round 9 adds:**
  - Cu-Zn branch: chalcopyrite + sphalerite weather → rosasite/aurichalcite
  - Uranium branch: uraninite oxidize → U⁶⁺ + anion → torbernite/carnotite/zeunerite

All five are oxidation-zone minerals. All form from the weathering of primary sulfides/oxides. The branching mechanics make them the most chemically nuanced pair/group in the simulator.

---

## Research Files

All five species have complete research files in `memory/`:
- `memory/research-rosasite.md`
- `memory/research-aurichalcite.md`
- `memory/research-torbernite.md`
- `memory/research-carnotite.md`
- `memory/research-zeunerite.md`

Builder should read each file for detailed crystallography, habit specifics, and growth conditions before implementation.
