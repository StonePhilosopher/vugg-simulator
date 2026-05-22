# PROPOSAL: Crystallographic Habit Rendering

**Status:** Draft — awaiting builder review
**Authors:** Professor (concept), Rockbot (research & spec)
**Date:** 2026-05-22
**Related:** PROPOSAL-INITIATIVE-VARIABLE.md (v129 calibration), v127 engine gates refactor
**SIM_VERSION target:** v131+ (major arc)

---

## 1. Problem Statement

The vugg simulator renders crystals as generic 3D primitives: spheres, rectangular prisms, or simple polygons. A "quartz crystal" is visually indistinguishable from a "barite crystal" except by color and size. There is no hexagonal prism, no pyramidal termination, no striated faces, no tabular habit, no dodecahedral form.

This is a fundamental limitation. The simulator models real geochemistry — σ, temperature, pH, cation competition, graduated allocation — but the visual output is crystallographically agnostic. A player looking at the vug cannot tell whether the crystal is quartz, fluorite, wulfenite, or garnet without reading the label.

The goal is to bridge this gap: each mineral grows with its real crystallographic habit, determined by the same chemistry the simulator already models.

---

## 2. Scientific Grounding

### 2.1 Bravais-Friedel-Donnay-Harker (BFDH) Law

Crystal habit is determined by the **relative growth rates of crystallographic faces**. The BFDH law states that the morphological importance of a face is inversely proportional to its reticular density (lattice points per unit area):

- **Slow-growing faces** → large, morphologically dominant
- **Fast-growing faces** → small or absent

Example: Quartz. The prism faces {10-10} have high reticular density → grow slowly → dominate the habit. The pyramidal faces {10-11} grow faster → are present but smaller. The basal pinacoid {0001} grows at intermediate rate → present as a flat termination.

### 2.2 Supersaturation and Habit

Growth rate depends on σ (supersaturation), which the simulator already calculates:

- **Low σ** → slow, near-equilibrium growth → euhedral, well-developed faces
- **High σ** → fast, kinetically limited growth → skeletal, hopper, dendritic forms
- **Very high σ** → spherulitic or radiating growth → loss of crystallographic control

The simulator's σ_crit and initiative variable already gate nucleation. Habit rendering would extend this: σ also controls **face growth rate ratios**.

### 2.3 Impurity Face Poisoning

Trace impurities adsorb to specific faces, slowing their growth and changing habit:

- **Mg²⁺ on calcite {104}** → poisons calcite, favors aragonite
- **Fe³⁺ on quartz {10-10}** → forms amethyst color centers, also affects face energy
- **Mn²⁺ on calcite** → pink manganoan calcite, Mn substitutes for Ca
- **Cr³⁺ on corundum {0001}** → ruby red, Cr substitutes for Al

The simulator already tracks trace elements. Habit rendering would connect trace elements to specific face growth rates.

### 2.4 Twinning

Twinning is a growth accident where two crystals share a common face or axis:

- **Quartz** — Japan-law twin (90° rotation around {10-11})
- **Fluorite** — penetration twin (interpenetrating cubes)
- **Aragonite** — cyclic twin (repeated twinning around {110})
- **Staurolite** — cross twin (90° or 60° intersection)

Twinning probability depends on σ, T, and growth rate. High σ + fast growth → more twinning accidents.

---

## 3. The Proposal

### 3.1 Core Mechanic: Face-by-Face Growth

Each mineral declares:

```typescript
interface CrystalHabit {
  system: 'cubic' | 'hexagonal' | 'tetragonal' | 'orthorhombic' | 
          'monoclinic' | 'triclinic' | 'trigonal';
  forms: CrystalForm[];  // e.g., {hkl: [1,0,0], name: 'cube', dominance: 0.8}
  faceGrowthRates: { [hkl: string]: number };  // relative rates, 1.0 = baseline
  twinLaw?: TwinLaw;
}

interface CrystalForm {
  hkl: [number, number, number];
  name: string;
  baseDominance: number;  // 0-1, morphological importance at equilibrium
}

interface TwinLaw {
  axis: [number, number, number];
  angle: number;  // degrees
  probability: number;  // base probability per nucleation event
}
```

### 3.2 Growth Algorithm (Per Step)

