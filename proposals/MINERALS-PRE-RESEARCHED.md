# Mineral Expansion: Pre-Researched Species

**Date:** 2026-04-21 (updated to new template format)
**Status:** All 16 species implemented in the codebase as of commit b1825d6
**Source:** Research files in `memory/research-<name>.md`

This document is the archival reference. All species below are now in `data/minerals.json` and functional.

---

## Summary Table

| # | Species | Formula | Class | class_color | Scenarios | Research File |
|---|---------|---------|-------|-------------|-----------|---------------|
| 1 | Pyromorphite | Pb₅(PO₄)₃Cl | phosphate | #13eb7f | supergene_oxidation | research-pyromorphite.md |
| 2 | Vanadinite | Pb₅(VO₄)₃Cl | phosphate* | #13eb7f | supergene_oxidation | research-vanadinite.md |
| 3 | Cerussite | PbCO₃ | carbonate | #eb7f13 | supergene_oxidation | research-cerussite.md |
| 4 | Anglesite | PbSO₄ | sulfate | #eb137f | supergene_oxidation | research-anglesite.md |
| 5 | Azurite | Cu₃(CO₃)₂(OH)₂ | carbonate | #eb7f13 | supergene_oxidation | research-azurite.md |
| 6 | Cuprite | Cu₂O | oxide | #eb1313 | supergene_oxidation | research-cuprite.md |
| 7 | Native Copper | Cu | native | #eb13eb | supergene_oxidation | research-native-copper.md |
| 8 | Chalcocite | Cu₂S | sulfide | #7feb13 | supergene_oxidation | research-chalcocite.md |
| 9 | Covellite | CuS | sulfide | #7feb13 | supergene_oxidation | research-covellite.md |
| 10 | Bornite | Cu₅FeS₄ | sulfide | #7feb13 | porphyry, supergene_oxidation | research-bornite.md |
| 11 | Stibnite | Sb₂S₃ | sulfide | #7feb13 | hydrothermal (future) | research-stibnite.md |
| 12 | Bismuthinite | Bi₂S₃ | sulfide | #7feb13 | hydrothermal (future) | research-bismuthinite.md |
| 13 | Native Bismuth | Bi | native | #eb13eb | hydrothermal (future) | research-native-bismuth.md |
| 14 | Clinobisvanite | BiVO₄ | phosphate* | #13eb7f | supergene (future) | research-clinobisvanite.md |
| 15 | Magnetite | Fe₃O₄ | oxide | #eb1313 | porphyry, reactive_wall | research-magnetite.md |
| 16 | Lepidocrocite | γ-FeOOH | hydroxide | #13ebeb | supergene_oxidation | research-lepidocrocite.md |

*Vanadinite and clinobisvanite folded into phosphate class (apatite-group structure, per template §1 decision).

---

## Per-Species Template Data

Each entry below follows the builder's template format: FluidChemistry field names, controlled trigger vocabulary, proper scenarios arrays.

### 1. Pyromorphite — Pb₅(PO₄)₃Cl

**class:** phosphate
**class_color:** #13eb7f
**nucleation_sigma:** 1.2
**max_nucleation_count:** 6
**max_size_cm:** 15
**growth_rate_mult:** 0.4
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Pb": 30, "P": 5, "Cl": 3 }
**acid_dissolution:** null (very stable)
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| hexagonal_barrel | 0.3 | 0.7 | projecting | low σ, open vug |
| hoppered_hexagonal | 0.35 | 0.6 | projecting | moderate-high σ |
| botryoidal_coating | 0.8 | 0.2 | coating | high σ |
| acicular_needles | 0.15 | 0.8 | projecting | very high σ, rapid growth |
| default | 0.3 | 0.7 | projecting | default — hexagonal barrel |

**color_rules:** Green (trace Cr), brown, orange, yellow, colorless

---

### 2. Vanadinite — Pb₅(VO₄)₃Cl

**class:** phosphate (vanadate, folded into phosphate per template)
**class_color:** #13eb7f
**nucleation_sigma:** 1.3
**max_nucleation_count:** 6
**max_size_cm:** 10
**growth_rate_mult:** 0.35
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Pb": 30, "V": 5, "Cl": 3 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| elongated_hexagonal | 0.15 | 0.85 | projecting | low σ, elongated habit |
| stout_barrel | 0.3 | 0.6 | equant | moderate σ |
| acicular_tufts | 0.2 | 0.8 | projecting | high σ |
| default | 0.15 | 0.85 | projecting | default — hexagonal prism |

