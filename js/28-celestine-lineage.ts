// Celestine growth with memory. These receipts observe the existing engine;
// they do not supply a Ba partition coefficient or a new morphology law.
// In particular Crystal.habit remains the legacy NUMERICAL classifier input
// (volume, splitting, coverage). It is not this lineage's scientific identity.
// See proposals/ELMWOOD-CELESTINE-LINEAGE.md for the authority boundary.

function _celestineFrozenCopy(value: any): any {
  if (value == null || typeof value !== 'object') return value;
  const copy = Array.isArray(value) ? value.map(_celestineFrozenCopy)
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, _celestineFrozenCopy(item)]));
  return Object.freeze(copy);
}

// Imported Library records are data, not authenticated simulation evidence.
// Validate fields consumed by history readers before making them available.
function assertCelestineGrowthHistory(history: any, step: number, zoneIndex: number): void {
  const fail = () => { throw new Error('Library specimen has invalid celestine history'); };
  if (history?.schema !== 'celestine-growth-history-v1' || history.step !== step
      || history.zone_index !== zoneIndex || !Number.isSafeInteger(history.crystal_id)
      || !Number.isSafeInteger(history.nucleation_step)) fail();
  const m = history.morphology, s = history.end_of_step;
  const habits = ['fibrous_blanket', 'nodular', 'fibrous', 'bladed', 'tabular'];
  if (!m || !['unresolved', 'procedural-approximation'].includes(m.status)
      || !habits.includes(m.display_habit) || !habits.includes(m.legacy_classifier_habit)
      || !Array.isArray(m.display_forms) || m.display_forms.length > 4
      || m.display_forms.some((f: any) => typeof f !== 'string' || f.length > 512)
      || m.solid_Ba_mole_fraction !== null || m.solid_Ba_status !== 'incorporation-not-modeled') fail();
  if (!s || !['aggregate', 'individual'].includes(s.extent_kind)) fail();
  for (const key of ['c_length_mm', 'a_width_mm', 'volume_mm3', 'total_growth_um']) {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < 0) fail();
  }
  if (s.split != null && (typeof s.split !== 'object'
      || !Number.isFinite(s.split.index) || s.split.index < 0 || s.split.index > 1)) fail();
  if (s.surface_growth != null && (typeof s.surface_growth !== 'object'
      || Array.isArray(s.surface_growth))) fail();
}

function celestineGrowthHistoryAtStep(crystal: any, step = Infinity): any | null {
  if (crystal?.mineral !== 'celestine') return null;
  const zones = crystal.zones || [];
  for (let i = zones.length - 1; i >= 0; i--) {
    if (zones[i].step > step) continue;
    // Missing history is not permission to substitute a later/final habit.
    return zones[i].celestine_history || null;
  }
  return null;
}

function recordCelestineNucleation(crystal: any, conditions: any, local: any): void {
  if (crystal.mineral !== 'celestine') return;
  crystal.celestine_origin = _celestineFrozenCopy({
    schema: 'celestine-lineage-origin-v1',
    crystal_id: crystal.crystal_id, nucleation_step: crystal.nucleation_step,
    mineral: 'celestine', position: crystal.position,
    initial_habit_variant: crystal.habit,
    habit_authority: 'procedural-nucleation-variant-not-a-lifetime-form',
    conditions: { ...celestineFluidEvidence({ ...conditions,
      fluid: local?.fluid || {}, temperature: local?.temperatureC,
    }, local?.sigma), basis: 'local-nucleation-input' },
  });
}

function celestineFluidEvidence(conditions: any, sigma: number): any {
  const fluid = conditions?.fluid || {};
  const finite = (v: any) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  return _celestineFrozenCopy({
    basis: 'local-engine-input-before-accepted-growth-budget',
    temperature_C: finite(conditions?.temperature),
    supersaturation_proxy: finite(sigma),
    wall_composition: conditions?.wall?.composition || null,
    Ba_ppm: finite(fluid.Ba), Sr_ppm: finite(fluid.Sr),
    S_ppm: finite(fluid.S), Mn_ppm: finite(fluid.Mn),
    pH: finite(fluid.pH), salinity: finite(fluid.salinity),
  });
}

function celestineGrowthInterpretation(crystal: any, classified: any): any {
  const previous = celestineGrowthHistoryAtStep(crystal);
  const inheritedBlanket = previous?.morphology.display_habit === 'fibrous_blanket';
  // A later return of the fluid ratio cannot retroactively resolve the
  // intervening material either. Only a future supported model can do that.
  const unresolved = previous?.morphology.status === 'unresolved'
    || (inheritedBlanket && classified.habit !== 'fibrous_blanket');
  const habit = inheritedBlanket ? 'fibrous_blanket' : classified.habit;
  return _celestineFrozenCopy({
    status: unresolved ? 'unresolved' : 'procedural-approximation',
    reason: unresolved ? 'no-solid-composition-or-morphology-transition-model'
      : 'fluid-context-recognizer-not-a-growth-form-law',
    display_habit: habit,
    // No claim that fluid Ba was incorporated into this solid.
    display_forms: habit === 'fibrous_blanket'
      ? ['plumose white celestine blanket (locality analogy)']
      : [`${habit} celestine (procedural approximation)`],
    legacy_classifier_habit: classified.habit,
    solid_Ba_mole_fraction: null,
    solid_Ba_status: 'incorporation-not-modeled',
  });
}

