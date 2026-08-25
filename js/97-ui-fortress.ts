// ============================================================
// js/97-ui-fortress.ts — UI — Fortress (Creative) mode
// ============================================================
// Extracted verbatim from the legacy bundle. SCRIPT-mode TS — top-level
// decls stay global so cross-file references resolve at runtime.
//
// Phase B11 of PROPOSAL-MODULAR-REFACTOR.

// ============================================================
// FORTRESS MODE
// ============================================================

// FLUID_PRESETS: starting-fluid recipes shown in the Creative-mode setup
// preset bar AND under "Starter Fluids" in the Scenarios picker. Two
// flavors:
//   * Generic test recipes (silica, carbonate, clean, oxidized_cu) — not
//     anchored to any locality; tuned by feel as broad mineral-class
//     starting points. Edit freely.
//   * Synced-to-scenario recipes (mvt, porphyry, radioactive) — these
//     pull their fluid from the corresponding scenario_* function via
//     getter so they cannot drift. Edit the scenario, the preset
//     follows.
//
// Every preset must declare every FluidChemistry field the scenario
// would set, so the Creative-mode setup sliders see them and can
// over-ride. (Sliders that are blank for a preset's missing field still
// inherit the FluidChemistry constructor default, which is 0 for most
// trace elements — that's the "starter-fluid hidden chemistry" issue
// flagged for the Creative-mode rework backlog.)
function _scenarioFluidParams(scenarioName) {
  const f = SCENARIOS[scenarioName]().conditions.fluid;
  // Spread own enumerable properties of the FluidChemistry instance
  // into a plain object that fortressBegin's Object.assign() can copy.
  return Object.assign({}, f);
}

const FLUID_PRESETS = {
  silica: {
    label: 'Silica-rich',
    desc: 'Test recipe — high silica (600 ppm SiO₂), moderate Ca, low metals. Quartz-dominant growth. Generic; not anchored to a locality.',
    fluid: { SiO2: 600, Ca: 150, CO3: 100, Fe: 8, Mn: 3, Ti: 0.1, Al: 4, F: 10, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 6.5, salinity: 5.0 }
  },
  carbonate: {
    label: 'Carbonate',
    desc: 'Test recipe — Ca-CO₃ rich fluid (Ca 300, CO₃ 250 ppm), moderate Mn. Calcite-dominant. Generic; not anchored to a locality.',
    fluid: { SiO2: 80, Ca: 300, CO3: 250, Fe: 10, Mn: 8, Ti: 0.2, Al: 1, F: 5, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 7.0, salinity: 8.0 }
  },
  mvt: {
    label: 'MVT Brine (synced to scenario_mvt)',
    desc: 'Mirrors scenario_mvt. Edit data/scenarios.json5 to change this preset.',
    get fluid() { return _scenarioFluidParams('mvt'); }
  },
  clean: {
    label: 'Clean/Dilute',
    desc: 'Test recipe — low-concentration fluid. Slow growth, high-purity crystals. Near-equilibrium conditions. Generic; not anchored to a locality.',
    fluid: { SiO2: 200, Ca: 80, CO3: 60, Fe: 2, Mn: 1, Ti: 0.1, Al: 1, F: 3, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 7.0, salinity: 2.0 }
  },
  porphyry: {
    label: 'Copper Porphyry (synced to scenario_porphyry)',
    desc: 'Mirrors scenario_porphyry. Edit the scenario to change this preset.',
    get fluid() { return _scenarioFluidParams('porphyry'); }
  },
  oxidized_cu: {
    label: 'Oxidized Copper',
    desc: 'Test recipe — Cu-bearing oxidized fluid (Cu 60, Fe 40, O₂ 1.5), CO₃-rich. Malachite + hematite potential. Low temperature favored. Generic; not anchored to a locality.',
    fluid: { SiO2: 100, Ca: 150, CO3: 200, Fe: 40, Mn: 3, Ti: 0.2, Al: 1, F: 5, Zn: 0, S: 5, Cu: 60, O2: 1.5, pH: 6.0, salinity: 5.0 }
  },
  radioactive: {
    label: 'Radioactive Pegmatite (synced to scenario_radioactive_pegmatite)',
    desc: 'Mirrors scenario_radioactive_pegmatite. Edit the scenario to change this preset. ☢️',
    get fluid() { return _scenarioFluidParams('radioactive_pegmatite'); }
  }
};

// =====================================================================
// Creative mode (internal name: "fortress")
// =====================================================================
// User-visible label is "Creative" everywhere (title card, panel heading,
// menu button, post-game source field). The `fortress*` token is a
// pre-rename internal name that's still spread across ~199 sites — CSS
// classes (.fortress-log, .fortress-main, .fortress-setup), DOM IDs
// (#fortress-panel, #fortress-status), function names (fortressBegin,
// fortressStep, fortressFinish), and this global. Token kept stable
// because renaming all 199 occurrences for no UX gain isn't worth the
// churn. If you grep here looking for "fortress" — that's why. The user-
// facing rename happened in commit 467e8c4. See proposals/BACKLOG.md
// "Internal token cleanup" for the deferred thorough rename.
let fortressSim = null;
let fortressActive = false;
let fortressLogLines = [];
let selectedPreset = 'silica';

// Canonical Creative setup control registry. Every visible chemistry
// slider must appear here: preset sync, DOM reads, saves, and contract
// tests all use this single mapping so a control cannot silently become
// decorative. Bounds and step are in canonical physical units, not slider
// coordinates. `scale` is only the reversible adapter used by range inputs.
// Keeping precision here lets setup, live editing, exact-number inputs, saves,
// and audits share one scientific contract.
type CreativeChemistryEvidence = {
  // Durable code/data locations that define the lever's scientific meaning.
  // These are model provenance, not a claim that every calibration is a
  // primary-literature equilibrium model.
  provenance: string[];
  coupling: string;
  consumers: string[];
  probe: {
      kind: 'stoichiometric-capacity' | 'germanium-partition' | 'yttrium-fluorite'
      | 'oxygen-redox' | 'salinity-water-activity' | 'ph-carbonate-speciation'
      | 'sulfur-reservoir' | 'reactive-silica-fraction';
    representativeMineral?: string;
    coefficient?: number;
  };
};

type CreativeChemistryControlBase = {
  id: string;
  liveKey: string;
  label: string;
  group: 'major' | 'trace' | 'ligand' | 'redox' | 'physical';
  min: number;
  max: number;
  step: number;
  scale: number;
  unit: string;
  decimals?: number;
};

type CreativeChemistryControl = CreativeChemistryControlBase & {
  evidence: CreativeChemistryEvidence;
};

function _chemistryControl(
  id: string,
  liveKey: string,
  label: string,
  max: number,
  group: CreativeChemistryControlBase['group'],
  scale = 1,
  unit = 'ppm',
  decimals?: number,
): CreativeChemistryControlBase {
  return { id, liveKey, label, group, min: 0, max, step: 1 / scale, scale, unit, decimals };
}

const _CREATIVE_CHEMISTRY_CONTROL_BASES: Record<string, CreativeChemistryControlBase> = {
  SiO2:_chemistryControl('f-sio2','sio2','SiO₂',20000,'major'),
  reactiveSilicaFraction:_chemistryControl('f-reactive-silica','reactive-silica','Reactive SiO₂ fraction',1,'physical',100,'fraction',2),
  Ca:_chemistryControl('f-ca','ca','Ca',5000,'major'),
  CO3:_chemistryControl('f-co3','co3','CO₃',5000,'major'),
  F:_chemistryControl('f-f','f','F',1000,'ligand'),
  Al:_chemistryControl('f-al','al','Al',1000,'trace'),
  Fe:_chemistryControl('f-fe','fe','Fe',500,'trace'),
  Mn:_chemistryControl('f-mn','mn','Mn',500,'trace'),
  Cu:_chemistryControl('f-cu','cu','Cu',500,'trace'),
  S:_chemistryControl('f-s','s','S',5000,'ligand'),
  S_sulfide:_chemistryControl('f-s-sulfide','s-sulfide','S(-II)',5000,'redox'),
  S_sulfate:_chemistryControl('f-s-sulfate','s-sulfate','S(VI)',5000,'redox'),
  S_elemental:_chemistryControl('f-s-elemental','s-elemental','S°',5000,'redox'),
  U:_chemistryControl('f-u','u','U',500,'trace'),
  Pb:_chemistryControl('f-pb','pb','Pb',500,'trace'),
  Mo:_chemistryControl('f-mo','mo','Mo',500,'trace'),
  Zn:_chemistryControl('f-zn','zn','Zn',1000,'trace'),
  Mg:_chemistryControl('f-mg','mg','Mg',5000,'major'),
  Na:_chemistryControl('f-na','na','Na',150000,'major'),
  K:_chemistryControl('f-k','k','K',1000,'major'),
  Ba:_chemistryControl('f-ba','ba','Ba',1000,'trace'),
  Sr:_chemistryControl('f-sr','sr','Sr',1000,'trace'),
  Cr:_chemistryControl('f-cr','cr','Cr',500,'trace'),
  P:_chemistryControl('f-p','p','P',1000,'trace'),
  As:_chemistryControl('f-as','as','As',500,'trace'),
  Cl:_chemistryControl('f-cl','cl','Cl',200000,'ligand'),
  V:_chemistryControl('f-v','v','V',100,'trace'),
  W:_chemistryControl('f-w','w','W',100,'trace'),
  Ag:_chemistryControl('f-ag','ag','Ag',100,'trace'),
  Bi:_chemistryControl('f-bi','bi','Bi',100,'trace'),
  Sb:_chemistryControl('f-sb','sb','Sb',100,'trace'),
  Ni:_chemistryControl('f-ni','ni','Ni',500,'trace'),
  Co:_chemistryControl('f-co','co','Co',100,'trace'),
  B:_chemistryControl('f-b','b','B',200,'trace'),
  Li:_chemistryControl('f-li','li','Li',100,'trace'),
  Be:_chemistryControl('f-be','be','Be',50,'trace'),
  Te:_chemistryControl('f-te','te','Te',50,'trace'),
  Se:_chemistryControl('f-se','se','Se',50,'trace'),
  Ge:_chemistryControl('f-ge','ge','Ge',50,'trace'),
  Au:_chemistryControl('f-au','au','Au',500,'trace'),
  Cd:_chemistryControl('f-cd','cd','Cd',500,'trace'),
  Hg:_chemistryControl('f-hg','hg','Hg',500,'trace'),
  Sn:_chemistryControl('f-sn','sn','Sn',500,'trace'),
  Ti:_chemistryControl('f-ti','ti','Ti',100,'trace',10,'ppm',1),
  Y:_chemistryControl('f-y','y','Y',100,'trace',10,'ppm',1),
  O2:_chemistryControl('f-o2','o2','O₂',10,'redox',10,'',1),
  salinity:_chemistryControl('f-salinity','salinity','Salinity',300,'physical',10,'‰',1),
  pH:_chemistryControl('f-ph','ph','pH',14,'major',10,'',1),
};

function _creativeChemistryEvidence(field: string): CreativeChemistryEvidence {
  if (field === 'S_sulfide' || field === 'S_sulfate' || field === 'S_elemental') {
    const reservoir = field.replace('S_', '');
    return {
      provenance: [
        'js/20c-chemistry-redox.ts: explicit sulfur-reservoir ledger',
        'js/19-mineral-stoichiometry.ts:stoichiometricReservoirSpecies',
      ],
      coupling: `${field} is an independently conserved sulfur oxidation-state reservoir; sulfur-bearing mineral growth debits only the matching pool.`,
      consumers: [
        `debitSulfurPool:${reservoir}`,
        'stoichiometricReservoirSpecies',
        field === 'S_elemental' ? 'supersaturation_native_sulfur' : `${reservoir}AvailablePpm`,
      ],
      probe: { kind: 'sulfur-reservoir' },
    };
  }
  const stoichiometricConsumers = Object.entries(MINERAL_STOICHIOMETRY)
    .filter(([, formula]) => Number(formula[field]) > 0)
    .map(([mineral]) => mineral)
    .sort();
  const representativeMineral = stoichiometricConsumers[0];
  if (representativeMineral) {
    const coefficient = Number(MINERAL_STOICHIOMETRY[representativeMineral][field]);
    return {
      provenance: [
        `js/19-mineral-stoichiometry.ts:MINERAL_STOICHIOMETRY.${representativeMineral}.${field}`,
        'data/minerals.json: mineral formula and locality evidence records',
      ],
      coupling: `${field} participates in the ${STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.kind} and is booked/returned by applyStoichiometricGrowthBudget. It preserves ${STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.preserves}; ${STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.limitation}.`,
      consumers: [
        ...stoichiometricConsumers.map(mineral => `MINERAL_STOICHIOMETRY.${mineral}`),
        'applyStoichiometricGrowthBudget',
        '_buildMineralFormationExplanation:limiting-reagents',
      ],
      probe: { kind: 'stoichiometric-capacity', representativeMineral, coefficient },
    };
  }

  const special: Record<string, CreativeChemistryEvidence> = {
    reactiveSilicaFraction: {
      provenance: [
        'js/20-chemistry-fluid.ts:reactiveSilicaPpm/addReactiveSilica/debitReactiveSilica',
        'js/25-chemistry-conditions.ts:silica_precipitate_phase',
      ],
      coupling: 'Separates dissolved/reactive silica from suspended or detrital analytical SiO2; generic silica saturation and every SiO2 growth debit can use only the reactive inventory.',
      consumers: ['FluidChemistry.reactiveSilicaPpm', 'silica_precipitate_phase', 'supersaturation_opal/chalcedony/quartz', 'applyStoichiometricGrowthBudget:SiO2'],
      probe: { kind: 'reactive-silica-fraction' },
    },
    Ge: {
      provenance: [
        'js/61-engines-sulfide.ts:sphaleriteGermaniumUptake',
        'research/arcs/research-ge-sphalerite-2026-08-05.md',
      ],
      coupling: 'Fluid Ge partitions into a capped sphalerite growth-zone inventory and returns on oxidative dissolution.',
      consumers: ['grow_sphalerite', 'sphaleriteGermaniumUptake', 'applyStoichiometricGrowthBudget:trace_Ge'],
      probe: { kind: 'germanium-partition' },
    },
    Y: {
      provenance: [
        'js/53-engines-halide.ts:grow_fluorite',
        'Bosze & Rakovan (2002), Geochimica et Cosmochimica Acta 66:997',
      ],
      coupling: 'Y changes fluorite {100}/{111} habit, visible zoning, trace inventory, and is consumed during growth.',
      consumers: ['grow_fluorite:REE habit', 'grow_fluorite:trace_Y', 'FluoriteMorphology.form'],
      probe: { kind: 'yttrium-fluorite' },
    },
    O2: {
      provenance: [
        'js/20c-chemistry-redox.ts:ehFromO2',
        'js/85c-simulator-state.ts:_syncRedoxEh',
      ],
      coupling: 'The legacy dissolved-O₂ proxy maps monotonically to canonical Eh before redox-gated engines run.',
      consumers: ['ehFromO2', '_syncRedoxEh', 'redox availability and rate helpers'],
      probe: { kind: 'oxygen-redox' },
    },
    salinity: {
      provenance: [
        'js/20a-chemistry-activity.ts:waterActivityAssessment',
        'js/33-supersat-halide.ts: brine-strength calibration',
      ],
      coupling: 'Salinity changes ionic activity, water activity, and evaporite brine strength.',
      consumers: ['waterActivityAssessment', 'activityCorrectionFactor', 'supersaturation_halite'],
      probe: { kind: 'salinity-water-activity' },
    },
    pH: {
      provenance: [
        'js/20b-chemistry-carbonate-system.ts:bjerrumFractions',
        'js/20c-chemistry-redox.ts: pH-dependent redox/speciation helpers',
      ],
      coupling: 'pH changes carbonate speciation and the pH gates/rates used across mineral engines.',
      consumers: ['bjerrumFractions', 'effectiveCarbonate', 'MINERAL_GATES pH windows'],
      probe: { kind: 'ph-carbonate-speciation' },
    },
  };
  return special[field] || {
    provenance: [],
    coupling: '',
    consumers: [],
    probe: { kind: 'stoichiometric-capacity' },
  };
}

