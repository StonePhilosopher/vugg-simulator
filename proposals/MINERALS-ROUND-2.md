# Mineral Expansion Round 2 — Builder Spec

**Template reference:** `proposals/vugg-mineral-template.md` — every mineral must declare every template field (null if N/A).
**Minerals.json is source of truth.** Sync `docs/data/minerals.json` after changes. Run `tools/sync-spec.js`.

Current count: **40 minerals**. This batch adds **7** → **47**.

---

## 1. Erythrite — Co₃(AsO₄)₂·8H₂O

**Class:** Arsenate (#13eb13) — same as existing arsenates
**Crystal system:** Monoclinic

### Simulator Parameters
- **Temperature:** 5–50°C nucleation, optimum 10–30°C, dehydrates >200°C
- **pH:** 5–8 (neutral to slightly acidic)
- **Eh:** Oxidizing (As³⁻ → AsO₄³⁻ required)
- **O₂:** ≥ 0.3 (supergene zone)
- **Consumes:** Co, As (as arsenate)
- **Competes with:** Annabergite (Ni equivalent), scorodite (Fe arsenate)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| cobalt_bloom | default, low σ | Crimson-pink earthy crust, mm-scale |
| bladed_crystal | σ > 1.5 | Rare striated blades to 5mm |
| radiating_fibrous | on primary arsenide substrate | Fibrous stellate clusters |
| botryoidal_crust | fast growth, high σ | Rounded pink aggregates |

### Nucleation Rule
```
IF Co > threshold AND arsenate_available AND T < 50 AND Eh > oxidizing AND O₂ ≥ 0.3
  → nucleate erythrite
```

### Key Detail
Shares `supersaturation_vivianite_group()` with annabergite. Co-dominant → erythrite (pink), Ni-dominant → annabergite (green). Mixed → color interpolation. **Implement as single code path with compositional branching.**

### Dissolution
Acid (pH < 4.5) or heat (>200°C) → releases Co²⁺ + AsO₄³⁻

**Full research:** See `memory/research-erythrite.md`

---

## 2. Annabergite — Ni₃(AsO₄)₂·8H₂O

**Class:** Arsenate (#13eb13)
**Crystal system:** Monoclinic

### Simulator Parameters
- **Temperature:** 5–50°C nucleation, optimum 10–30°C, dehydrates >200°C
- **pH:** 5–8
- **Eh:** Oxidizing
- **O₂:** ≥ 0.3
- **Consumes:** Ni, As (as arsenate)
- **Competes with:** Erythrite (Co equivalent)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| nickel_bloom | default, low σ | Apple-green earthy crust |
| capillary_crystal | σ > 2.0 | Rare hair-like fibers |
| cabrerite | Mg present | Pale green to white, Mg-bearing |
| co_bearing | Co also present | Pinkish-green intermediate |

### Nucleation Rule
```
IF Ni > threshold AND arsenate_available AND T < 50 AND Eh > oxidizing AND O₂ ≥ 0.3
  → nucleate annabergite
```

### Key Detail
**Paired with erythrite** — single `supersaturation_vivianite_group()` function. Ni/Co ratio determines which nucleates and what color results.

**Full research:** See `memory/research-annabergite.md`

---

## 3. Tetrahedrite — Cu₁₂Sb₄S₁₃

**Class:** Sulfide (#7feb13)
**Crystal system:** Cubic (isometric)

### Simulator Parameters
- **Temperature:** 100–400°C (primary hydrothermal), optimum 200–300°C
- **pH:** 3–7
- **Consumes:** Cu, Sb, S
- **Optional:** Fe, Zn, Ag (substitute for Cu)
- **Competes with:** Tennantite (As ↔ Sb), chalcopyrite

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tetrahedral | moderate σ, slow growth | Classic tetrahedra, steel-gray metallic |
| massive | default, high σ | Granular aggregates |
| crustiform | on fracture walls | Bande`
| druzy_coating | fast growth | Fine-grained drusy surface |

### Nucleation Rule
```
IF Cu > threshold AND Sb > threshold AND S available AND T 100–400
  → nucleate tetrahedrite (Sb-dominant) OR tennantite (As-dominant)
```

### Key Detail
**Paired with tennantite** — same structure, Sb↔As endmembers. Sb-dominant → tetrahedrite. As-dominant → tennantite. Continuous solid solution. Ag-bearing tetrahedrite is an important ore of silver.

### Dissolution
Oxidation releases Cu²⁺, Sb²⁺ → secondary minerals

**Full research:** See `memory/research-tetrahedrite.md`

---

## 4. Tennantite — Cu₁₂As₄S₁₃

**Class:** Sulfide (#7feb13)
**Crystal system:** Cubic (isometric)

### Simulator Parameters
- **Temperature:** 100–400°C, optimum 150–300°C
- **pH:** 3–7
- **Consumes:** Cu, As, S
- **Optional:** Fe, Zn (substitute for Cu)
- **Competes with:** Tetrahedrite (Sb ↔ As), enargite

### Habits
| Variant | Trigger | Description |
|---|---|---|
| tetrahedral | moderate σ | Gray-black tetrahedra (indistinguishable from tetrahedrite visually) |
| massive | default | Compact granular |
| crustiform | on fracture walls | Banded crusts |

### Nucleation Rule
```
IF Cu > threshold AND As > threshold AND S available AND T 100–400
  → nucleate tennantite (As-dominant) OR tetrahedrite (Sb-dominant)
```

### Key Detail
**Paired with tetrahedrite** — implement as `supersaturation_fahlore()` with As/Sb ratio. Thin fragments transmit cherry-red light (diagnostic). Closes the arsenate oxidation loop: primary tennantite → oxidation → releases AsO₄³⁻ → erythrite/annabergite/scorodite.

**Full research:** See `memory/research-tennantite.md`

---

## 5. Apophyllite — KCa₄Si₈O₂₀(F,OH)·8H₂O

**Class:** Silicate (#1313eb)
**Crystal system:** Tetragonal (pseudo-orthorhombic)

### Simulator Parameters
- **Temperature:** 50–250°C (zeolite facies), optimum 100–200°C
- **pH:** 7–10 (alkaline, basalt alteration fluids)
- **Consumes:** K, Ca, SiO₂, F
- **Requires:** Low pressure (near-surface vesicle filling)
- **Competes with:** Stilbite, heulandite, scolecite (other zeolites)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| prismatic_tabular | default | Classic pseudo-cubic tabular crystals, transparent to white |
| hopper_growth | high σ, fast growth | Stepped/terraced faces |
| druzy_crust | very high σ | Fine-grained drusy coating |
| chalcedony_pseudomorph | after zeolite dissolution | Massive chalcedony replacing earlier zeolite blades |

### Nucleation Rule
```
IF K > threshold AND Ca > threshold AND SiO₂ > high AND F present AND T 50–250 AND pH > 7
  → nucleate apophyllite
```

### Key Detail
Stage III Deccan Traps zeolite (21–58 Ma post-eruption, per Ottens et al. 2019). Commonly carries **hematite inclusions** (needle-like phantoms = "bloody apophyllite" variety from Nashik). In game, hematite inclusions should follow the existing inclusion system — apophyllite can host hematite dots.

### Inclusions
- Hematite needles (phantom zones within crystal)
- Scolecite intergrowth (common Deccan association)

**Full research:** See `memory/research-apophyllite-tn498.md`

---

## 6. Marcasite — FeS₂ (orthorhombic dimorph of pyrite)

**Class:** Sulfide (#7feb13)
**Crystal system:** Orthorhombic

### Simulator Parameters
- **Temperature:** <240°C (unstable above, converts to pyrite)
- **pH:** <5 (acidic — this is the key distinction from pyrite)
- **Consumes:** Fe, S
- **Competes with:** Pyrite (same composition, neutral-alkaline pH favors pyrite)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| cockscomb | default, low-moderate σ | Classic aggregated tabular crystals with crested appearance |
| spearhead | on wall, moderate σ | Pyramidal terminations |
| radiating_blade | high σ | Fibrous radiating aggregates |
| tabular_plate | slow growth, low σ | Flat tabular crystals |

### Nucleation Rule
```
IF Fe > threshold AND S available AND T < 240 AND pH < 5
  → nucleate marcasite (NOT pyrite)
IF pH ≥ 5 → nucleate pyrite instead
```

### Key Detail
**pH is the switch.** Same FeS₂ composition as pyrite, but acidic conditions → marcasite, neutral/alkaline → pyrite. Marcasite is metastable — over geological time it converts to pyrite. In the simulator, marcasite should be able to **pseudomorph to pyrite** if pH rises or temperature exceeds 240°C.

### Instability
- T > 240°C → converts to pyrite (pseudomorph)
- Humidity + O₂ → decomposes to sulfuric acid + iron sulfate (museum specimens literally rot)

**Full research:** See `memory/research-pyrite-marcasite.md`

---

## 7. Wurtzite — (Zn,Fe)S (hexagonal dimorph of sphalerite)

**Class:** Sulfide (#7feb13)
**Crystal system:** Hexagonal

### Simulator Parameters
- **Temperature:** >95°C (high-T polymorph; below 95°C sphalerite is stable)
- **pH:** 3–8
- **Consumes:** Zn, S
- **Optional:** Fe (increases with temperature, same as sphalerite)
- **Competes with:** Sphalerite (same composition, low-T polymorph)

### Habits
| Variant | Trigger | Description |
|---|---|---|
| hemimorphic_crystal | moderate σ | Classic hexagonal pyramids, one end pointed, one flat (hemimorphic) |
| radiating_columnar | default, high σ | Columnar aggregates radiating from center |
| fibrous_coating | fast growth | Fibrous crusts on fracture walls |
| platy_massive | low σ | Micaceous/platy aggregates |

### Nucleation Rule
```
IF Zn > threshold AND S available AND T > 95
  → nucleate wurtzite (NOT sphalerite)
IF T ≤ 95 → nucleate sphalerite instead
```

### Key Detail
**Temperature is the switch.** Same (Zn,Fe)S as sphalerite, but >95°C → wurtzite, ≤95°C → sphalerite. Wurtzite is the high-temperature polymorph. On cooling, wurtzite can convert to sphalerite (but sphalerite rarely converts to wurtzite). Hemimorphic crystal habit = different termination at each end of the c-axis.

### Inclusions
Same as sphalerite — can host chalcopyrite disease (Cu inclusions)

**Full research:** See `memory/research-sphalerite.md` (wurtzite section)

---

## Implementation Priority

**Paired minerals should be built together:**
1. **Erythrite + Annabergite** — single `supersaturation_vivianite_group()` function, Co/Ni branching
2. **Tetrahedrite + Tennantite** — single `supersaturation_fahlore()` function, Sb/As branching
3. **Apophyllite** — standalone, but needs inclusion system support (hematite phantoms)
4. **Marcasite** — builds on existing pyrite, adds pH-gated dimorph switch
5. **Wurtzite** — builds on existing sphalerite, adds temperature-gated dimorph switch

**New FluidChemistry fields needed:**
- `Sb` (antimony) — for tetrahedrite
- `Ni` (nickel) — for annabergite (may already exist as trace)
- `Co` (cobalt) — for erythrite (may already exist as trace)

Check existing `conditions.fluid` fields before adding new ones.

---

## Checklist per Mineral
- [ ] `data/minerals.json` entry with ALL template fields
- [ ] `vugg.py`: `supersaturation_*`, `grow_*`, `MINERAL_ENGINES` registration, `check_nucleation` block
- [ ] `web/index.html`: mirror of all engine code
- [ ] `docs/data/minerals.json`: synced
- [ ] `docs/index.html`: synced
- [ ] `tools/sync-spec.js`: 0 drift
- [ ] Narrative text (`_narrate_*`) for each habit
- [ ] Scenario dropdown updated if adding to existing scenarios