// Called after accepted growth and end-of-step morphology tagging, before
// strip testimony. Rejected/dry-run zones never enter crystal.zones and so
// cannot acquire a formation receipt. Older receipts are never rewritten.
function recordCelestineGrowthStep(sim: any): void {
  for (const crystal of sim.crystals || []) {
    if (crystal.mineral !== 'celestine') continue;
    const zones = crystal.zones || [];
    for (let i = zones.length - 1; i >= 0; i--) {
      const zone = zones[i];
      if (zone.step !== sim.step) break;
      if (zone.celestine_history || !zone.celestine_growth_conditions) continue;
      zone.celestine_history = _celestineFrozenCopy({
        schema: 'celestine-growth-history-v1',
        crystal_id: crystal.crystal_id,
        nucleation_step: crystal.nucleation_step,
        step: zone.step, zone_index: i,
        fluid: zone.celestine_growth_conditions,
        morphology: zone.celestine_growth_interpretation,
        accounting: {
          authority: 'legacy-procedural-envelope-not-resolved-surface',
          habit: crystal.habit, aspect_ratio: zone.aspect_ratio,
          formula_stoichiometry: zone.formula_stoichiometry || null,
          solid_solution: zone.solid_solution || null,
        },
        // Exact observation of the model at this step, not a claim that these
        // ellipsoid dimensions or aggregate fabrics are measured geology.
        end_of_step: {
          c_length_mm: crystal.c_length_mm, a_width_mm: crystal.a_width_mm,
          volume_mm3: crystal._volume_mm3, total_growth_um: crystal.total_growth_um,
          extent_kind: crystal.extent_kind,
          split: crystal._split || null,
          surface_growth: crystal._surfaceGrowth || null,
        },
      });
      delete zone.celestine_growth_conditions;
      delete zone.celestine_growth_interpretation;
    }
  }
}

function celestinePresentationSim(sim: any, step = Infinity): any {
  if (!sim?.crystals?.some((c: any) => c?.mineral === 'celestine')) return sim;
  const view = Object.create(sim);
  view.crystals = sim.crystals
    .filter((c: any) => c?.mineral !== 'celestine' || !(c.nucleation_step > step))
    .map((c: any) => celestinePresentation(c, step));
  return view;
}

// A view is disposable. It must never be fed back into any growth calculation.
// Unsupported later material is accounted for, but cannot license a new outer
// shape. Show the last classified blanket with an explicit unresolved notice.
function celestinePresentation(crystal: any, step = Infinity): any {
  if (crystal?.mineral !== 'celestine') return crystal;
  const latest = celestineGrowthHistoryAtStep(crystal, step);
  if (!latest) return Object.assign(Object.create(Object.getPrototypeOf(crystal)), crystal, {
    celestine_morphology_status: 'history-unavailable',
    celestine_disclosure: 'Celestine: historical form unavailable; legacy display approximation. Solid Ba incorporation is not modeled.',
  });
  let shown = latest;
  if (latest.morphology.status === 'unresolved') {
    for (let i = latest.zone_index - 1; i >= 0; i--) {
      const candidate = crystal.zones[i].celestine_history;
      if (candidate?.morphology.display_habit === 'fibrous_blanket'
          && candidate.morphology.status !== 'unresolved') { shown = candidate; break; }
    }
  }
  const state = shown.end_of_step;
  const disclosure = latest.morphology.status === 'unresolved'
    ? `Celestine: showing the blanket approximation recorded at step ${shown.step}; later morphology unresolved. Growth continues; solid Ba incorporation is not modeled.`
    : 'Celestine form is a procedural approximation; fluid Ba does not establish solid Ba incorporation.';
  return Object.assign(Object.create(Object.getPrototypeOf(crystal)), crystal, {
    habit: shown.morphology.display_habit,
    dominant_forms: [...shown.morphology.display_forms],
    c_length_mm: state.c_length_mm, a_width_mm: state.a_width_mm,
    total_growth_um: state.total_growth_um, _volume_mm3: state.volume_mm3,
    extent_kind: state.extent_kind,
    _split: state.split, _surfaceGrowth: state.surface_growth,
    celestine_disclosure: disclosure,
    celestine_morphology_status: latest.morphology.status,
    celestine_presentation_step: shown.step,
  });
}

function celestineMorphologyDescription(crystal: any, step = Infinity): string | null {
  if (crystal?.mineral !== 'celestine') return null;
  const view = celestinePresentation(crystal, step);
  const latest = celestineGrowthHistoryAtStep(crystal, step);
  const dimensions = latest?.end_of_step || crystal;
  return `${view.habit} [${(view.dominant_forms || []).join(', ')}]; ${view.celestine_disclosure}`
    + ` Approximate model dimensions ${dimensions.c_length_mm.toFixed(2)} × ${dimensions.a_width_mm.toFixed(2)} mm (not a resolved external form).`;
}
