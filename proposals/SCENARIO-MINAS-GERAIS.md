# Scenario Proposal: Minas Gerais

**Date:** 2026-04-20
**Status:** Proposal — awaiting review

Two variants for a Brazilian pegmatite scenario. Both set in Minas Gerais state, Neoproterozoic Brasiliano orogeny (700–450 Ma). Both require new mineral species.

---

## Variant A: Gem Pegmatite Pocket

### Setting

A miarolitic cavity within a complex zoned pegmatite intruding metamorphic country rock at the São Francisco craton margin. The pegmatite body has already crystallized its outer shell (wall zone: microcline + quartz + muscovite + schorl). The vug is the residual pocket — the last fluid, enriched beyond belief in incompatible elements that refused to fit into common minerals.

Garimpeiros have been mining these pockets for 400 years. Some crystals are worth more than the surrounding country rock by weight. The vug you're watching form will wait half a billion years before human hands crack it open.

### Thermal Regime

| Phase | Temperature | Duration (sim steps) | Fluid state |
|-------|------------|---------------------|-------------|
| Early pegmatite crystallization | 650–550°C | ~40 | Water-rich silicate melt, flux-charged |
| Main pocket growth | 550–400°C | ~80 | Transitioning melt → hydrothermal brine |
| Late hydrothermal | 400–300°C | ~60 | Dilute hydrothermal fluid |

Total: ~180 steps. Slow cooling throughout. No quench events — this is the anti-flash-quench. Patience rewarded.

### Fluid Chemistry

The key dynamic: **incompatible element accumulation**. Be, B, Li, F, Ta, Nb don't substitute into common rock-forming minerals. They concentrate in the residual fluid until saturation forces nucleation of exotic species.

**Starting fluid composition (normalized):**
- SiO₂: 70% (decreasing as quartz/feldspar crystallize)
- Al₂O₃: 15%
- K₂O: 5% (consumed by microcline)
- Na₂O: 3% (builds, then consumed by albite)
- B₂O₃: 2% (builds — nothing takes boron early)
- F: 1.5% (builds — nothing takes fluorine early)
- BeO: 0.5% (builds — nothing takes beryllium ever, until beryl)
- Li₂O: 0.3% (builds)
- H₂O: increasing as crystallization concentrates it
- Trace: Mn²⁺, Fe²⁺, Cr³⁺ (color controllers, from country rock assimilation)

**Saturation cascade:**
1. Microcline (K-feldspar) nucleates first — consumes K, some Al, Si
2. Quartz nucleates alongside — consumes Si
3. Schorl (black tourmaline) — B finally finds a home (B + Fe²⁺ + Al + Si)
4. Muscovite — K + Al + Si + OH
5. As K depletes, Na builds → **albitization** event: albite replaces microcline
6. Be crosses saturation threshold → **beryl** nucleation event (dramatic — single enormous crystal or cluster)
7. Li + B + Al + remaining F → **elbaite** (gem tourmaline) nucleation
8. F + Al + Si → **topaz** nucleation
9. Li + Al + Si → **spodumene** nucleation
10. Ca + F → **fluorite** (late, from wall-rock contribution)
11. Late: goethite from oxidation of Fe released by schorl decomposition

### New Minerals Required (5)

#### 1. Tourmaline Group (Schorl + Elbaite)

**Species:** Tourmaline (series: schorl → elbaite)
**Formula:**
- Schorl: NaFe²⁺₃Al₆(BO₃)₃Si₆O₁₈(OH)₄
- Elbaite: Na(Li,Al)₃Al₆(BO₃)₃Si₆O₁₈(OH)₄

**Crystal system:** Trigonal
**Habits:**
- Elongated striated prisms (most common), 3-sided with rounded terminations
- Radial clusters / sprays
- Parallel growth aggregates