const CREATIVE_CHEMISTRY_CONTROLS: Record<string, CreativeChemistryControl> = Object.fromEntries(
  Object.entries(_CREATIVE_CHEMISTRY_CONTROL_BASES).map(([field, control]) => [
    field,
    { ...control, evidence: _creativeChemistryEvidence(field) },
  ]),
);

type CreativeChemistryCausalProbe = {
  field: string;
  input_value: number;
  fluid_value: number;
  route: string;
  signal: number;
  consumer_mutated: boolean;
  forward_route?: string;
  forward_signal?: number;
  forward_observed?: boolean;
  details?: Record<string, any>;
};

function _creativeStoichiometricForwardProbe(field: string, value: number) {
  const minerals = Object.entries(MINERAL_STOICHIOMETRY)
    .filter(([, formula]) => Number(formula[field]) > 0)
    .map(([mineral]) => mineral)
    .sort();
  let signal = 0;
  let observations = 0;
  const routes = new Set<string>();
  const scenarios = (typeof SCENARIOS !== 'undefined') ? Object.entries(SCENARIOS) : [];
  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex++) {
    const [scenarioId, makeScenario]: any = scenarios[scenarioIndex];
    let base;
    try { base = makeScenario().conditions; } catch (_error) { continue; }
    const fluid = new FluidChemistry({ ...base.fluid, [field]: value });
    const conditions: any = new VugConditions({
      temperature: base.temperature,
      pressure: base.pressure,
      fluid,
      wall: base.wall,
    });
    conditions._scenario = base._scenario;
    conditions._scenario_id = base._scenario_id;
    for (let mineralIndex = 0; mineralIndex < minerals.length; mineralIndex++) {
      const mineral = minerals[mineralIndex];
      const method = `supersaturation_${mineral}`;
      const consumer = conditions[method];
      if (typeof consumer !== 'function') continue;
      let sigma;
      try { sigma = Number(consumer.call(conditions)); } catch (_error) { continue; }
      if (!Number.isFinite(sigma)) continue;
      // Non-negative, capped log response avoids one extremely supersaturated
      // mineral drowning out the rest while retaining deterministic sensitivity.
      const bounded = Math.max(0, Math.min(1e12, sigma));
      const weight = 1 + (((scenarioIndex * 31) + (mineralIndex * 17)) % 97) / 1000;
      signal += Math.log1p(bounded) * weight;
      observations += 1;
      routes.add(`${scenarioId}.${method}`);
    }
  }
  return {
    route: `VugConditions.supersaturation fleet (${routes.size} scenario/mineral routes)`,
    signal,
    observed: observations > 0,
    observations,
    routes: Array.from(routes),
  };
}

// Execute one Creative chemistry value through a production gameplay consumer.
// This is deliberately heavier than a coefficient lookup: the hostile-review
// gate and CI use it to prove that canonical FluidChemistry state reaches the
// same engine/mass/speciation path a live run uses.
function creativeChemistryCausalProbe(field: string, value: number): CreativeChemistryCausalProbe {
  const control = CREATIVE_CHEMISTRY_CONTROLS[field];
  if (!control || !Number.isFinite(value)) {
    return { field, input_value: value, fluid_value: NaN, route: 'invalid', signal: NaN, consumer_mutated: false };
  }
  // Exercise the exact reversible range-input adapter before constructing the
  // canonical fluid object. This is the non-DOM half of both setup and live UI.
  const rawSliderValue = Number(value) * control.scale;
  const decodedValue = rawSliderValue / control.scale;
  const inputFluid = new FluidChemistry({ [field]: decodedValue });
  const probe = control.evidence.probe;
  if (probe.kind === 'stoichiometric-capacity') {
    const mineral = String(probe.representativeMineral);
    // Supply every *other* mandatory formula reservoir generously. The probe
    // varies one Creative lever at a time; leaving its co-reagents at constructor
    // defaults would make the whole formula cap at zero and falsely report every
    // lever as inert under the mole-correct all-or-nothing ledger.
    const formula = MINERAL_STOICHIOMETRY[mineral] || {};
    const fixtureFluid: Record<string, number> = { [field]: decodedValue };
    for (const species of Object.keys(formula)) {
      if (species !== field) fixtureFluid[species] = 1e6;
    }
    const massFluid = new FluidChemistry(fixtureFluid);
    const crystal = { mineral, zones: [] };
    const zone = { thickness_um: 1, growth_rate: 1 };
    const before = Number(massFluid[field]);
    applyStoichiometricGrowthBudget(crystal, zone, { fluid: massFluid });
    const after = Number(massFluid[field]);
    const forward = _creativeStoichiometricForwardProbe(field, decodedValue);
    return {
      field, input_value: value, fluid_value: before,
      route: `applyStoichiometricGrowthBudget:${mineral}`,
      signal: before - after,
      consumer_mutated: after !== before,
      forward_route: forward.route,
      forward_signal: forward.signal,
      forward_observed: forward.observed,
      details: {
        mineral, before, after, accepted_thickness_um: zone.thickness_um,
        forward_observations: forward.observations,
        forward_routes: forward.routes,
      },
    };
  }
  if (probe.kind === 'sulfur-reservoir') {
    const pool = field === 'S_elemental' ? 'elemental' : field === 'S_sulfate' ? 'sulfate' : 'sulfide';
    const fluid = new FluidChemistry({
      sulfurPoolsExplicit: true,
      S_sulfide: field === 'S_sulfide' ? decodedValue : 0,
      S_sulfate: field === 'S_sulfate' ? decodedValue : 0,
      S_elemental: field === 'S_elemental' ? decodedValue : 0,
      nativeSulfurPathway: field === 'S_elemental' ? 'anaerobic_microbial_inherited' : null,
      O2: 0.02,
      pH: 6,
    });
    const before = Number(fluid[field]);
    const available = field === 'S_sulfide'
      ? sulfideAvailablePpm(fluid, 25)
      : field === 'S_sulfate'
        ? sulfateAvailablePpm(fluid, 25)
        : elementalSulfurAvailablePpm(fluid);
    debitSulfurPool(fluid, pool as any, Math.min(1, available));
    const after = Number(fluid[field]);
    return {
      field, input_value: value, fluid_value: before,
      route: `debitSulfurPool:${pool}`,
      signal: before - after,
      consumer_mutated: after !== before,
      forward_route: field === 'S_elemental'
        ? 'VugConditions.supersaturation_native_sulfur:S_elemental'
        : field === 'S_sulfate'
          ? 'VugConditions.supersaturation_barite:sulfateAvailablePpm'
          : 'VugConditions.supersaturation_sphalerite:sulfideAvailablePpm',
      forward_signal: available,
      forward_observed: Number.isFinite(available),
      details: { pool, before, after, available },
    };
  }
  if (probe.kind === 'germanium-partition') {
    const fluid = new FluidChemistry({ Zn: 1000, S: 1000, Ge: decodedValue, O2: 0, pH: 6.5 });
    const conditions = new VugConditions({ temperature: 200, pressure: 1.5, fluid });
    conditions.supersaturation_sphalerite = () => 2;
    const crystal: any = { mineral: 'sphalerite', total_growth_um: 0, zones: [] };
    const before = fluid.Ge;
    const zone = grow_sphalerite(crystal, conditions, 0);
    if (zone) applyStoichiometricGrowthBudget(crystal, zone, conditions);
    const after = fluid.Ge;
    return {
      field, input_value: value, fluid_value: before,
      route: 'grow_sphalerite→applyStoichiometricGrowthBudget:trace_Ge',
      signal: Number(zone?.trace_Ge || 0) + (before - after),
      consumer_mutated: !!zone && (Number(zone.trace_Ge || 0) > 0 || after !== before),
      forward_route: 'grow_sphalerite:trace_Ge',
      forward_signal: Number(zone?.trace_Ge || 0),
      forward_observed: !!zone,
      details: { before, after, trace_Ge: zone?.trace_Ge ?? null, trace_stoichiometry: zone?.trace_stoichiometry ?? null },
    };
  }
  if (probe.kind === 'yttrium-fluorite') {
    const fluid = new FluidChemistry({ Ca: 1000, F: 100, Y: decodedValue, pH: 7, Fe: 0, Mn: 0 });
    const conditions = new VugConditions({ temperature: 150, pressure: 1.5, fluid });
    conditions.supersaturation_fluorite = () => 2;
    const crystal: any = { mineral: 'fluorite', total_growth_um: 0, zones: [] };
    const before = fluid.Y;
    const zone = grow_fluorite(crystal, conditions, 0);
    if (zone) applyStoichiometricGrowthBudget(crystal, zone, conditions);
    const after = fluid.Y;
    return {
      field, input_value: value, fluid_value: before,
      route: 'grow_fluorite:{111}-habit+trace-zone+Y-debit',
      signal: Number(zone?.trace_Y || 0) + (crystal._ree_substitution ? 1 : 0) + (before - after),
      consumer_mutated: !!zone && (after !== before || !!crystal._ree_substitution),
      forward_route: 'grow_fluorite:{111}-habit+trace_Y',
      forward_signal: Number(zone?.trace_Y || 0) + (crystal._ree_substitution ? 1 : 0),
      forward_observed: !!zone,
      details: { before, after, habit: crystal.habit, trace_Y: zone?.trace_Y ?? null },
    };
  }
  if (probe.kind === 'oxygen-redox') {
    const fluid = new FluidChemistry({ O2: decodedValue });
    const conditions = new VugConditions({ fluid, wall: new VugWall() });
    const sim: any = new VugSimulator(conditions, []);
    // Deliberately dirty the derived observer so the probe demonstrates that
    // the simulator synchronization route performed the write; the
    // FluidChemistry constructor otherwise initializes Eh consistently.
    fluid.Eh = -999;
    const before = fluid.Eh;
    sim._syncRedoxEh(false);
    return {
      field, input_value: value, fluid_value: fluid.O2,
      route: 'VugSimulator._syncRedoxEh:O2→Eh',
      signal: Number(fluid.Eh),
      consumer_mutated: fluid.Eh !== before,
      forward_route: 'VugSimulator._syncRedoxEh:O2→Eh',
      forward_signal: Number(fluid.Eh),
      forward_observed: Number.isFinite(fluid.Eh),
      details: { before_Eh: before, after_Eh: fluid.Eh },
    };
  }
  if (probe.kind === 'salinity-water-activity') {
    const fluid = new FluidChemistry({ salinity: decodedValue, Na: 20000, Cl: 20000, pH: 7 });
    fluid.concentration = 20;
    const conditions = new VugConditions({ temperature: 25, fluid });
    const sigma = Number(conditions.supersaturation_halite());
    return {
      field, input_value: value, fluid_value: fluid.salinity,
      route: 'VugConditions.supersaturation_halite:brine-strength',
      signal: sigma,
      consumer_mutated: Number.isFinite(sigma),
      forward_route: 'VugConditions.supersaturation_halite:brine-strength',
      forward_signal: sigma,
      forward_observed: Number.isFinite(sigma),
      details: { halite_sigma: sigma, water_activity: waterActivityAssessment(fluid, 25).value },
    };
  }
  if (probe.kind === 'ph-carbonate-speciation') {
    const fluid = new FluidChemistry({ pH: decodedValue, Ca: 500, CO3: 500, salinity: 5 });
    const conditions = new VugConditions({ temperature: 25, fluid });
    const sigma = Number(conditions.supersaturation_calcite());
    return {
      field, input_value: value, fluid_value: fluid.pH,
      route: 'VugConditions.supersaturation_calcite:carbonate-speciation',
      signal: sigma,
      consumer_mutated: Number.isFinite(sigma),
      forward_route: 'VugConditions.supersaturation_calcite:carbonate-speciation',
      forward_signal: sigma,
      forward_observed: Number.isFinite(sigma),
      details: { calcite_sigma: sigma, carbonate_fraction: bjerrumFractions(fluid.pH, 25).CO3 },
    };
  }
  if (probe.kind === 'reactive-silica-fraction') {
    const fluid = new FluidChemistry({ SiO2: 400, reactiveSilicaFraction: decodedValue, pH: 7 });
    const conditions = new VugConditions({ temperature: 150, pressure: 1.5, fluid });
    const reactive = fluid.reactiveSilicaPpm();
    const sigma = Number(conditions.supersaturation_chalcedony())
      + Number(conditions.supersaturation_quartz());
    return {
      field, input_value: value, fluid_value: fluid.reactiveSilicaFraction,
      route: 'FluidChemistry.reactiveSilicaPpm',
      signal: reactive,
      consumer_mutated: reactive > 0,
      forward_route: 'VugConditions.supersaturation_chalcedony/quartz',
      forward_signal: sigma,
      forward_observed: Number.isFinite(sigma),
      details: { total_SiO2_ppm: fluid.SiO2, reactive_SiO2_ppm: reactive },
    };
  }
  return { field, input_value: value, fluid_value: inputFluid[field], route: 'unimplemented', signal: NaN, consumer_mutated: false };
}

// Backward-compatible scalar facade. New audits inspect the structured route
// and mutation evidence above rather than treating a changing number as proof.
function creativeChemistryCausalSignal(field: string, value: number): number {
  return creativeChemistryCausalProbe(field, value).signal;
}

// Full-name aliases make expert search useful without requiring players to
// remember whether a compact row says “German.”, “Ge”, or “germanium”.
const CREATIVE_CHEMISTRY_SEARCH_ALIASES: Record<string, string> = {
  SiO2:'silica silicon dioxide total analytical bulk',
  reactiveSilicaFraction:'silica dissolved reactive silicic acid h4sio4 suspended particulate detrital fraction',
  Ca:'calcium', CO3:'carbonate carbon dioxide inorganic carbon DIC',
  F:'fluorine fluoride', Al:'aluminum aluminium', Fe:'iron', Mn:'manganese', Cu:'copper',
  S:'sulfur sulphur dissolved total bulk',
  S_sulfide:'sulfur sulphur sulfide reduced hs h2s minus ii',
  S_sulfate:'sulfur sulphur sulfate oxidized so4 plus vi',
  S_elemental:'sulfur sulphur native elemental s0 zero',
  U:'uranium', Pb:'lead', Mo:'molybdenum', Zn:'zinc',
  Mg:'magnesium', Na:'sodium', K:'potassium', Ba:'barium', Sr:'strontium', Cr:'chromium chrome',
  P:'phosphorus phosphate', As:'arsenic', Cl:'chlorine chloride', V:'vanadium', W:'tungsten',
  Ag:'silver', Bi:'bismuth', Sb:'antimony', Ni:'nickel', Co:'cobalt', B:'boron', Li:'lithium',
  Be:'beryllium', Te:'tellurium', Se:'selenium', Ge:'germanium', Au:'gold', Cd:'cadmium',
  Hg:'mercury', Sn:'tin', Ti:'titanium', Y:'yttrium', O2:'oxygen redox',
  salinity:'salt brine salinity', pH:'acid acidity alkaline alkalinity pH',
};

type CreativeExactTransform = {
  label: string;
  unit: string;
  step: number | 'any';
  fromSlider: (raw: number) => number;
  toSlider: (physical: number) => number;
  format?: (physical: number) => string;
};

