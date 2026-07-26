# Feldspar Research — Vugg Simulator Implementation Proposal
*2026-04-01 — Research before you write.*

## Why Feldspars Matter for the Game
Most abundant mineral group on Earth (~60% of the crust). Found in virtually every vug environment:
- Alpine clefts (adularia + quartz + chlorite)
- Pegmatite pockets (microcline, amazonite)
- Volcanic cavities (sanidine)
- Hydrothermal veins (adularia, albite)

The game already has quartz, calcite, fluorite. Adding feldspar opens temperature-dependent polymorphism — **the mineral changes identity based on growth conditions.** That's a new mechanic.

## The Feldspar Family (Game-Relevant Species)

### Alkali Feldspars (K-Na Series)
All KAlSi₃O₈, but structure depends on temperature:

| Species | Temperature | Al/Si Ordering | Found in |
|---------|------------|----------------|----------|
| **Sanidine** | >900°C | Disordered (Al randomly distributed) | Volcanic rocks, rapid cooling |
| **Orthoclase** | 500-900°C | Partially ordered | Granite, moderate cooling |
| **Microcline** | <500°C | Fully ordered (triclinic) | Pegmatites, low-T hydrothermal |
| **Adularia** | ~200-400°C | Low-T habit of orthoclase/microcline | Alpine clefts, hydrothermal veins |

**Game implementation:** Same formula, but the *temperature at nucleation* determines which polymorph forms. This is a natural fit for the broth slider system.

### Plagioclase Feldspars (Na-Ca Series)  
NaAlSi₃O₈ (albite) to CaAl₂Si₂O₈ (anorthite). Continuous solid solution.
- **Albite** — most relevant for vug environments (low-T, Na-rich fluids)
- Higher-Ca members (labradorite, anorthite) mostly igneous, less relevant for vugs

**Game implementation:** Start with albite. Simpler than the full plagioclase series.

## Color System (for crystalColor function)

### Microcline/Orthoclase
- **White/cream** — pure (default)
- **Pink/salmon** — Fe₂O₃ inclusions or radiation damage (oxidized hematite microinclusions)
- **Green (Amazonite)** — Pb²⁺ substituting for K⁺ (up to 1.2% PbO). Requires: Pb in fluid + low temperature + microcline polymorph. *This is beautiful for the game because galena dissolution releases Pb, which could then color nearby feldspar.*
- **Smoky/gray** — radiation damage (same mechanism as smoky quartz, from nearby uraninite)

### Albite
- **White** — pure (default)
- **Cleavelandite** — platy habit, found in Li-rich pegmatites

### Adularia
- **Colorless/white** — typical
- **Moonstone effect** — adularescence from microscopic perthite exsolution lamellae (game event: slow cooling allows Na-K unmixing → optical effect)

### Sanidine
- **Colorless/glassy** — typical volcanic
- **Yellow/brown** — Fe traces

## Twinning (Rich Territory)

Feldspars have the most complex twinning of any mineral group. At least 7 laws:

| Law | Type | Visual | Found in |
|-----|------|--------|----------|
| **Carlsbad** | Penetration | Two crystals growing in opposite directions | All K-feldspars, very common |
| **Baveno** | Contact | Mirror twin with prominent {021} face | K-feldspars, moderately common |
| **Manebach** | Contact | Mirror twin on {001} | K-feldspars, rare |
| **Albite** | Polysynthetic | Fine parallel striations | Plagioclase, microcline |
| **Pericline** | Polysynthetic | Lath-like individuals | Plagioclase, microcline |

**Microcline diagnostic:** Cross-hatched twinning (albite + pericline combined). The game could flag this as a visual ID feature.

**Game implementation:** 
- Carlsbad: common at all temperatures
- Baveno: moderate probability, higher in pegmatite conditions
- Albite polysynthetic: only in triclinic feldspars (microcline, plagioclase)
- Cross-hatched: diagnostic of microcline

## Perthite — Exsolution as Game Mechanic