**Growth parameters:**
- nucleation_sigma: 1.3 (moderate — needs B + Na + specific cations aligned)
- max_size_cm: 300 (can be enormous in pockets)
- growth_rate_mult: 0.4 (moderate — complex structure grows slower than quartz)
- thermal_decomp_C: null (stable to surface conditions)

**Habit variants:**

| Habit | wall_spread | void_reach | vector | trigger |
|-------|-----------|-----------|--------|---------|
| Striated prism (schorl) | 0.15 | 0.85 | projecting | σ < 0.6, Fe²⁺ available |
| Striated prism (elbaite) | 0.15 | 0.85 | projecting | σ < 0.6, Li available |
| Radial spray | 0.4 | 0.7 | fanning | σ > 0.8, nucleation burst |
| Parallel aggregate | 0.5 | 0.6 | coating | σ > 1.2, space-limited |

**Color mechanism:** Fe²⁺ → black (schorl), Mn²⁺ → pink (rubellite), Cr³⁺/V³⁺ → green (verdelite), Fe²⁺+Ti → blue (indicolite), Cu²⁺ → neon blue (Paraíba type, extreme rarity). Color is a fluid composition marker.

**Fluorescence:** Generally none. Some elbaite shows weak pink LW (Mn²⁺).

**Narrative note:** Tourmaline's striations are growth records — each ridge is a growth pulse. The cross-section is a slightly rounded triangle (spherical triangle {101̄0}). Schorl grows early (Fe available), elbaite grows late (Li accumulated, Fe depleted).

**class:** Silicate (cyclosilicate)
**class_color:** #1313eb

---

#### 2. Beryl

**Species:** Beryl
**Formula:** Be₃Al₂Si₆O₁₈

**Crystal system:** Hexagonal
**Habits:**
- Hexagonal prisms with flat basal pinacoid termination (classic)
- Elongated hexagonal prisms (aquamarine style)
- Tabular hexagonal (short, wide — emerald style)
- Doubly-terminated (rare, pocket growth)

**Growth parameters:**
- nucleation_sigma: 1.8 (high — Be has to accumulate a LOT before beryl nucleates)
- max_size_cm: 1200 (can be over a meter)
- growth_rate_mult: 0.25 (slow — Be is rate-limiting)
- thermal_decomp_C: null (stable)

**Habit variants:**

| Habit | wall_spread | void_reach | vector | trigger |
|-------|-----------|-----------|--------|---------|
| Hexagonal prism | 0.2 | 0.9 | projecting | σ < 0.7, BeO > threshold |
| Elongated prism | 0.15 | 0.95 | projecting | σ < 0.5, sustained Be supply |
| Tabular hexagonal | 0.4 | 0.6 | coating | σ > 0.9 |
| Doubly-terminated | 0.2 | 0.85 | projecting | σ < 0.4, free-growing in pocket |

**Color mechanism:** Pure = goshenite (colorless). Fe²⁺ → aquamarine (blue). Fe³⁺ → heliodor (yellow). Cr³⁺/V³⁺ → emerald (green). Mn²⁺ → morganite (pink). Cs → red beryl (rarest). Color requires trace element from country rock — NOT from the pegmatite melt itself. This is the emerald paradox: you need ultramafic wall rock AND pegmatite fluid to meet.

**Fluorescence:** Generally none. Some morganite shows weak pinkish LW.

**Narrative note:** Beryl is enormous because Be is so incompatible it builds to extreme concentrations before finding a crystal. When it finally nucleates, there's a LOT of Be available. The growth rings in cross-section record the thermal history — wider bands = warmer, faster growth.

**class:** Silicate (cyclosilicate)
**class_color:** #1313eb

---

#### 3. Topaz

**Species:** Topaz
**Formula:** Al₂SiO₄(F,OH)₂

**Crystal system:** Orthorhombic
**Habits:**
- Prismatic with steep pyramidal termination (classic)
- Columnar (elongated prisms)
- Tabular on {001} (flat, broad)
- Stubby equant

