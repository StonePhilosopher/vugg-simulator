// ============================================================
// js/44e-weathering-epilogue.ts — executed weathering histories
// ============================================================
//
// A scenario may declare a `weathering_epilogue` only when it can state the
// physical boundary conditions explicitly: drainage, O2, CO2, light, and the
// mineral inventory released by dissolution.  The declaration is not a final
// assemblage label.  These helpers make it an auditable, spatially resolved
// history consumed by the ordinary nucleation and growth engines.

const WEATHERING_PARENT_MINERALS: Record<string, string[]> = {
  erythrite: ['skutterudite', 'safflorite', 'cobaltite'],
  aragonite: ['skutterudite', 'safflorite', 'cobaltite'],
};

function weatheringEpilogueConfig(sim: any): any | null {
  const cfg = sim?.conditions?._scenario?.weathering_epilogue;
  return cfg && typeof cfg === 'object' ? cfg : null;
}

function validateWeatheringEpilogueConfig(cfg: any): any {
  const errors: string[] = [];
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return { valid: false, errors: ['weathering_epilogue must be an object'], normalized: null };
  }
  const objectField = (key: string): any => {
    const value = cfg[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${key} must be an object`);
      return {};
    }
    return value;
  };
  const nonempty = (value: any, path: string): string => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) errors.push(`${path} must be a nonempty string`);
    return normalized;
  };
  const finite = (value: any, path: string, minimum = 0): number | null => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized < minimum) {
      errors.push(`${path} must be finite and >= ${minimum}`);
      return null;
    }
    return normalized;
  };
  const step = (value: any, path: string): number | null => {
    const normalized = finite(value, path, 0);
    if (normalized != null && !Number.isInteger(normalized)) {
      errors.push(`${path} must be an integer step`);
      return null;
    }
    return normalized;
  };
  const optionalNote = (value: any, path: string): string | null => {
    if (value == null) return null;
    return nonempty(value, path);
  };
  const stringArray = (value: any, path: string, allowEmpty = true): string[] => {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return [];
    }
    if (!allowEmpty && value.length === 0) errors.push(`${path} must not be empty`);
    const normalized = value.map((entry, index) => nonempty(entry, `${path}[${index}]`));
    return [...new Set(normalized.filter(Boolean))];
  };
  const productMap = (value: any, path: string): Record<string, string[]> => {
    if (value == null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path} must be an object of product -> nonempty string array`);
      return {};
    }
    const normalized: Record<string, string[]> = {};
    for (const [rawProduct, entries] of Object.entries(value)) {
      const product = nonempty(rawProduct, `${path} product key`);
      const members = stringArray(entries, `${path}.${rawProduct}`, false);
      if (product) normalized[product] = members;
    }
    return normalized;
  };

  const drainage = objectField('drainage');
  const oxygen = objectField('oxygen');
  const co2 = objectField('co2');
  const light = objectField('light');
  const startStep = step(cfg.start_step, 'start_step');
  const endStep = step(cfg.end_step, 'end_step');
  if (startStep != null && endStep != null && endStep < startStep) {
    errors.push('end_step must be >= start_step');
  }
  const concentrationFactor = finite(
    drainage.concentration_factor, 'drainage.concentration_factor', Number.MIN_VALUE,
  );
  const targetResidualPpm = finite(oxygen.target_residual_ppm, 'oxygen.target_residual_ppm');
  const importedCarbonatePpm = finite(
    co2.imported_carbonate_ppm, 'co2.imported_carbonate_ppm',
  );
  if (typeof light.exposed !== 'boolean') {
    errors.push('light.exposed must be boolean');
  }
  if (cfg.localized_nucleation != null && typeof cfg.localized_nucleation !== 'boolean') {
    errors.push('localized_nucleation must be boolean when supplied');
  }
  const targetSurfaceHeightMm = drainage.target_surface_height_mm == null
    ? null
    : finite(drainage.target_surface_height_mm, 'drainage.target_surface_height_mm');
  const kind = nonempty(cfg.kind, 'kind');
  const drainageMode = nonempty(drainage.mode, 'drainage.mode');
  const oxygenMode = nonempty(oxygen.mode, 'oxygen.mode');
  const co2Mode = nonempty(co2.mode, 'co2.mode');
  const lightMode = nonempty(light.mode, 'light.mode');
  const trackedProducts = cfg.tracked_products == null
    ? [] : stringArray(cfg.tracked_products, 'tracked_products');
  const parentMinerals = productMap(cfg.parent_minerals, 'parent_minerals');
  const requiredReleasedSpecies = productMap(
    cfg.require_released_species, 'require_released_species',
  );
  let excludedOutcome: any = null;
  if (cfg.excluded_outcome != null) {
    if (typeof cfg.excluded_outcome !== 'object' || Array.isArray(cfg.excluded_outcome)) {
      errors.push('excluded_outcome must be an object');
    } else {
      excludedOutcome = {
        status: nonempty(cfg.excluded_outcome.status, 'excluded_outcome.status'),
        mineralization: nonempty(
          cfg.excluded_outcome.mineralization, 'excluded_outcome.mineralization',
        ),
        reason: nonempty(cfg.excluded_outcome.reason, 'excluded_outcome.reason'),
      };
    }
  }
  const drainageNote = optionalNote(drainage.note, 'drainage.note');
  const oxygenNote = optionalNote(oxygen.note, 'oxygen.note');
  const co2Note = optionalNote(co2.note, 'co2.note');
  const lightNote = optionalNote(light.note, 'light.note');

  if (errors.length) return { valid: false, errors, normalized: null };
  return {
    valid: true,
    errors: [],
    normalized: {
      kind,
      start_step: startStep,
      end_step: endStep,
      localized_nucleation: cfg.localized_nucleation === true,
      tracked_products: trackedProducts,
      parent_minerals: parentMinerals,
      require_released_species: requiredReleasedSpecies,
      drainage: {
        mode: drainageMode,
        concentration_factor: concentrationFactor,
        ...(drainageNote == null ? {} : { note: drainageNote }),
        ...(targetSurfaceHeightMm == null
          ? {} : { target_surface_height_mm: targetSurfaceHeightMm }),
      },
      oxygen: {
        mode: oxygenMode,
        target_residual_ppm: targetResidualPpm,
        ...(oxygenNote == null ? {} : { note: oxygenNote }),
      },
      co2: {
        mode: co2Mode,
        imported_carbonate_ppm: importedCarbonatePpm,
        ...(co2Note == null ? {} : { note: co2Note }),
      },
      light: {
        mode: lightMode,
        exposed: light.exposed,
        ...(lightNote == null ? {} : { note: lightNote }),
      },
      ...(excludedOutcome == null ? {} : { excluded_outcome: excludedOutcome }),
    },
  };
}

