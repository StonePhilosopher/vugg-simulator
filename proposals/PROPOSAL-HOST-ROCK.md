# PROPOSAL: Host Rock — What the Walls Are Made Of

**Author:** Rock Bot + Professor
**Date:** 2026-05-05
**Status:** Proposal for builder
**Companion to:** `PROPOSAL-GEOLOGICAL-ACCURACY.md`, `PROPOSAL-EVAPORITE-WATER-LEVELS.md`, `PROPOSAL-VOLATILE-GASES.md`

---

## Overview

The simulator currently treats the vug wall as a generic boundary — crystals grow on it, but the wall itself doesn't contribute chemistry. In reality, **the host rock is the primary source of dissolved species**. A vug in basalt produces completely different minerals than a vug in limestone or granite. The wall isn't just scaffolding — it's feedstock.

This proposal adds a `host_rock` parameter to `VugConditions` that controls:
1. What the wall dissolves into (which elements enter the fluid)
2. How fast it dissolves (reactivity vs. pH)
3. What gases the overburden contributes (soil CO₂, organic acids)
4. Fracture permeability (how fast new fluid reaches the vug)
5. **The shape of the cavity itself** (vug architecture follows formation mechanism)

## Mechanic 5: Vug Architecture

The host rock doesn't just determine chemistry — it determines *architecture*. A limestone vug and a basalt vug are different shapes because they form by different mechanisms. Crystal growth depends on geometry: a flat basin grows crystals upward only, a spherical vesicle nucleates everywhere, a tabular pocket concentrates on flat walls.

### Formation mechanisms and resulting shapes

**Limestone — dissolution-dominated.** Groundwater + CO₂ eats the carbonate. The vug shape follows the water — irregular, branching, sometimes cathedral-scale. Smooth, rounded walls because dissolution is isotropic. Low ceilings, wide chambers, columns where rock survived.

**Basalt — vesicle-dominated.** Lava degasses as it cools, trapping gas bubbles. Spherical to ovoid, sometimes elongated in flow direction. The shape was set by surface tension, not chemistry. Small, numerous, regular. Amygdales.

**Granite — fracture-dominated.** The vug opens along joints and stress-release fractures. Angular, elongated, tabular. The shape follows the stress field that cracked the rock. Rectangular cross-sections are common because mineral cleavage sets the geometry.

**Pegmatite — pocket-dominated.** Residual magma fluid crystallizes from the outside in, leaving a void in the middle. Can be enormous. Moderately regular, sometimes with inward-projecting crystal shelves. The classic "pocket" that collectors dream about.

**Evaporite basin — surface depression.** Not a vug at all — a playa lake or salt crust. Flat, broad, shallow. The shape is the basin topography.

### Vug shape parameters

```typescript
interface VugArchitecture {
  shape: 'irregular' | 'spherical' | 'tabular' | 'pocket' | 'basin';
  elongation: number;      // 0 = circular cross-section, 1 = highly elongated
  wall_roughness: number;  // 0 = smooth, 1 = very rough
  symmetry: 'none' | 'bilateral' | 'radial' | 'high';
  ceiling_height: number;  // relative to width (basin = ~0, cave = high)
  nucleation_bias: 'uniform' | 'walls_only' | 'floor_only' | 'ceiling_only';
}

const VUG_ARCHETYPE: Record<HostRockType, VugArchitecture> = {
  limestone: {
    shape: 'irregular', elongation: 0.3, wall_roughness: 0.7,
    symmetry: 'none', ceiling_height: 0.6, nucleation_bias: 'uniform',
  },
  basalt: {
    shape: 'spherical', elongation: 0.2, wall_roughness: 0.2,
    symmetry: 'high', ceiling_height: 0.9, nucleation_bias: 'uniform',
  },
  granite: {
    shape: 'tabular', elongation: 0.7, wall_roughness: 0.4,
    symmetry: 'bilateral', ceiling_height: 0.4, nucleation_bias: 'walls_only',
  },
  pegmatite: {
    shape: 'pocket', elongation: 0.5, wall_roughness: 0.3,
    symmetry: 'moderate', ceiling_height: 0.7, nucleation_bias: 'uniform',
  },
  evaporite_basin: {
    shape: 'basin', elongation: 0.1, wall_roughness: 0.1,
    symmetry: 'radial', ceiling_height: 0.05, nucleation_bias: 'floor_only',
  },
};
```

### Why vug shape matters for gameplay