**Growth parameters:**
- nucleation_sigma: 1.4 (moderate-high — needs F)
- max_size_cm: 200
- growth_rate_mult: 0.3
- thermal_decomp_C: null (stable)

**Habit variants:**

| Habit | wall_spread | void_reach | vector | trigger |
|-------|-----------|-----------|--------|---------|
| Prismatic | 0.2 | 0.8 | projecting | σ < 0.6 |
| Columnar | 0.15 | 0.9 | projecting | σ < 0.4, F-rich |
| Tabular | 0.5 | 0.5 | coating | σ > 1.0 |
| Equant stubby | 0.3 | 0.5 | coating | σ > 0.8, space-limited |

**Color mechanism:** F-rich = colorless to pale blue. OH-rich = yellow to brown. Imperial topaz (golden-orange to pinkish) = Cr³⁺ trace (Ouro Preto type). Radiation can produce blue topaz from colorless.

**Fluorescence:** Weak greenish LW sometimes.

**Narrative note:** Topaz has perfect basal cleavage {001} — crystals can snap cleanly perpendicular to their length. This is why topaz pockets often contain cleavage fragments alongside intact crystals. The F/OH ratio in the crystal records the fluid composition at time of growth.

**class:** Silicate (nesosilicate)
**class_color:** #1313eb

---

#### 4. Spodumene

**Species:** Spodumene
**Formula:** LiAlSi₂O₆

**Crystal system:** Monoclinic
**Habits:**
- Flattened tabular prisms (classic — "book" shape)
- Elongated blades
- Equant stubby (high-T)

**Growth parameters:**
- nucleation_sigma: 1.5 (high — Li has to build up)
- max_size_cm: 1400 (can be enormous — the largest are 14m!)
- growth_rate_mult: 0.35
- thermal_decomp_C: null (stable)

**Habit variants:**

| Habit | wall_spread | void_reach | vector | trigger |
|-------|-----------|-----------|--------|---------|
| Tabular prism | 0.2 | 0.85 | projecting | σ < 0.6, Li available |
| Elongated blade | 0.15 | 0.9 | projecting | σ < 0.4 |
| Stubby equant | 0.4 | 0.5 | coating | σ > 0.9, high T |

**Color mechanism:** Pure = triphane (yellow). Mn²⁺ → kunzite (pink-lilac). Cr³⁺ → hiddenite (green). Color depth correlates with growth rate — faster = more inclusion of color-causing impurity.

**Fluorescence:** Kunzite shows strong pink-orange under SW (Mn²⁺). Hiddenite may show orange-red.

**Narrative note:** Spodumene is a pyroxene — it has two cleavage directions at ~87°. Crystals often show parting along these planes. The name "kunzite" honors George Kunz, Tiffany's mineralogist who bought Minas Gerais specimens by the crate.

**class:** Silicate (inosilicate/pyroxene)
**class_color:** #1313eb

---

#### 5. Albite

**Species:** Albite (Na-feldspar, variety: cleavelandite)
**Formula:** NaAlSi₃O₈

**Crystal system:** Triclinic
**Habits:**
- Cleavelandite: curved platy aggregates (most relevant for pegmatite pockets)
- Blocky prismatic (high-T)
- Albite law twins (ubiquitous)

**Growth parameters:**
- nucleation_sigma: 0.8 (easy — Na is common)
- max_size_cm: 300
- growth_rate_mult: 0.5
- thermal_decomp_C: 1100 (melts)

**Habit variants:**

| Habit | wall_spread | void_reach | vector | trigger |
|-------|-----------|-----------|--------|---------|
| Cleavelandite plates | 0.6 | 0.4 | coating | σ > 0.7, Na-rich late fluid |
| Blocky prismatic | 0.3 | 0.6 | projecting | σ < 0.5, high T |
| Albite twin | 0.35 | 0.55 | projecting | σ < 0.6 |