function _weatheringBlockedProductsFromRaw(cfg: any): string[] {
  const products = new Set<string>(Object.keys(WEATHERING_PARENT_MINERALS));
  for (const key of ['require_released_species', 'parent_minerals']) {
    const value = cfg?.[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.keys(value).filter(Boolean).forEach(product => products.add(product));
    }
  }
  if (Array.isArray(cfg?.tracked_products)) {
    cfg.tracked_products.filter((value: any) => typeof value === 'string' && value.trim())
      .forEach((product: string) => products.add(product.trim()));
  }
  return [...products].sort();
}

function weatheringEpilogueActive(sim: any): boolean {
  const state = sim?._weatheringEpilogueState;
  if (!state?.valid || !state.config) return false;
  return sim.step >= state.startStep
    && (state.endStep == null || sim.step <= state.endStep);
}

function activateWeatheringEpilogueIfDue(sim: any): any | null {
  const rawCfg = weatheringEpilogueConfig(sim);
  if (!rawCfg) return null;
  const validation = validateWeatheringEpilogueConfig(rawCfg);
  const cfg = validation.normalized;
  const startStep = cfg?.start_step ?? null;
  if (validation.valid && sim.step < startStep) return null;
  if (sim._weatheringEpilogueState) return sim._weatheringEpilogueState;

  const state = {
    schema: 'weathering-epilogue-history-v2',
    scenarioId: sim?.conditions?._scenario?.id || null,
    kind: cfg?.kind || String(rawCfg.kind || 'invalid weathering declaration'),
    startStep,
    endStep: cfg?.end_step ?? null,
    valid: validation.valid,
    errors: [...validation.errors],
    config: cfg,
    blockedProducts: validation.valid ? [] : _weatheringBlockedProductsFromRaw(rawCfg),
    activation: {
      step: sim.step,
      temperatureC: Number(sim.conditions.temperature),
      pressureKbar: Number(sim.conditions.pressure),
      fluidSurfaceHeightMm: sim.conditions.fluid_surface_height_mm,
      drainageMode: cfg?.drainage.mode || null,
      oxygenMode: cfg?.oxygen.mode || null,
      co2Mode: cfg?.co2.mode || null,
      co2ImportedPpm: cfg?.co2.imported_carbonate_ppm ?? null,
      lightMode: cfg?.light.mode || null,
      lightExposed: cfg?.light.exposed ?? null,
    },
    timeline: [],
  };
  sim._weatheringEpilogueState = state;
  sim._weatheringHistory = state.timeline;

  if (!state.valid) {
    sim.log.push(
      `  ⛔ Weathering epilogue BLOCKED — ${state.errors.join('; ')}.`,
    );
    return state;
  }

  if (cfg.localized_nucleation === true) {
    sim.wall_state.per_vertex_nucleation = true;
    if (sim.conditions.wall) sim.conditions.wall.per_vertex_nucleation = true;
  }
  sim.log.push(
    `  ☁ Weathering epilogue begins — ${state.kind}; drainage=${cfg.drainage.mode}, `
    + `O₂=${cfg.oxygen.mode}, CO₂=${cfg.co2.mode}, light=${cfg.light.mode}.`,
  );
  return state;
}

