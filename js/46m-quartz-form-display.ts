// C: consume finalized quartz observations, never infer physical face velocities.
// Scope and exclusions: proposals/QUARTZ-RECONCILIATION-2026-10-23.md.
const QUARTZ_FORM_DISPLAY_FIELDS = [
  'mineral', 'habit', 'dominant_forms', 'twinned', 'twin_law', '_polymorph',
  'mineral_display', 'growth_environment', '_sceptre', '_gwindel',
  'enclosed_by','cdr_replaces_crystal_id','dissolved','perimorph_eligible',
  '_nucTilt',
];
const QUARTZ_FORM_DISPLAY_HABITS = new Set([
  'prismatic', 'doubly_terminated', 'scepter overgrowth possible', 'scepter_overgrowth', 'gwindel',
]);

// Geometry variation is source-scoped; picking and enclosure still use display IDs.
// Numeric source IDs preserve the existing renderer's deterministic appearance.
function crystalRenderSeed(crystal: any): number {
  // Keep every other mineral's existing ID/coercion behavior unchanged.
  if(crystal?.mineral!=='quartz'&&!crystal?._quartzFormHistory&&!crystal?._quartzFormRender)return crystal?.crystal_id||0;
  const id = crystal?._quartzFormRender?.source_crystal_id ?? crystal?.crystal_id ?? 0;
  if (typeof id === 'number') return id;
  let hash = 2166136261;
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function quartzFormRenderProjection(source: any, topology: any, step: number): any {
  if (!source || (source.mineral !== 'quartz' && !source._quartzFormHistory)) return topology;
  const observation = quartzFormObservationAtStep(source, step);
  const status: any = { status: 'legacy-current-form', reason: observation.reason,
    cursor_step: step, source_crystal_id: source._collectionSourceHistory?.crystal_id ?? source.crystal_id };
  const projected = { ...topology, _quartzFormRender: status };
  if (observation.status !== 'recorded') return projected;
  const snapshot = observation.snapshot;
  Object.assign(status, { observation_step: observation.observation_step,
    observation_basis: observation.observation_basis, observed_habit: snapshot.habit ?? null });
  let reason: string | null = null;
  if (snapshot.split_presence === 'present') reason = 'split-parameters-not-recorded';
  else if (snapshot.surface_growth_presence === 'present') reason = 'surface-fabric-parameters-not-recorded';
  else if (snapshot.growth_environment !== 'fluid') reason = 'outside-fluid-growth-envelope';
  else if (snapshot.twinned !== false) reason = 'twinned-or-unknown-twin-state';
  else if (!QUARTZ_FORM_DISPLAY_HABITS.has(snapshot.habit)) reason = 'habit-outside-reviewed-routes';
  else if ((snapshot.habit === 'gwindel' && !snapshot._gwindel)
      || (snapshot.habit === 'scepter_overgrowth' && !snapshot._sceptre && !snapshot._gwindel)) reason = 'missing-special-form-parameters';
  else if (snapshot._polymorph && snapshot._polymorph !== 'alpha-quartz') reason = 'polymorph-outside-reviewed-routes';
  else if(!['enclosed_by','cdr_replaces_crystal_id','dissolved','perimorph_eligible'].every(k=>Object.hasOwn(snapshot,k))) reason='topology-scope-not-recorded';
  else if (snapshot.dissolved && snapshot.perimorph_eligible) reason = 'cast-boundary-form-unavailable';
  else if (snapshot.enclosed_by != null) reason = 'enclosed-host-form-not-supported';
  // CDR parent identity is assigned at nucleation. Its parent's form is not in
  // this crystal's ledger. A collection preserves that pointer source-scoped.
  else if (snapshot.cdr_replaces_crystal_id != null) reason = 'parent-form-inheritance-unavailable';
  if (reason) { status.reason = reason; return projected; }

  for (const key of QUARTZ_FORM_DISPLAY_FIELDS) {
    delete projected[key];
    if (Object.hasOwn(snapshot, key)) projected[key] = snapshot[key];
  }
  // Scope witnesses establish absence/null, not future split/fabric parameters.
  for (const [field, witness] of [['_split', 'split_presence'], ['_surfaceGrowth', 'surface_growth_presence']]) {
    delete projected[field];
    if (snapshot[witness] === 'null') projected[field] = null;
  }
  // These generic hooks have no dated quartz authority. Withhold them uniformly,
  // including when currently absent, so a later classifier cannot change the past.
  for (const key of ['_occlusion', '_sectorZoned', '_polarAxis', '_wulffForm', '_deformation']) delete projected[key];
  // A bend can be assigned late when current growth crosses DEFORM_MIN_UM, yet
  // carry an earlier event's atStep. That date does not record first application.
  // Uniformly withhold it here, including when it has not yet been assigned.
  // Never borrow a live cache with later parameters (or retain geometry on a
  // short-lived projection). Supported specials use the scene cache below.
  for (const key of Object.keys(projected)) if (/^_(gwindel|sceptre|bent)Geom/.test(key)) delete projected[key];
  Object.assign(status, { status: 'recorded-form-selection', reason: null,
    route: snapshot._gwindel ? 'gwindel' : snapshot._sceptre ? 'sceptre'
      : snapshot.habit === 'doubly_terminated' ? 'double-prism' : 'r4-prism',
    withheld: ['undated-attachment-depth', 'neighbour-shape-contact-clipping', 'unrecorded-sector-or-polar-overprints', 'unrecorded-deformation-application-time'],
    geometry_basis: 'morphology-display-model-not-physical-growth-fronts',
    dimension_basis:'signed-zone-length-with-habit-display-aspect-not-a-saved-solid',
    material_basis:'existing-display-color-not-a-historical-composition-reconstruction',
    placement_basis: source._collectionSourceHistory ? 'isolated-specimen-display-placement' : 'source-anchor-and-nucleation-axis',
  });
  status.signature = JSON.stringify([status, snapshot]);
  return projected;
}

function quartzFormDisplayText(status: any): string {
  if (!status) return '';
  if (status.status === 'recorded-form-selection') {
    const names = { 'r4-prism': 'prism', 'double-prism': 'doubly terminated prism', sceptre: 'sceptre', gwindel: 'gwindel' };
    return `Form selected from step ${status.observation_step} observation (${names[status.route] || 'quartz'}). Shape, color, width and populations are representative display models. Unrecorded attachment depth, contact cuts and deformation are omitted.`;
  }
  const reasons = {
    'outside-observed-coverage': 'This step is outside the recorded period.',
    'split-parameters-not-recorded': 'Split growth is not covered by this record.',
    'surface-fabric-parameters-not-recorded': 'Surface fabrics are not covered by this record.',
    'outside-fluid-growth-envelope': 'This growth environment is not covered.',
    'twinned-or-unknown-twin-state': 'This twin state is not covered.',
    'habit-outside-reviewed-routes': 'This habit is not covered.',
    'missing-special-form-parameters': 'The special form has an incomplete record.',
    'polymorph-outside-reviewed-routes': 'This silica structure is not covered.',
    'topology-scope-not-recorded':'Enclosure, replacement or cast scope was not recorded.',
    'cast-boundary-form-unavailable': 'The cast’s last solid form is unknown.',
    'enclosed-host-form-not-supported': 'The enclosing host’s earlier form is unavailable.',
    'parent-form-inheritance-unavailable': 'The parent’s form at replacement is unavailable.',
  };
  return `${reasons[status.reason] || 'No verified form record is available here.'} Showing the latest form as a display fallback.`;
}

function quartzFormCollectionText(crystal: any): string {
  if (crystal?.mineral !== 'quartz' && !crystal?._quartzFormHistory) return '';
  const history = crystal._quartzFormHistory;
  if (!history?.initial) return 'Quartz form history is unknown. This specimen has no dated form observations.';
  const step = history.unavailable ? Math.min(history.observed_through_step, history.unavailable.step - 1)
    : history.observed_through_step;
  if (quartzFormObservationAtStep(crystal, step).status !== 'recorded') {
    return 'Quartz form history cannot be validated for this specimen; its form chronology is unknown.';
  }
  const projected = quartzFormRenderProjection(crystal, crystal, step);
  return `Quartz form observations: steps ${history.initial.step}–${step}. `
    + quartzFormDisplayText(projected._quartzFormRender)
    + (history.unavailable ? ` Recording stops at step ${history.unavailable.step}; later form history is unknown.` : '')
    + ' This is a history summary; the Record Player displays growth zones. Observations record finalized simulator states, not measured face advance.';
}
