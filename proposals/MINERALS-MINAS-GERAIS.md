# New Minerals: Minas Gerais Scenarios

**Date:** 2026-04-20
**Source scenario:** `proposals/SCENARIO-MINAS-GERAIS.md`
**Template version:** Current (`proposals/vugg-mineral-template.md`)

Six minerals total. Topaz is shared between both scenario variants. The other five appear only in Variant A (Gem Pegmatite Pocket).

---

## 1. Topaz

**Scenarios:** Variant B (Ouro Preto), Variant A (Gem Pegmatite Pocket)

```json
{
  "formula": "Al₂SiO₄(F,OH)₂",
  "nucleation_sigma": 1.4,
  "max_nucleation_count": 6,
  "max_size_cm": 200,
  "growth_rate_mult": 0.3,
  "habit_variants": [
    {
      "name": "prismatic",
      "wall_spread": 0.2,
      "void_reach": 0.8,
      "vector": "projecting",
      "trigger": "low σ, steady growth"
    },
    {
      "name": "columnar",
      "wall_spread": 0.15,
      "void_reach": 0.9,
      "vector": "projecting",
      "trigger": "low σ, F-rich fluid"
    },
    {
      "name": "tabular_broad",
      "wall_spread": 0.5,
      "void_reach": 0.3,
      "vector": "tabular",
      "trigger": "high σ, space-constrained"
    },
    {
      "name": "stubby_equant",
      "wall_spread": 0.3,
      "void_reach": 0.5,
      "vector": "equant",
      "trigger": "moderate σ, high T"
    },
    {
      "name": "default — prismatic with steep pyramidal termination",
      "wall_spread": 0.25,
      "void_reach": 0.75,
      "vector": "projecting",
      "trigger": "default — prismatic habit"
    }
  ],
  "class": "silicate",
  "class_color": "#1313eb",
  "description": "Al₂SiO₄(F,OH)₂ — orthorhombic, prismatic with steep pyramidal terminations and perfect basal cleavage {001}. Imperial topaz from Ouro Preto crystallized at ~360°C, 3.5 kbar from metamorphic hydrothermal fluids (Morteani et al. 2002). Golden-orange to pinkish color from trace Cr³⁺. Colorless to pale blue when Cr absent. F/OH ratio in crystal records fluid composition at growth time. Crystals can snap cleanly along basal cleavage — pocket floors littered with cleavage fragments are diagnostic.",
  "scenarios": ["ouro_preto", "gem_pegmatite"],
  "T_range_C": [300, 600],
  "T_optimum_C": [340, 400],
  "T_behavior": "window",
  "pH_dissolution_below": 2.0,
  "pH_dissolution_above": null,
  "redox_requirement": null,
  "required_ingredients": {
    "Al": 8,
    "Si": 3,
    "F": 4
  },
  "trace_ingredients": {
    "Cr": "imperial golden-orange (above trace threshold)",
    "Fe²⁺": "pale blue (F-rich fluid)",
    "Ti": "inclusions visible in crystal"
  },
  "thermal_decomp_C": null,
  "thermal_decomp_reaction": null,
  "thermal_decomp_products": null,
  "fluorescence": {
    "activator": "trace Ti",
    "color": "weak_greenish_LW",
    "note": "inconsistent, not reliable for ID"
  },
  "twin_laws": [],
  "acid_dissolution": {
    "pH_threshold": 2.0,
    "reaction": "very resistant, only strong acids",
    "products": { "Al": 0.3, "Si": 0.2 },
    "status": "newly_added"
  },
  "habit": "prismatic",
  "color_rules": {
    "colorless": { "default": true },
    "pale_blue": { "trigger": "F-rich, no Cr" },
    "golden_orange": { "trigger": "Cr > 0.3" },
    "pink": { "trigger": "Cr > 0.8, radiation exposure" }
  },
  "narrate_function": "_narrate_topaz",
  "runtimes_present": [],
  "audit_status": "pending — awaiting implementation"
}
```

**Narrative notes for `_narrate_topaz`:**
- Perfect basal cleavage — mention cleavage fragments on pocket floor
- F/OH ratio records fluid evolution
- Imperial color = Cr³⁺ trace from country rock (ultramafic), NOT from the pegmatite fluid itself
- Ouro Preto locality: fluid inclusion studies show 360°C, 3.5 kbar (Morteani et al. 2002)
- Prized for 200+ years; Portuguese colonial mines exhausted, now garimpeiro operations