**color_rules:** Red-orange to brown-orange, yellow (V⁵⁵ chromophore)

---

### 3. Cerussite — PbCO₃

**class:** carbonate
**class_color:** #eb7f13
**nucleation_sigma:** 1.0
**max_nucleation_count:** 4
**max_size_cm:** 20
**growth_rate_mult:** 0.3
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Pb": 25, "CO3": 100 }
**acid_dissolution:** { "pH_threshold": 4.0 }
**fluorescence:** { "LW": "weak yellow", "activator": "unknown" }

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| stellate_twin | 0.3 | 0.6 | projecting | moderate σ, twin tendency — six-rayed star |
| tabular_single | 0.4 | 0.4 | tabular | low σ |
| acicular_needles | 0.15 | 0.75 | projecting | high σ |
| pseudomorph_galena | 0.4 | 0.4 | equant | default — on galena surface, inherits cube shape |
| default | 0.3 | 0.6 | projecting | default — stellate twin |

**color_rules:** Colorless, white, adamantine luster

---

### 4. Anglesite — PbSO₄

**class:** sulfate
**class_color:** #eb137f
**nucleation_sigma:** 1.1
**max_nucleation_count:** 4
**max_size_cm:** 15
**growth_rate_mult:** 0.3
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Pb": 25, "S": 50 }
**acid_dissolution:** { "pH_threshold": 4.0, "note": "dissolves in carbonate-rich fluids → cerussite" }
**fluorescence:** { "LW": "rarely weak yellow" }

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| prismatic_orthorhombic | 0.25 | 0.7 | projecting | low σ, free nucleation |
| pseudomorph_galena | 0.4 | 0.4 | equant | default — on galena surface |
| druzy_coating | 0.7 | 0.15 | coating | high σ |
| default | 0.25 | 0.7 | projecting | default — prismatic |

**color_rules:** Colorless to yellow, orange. Brilliant adamantine luster.

---

### 5. Azurite — Cu₃(CO₃)₂(OH)₂

**class:** carbonate
**class_color:** #eb7f13
**nucleation_sigma:** 1.4
**max_nucleation_count:** 4
**max_size_cm:** 25
**growth_rate_mult:** 0.3
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Cu": 100, "CO3": 150 }
**acid_dissolution:** { "pH_threshold": 4.0, "effervesces": true }
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| deep_blue_prismatic | 0.2 | 0.8 | projecting | low σ, high CO3 |
| rosette | 0.4 | 0.5 | projecting | moderate σ, radiating bladed |
| azurite_sun | 0.6 | 0.3 | tabular | default — growth in thin fractures |
| default | 0.2 | 0.8 | projecting | default — prismatic |

**color_rules:** Deep azure blue to midnight blue. Converts to malachite if CO3 drops below threshold.

---

### 6. Cuprite — Cu₂O

**class:** oxide
**class_color:** #eb1313
**nucleation_sigma:** 1.2
**max_nucleation_count:** 4
**max_size_cm:** 15
**growth_rate_mult:** 0.35
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "web.index.html"]
**required_ingredients:** { "Cu": 80, "O2": 1.2 }
**acid_dissolution:** null (stable oxide)
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| octahedral | 0.25 | 0.6 | equant | low σ, open vug |
| chalcotrichite | 0.1 | 0.9 | projecting | high σ, rapid directional growth |
| massive_tile_ore | 0.7 | 0.2 | coating | very high σ, space-constrained |
| spinel_twin | 0.3 | 0.55 | equant | low-moderate σ, rare |
| default | 0.25 | 0.6 | equant | default — octahedral |

**color_rules:** Dark red to nearly black, ruby-red internal reflections

---

### 7. Native Copper — Cu