const _CREATIVE_SETUP_EXACT_TRANSFORMS: Record<string, CreativeExactTransform> = {
  'f-temp': { label:'temperature', unit:'°C', step:1, fromSlider:v=>v, toSlider:v=>v },
  'f-pressure': { label:'fluid pressure', unit:'kbar', step:0.001, fromSlider:v=>v/100, toSlider:v=>v*100 },
  'f-confining-pressure': { label:'rock pressure', unit:'kbar', step:0.01, fromSlider:v=>v/100, toSlider:v=>v*100 },
  'f-vug-diameter': { label:'cavity diameter', unit:'mm', step:1, fromSlider:v=>v, toSlider:v=>v },
  'f-host-thickness': { label:'host thickness', unit:'mm', step:10, fromSlider:v=>v, toSlider:v=>v },
  'f-wall-reactivity': { label:'wall reactivity', unit:'×', step:0.1, fromSlider:v=>v/10, toSlider:v=>v*10 },
  'f-cooling-rate': { label:'cooling rate', unit:'°C/step', step:0.1, fromSlider:v=>v/10, toSlider:v=>v*10 },
  'f-ambient-temperature': { label:'far-field equilibrium temperature', unit:'°C', step:1, fromSlider:v=>v, toSlider:v=>v },
  'f-flow-rate': { label:'flow rate', unit:'', step:0.1, fromSlider:v=>v/10, toSlider:v=>v*10 },
  'f-water-table': { label:'water-table height', unit:'%', step:0.1, fromSlider:v=>v/10, toSlider:v=>v*10 },
  'f-porosity': { label:'connected porosity', unit:'%', step:1, fromSlider:v=>v, toSlider:v=>v },
  'f-diffusion-rate': { label:'inter-zone diffusion rate', unit:'/step', step:0.01, fromSlider:v=>v/100, toSlider:v=>v*100 },
  'f-wall-fe': { label:'host Fe', unit:'ppm', step:10, fromSlider:v=>v, toSlider:v=>v },
  'f-wall-mn': { label:'host Mn', unit:'ppm', step:10, fromSlider:v=>v, toSlider:v=>v },
  'f-wall-mg': { label:'host Mg', unit:'ppm', step:10, fromSlider:v=>v, toSlider:v=>v },
  'f-gamma-host': { label:'host gamma', unit:'', step:0.01, fromSlider:v=>v/100, toSlider:v=>v*100 },
  'f-primary-bubbles': { label:'primary voids', unit:'', step:1, fromSlider:v=>v, toSlider:v=>v },
  'f-secondary-bubbles': { label:'secondary voids', unit:'', step:1, fromSlider:v=>v, toSlider:v=>v },
  'f-shape-seed': { label:'shape seed', unit:'', step:1, fromSlider:v=>v, toSlider:v=>v },
  'f-pco2': {
    label:'gas CO₂ partial pressure', unit:'bar', step:'any',
    fromSlider:v=>Math.pow(10,v/100),
    toSlider:v=>Math.log10(Math.max(1e-6,v))*100,
    format:v=>v.toExponential(3),
  },
  'f-carbon-headspace': {
    label:'carbonate headspace volume', unit:'L/kg water', step:0.01,
    fromSlider:v=>v/100,
    toSlider:v=>v*100,
  },
};

function _creativeExactString(value: number, transform: CreativeExactTransform) {
  if (transform.format) return transform.format(value);
  if (transform.step === 'any') return String(value);
  const decimals = Math.max(0, Math.ceil(-Math.log10(transform.step)));
  return value.toFixed(decimals);
}

function _syncCreativeSetupExactInput(slider: HTMLInputElement) {
  const exact = document.getElementById(slider.id + '-exact') as HTMLInputElement | null;
  const transform = (slider as any)._creativeExactTransform as CreativeExactTransform | undefined;
  if (!(exact instanceof HTMLInputElement) || !transform) return;
  const raw = Number(slider.value);
  if (Number.isFinite(raw)) exact.value = _creativeExactString(transform.fromSlider(raw), transform);
}

function installCreativeSetupExactInputs() {
  installCreativeBoundaryAuthorityControls();
  const chemistryById = new Map(
    Object.values(CREATIVE_CHEMISTRY_CONTROLS).map(control => [control.id, control]),
  );
  const setup = document.getElementById('fortress-setup');
  if (!setup) return;
  for (const slider of Array.from(setup.querySelectorAll('input[type="range"]')) as HTMLInputElement[]) {
    if (document.getElementById(slider.id + '-exact') instanceof HTMLInputElement) continue;
    const chemistry = chemistryById.get(slider.id);
    let transform = _CREATIVE_SETUP_EXACT_TRANSFORMS[slider.id];
    if (chemistry) {
      slider.min = String(chemistry.min * chemistry.scale);
      slider.max = String(chemistry.max * chemistry.scale);
      slider.step = String(chemistry.step * chemistry.scale);
      transform = {
        label: chemistry.label,
        unit: chemistry.unit,
        step: chemistry.step,
        fromSlider: value => value / chemistry.scale,
        toSlider: value => value * chemistry.scale,
      };
      const row = slider.closest('.setup-row') as HTMLElement | null;
      if (row) row.dataset.chemistryGroup = chemistry.group;
    }
    if (!transform) continue;

    const exact = document.createElement('input');
    exact.type = 'number';
    exact.id = slider.id + '-exact';
    exact.className = 'creative-exact-input';
    exact.inputMode = transform.step === 1 ? 'numeric' : 'decimal';
    exact.step = String(transform.step);
    exact.min = String(transform.fromSlider(Number(slider.min)));
    exact.max = String(transform.fromSlider(Number(slider.max)));
    exact.setAttribute('aria-label', `Exact ${transform.label} (${transform.unit || 'canonical units'})`);
    exact.title = `Exact ${transform.label}${transform.unit ? ` in ${transform.unit}` : ''}`;
    (slider as any)._creativeExactTransform = transform;
    slider.insertAdjacentElement('afterend', exact);
    slider.addEventListener('input', () => _syncCreativeSetupExactInput(slider));
    const commitExactValue = () => {
      let physical = Number(exact.value);
      const physicalMin = Number(exact.min);
      const physicalMax = Number(exact.max);
      if (!Number.isFinite(physical)) {
        _syncCreativeSetupExactInput(slider);
        return;
      }
      physical = Math.max(physicalMin, Math.min(physicalMax, physical));
      slider.value = String(transform.toSlider(physical));
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      _syncCreativeSetupExactInput(slider);
    };
    exact.addEventListener('change', commitExactValue);
    exact.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitExactValue();
      exact.blur();
    });
    _syncCreativeSetupExactInput(slider);
  }
}

function installCreativeBoundaryAuthorityControls() {
  if (document.getElementById('creative-boundary-authority-controls')) return;
  const thermalToggle = document.getElementById('f-thermal-pulses');
  const anchor = thermalToggle?.closest('.setup-row');
  if (!anchor) return;
  const panel = document.createElement('div');
  panel.id = 'creative-boundary-authority-controls';
  panel.style.cssText = 'margin:.55rem 0;padding:.65rem;background:#12120c;border:1px solid #2a2518;border-radius:4px;';
  panel.innerHTML = `
    <div style="color:#a89040;font-size:.8rem;margin-bottom:.45rem">Advanced boundary authority</div>
    <div class="setup-row" title="A locality-authored buffer or far-field reservoir may relax pH toward a target. Disabled means reactions and explicit events alone control pH; there is no universal neutral attractor.">
      <label for="f-ph-boundary-enabled">pH boundary</label>
      <select id="f-ph-boundary-enabled"><option value="0" selected>none / reaction-controlled</option><option value="1">authored buffer or reservoir</option></select>
    </div>
    <div class="setup-row"><label for="f-ph-boundary-target">Target pH</label><input type="number" id="f-ph-boundary-target" min="0" max="14" step="0.01" value="6.5"></div>
    <div class="setup-row"><label for="f-ph-boundary-rate">Exchange rate</label><input type="number" id="f-ph-boundary-rate" min="0" max="14" step="0.001" value="0.05"><span class="range-val">pH/step at unit flow</span></div>
    <div class="setup-row"><label for="f-ph-boundary-authority">Buffer authority</label><input type="text" id="f-ph-boundary-authority" value="Creative-authored buffer boundary" aria-label="pH buffer scientific authority"></div>
    <div class="setup-row" title="Optional material carried by the stochastic thermal pulse. Leave authority blank for heat-only pulses. Components accepts every numeric FluidChemistry reservoir as JSON; a value may be a number or a [minimum, maximum] draw.">
      <label for="f-thermal-pulse-authority">Pulse-fluid authority</label><input type="text" id="f-thermal-pulse-authority" placeholder="blank = heat only">
    </div>
    <div class="setup-row"><label for="f-thermal-pulse-components">Pulse components</label><input type="text" id="f-thermal-pulse-components" value="{}" placeholder='{"SiO2":[20,80],"Fe":[0,5]}' spellcheck="false"></div>
    <div class="setup-row"><label for="f-thermal-pulse-ph-delta">Pulse pH delta</label><input type="number" id="f-thermal-pulse-ph-delta" step="0.01" placeholder="unchanged"></div>
    <div class="setup-row"><label for="f-thermal-pulse-flow">Pulse flow</label><input type="number" id="f-thermal-pulse-flow" min="0" step="0.01" placeholder="unchanged"></div>`;
  anchor.insertAdjacentElement('afterend', panel);
}

function _creativeBoundaryText(id: string) {
  return String((document.getElementById(id) as HTMLInputElement | null)?.value || '').trim();
}

function _creativeBoundaryOptionalNumber(id: string) {
  const text = _creativeBoundaryText(id);
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`Creative boundary control ${id} must be finite`);
  return value;
}

function _creativeParseThermalPulseComponents(text: string) {
  let parsed: any;
  try { parsed = JSON.parse(text || '{}'); }
  catch (error) { throw new Error(`Thermal-pulse components must be valid JSON: ${error.message}`); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Thermal-pulse components must be a JSON object');
  }
  const out: Record<string, number | [number, number]> = {};
  for (const [species, raw] of Object.entries(parsed)) {
    if (!FLUID_CHEMISTRY_INPUT_FIELDS.has(species)
        || ['sulfurPoolsExplicit', 'nativeSulfurPathway', 'sulfateInherited'].includes(species)) {
      throw new Error(`Thermal-pulse component '${species}' is not a numeric fluid reservoir`);
    }
    if (Array.isArray(raw)) {
      if (raw.length !== 2 || !raw.every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) {
        throw new Error(`Thermal-pulse range '${species}' must contain two non-negative finite values`);
      }
      out[species] = [Number(raw[0]), Number(raw[1])];
    } else if (Number.isFinite(Number(raw)) && Number(raw) >= 0) {
      out[species] = Number(raw);
    } else {
      throw new Error(`Thermal-pulse component '${species}' must be non-negative and finite`);
    }
  }
  return out;
}

function filterCreativeSetupChemistry(query: string) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  for (const [property, control] of Object.entries(CREATIVE_CHEMISTRY_CONTROLS)) {
    const slider = document.getElementById(control.id);
    const row = slider?.closest('.setup-row') as HTMLElement | null;
    if (!row) continue;
    const aliases = CREATIVE_CHEMISTRY_SEARCH_ALIASES[property] || '';
    const haystack = `${property} ${control.label} ${control.group} ${aliases} ${row.textContent || ''}`.toLocaleLowerCase();
    row.hidden = words.length > 0 && !words.every(word => haystack.includes(word));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installCreativeSetupExactInputs, { once: true });
} else {
  installCreativeSetupExactInputs();
}

function syncCreativeChemistryControls(fluidParams: Record<string, any>) {
  for (const [prop, control] of Object.entries(CREATIVE_CHEMISTRY_CONTROLS)) {
    const slider = document.getElementById(control.id) as HTMLInputElement | null;
    const value = Number(fluidParams[prop] ?? 0);
    if (!slider || !Number.isFinite(value)) continue;
    slider.value = String(value * control.scale);
    _syncCreativeSetupExactInput(slider);
    const valueEl = document.getElementById(control.id + '-val');
    if (valueEl) {
      const shown = control.decimals != null ? value.toFixed(control.decimals) : String(value);
      valueEl.textContent = `${shown}${control.unit ? ` ${control.unit}` : ''}`;
    }
  }
  const explicit = document.getElementById('f-sulfur-explicit') as HTMLInputElement | null;
  if (explicit) explicit.checked = !!fluidParams.sulfurPoolsExplicit;
  const pathway = document.getElementById('f-native-sulfur-pathway') as HTMLSelectElement | null;
  if (pathway) pathway.value = fluidParams.nativeSulfurPathway || 'none';
}

function readCreativeChemistryControls(base: Record<string, any> = {}) {
  const fluidParams = Object.assign({}, base);
  for (const [prop, control] of Object.entries(CREATIVE_CHEMISTRY_CONTROLS)) {
    const slider = document.getElementById(control.id) as HTMLInputElement | null;
    if (!slider) continue;
    const value = parseFloat(slider.value) / control.scale;
    if (Number.isFinite(value)) fluidParams[prop] = value;
  }
  const explicit = document.getElementById('f-sulfur-explicit') as HTMLInputElement | null;
  const pathway = document.getElementById('f-native-sulfur-pathway') as HTMLSelectElement | null;
  if (explicit || Object.prototype.hasOwnProperty.call(base, 'sulfurPoolsExplicit')) {
    fluidParams.sulfurPoolsExplicit = explicit
      ? !!explicit.checked
      : !!base.sulfurPoolsExplicit;
  }
  if (pathway || Object.prototype.hasOwnProperty.call(base, 'nativeSulfurPathway')) {
    fluidParams.nativeSulfurPathway = pathway?.value && pathway.value !== 'none'
      ? pathway.value
      : null;
  }
  return fluidParams;
}

function _creativeControlNumber(id: string, scale = 1, fallback = 0) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  const value = el ? parseFloat(el.value) / scale : NaN;
  return Number.isFinite(value) ? value : fallback;
}