---

## 2. Tourmaline (Schorl → Elbaite series)

**Scenarios:** Variant A (Gem Pegmatite Pocket) only

```json
{
  "formula": "Na(Fe²⁺,Li,Al)₃Al₆(BO₃)₃Si₆O₁₈(OH)₄",
  "nucleation_sigma": 1.3,
  "max_nucleation_count": 8,
  "max_size_cm": 300,
  "growth_rate_mult": 0.4,
  "habit_variants": [
    {
      "name": "striated_prism_schorl",
      "wall_spread": 0.15,
      "void_reach": 0.85,
      "vector": "projecting",
      "trigger": "low σ, Fe²⁺ available, early crystallization"
    },
    {
      "name": "striated_prism_elbaite",
      "wall_spread": 0.15,
      "void_reach": 0.85,
      "vector": "projecting",
      "trigger": "low σ, Li accumulated, Fe depleted"
    },
    {
      "name": "radial_spray",
      "wall_spread": 0.4,
      "void_reach": 0.7,
      "vector": "projecting",
      "trigger": "moderate-high σ, nucleation burst"
    },
    {
      "name": "parallel_aggregate",
      "wall_spread": 0.5,
      "void_reach": 0.6,
      "vector": "coating",
      "trigger": "high σ, space-limited"
    },
    {
      "name": "default — striated trigonal prism",
      "wall_spread": 0.2,
      "void_reach": 0.8,
      "vector": "projecting",
      "trigger": "default — striated prism"
    }
  ],
  "class": "silicate",
  "class_color": "#1313eb",
  "description": "Complex cyclosilicate — trigonal, elongated prisms with deep vertical striations and slightly rounded triangular cross-section. Schorl (black, Fe²⁺-dominant) crystallizes early from pegmatite melt. Elbaite (colored, Li-dominant) crystallizes late from residual pocket fluid. The striations are growth records — each ridge is a growth pulse. Color is a fluid composition snapshot: Mn²⁺ → pink (rubellite), Cr³⁺/V³⁺ → green (verdelite), Fe²⁺+Ti → blue (indicolite), Cu²⁺ → neon Paraíba blue (extreme rarity). The most Minas Gerais mineral there is.",
  "scenarios": ["gem_pegmatite"],
  "T_range_C": [350, 700],
  "T_optimum_C": [400, 600],
  "T_behavior": "window",
  "pH_dissolution_below": null,
  "pH_dissolution_above": null,
  "redox_requirement": null,
  "required_ingredients": {
    "Na": 3,
    "B": 6,
    "Al": 8,
    "Si": 4
  },
  "trace_ingredients": {
    "Fe²⁺": "black schorl (early growth)",
    "Li": "elbaite series (late growth, replaces Fe in formula)",
    "Mn²⁺": "pink rubellite",
    "Cr³⁺": "green verdelite",
    "Cu²⁺": "neon Paraíba blue (extremely rare)"
  },
  "thermal_decomp_C": null,
  "thermal_decomp_reaction": null,
  "thermal_decomp_products": null,
  "fluorescence": null,
  "twin_laws": [],
  "acid_dissolution": {
    "pH_threshold": null,
    "reaction": "extremely resistant — no practical acid dissolution",
    "products": null,
    "status": "newly_added"
  },
  "habit": "striated_prism",
  "color_rules": {
    "black": { "trigger": "Fe²⁺ dominant (schorl), early crystallization" },
    "pink": { "trigger": "Mn²⁺ > 0.3, Li present (rubellite)" },
    "green": { "trigger": "Cr³⁺ or V³⁺ present, Li present (verdelite)" },
    "blue": { "trigger": "Fe²⁺+Ti present, Li present (indicolite)" },
    "neon_blue": { "trigger": "Cu²⁺ trace (Paraíba type, extremely rare)" }
  },
  "narrate_function": "_narrate_tourmaline",
  "runtimes_present": [],
  "audit_status": "pending — awaiting implementation"
}
```

**Narrative notes for `_narrate_tourmaline`:**
- Striations are growth pulse records — the crystal keeps a diary
- Cross-section is a slightly rounded triangle (spherical triangle {101̄0})
- Schorl→elbaite transition records the Fe-depletion, Li-enrichment of the fluid over time
- Color zoning along the c-axis = time evolution of the fluid (one end greener, one end pinker)
- The Jonas mine in Minas Gerais was perhaps the world's most important rubellite producer