function _weatheringRequiredReleaseSpecies(sim: any, mineral: string): string[] {
  const cfg = sim?._weatheringEpilogueState?.valid
    ? sim._weatheringEpilogueState.config : null;
  const listed = cfg?.require_released_species?.[mineral];
  return Array.isArray(listed) ? listed.map(String) : [];
}

function weatheringNucleationContext(sim: any, mineral: string): any {
  const state = sim?._weatheringEpilogueState;
  if (state && !state.valid && state.blockedProducts?.includes(mineral)) {
    return { required: true, eligible: false, reason: 'invalid-weathering-declaration',
      parent: null, localSigma: 0, released: {} };
  }
  // Before activation, validate the declaration read-only so scenario-specific
  // products cannot nucleate through the ordinary path before start_step.
  const rawCfg = !state ? weatheringEpilogueConfig(sim) : null;
  const preActivation = rawCfg ? validateWeatheringEpilogueConfig(rawCfg) : null;
  if (!state && preActivation && !preActivation.valid
      && _weatheringBlockedProductsFromRaw(rawCfg).includes(mineral)) {
    return { required: true, eligible: false, reason: 'invalid-weathering-declaration',
      parent: null, localSigma: 0, released: {} };
  }
  const cfg = state?.valid ? state.config
    : (preActivation?.valid ? preActivation.normalized : null);
  const requiredSpecies = _weatheringRequiredReleaseSpecies(sim, mineral);
  const declaredRequiredSpecies = requiredSpecies.length
    ? requiredSpecies : (Array.isArray(cfg?.require_released_species?.[mineral])
      ? cfg.require_released_species[mineral] : []);
  if (!cfg || !declaredRequiredSpecies.length) {
    return { required: false, eligible: true, parent: null, localSigma: null, released: {} };
  }
  const startStep = Number(cfg.start_step);
  const endStep = Number(cfg.end_step);
  const active = state ? weatheringEpilogueActive(sim)
    : (sim.step >= startStep && sim.step <= endStep);
  if (!active) {
    return { required: true, eligible: false, reason: 'outside-weathering-window',
      parent: null, localSigma: 0, released: {} };
  }
  const allowedParents = Array.isArray(cfg.parent_minerals?.[mineral])
    ? cfg.parent_minerals[mineral].map(String)
    : (WEATHERING_PARENT_MINERALS[mineral] || []);
  const candidates: any[] = [];
  for (const crystal of (sim.crystals || [])) {
    if (!allowedParents.includes(crystal.mineral)) continue;
    const released: Record<string, number> = {};
    let latestStep = -Infinity;
    for (const zone of (crystal.zones || [])) {
      if (!(zone && Number(zone.step) >= startStep && Number(zone.thickness_um) < 0)) continue;
      const returned = zone._returned_budget_inventory || {};
      for (const species of declaredRequiredSpecies) {
        released[species] = (released[species] || 0)
          + Math.max(0, Number(returned[species]) || 0);
      }
      latestStep = Math.max(latestStep, Number(zone.step) || 0);
    }
    if (!declaredRequiredSpecies.every(species => (released[species] || 0) > 0)) continue;
    const anchor = sim.wall_state?._resolveAnchor?.(crystal);
    const local = sim._localNucleationEvaluationAtAnchor?.(mineral, anchor);
    const sigmaCrit = Number(MINERAL_GATES_REGISTRY?.[mineral]?.sigma_crit);
    const localSigma = Number(local?.sigma) || 0;
    if (Number.isFinite(sigmaCrit) && !(localSigma > sigmaCrit)) continue;
    const releaseTotal = declaredRequiredSpecies.reduce(
      (sum, species) => sum + released[species], 0,
    );
    candidates.push({ crystal, released, latestStep, localSigma, releaseTotal });
  }
  candidates.sort((a, b) => b.latestStep - a.latestStep
    || b.releaseTotal - a.releaseTotal
    || a.crystal.crystal_id - b.crystal.crystal_id);
  const best = candidates[0];
  return best
    ? { required: true, eligible: true, reason: 'qualified-precursor', parent: best.crystal,
        localSigma: best.localSigma, released: best.released }
    : { required: true, eligible: false, reason: 'no-qualified-precursor',
        parent: null, localSigma: 0, released: {} };
}