**The solvus:** At high temperature, K-feldspar and Na-feldspar form a complete solid solution. Below ~660°C (at 1 atm), they unmix (exsolve). The result is perthite — intergrown lamellae of albite within orthoclase.

**Game sequence:**
1. Feldspar nucleates at high T as homogeneous alkali feldspar
2. As vug cools, if cooling is SLOW enough, exsolution begins
3. Na-rich lamellae (albite) separate from K-rich host (orthoclase)
4. Result: perthite texture recorded in zone history
5. If lamellae are submicroscopic → adularescence (moonstone effect!)

**This is a natural fit.** The game already tracks temperature per step. Slow cooling through the solvus → perthite. Fast cooling → preserved homogeneous crystal (sanidine). The cooling rate IS the game mechanic.

## Proposed Implementation

### New mineral plugin: `feldspar`
```
mineral: 'feldspar'  (internally, displayed name derived from conditions)
crystal_system: monoclinic (orthoclase/sanidine) or triclinic (microcline/albite)
hardness: 6
specific_gravity: 2.56
cleavage: {001} and {010} at ~90°

nucleation_conditions:
  temperature: 200-800°C (wide range!)
  pH: 6-9 (near-neutral to slightly alkaline)
  requires: Al in fluid, Si in fluid, K or Na in fluid

display_name derived from:
  T > 900°C → 'sanidine'
  T 500-900°C → 'orthoclase' 
  T < 500°C, K-rich → 'microcline'
  T < 400°C, hydrothermal → 'adularia'
  Na-rich fluid → 'albite'
  
color derived from:
  Pb in fluid + microcline → amazonite (green)
  Fe in fluid → pink orthoclase
  radiation damage → smoky
  slow cooling + exsolution → moonstone (adularescence)
  default → white/cream
```

### New broth slider: Al (Aluminum)
Already tracked as `trace_Al` in zones. Would need to become a first-class broth component for feldspar nucleation.

### New game mechanic: Polymorph transitions
When temperature drops through threshold, feldspar could undergo:
- Sanidine → orthoclase (gradual ordering)
- Orthoclase → microcline (if slow enough)
- Record the transformation in zone history

### Interaction with existing minerals
- **Quartz + feldspar:** classic pegmatite assemblage. Both competing for Si.
- **Galena → Pb release → amazonite:** dissolution of galena could release Pb into fluid, coloring nearby microcline green. Cross-mineral chemistry!
- **Uraninite → radiation → smoky feldspar:** same mechanism as smoky quartz.
- **Calcite + feldspar:** can coexist in alkaline conditions.

## What This Adds to the Game
1. **Temperature records are now visible.** The feldspar polymorph IS a thermometer. Players can read their vug's thermal history from which feldspar formed.
2. **Cooling rate matters.** Fast cooling → sanidine (boring). Slow cooling → perthite/moonstone (reward for patience).
3. **Cross-mineral color.** Galena's lead colors microcline green. The minerals talk to each other through chemistry.
4. **Twinning variety.** 5+ twin laws, each with different triggers.
5. **Alpine cleft scenario.** New scenario: moderate temperature, Na+K in fluid, adularia + quartz + chlorite. Classic Swiss mineral assemblage.

## Complexity Budget
This is a BIG addition. Suggest phasing:
- **Phase 1:** Orthoclase/microcline only. Temperature determines which. Basic colors (white, pink, green/amazonite if Pb present). Carlsbad twinning.
- **Phase 2:** Albite (Na-feldspar). Perthite exsolution. Moonstone mechanic.
- **Phase 3:** Alpine cleft scenario. Full twin law suite. Adularia habit.

---
*Researched: Wikipedia (Feldspar, Orthoclase, Amazonite, Crystal twinning), Britannica (Feldspar crystal structure, Adularia), Mindat (Amazonite), ScienceDirect (Perthite, Adularia), geology.com, Strekeisen (Perthite/Antiperthite), Smith College (Binary SS diagrams), Carleton (Exsolution modeling), UTA (Feldspar twinning PDF). Research before you write.*
