# Mineral Research Compendium — Unimplemented Species

**Purpose:** Full mineralogy research for minerals not yet in the simulator. Builder can use these as reference when writing growth engines, narrative text, and habit dispatch.

**Current game:** 51 minerals. **Research below covers:** species with full research files that are NOT yet implemented.

**Template reference:** `proposals/vugg-mineral-template.md`

---

## 1. Arsenopyrite — FeAsS

**Class:** Sulfide (#7feb13) | **System:** Monoclinic (pseudo-orthorhombic) | **H:** 5.5–6
**Formula:** FeAsS

### Identity
- Iron arsenic sulfide. The most common arsenic-bearing mineral.
- Striated prismatic habit, rhombic cross-section (diamond-shaped). Metallic silver-white.
- Garlic odor when struck (arsenic vapor — diagnostic).
- **Gold association:** Arsenopyrite is the #1 gold-trapping mineral. Its crystal lattice accommodates Au atoms up to ~1,500 ppm as "invisible gold" — gold that's structurally bound, not free particles. Major gold ore mineral.

### Formation Conditions
- **Temperature:** 300–500°C (orogenic gold deposits, mesothermal veins)
- **pH:** 3–6 (acidic to neutral, reducing)
- **Eh:** Reducing (low O₂ — arsenic must be As⁻¹, not oxidized)
- **Consumes:** Fe, As, S
- **Optional:** Co (substitutes for Fe up to ~9% → cobaltian arsenopyrite), Au (trace, structurally trapped), Sb (minor substitution)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| striated_prism | default | Diamond-cross-section prisms with deep longitudinal striations |
| rhombic_blade | moderate σ | Flattened rhombic blades |
| acicular | fast growth, high σ | Thin needle-like aggregates |
| massive_granular | very high σ | Granular masses, no visible crystals |

### Key Mechanic
Arsenopyrite is the **arsenic gateway mineral.** When it oxidizes, it releases As into solution as arsenate (AsO₄³⁻), which feeds the entire arsenate supergene suite: scorodite, erythrite, annabergite, mimetite, adamite, pharmacosiderite. In the simulator, an `event_arsenopyrite_oxidation` would convert arsenopyrite → scorodite + release Fe + AsO₄³⁻ + H₂SO₄.

**Pseudocode:**
```
IF Fe > threshold AND As > threshold AND S available AND T 300-500 AND Eh < reducing
  → nucleate arsenopyrite
Oxidation: arsenopyrite + O₂ + H₂O → scorodite + H₂SO₄
  → releases AsO₄³⁻ for downstream arsenates
```

### Paragenesis
- **Forms AFTER:** High-T hydrothermal fluids (orogenic gold systems)
- **Forms BEFORE:** Scorodite (oxidation product), erythrite/annabergite (if Co/Ni present)
- **Commonly associated with:** Pyrite, pyrrhotite, chalcopyrite, quartz, gold (invisible), loellingite (FeAs₂)
- **Gold content:** Up to 1,500 ppm Au structurally bound. "Refractory gold ore" — needs roasting or pressure oxidation to liberate.

### Color
- Silver-white to steel-gray metallic. Tarnishes yellowish.
- **Co-bearing:** Slight pinkish tinge in cobaltian specimens.

### Stability
- Stable under reducing conditions
- **Oxidation:** Converts to scorodite (FeAsO₄·2H₂O) in oxidizing acidic conditions
- **Decomposition at high T:** >700°C → decomposes to loellingite + arsenic vapor

---

## 2. Scorodite — FeAsO₄·2H₂O

**Class:** Arsenate (#13eb13) | **System:** Orthorhombic | **H:** 3.5–4
**Formula:** FeAsO₄·2H₂O

### Identity
- Iron arsenate dihydrate. The most common supergene oxidation product of arsenopyrite.
- Pseudo-octahedral dipyramids (looks cubic but isn't). Pale blue-green to greenish-brown.
- Most stable arsenic sequestration mineral under acidic oxidizing conditions — nature's way of locking up arsenic.

### Formation Conditions
- **Temperature:** <100°C (supergene/weathering zone)
- **pH:** 2–5 (acidic — scorodite is the acidic-end arsenate; pharmacosiderite takes over at higher pH)
- **Eh:** Oxidizing (Fe must be Fe³⁺, As must be As⁵⁺)
- **O₂:** ≥ 0.3
- **Consumes:** Fe³⁺, AsO₄³⁻ (from arsenopyrite oxidation)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| dipyramidal | default | Pseudo-octahedral dipyramids, blue-green, on arsenopyrite matrix |
| earthy_crust | low σ, fast growth | Powdery greenish-brown crust on weathered arsenopyrite |
| crystallized_on_arsenopyrite | arsenopyrite substrate present | Distinct crystals nucleating directly on parent mineral |

### Key Mechanic
Scorodite is the **arsenic sequestration mineral.** It forms when arsenopyrite oxidizes and locks the arsenic into a relatively stable crystal. In the simulator:
- Arsenopyrite + O₂ + H₂O → Scorodite + H₂SO₄
- Scorodite is more stable than amorphous iron arsenate but still dissolves at pH > 5
- Below pH 5: scorodite is stable (arsenic locked up)
- Above pH 5: scorodite dissolves, releasing AsO₄³⁻ for other arsenates

**Pseudocode:**
```
IF Fe³⁺ available AND AsO₄³⁻ available AND T < 100 AND pH < 5 AND O₂ ≥ 0.3
  → nucleate scorodite
Dissolution: IF pH > 5 → scorodite dissolves, releases Fe + AsO₄³⁻
Dehydration: IF T > 160°C → loses water, converts to anhydrous FeAsO₄
```

### Color
- Pale blue-green (diagnostic for scorodite vs other arsenates)
- Can be greenish-white, grayish-green, brownish
- Blue specimens = more Fe³⁺, green = intermediate, brown = partially dehydrated

### Fluorescence
- Generally none

### Notable
- Type locality: Freiberg, Saxony, Germany
- Famous specimens: Tsumeb (Namibia) produces world-class scorodite crystals — deep blue-green dipyramids to several cm

---

## 3. Ferrimolybdite — Fe₂(MoO₄)₃·8H₂O (or Fe₂(MoO₄)₃·nH₂O)

**Class:** Molybdate (#eb13eb — same as wulfenite) | **System:** Orthorhombic | **H:** ~2
**Formula:** Fe₂(MoO₄)₃·nH₂O (hydration variable)

### Identity
- Iron molybdate hydrate. Canary-yellow to sulfur-yellow acicular tufts.
- The "no-lead branch" of molybdenum oxidation — forms when molybdenite oxidizes but galena is absent.
- Fast-growing, powdery/fibrous, rarely forms good crystals. Usually seen as yellow fuzz on weathered molybdenite.

### Formation Conditions
- **Temperature:** <50°C (supergene/weathering zone)
- **pH:** 3–6 (acidic, typical of sulfide oxidation)
- **Eh:** Oxidizing (Mo must be Mo⁶⁺ as molybdate MoO₄²⁻)
- **O₂:** ≥ 0.3
- **Consumes:** Fe³⁺, MoO₄²⁻ (from molybdenite oxidation)
- **Key condition:** Pb must be ABSENT or very low — if Pb is present, wulfenite (PbMoO₄) wins instead

### Habits
| Variant | Trigger | Description |
|---|---|---|
| acicular_tuft | default | Canary-yellow hair-like radiating tufts on molybdenite |
| powdery_crust | fast growth, high σ | Earthy yellow powder coating |
| fibrous_mat | on fracture surfaces | Dense yellow fibrous mats |

### Key Mechanic
Ferrimolybdite is the **Mo-without-Pb mineral.** The molybdenum oxidation pathway forks:
- **Pb present** → wulfenite (PbMoO₄) — the spectacular, slow-growing option
- **Pb absent** → ferrimolybdite (Fe₂(MoO₄)₃·nH₂O) — the fast, common option

In the simulator, both can coexist: ferrimolybdite nucleates first (fast, grows on molybdenite surface), then wulfenite nucleates if Pb is also present (slower, forms distinct crystals). They don't compete for the same cation (Fe vs Pb), only for MoO₄²⁻.

**Pseudocode:**
```
IF MoO₄²⁻ available AND Fe³⁺ available AND Pb < threshold AND T < 50 AND O₂ ≥ 0.3
  → nucleate ferrimolybdite (fast growth)
IF MoO₄²⁻ available AND Pb²⁺ available AND T < 50 AND O₂ ≥ 0.3
  → nucleate wulfenite (slower growth, can coexist with ferrimolybdite)
```

### Color
- Canary yellow to sulfur yellow (diagnostic)
- Bright, distinctive — the yellow is from Fe³⁺-MoO₄ charge transfer

### Stability
- Dehydrates at moderate temperature
- Dissolves in acid
- Relatively uncommon in collections despite being geologically widespread — collectors walk past the yellow fuzz to get to wulfenite

### Notable
- Common at Climax (Colorado), Kingman (Arizona), porphyry Cu-Mo deposits worldwide
- Geologically MORE common than wulfenite (forms anywhere Mo oxidizes without Pb)
- Much LESS represented in collections (not a display mineral)

---

## 4. Molybdenite (expanded research) — MoS₂

**Note:** Molybdenite is already in the game. This research is provided for the expanded paragenetic sequence (arsenopyrite → scorodite → ferrimolybdite/wulfenite pathway).

### Key Expansion Points
- **Molybdenite oxidation:** MoS₂ + O₂ + H₂O → MoO₄²⁻ (molybdate) + SO₄²⁻ + H⁺
- The released MoO₄²⁻ feeds BOTH wulfenite (if Pb present) and ferrimolybdite (if Pb absent)
- **Co-occurrence with arsenopyrite:** Many porphyry deposits have both Mo and As, meaning the molybdate and arsenate oxidation sequences run in parallel
- **Gold association:** Molybdenite in porphyry systems often co-occurs with gold (same hydrothermal fluids)

### Simulator Integration
- Existing `molybdenite` entry already works as primary sulfide
- Add oxidation event: `molybdenite + O₂ → MoO₄²⁻ + SO₄²⁻`
- MoO₄²⁻ becomes available fluid species for wulfenite/ferrimolybdite nucleation
- **No changes needed to existing molybdenite** — just the oxidation product chain

---

## 5. Wulfenite (expanded research) — PbMoO₄

**Note:** Wulfenite is already in the game. This research covers the paragenetic context for the ferrimolybdite/wulfenite fork and the arsenopyrite-gold connection.

### Key Expansion Points
- **Two-source mineral:** Requires BOTH molybdenite oxidation (MoO₄²⁻ source) AND galena oxidation (Pb²⁺ source) — two separate primary minerals must oxidize to produce it
- **Competes for Pb with:** pyromorphite (needs PO₄³⁻), mimetite (needs AsO₄³⁻ + Cl⁻), vanadinite (needs VO₄³⁻)
- **Co-occurs with ferrimolybdite:** Both can form in the same specimen — ferrimolybdite as yellow fuzz, wulfenite as amber plates
- **Habit diversity:** tabular (most common), pyramidal, bipyramidal, acicular — habit controlled by supersaturation and temperature

### Simulator Integration
- Existing `wulfenite` entry covers the basics
- Add competition mechanic: if both AsO₄³⁻ and MoO₄²⁻ are present with Pb²⁺, mimetite and wulfenite compete
- Add ferrimolybdite co-nucleation: if MoO₄²⁻ present but Pb²⁺ is limiting, some Mo goes to ferrimolybdite instead
- **Wulfenite overpopulation** is a known issue — the cap at 1.3mm per crystal helps but the fork mechanic (some Mo → ferrimolybdite instead) naturally limits wulfenite production

---

## Implementation Notes

### Paired Minerals (build together)
1. **Arsenopyrite + Scorodite** — primary sulfide + its oxidation product. Share `event_arsenopyrite_oxidation`. Scorodite is the gateway to the arsenate supergene suite.

2. **Ferrimolybdite** — standalone, but naturally pairs with existing molybdenite/wulfenite. The fork mechanic (Pb present → wulfenite, Pb absent → ferrimolybdite) is the key addition.

### New FluidChemistry Needs
- No new elements required — Fe, As, Mo, Pb, S, O₂ all exist
- But need **oxidation states tracked**: Fe²⁺ vs Fe³⁺, As³⁻ vs As⁵⁺ (as AsO₄³⁻), Mo⁴⁺ vs Mo⁶⁺ (as MoO₄²⁻)
- These are already partially tracked via Eh

### Scenario Integration
- **Porphyry scenario:** Add arsenopyrite to primary sulfides, scorodite + ferrimolybdite to oxidation zone
- **Supergene oxidation scenario:** Arsenopyrite oxidation → scorodite → (if pH rises) releases AsO₄³⁻ → erythrite/annabergite/mimetite
- **Bisbee scenario:** Already has the Cu suite; arsenopyrite + scorodite would add the As pathway that's realistic for this deposit

### Priority
Low — these minerals expand the arsenate/molybdate oxidation pathways but aren't needed for the core game loop. Build after Round 4 (sulfates/halite) and the chemistry audit.

---

## Full Research Files (for deeper reference)
- `memory/research-arsenopyrite.md` — full mineralogy
- `memory/research-scorodite.md` — full mineralogy
- `memory/research-ferrimolybdite.md` — full mineralogy
- `memory/research-molybdenite.md` — expanded paragenesis
- `memory/research-wulfenite.md` — expanded paragenesis