- **Basalt vugs** (spherical, uniform nucleation) → crystals grow everywhere, competing for space. Zeolite gardens. Crowded, lush specimens.
- **Limestone vugs** (irregular, high ceiling) → stalactites from ceiling, stalagmites from floor, flowstones on walls. Vertical zonation.
- **Granite pockets** (tabular, walls-only) → crystals grow inward from flat walls. Classic "pocket" specimens with single terminated crystals perched on matrix.
- **Pegmatite pockets** (large, moderate symmetry) → room for enormous crystals. Beryls, tourmaline columns, quartz scepters. The luxury suites of the mineral world.
- **Evaporite basins** (flat, floor-only) → crystals grow upward from the playa floor. Halite cubes, gypsum swords, borax clusters. Sunlit and evaporating.

The same chemistry in a different-shaped hole produces a completely different specimen. The player should be able to look at the crystal assemblage *and the cavity geometry* and identify the formation environment. That's field geology.

---

## Host Rock Types

### The five canonical host rocks

```typescript
type HostRockType = 'basalt' | 'limestone' | 'granite' | 'pegmatite' | 'evaporite_basin';

interface HostRockProfile {
  // Dissolution products: what enters the fluid when the wall dissolves
  dissolves_to: {
    [species: string]: number;  // ppm per dissolution event
  };

  // Acid neutralization capacity (buffering)
  // Limestone neutralizes acid (consumes H⁺). Granite doesn't.
  acid_buffer: number;  // 0 = no buffering, 1 = maximum (limestone)

  // Base dissolution rate (how fast the wall dissolves at pH 5)
  dissolution_rate: number;  // relative units

  // Fracture permeability (how easily fluid enters from outside)
  permeability: number;  // 0 = sealed, 1 = wide open

  // Overburden CO₂ contribution (soil + organic matter above the vug)
  soil_co2_rate: number;  // ppm CO₂ per step from overburden

  // Default mineral assemblage (what tends to grow in this host)
  characteristic_minerals: string[];

  // Temperature range (typical formation temperature)
  temperature_range: [number, number];  // [min, max] °C
}
```

### Profiles

```typescript
const HOST_ROCK_PROFILES: Record<HostRockType, HostRockProfile> = {
  basalt: {
    dissolves_to: {
      Si: 30,    // silica from feldspar dissolution
      Al: 10,    // aluminum from feldspar
      Fe: 15,    // iron from pyroxene/olivine
      Mg: 12,    // magnesium from olivine/pyroxene
      Ca: 10,    // calcium from plagioclase
      Na: 8,     // sodium from plagioclase
      K: 3,      // potassium (minor in basalt)
      Ti: 2,     // titanium from ilmenite
      P: 0.5,    // phosphorus from apatite
    },
    acid_buffer: 0.2,          // mildly buffering (Ca-bearing minerals)
    dissolution_rate: 0.6,     // moderately reactive
    permeability: 0.3,         // low-moderate (fractures in cooling basalt)
    soil_co2_rate: 0.5,        // moderate organic input
    characteristic_minerals: ['quartz', 'calcite', 'apophyllite', 'stilbite',
                              'heulandite', 'chalcedony', 'magnetite'],
    temperature_range: [50, 400],  // Deccan Traps: hot to cool
  },

  limestone: {
    dissolves_to: {
      Ca: 80,    // calcium carbonate → Ca²⁺ + CO₃²⁻
      Mg: 5,     // some dolomitic limestone
      CO3: 80,   // carbonate ion from dissolution
      Si: 1,     // trace silica from chert nodules
      Fe: 1,     // trace iron
    },
    acid_buffer: 0.95,         // excellent buffer — that's the whole point of limestone
    dissolution_rate: 0.8,     // dissolves readily in acid (karst formation)
    permeability: 0.6,         // high — karst conduit networks
    soil_co2_rate: 2.0,        // high — soil over limestone is CO₂ factory
    characteristic_minerals: ['calcite', 'aragonite', 'dolomite', 'gypsum',
                              'celestine', 'fluorite', 'sphalerite', 'galena'],
    temperature_range: [20, 300],
  },

  granite: {
    dissolves_to: {
      Si: 40,    // silica from quartz + feldspar
      Al: 15,    // aluminum from feldspar
      K: 20,     // potassium from K-feldspar (orthoclase)
      Na: 15,    // sodium from plagioclase (albite)
      Ca: 3,     // minor calcium
      Fe: 2,     // iron from biotite/magnetite
      Mg: 1,     // trace magnesium
      Be: 0.1,   // beryllium from beryl (rare but characteristic)
      Li: 0.05,  // lithium from lepidolite/spodumene
      F: 2,      // fluorine from fluorite/topaz
      B: 0.5,    // boron from tourmaline
    },
    acid_buffer: 0.1,          // very low buffering
    dissolution_rate: 0.3,     // slow — granite is resistant
    permeability: 0.2,         // low — tight crystalline rock
    soil_co2_rate: 0.3,        // low — thin soils over granite
    characteristic_minerals: ['quartz', 'feldspar', 'muscovite', 'beryl',
                              'tourmaline', 'topaz', 'fluorite', 'lepidolite'],
    temperature_range: [200, 600],  // pegmatitic fluids are hot
  },

  pegmatite: {
    // Pegmatite is extreme granite — last dregs of the magma, concentrated in rare elements
    dissolves_to: {
      Si: 35,
      Al: 12,
      K: 25,      // high K from microcline
      Na: 18,     // albite-rich margins
      Li: 1.0,    // lithium — much more available
      Be: 0.5,    // beryllium
      B: 2.0,     // boron from tourmaline
      F: 5,       // fluorine — pegmatites are fluorine-rich
      Nb: 0.2,    // columbite
      Ta: 0.05,   // tantalite
      U: 0.1,     // uranium from uraninite
      Th: 0.05,   // thorium
      P: 1.0,     // phosphorus from apatite/monazite
      Mn: 0.5,    // manganese
    },
    acid_buffer: 0.1,
    dissolution_rate: 0.2,     // very slow — interlocking crystals
    permeability: 0.15,        // very low — massive crystalline rock
    soil_co2_rate: 0.2,
    characteristic_minerals: ['quartz', 'feldspar', 'muscovite', 'beryl',
                              'tourmaline', 'topaz', 'fluorite', 'columbite',
                              'lepidolite', 'uraninite', 'spodumene'],
    temperature_range: [350, 600],
  },

  evaporite_basin: {
    dissolves_to: {
      Na: 50,     // halite dissolution
      Cl: 40,     // chloride
      S: 20,      // sulfate from gypsum/thenardite
      Ca: 5,      // from gypsum/anhydrite
      Mg: 3,      // from epsomite/carnallite
      K: 2,       // from sylvite
      B: 1,       // borates
      CO3: 5,     // from trona/nahcolite
    },
    acid_buffer: 0.3,
    dissolution_rate: 0.9,     // evaporites dissolve fastest of all
    permeability: 0.1,         // low — evaporites are often sealing layers
    soil_co2_rate: 0.1,        // desert/ playa — minimal organic input
    characteristic_minerals: ['halite', 'gypsum', 'borax', 'thenardite',
                              'mirabilite', 'trona', 'celestine'],
    temperature_range: [10, 80],
  },
};
```