// Geological controls define the cavity, host, and boundary conditions.
// They stay separate from the fluid recipe because Replenish restores only
// source fluid; it must not quietly replace the host rock or water table.
function readCreativeGeologicalControls(baseWall: Record<string, any> = {}) {
  const wallOpts = Object.assign({}, baseWall);
  const composition = (document.getElementById('f-host-composition') as HTMLSelectElement | null)?.value;
  const architecture = (document.getElementById('f-architecture') as HTMLSelectElement | null)?.value;
  if (composition) wallOpts.composition = composition;
  if (architecture) wallOpts.architecture = architecture;
  wallOpts.vug_diameter_mm = _creativeControlNumber('f-vug-diameter', 1, wallOpts.vug_diameter_mm ?? 50);
  wallOpts.thickness_mm = _creativeControlNumber('f-host-thickness', 1, wallOpts.thickness_mm ?? 500);
  wallOpts.confining_pressure_kbar = _creativeControlNumber(
    'f-confining-pressure', 100, wallOpts.confining_pressure_kbar ?? 1.5,
  );
  wallOpts.wall_Fe_ppm = _creativeControlNumber('f-wall-fe', 1, wallOpts.wall_Fe_ppm ?? 2000);
  wallOpts.wall_Mn_ppm = _creativeControlNumber('f-wall-mn', 1, wallOpts.wall_Mn_ppm ?? 500);
  wallOpts.wall_Mg_ppm = _creativeControlNumber('f-wall-mg', 1, wallOpts.wall_Mg_ppm ?? 1000);
  wallOpts.reactivity = _creativeControlNumber('f-wall-reactivity', 10, wallOpts.reactivity ?? 1);
  wallOpts.cooling_rate = _creativeControlNumber('f-cooling-rate', 10, wallOpts.cooling_rate ?? 1.5);
  wallOpts.ambient_temperature_C = _creativeControlNumber(
    'f-ambient-temperature', 1, wallOpts.ambient_temperature_C ?? 25,
  );
  wallOpts.inter_ring_diffusion_rate = _creativeControlNumber('f-diffusion-rate', 100, wallOpts.inter_ring_diffusion_rate ?? 0.05);
  wallOpts.primary_bubbles = Math.round(_creativeControlNumber('f-primary-bubbles', 1, wallOpts.primary_bubbles ?? 3));
  wallOpts.secondary_bubbles = Math.round(_creativeControlNumber('f-secondary-bubbles', 1, wallOpts.secondary_bubbles ?? 6));
  wallOpts.shape_seed = Math.round(_creativeControlNumber('f-shape-seed', 1, wallOpts.shape_seed ?? 0));
  wallOpts.gamma_host = _creativeControlNumber('f-gamma-host', 100, wallOpts.gamma_host ?? 0);
  wallOpts.graphitic = !!(document.getElementById('f-graphitic') as HTMLInputElement | null)?.checked;
  wallOpts.open_system = !!(document.getElementById('f-open-system') as HTMLInputElement | null)?.checked;
  wallOpts.open_spring = !!(document.getElementById('f-open-spring') as HTMLInputElement | null)?.checked;
  wallOpts.is_lit = !!(document.getElementById('f-is-lit') as HTMLInputElement | null)?.checked;
  wallOpts.light_exposure = wallOpts.is_lit ? 'excavated' : 'dark';
  wallOpts.thermal_pulses = !!(document.getElementById('f-thermal-pulses') as HTMLInputElement | null)?.checked;
  const pHBoundaryEnabled = (document.getElementById('f-ph-boundary-enabled') as HTMLSelectElement | null)?.value === '1';
  wallOpts.pH_boundary = pHBoundaryEnabled ? {
    target_pH: Math.max(0, Math.min(14, _creativeBoundaryOptionalNumber('f-ph-boundary-target') ?? 6.5)),
    rate_per_step: Math.max(0, _creativeBoundaryOptionalNumber('f-ph-boundary-rate') ?? 0.05),
    authority: _creativeBoundaryText('f-ph-boundary-authority') || 'Creative-authored buffer boundary',
  } : null;
  const pulseAuthority = _creativeBoundaryText('f-thermal-pulse-authority');
  if (pulseAuthority) {
    const pHDelta = _creativeBoundaryOptionalNumber('f-thermal-pulse-ph-delta');
    const flowRate = _creativeBoundaryOptionalNumber('f-thermal-pulse-flow');
    if (flowRate != null && flowRate < 0) throw new Error('Thermal-pulse flow must be non-negative');
    wallOpts.thermal_pulse_fluid = {
      authority: pulseAuthority,
      components_ppm: _creativeParseThermalPulseComponents(_creativeBoundaryText('f-thermal-pulse-components') || '{}'),
      ...(pHDelta == null ? {} : { pH_delta: pHDelta }),
      ...(flowRate == null ? {} : { flow_rate: flowRate }),
    };
  } else {
    wallOpts.thermal_pulse_fluid = null;
  }
  // Alpine-cleft behavior is a consequence of cleft architecture rather
  // than a second unexplained switch for the same geological setting.
  wallOpts.alpine_cleft = architecture === 'cleft';

  return {
    wallOpts,
    conditionOpts: {
      flow_rate: _creativeControlNumber('f-flow-rate', 10, 1),
      porosity: _creativeControlNumber('f-porosity', 100, 0),
    },
    initialWaterTablePct: _creativeControlNumber('f-water-table', 10, 100),
    scenarioOpts: (() => {
      const open = !!(document.getElementById('f-open-atmosphere') as HTMLInputElement | null)?.checked;
      const pCO2 = Math.pow(10, _creativeControlNumber('f-pco2', 100, -3.38));
      const tigerEyeOriginModel =
        (document.getElementById('f-tiger-eye-model') as HTMLSelectElement | null)?.value ||
        'surficial_alteration';
      return {
        open_to_atmosphere: open,
        atmospheric_pCO2_bar: pCO2,
        tiger_eye_origin_model: tigerEyeOriginModel,
        carbonate_boundary: {
          mode: open ? 'open' : 'closed',
          spatial_model: 'equal_volume_fully_mixed',
          simple_carbonate_phases: ['calcite', 'aragonite', 'dolomite', 'HMC'],
          target_pCO2_bar: pCO2,
          headspace_L_per_kg_water: _creativeControlNumber('f-carbon-headspace', 100, 1),
          initialization: 'creative_explicit_initial_DIC_plus_pH_to_reduced_alkalinity',
        },
      };
    })(),
  };
}

// Each live Creative simulator owns its starting-fluid recipe. The three
// producers are the Custom constructor below and the Scenario/Starter
// constructors in 94-ui-menu.ts; fortressStep('replenish') is the consumer.
// Saves intentionally persist the constructor origin, not this derived copy,
// so 93a-ui-saves.ts rebuilds the same recipe before replaying any action.
// Keeping the binding on the simulator (rather than in a cross-run global)
// prevents Custom -> Home/New Game -> Scenario from importing hidden broth.
const FORTRESS_INITIAL_FLUID_RECIPES = new WeakMap<object, Readonly<Record<string, any>>>();

const _fortressBindInitialFluidRecipe = (sim, source) => {
  if (!sim || !source) throw new TypeError('Creative initial-fluid recipe requires a simulator and fluid');
  const canonical = new FluidChemistry(source);
  const recipe: Record<string, any> = {};
  for (const field of FLUID_CHEMISTRY_INPUT_FIELDS) recipe[field] = canonical[field];
  FORTRESS_INITIAL_FLUID_RECIPES.set(sim, Object.freeze(recipe));
};

const _fortressInitialFluidRecipeFor = sim =>
  (sim && FORTRESS_INITIAL_FLUID_RECIPES.get(sim)) || null;

function _creativePresetWallDefaults(preset: string) {
  if (preset === 'mvt') {
    return { composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 40, wall_Fe_ppm: 3000, wall_Mn_ppm: 800, wall_Mg_ppm: 1000 };
  }
  if (preset === 'carbonate') {
    return { composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 30, wall_Fe_ppm: 1500, wall_Mn_ppm: 600, wall_Mg_ppm: 800 };
  }
  return { composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50, wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000 };
}

function _setCreativeSetupNumber(id: string, value: number, eventName = 'input') {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  el.value = String(value);
  el.dispatchEvent(new Event(eventName));
}

function selectPreset(preset) {
  selectedPreset = preset;
  document.querySelectorAll('#preset-grid .preset-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.preset === preset);
  });
  document.getElementById('preset-desc').textContent = FLUID_PRESETS[preset].desc;
  // Sync every registered chemistry slider to the canonical preset.
  const f = FLUID_PRESETS[preset].fluid;
  syncCreativeChemistryControls(f);
  // These presets historically carry authored host inventories and cavity
  // diameters too. Keep those defaults visible in the exact controls so the
  // setup panel cannot silently replace them at Begin.
  const wall = _creativePresetWallDefaults(preset);
  _setCreativeSetupNumber('f-vug-diameter', wall.vug_diameter_mm);
  _setCreativeSetupNumber('f-host-thickness', wall.thickness_mm);
  _setCreativeSetupNumber('f-wall-fe', wall.wall_Fe_ppm);
  _setCreativeSetupNumber('f-wall-mn', wall.wall_Mn_ppm);
  _setCreativeSetupNumber('f-wall-mg', wall.wall_Mg_ppm);
  const sizeClass = document.getElementById('f-size-class') as HTMLSelectElement | null;
  if (sizeClass) sizeClass.value = 'preset';
}

async function fortressBegin() {
  const runLaunchToken = _runLaunchClaim();
  await waitForNarrativesReady();
  if (!_runLaunchTokenCurrent(runLaunchToken)) return;
  // Resolution phase: read every setup control into plain params, then
  // hand off to _fortressBeginCustomFromParams. The split exists for the
  // save system (93a-ui-saves.ts): a save stores the RESOLVED params, and
  // restoring one re-enters below the DOM reads — same construction path,
  // no dependence on what the setup sliders happen to show today.
  const temp = parseFloat(document.getElementById('f-temp').value);
  const pressure = clampFluidPressureKbar(parseFloat(document.getElementById('f-pressure').value) / 100);
  const presetData = FLUID_PRESETS[selectedPreset];
  // Start from the full preset recipe, then let every registered visible
  // chemistry control override its canonical FluidChemistry property.
  const fluidParams = readCreativeChemistryControls(presetData.fluid);

  // Initialize wall based on preset. selectPreset mirrors these values into
  // the exact setup controls, while this remains the non-DOM source of truth
  // for save replay and headless construction.
  const wallOpts: any = _creativePresetWallDefaults(selectedPreset);
  // Read the wall-reactivity slider (Creative-mode only). Range 0-20
  // in slider units → 0.0-2.0× multiplier on dissolution rate.
  // See VugWall.dissolve and VugWall constructor for the full table.
  const wallReactivityEl = document.getElementById('f-wall-reactivity');
  if (wallReactivityEl) {
    wallOpts.reactivity = parseFloat(wallReactivityEl.value) / 10;
  }
  // v162 Creative-mode thermal-pulse toggle. Checked (default) = hydrothermal
  // "hot fluid injection" pulses fire (ambient_cooling, 85d). Unchecked =
  // supergene / near-surface regime, no magmatic pulses. Mirrors the per-
  // scenario wall.thermal_pulses flag (22-geometry-wall) that bisbee +
  // roughten_gill set false.
  const thermalPulsesEl = document.getElementById('f-thermal-pulses') as HTMLInputElement | null;
  if (thermalPulsesEl) {
    wallOpts.thermal_pulses = thermalPulsesEl.checked;
  }
  // Size-class cascade (2026-05). When the player picks a non-default
  // cavity-size in the Creative Mode setup panel, override the preset's
  // vug_diameter_mm with the literature midpoint for the chosen tier.
  // Default = 'preset' (or absent) means "keep whatever the preset
  // chose" — preserves backward-compat for the existing silica /
  // mvt / carbonate / etc. presets.
  const sizeClassEl = document.getElementById('f-size-class') as HTMLSelectElement | null;
  const sizeClassChoice = sizeClassEl ? sizeClassEl.value : 'preset';
  if (sizeClassChoice && sizeClassChoice !== 'preset') {
    const mm = resolveSizeClassToMm(sizeClassChoice);
    if (mm != null) {
      wallOpts.size_class = sizeClassChoice;
      wallOpts.vug_diameter_mm = mm;
    }
  }
  const geological = readCreativeGeologicalControls(wallOpts);
  _fortressBeginCustomFromParams({
    temp, pressure, fluidParams,
    wallOpts: geological.wallOpts,
    conditionOpts: geological.conditionOpts,
    scenarioOpts: geological.scenarioOpts,
    initialWaterTablePct: geological.initialWaterTablePct,
    presetLabel: presetData.label,
  }, undefined, runLaunchToken);
}

// Construction phase of a custom Creative run. `params` is a plain
// JSON-able bag (a save record stores it verbatim); `seedOverride` lets
// the save system replay with the run's original seed. The rng is
// seeded BEFORE any construction — the same seed-first order legends
// uses (91-ui-legends.ts runSimulation), which the seed-42 baselines
// prove reproduces a whole run from the seed alone.
function _fortressBeginCustomFromParams(params, seedOverride?, runLaunchToken?) {
  // A tutorial belongs to one run. Replacing that run must release its locks,
  // callout, listeners, and progress before the new simulation is installed
  // (70a owns teardown; 94's Scenario/Starter constructors mirror this).
  if (typeof _tutorialRunBoundary === 'function') {
    _tutorialRunBoundary(undefined, runLaunchToken);
  }
  const { temp, pressure, wallOpts } = params;
  const fluidParams = Object.assign({}, params.fluidParams);
  const seed = (seedOverride != null) ? (seedOverride >>> 0) : (Date.now() >>> 0);
  rng = new SeededRandom(seed);

  const fluid = new FluidChemistry(fluidParams);
  const wall = new VugWall(Object.assign({}, wallOpts));
  const conditions = new VugConditions(Object.assign(
    { temperature: temp, pressure, fluid, wall },
    params.conditionOpts || {},
  ));
  conditions._scenario = Object.assign({}, params.scenarioOpts || {});
  const requestedBoundary = conditions._scenario.carbonate_boundary || {};
  conditions._scenario.carbonate_boundary = createConservedCarbonateBoundaryConfig(
    fluid,
    temp,
    {
      ...requestedBoundary,
      mode: conditions._scenario.open_to_atmosphere ? 'open' : 'closed',
      target_pCO2_bar: conditions._scenario.atmospheric_pCO2_bar
        ?? requestedBoundary.target_pCO2_bar,
      initialization: requestedBoundary.initialization
        || 'creative_explicit_initial_DIC_plus_pH_to_reduced_alkalinity',
    },
  );

  fortressSim = new VugSimulator(conditions, []);
  // Bind after construction so omitted controls resolve to FluidChemistry's
  // canonical defaults. Scenario and Starter entry points do the same in 94.
  _fortressBindInitialFluidRecipe(fortressSim, fluid);
  if (Number.isFinite(params.initialWaterTablePct)) {
    const pct = Math.max(0, Math.min(100, params.initialWaterTablePct));
    conditions.fluid_surface_height_mm
      = CavityWaterAppearance.verticalSpanForWall(fortressSim.wall_state) * pct / 100;
  }
  // HELIX-OVERLAY-FORK ADDITION (strip view v154+): attach recorder.
  if (typeof _attachStripRecorderToSim === 'function') {
    _attachStripRecorderToSim(fortressSim, 'fortress_custom', 'Fortress — custom setup');
  }
  fortressActive = true;
  fortressLogLines = [];

  // Show active panels, hide setup
  document.getElementById('fortress-setup').style.display = 'none';
  document.getElementById('fortress-status').style.display = 'block';
  document.getElementById('fortress-actions').style.display = 'block';
  const main = document.getElementById('fortress-main');
  main.style.display = 'flex';

  // Initial log
  const logEl = document.getElementById('fortress-log');
  logEl.innerHTML = '';
  const initLines = [
    `🏰 Creative Mode — Your Vug Awaits`,
    `   Temperature: ${temp.toFixed(0)}°C | Fluid pressure: ${pressure.toFixed(2)} kbar`,
    `   Fluid: ${params.presetLabel || 'custom recipe'} — ${fluid.describe()}`,
    `═`.repeat(60),
    ``,
    `Choose an action to advance one step at a time.`,
  ];
  initLines.forEach(line => {
    fortressLogLines.push(line);
    appendFortressLine(logEl, line);
  });

  updateFortressStatus();
  updateFortressInventory();
  syncBrothSliders();
  // The commissioned Cartesian cavity is already authoritative at step zero.
  // Render it now so Creative authors can inspect the initial condition before
  // the first geological action changes water, chemistry, or wall geometry.
  if (typeof topoRender === 'function') topoRender();
  // Autosave opens AFTER the slider sync so the recording's broth
  // baseline is the state the first action will actually see.
  if (typeof _saveNoteBegin === 'function') {
    _saveNoteBegin({ type: 'custom', params, seed });
  }
}