---

## 3. Beryl

**Scenarios:** Variant A (Gem Pegmatite Pocket) only

```json
{
  "formula": "Be₃Al₂Si₆O₁₈",
  "nucleation_sigma": 1.8,
  "max_nucleation_count": 4,
  "max_size_cm": 1200,
  "growth_rate_mult": 0.25,
  "habit_variants": [
    {
      "name": "hexagonal_prism",
      "wall_spread": 0.2,
      "void_reach": 0.9,
      "vector": "projecting",
      "trigger": "low σ, BeO above threshold, steady growth"
    },
    {
      "name": "elongated_prism",
      "wall_spread": 0.15,
      "void_reach": 0.95,
      "vector": "projecting",
      "trigger": "low σ, sustained Be supply, deep pocket"
    },
    {
      "name": "tabular_hexagonal",
      "wall_spread": 0.4,
      "void_reach": 0.4,
      "vector": "tabular",
      "trigger": "moderate-high σ, space-limited"
    },
    {
      "name": "doubly_terminated",
      "wall_spread": 0.2,
      "void_reach": 0.85,
      "vector": "projecting",
      "trigger": "low σ, free-floating in pocket, rare"
    },
    {
      "name": "default — hexagonal prism with flat basal pinacoid",
      "wall_spread": 0.25,
      "void_reach": 0.85,
      "vector": "projecting",
      "trigger": "default — hexagonal prism"
    }
  ],
  "class": "silicate",
  "class_color": "#1313eb",
  "description": "Be₃Al₂Si₆O₁₈ — hexagonal prisms, can exceed a meter. Beryllium is so incompatible it builds to extreme concentrations in residual pegmatite fluid before any crystal will take it — then nucleation produces enormous crystals. Growth rings in cross-section record thermal history: wider bands = warmer, faster growth. Color requires trace elements from COUNTRY ROCK, not the melt: Fe²⁺ → aquamarine (blue), Cr³⁺/V³⁺ → emerald (green, requires ultramafic contact), Mn²⁺ → morganite (pink). Pure beryl is goshenite (colorless). The emerald paradox: you need BOTH pegmatite fluid (Be source) AND ultramafic wall rock (Cr source) to meet.",
  "scenarios": ["gem_pegmatite"],
  "T_range_C": [300, 650],
  "T_optimum_C": [350, 550],
  "T_behavior": "window",
  "pH_dissolution_below": null,
  "pH_dissolution_above": null,
  "redox_requirement": null,
  "required_ingredients": {
    "Be": 10,
    "Al": 6,
    "Si": 5
  },
  "trace_ingredients": {
    "Fe²⁺": "aquamarine (blue)",
    "Cr³⁺": "emerald (green) — requires ultramafic country rock contact",
    "V³⁺": "emerald (green) — alternative to Cr",
    "Mn²⁺": "morganite (pink)",
    "Cs": "red beryl (extremely rare)"
  },
  "thermal_decomp_C": null,
  "thermal_decomp_reaction": null,
  "thermal_decomp_products": null,
  "fluorescence": null,
  "twin_laws": [],
  "acid_dissolution": {
    "pH_threshold": null,
    "reaction": "resistant to most acids; dissolves slowly in HF",
    "products": null,
    "status": "newly_added"
  },
  "habit": "hexagonal_prism",
  "color_rules": {
    "colorless": { "trigger": "no trace elements (goshenite)" },
    "blue": { "trigger": "Fe²⁺ present (aquamarine)" },
    "green": { "trigger": "Cr³⁺ or V³⁺ from ultramafic contact (emerald)" },
    "pink": { "trigger": "Mn²⁺ present (morganite)" }
  },
  "narrate_function": "_narrate_beryl",
  "runtimes_present": [],
  "audit_status": "pending — awaiting implementation"
}
```

**Narrative notes for `_narrate_beryl`:**
- Be is the most incompatible common element — refuses to fit in ANY common mineral until beryl threshold
- Crystals can be enormous because Be accumulates for so long before nucleation
- Cross-section growth rings = thermal history recorder
- Emerald paradox: Be from pegmatite + Cr from ultramafic = two sources must meet
- Grota da Generosa pegmatite: beryl crystals at contact between mica zone and quartz-feldspar zone