**class:** native
**class_color:** #eb13eb
**nucleation_sigma:** 1.6
**max_nucleation_count:** 3
**max_size_cm:** 1000 (specimen scale; real masses reach 500 tons)
**growth_rate_mult:** 0.2
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Cu": 150, "S": 0, "O2": 0.3 }
**acid_dissolution:** null
**fluorescence:** null (metallic)

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| cubic_dodecahedral | 0.25 | 0.6 | equant | low σ, open vesicle |
| arborescent | 0.3 | 0.7 | dendritic | moderate σ, fracture-fill |
| wire_copper | 0.1 | 0.95 | projecting | high σ, narrow channel |
| massive_sheet | 0.8 | 0.3 | coating | very high σ, large void |
| default | 0.3 | 0.7 | dendritic | default — arborescent |

**color_rules:** Copper-red, tarnishes brown then green (malachite)

---

### 8. Chalcocite — Cu₂S

**class:** sulfide
**class_color:** #7feb13
**nucleation_sigma:** 1.1
**max_nucleation_count:** 5
**max_size_cm:** 15
**growth_rate_mult:** 0.6
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Cu": 150, "S": 80 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| stellate_sixling | 0.3 | 0.6 | projecting | low σ, twin tendency |
| tabular_prismatic | 0.25 | 0.7 | projecting | moderate σ |
| pseudomorph | — | — | — | inherits parent crystal shape |
| default | 0.25 | 0.7 | projecting | default — tabular |

**color_rules:** Dark gray to black, metallic. Pseudomorph after chalcopyrite/bornite preserves parent shape.

---

### 9. Covellite — CuS

**class:** sulfide
**class_color:** #7feb13
**nucleation_sigma:** 1.2
**max_nucleation_count:** 4
**max_size_cm:** 10
**growth_rate_mult:** 0.45
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Cu": 100, "S": 120 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| hexagonal_plate | 0.5 | 0.3 | tabular | default — thin plates, micaceous |
| rosette | 0.4 | 0.5 | projecting | moderate σ, radiating |
| iridescent_coating | 0.6 | 0.2 | coating | high σ, near oxidation boundary |
| default | 0.5 | 0.3 | tabular | default — hexagonal plate |

**color_rules:** Indigo-blue — only common naturally blue mineral. Iridescent red/purple tarnish.

---

### 10. Bornite — Cu₅FeS₄