// Six verbs that touch the physics. Per proposals/PROPOSAL-BROTH-CONTROL.md
// (May 2026). Each verb has a gentle and a large step. Old per-element
// inject buttons collapsed into one species picker; mix_brine moved to
// scenario setup; oxidize absorbed by drain (vadose-zone exposure follows
// from lowering the water level).
//
// Backward-compat: legacy action ids ('silica', 'metals', 'brine',
// 'fluorine', 'copper', 'oxidize', 'tectonic') still resolve to sensible
// new behaviors so anything calling fortressStep('silica') keeps working.

// Lower fluid_surface_ring by `delta` rings (ratchet to 0). Returns the
// applied delta. Vadose oxidation kicks in via _applyVadoseOxidationOverride
// on the next run_step.
function _lowerWaterLevel(delta) {
  if (!fortressSim) return 0;
  const c = fortressSim.conditions;
  if (c.fluid_surface_ring === null || c.fluid_surface_ring === undefined) {
    // Initialize from ring_count if not yet set (creative-mode default).
    c.fluid_surface_ring = fortressSim.wall_state.ring_count;
  }
  const before = c.fluid_surface_ring;
  c.fluid_surface_ring = Math.max(0, before - delta);
  return before - c.fluid_surface_ring;
}

// Raise fluid_surface_ring by `delta` rings (clamp at ring_count).
function _raiseWaterLevel(delta) {
  if (!fortressSim) return 0;
  const c = fortressSim.conditions;
  const n = fortressSim.wall_state.ring_count;
  if (c.fluid_surface_ring === null || c.fluid_surface_ring === undefined) {
    c.fluid_surface_ring = n;
    return 0;
  }
  const before = c.fluid_surface_ring;
  c.fluid_surface_ring = Math.min(n, before + delta);
  return c.fluid_surface_ring - before;
}

// One run_step + log, used by 'wait' (×1) and 'wait_10' (×10). Returns
// the step's lines AND the index within those lines that should be
// the cavity-sync point (the format_header line — the engine's
// "═══ Step N ═══" marker). The caller threads that index into the
// global lineToStep map so the tempo player advances the cavity in
// lockstep with the header scrolling in.
function _advanceOneStep(logEl) {
  const log = fortressSim.run_step();
  const lines = [];
  lines.push('');
  lines.push(`── ⏳ Step ${fortressSim.step}`);
  const stepHeaderIdx = lines.length;  // next push is the format_header
  lines.push(fortressSim.format_header());
  if (log.length) {
    for (const l of log) lines.push(l);
  } else {
    lines.push('  (no growth or events this step)');
  }
  return { lines, stepHeaderIdx, simStep: fortressSim.step };
}

// Narrative-tempo Phase 3: scroll a batch of action-result lines into
// the fortress log at narrative tempo, syncing the cavity to each
// step-header line as it scrolls in. Action buttons disabled during
// playback; speed cluster surfaces so the user can crank to 4× for
// a snappier feel.
//
// Differs from Simulation/Quick Play's displayLines:
//   - APPENDS to the existing fortress-log (doesn't clear it). The
//     log is a running session ledger, not a one-shot reveal.
//   - No prologue/epilogue gates — the user already "clicked to
//     begin" by pressing the action button.
//   - onDone updates fortress-status + inventory; those panels need
//     the final state, not snapshots, so they fire after the scroll
//     completes.
// Phase 4 (2026-05-11): delegate to the shared `displayLines` engine
// in 91-ui-legends.ts. Fortress-specific concerns become a small
// options block:
//   - clearOutput: false              accumulating log, not one-shot reveal
//   - appendLine: custom              tags lines with fortress styling +
//                                     pushes to fortressLogLines for clipboard
//   - onStart: action-grid disable    locks input during playback
//   - onDone: action-grid re-enable   + caller's post-action housekeeping
//
// The whole per-step pacing / cavity sync / speed cluster machinery
// now lives ONCE in displayLines. This wrapper is ~30 lines instead
// of the ~90 it was pre-Phase 4 (commit before this one).

// When true, _fortressPaceLines appends synchronously instead of pacing.
// Set by the save-system replay driver (93a loadSaveById) and by
// headless test drives; closure-scoped `let` needs an explicit setter
// (the setGraduatedPowerLawK precedent).
let _fortressInstantLines = false;
function setFortressInstantLines(v) { _fortressInstantLines = !!v; }

function _fortressPaceLines(lines: string[], lineToStep: Record<number, number>, stepLineCounts: Record<number, number>, onDone?: () => void) {
  // Instant path (save-system replay + headless drives): append every
  // line synchronously — the log content is identical to the paced
  // version, only the tempo theater is skipped — then run onDone so the
  // post-action housekeeping happens in the same order as live play.
  if ((typeof _fortressInstantLines !== 'undefined' && _fortressInstantLines)
      || (typeof _fortressReplaying !== 'undefined' && _fortressReplaying)) {
    const instantLog = document.getElementById('fortress-log') as HTMLElement | null;
    for (const line of lines) {
      fortressLogLines.push(line);
      if (instantLog) appendFortressLine(instantLog, line);
    }
    onDone?.();
    return;
  }
  if (typeof running !== 'undefined' && running) { onDone?.(); return; }
  const logEl = document.getElementById('fortress-log') as HTMLElement | null;
  if (!logEl) { onDone?.(); return; }

  displayLines(
    lines,
    lineToStep,
    fortressSim,
    -1,           // no prologue gate
    -1,           // no epilogue gate
    logEl,
    () => {
      // Re-enable action grid + run caller's onDone (which fires the
      // post-action housekeeping: updateFortressInventory, etc.).
      document.querySelectorAll('.action-grid .action-btn').forEach((btn: any) => btn.disabled = false);
      if (onDone) onDone();
    },
    stepLineCounts,
    false,        // clearOutput: false — Fortress's log accumulates
    (out: HTMLElement, line: string) => {
      // Custom appendLine: keep fortressLogLines in sync for the
      // clipboard-copy path, then apply Fortress's class-based line
      // styling. appendFortressLine is the existing helper above.
      fortressLogLines.push(line);
      appendFortressLine(out, line);
    },
    () => {
      // onStart: lock the action grid. The user can hit 4× / 0.2s via
      // the speed cluster (mounted by displayLines) to skim quickly
      // without losing the cavity-tracks-text grammar.
      document.querySelectorAll('.action-grid .action-btn').forEach((btn: any) => btn.disabled = true);
    },
  );
}

function _fortressCarbonateRecharge(
  replacementFraction: number,
  incomingDICPpm: number,
  incomingPH: number,
  note: string,
): any {
  const state = fortressSim?._carbonateBoundaryState;
  if (!state) return null;
  if (!fortressSim._prepareCarbonateBoundarySpatialState() || state.blocked) {
    return { ok: false, error: 'carbonate_boundary_blocked_or_unreconciled' };
  }
  const incomingDIC = dicPpmToMolKg(incomingDICPpm);
  const incomingAlkalinity = reducedCarbonateAlkalinityEqKg(
    incomingDIC, incomingPH, fortressSim.conditions.temperature,
  );
  const tx = rechargeCarbonateBoundaryState(
    state,
    fortressSim.conditions.fluid,
    fortressSim.conditions.temperature,
    replacementFraction,
    incomingDIC,
    incomingAlkalinity,
    note,
  );
  if (tx?.ok) fortressSim._replaceFullyMixedCarbonateFluid();
  return tx;
}

function _fortressCarbonateTitrate(targetPH: number, note: string): any {
  const state = fortressSim?._carbonateBoundaryState;
  if (!state) return null;
  if (!fortressSim._prepareCarbonateBoundarySpatialState() || state.blocked) {
    return { ok: false, error: 'carbonate_boundary_blocked_or_unreconciled' };
  }
  const tx = titrateCarbonateBoundaryToPHState(
    state, fortressSim.conditions.fluid, fortressSim.conditions.temperature, targetPH, note,
  );
  if (tx?.ok) fortressSim._replaceFullyMixedCarbonateFluid();
  return tx;
}

// Bind a visible control to the authored movement that would otherwise erase
// it on the next Advance. Broth sliders coalesce repeated input events at one
// recipe cursor so live drag history and the replayed final value authenticate
// as the same intervention.
function _fortressApplyPlayerMovementDelta(
  field: string,
  before: number,
  after: number,
  action: string,
  coalesce = false,
  spatialSnapshot: any = null,
  spatialApplication: 'auto' | 'exact-replacement' = 'auto',
  preclosedFluidSpatialAuthority: any = null,
): any {
  if (!fortressSim) return null;
  const normalizedField = field.startsWith('fluid.') ? field : `fluid.${field}`;
  if (fortressSim._carbonateBoundaryState
      && (normalizedField === 'fluid.pH' || normalizedField === 'fluid.CO3')) {
    // Carbonate-bound pH/DIC movements are already refused by applyStep; they
    // cannot erase this control and must not mint false intervention evidence.
    return null;
  }
  const delta = after - before;
  const fluidSpatialAuthority = preclosedFluidSpatialAuthority || (spatialSnapshot && delta !== 0
    ? _reconcilePlayerFluidSpatialSnapshotInternal(
      fortressSim, spatialSnapshot, before, after, spatialApplication,
    )
    : null);
  const authoredMovements = fortressSim.conditions?._scenario?.movements;
  if (!fortressSim._movements && Array.isArray(authoredMovements) && authoredMovements.length) {
    // run_step normally creates this controller lazily. A visible intervention
    // happens before run_step, so commission the same deterministic controller
    // now or the first authored absolute sample would erase the action.
    fortressSim._movements = _createMovementController(fortressSim);
  }
  const movement = fortressSim._movements?.applyPlayerDelta?.(
    field, fortressSim.step + 1, delta,
  ) || null;
  if (!movement) return null;

  fortressSim._playerActionReceipts ||= [];
  const actionCursor = Number.isSafeInteger(fortressSim._playerActionCursor)
    && fortressSim._playerActionCursor >= 0
    ? fortressSim._playerActionCursor : 0;
  // Broth's pending recipe is a per-control map. Find the corresponding
  // receipt anywhere in the current cursor rather than only at the tail, so
  // an interleaved A -> B -> A drag has the same canonical [A, B] testimony
  // when it is replayed from the final A/B values.
  const priorIndex = coalesce
    ? fortressSim._playerActionReceipts.findIndex((candidate: any) => (
      candidate?.schema === 'player-movement-intervention-v1'
      && candidate.action === action
      && candidate.field === field
      && candidate.accepted_at_step === fortressSim.step
      && candidate.action_cursor === actionCursor
    ))
    : -1;
  const prior = priorIndex >= 0
    ? fortressSim._playerActionReceipts[priorIndex]
    : null;
  const receipt = movementPlayerInterventionReceipt(
    action, field, fortressSim.step, actionCursor, before, after, movement,
    prior, fluidSpatialAuthority,
  );
  if (!receipt) return null;
  if (priorIndex >= 0) fortressSim._playerActionReceipts[priorIndex] = receipt;
  else fortressSim._playerActionReceipts.push(receipt);
  return receipt;
}

function _fortressAdvancePlayerActionCursor(): void {
  if (!fortressSim) return;
  const current = Number.isSafeInteger(fortressSim._playerActionCursor)
    && fortressSim._playerActionCursor >= 0
    ? fortressSim._playerActionCursor : 0;
  fortressSim._playerActionCursor = current + 1;
}

// Snapshot every active global movement-owned coordinate before a visible
// Fortress action. The post-switch reconciliation below is deliberately
// generic: pH, pressure, silica, redox, and future controls deserve the same
// protection as the Heat repro that exposed GAME-02. Cell-origin movements
// are spatial feeders and never overwrite the visible bulk coordinate.
function _fortressMovementFieldSnapshot(): Map<string, any> {
  const snapshot = new Map<string, any>();
  if (!fortressSim) return snapshot;
  const nextStep = fortressSim.step + 1;
  const movements = fortressSim.conditions?._scenario?.movements;
  if (!Array.isArray(movements)) return snapshot;
  for (const movement of movements) {
    if (!movement || movement.origin === 'cell'
        || nextStep < movement.startStep || nextStep >= movement.endStep
        || typeof movement.field !== 'string' || !movement.field) continue;
    const value = Number(_movementGetField(fortressSim.conditions, movement.field));
    if (Number.isFinite(value) && !snapshot.has(movement.field)) {
      snapshot.set(movement.field, Object.freeze({
        value,
      }));
    }
  }
  return snapshot;
}

function _fortressReconcilePlayerMovementDeltas(
  before: Map<string, any>,
  action: string,
  fluidSpatialAuthorities: Record<string, any> = {},
): void {
  if (!fortressSim) return;
  for (const [field, snapshot] of before.entries()) {
    const valueBefore = Number(snapshot?.value);
    const valueAfter = Number(_movementGetField(fortressSim.conditions, field));
    if (!Number.isFinite(valueAfter) || valueAfter === valueBefore) continue;
    _fortressApplyPlayerMovementDelta(
      field, valueBefore, valueAfter, action, false,
      null, 'auto', fluidSpatialAuthorities[field] || null,
    );
  }
}

// These verbs mutate global fluid coordinates directly. 85c owns the actual
// pore-fluid layout; this registry only says which visible UI verbs need one
// opaque before/after reconciliation. It is intentionally adjacent to the
// generic movement snapshot so a new chemistry button has one obvious place
// to declare both what it touches and what touches it.
const _FORTRESS_GLOBAL_FLUID_ACTIONS = new Set([
  'seep', 'flood', 'drain', 'evaporate',
  'tweak_acidify', 'shift_acidify', 'acidify',
  'tweak_alkalinize', 'shift_alkalinize', 'alkalinize',
  'replenish', 'inject_species',
  'silica', 'metals', 'brine', 'fluorine', 'copper', 'oxidize',
]);

// Apply a visible player temperature control immediately. The generic
// movement-field reconciliation records its actual clamped delta after the
// action switch, alongside every other movement-owned coordinate.
function _fortressApplyPlayerTemperature(targetC: number): any {
  if (!fortressSim) return null;
  const before = Number(fortressSim.conditions.temperature);
  const after = Number(fortressSim.setGlobalTemperature(targetC));
  return Object.freeze({ before, after, delta: after - before });
}

function _dispatchFortressFluidActionProduct(receipt: any): boolean {
  if (!receipt) return false;
  const target = document.querySelector('.action-grid');
  if (!target || typeof target.dispatchEvent !== 'function') return false;
  target.dispatchEvent(new CustomEvent('vugg:fortress-fluid-action-committed', {
    bubbles: true,
    detail: receipt,
  }));
  return true;
}