**Color mechanism:** White to pale gray typically. "Moonstone" iridescence from exsolution lamellae (albite-orthoclase intergrowth). Rare blue-green from Pb inclusions.

**Fluorescence:** Bright blue SW sometimes (from trace Ti⁴⁺/Fe³⁺ charge transfer).

**Narrative note:** Cleavelandite is the signature of late-stage pocket crystallization — those curved white plates coating everything are sodium replacing potassium. The albitization event transforms the pocket chemistry: when K-feldspar dissolves and albite precipitates, it releases K back into the fluid, enabling a second pulse of muscovite growth.

**class:** Silicate (tectosilicate/feldspar)
**class_color:** #1313eb

---

### Existing Minerals in This Scenario

| Mineral | Role | Notes |
|---------|------|-------|
| Quartz | Pervasive | Multiple habits: massive (wall zone), prismatic (intermediate), scepters (pocket), smoky (near radioactive minerals) |
| Feldspar (microcline) | Wall zone | First to crystallize, later replaced by albite |
| Fluorite | Late accessory | Ca + F from wall-rock interaction. Purple cubes in pocket |
| Goethite | Very late | Oxidation of Fe released from decomposing schorl. Browns and yellows coating pocket walls |
| Selenite | Not expected | No Ca-sulfate source typical in pegmatites |

### Unique Scenario Mechanics

1. **Incompatible element accumulation:** B, Be, Li, F have nowhere to go early. They build up in the fluid, tracked as separate species. The sim should show them climbing. When they cross saturation threshold, dramatic nucleation events.

2. **Albitization event:** Mid-scenario, K-feldspar in the wall zone begins dissolving as Na builds. Albite replaces it. This releases K → triggers muscovite growth pulse. A replacement cascade.

3. **Melt→hydrothermal transition:** Unlike other scenarios (all hydrothermal or all magmatic), this one crosses the boundary. Early growth is from silicate melt. Late growth is from aqueous fluid. Crystal habit changes at the transition — more euhedral, more transparent, better formed.

4. **Color from country rock:** Emerald requires Cr from ultramafic wall rock meeting Be from pegmatite fluid. This is a two-source color mechanic. If the vug is far from ultramafic contact, you get aquamarine (Fe from melt). If close, you get emerald (Cr from wall).

5. **Pocket collapse:** Late-stage clay formation (kaolinite replacing feldspar) can weaken the pocket walls. Periodic collapse events that fracture crystals and create growth interruptions. This is how scepter quartz forms — normal growth, fracture, then a cap of clearer quartz on the broken surface.

---

## Variant B: Imperial Topaz Veins (Ouro Preto)

### Setting

Hydrothermal veins cutting Precambrian phyllite and quartzite in the Ouro Preto district. Related to Brasiliano orogeny uplift and extension, possibly reactivated during Cretaceous South Atlantic opening (124–89 Ma). Fluid inclusion data: crystallization at **~360°C, 3.5 kbar** from metamorphic fluids (Morteani et al. 2002).

The veins are narrow (cm to dm wide), cutting steeply through metamorphic country rock. Imperial topaz — golden-orange to pinkish, the most valuable topaz variety on Earth — crystallizes from fluorine-bearing hydrothermal fluids interacting with aluminum-rich wall rock.

### Thermal Regime

| Phase | Temperature | Duration (sim steps) | Notes |
|-------|------------|---------------------|-------|
| Initial vein opening | 400–380°C | ~30 | Fracture propagation, first quartz |
| Main topaz growth | 380–350°C | ~80 | Slow, steady. Imperial colors |
| Late quartz + kaolinite | 350–300°C | ~50 | Quartz overgrowths, clay replacing feldspar |
| Oxidation | 300–50°C | ~20 | Goethite, limonite staining |

Total: ~180 steps. Narrower temperature range than Variant A. No melt phase — entirely hydrothermal.

### Fluid Chemistry