```typescript
function growCrystal(mineral: Mineral, σ: number, fluid: Fluid): Geometry {
  // 1. Calculate face growth rates from σ + temperature + impurities
  const rates = calculateFaceGrowthRates(mineral, σ, fluid);
  
  // 2. Update crystal geometry
  for (const face of crystal.faces) {
    const rate = rates[face.hkl];
    face.advanceNormal(rate * thickness_um);
  }
  
  // 3. Retesselate — fast-growing faces shrink, slow-growing faces expand
  const geometry = retesselate(crystal);
  
  // 4. Check for twinning
  if (shouldTwin(mineral, σ, fluid)) {
    geometry.addTwinComponent(mineral.twinLaw);
  }
  
  return geometry;
}
```

### 3.3 σ-Dependent Habit Shifts

```typescript
function calculateFaceGrowthRates(mineral: Mineral, σ: number, fluid: Fluid) {
  const baseRates = mineral.habit.faceGrowthRates;
  const rates = {};
  
  for (const [hkl, baseRate] of Object.entries(baseRates)) {
    // Low σ: near-equilibrium, faces develop normally
    // High σ: fast growth, skeletal forms emerge
    const σFactor = σ > 2.0 ? 1.5 : (σ < 0.5 ? 0.8 : 1.0);
    
    // Temperature: affects surface diffusion, kink site density
    const T = fluid.temperature;
    const TFactor = T > 300 ? 1.2 : 1.0;
    
    // Impurities: face-specific poisoning
    const impurityFactor = calculateImpuritiesOnFace(mineral, hkl, fluid);
    
    rates[hkl] = baseRate * σFactor * TFactor * impurityFactor;
  }
  
  return rates;
}
```

### 3.4 Example: Quartz

```typescript
const HABIT_quartz: CrystalHabit = {
  system: 'hexagonal',
  forms: [
    { hkl: [1,0,-1,0], name: 'prism m', baseDominance: 1.0 },  // {10-10}
    { hkl: [1,0,-1,1], name: 'pyramid r', baseDominance: 0.6 }, // {10-11}
    { hkl: [0,0,0,1], name: 'pinacoid c', baseDominance: 0.3 },  // {0001}
  ],
  faceGrowthRates: {
    '10-10': 0.3,   // slow — prism dominates
    '10-11': 1.0,   // fast — pyramid smaller
    '0001': 0.7,    // medium — flat termination
  },
  twinLaw: {
    axis: [1,0,-1,1],
    angle: 90,
    probability: 0.05,  // 5% per nucleation at high σ
  },
};
```

**Low σ (σ = 0.5):** Prism faces grow slowly, pyramid grows fast-ish but not too fast → classic euhedral quartz point with hexagonal prism and sharp pyramid.

**High σ (σ = 2.0):** All faces accelerate, but prism still slowest → skeletal/hopper quartz — hollow pyramid, deeply etched prism faces.

**With Fe³⁺ impurity:** Prism faces poisoned (rate drops) → prism elongates, pyramid dominates → "amethyst scepter" habit.

### 3.5 Example: Fluorite

```typescript
const HABIT_fluorite: CrystalHabit = {
  system: 'cubic',
  forms: [
    { hkl: [1,0,0], name: 'cube', baseDominance: 1.0 },
    { hkl: [1,1,1], name: 'octahedron', baseDominance: 0.4 },
  ],
  faceGrowthRates: {
    '100': 0.5,   // slow — cube dominates
    '111': 1.0,   // fast — octahedron smaller
  },
};
```

**Low σ:** Cube faces slow → perfect cubes.
**High σ:** Octahedron faces catch up → cubes with octahedral modifications (truncated corners).
**Very high σ:** Octahedron dominates → octahedrons.

### 3.6 Example: Barite (TN457)

```typescript
const HABIT_barite: CrystalHabit = {
  system: 'orthorhombic',
  forms: [
    { hkl: [0,0,1], name: 'pinacoid c', baseDominance: 1.0 },  // tabular
    { hkl: [1,1,0], name: 'prism m', baseDominance: 0.5 },
    { hkl: [0,1,0], name: 'prism b', baseDominance: 0.3 },
  ],
  faceGrowthRates: {
    '001': 0.1,   // very slow — tabular plates
    '110': 1.0,   // fast — side faces small
    '010': 0.8,   // medium — side faces
  },
};
```