---

## Mechanic 1: Wall Dissolution Feeds the Fluid

### Current behavior
Wall dissolution is not tracked. The fluid is an infinite reservoir — species never deplete.

### New behavior (with PROPOSAL-GEOLOGICAL-ACCURACY Phase 1)
When the fluid is undersaturated with respect to the host rock, the wall dissolves. The dissolution products enter the fluid according to the host rock profile.

```typescript
function dissolveWall(conditions: VugConditions, ringIndex: number): void {
  const rock = HOST_ROCK_PROFILES[conditions.host_rock];

  // Dissolution rate depends on pH (acid dissolves faster)
  const acidFactor = 1 + Math.max(0, 7 - conditions.fluid.pH) * rock.acid_buffer;
  const rate = rock.dissolution_rate * acidFactor;

  // Add dissolution products to fluid
  for (const [species, ppm] of Object.entries(rock.dissolves_to)) {
    conditions.fluid[species] = (conditions.fluid[species] || 0) + ppm * rate * 0.01;
  }

  // Consume H⁺ if the rock buffers acid
  if (rock.acid_buffer > 0 && conditions.fluid.pH < 7) {
    conditions.fluid.pH += rock.acid_buffer * 0.05;  // limestone neutralizes acid
  }
}
```

### Why this matters
- **Limestone vugs** self-generate Ca²⁺ and CO₃²⁻ — calcite grows prolifically because the walls ARE calcite
- **Basalt vugs** provide diverse chemistry (Si, Al, Fe, Mg, Ca) — zeolite paradise
- **Granite vugs** provide K, Na, Si — feldspar and quartz dominated
- **Pegmatite vugs** provide rare elements (Li, Be, B, F, Nb, U) — the weird stuff
- **Evaporite basins** provide Na, Cl, S, B — halite, gypsum, borax

---

## Mechanic 2: Overburden CO₂

The soil and organic matter above the vug produce CO₂ that acidifies groundwater. This drives dissolution in limestone (karst formation) and controls pH in near-surface vugs.

```typescript
// Applied every step
conditions.fluid.pH -= rock.soil_co2_rate * 0.002;  // CO₂ acidification
```