---

## 4. Spodumene

**Scenarios:** Variant A (Gem Pegmatite Pocket) only

```json
{
  "formula": "LiAlSi₂O₆",
  "nucleation_sigma": 1.5,
  "max_nucleation_count": 4,
  "max_size_cm": 1400,
  "growth_rate_mult": 0.35,
  "habit_variants": [
    {
      "name": "tabular_prism",
      "wall_spread": 0.2,
      "void_reach": 0.85,
      "vector": "projecting",
      "trigger": "low σ, Li available"
    },
    {
      "name": "elongated_blade",
      "wall_spread": 0.15,
      "void_reach": 0.9,
      "vector": "projecting",
      "trigger": "low σ, sustained Li supply"
    },
    {
      "name": "stubby_equant",
      "wall_spread": 0.4,
      "void_reach": 0.5,
      "vector": "equant",
      "trigger": "moderate-high σ, high T"
    },
    {
      "name": "default — flattened tabular prism (book shape)",
      "wall_spread": 0.25,
      "void_reach": 0.8,
      "vector": "projecting",
      "trigger": "default — tabular prism"
    }
  ],
  "class": "silicate",
  "class_color": "#1313eb",
  "description": "LiAlSi₂O₆ — monoclinic pyroxene, flattened tabular prisms ('book' shape). Can reach 14 meters — among the longest single crystals on Earth. Lithium accumulates late in pegmatite crystallization because no early mineral takes it. Two cleavage directions at ~87° produce characteristic parting. Kunzite (pink-lilac) from Mn²⁺, shows strong fluorescence. Hiddenite (green) from Cr³⁺, rarer. Named after George Kunz, Tiffany's mineralogist who bought Minas Gerais specimens by the crate. Color depth correlates with growth rate — faster crystals trap more color-causing impurity.",
  "scenarios": ["gem_pegmatite"],
  "T_range_C": [400, 700],
  "T_optimum_C": [450, 600],
  "T_behavior": "window",
  "pH_dissolution_below": null,
  "pH_dissolution_above": null,
  "redox_requirement": null,
  "required_ingredients": {
    "Li": 8,
    "Al": 5,
    "Si": 4
  },
  "trace_ingredients": {
    "Mn²⁺": "kunzite (pink-lilac)",
    "Cr³⁺": "hiddenite (green)"
  },
  "thermal_decomp_C": null,
  "thermal_decomp_reaction": null,
  "thermal_decomp_products": null,
  "fluorescence": {
    "activator": "Mn²⁺",
    "color": "strong pink_orange_SW",
    "note": "kunzite variety; hiddenite may show orange-red"
  },
  "twin_laws": [],
  "acid_dissolution": {
    "pH_threshold": null,
    "reaction": "resistant to common acids",
    "products": null,
    "status": "newly_added"
  },
  "habit": "tabular_prism",
  "color_rules": {
    "yellow": { "trigger": "pure, no trace elements (triphane)" },
    "pink_lilac": { "trigger": "Mn²⁺ present (kunzite)" },
    "green": { "trigger": "Cr³⁺ present (hiddenite)" }
  },
  "narrate_function": "_narrate_spodumene",
  "runtimes_present": [],
  "audit_status": "pending — awaiting implementation"
}
```

**Narrative notes for `_narrate_spodumene`:**
- Pyroxene with two cleavages at ~87° — mention parting along these planes
- Can be the longest crystals in any pegmatite (up to 14m)
- "Book shape" from flattened tabular habit
- Kunzite fluorescence under SW is diagnostic — strong pink-orange
- George Kunz connection: bought Brazilian specimens for Tiffany

---

## 5. Albite (Cleavelandite variety)

**Scenarios:** Variant A (Gem Pegmatite Pocket) only

