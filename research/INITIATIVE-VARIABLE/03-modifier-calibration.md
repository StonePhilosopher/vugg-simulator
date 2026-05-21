# 03: Modifier Calibration — Proposed Values

**Date:** 2026-05-21
**Status:** Proposed — needs builder review and seed-42 validation
**Method:** Literature-derived starting points, empirically tuned against baselines

---

## Temperature Modifier Calibration

### Rationale
Temperature affects initiative through two mechanisms:
1. **Kinetic effect:** Higher T → lower activation barrier (Arrhenius)
2. **Thermodynamic effect:** Higher T → changes Ksp → changes σ

For most minerals, the thermodynamic effect dominates. We map this to a simple modifier.

### Proposed Ranges (to add to data/minerals.json)

```json
{
  "calcite": {
    "preferredTempRange": [20, 120, 80],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 1.5
  },
  "aragonite": {
    "preferredTempRange": [10, 100, 60],
    "surfaceEnergy": "low",
    "criticalSupersaturation": 1.8
  },
  "quartz": {
    "preferredTempRange": [150, 400, 250],
    "surfaceEnergy": "high",
    "criticalSupersaturation": 2.5
  },
  "barite": {
    "preferredTempRange": [50, 250, 150],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 2.0
  },
  "sphalerite": {
    "preferredTempRange": [100, 300, 200],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 2.2
  },
  "galena": {
    "preferredTempRange": [80, 250, 150],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 2.0
  },
  "gypsum": {
    "preferredTempRange": [10, 60, 35],
    "surfaceEnergy": "low",
    "criticalSupersaturation": 1.2
  },
  "anhydrite": {
    "preferredTempRange": [80, 200, 120],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 1.8
  },
  "opal": {
    "preferredTempRange": [10, 80, 40],
    "surfaceEnergy": "very_low",
    "criticalSupersaturation": 0.8
  },
  "fluorite": {
    "preferredTempRange": [50, 250, 150],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 2.0
  },
  "apatite": {
    "preferredTempRange": [80, 350, 200],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 2.0
  },
  "cinnabar": {
    "preferredTempRange": [80, 250, 150],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 2.0
  },
  "metacinnabar": {
    "preferredTempRange": [80, 250, 150],
    "surfaceEnergy": "medium",
    "criticalSupersaturation": 2.0
  }
}
```

### Calibration Method

1. **Start with literature values** (above)
2. **Run seed-42 baseline** with initiative enabled
3. **Compare to v125 baseline**
4. **Adjust ranges** until:
   - Byte-identical in simple scenarios (tutorial, stalactite)
   - Acceptable drift in dense suites (supergene, schneeberg)
   - Drift improves paragenesis realism (e.g., opal before quartz in low-T)
5. **Document rationale** for each adjustment

### Expected Drift Patterns

| Scenario | Expected Change | Rationale |
|----------|----------------|-----------|
| tutorial_first_crystal | None | Simple, single mineral |
| tutorial_travertine | Slight | Calcite + aragonite competition |
| stalactite_demo | None | Deterministic, sequential |
| deccan_zeolite | Moderate | Opal should win initiative at low T |
| schneeberg | Significant | Dense Cu-suite, competition penalties |
| supergene_oxidation | Significant | Dense Zn-As suite, competition penalties |
| sulphur_bank | Slight | Metacinnabar vs cinnabar competition |

---

## Edge-of-Gate Calibration

### σ_crit Values

The builder already has σ_crit implicitly — it's the threshold in each mineral's engine. We can extract it or specify it explicitly.

**Option A: Extract from engines**
```typescript
function getSigmaCrit(mineral: string): number {
  const engine = MINERAL_ENGINES[mineral];
  // The threshold is the σ value where the engine transitions from 
  // "no nucleation" to "possible nucleation"
  // This is the first gate in the engine's grow function
  return engine.gates[0].threshold;
}
```

**Option B: Explicit spec field**
```json
{
  "criticalSupersaturation": 1.5
}
```

**Recommendation:** Option B for clarity, but validate against Option A. If they diverge, the spec field takes precedence (documented deviation).

### Modifier Function

```typescript
function edgeOfGateModifier(σ: number, σ_crit: number): number {
  const ratio = σ / σ_crit;
  
  if (ratio < 0.5) return -1;    // nowhere near
  if (ratio < 1.0) return -2;   // below threshold — shouldn't fire anyway
  if (ratio < 1.1) return -2;   // fragile — just above threshold
  if (ratio < 1.3) return -1;   // edgy but workable
  if (ratio < 2.0) return 0;    // comfortable
  return +1;                     // robust — well above threshold
}
```

### Validation Target

The edge-of-gate penalty should **predict v125 cascade minerals**:
- dioptase (σ/σ_crit ≈ 1.05 in schneeberg) → -2 → low initiative
- pyrolusite (σ/σ_crit ≈ 0.9 in bisbee) → -2 → low initiative
- koettigite (σ/σ_crit ≈ 1.1 in supergene) → -2 → low initiative

If the penalty correctly flags these as fragile, the modifier is calibrated.

---

## Competition Penalty Calibration

### Shared Cation Groups

From v125 findings and mineral stoichiometry:

```typescript
const COMPETITION_GROUPS = {
  'Cu': ['dioptase', 'brochantite', 'antlerite', 'chalcopyrite', 'bornite', 'chalcocite', 'cuprite', 'malachite', 'azurite', 'chrysocolla'],
  'Zn': ['sphalerite', 'wurtzite', 'smithsonite', 'hemimorphite', 'willemite', 'hydrozincite', 'aurichalcite', 'koettigite', 'legrandite'],
  'Pb': ['galena', 'anglesite', 'cerussite', 'pyromorphite', 'mimetite', 'vanadinite', 'duftite', 'bayldonite', 'descloizite', 'mottramite', 'raspite', 'stolzite', 'wulfenite'],
  'As': ['arsenopyrite', 'scorodite', 'erythrite', 'annabergite', 'koettigite', 'austinite', 'legrandite', 'duftite', 'bayldonite'],
  'Fe': ['pyrite', 'marcasite', 'hematite', 'goethite', 'lepidocrocite', 'magnetite', 'siderite', 'tigers_eye'],
  'Mn': ['rhodochrosite', 'pyrolusite', 'manganite', 'hausmannite', 'psilomelane'],
  'Ca': ['calcite', 'aragonite', 'dolomite', 'gypsum', 'anhydrite', 'fluorite', 'apatite', 'vesuvianite', 'grossular', 'diopside'],
  'SiO2': ['quartz', 'opal', 'chalcedony', 'chrysocolla', 'zeolites'],
  'S': ['sphalerite', 'galena', 'pyrite', 'marcasite', 'cinnabar', 'acanthite', 'argentite', 'realgar', 'orpiment'],
  'SO4': ['barite', 'celestine', 'anhydrite', 'gypsum', 'jarosite', 'alunite'],
  'CO3': ['calcite', 'aragonite', 'dolomite', 'siderite', 'smithsonite', 'cerussite', 'malachite', 'azurite', 'rhodochrosite'],
  'PO4': ['apatite', 'pyromorphite', 'mimetite', 'vanadinite', 'wavellite', 'crandallite', 'plumbogummite']
};
```

### Penalty Function

```typescript
function competitionModifier(mineral: string, activeMinerals: string[]): number {
  const myStoich = MINERAL_STOICHIOMETRY[mineral];
  if (!myStoich) return 0;
  
  const myCations = Object.keys(myStoich).filter(k => k !== 'OH' && k !== 'H2O');
  
  let maxPenalty = 0;
  for (const [cation, competitors] of Object.entries(COMPETITION_GROUPS)) {
    if (!myCations.includes(cation)) continue;
    
    const activeCompetitors = competitors.filter(m => 
      m !== mineral && activeMinerals.includes(m)
    );
    
    if (activeCompetitors.length >= 2) maxPenalty = -2;
    else if (activeCompetitors.length === 1 && maxPenalty > -2) maxPenalty = -1;
  }
  
  return maxPenalty;
}
```

### Validation Target

- **supergene_oxidation:** 10+ minerals share Zn/Pb/As → most get -2 penalty
- **schneeberg:** 8+ minerals share Cu/Ca/As → most get -2 penalty
- **gem_pegmatite:** few shared cations → most get 0 penalty
- **sulphur_bank:** Hg shared by cinnabar + metacinnabar → -1 penalty

---

## Surface Energy Calibration

### Categories

| Category | γ range (J/m²) | Modifier | Examples |
|----------|---------------|----------|----------|
| very_low | < 0.15 | +2 | opal, amorphous silica, gel minerals |
| low | 0.15–0.3 | +1 | gypsum, aragonite (Mg-poisoned), malachite |
| medium | 0.3–0.6 | 0 | calcite, barite, fluorite, apatite, sphalerite |
| high | 0.6–1.2 | -1 | quartz, topaz, corundum, hematite |
| very_high | > 1.2 | -2 | diamond (if added), spinel, periclase |

### Rationale

- Opal's very_low γ explains why it precipitates before quartz in low-T fluids
- Gypsum's low γ explains why it precipitates before anhydrite
- Quartz's high γ explains why it needs high σ (and thus high T) to nucleate
- The modifier is small (+2 to -2) because surface energy is one of many factors

---

## Combined Modifier Example

### Scenario: supergene_oxidation at step 50

**Fluid:** T=30°C, pH=6.5, Zn=80, Cu=40, Pb=30, As=25, Fe=60, Mn=10, SiO2=200

| Mineral | Base σ | σ/σ_crit | Base Initiative | Temp Mod | Edge Mod | Surface Mod | Comp Mod | Final Initiative |
|---------|--------|----------|----------------|----------|----------|-------------|----------|------------------|
| smithsonite | 2.1 | 1.4 | 12 | -1 (cold) | -1 | 0 | -2 (Zn, CO3) | **8** |
| hemimorphite | 1.8 | 1.2 | 10 | -1 (cold) | -1 | 0 | -2 (Zn, SiO2) | **6** |
| goethite | 2.5 | 1.3 | 13 | -1 (cold) | -1 | -1 | -2 (Fe) | **8** |
| pyrolusite | 0.9 | 0.9 | 4 | -1 (cold) | -2 | 0 | -2 (Mn) | **-1** |
| opal | 1.5 | 1.9 | 9 | +1 (sweet) | 0 | +2 | 0 | **12** |
| barite | 1.2 | 1.2 | 8 | -1 (cold) | -1 | 0 | 0 | **6** |

**Sorted order:** opal (12) → goethite (8) = smithsonite (8) → hemimorphite (6) → barite (6) → pyrolusite (-1, skips)

**Result:** Opal nucleates first (low T sweet-spot + very low surface energy). Pyrolusite skips (edge-of-gate + Mn exhaustion). Goethite and smithsonite tie; tiebreaker could be base σ or random.

---

## Bottom Line

These are **starting points**, not final values. The builder should:
1. Implement with these defaults
2. Run seed-42 baselines
3. Adjust modifiers until drift is acceptable
4. Document each adjustment in version history

The goal is not perfect thermodynamic accuracy. It's **predictable, legible competition** that makes the cascade problem solvable.

— 🪨✍️