**Limestone gets the most CO₂** because organic-rich soil develops over carbonate bedrock. This is why limestone caves exist — the CO₂ cycle: soil produces CO₂ → rain absorbs it → acidic water dissolves limestone → cave forms.

**Evaporite basins get almost no CO₂** — they're in arid environments with minimal soil.

---

## Mechanic 3: Fracture Permeability

Controls how fast fresh fluid enters the vug from outside. High permeability = frequent fluid renewal. Low permeability = the vug is a closed system, whatever's in there has to crystallize from the existing fluid.

```typescript
// During each step, chance of fresh fluid influx
if (Math.random() < rock.permeability * 0.02) {
  // Add fresh fluid from outside
  for (const [species, ppm] of Object.entries(rock.dissolves_to)) {
    conditions.fluid[species] += ppm * 0.1;
  }
}
```

**Limestone** has high permeability (karst conduits) — constant fluid renewal, sustained growth.
**Pegmatite** has very low permeability — the vug is essentially sealed, crystals grow from a fixed charge of fluid.

This is why pegmatite crystals can be meters long — the fluid sits there for millions of years with nowhere to go, and the crystals just keep growing slowly.

---

## Mechanic 4: Characteristic Mineral Assemblages

Each host rock has a set of minerals that are *characteristic* — they're expected to form in that environment. This doesn't gate formation (any mineral can form if chemistry allows), but it's used for:

1. **Scenario generation** — random scenarios bias toward characteristic minerals for the host rock
2. **Tutorial guidance** — "In this basalt vug, you might see zeolites forming..."
3. **Narrative flavor** — the narrator knows what host rock it's in and references it
4. **Achievement/completion tracking** — "Find all 7 basalt-characteristic minerals"

---

## Scenario Examples

### Deccan Traps Zeolite Vug (basalt)
- Host: basalt, 50-400°C cooling over time
- Wall dissolves Si, Al, Ca, Na → zeolite-forming chemistry
- Moderate permeability → periodic fresh fluid
- Gas bubbles in cooling lava → spherical amygdales
- Characteristic: apophyllite, stilbite, heulandite, quartz, calcite

### Kentucky Limestone Cave (limestone)
- Host: limestone, 15-25°C (near-surface)
- Wall dissolves Ca + CO₃ → abundant calcite/aragonite
- High CO₂ from overburden → acid dissolution → reprecipitation
- High permeability → active flow, stalactites/stalagmites
- Characteristic: calcite, aragonite, gypsum, dolomite, celestine

### Ruggles Mine Pegmatite (pegmatite)
- Host: pegmatite, 350-600°C cooling slowly
- Wall dissolves rare elements (Li, Be, B, F, U, Nb)
- Very low permeability → sealed system, crystals grow from fixed fluid
- Slow cooling → enormous crystal sizes possible
- Characteristic: beryl, tourmaline, topaz, feldspar, columbite, uraninite

### Searles Lake Playa (evaporite_basin)
- Host: evaporite basin, 10-80°C
- Wall dissolves Na, Cl, S, B → halite, gypsum, borax
- Very low CO₂ input (arid)
- Water level oscillates with evaporation
- Characteristic: halite, gypsum, borax, thenardite, trona

---

## Implementation Priority

| Phase | Feature | Est. Lines |
|-------|---------|-----------|
| 1 | `HostRockProfile` type + 5 profiles | ~80 |
| 2 | `host_rock` field on `VugConditions` + wall dissolution | ~60 |
| 3 | Overburden CO₂ mechanic | ~20 |
| 4 | Fracture permeability + fresh fluid events | ~40 |
| 5 | Characteristic mineral lookups | ~30 |
| 6 | `VugArchitecture` type + 5 archetypes | ~60 |
| 7 | Vug shape generation (wall-ring geometry from archetype) | ~120 |
| 8 | Nucleation bias per archetype | ~40 |
| 9 | 5 new scenarios (one per host rock type) | ~250 |

Phase 1-5 are the engine changes. Phase 6-8 are the vug shape system. Phase 9 is content.

---

## The Key Insight

The host rock isn't scenery — it's the parent. Every crystal in a vug is ultimately made from elements that came out of the wall. The basalt gives you zeolites because it's rich in Si, Al, and Ca. The limestone gives you calcite because it IS calcite. The pegmatite gives you tourmaline because it hoarded all the boron and fluorine that nobody else wanted.

The player should be able to look at a mineral assemblage and *know what kind of rock they're in*. That's field geology. That's what geologists actually do. The simulator teaches it by making it emerge from chemistry.