```json
{
  "formula": "NaAlSi₃O₈",
  "nucleation_sigma": 0.8,
  "max_nucleation_count": 12,
  "max_size_cm": 300,
  "growth_rate_mult": 0.5,
  "habit_variants": [
    {
      "name": "cleavelandite_plates",
      "wall_spread": 0.6,
      "void_reach": 0.3,
      "vector": "tabular",
      "trigger": "moderate-high σ, Na-rich late fluid"
    },
    {
      "name": "blocky_prismatic",
      "wall_spread": 0.3,
      "void_reach": 0.6,
      "vector": "equant",
      "trigger": "low σ, high T, early crystallization"
    },
    {
      "name": "albite_twin",
      "wall_spread": 0.35,
      "void_reach": 0.55,
      "vector": "projecting",
      "trigger": "low-moderate σ, repeated twinning"
    },
    {
      "name": "default — cleavelandite curved platy aggregate",
      "wall_spread": 0.55,
      "void_reach": 0.35,
      "vector": "tabular",
      "trigger": "default — cleavelandite plates"
    }
  ],
  "class": "silicate",
  "class_color": "#1313eb",
  "description": "NaAlSi₃O₈ — triclinic feldspar. Cleavelandite variety: curved white platy aggregates coating pocket walls, the signature of late-stage pegmatite crystallization. Albite law twins are ubiquitous (repeated polysynthetic twinning visible as striations). Sodium replaces potassium in the albitization event — microcline dissolves, albite precipitates, releasing K back into fluid for a second muscovite growth pulse. This replacement cascade transforms pocket chemistry. Bright blue SW fluorescence from trace Ti⁴⁺/Fe³⁺ charge transfer. 'Moonstone' adularescence from exsolution lamellae.",
  "scenarios": ["gem_pegmatite"],
  "T_range_C": [300, 650],
  "T_optimum_C": [350, 500],
  "T_behavior": "window",
  "pH_dissolution_below": 3.0,
  "pH_dissolution_above": null,
  "redox_requirement": null,
  "required_ingredients": {
    "Na": 5,
    "Al": 5,
    "Si": 5
  },
  "trace_ingredients": {
    "Ti⁴⁺": "blue SW fluorescence",
    "Fe³⁺": "blue fluorescence co-activator"
  },
  "thermal_decomp_C": 1100,
  "thermal_decomp_reaction": "NaAlSi₃O₈ → NaAlSiO₄ + SiO₂ (nepheline + quartz at high P)",
  "thermal_decomp_products": { "Na": 0.2, "Al": 0.2, "Si": 0.3 },
  "fluorescence": {
    "activator": "Ti⁴⁺/Fe³⁺ charge transfer",
    "color": "bright_blue_SW",
    "note": "common in cleavelandite variety"
  },
  "twin_laws": [
    { "name": "albite_law", "probability": 0.9 }
  ],
  "acid_dissolution": {
    "pH_threshold": 3.0,
    "reaction": "slowly decomposes in weak acids",
    "products": { "Na": 0.2, "Al": 0.2, "Si": 0.3 },
    "status": "newly_added"
  },
  "habit": "cleavelandite_plates",
  "color_rules": {
    "white": { "default": true },
    "pale_gray": { "trigger": "minor inclusions" }
  },
  "narrate_function": "_narrate_albite",
  "runtimes_present": [],
  "audit_status": "pending — awaiting implementation"
}
```

**Narrative notes for `_narrate_albite`:**
- Cleavelandite = white curved plates coating everything = "the pocket is maturing"
- Albitization event: K-feldspar dissolves → albite precipitates → K released → muscovite growth pulse
- This replacement cascade is one of the most important processes in pegmatite evolution
- Albite twins are so common that untwinned albite is noteworthy
- Blue SW fluorescence diagnostic in the field

---

## 6. Rutile (bonus mineral — appears in both variants)

**Scenarios:** Variant B (Ouro Preto — as inclusions in topaz), Variant A (as accessory)