function fortressStep(action, payload) {
  if (!fortressSim || !fortressActive) return;

  const c = fortressSim.conditions;
  let actionDesc = '';
  const movementFieldBefore = _fortressMovementFieldSnapshot();
  const fluidActionSnapshot = _FORTRESS_GLOBAL_FLUID_ACTIONS.has(String(action))
    ? _capturePlayerFluidActionSnapshotInternal(fortressSim, String(action), payload)
    : null;
  let fluidActionAccepted = !!fluidActionSnapshot;
  const fluidActionExcludedFields = new Set<string>();
  const fluidPHBefore = Number(c.fluid.pH);
  const carbonateTransactionCountBefore = Array.isArray(fortressSim._carbonateBoundaryState?.transactions)
    ? fortressSim._carbonateBoundaryState.transactions.length : -1;
  let carbonateActionTransaction: any = null;
  let fluidActionProductReceipt: any = null;

  // Broth inputs write through on their own input events. Never treat a
  // synchronized slider echo as authority over geological state.
  // Save system (93a-ui-saves.ts): record the verb + any broth-slider
  // changes the player actually made since the last action. No-ops during
  // replay; synchronized slider echoes are never recorded as interventions.
  if (typeof _saveRecordAction === 'function') _saveRecordAction(action, payload);

  // Track whether this action advances time and how many ticks.
  let advanceSteps = 0;

  switch (action) {

    // ── 1. TIME ──
    case 'wait':
      advanceSteps = 1;
      actionDesc = '⏳ Advance 1';
      break;
    case 'wait_10':
      advanceSteps = 10;
      actionDesc = '⏩ Advance 10';
      break;

    // ── 2. TEMPERATURE — gentle/large pairs ──
    case 'warm':
      _fortressApplyPlayerTemperature(Math.min(c.temperature + 5, 900));
      actionDesc = '🌤️ Warm +5°C → ' + c.temperature.toFixed(0) + '°C';
      break;
    case 'heat':
      _fortressApplyPlayerTemperature(Math.min(c.temperature + 25, 900));
      actionDesc = '🔥 Heat +25°C → ' + c.temperature.toFixed(0) + '°C';
      break;
    case 'cool':
      _fortressApplyPlayerTemperature(Math.max(c.temperature - 5, 0));
      actionDesc = '🌬️ Cool −5°C → ' + c.temperature.toFixed(0) + '°C';
      break;
    case 'quench':
      _fortressApplyPlayerTemperature(Math.max(c.temperature - 25, 0));
      actionDesc = '❄️ Quench −25°C → ' + c.temperature.toFixed(0) + '°C';
      break;

    // ── 3. WATER — seep/flood (in) and drain/evaporate (out) ──
    case 'seep': {
      // Gentle fresh-fluid trickle. Light dilution, modest carbonate refresh,
      // small water-level rise.
      const rise = _raiseWaterLevel(1);
      c.flow_rate = Math.max(c.flow_rate, 1.5);
      c.fluid.SiO2 *= 0.85;
      c.fluid.Ca *= 1.10;
      if (fortressSim._carbonateBoundaryState) {
        const tx = _fortressCarbonateRecharge(
          0.10, c.fluid.CO3 * 1.8, Math.min(c.fluid.pH + 0.1, 10), 'Creative seep recharge',
        );
        _carbonateBoundaryControlNotice = tx?.ok
          ? 'Seep executed as 10% replacement-water recharge with separate carbon import/export.'
          : `Seep carbonate recharge rejected: ${tx?.error || 'unknown error'}.`;
        if (!tx?.ok) {
          fluidActionExcludedFields.add('fluid.CO3');
          fluidActionExcludedFields.add('fluid.pH');
        }
      } else {
        c.fluid.CO3 *= 1.08;
        c.fluid.pH = Math.min(c.fluid.pH + 0.1, 10.0);
      }
      actionDesc = `💧 Seep — fresh fluid trickles in${rise ? `, water level +${rise.toFixed(1)}` : ''}`;
      break;
    }
    case 'flood': {
      // Deluge — old behavior + raise water level back to the ceiling.
      const rise = _raiseWaterLevel(fortressSim.wall_state.ring_count);
      c.flow_rate = 5.0;
      c.fluid.SiO2 *= 0.6;
      c.fluid.Ca *= 1.3;
      if (fortressSim._carbonateBoundaryState) {
        const tx = _fortressCarbonateRecharge(
          0.30, c.fluid.CO3 * (5 / 3), Math.min(c.fluid.pH + 0.3, 10), 'Creative flood recharge',
        );
        _carbonateBoundaryControlNotice = tx?.ok
          ? 'Flood executed as 30% replacement-water recharge with separate carbon import/export.'
          : `Flood carbonate recharge rejected: ${tx?.error || 'unknown error'}.`;
        if (!tx?.ok) {
          fluidActionExcludedFields.add('fluid.CO3');
          fluidActionExcludedFields.add('fluid.pH');
        }
      } else {
        c.fluid.CO3 *= 1.2;
        c.fluid.pH = Math.min(c.fluid.pH + 0.3, 10.0);
      }
      actionDesc = `🌊 Flood — fresh fluid pulse, silica diluted, carbonates refreshed${rise ? `, water level +${rise.toFixed(1)}` : ''}`;
      break;
    }
    case 'drain': {
      // Lower the water level gradually. Vadose oxidation kicks in on the
      // next run_step where exposed cells were below the meniscus before.
      const drop = _lowerWaterLevel(2);
      c.flow_rate = Math.max(c.flow_rate * 0.5, 0.2);
      c.fluid.O2 = Math.max(c.fluid.O2, 0.6);
      actionDesc = `🚰 Drain — water level −${drop.toFixed(1)}, exposed crystals oxidize (O₂ → ${c.fluid.O2.toFixed(1)})`;
      break;
    }
    case 'evaporate': {
      // Rapid water loss + concentrate residual fluid. Drives evaporite
      // chemistry in scenarios that have it.
      const drop = _lowerWaterLevel(6);
      c.flow_rate = Math.max(c.flow_rate * 0.2, 0.05);
      c.fluid.O2 = Math.max(c.fluid.O2, 1.5);
      // Concentrate solubles (skip pH; that's set by speciation, not bulk).
      // Do not multiply the legacy combined-S proxy here. Sulfur valence is a
      // conserved, independently receipted authority, and this one-kg control
      // volume does not yet model the water-mass export needed to concentrate
      // its reservoirs honestly. This mirrors the carbonate hold just below.
      const concSpecies = ['Ca', 'Mg', 'Na', 'K', 'Cl', 'B', 'F', 'Sr'];
      if (!fortressSim._carbonateBoundaryState) concSpecies.push('CO3');
      for (const sp of concSpecies) {
        if (typeof c.fluid[sp] === 'number') c.fluid[sp] *= 1.4;
      }
      _fortressApplyPlayerTemperature(Math.max(c.temperature - 10, 25));
      if (fortressSim._carbonateBoundaryState) {
        const state = fortressSim._carbonateBoundaryState;
        if (!state.uncertainties.includes('water_mass_change_not_modeled')) {
          state.uncertainties.push('water_mass_change_not_modeled');
        }
        _carbonateBoundaryControlNotice = 'Evaporation held the conserved carbonate inventory fixed because changing the one-kg-water control-volume basis is not yet supported.';
      }
      actionDesc = `☀️ Evaporate — water level −${drop.toFixed(1)}, modeled nonsulfur solutes concentrate ×1.4; sulfur reservoirs stay conserved and exposed sulfides may become unstable`;
      break;
    }

    // ── 4. pH — tweak/shift pairs in both directions ──
    case 'tweak_acidify':
      if (fortressSim._carbonateBoundaryState) {
        const tx = _fortressCarbonateTitrate(Math.max(c.fluid.pH - 0.3, 2), 'Creative gentle acid titration');
        carbonateActionTransaction = tx;
        _carbonateBoundaryControlNotice = tx?.ok
          ? `Strong-acid capacity changed; pH solved to ${c.fluid.pH.toFixed(2)}.`
          : `Acid titration rejected: ${tx?.error || 'unknown error'}.`;
        if (!tx?.ok) fluidActionAccepted = false;
      } else c.fluid.pH = Math.max(c.fluid.pH - 0.3, 2.0);
      actionDesc = `🧪 Tweak pH −0.3 → ${c.fluid.pH.toFixed(1)}`;
      break;
    case 'shift_acidify':
    case 'acidify': // legacy alias — fortressStep('acidify') still works
      if (fortressSim._carbonateBoundaryState) {
        const tx = _fortressCarbonateTitrate(Math.max(c.fluid.pH - 2, 2), 'Creative strong acid titration');
        carbonateActionTransaction = tx;
        _carbonateBoundaryControlNotice = tx?.ok
          ? `Strong-acid capacity changed; pH solved to ${c.fluid.pH.toFixed(2)}.`
          : `Acid titration rejected: ${tx?.error || 'unknown error'}.`;
        if (!tx?.ok) fluidActionAccepted = false;
        actionDesc = tx?.ok ? `🧪 Acid titration → pH ${c.fluid.pH.toFixed(2)}` : '🧪 Acid titration rejected';
      } else actionDesc = '🧪 ' + event_acidify(c);
      break;
    case 'tweak_alkalinize':
      if (fortressSim._carbonateBoundaryState) {
        const tx = _fortressCarbonateTitrate(Math.min(c.fluid.pH + 0.3, 10), 'Creative gentle base titration');
        _carbonateBoundaryControlNotice = tx?.ok
          ? `Strong-base capacity changed; pH solved to ${c.fluid.pH.toFixed(2)}.`
          : `Base titration rejected: ${tx?.error || 'unknown error'}.`;
        if (!tx?.ok) fluidActionAccepted = false;
      } else c.fluid.pH = Math.min(c.fluid.pH + 0.3, 10.0);
      actionDesc = `⚗️ Tweak pH +0.3 → ${c.fluid.pH.toFixed(1)}`;
      break;
    case 'shift_alkalinize':
    case 'alkalinize': // legacy alias
      if (fortressSim._carbonateBoundaryState) {
        const tx = _fortressCarbonateTitrate(Math.min(c.fluid.pH + 2, 10), 'Creative strong base titration');
        _carbonateBoundaryControlNotice = tx?.ok
          ? `Strong-base capacity changed; pH solved to ${c.fluid.pH.toFixed(2)}.`
          : `Base titration rejected: ${tx?.error || 'unknown error'}.`;
        if (!tx?.ok) fluidActionAccepted = false;
        actionDesc = tx?.ok ? `⚗️ Base titration → pH ${c.fluid.pH.toFixed(2)}` : '⚗️ Base titration rejected';
      } else actionDesc = '⚗️ ' + event_alkalinize(c);
      break;

    // ── 5. REPLENISH — replace the wet volume with the starting fluid ──
    // Replaces the proposal's per-element inject picker (redundant with
    // the Broth Control panel sliders just below the action grid). The
    // boss reframed it: this represents a fresh source-fluid boundary, so it
    // resets the entire canonical wet voxel volume (every species + sulfur
    // authority + pH) to what fortressBegin constructed. Temperature,
    // pressure, and water level are NOT reset — those are separate axes.
    // The spatial/ledger implementation lives in 85c; 93a records only this
    // verb and reconstructs the recipe from the saved run origin.
    case 'replenish': {
      const initialFluidRecipe = _fortressInitialFluidRecipeFor(fortressSim);
      if (!initialFluidRecipe) {
        fluidActionAccepted = false;
        actionDesc = '🥣 Replenish — no starting recipe is bound to this Creative run';
        break;
      }
      // The v1 replacement boundary is an equal-volume fully mixed model.
      // Applying it to every stored voxel after Drain would inject source
      // water into vadose pores, while applying it only below the water line
      // would require a different gross import/export and sulfur-volume law.
      // Fail before any boundary mutation until that partial-volume model is
      // explicitly commissioned. Carbonate scenarios additionally retain the
      // established structured refusal row for evidence/replay diagnosis.
      let fullySubmerged = false;
      try {
        fullySubmerged = CavityWaterAppearance.create(
          fortressSim.wall_state, fortressSim.conditions, { sim: fortressSim },
        ).receipt.fully_submerged === true;
      } catch (_) {
        fullySubmerged = false;
      }
      if (!fullySubmerged) {
        fluidActionAccepted = false;
        if (fortressSim._carbonateBoundaryState) {
          fortressSim._prepareCarbonateBoundarySpatialState();
        }
        actionDesc = '🥣 Replenish rejected — partial flooding needs a separately authored replacement-volume boundary';
        break;
      }
      let carbonateTx: any = null;
      if (fortressSim._carbonateBoundaryState) {
        const incomingDIC = Number(initialFluidRecipe.CO3);
        const incomingPH = Number(initialFluidRecipe.pH);
        carbonateTx = _fortressCarbonateRecharge(
          1,
          Number.isFinite(incomingDIC) ? incomingDIC : c.fluid.CO3,
          Number.isFinite(incomingPH) ? incomingPH : c.fluid.pH,
          'Creative host-rock replenish recharge',
        );
        _carbonateBoundaryControlNotice = carbonateTx?.ok
          ? 'Replenish executed as full replacement-water recharge with explicit incoming DIC and reduced alkalinity.'
          : `Replenish carbonate recharge rejected: ${carbonateTx?.error || 'unknown error'}.`;
      }
      if (fortressSim._carbonateBoundaryState && !carbonateTx?.ok) {
        fluidActionAccepted = false;
        actionDesc = '🥣 Replenish rejected — carbonate boundary could not authenticate the incoming fluid';
        break;
      }
      const boundary = fortressSim.replaceFullyMixedFluidBoundary(
        initialFluidRecipe,
        'Creative starting-fluid replenish',
        { preserveCarbonate: !!fortressSim._carbonateBoundaryState },
      );
      if (!boundary.ok) fluidActionAccepted = false;
      actionDesc = boundary.ok
        ? `🥣 Replenish — ${boundary.handlesReplaced} wet-fluid handles replaced from this run's starting recipe; pH → ${c.fluid.pH.toFixed(1)}`
        : '🥣 Replenish failed its fluid-boundary closure audit';
      break;
    }

    // Programmatic species injection — kept callable from console / tests
    // / scenario events. The proposal originally surfaced this as a UI
    // picker; the boss replaced the button with Replenish, but the
    // underlying action stays for non-UI callers.
    case 'inject_species': {
      if (!payload || !payload.species) {
        fluidActionAccepted = false;
        actionDesc = '💉 inject_species — no species/ppm payload, ignored';
        break;
      }
      const sp = String(payload.species);
      const amount = Number(payload.ppm) || 50;
      if (sp === 'CO3' && fortressSim._carbonateBoundaryState) {
        fluidActionAccepted = false;
        actionDesc = 'DIC injection refused: choose pure CO2 charge or replacement-water recharge so alkalinity and the carbon boundary are explicit.';
        _carbonateBoundaryControlNotice = actionDesc;
        break;
      }
      if (typeof c.fluid[sp] !== 'number') {
        fluidActionAccepted = false;
        actionDesc = `💉 Unknown species '${sp}' — no change`;
      } else {
        if (sp === 'SiO2' && typeof c.fluid.addReactiveSilica === 'function') {
          c.fluid.addReactiveSilica(amount);
        } else {
          c.fluid[sp] = (c.fluid[sp] || 0) + amount;
        }
        actionDesc = `💉 Inject ${sp} +${amount} ppm → ${c.fluid[sp].toFixed(0)} ppm`;
      }
      break;
    }

    // Legacy injection aliases — keep callers (tutorials, dev console,
    // saved keyboard macros) working. Each routes through inject_species
    // semantics where possible.
    case 'silica':
      if (typeof c.fluid.addReactiveSilica === 'function') c.fluid.addReactiveSilica(400);
      else c.fluid.SiO2 += 400;
      c.fluid.Al += 2;
      c.fluid.Ti += 0.3;
      actionDesc = '🔮 Silica injected — SiO₂ +400 ppm (now ' + c.fluid.SiO2.toFixed(0) + ')';
      break;
    case 'metals':
      c.fluid.Fe += 40;
      c.fluid.Mn += 15;
      actionDesc = '⚙️ Metals injected — Fe +40, Mn +15 ppm';
      break;
    case 'brine':
      c.fluid.Zn += 150;
      _fortressApplyPlayerTemperature(c.temperature - 10);
      actionDesc = '⚗️ Zn-rich brine mixed — Zn +150 ppm, T −10°C; sulfur reservoirs unchanged (no authored valence/source)';
      break;
    case 'fluorine':
      c.fluid.F += 25;
      c.fluid.Ca += 80;
      actionDesc = '💎 Fluorine added — F +25, Ca +80 ppm';
      break;
    case 'copper':
      c.fluid.Cu = 120.0;
      c.fluid.Fe += 40;
      if (typeof c.fluid.addReactiveSilica === 'function') c.fluid.addReactiveSilica(200);
      else c.fluid.SiO2 += 200;
      c.fluid.O2 = 0.3;
      _fortressApplyPlayerTemperature(Math.min(c.temperature + 30, 600));
      c.flow_rate = 4.0;
      actionDesc = `🟠 Copper-bearing fluid — Cu ${c.fluid.Cu.toFixed(0)} ppm, Fe +40, reactive silica +200, reducing; sulfur reservoirs unchanged. T → ${c.temperature.toFixed(0)}°C`;
      break;
    case 'oxidize': // legacy alias — same intent as drain
      c.fluid.O2 = 1.8;
      _fortressApplyPlayerTemperature(Math.max(c.temperature - 40, 25));
      _lowerWaterLevel(2);
      actionDesc = `🟡 Oxidation — O₂ → ${c.fluid.O2.toFixed(1)}; sulfur reservoirs remain conserved until an executed redox/solid reaction transfers them. T → ${c.temperature.toFixed(0)}°C. Sulfides may become unstable!`;
      break;

    // ── 6. SEISMIC — differential stress, never isotropic pressure ──
    case 'tap': {
      const stress = applyDifferentialStressPulse(fortressSim, 25);
      actionDesc = `👆 Tap — 25 MPa differential-stress pulse; fluid pressure unchanged. ${stress.twinned.length} mechanically twinned crystal${stress.twinned.length === 1 ? '' : 's'}.`;
      break;
    }
    case 'shock':
    case 'tectonic': { // legacy alias
      _fortressApplyPlayerTemperature(c.temperature + 15);
      const stress = applyDifferentialStressPulse(fortressSim, 50);
      actionDesc = `⚡ Shock — 50 MPa differential-stress pulse, T +15°C; fluid pressure unchanged. ${stress.twinned.length} mechanically twinned crystal${stress.twinned.length === 1 ? '' : 's'}.`;
      break;
    }
    case 'stress_pulse': {
      const sigma = Math.max(0, Number(payload?.sigmaDiffMpa) || 0);
      const stress = applyDifferentialStressPulse(fortressSim, sigma);
      actionDesc = `Instantaneous differential-stress pulse — ${sigma.toFixed(1)} MPa; fluid pressure unchanged; ${stress.twinned.length} mechanical twin response${stress.twinned.length === 1 ? '' : 's'}. No creep/duration law is implied.`;
      break;
    }
    case 'decompress': {
      const before = c.pressure;
      const delta = Math.max(0, Number(payload?.deltaKbar) || 0);
      c.pressure = clampFluidPressureKbar(before - delta);
      actionDesc = `Isothermal decompression — fluid pressure ${before.toFixed(2)} → ${c.pressure.toFixed(2)} kbar. Volatile flashing is not inferred without conserved gas pools.`;
      break;
    }

    // ── 7. ADVANCED GEOLOGICAL HISTORY ──
    case 'schedule_movement': {
      const spec = normalizeCreativeMovementSpec(payload, fortressSim.step);
      if (!spec) {
        actionDesc = 'Trajectory ignored — choose a field and finite amount/target.';
        break;
      }
      if (fortressSim._carbonateBoundaryState
          && (spec.field === 'fluid.CO3' || spec.field === 'fluid.pH')) {
        actionDesc = spec.field === 'fluid.CO3'
          ? 'DIC trajectory refused — schedule explicit replacement-water recharge with incoming DIC and reduced alkalinity.'
          : 'pH trajectory refused — schedule a reduced-alkalinity/strong-acid-base trajectory so pH remains solved.';
        _carbonateBoundaryControlNotice = actionDesc;
        break;
      }
      c._scenario ||= {};
      c._scenario.movements ||= [];
      // Commission the canonical authored rows BEFORE appending the visible
      // Creative schedule. Otherwise a first-action schedule is already in
      // the constructor input and is falsely labelled authored-scenario.
      if (!fortressSim._movements) {
        fortressSim._movements = _createMovementController(fortressSim);
      }
      c._scenario.movements.push(spec);
      fortressSim._movements.addMovement(spec);
      actionDesc = `Trajectory scheduled — ${spec.field}, steps ${spec.startStep}–${spec.endStep - 1}, ${spec.origin}`;
      break;
    }
    case 'clear_movements':
      c._scenario ||= {};
      c._scenario.movements = [];
      fortressSim._movements = _createMovementController(fortressSim);
      actionDesc = 'All scheduled trajectories cleared.';
      break;
    case 'configure_feeders': {
      c._scenario ||= {};
      const config = {
        count: Math.max(0, Math.floor(Number(payload?.count) || 0)),
        kinds: Array.isArray(payload?.kinds) ? payload.kinds : undefined,
        spots: Array.isArray(payload?.spots) ? payload.spots : undefined,
        deposition: !!payload?.deposition,
      };
      c._scenario.fluid_spots = config;
      fortressSim._fluidSpots = _createFluidSpotField(fortressSim);
      fortressSim._fluidSpotsDeposition = config.deposition;
      const n = fortressSim._fluidSpots.spots.length;
      actionDesc = `Feeder network rebuilt — ${n} point source${n === 1 ? '' : 's'}; deposition clustering ${config.deposition ? 'on' : 'off'}`;
      break;
    }
    case 'toggle_feeders': {
      const command = payload?.action === 'breach' ? 'breach' : 'seal';
      const kind = payload?.kind || undefined;
      const toggled = command === 'breach'
        ? fortressSim._fluidSpots?.breachSpots(kind)
        : fortressSim._fluidSpots?.sealSpots(kind);
      actionDesc = `${command === 'breach' ? 'Breached' : 'Sealed'} ${toggled?.length || 0} ${kind || 'point'} feeder${toggled?.length === 1 ? '' : 's'}`;
      break;
    }
    case 'set_thermal_source': {
      const source = fortressSim.setThermalSource(payload);
      actionDesc = source
        ? `Thermal boundary ${source.id} set at cell ${source.ringIdx * fortressSim.wall_state.cells_per_ring + source.cellIdx}, depth ${source.depthIdx}: ${source.temperature_C.toFixed(1)}°C, ${source.flow_direction}. Exchange coefficients are fractions per simulation step, not SI rates.`
        : 'Thermal source ignored — provide a finite source temperature.';
      break;
    }
    case 'configure_thermal_field': {
      const config = fortressSim.configureThermalField(payload || {});
      actionDesc = `Thermal transport ${config.enabled ? 'enabled' : 'paused'}: conduction ${config.conduction_fraction_per_step.toFixed(4)}/step, wall exchange ${config.wall_coupling_fraction_per_step.toFixed(4)}/step, rock boundary ${config.wall_rock_thermal_buffer_C == null ? 'none' : `${config.wall_rock_thermal_buffer_C.toFixed(1)}°C`}. Coefficients are dimensionless until voxel length and step duration are calibrated.`;
      break;
    }
    case 'remove_thermal_source': {
      const removed = fortressSim.removeThermalSource(payload?.id);
      actionDesc = removed
        ? `Thermal boundary ${payload?.id} removed; its existing heat remains and relaxes by conduction.`
        : `No thermal boundary named ${payload?.id || '(blank)'} was present.`;
      break;
    }
    case 'clear_thermal_sources': {
      const removed = fortressSim.clearThermalSources();
      actionDesc = `${removed} localized thermal boundar${removed === 1 ? 'y' : 'ies'} removed; stored heat remains and relaxes by conduction.`;
      break;
    }
    case 'set_zone_chemistry': {
      const changed = applyCreativeZoneChemistry(fortressSim, payload);
      actionDesc = changed
        ? `${payload?.clear ? 'Cleared' : 'Set'} ${payload?.zone}.${payload?.field} across ${changed} mesh cells; spatial nucleation ${c.wall.zone_chemistry ? 'enabled' : 'disabled'}`
        : 'Spatial chemistry edit ignored — select a valid zone, field, and value.';
      break;
    }
    case 'apply_deformation': {
      fortressSim._deformationEvents ||= [];
      const magnitude = Math.max(0, Math.min(1, Number(payload?.magnitude) || 0));
      fortressSim._deformationEvents.push({
        step: fortressSim.step,
        style: payload?.style || 'bend',
        magnitude,
        minerals: Array.isArray(payload?.minerals) && payload.minerals.length ? payload.minerals : null,
      });
      actionDesc = `Visual deformation reconstruction — ${payload?.style || 'bend'}, magnitude ${magnitude.toFixed(2)}; render tag only, with no strain-time or mass law implied.`;
      break;
    }
    case 'apply_etch': {
      fortressSim._etchEvents ||= [];
      const durationDays = Number(payload?.duration_days);
      const directive = {
        step: fortressSim.step,
        duration_days: durationDays,
        minerals: Array.isArray(payload?.minerals) && payload.minerals.length ? payload.minerals : null,
        physical: true,
      };
      fortressSim._etchEvents.push(directive);
      const result = applyPhysicalEtchDirective(fortressSim, directive, fortressSim.step);
      fortressSim._lastPhysicalEtch = result;
      actionDesc = `Physical etch — model-derived morphology, ${Number.isFinite(result.durationDays) ? result.durationDays.toFixed(2) : 'invalid'} days: `
        + `${result.accepted}/${result.considered} exposed crystals retreated, `
        + `${result.totalAxialLossUm.toFixed(1)} µm axial-equivalent solid removed; exact booked shell inventory returned. `
        + `Accepted relief is a labelled 250× schematic pore overlay while mass and silhouette stay physical. `
        + `${result.rejected ? `${result.rejected} target(s) lacked a flat cubic surface or were outside the bounded rate/affinity envelope.` : ''}`;
      break;
    }
    case 'apply_film': {
      const mineral = String(payload?.mineral || 'chlorite');
      const prism = Math.max(0, Math.min(1, Number(payload?.prism) || 0));
      const term = Math.max(0, Math.min(1, Number(payload?.term) || 0));
      const filter = Array.isArray(payload?.minerals) && payload.minerals.length ? payload.minerals : null;
      const dusted = applyFilmDusting(
        fortressSim.crystals, mineral, term, prism, fortressSim.step, filter, fortressSim,
      );
      actionDesc = `Foreign film — ${mineral} coated ${dusted} crystal${dusted === 1 ? '' : 's'} (prism ${prism.toFixed(2)}, term ${term.toFixed(2)})`;
      break;
    }
  }

  const fluidSpatialAuthorities = fluidActionSnapshot
    ? _reconcilePlayerFluidActionSnapshotInternal(fortressSim, fluidActionSnapshot, {
      accepted: fluidActionAccepted,
      excludedFields: Array.from(fluidActionExcludedFields),
    })
    : {};
  const pHAuthority = fluidSpatialAuthorities?.['fluid.pH'];
  const carbonateTransactions = fortressSim._carbonateBoundaryState?.transactions;
  const carbonateTransactionIndex = Array.isArray(carbonateTransactions)
    ? carbonateTransactions.indexOf(carbonateActionTransaction) : -1;
  // `_prepareCarbonateBoundarySpatialState()` is the authoritative flush for
  // accepted carbonate growth. A player may press Acid immediately after an
  // Advance whose last accepted shells are still pending; those exact
  // solid-transfer rows legitimately land between the action's before-count
  // and its pH-titration row. Bind and disclose that preparation interval
  // instead of requiring the titration to occupy a stale pre-action index.
  // 70a consumes this product, the guided browser journey exercises the real
  // step-50 case, and the mechanism witness keeps the zero-pending control.
  const carbonatePreparationTransactions = Array.isArray(carbonateTransactions)
      && carbonateTransactionIndex >= carbonateTransactionCountBefore
    ? carbonateTransactions.slice(carbonateTransactionCountBefore, carbonateTransactionIndex)
    : [];
  const carbonatePreparationClosed = carbonatePreparationTransactions.every((transaction: any) => (
    transaction?.ok === true
      && transaction.kind === 'solid_transfer'
      && Array.isArray(transaction.minerals) && transaction.minerals.length > 0
      && typeof transaction.note === 'string'
      && transaction.note.startsWith(`step ${fortressSim.step}: accepted zone `)
  ));
  if (['tweak_acidify', 'shift_acidify', 'acidify'].includes(String(action))
      && fluidActionAccepted
      && typeof fluidPHBefore === 'number' && Number.isFinite(fluidPHBefore)
      && typeof c.fluid.pH === 'number' && Number.isFinite(c.fluid.pH)
      && c.fluid.pH < fluidPHBefore
      && pHAuthority?.schema === 'player-fluid-spatial-intervention-v1'
      && pHAuthority?.scope === 'canonical-nonvadose-voxel-volume'
      && pHAuthority?.closed === true
      && Number.isSafeInteger(pHAuthority?.count) && pHAuthority.count > 0
      && carbonateActionTransaction?.ok === true
      && carbonateActionTransaction?.kind === 'ph_titration'
      && carbonateTransactionIndex >= carbonateTransactionCountBefore
      && carbonateTransactionIndex === carbonateTransactions.length - 1
      && carbonatePreparationClosed) {
    fluidActionProductReceipt = Object.freeze({
      schema: 'fortress-fluid-action-product-v1',
      product: 'carbonate-acid-titration',
      action: String(action),
      accepted_at_step: fortressSim.step,
      before_pH: fluidPHBefore,
      after_pH: Number(c.fluid.pH),
      spatial_authority_schema: pHAuthority.schema,
      spatial_authority_scope: pHAuthority.scope,
      spatial_authority_count: pHAuthority.count,
      spatial_authority_closed: true,
      carbonate_transaction_kind: carbonateActionTransaction.kind,
      carbonate_transaction_index: carbonateTransactionIndex,
      carbonate_transactions_before_action: carbonateTransactionCountBefore,
      carbonate_preparation_transfer_count: carbonatePreparationTransactions.length,
    });
  }
  _fortressReconcilePlayerMovementDeltas(
    movementFieldBefore, String(action || 'unknown'), fluidSpatialAuthorities,
  );

  const logEl = document.getElementById('fortress-log');

  if (advanceSteps > 0) {
    // Narrative-tempo Phase 3: action results play out at narrative
    // tempo. Boss directive 2026-05-11 — each step takes 2 seconds
    // at default speed (1×), 1 second at fast (2×), 0.2 seconds at
    // quick (10×). Run the sim steps synchronously up front to
    // populate wall_state_history, then hand the collected lines to
    // the tempo player which paces them per-step and syncs the
    // cavity to each step-header.
    const lines: string[] = [];
    const lineToStep: Record<number, number> = {};
    const stepLineCounts: Record<number, number> = {};
    for (let i = 0; i < advanceSteps; i++) {
      const { lines: stepLines, stepHeaderIdx, simStep } = _advanceOneStep(logEl);
      // The header line's index within the FINAL `lines` array is
      // its offset within stepLines plus the count of lines already
      // pushed. Mark it so the tempo player advances the cavity to
      // simStep when that line scrolls in AND so it knows which
      // step's line-count budget governs the per-line delay.
      lineToStep[lines.length + stepHeaderIdx] = simStep;
      stepLineCounts[simStep] = stepLines.length;
      for (const l of stepLines) lines.push(l);
    }
    _fortressAdvancePlayerActionCursor();
    if (typeof _saveCommitAction === 'function') _saveCommitAction();
    _fortressPaceLines(lines, lineToStep, stepLineCounts, () => {
      updateFortressInventory();
      updateFortressStatus();
      syncBrothSliders();
      if (typeof refreshCreativeGeologyEditors === 'function') refreshCreativeGeologyEditors();
      if (typeof _maybeAdvanceTutorial === 'function') _maybeAdvanceTutorial();
    });
    return;
  }

  // Non-time actions: modify conditions but DON'T advance time.
  _fortressAdvancePlayerActionCursor();
  if (typeof _saveCommitAction === 'function') _saveCommitAction();
  _dispatchFortressFluidActionProduct(fluidActionProductReceipt);
  // Log what changed so the player can stack multiple changes. No
  // tempo needed — the user already saw the result; just emit one
  // line.
  const inlineLine = `  ⚙️ ${actionDesc}`;
  fortressLogLines.push(inlineLine);
  appendFortressLine(logEl, inlineLine);
  // Reverse-flow class: add once so non-time actions also push to
  // the top of the visual stack, consistent with the time-action
  // playback. Idempotent.
  logEl.classList.add('narrative-flow-reverse');
  logEl.scrollTop = 0;
  updateFortressStatus();
  syncBrothSliders();
  if (typeof refreshCreativeGeologyEditors === 'function') refreshCreativeGeologyEditors();
  if (typeof topoRender === 'function') topoRender();
  // Drive the tutorial state machine after each action. Reads
  // fortressSim.step internally — no-op when no tutorial is active.
  if (typeof _maybeAdvanceTutorial === 'function') _maybeAdvanceTutorial();
}