**Starting fluid:** Metamorphic brine, derived from devolatilization of phyllite.
- SiO₂: moderate (quartz-saturated)
- Al₂O₃: moderate (from wall-rock dissolution)
- F: high (from phyllite — fluorine in micas)
- H₂O: dominant
- Trace: Cr³⁺ (from nearby ultramafic bodies — the source of imperial color), Fe²⁺, Ti⁴⁺

**Mineral sequence:**
1. **Quartz** — first to nucleate, lines the vein walls
2. **Topaz** — main event. F + Al + Si at ~360°C. Imperial color from trace Cr³⁺
3. **Kaolinite** — late, replaces earlier minerals, softens pocket
4. **Goethite** — very late oxidation product, stains everything orange-brown
5. **Rutile** (TiO₂) — inclusions in topaz (protogenetic — grew before topaz, then enclosed)

### New Minerals Required (1)

Only topaz is new — the others exist in the sim already (quartz, goethite). Rutile could be added as a bonus mineral but isn't essential.

**Topaz data:** Same as Variant A above. The key difference is growth conditions: purely hydrothermal at 360°C, not from melt. Cr³⁺ trace gives imperial color.

### Unique Scenario Mechanics

1. **Vein propagation:** The fracture opens as fluid pressure exceeds lithostatic pressure. Early crystals grow in a narrow slot. As dissolution widens the vein, later crystals have more room.

2. **Cr³⁺ threshold:** Imperial color requires just enough chromium. If Cr is below threshold, you get colorless or pale blue topaz (worth $10/ct). Above threshold: imperial golden-orange ($1000+/ct). A tiny compositional cliff with enormous consequence.

3. **Kaolinite softening:** Late clay formation weakens the vein walls. Topaz's perfect cleavage means crystals snap if the wall shifts. Cleavage fragments on the pocket floor are realistic.

4. **Country rock interaction:** The phyllite wall dissolves slowly, contributing Al. Unlike Variant A (everything from the melt), this scenario's chemistry is partly stolen from the host rock.

---

## Comparison

| Factor | Variant A: Pegmatite Pocket | Variant B: Ouro Preto Veins |
|--------|---------------------------|---------------------------|
| Temperature range | 650–300°C | 400–50°C |
| New minerals needed | 5 (tourmaline, beryl, topaz, spodumene, albite) | 1 (topaz) |
| Complexity | High — incompatible element cascade, melt→hydrothermal transition | Medium — single fluid, simpler paragenesis |
| Educational value | Teaches incompatible elements, fractional crystallization, color mechanisms | Teaches fluid inclusions, P-T conditions, country rock interaction |
| Visual spectacle | Enormous colorful crystals, dramatic nucleation events | Elegant simplicity — imperial topaz as the star |
| Sim challenge | Accumulation tracking for B, Be, Li, F as separate fluid species | Vein width dynamics, Cr threshold |
| Existing minerals used | Quartz, feldspar, fluorite, goethite | Quartz, goethite |
| Real-world locality accuracy | General Minas Gerais gem pegmatite districts (Governador Valadares, Araçuaí) | Specific: Ouro Preto / Capão do Lana deposit |

## Recommendation

**Start with Variant B for implementation** — it's simpler (1 new mineral), tighter temperature range, teaches fluid inclusion concepts. Then build Variant A as the "deluxe" version with the full incompatible element cascade. Variant B is the proof of concept; Variant A is the masterpiece.

But if you only want one: **Variant A**. It's the most Minas Gerais thing possible. Five new minerals, a saturation cascade that's unlike anything in the existing scenarios, and the melt→hydrothermal transition is a mechanic we haven't done yet.

---

*Research sources: Linnen (U. Waterloo), Morteani et al. 2002 (P-T-X of Imperial Topaz), GIA Gems & Gemmetry, Wikipedia pegmatite paragenesis, Cesar-Mendes 2000*
