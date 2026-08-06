// ============================================================
// js/97b-ui-geology.ts — Creative geological history editors
// ============================================================
// Thin UI adapters over the existing MovementController, FluidSpotField, and
// post-growth directive models. The scientific state remains in those engines;
// these functions only parse controls and dispatch replayable fortress actions.

function toggleCreativeGeologyPanel() {
  const toggle = document.getElementById('creative-geology-toggle');
  const body = document.getElementById('creative-geology-body');
  toggle?.classList.toggle('open');
  body?.classList.toggle('open');
  populateCreativeMovementFields();
  refreshCreativeGeologyEditors();
}

function populateCreativeMovementFields() {
  const select = document.getElementById('creative-movement-field') as HTMLSelectElement | null;
  if (!select) return;
  if (!select.options.length) {
    const fields: Array<[string, string]> = [
      ['temperature', 'Temperature (°C)'],
      ['pressure', 'Fluid pressure (kbar)'],
      ['flow_rate', 'Flow rate'],
      ['porosity', 'Drainage porosity'],
      ['fluid_surface_height_mm', 'Water-surface mesh height'],
      ['fluid.Eh', 'Redox potential Eh (V)'],
    ];
    for (const prop of Object.keys(CREATIVE_CHEMISTRY_CONTROLS)) {
      fields.push([`fluid.${prop}`, `Fluid ${prop}`]);
    }
    for (const [value, label] of fields) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }
  const zoneSelect = document.getElementById('creative-zone-field') as HTMLSelectElement | null;
  if (zoneSelect && !zoneSelect.options.length) {
    for (const prop of Object.keys(CREATIVE_CHEMISTRY_CONTROLS)) {
      const option = document.createElement('option');
      option.value = prop;
      option.textContent = prop;
      zoneSelect.appendChild(option);
    }
    const eh = document.createElement('option');
    eh.value = 'Eh';
    eh.textContent = 'Eh (derived redox potential)';
    zoneSelect.appendChild(eh);
  }
}