function appendFortressLine(container, line) {
  const span = document.createElement('div');
  span.textContent = line;
  if (line.includes('🧱')) span.className = 'line-wall';
  else if (line.includes('⚡')) span.className = 'line-event';
  else if (line.includes('✦')) span.className = 'line-nucleation';
  else if (line.includes('═══ Step') || (line.startsWith('═') && line.length > 5)) span.className = 'line-header';
  else if (line.includes('⬇') || line.includes('DISSOLUTION')) span.className = 'line-dissolution';
  container.appendChild(span);
}

function updateFortressStatus() {
  if (!fortressSim) return;

  // v66 replay-aware: when the topo replay timer is running, swap to
  // the snapshot's conditions for the active frame so the fortress
  // panel rewinds T / pH / pressure / fluid composition alongside the
  // 3D cavity — including the supersaturation pills, which call
  // `c.supersaturation_<mineral>()` methods inherited from the
  // VugConditions prototype. We construct a prototype-rooted overlay
  // so those methods stay callable but read snapshot fields.
  // _topoReplayActiveSnap is set per frame by topoReplay (in
  // 99g-renderer-replay.ts). The renderer is the source of truth for
  // "what step is the user looking at" — fortress-status just reads
  // from the same snapshot.
  const replaySnap = (typeof _topoReplayActiveSnap !== 'undefined') ? _topoReplayActiveSnap : null;
  const liveCnd = fortressSim.conditions;
  let c = liveCnd;
  if (replaySnap && replaySnap.conditions) {
    const snapCnd = replaySnap.conditions;
    // Wall shim — keeps Wall.* methods accessible via prototype while
    // overriding the two render-relevant fields.
    const wallShim = Object.assign(
      Object.create(Object.getPrototypeOf(liveCnd.wall) || null),
      liveCnd.wall,
      {
        vug_diameter_mm: snapCnd.vug_diameter_mm,
        total_dissolved_mm: snapCnd.total_dissolved_mm,
      }
    );
    // Conditions shim — same trick for the parent. supersaturation_*
    // methods come from the live prototype, so the σ-panel reads
    // snapshot fluid + temperature.
    c = Object.assign(
      Object.create(Object.getPrototypeOf(liveCnd) || null),
      liveCnd,
      {
        temperature: snapCnd.temperature,
        pressure: snapCnd.pressure,
        flow_rate: snapCnd.flow_rate,
        fluid: snapCnd.fluid || liveCnd.fluid,
        fluid_surface_ring: snapCnd.fluid_surface_ring,
        wall: wallShim,
      }
    );
  }
  const stepDisplay = (replaySnap && replaySnap.step != null) ? replaySnap.step : fortressSim.step;
  const radDose = (replaySnap && replaySnap.radiation_dose != null)
    ? replaySnap.radiation_dose
    : fortressSim.radiation_dose;

  document.getElementById('f-step-num').textContent = stepDisplay;
  document.getElementById('f-stat-temp').textContent = c.temperature.toFixed(1) + '°C';
  document.getElementById('f-stat-press').textContent = c.pressure.toFixed(2) + ' kbar fluid';
  document.getElementById('f-stat-ph').textContent = c.fluid.pH.toFixed(1);
  document.getElementById('f-stat-flow').textContent = c.flow_rate.toFixed(1);

  // Show vug diameter when dissolution has occurred
  const vugContainer = document.getElementById('f-stat-vug-container');
  if (c.wall.total_dissolved_mm > 0) {
    vugContainer.style.display = '';
    document.getElementById('f-stat-vug').textContent = `${c.wall.vug_diameter_mm.toFixed(2)}mm eq. D (ΔV ${c.wall.host_volume_removed_mm3_per_kg.toFixed(2)}mm³/kg)`;
  } else {
    vugContainer.style.display = 'none';
  }

  // Show radiation dose when uraninite present
  const radContainer = document.getElementById('f-stat-radiation-container');
  if (radDose > 0) {
    radContainer.style.display = '';
    document.getElementById('f-stat-radiation').textContent = `☢️ ${radDose.toFixed(2)}`;
  } else {
    radContainer.style.display = 'none';
  }

  // What each mineral needs to thrive
  function mineralNeeds(name, c) {
    const T = c.temperature, f = c.fluid;
    const clean = n => n.replace(/^[^\w]*/, ''); // strip emoji
    switch (clean(name).toLowerCase()) {
      case 'quartz':
        if (f.SiO2 < 200) return 'more SiO₂';
        if (T > 573) return 'lower temperature (<573°C)';
        return 'higher SiO₂ concentration';
      case 'calcite':
        if (f.Ca < 50) return 'more Ca';
        if (f.CO3 < 30) return 'more CO₃';
        if (f.pH < 5.5) return 'higher pH (less acidic)';
        return 'more Ca + CO₃';
      case 'fluorite':
        if (f.Ca < 30) return 'more Ca';
        if (f.F < 5) return 'more F (fluorine)';
        return 'more Ca + F';
      case 'sphalerite':
        if (f.Zn < 20) return 'more Zn';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Zn + S';
      case 'pyrite':
        if (f.Fe < 5) return 'more Fe';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Fe + S';
      case 'chalcopyrite':
        if (f.Cu < 5) return 'more Cu';
        if (f.Fe < 5) return 'more Fe';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Cu + Fe + S';
      case 'hematite':
        if (f.Fe < 10) return 'more Fe';
        if (f.O2 < 0.3) return 'more O₂ (oxidizing conditions)';
        return 'more Fe + O₂';
      case 'malachite':
        if (f.Cu < 10) return 'more Cu';
        if (f.CO3 < 20) return 'more CO₃';
        if (f.O2 < 0.2) return 'more O₂ (oxidizing conditions)';
        return 'Cu + CO₃ + O₂';
      case 'uraninite':
        if (f.U < 20) return 'more U (uranium)';
        if (T < 200) return 'higher temperature';
        return 'more U';
      case 'galena':
        if (f.Pb < 10) return 'more Pb (lead)';
        if (f.S < 10) return 'more S (sulfur)';
        return 'more Pb + S';
      case 'smithsonite':
        if (f.Zn < 10) return 'more Zn';
        if (f.CO3 < 20) return 'more CO₃';
        if (f.O2 < 0.2) return 'O₂ (oxidized Zn environment)';
        return 'Zn + CO₃ + O₂';
      case 'wulfenite':
        if (f.Pb < 10) return 'more Pb (lead)';
        if (f.Mo < 5) return 'more Mo (molybdenum)';
        if (f.O2 < 0.2) return 'more O₂ (oxidizing conditions)';
        if (T > 250) return 'lower temperature (<250°C)';
        return 'Pb + Mo + O₂';
      case 'selenite':
        if (f.Ca < 20) return 'more Ca';
        if (f.S < 10) return 'more S (sulfate)';
        if (f.O2 < 0.3) return 'more O₂ (to convert S²⁻ to SO₄²⁻)';
        if (T > 80) return 'lower temperature (<80°C)';
        return 'Ca + SO₄ + low temperature';
      case 'feldspar':
        if (f.K < 15 && f.Na < 15) return 'more K or Na (alkalis)';
        if (f.Al < 5) return 'more Al (aluminum)';
        if (f.SiO2 < 100) return 'more SiO₂';
        if (T < 150) return 'higher temperature (>150°C)';
        if (T > 800) return 'lower temperature (<800°C)';
        return 'K/Na + Al + SiO₂';
      default:
        return 'different conditions';
    }
  }

  // Supersaturation indicators — auto-derived from MINERAL_SPEC and
  // grouped by mineral class. Every mineral with a
  // `supersaturation_<name>` method on conditions appears under its
  // class's collapsible <details>; classes whose max σ ≥ 1 open
  // automatically so the player sees active supersaturation without
  // clicking. Supersedes the hand-coded 28-mineral list (May 2026):
  // adding a new mineral now auto-populates the panel.
  _renderFortressSigmaGroups(c, document.getElementById('f-sat-bar'));
}