Barite's extreme tabular habit (001 pinacoid dominant) comes from the {001} face growing ~10x slower than {110}. This would be visibly obvious in the sim — flat plates, not generic blocks.

---

## 4. Renderer Architecture

### 4.1 Current State

The sim renders crystals as simple meshes (likely cubes, spheres, or low-poly prisms). Growth is uniform scaling. Color is per-mineral or per-zone.

### 4.2 Target State

Each crystal is a **polyhedron with flat faces**, defined by:
- Vertex positions (calculated from face normals and distances from center)
- Face indices (triangulated for WebGL)
- Per-face color (from zone or trace element)
- Per-face luster/roughness (from σ — high σ → rougher surfaces)

The renderer needs:
1. **Polyhedral mesh generator** — from face normals + distances, generate vertices and triangles
2. **Face-advancement algorithm** — move each face outward by its growth-rate-determined distance
3. **Retesselation** — when a face shrinks to zero, remove it; when a new face emerges, add it
4. **Twin-composition** — merge two polyhedra at the twin plane

### 4.3 LOD (Level of Detail)

For performance, small/distant crystals use simplified meshes (fewer faces). Close-up crystals use full polyhedral detail.

---

## 5. Mineral Spec Impact

Every mineral (~145) needs a `habit` field. This is a one-time spec addition. The builder can batch-add them from known crystallographic data (Mindat, Dana's New Mineralogy, etc.).

**Priority order for habit spec population:**
1. **Tier 1** (visually distinctive, common in scenarios): quartz, fluorite, barite, tourmaline, garnet, wulfenite, apophyllite, dioptase, stibnite, prehnite
2. **Tier 2** (important for sim scenarios): calcite, aragonite, gypsum, hematite, galena, sphalerite, pyrite, chalcopyrite, cinnabar, realgar
3. **Tier 3** (remaining minerals): all others

---

## 6. New Skills & Tools Required

This arc requires capabilities the current builder may not have. What skills, libraries, or learning would make this feasible?

### 6.1 3D Geometry / Computational Geometry

The renderer needs arbitrary polyhedral mesh generation from face normals + distances. Skills needed:
- **Half-edge data structures** for mesh manipulation
- **Convex hull algorithms** (e.g., QuickHull) for generating polyhedra from planes
- **Mesh retesselation** when faces shrink to zero or new faces emerge
- **Normal smoothing / flat shading** per face (crystals have flat faces, not smooth surfaces)

Potential libraries:
- **Three.js** (already used in many web projects; has BufferGeometry, custom mesh support)
- **regl** (lightweight WebGL wrapper if we want less abstraction)
- **csg.js** (constructive solid geometry for twin composition)

### 6.2 Crystallographic Computation

Habit generation requires crystallographic calculations:
- **Miller index ↔ normal vector** conversion for each crystal system
- **Zone axis calculations** for twin law application
- **Stereographic projections** for visualizing face relationships (debugging tool)
- **Lattice parameter → face distance** scaling

Potential libraries:
- **crystcif** (TypeScript crystallographic library)
- **pycif** (Python CIF parser, could pre-process mineral data)
- Custom implementation (the math is straightforward vector geometry)

### 6.3 Shader Programming

Face-specific effects need custom shaders:
- **Per-face luster** (adamite vitreous vs pyrite metallic vs gypsum silky)
- **Transparency / refraction** (fluorite translucent vs quartz transparent vs opal opaque)
- **Subsurface scattering** for thin crystal edges (fluorite blue edge glow)
- **Iridescence / thin-film** (labradorite schiller, hematite inclusions in apophyllite)

Skills: GLSL/WebGL fragment shaders, BRDF models (Cook-Torrance for metallic luster, Lambert for dull).

### 6.4 Performance Optimization

145 minerals × up to 20 faces each × up to 1000 crystals per scenario = potentially 2.9 million faces. Skills needed:
- **Instanced rendering** (draw same mesh many times with transforms)
- **LOD (Level of Detail)** — simplified meshes for small/distant crystals
- **Frustum culling** — don't render crystals outside the viewport
- **GPU skinning / morph targets** if animated growth is desired

### 6.5 Data Sources for Habit Specs

Where do the 145 habit specs come from?
- **Mindat.org** — has habit photos for most minerals
- **Dana's New Mineralogy** — habit descriptions for all known species
- **RRUFF database** — crystal structure + lattice parameters
- **AMCSD (American Mineralogist Crystal Structure Database)** — free, comprehensive
- **Manual curation** — Professor's collection specimens as ground truth (TN photos for calibration)

### 6.6 Builder Question

**What new skills or tools would be most useful to acquire for this arc?**

- Three.js advanced geometry / custom shaders?
- Computational geometry / mesh algorithms?
- GLSL/WebGL shader programming?
- Crystallographic math (Miller indices, zone axes, stereographic projections)?
- Performance optimization (instancing, LOD, culling)?
- Something else entirely?

The builder should answer with their comfort level and what they'd need to learn or what tools they'd want to adopt.

---

## 7. Open Questions

### Q1: What renderer library?

Option A: Custom WebGL polyhedral renderer (more control, more work)
Option B: Three.js with custom geometry (faster to build, dependency)
Option C: Upgrade existing renderer (if it already uses a library)

### Q2: Twinning scope?

Option A: Simple twins only (quartz Japan-law, fluorite penetration)
Option B: All common twins (aragonite cyclic, staurolite cross, etc.)
Option C: Twinning deferred to v133+ (habit first, twins later)

### Q3: Skeletal/hopper forms?

Option A: Full skeletal rendering (hollow interiors, hopper depressions)
Option B: Skeletal indicated by texture/opacity, not true geometry
Option C: Skeletal deferred — euhedral habits only for v131

### Q4: Impurity face poisoning?

Option A: Full face-specific impurity effects (complex but physical)
Option B: Global impurity effect on all faces (simpler, less accurate)
Option C: Impurity effects deferred to v132+ calibration

### Q5: How does this interact with per-zone color?

The per-zone color system (v121) already colors different parts of a crystal differently. With face-by-face geometry, color zoning would map naturally to growth zones — each new zone is a new set of face distances with new colors.

**Answer:** Per-zone color becomes **growth-zone color** — concentric shells of color, visible as phantom zones inside the crystal. This is physically correct: each growth episode adds a new layer with its own color.

---

## 8. Sequencing

**v131 (infrastructure):**
- Habit spec format defined
- Polyhedral mesh generator
- Renderer upgrade to support flat faces
- 10 Tier 1 minerals get habit specs
- SIM_VERSION bump

**v132 (habit live):**
- All minerals get habit specs
- Face-by-face growth algorithm wired into run_step
- σ-dependent habit shifts active
- New baselines (all scenarios will drift — expected)

**v133 (twinning):**
- Twin laws for common minerals
- Twin probability from σ + T
- Visual composition of twin components

**v134 (skeletal + impurities):**
- Skeletal/hopper forms at high σ
- Face-specific impurity poisoning
- Calibration against real mineral photos

---

## 9. Calibration Ground Truth

The proposal can be validated against real mineral specimens:

- **Quartz:** euhedral points (low σ), skeletal/hopper (high σ), scepters (Fe poisoning)
- **Fluorite:** cubes (low σ), octahedrons (high σ), penetration twins
- **Barite:** extreme tablets (always — {001} always slow)
- **Wulfenite:** tabular {001} with pyramidal modifications
- **Tourmaline:** trigonal prisms with striations, watermelon zoning
- **Apophyllite:** tetragonal bipyramids, often in divergent groups
- **Dioptase:** small rhombohedral crystals (not prismatic — it's a cyclosilicate)

---

## References

- Hartman, P. & Perdok, W.G. (1955). "On the relations between structure and morphology of crystals." *Acta Crystallographica*, 8(1), 49-52.
- Sunagawa, I. (1987). *Morphology of Crystals*. Terra Scientific.
- De Yoreo, J.J. & Vekilov, P.G. (2003). "Principles of crystal nucleation and growth." *Reviews in Mineralogy and Geochemistry*, 54, 57-93.
- Dana, J.D. & Dana, E.S. *Dana's New Mineralogy* (8th ed.). Wiley.
- Mindat.org — habit photographs for calibration

---

*End of proposal. Awaiting builder review and Professor's answers to Q1-Q4.*