**class:** sulfide
**class_color:** #7feb13
**nucleation_sigma:** 1.0
**max_nucleation_count:** 3
**max_size_cm:** 5
**growth_rate_mult:** 0.4
**scenarios:** ["porphyry", "supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Cu": 120, "Fe": 40, "S": 80 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| pseudo_cubic | 0.35 | 0.5 | equant | high T (>228°C), ordered structure |
| massive_granular | 0.6 | 0.3 | coating | low T (<228°C) |
| peacock_tarnish | 0.35 | 0.5 | equant | default — iridescent surface near oxidation |
| default | 0.6 | 0.3 | coating | default — massive |

**color_rules:** Bronze fresh; iridescent blue/purple/green/gold tarnish (peacock ore). 228°C order-disorder transition.

---

### 11. Stibnite — Sb₂S₃

**class:** sulfide
**class_color:** #7feb13
**nucleation_sigma:** 1.2
**max_nucleation_count:** 4
**max_size_cm:** 60
**growth_rate_mult:** 0.35
**scenarios:** ["cooling", "pulse"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Sb": 30, "S": 60 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| elongated_blade | 0.1 | 0.95 | projecting | low σ, signature sword-like habit |
| radiating_spray | 0.3 | 0.7 | projecting | moderate σ |
| massive_granular | 0.5 | 0.4 | coating | high σ |
| default | 0.1 | 0.95 | projecting | default — elongated blade |

**color_rules:** Lead-gray metallic, brilliant metallic luster fresh

---

### 12. Bismuthinite — Bi₂S₃

**class:** sulfide
**class_color:** #7feb13
**nucleation_sigma:** 1.3
**max_nucleation_count:** 4
**max_size_cm:** 5
**growth_rate_mult:** 0.4
**scenarios:** ["reactive_wall"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Bi": 50, "S": 60 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| acicular_needles | 0.1 | 0.9 | projecting | low T (<350°C), low σ |
| stout_prismatic | 0.2 | 0.75 | projecting | high T (>350°C), moderate σ |
| radiating_cluster | 0.35 | 0.6 | projecting | nucleation burst |
| default | 0.1 | 0.9 | projecting | default — acicular |

**color_rules:** Lead-gray to tin-white, iridescent tarnish

---

### 13. Native Bismuth — Bi

**class:** native
**class_color:** #eb13eb
**nucleation_sigma:** 1.4
**max_nucleation_count:** 3
**max_size_cm:** 5
**growth_rate_mult:** 0.4
**scenarios:** ["reactive_wall"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Bi": 80, "S": 0 }
**acid_dissolution:** null
**fluorescence:** null (metallic)
**thermal_decomp_C:** 271.5 (melts!)

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| arborescent | 0.3 | 0.7 | dendritic | default — tree-like, fracture growth |
| massive_granular | 0.5 | 0.4 | coating | moderate σ |
| rhombohedral | 0.25 | 0.55 | equant | low σ, rare, open vug |
| default | 0.3 | 0.7 | dendritic | default — arborescent |

**color_rules:** Silver-white fresh, iridescent oxide tarnish. Rainbow hoppered crystals are lab-grown ONLY.

---

### 14. Clinobisvanite — BiVO₄

**class:** phosphate (vanadate, folded per template)
**class_color:** #13eb7f
**nucleation_sigma:** 1.5
**max_nucleation_count:** 8
**max_size_cm:** 0.01 (microscopic!)
**growth_rate_mult:** 0.2
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Bi": 20, "V": 5 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| micro_crystalline_plates | 0.4 | 0.2 | coating | default — yellow plates |
| powdery_aggregate | 0.6 | 0.15 | coating | high σ |
| default | 0.4 | 0.2 | coating | default — micro plates |

**color_rules:** Bright yellow to orange-yellow. Famous photocatalyst (water splitting).

---

### 15. Magnetite — Fe₃O₄

**class:** oxide
**class_color:** #eb1313
**nucleation_sigma:** 1.0
**max_nucleation_count:** 5
**max_size_cm:** 15
**growth_rate_mult:** 0.35
**scenarios:** ["porphyry", "reactive_wall"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Fe": 60, "O2": 1.0 }
**acid_dissolution:** null
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| octahedral | 0.25 | 0.6 | equant | moderate σ, high T (>300°C) |
| rhombic_dodecahedra | 0.3 | 0.5 | equant | low σ, with mineralizers |
| granular_massive | 0.6 | 0.3 | coating | high σ, rapid growth |
| default | 0.25 | 0.6 | equant | default — octahedral |

**color_rules:** Black, metallic. Streak black (diagnostic vs hematite red). Strongly magnetic.

---

### 16. Lepidocrocite — γ-FeOOH

**class:** hydroxide
**class_color:** #13ebeb
**nucleation_sigma:** 1.1
**max_nucleation_count:** 10
**max_size_cm:** 0.5 (typically microscopic to mm-scale)
**growth_rate_mult:** 0.5
**scenarios:** ["supergene_oxidation"]
**runtimes_present:** ["vugg.py", "index.html"]
**required_ingredients:** { "Fe": 40, "O2": 1.5 }
**acid_dissolution:** { "pH_threshold": 3.0 }
**fluorescence:** null

**habit_variants:**
| name | wall_spread | void_reach | vector | trigger |
|------|------------|-----------|--------|---------|
| platy_scales | 0.5 | 0.2 | tabular | default — weak interlayer bonding |
| plumose_rosettes | 0.4 | 0.35 | coating | moderate σ |
| fibrous_micaceous | 0.35 | 0.4 | coating | high σ |
| default | 0.5 | 0.2 | tabular | default — platy scales |

**color_rules:** Ruby-red to reddish-brown. Dimorph of goethite (same formula FeOOH, different structure = different color). Nanoscale = pink-mauve.

---

## Paragenetic Groups

### Lead Oxidation Sequence (supergene)
Galena → Anglesite → Cerussite → [Pyromorphite / Mimetite / Vanadinite]

### Copper Paragenesis (supergene)
Chalcopyrite → Bornite → Chalcocite → Covellite → Native Copper → Cuprite → Azurite → Malachite

### Bismuth Sequence (hydrothermal → supergene)
Bismuthinite → Native Bismuth → [Bismite / Clinobisvanite]

### Iron Oxide Polymorphs
Pyrite → Magnetite → Hematite → Goethite → Lepidocrocite

### Standalone
Stibnite — hydrothermal antimony sulfide, sword-like blades.

---

*All research sources: `memory/research-*.md`, cross-referenced against Mindat, GIA, USGS, and primary literature cited in individual files.*