```json
{
  "formula": "TiO₂",
  "nucleation_sigma": 1.2,
  "max_nucleation_count": 10,
  "max_size_cm": 30,
  "growth_rate_mult": 0.3,
  "habit_variants": [
    {
      "name": "acicular",
      "wall_spread": 0.1,
      "void_reach": 0.7,
      "vector": "projecting",
      "trigger": "low σ, Ti available"
    },
    {
      "name": "skeletal_octahedral",
      "wall_spread": 0.3,
      "void_reach": 0.5,
      "vector": "equant",
      "trigger": "high σ, rapid growth"
    },
    {
      "name": "sixling_cyclic_twin",
      "wall_spread": 0.3,
      "void_reach": 0.6,
      "vector": "projecting",
      "trigger": "low-moderate σ, classic twin habit"
    },
    {
      "name": "default — slender striated prism",
      "wall_spread": 0.15,
      "void_reach": 0.65,
      "vector": "projecting",
      "trigger": "default — slender prism"
    }
  ],
  "class": "oxide",
  "class_color": "#eb1313",
  "description": "TiO₂ — tetragonal. Slender striated prisms, often red-brown to black. Famous for cyclic twinning producing flat sixlings ('six-rayed stars'). Common as inclusions in other minerals (rutile needles in quartz, topaz, garnet). Protogenetic inclusions — grew first, then enclosed by the host crystal. Ti⁴⁺ is moderately incompatible, concentrating in late-stage fluids. At Ouro Preto, rutile inclusions in imperial topaz are diagnostic. Rutilated quartz is a collector favorite.",
  "scenarios": ["ouro_preto", "gem_pegmatite"],
  "T_range_C": [200, 800],
  "T_optimum_C": [300, 600],
  "T_behavior": "window",
  "pH_dissolution_below": null,
  "pH_dissolution_above": null,
  "redox_requirement": null,
  "required_ingredients": {
    "Ti": 6,
    "O2": 2
  },
  "trace_ingredients": {
    "Fe²⁺": "darker color, black varieties",
    "Nb": "Nb-bearing rutile (high-T pegmatites)",
    "Sn": "cassiterite-like chemistry"
  },
  "thermal_decomp_C": null,
  "thermal_decomp_reaction": null,
  "thermal_decomp_products": null,
  "fluorescence": null,
  "twin_laws": [
    { "name": "cyclic_sixling_{031}", "probability": 0.1 }
  ],
  "acid_dissolution": {
    "pH_threshold": null,
    "reaction": "extremely resistant",
    "products": null,
    "status": "newly_added"
  },
  "habit": "acicular",
  "color_rules": {
    "red_brown": { "default": true },
    "black": { "trigger": "Fe²⁺ present" },
    "golden": { "trigger": "sagenite variety, high T" }
  },
  "narrate_function": "_narrate_rutile",
  "runtimes_present": [],
  "audit_status": "pending — awaiting implementation"
}
```

**Narrative notes for `_narrate_rutile`:**
- Sixling cyclic twins are iconic — flat star-shaped crystals
- Protogenetic inclusions: grew first, then host crystal grew around them
- Rutilated quartz = rutile needles frozen inside clear quartz
- At Ouro Preto, rutile inclusions in topaz confirmed by Raman spectroscopy (Serrinha pegmatite, ScienceDirect 2016)

---

## Implementation Notes

### Class Color Collision

All 5 pegmatite silicates (tourmaline, beryl, topaz, spodumene, albite) share `class_color: #1313eb`. On the topo map they'll be the same blue. This is by design — the 12-hue wheel assigns one color per class, and they're all silicates. Hover + inventory resolves individual species.

### `required_ingredients` — New Elements

The incompatible element mechanic requires tracking these in the fluid:
- **Be** (beryllium) — consumed only by beryl. Builds until high threshold.
- **B** (boron) — consumed primarily by tourmaline. Also in some micas.
- **Li** (lithium) — consumed by spodumene and elbaite. Late-stage accumulation.
- **F** (fluorine) — consumed by topaz and fluorite. Flux element.
- **Ti** (titanium) — consumed by rutile. Moderately incompatible.
- **Na** (sodium) — consumed by albite. Common but important for albitization.

These may need new entries in the fluid chemistry model if not already tracked.

### Scenario-Specific `max_nucleation_count`

The counts above are for Variant A (Gem Pegmatite). For Variant B (Ouro Preto), topaz's count could be higher (6–8) since it's the dominant mineral, and rutile's could be lower (3–5) as it's mostly inclusions.

### Albitization Event (Variant A only)

Albite has a special interaction with feldspar (microcline): when Na builds and K depletes, microcline in the wall zone should begin dissolving and albite should precipitate. This is a **replacement reaction** — a new mechanic not in any existing scenario. Consider flagging this in the builder brief.

### Entry Count for `_audit_summary`

After implementation, update the mineral count: 19 existing + 6 new = **25 minerals**.

---

*All data cross-referenced against: Morteani et al. 2002 (P-T-X topaz), Linnen/U.Waterloo (Minas Gerais overview), GIA (tourmaline, beryl), Wikipedia pegmatite paragenesis, Serrinha pegmatite Raman study (ScienceDirect 2016)*