function _creativeOptionalNumber(id: string): number | undefined {
  const raw = (document.getElementById(id) as HTMLInputElement | null)?.value?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeCreativeMovementSpec(payload: any, currentStep: number): any | null {
  if (!payload || typeof payload.field !== 'string') return null;
  const duration = Math.max(1, Math.floor(Number(payload.duration) || 1));
  const delay = Math.max(0, Math.floor(Number(payload.delay) || 0));
  const startStep = Number.isFinite(payload.startStep)
    ? Math.max(currentStep + 1, Math.floor(payload.startStep))
    : currentStep + delay + 1;
  const spec: any = {
    field: payload.field,
    startStep,
    endStep: startStep + duration,
    origin: payload.origin === 'cell' && payload.field.startsWith('fluid.') ? 'cell' : 'global',
  };
  const value = Number(payload.value);
  if (!Number.isFinite(value)) return null;
  if (payload.operator === 'mix') spec.mix = { to: value, ease: payload.ease !== false };
  else if (payload.operator === 'pulse') spec.ops = [{
    kind: 'pulse', amp: value,
    center: Number.isFinite(payload.center) ? Math.max(0, Math.min(1, payload.center)) : 0.5,
    width: Number.isFinite(payload.width) ? Math.max(0.001, payload.width) : 0.12,
  }];
  else if (payload.operator === 'step') spec.ops = [{
    kind: 'step', amp: value,
    at: Number.isFinite(payload.at) ? Math.max(0, Math.min(1, payload.at)) : 0.5,
    soften: Number.isFinite(payload.soften) ? Math.max(0.001, payload.soften) : 0.04,
  }];
  else spec.ops = [{ kind: 'trend', amp: value, ease: payload.ease !== false }];
  if (Number.isFinite(payload.clampMin)) spec.clampMin = payload.clampMin;
  if (Number.isFinite(payload.clampMax)) spec.clampMax = payload.clampMax;
  if (spec.field === 'pressure') {
    spec.clampMin = Math.max(FLUID_PRESSURE_MIN_KBAR, spec.clampMin ?? FLUID_PRESSURE_MIN_KBAR);
    spec.clampMax = Math.min(FLUID_PRESSURE_MAX_KBAR, spec.clampMax ?? FLUID_PRESSURE_MAX_KBAR);
  }
  if (Number.isFinite(payload.textureSigma) && payload.textureSigma > 0) {
    spec.texture = {
      sigma: payload.textureSigma,
      theta: Number.isFinite(payload.textureTheta)
        ? Math.max(0, Math.min(1, payload.textureTheta))
        : 0.35,
    };
  }
  return spec;
}

function creativeScheduleMovement() {
  if (!fortressSim || !fortressActive) return;
  const operator = (document.getElementById('creative-movement-operator') as HTMLSelectElement | null)?.value || 'trend';
  const payload: any = {
    field: (document.getElementById('creative-movement-field') as HTMLSelectElement | null)?.value,
    operator,
    delay: _creativeOptionalNumber('creative-movement-delay') ?? 0,
    duration: _creativeOptionalNumber('creative-movement-duration') ?? 20,
    value: _creativeOptionalNumber('creative-movement-value'),
    origin: (document.getElementById('creative-movement-origin') as HTMLSelectElement | null)?.value || 'global',
    clampMin: _creativeOptionalNumber('creative-movement-min'),
    clampMax: _creativeOptionalNumber('creative-movement-max'),
    textureSigma: _creativeOptionalNumber('creative-movement-sigma'),
    textureTheta: _creativeOptionalNumber('creative-movement-theta'),
    center: (_creativeOptionalNumber('creative-movement-center') ?? 50) / 100,
    width: (_creativeOptionalNumber('creative-movement-width') ?? 12) / 100,
    at: (_creativeOptionalNumber('creative-movement-center') ?? 50) / 100,
  };
  fortressStep('schedule_movement', payload);
}

function creativeConfigureFeeders() {
  if (!fortressSim || !fortressActive) return;
  const kind = (document.getElementById('creative-feeder-kind') as HTMLSelectElement | null)?.value || 'crack';
  const supply = _creativeOptionalNumber('creative-feeder-supply');
  const decayBonus = _creativeOptionalNumber('creative-feeder-erosion');
  const cellsText = (document.getElementById('creative-feeder-cells') as HTMLInputElement | null)?.value || '';
  const cells = cellsText.split(',').map(v => Number(v.trim())).filter(Number.isFinite);
  const payload: any = {
    count: Math.max(0, Math.floor(_creativeOptionalNumber('creative-feeder-count') ?? 2)),
    kinds: [kind],
    deposition: (document.getElementById('creative-feeder-deposition') as HTMLSelectElement | null)?.value === '1',
  };
  if (cells.length) {
    payload.spots = cells.map(cell => ({ cell, kind, supply, decayBonus, open: true }));
  }
  fortressStep('configure_feeders', payload);
}

function creativeToggleFeeders(action: 'seal' | 'breach') {
  const kind = (document.getElementById('creative-feeder-toggle-kind') as HTMLSelectElement | null)?.value || '';
  fortressStep('toggle_feeders', { action, kind: kind || null });
}

function applyCreativeZoneChemistry(sim: any, payload: any): number {
  if (!sim || !payload) return 0;
  const zone = ['floor', 'wall', 'ceiling'].includes(payload.zone) ? payload.zone : null;
  const field = String(payload.field || '');
  if (!zone || typeof sim.conditions.fluid[field] !== 'number') return 0;
  const clearing = payload.clear === true;
  const value = Number(payload.value);
  if (!clearing && !Number.isFinite(value)) return 0;

  const wall = sim.conditions.wall;
  sim._creativeZoneBaselines ||= {};
  const baselineKey = `${zone}.${field}`;
  if (!clearing && !(baselineKey in sim._creativeZoneBaselines)) {
    sim._creativeZoneBaselines[baselineKey] = sim.conditions.fluid[field];
  }
  wall.zone_chemistry ||= {};
  wall.zone_chemistry[zone] ||= {};
  if (clearing) delete wall.zone_chemistry[zone][field];
  else wall.zone_chemistry[zone][field] = value;
  if (!Object.keys(wall.zone_chemistry[zone]).length) delete wall.zone_chemistry[zone];
  if (!Object.keys(wall.zone_chemistry).length) wall.zone_chemistry = null;

  const target = clearing && Number.isFinite(sim._creativeZoneBaselines[baselineKey])
    ? sim._creativeZoneBaselines[baselineKey]
    : clearing ? sim.conditions.fluid[field] : value;
  if (clearing) delete sim._creativeZoneBaselines[baselineKey];
  let changed = 0;
  const mesh = sim.wall_state.meshFor(sim);
  const columns = sim.wall_state.cells_per_ring;
  for (let ring = 0; ring < sim.wall_state.ring_count; ring++) {
    if (sim.wall_state.ringOrientation(ring) !== zone) continue;
    if (sim.ring_fluids[ring] && typeof sim.ring_fluids[ring][field] === 'number') {
      sim.ring_fluids[ring][field] = target;
    }
    for (let column = 0; column < columns; column++) {
      const cell = mesh?.cells?.[ring * columns + column];
      if (cell?.fluid && typeof cell.fluid[field] === 'number') {
        cell.fluid[field] = target;
        changed++;
      }
    }
  }
  const spatial = !!wall.zone_chemistry;
  wall.per_vertex_nucleation = spatial;
  sim.wall_state.per_vertex_nucleation = spatial;
  return changed;
}

function creativeSetZoneChemistry(clear = false) {
  const payload = {
    zone: (document.getElementById('creative-zone-name') as HTMLSelectElement | null)?.value,
    field: (document.getElementById('creative-zone-field') as HTMLSelectElement | null)?.value,
    value: _creativeOptionalNumber('creative-zone-value'),
    clear,
  };
  fortressStep('set_zone_chemistry', payload);
}

function _creativeMineralFilter(): string[] | null {
  const text = (document.getElementById('creative-process-minerals') as HTMLInputElement | null)?.value || '';
  const minerals = text.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  return minerals.length ? minerals : null;
}

function creativeApplyDeformation() {
  fortressStep('apply_deformation', {
    style: (document.getElementById('creative-deformation-style') as HTMLSelectElement | null)?.value || 'bend',
    magnitude: _creativeOptionalNumber('creative-deformation-magnitude') ?? 0.5,
    minerals: _creativeMineralFilter(),
  });
}

function creativeApplyStressPulse() {
  fortressStep('stress_pulse', {
    sigmaDiffMpa: _creativeOptionalNumber('creative-stress-mpa') ?? 50,
  });
}

function creativeApplyEtch() {
  fortressStep('apply_etch', {
    style: (document.getElementById('creative-etch-style') as HTMLSelectElement | null)?.value || 'rounded',
    amount: _creativeOptionalNumber('creative-etch-amount') ?? 0.5,
    minerals: _creativeMineralFilter(),
  });
}

function creativeApplyFilm() {
  fortressStep('apply_film', {
    mineral: (document.getElementById('creative-film-mineral') as HTMLInputElement | null)?.value || 'chlorite',
    prism: _creativeOptionalNumber('creative-film-prism') ?? 0.3,
    term: _creativeOptionalNumber('creative-film-term') ?? 0.3,
    minerals: _creativeMineralFilter(),
  });
}

function refreshCreativeGeologyEditors() {
  if (!fortressSim) return;
  const movementEl = document.getElementById('creative-movement-list');
  if (movementEl) {
    const movements = fortressSim.conditions._scenario?.movements || [];
    movementEl.textContent = movements.length
      ? movements.map((m, i) => `${i + 1}. ${m.field} · steps ${m.startStep}–${m.endStep - 1} · ${m.origin || 'global'}`).join('\n')
      : 'No scheduled trajectories.';
  }
  const feederEl = document.getElementById('creative-feeder-list');
  if (feederEl) {
    const spots = fortressSim._fluidSpots?.spots || [];
    feederEl.textContent = spots.length
      ? spots.map((s, i) => `${i + 1}. cell ${s.cell} · ${s.kind} · ${s.open ? 'open' : 'sealed'} · supply ${s.supply.toFixed(2)} · erosion ${s.decayBonus.toFixed(2)}`).join('\n')
      : 'No point feeders; cavity is uniformly bathed.';
  }
  const zoneEl = document.getElementById('creative-zone-list');
  if (zoneEl) {
    const zones = fortressSim.conditions.wall.zone_chemistry || {};
    const lines: string[] = [];
    for (const [zone, fields] of Object.entries(zones)) {
      for (const [field, value] of Object.entries(fields as Record<string, any>)) {
        lines.push(`${zone}.${field} = ${value}`);
      }
    }
    zoneEl.textContent = lines.length ? lines.join('\n') : 'No spatial chemistry overrides.';
  }
}