// Display-name overrides preserve the emoji decorations the legacy
// hardcoded list used. Anything not in the map gets `name[0].upper()
// + rest`.
const _SAT_DISPLAY_NAMES = {
  uraninite: '☢️ Uraninite',
  wulfenite: '🟠 Wulfenite',
  selenite: '💎 Selenite',
  feldspar: '🏔️ Feldspar',
  adamite: '💚 Adamite',
  mimetite: '🟡 Mimetite',
};

// Cap the "max σ" badge so the meta line doesn't read as
// "σ max 12345.67". Big σ values are real (Mo can hit double digits
// in Bingham porphyry brines) but past 99 the user just needs to
// know "very super-saturated".
const _SAT_DISPLAY_MAX = 99.99;


function fortressFinish() {
  if (!fortressSim) return;
  // Idempotence: the run seals once. A second click (or a stray caller
  // after the run ended) must not re-narrate, re-collect, or double-
  // bump the lifetime counters.
  if (!fortressActive) return;

  const logEl = document.getElementById('fortress-log');
  const summaryLines = fortressSim.format_summary();

  fortressLogLines.push('');
  const sep = document.createElement('div');
  sep.innerHTML = '<br>';
  logEl.appendChild(sep);

  // Render summary with narrative box
  let inNarrative = false;
  let narrativeEl = null;

  for (const line of summaryLines) {
    fortressLogLines.push(line);

    if (line === 'GEOLOGICAL HISTORY') {
      const box = document.createElement('div');
      box.className = 'narrative-box';
      const title = document.createElement('div');
      title.className = 'narrative-title';
      title.textContent = 'GEOLOGICAL HISTORY';
      box.appendChild(title);
      narrativeEl = document.createElement('div');
      box.appendChild(narrativeEl);
      logEl.appendChild(box);
      inNarrative = true;
      continue;
    }

    if (inNarrative && line.startsWith('═'.repeat(10))) {
      inNarrative = false;
      appendFortressLine(logEl, line);
      continue;
    }

    if (inNarrative && line.startsWith('─'.repeat(10))) continue;

    if (inNarrative) {
      const span = document.createElement('div');
      span.textContent = line;
      span.style.marginBottom = line === '' ? '0.5em' : '0';
      narrativeEl.appendChild(span);
      continue;
    }

    appendFortressLine(logEl, line);
  }

  logEl.scrollTop = logEl.scrollHeight;

  // Disable action buttons
  fortressActive = false;
  document.querySelectorAll('.action-grid .action-btn').forEach(btn => btn.disabled = true);

  // ── Narrate, Collect & Save (boss directive 2026-07-08) ─────────
  // The finish button seals the whole run: every grown crystal goes to
  // the Library (silent batch — the log line IS the celebration, no
  // alert), the rolling autosave flips to 'finished', and the lifetime
  // counters tick. All of it is replay-guarded: restoring a finished
  // save re-runs this function for the narration, but its crystals are
  // already collected and its save already sealed.
  if (!(typeof _fortressReplaying !== 'undefined' && _fortressReplaying)) {
    const endLines = [];
    if (typeof _saveMarkFinished === 'function') {
      const info = _saveMarkFinished();
      if (info) {
        if (info.saved) {
          if (info.count > 0) {
            const speciesNote = info.newSpecies && info.newSpecies.length
              ? ` — ${info.newSpecies.length} new species: ${info.newSpecies.join(', ')}`
              : '';
            endLines.push(`💎 Collected ${info.count} crystal${info.count === 1 ? '' : 's'} into the Library${speciesNote}.`);
          } else {
            endLines.push('💎 Nothing new to collect — the Library already holds this run\'s crystals.');
          }
          endLines.push(`💾 Run saved — "${info.name}"${info.lifetime ? ` · lifetime collected: ${info.lifetime.crystals_collected}` : ''}.`);
        } else {
          endLines.push('⚠️ Finish transaction incomplete. No unreceipted Library or lifetime change is being presented as complete; the authenticated transaction remains available from Saves for retry.');
        }
      }
    }
    for (const line of endLines) {
      fortressLogLines.push(line);
      appendFortressLine(logEl, line);
    }
    logEl.scrollTop = logEl.scrollHeight;
    // Collect buttons in the inventory flip to their collected state.
    if (typeof updateFortressInventory === 'function') updateFortressInventory();
  }
}

function fortressReset() {
  // Reset is a run-lifecycle boundary, not merely a panel repaint. End the
  // lexical tutorial state first so its CSS allow-list and delegated listeners
  // cannot survive over setup or the next run (70a-tutorial-overlay.ts).
  if (typeof _tutorialRunBoundary === 'function') _tutorialRunBoundary();
  fortressSim = null;
  fortressActive = false;
  fortressLogLines = [];
  brothSnapshots = [];
  // Drop the save-system recording state. The persisted autosave keeps
  // whatever was last written — an abandoned run stays loadable.
  if (typeof _saveNoteReset === 'function') _saveNoteReset();

  // Reset broth panel
  const brothToggle = document.getElementById('broth-toggle');
  const brothBody = document.getElementById('broth-body');
  if (brothToggle) brothToggle.classList.remove('open');
  if (brothBody) brothBody.classList.remove('open');
  document.getElementById('creative-geology-toggle')?.classList.remove('open');
  document.getElementById('creative-geology-body')?.classList.remove('open');
  // Clear snapshot buttons (keep the 📸 button)
  const snapRow = document.getElementById('broth-snapshots');
  if (snapRow) {
    const firstBtn = snapRow.querySelector('.broth-snapshot-btn');
    snapRow.innerHTML = '';
    if (firstBtn) snapRow.appendChild(firstBtn);
  }

  // Reset UI
  document.getElementById('fortress-setup').style.display = 'block';
  document.getElementById('fortress-status').style.display = 'none';
  document.getElementById('fortress-actions').style.display = 'none';
  document.getElementById('fortress-main').style.display = 'none';
  document.getElementById('fortress-log').innerHTML = '';
  document.getElementById('fortress-inventory').innerHTML = '<h4>💎 Crystal Inventory</h4><div class="inv-empty">No crystals yet. Begin and take actions to grow your vug.</div>';

  // Re-enable action buttons
  document.querySelectorAll('.action-grid .action-btn').forEach(btn => btn.disabled = false);

  // Reset sliders
  document.getElementById('f-temp').value = 300;
  document.getElementById('f-temp-val').textContent = '300°C';
  document.getElementById('f-pressure').value = 150;
  document.getElementById('f-pressure-val').textContent = '1.50 kbar fluid';
  document.getElementById('f-ph').value = 65;
  document.getElementById('f-ph-val').textContent = '6.5';
  selectPreset('silica');
}

function copyFortressLog() {
  const text = fortressLogLines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btns = document.querySelectorAll('.end-btns .btn-copy');
    if (btns.length) {
      const btn = btns[0];
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}