function weatheringLightAtCrystal(sim: any, crystal: any, baseIsLit: boolean): boolean {
  const state = sim?._weatheringEpilogueState;
  const cfg = state?.valid ? state.config : null;
  if (!cfg || !weatheringEpilogueActive(sim)) return baseIsLit;
  if (cfg.light?.exposed !== true) return false;
  const anchor = sim.wall_state?._resolveAnchor?.(crystal);
  if (!anchor) return false;
  const chemistry = sim.wall_state.chemistryAddressForCrystal?.(crystal);
  if (!chemistry) return false;
  return sim.conditions.ringWaterState(chemistry.ringIdx, sim.wall_state.ring_count) === 'vadose';
}

function recordWeatheringEpilogueStep(sim: any): void {
  const state = sim?._weatheringEpilogueState;
  const cfg = state?.valid ? state.config : null;
  if (!cfg || !weatheringEpilogueActive(sim)) return;

  const nRings = sim.wall_state.ring_count;
  const drainageCounts = { submerged: 0, meniscus: 0, vadose: 0 };
  for (let r = 0; r < nRings; r++) {
    const key = sim.conditions.ringWaterState(r, nRings);
    drainageCounts[key]++;
  }
  const grid = sim.wall_state?.voxelGridFor?.(sim);
  const vadoseTemperatures = (grid?.voxels || [])
    .filter((voxel: any) => sim.conditions.ringWaterState(voxel.ringIdx, nRings) === 'vadose')
    .map((voxel: any) => Number(voxel.temperature))
    .filter((value: number) => Number.isFinite(value));
  const localTemperatureRangeC = vadoseTemperatures.length ? {
    scope: 'canonical vadose voxels',
    sampleCount: vadoseTemperatures.length,
    min: Math.min(...vadoseTemperatures),
    max: Math.max(...vadoseTemperatures),
    mean: vadoseTemperatures.reduce((sum: number, value: number) => sum + value, 0)
      / vadoseTemperatures.length,
  } : null;
  const boundary = (sim._vadoseExposureTransactions || [])
    .filter((tx: any) => tx.step === sim.step);
  const dissolution: any[] = [];
  const replacement: any[] = [];
  const trackedProducts = Array.isArray(cfg.tracked_products)
    ? cfg.tracked_products.map(String) : [];
  for (const crystal of (sim.crystals || [])) {
    for (const zone of (crystal.zones || [])) {
      if (Number(zone?.step) !== sim.step) continue;
      if (Number(zone.thickness_um) < 0) {
        dissolution.push({
          crystalId: crystal.crystal_id,
          mineral: crystal.mineral,
          mode: zone.dissolutionMode || null,
          thicknessUm: -Number(zone.thickness_um),
          returnedInventory: { ...(zone._returned_budget_inventory || {}) },
          massAccounting: 'accepted-shell LIFO return',
        });
      } else if (Number(zone.thickness_um) > 0 && trackedProducts.includes(crystal.mineral)) {
        replacement.push({
          crystalId: crystal.crystal_id,
          mineral: crystal.mineral,
          thicknessUm: Number(zone.thickness_um),
          position: crystal.position,
          bookedInventoryPerUm: { ...(zone._budget_inventory_per_um || {}) },
          coPartition: zone.co_partition ? { ...zone.co_partition } : null,
        });
      }
    }
  }
  state.timeline.push({
    step: sim.step,
    temperatureC: Number(sim.conditions.temperature),
    localTemperatureRangeC,
    pressureKbar: Number(sim.conditions.pressure),
    drainage: {
      mode: cfg.drainage.mode,
      fluidSurfaceHeightMm: sim.conditions.fluid_surface_height_mm,
      ringCounts: drainageCounts,
    },
    oxygen: {
      mode: cfg.oxygen.mode,
      targetResidualPpm: Number(cfg.oxygen.target_residual_ppm),
      transactions: boundary.map((tx: any) => ({ ...tx })),
    },
    co2: {
      mode: cfg.co2.mode,
      importedCarbonatePpm: Math.max(0, Number(cfg.co2.imported_carbonate_ppm) || 0),
      note: cfg.co2.note || null,
    },
    light: {
      mode: cfg.light.mode,
      exposed: cfg.light.exposed === true,
      exposedRingCount: cfg.light.exposed === true ? drainageCounts.vadose : 0,
    },
    dissolution,
    replacement,
    excludedOutcome: cfg.excluded_outcome ? { ...cfg.excluded_outcome } : null,
  });
}
