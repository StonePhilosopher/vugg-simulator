// ============================================================
// js/97b-ui-sigma-panel.ts — Saturation panel filters + per-class group renderer
// ============================================================
// _satShowNucleating / _satShowDormant filter state, _onSatFilterToggle, _renderFortressSigmaGroups, _wireFortressSigmaEvents — used by Creative-mode and any other mode that shows the σ-by-class pill panel.
//
// Phase B18 of PROPOSAL-MODULAR-REFACTOR. Lifted out of
// 97-ui-fortress.ts.

// Filter state — both default on. Filters compare each pill against
// that mineral's registered sigma_crit (not a universal σ=1 shortcut).
// A class group with no surviving pills hides entirely so the panel
// doesn't waste a row on an empty section.
let _satShowNucleating = true;
let _satShowDormant = true;

function _satSigmaCrit(name: string): number {
  const gate = (typeof MINERAL_GATES_REGISTRY !== 'undefined')
    ? MINERAL_GATES_REGISTRY[name]
    : null;
  return gate && Number.isFinite(gate.sigma_crit) ? gate.sigma_crit : 1.0;
}

function _satEsc(s: any): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function _onSatFilterToggle() {
  const a = document.getElementById('sat-filter-nucleating');
  const b = document.getElementById('sat-filter-dormant');
  _satShowNucleating = a ? a.checked : true;
  _satShowDormant = b ? b.checked : true;
  if (typeof fortressSim !== 'undefined' && fortressSim) {
    _renderFortressSigmaGroups(fortressSim.conditions, document.getElementById('f-sat-bar'));
  }
}

// The conditions object the panel last rendered — the nucleation hover
// popover evaluates its red/green chips against THIS, not the live sim,
// so hovering during a topo replay scrub shows that moment's truth
// (matching how the pills themselves rewind — v66 replay-aware).
let _satLastConditions = null;
let _satLastSim = null;

function _renderFortressSigmaGroups(c, host) {
  if (!host) return;
  _satLastConditions = c;
  _satLastSim = (typeof fortressSim !== 'undefined' && fortressSim && fortressSim.conditions === c)
    ? fortressSim
    : null;
  if (typeof _satHoverHide === 'function') _satHoverHide(); // re-render orphans any floating popover
  host.innerHTML = '';
  if (typeof MINERAL_SPEC === 'undefined') return;
  // Walk every mineral in the spec; keep those that have a
  // `supersaturation_<name>` method on the conditions object.
  const byClass = {};
  for (const [name, spec] of Object.entries(MINERAL_SPEC)) {
    const fn = c[`supersaturation_${name}`];
    if (typeof fn !== 'function') continue;
    let sigma;
    try { sigma = fn.call(c); } catch (e) { continue; }
    if (typeof sigma !== 'number' || !isFinite(sigma)) continue;
    const cls = spec.class || 'uncategorized';
    const displayName = _SAT_DISPLAY_NAMES[name]
      || (name.charAt(0).toUpperCase() + name.slice(1));
    if (!byClass[cls]) {
      byClass[cls] = {
        entries: [],
        maxSigma: -Infinity,
        color: spec.class_color || '#888',
      };
    }
    const threshold = _satSigmaCrit(name);
    const ratio = threshold > 0 ? sigma / threshold : sigma;
    byClass[cls].entries.push({ name, displayName, sigma, threshold, ratio });
    if (ratio > byClass[cls].maxSigma) byClass[cls].maxSigma = ratio;
  }
  // Order: active classes (any σ > its mineral's sigma_crit) first,
  // sorted by the largest σ/σcrit ratio; then dormant classes by
  // TOPO_CLASS_ORDER, then alphabetically.
  const orderedClasses = Object.keys(byClass).sort((a, b) => {
    const aActive = byClass[a].maxSigma > 1;
    const bActive = byClass[b].maxSigma > 1;
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive) return byClass[b].maxSigma - byClass[a].maxSigma;
    const order = (typeof TOPO_CLASS_ORDER !== 'undefined') ? TOPO_CLASS_ORDER : [];
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
  for (const cls of orderedClasses) {
    const group = byClass[cls];
    // Apply filter: drop entries the user is currently hiding.
    const filtered = group.entries.filter(e => {
      const isSuper = e.sigma > e.threshold;
      return isSuper ? _satShowNucleating : _satShowDormant;
    });
    if (!filtered.length) continue;  // class hides entirely if all pills filtered out
    // Sort entries within group by σ descending so the "interesting
    // ones" are visually first.
    filtered.sort((a, b) => b.sigma - a.sigma);
    const isActive = group.maxSigma > 1;
    const maxLabel = Math.min(group.maxSigma, _SAT_DISPLAY_MAX);
    const meta = isActive
      ? `${filtered.length} · max ${maxLabel.toFixed(2)}× σcrit`
      : `${filtered.length}`;
    const summary = `<summary class="sat-class-summary" data-hl-class="${cls}">`
      + `<span class="sat-class-swatch" style="background:${group.color}"></span>`
      + `<span class="sat-class-name">${cls}</span>`
      + `<span class="sat-class-meta${isActive ? ' is-active' : ''}">${meta}</span>`
      + `</summary>`;
    const pills = filtered.map(e => {
      const isSuper = e.sigma > e.threshold;
      const klass = 'sat-indicator ' + (isSuper ? 'sat-super' : 'sat-under');
      // data-hl-mineral lets the panel double as the legend: hover
      // a pill → highlight that mineral on the topo (replaces the
      // legacy classes-tab hover behavior, which only highlighted
      // by class). The native title tooltip is gone (2026-07-08) —
      // the nucleation hover popover carries the state now, and a
      // browser tooltip would fight it.
      const label = `${e.displayName}: saturation ${e.sigma.toFixed(2)}, nucleation threshold ${e.threshold.toFixed(2)}. Focus for formation diagnosis.`;
      return `<button type="button" class="${klass}" data-hl-mineral="${_satEsc(e.name)}" data-sigma="${_satEsc(String(e.sigma))}" data-sigma-crit="${_satEsc(String(e.threshold))}" aria-label="${_satEsc(label)}">${_satEsc(e.displayName)} σ=${e.sigma.toFixed(2)}</button>`;
    }).join('');
    // All groups open by default. Filters do the visual reduction
    // now; collapsing groups was the pre-filter solution.
    const groupClass = `sat-class-group${isActive ? ' sat-class-active' : ''}`;
    host.insertAdjacentHTML('beforeend',
      `<details class="${groupClass}" open>${summary}<div class="sat-class-pills">${pills}</div></details>`);
  }
  // One-time wire-up of hover/click delegation on the panel.
  _wireFortressSigmaEvents(host);
}

// ============================================================
// NUCLEATION HOVER POPOVER (boss ask 2026-07-08)
// ============================================================
// Hovering a mineral pill shows WHY it is (or isn't) nucleating: the
// Library card's recipe rows rendered as red/green condition chips,
// evaluated against the conditions the panel last rendered (live play
// or a replay-scrub snapshot alike). Boss's actinolite sketch:
//
//   T window        [200–700°C (optimum 300–500)]
//   Requires        [Ca ≥60][Mg ≥30][Fe ≥30][SiO2 ≥250]
//   Traces          [Cr][Mn]
//   Acid dissolution [pH ≥ 5]
//
// The acid chip is deliberately REVERSED from the Library's wording
// (dissolves at pH < 5): here you're reading survival, not death —
// the chip states the condition under which the crystal keeps its
// faces, green when the broth is safe.

interface FormationDiagnosticChip {
  text: string;
  met: boolean;
  status?: 'met' | 'unmet' | 'uncertain' | 'observer';
  note?: string;
}

interface FormationDiagnosticGroup {
  label: string;
  chips: FormationDiagnosticChip[];
}

interface MineralFormationExplanation {
  name: string;
  sigma: number;
  sigmaCrit: number;
  chemistryEligible: boolean;
  substrateEligible: boolean;
  effectiveEligible: boolean;
  state: 'formed-supported' | 'formed-past' | 'eligible' | 'conditional' | 'blocked' | 'unknown';
  verdict: string;
  groups: FormationDiagnosticGroup[];
  history: { available: boolean; total: number; active: number; transformed: number; dissolved: number };
}

function _formationNumber(v: any, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(digits);
}

// Pressure is displayed only where it is a load-bearing part of this
// mineral's engine or a scientifically useful phase-field observation. A
// generic pressure chip would imply a universal multiplier that does not
// exist. The scalar is fluid pressure, never differential stress.
function _formationPressureChips(name: string, c: any): FormationDiagnosticChip[] {
  const pressure = Number(c?.pressure);
  const temperature = Number(c?.temperature);
  if (!Number.isFinite(pressure) || !Number.isFinite(temperature)) return [];

  if (name === 'apophyllite') {
    const factor = apophyllitePressureFactor(pressure);
    return [{
      text: `${pressure.toFixed(2)} kbar fluid · occurrence weight ×${factor.toFixed(2)}`,
      met: true,
      status: 'uncertain',
      note: 'Uncertain soft occurrence weighting, not a pass/fail stability boundary: no pressure penalty through 1.5 kbar, then a graded rarity weight that never hard-blocks nucleation.',
    }];
  }

  if (name === 'andalusite') {
    const assessment = al2sio5PhaseAssessment(
      temperature,
      c?.wall?.confining_pressure_kbar,
    );
    const rockPressure = assessment.confiningPressureKbar;
    const label = rockPressure == null
      ? 'rock pressure unspecified'
      : `${rockPressure.toFixed(2)} kbar rock`;
    const uncertain = assessment.phase === 'uncertain' || assessment.phase === 'unconstrained';
    return [{
      text: `${label} · ${assessment.phase} Al2SiO5 field`,
      met: assessment.phase === 'andalusite'
        || uncertain,
      status: uncertain ? 'uncertain' : undefined,
      note: `${assessment.note} Kyanite and sillimanite engines are not implemented; uncertain/unconstrained pressure therefore does not fabricate or hard-block a phase.`,
    }];
  }

  if ((name === 'aragonite' || name === 'calcite') && pressure >= 3.0) {
    const boundary = calciteAragoniteBoundaryKbar(temperature);
    const offset = pressure - boundary;
    const uncertain = Math.abs(offset) <= 1.0;
    const aragoniteStable = offset > 1.0;
    const expected = name === 'aragonite' ? aragoniteStable : !aragoniteStable;
    const calciteObserver = name === 'calcite' && !uncertain;
    return [{
      text: `${pressure.toFixed(2)} kbar fluid · calcite/aragonite boundary ${boundary.toFixed(2)} kbar`,
      met: calciteObserver || uncertain || expected,
      status: uncertain ? 'uncertain' : (calciteObserver ? 'observer' : undefined),
      note: uncertain
        ? 'Published Hacker et al. fit, inside its +/-1 kbar experimental uncertainty band: neither polymorph receives a red/green phase-field claim.'
        : `${calciteObserver ? 'Observer only, not a failed gameplay gate. ' : ''}Published Hacker et al. fit lies outside its +/-1 kbar uncertainty band and nominally favors ${aragoniteStable ? 'aragonite' : 'calcite'}. The calcite engine does not use this as an exclusion gate; below 3 kbar the separate Mg-kinetic shallow selector remains authoritative.`,
    }];
  }

  if (name === 'selenite' || name === 'anhydrite') {
    const boundary = gypsumAnhydriteBoundaryC(pressure);
    const stable = temperature < boundary ? 'gypsum' : 'anhydrite';
    const expected = name === 'selenite' ? 'gypsum' : 'anhydrite';
    return [{
      text: `${pressure.toFixed(2)} kbar fluid · ${stable} equilibrium field (boundary ${boundary.toFixed(0)}°C)`,
      met: true,
      status: 'observer',
      note: `Observer only, not a binary gameplay gate (nominal pure-water field favors ${stable}, while this row is ${expected}). Salinity shifts the boundary; empirical sulfate nucleation and anhydrite's independent kinetic floor drive gameplay.`,
    }];
  }

  return [];
}

// The gate registry is the canonical cross-mineral contract, but a few
// engines gate on a chemically active fraction rather than the raw fluid
// total. Resolve the two shared speciation cases here so a red reagent chip
// agrees with the value the supersaturation engine actually sees.
function _formationAvailableAmount(name: string, species: string, c: any): number {
  const f = c?.fluid || {};
  const spec = (typeof MINERAL_SPEC !== 'undefined') ? MINERAL_SPEC[name] : null;
  if (species === 'CO3' && typeof carbonateEngineAvailableCO3 === 'function') {
    try { return carbonateEngineAvailableCO3(name, f, c?.temperature); } catch (_e) { /* raw fallback below */ }
  }
  if (species === 'As' && spec?.class === 'arsenate' && typeof arsenateAvailablePpm === 'function') {
    try { return arsenateAvailablePpm(f); } catch (_e) { /* raw fallback below */ }
  }
  const raw = f[species];
  return (typeof raw === 'number' && Number.isFinite(raw)) ? raw : 0;
}

interface FormationCausalCounterfactual {
  field: string;
  from: number;
  to: number;
  sigma: number;
  clearsThreshold: boolean;
}

function _formationProductionSigma(name: string, c: any): number {
  const fn = c?.[`supersaturation_${name}`];
  if (typeof fn !== 'function') return 0;
  try {
    const value = Number(fn.call(c));
    return Number.isFinite(value) ? value : 0;
  } catch (_e) {
    return 0;
  }
}

function _formationCandidateValues(field: string, current: number): number[] {
  if (field === 'pH') return [0.5, 1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12, 13, 14];
  if (field === 'O2') return [0, 0.001, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 25, 50];
  if (field === 'temperature') return [0, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 300, 400, 500, 700, 900];
  if (field === 'pressure') return [0, 0.001, 0.1, 0.5, 1, 2, 4.4, 6, 10, 15, 20];
  return [
    0, current * 0.1, current * 0.25, current * 0.5,
    current * 2, current * 4, current * 10,
    0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000,
  ];
}

// Ask the production supersaturation method which one-lever changes would
// improve or clear the current result. A Proxy first records only the fields
// the engine actually reads; cloned counterfactuals then rerun that same method.
// This exposes handwritten blockers (ratios, suppressors, competing phases)
// without attempting to re-encode them in a second UI-only rules table.
function _formationCausalCounterfactuals(
  name: string,
  c: any,
  currentSigma: number,
  sigmaCrit: number,
): FormationCausalCounterfactual[] {
  const fn = c?.[`supersaturation_${name}`];
  if (typeof fn !== 'function' || !c?.fluid) return [];
  const fluidReads = new Set<string>();
  const conditionReads = new Set<string>();
  const traced = Object.assign(Object.create(Object.getPrototypeOf(c)), c);
  traced.fluid = new Proxy(c.fluid, {
    get(target, property, receiver) {
      if (typeof property === 'string' && typeof target[property] === 'number') fluidReads.add(property);
      return Reflect.get(target, property, receiver);
    },
  });
  const conditionProxy = new Proxy(traced, {
    get(target, property, receiver) {
      if (typeof property === 'string' && typeof target[property] === 'number') conditionReads.add(property);
      return Reflect.get(target, property, receiver);
    },
  });
  try { fn.call(conditionProxy); } catch (_e) { return []; }

  const probes: Array<{ field: string; scope: 'fluid' | 'conditions'; current: number }> = [];
  for (const field of fluidReads) {
    const current = Number(c.fluid[field]);
    if (Number.isFinite(current)) probes.push({ field, scope: 'fluid', current });
  }
  for (const field of conditionReads) {
    if (field === 'fluid') continue;
    const current = Number(c[field]);
    if (Number.isFinite(current)) probes.push({ field, scope: 'conditions', current });
  }

  const out: FormationCausalCounterfactual[] = [];
  for (const probe of probes) {
    let best: FormationCausalCounterfactual | null = null;
    const values = Array.from(new Set(_formationCandidateValues(probe.field, probe.current)
      .filter(value => Number.isFinite(value) && value >= 0 && value !== probe.current)));
    for (const value of values) {
      const candidate = Object.assign(Object.create(Object.getPrototypeOf(c)), c);
      candidate.fluid = { ...c.fluid };
      if (probe.scope === 'fluid') candidate.fluid[probe.field] = value;
      else candidate[probe.field] = value;
      const nextSigma = _formationProductionSigma(name, candidate);
      if (!(nextSigma > currentSigma + 1e-12)) continue;
      const row = {
        field: probe.field,
        from: probe.current,
        to: value,
        sigma: nextSigma,
        clearsThreshold: nextSigma > sigmaCrit,
      };
      if (!best
          || (row.clearsThreshold && !best.clearsThreshold)
          || (row.clearsThreshold === best.clearsThreshold && row.sigma > best.sigma)) best = row;
    }
    if (best) out.push(best);
  }
  return out
    .sort((a, b) => Number(b.clearsThreshold) - Number(a.clearsThreshold) || b.sigma - a.sigma)
    .slice(0, 4);
}

function _formationHistory(name: string, sim: any) {
  if (!sim || !Array.isArray(sim.crystals)) {
    return { available: false, total: 0, active: 0, transformed: 0, dissolved: 0, records: [] as any[] };
  }
  const records = sim.crystals.filter((cr: any) => cr
    && (cr.mineral === name || cr.paramorph_origin === name));
  return {
    available: true,
    total: records.length,
    active: records.filter((cr: any) => cr.mineral === name && cr.active && !cr.dissolved).length,
    transformed: records.filter((cr: any) => cr.mineral !== name && cr.paramorph_origin === name).length,
    dissolved: records.filter((cr: any) => cr.dissolved).length,
    records,
  };
}

function _formationSubstrate(name: string, sim: any) {
  const available: Array<{ mineral: string; count: number; discount: number; epitaxy: boolean; state: string }> = [];
  if (sim && Array.isArray(sim.crystals) && typeof engineExecutableSubstrateRoute === 'function') {
    const grouped = new Map<string, { count: number; discount: number; state: string }>();
    for (const cr of sim.crystals) {
      const route = engineExecutableSubstrateRoute(cr, name);
      if (!route.executable || !(route.discount < 1)) continue;
      const key = `${cr.mineral}|${route.label}`;
      const prior = grouped.get(key);
      grouped.set(key, {
        count: (prior?.count || 0) + 1,
        discount: prior ? Math.min(prior.discount, route.discount) : route.discount,
        state: route.label,
      });
    }
    for (const [key, row] of grouped) {
      const mineral = key.split('|')[0];
      available.push({
        mineral,
        count: row.count,
        discount: row.discount,
        epitaxy: typeof EPITAXY_PAIRS !== 'undefined' && EPITAXY_PAIRS.has(`${name}>${mineral}`),
        state: row.state,
      });
    }
    available.sort((a, b) => a.discount - b.discount || b.count - a.count || a.mineral.localeCompare(b.mineral));
  }
  return {
    available,
    bestDiscount: available.length ? available[0].discount : 1,
  };
}

function _formationCompetition(name: string, sigma: number, c: any, sim: any) {
  const mine = (typeof MINERAL_STOICHIOMETRY !== 'undefined') ? MINERAL_STOICHIOMETRY[name] : null;
  const competitors: Array<{ mineral: string; count: number; shared: string[] }> = [];
  if (mine && sim && Array.isArray(sim.crystals)) {
    const grouped = new Map<string, number>();
    for (const cr of sim.crystals) {
      if (!cr || !cr.active || cr.dissolved || cr.mineral === name) continue;
      grouped.set(cr.mineral, (grouped.get(cr.mineral) || 0) + 1);
    }
    for (const [mineral, count] of grouped) {
      const other = MINERAL_STOICHIOMETRY[mineral];
      if (!other) continue;
      const shared = Object.keys(mine).filter(sp => other[sp] != null);
      if (shared.length) competitors.push({ mineral, count, shared });
    }
    competitors.sort((a, b) => b.shared.length - a.shared.length || b.count - a.count || a.mineral.localeCompare(b.mineral));
  }

  let initiative: InitiativeResult | null = null;
  if (typeof computeInitiative === 'function') {
    const activeMinerals = [name, ...competitors.map(x => x.mineral)];
    try { initiative = computeInitiative(name, sigma, c, activeMinerals); } catch (_e) { initiative = null; }
  }
  return { competitors, initiative };
}

function _formationRedoxChip(gate: MineralGates | null, c: any): FormationDiagnosticChip {
  const f = c?.fluid || {};
  const hasMin = gate?.O2_min != null;
  const hasMax = gate?.O2_max != null;
  const ehMode = typeof EH_DYNAMIC_ENABLED !== 'undefined' && EH_DYNAMIC_ENABLED
    && typeof ehFromO2 === 'function';

  if (!hasMin && !hasMax) {
    const context = typeof f.Eh === 'number'
      ? `Eh ${_formationNumber(f.Eh, 0)} mV`
      : `O₂ ${_formationNumber(f.O2)} ppm`;
    return { text: `${context} · no explicit cutoff`, met: true };
  }

  if (ehMode) {
    const eh = (typeof f.Eh === 'number') ? f.Eh : 200;
    const lo = hasMin ? ehFromO2(gate!.O2_min!) : null;
    const hi = hasMax ? ehFromO2(gate!.O2_max!) : null;
    const met = (lo == null || eh >= lo) && (hi == null || eh <= hi);
    const need = lo != null && hi != null
      ? `${_formationNumber(lo, 0)}–${_formationNumber(hi, 0)} mV`
      : lo != null ? `≥ ${_formationNumber(lo, 0)} mV` : `≤ ${_formationNumber(hi, 0)} mV`;
    return {
      text: `Eh ${_formationNumber(eh, 0)} mV · needs ${need}`,
      met,
      note: 'Eh is the active redox control; O₂ thresholds in the mineral registry are converted through the engine redox calibration.',
    };
  }

  const o2 = (typeof f.O2 === 'number') ? f.O2 : 0;
  const met = (!hasMin || o2 >= gate!.O2_min!) && (!hasMax || o2 <= gate!.O2_max!);
  const need = hasMin && hasMax
    ? `${gate!.O2_min}–${gate!.O2_max} ppm`
    : hasMin ? `≥ ${gate!.O2_min} ppm` : `≤ ${gate!.O2_max} ppm`;
  return { text: `O₂ ${_formationNumber(o2)} ppm · needs ${need}`, met };
}

// Observer-only diagnosis. It reads the same supersaturation function,
// MINERAL_GATES_REGISTRY, stoichiometry, paragenesis, and initiative
// helpers as the engine. It deliberately never calls a nucleation engine
// or _atNucleationCap, because both may consume RNG.
function _buildMineralFormationExplanation(
  name: string,
  c: any,
  sim: any = null,
  sigmaOverride: number | null = null,
): MineralFormationExplanation | null {
  const spec = (typeof MINERAL_SPEC !== 'undefined') ? MINERAL_SPEC[name] : null;
  const gate: MineralGates | null = (typeof MINERAL_GATES_REGISTRY !== 'undefined')
    ? (MINERAL_GATES_REGISTRY[name] || null)
    : null;
  if (!spec || !c || !c.fluid) return null;

  let sigma = sigmaOverride;
  if (typeof sigma !== 'number' || !Number.isFinite(sigma)) {
    const fn = c[`supersaturation_${name}`];
    try { sigma = typeof fn === 'function' ? fn.call(c) : 0; } catch (_e) { sigma = 0; }
  }
  if (typeof sigma !== 'number' || !Number.isFinite(sigma)) sigma = 0;
  const sigmaCrit = gate && Number.isFinite(gate.sigma_crit) ? gate.sigma_crit : 1;
  const chemistryEligible = sigma > sigmaCrit;
  const history = _formationHistory(name, sim);
  const substrate = _formationSubstrate(name, sim);
  const assistedCrit = sigmaCrit * substrate.bestDiscount;
  const substrateEligible = !chemistryEligible && substrate.bestDiscount < 1 && sigma > assistedCrit;
  const effectiveEligible = chemistryEligible || substrateEligible;
  const competition = _formationCompetition(name, sigma, c, sim);
  const productionDecision = sim && sim.conditions === c
    && typeof assessProductionNucleationDecision === 'function'
    ? assessProductionNucleationDecision(name, sim, sigma, sigmaCrit)
    : null;
  const productionEligible = productionDecision?.available
    ? productionDecision.eligible
    : effectiveEligible;
  const groups: FormationDiagnosticGroup[] = [];

  const satChips: FormationDiagnosticChip[] = [{
    text: `σ ${_formationNumber(sigma)} · bare-wall σcrit ${_formationNumber(sigmaCrit)}`,
    met: chemistryEligible,
    note: 'This is the mineral engine\'s final supersaturation result after its thermodynamic, composition, and kinetic gates.',
  }];
  if ((name === 'rosasite' || name === 'aurichalcite')
      && typeof mixedCarbonateThermoAssessment === 'function') {
    const thermo = mixedCarbonateThermoAssessment(name, c.fluid, c.temperature);
    if (Number.isFinite(thermo.saturationIndex)) {
      satChips.push({
        text: `literature SI ${_formationNumber(thermo.saturationIndex)} · Tier ${thermo.confidence} observer`,
        met: thermo.saturationIndex > 0,
        status: 'observer',
        note: `${thermo.representativeComposition}; ${thermo.status}. ${thermo.uncertaintyNote} This diagnostic does not drive the empirical nucleation engine.`,
      });
    }
  }
  if (substrate.bestDiscount < 1) {
    const best = substrate.available[0];
    satChips.push({
      text: `${best.mineral} can lower σcrit to ${_formationNumber(assistedCrit)}`,
      met: sigma > assistedCrit,
      note: `Registered heterogeneous-nucleation factor ${best.discount.toFixed(2)}×; the nucleation engine must still select that exposed host.`,
    });
  }
  groups.push({ label: 'Saturation', chips: satChips });

  if (productionDecision?.available) {
    const productionChips: FormationDiagnosticChip[] = [{
      text: productionDecision.eligible
        ? `production ${productionDecision.source} can reach a fresh nucleus`
        : `production ${productionDecision.source} blocks a fresh nucleus`,
      met: productionDecision.eligible,
      note: 'Read-only best-case execution of the actual nucleator against cloned crystal state; no live RNG, fluid, or specimen state is consumed.',
    }];
    for (const blocker of productionDecision.blockers) {
      productionChips.push({ text: blocker, met: false });
    }
    if (productionDecision.stochasticBirth) {
      const probability = productionDecision.effectiveDrawProbability;
      productionChips.push({
        text: `stochastic birth draw ≈ ${probability == null ? 'unknown' : `${Math.round(probability * 100)}%`} effective threshold`,
        met: true,
        status: 'observer',
        note: `Observer only. The production callback made ${productionDecision.randomDraws} RNG draw${productionDecision.randomDraws === 1 ? '' : 's'} in the best-case probe; the displayed threshold is measured by replaying the same callback with fixed draws, not a claim that site-selection draws are independent.`,
      });
    } else if (productionDecision.eligible && productionDecision.randomDraws > 0) {
      productionChips.push({
        text: `birth is deterministic; ${productionDecision.randomDraws} draw${productionDecision.randomDraws === 1 ? '' : 's'} only choose site or form`,
        met: true,
        status: 'observer',
      });
    }
    groups.push({ label: 'Production nucleator', chips: productionChips });
  }

  if (!productionEligible) {
    const causal = _formationCausalCounterfactuals(name, c, sigma, sigmaCrit);
    groups.push({
      label: 'Production counterfactuals',
      chips: causal.length
        ? causal.map(row => ({
          text: `${row.field} ${_formationNumber(row.from)} → ${_formationNumber(row.to)} makes σ ${_formationNumber(sigma)} → ${_formationNumber(row.sigma)}${row.clearsThreshold ? ' · clears σcrit' : ''}`,
          met: row.clearsThreshold,
          status: row.clearsThreshold ? 'met' : 'observer',
          note: 'One-lever causal rerun of the production supersaturation function on cloned conditions; other controls are held fixed.',
        }))
        : [{
          text: 'no single sampled lever clears the production block',
          met: false,
          status: 'uncertain',
          note: 'The blocker may require multiple simultaneous changes or a crystal-history/substrate condition. The Production nucleator row remains authoritative.',
        }],
    });
  }

  const fluidFloors = gate?.fluid_min || {};
  const reagentRows = Object.entries(fluidFloors).map(([species, floor]) => {
    const available = _formationAvailableAmount(name, species, c);
    const minimum = typeof floor === 'number' ? floor : 0;
    return {
      species,
      available,
      minimum,
      ratio: minimum > 0 ? available / minimum : (available > 0 ? Infinity : 0),
    };
  }).sort((a, b) => a.ratio - b.ratio || a.species.localeCompare(b.species));

  if (reagentRows.length) {
    groups.push({
      label: 'Nucleation floors',
      chips: reagentRows.map(row => ({
        text: `${row.species} ${_formationNumber(row.available)} / ${_formationNumber(row.minimum)} ppm`,
        met: row.available >= row.minimum,
        note: 'Current engine-route availability / registered eligibility floor. This is a gate margin, not the calibrated axial-growth budget.',
      })),
    });
  }
  const stoich = (typeof MINERAL_STOICHIOMETRY !== 'undefined') ? MINERAL_STOICHIOMETRY[name] : null;
  const capacities = stoich ? Object.entries(stoich).map(([species, coefficient]) => {
    const raw = Number(c.fluid[species]);
    const available = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const demandPerUm = typeof stoichiometricBudgetDebitPpmPerUm === 'function'
      ? stoichiometricBudgetDebitPpmPerUm(species, Number(coefficient))
      : 0;
    return {
      species,
      available,
      demandPerUm,
      capacityUm: demandPerUm > 0 ? available / demandPerUm : Infinity,
    };
  }).sort((a, b) => a.capacityUm - b.capacityUm || a.species.localeCompare(b.species)) : [];
  groups.push({
    label: 'Calibrated growth budget',
    chips: capacities.length
      ? capacities.map((row, i) => ({
        text: `${row.species} books ${_formationNumber(row.capacityUm, 0)} proxy axial µm${i === 0 ? ' · limiting booked reagent' : ''}`,
        met: row.capacityUm > 0,
        note: `${_formationNumber(row.available)} mg/kg available ÷ ${_formationNumber(row.demandPerUm, 6)} mg/kg per accepted axial µm. ${STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.preserves}; ${STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.limitation}.`,
      }))
      : [{ text: 'No calibrated stoichiometric budget registered', met: true }],
  });

  const T = c.temperature;
  const hasTMin = gate?.T_min != null, hasTMax = gate?.T_max != null;
  const tMet = typeof T === 'number'
    && (!hasTMin || T >= gate!.T_min!)
    && (!hasTMax || T <= gate!.T_max!);
  const tNeed = hasTMin && hasTMax
    ? `${gate!.T_min}–${gate!.T_max}°C`
    : hasTMin ? `≥ ${gate!.T_min}°C` : hasTMax ? `≤ ${gate!.T_max}°C` : 'no explicit cutoff';
  groups.push({
    label: 'Temperature gate',
    chips: [{ text: `${_formationNumber(T, 0)}°C · ${tNeed}`, met: (!hasTMin && !hasTMax) || tMet }],
  });

  const pressureChips = _formationPressureChips(name, c);
  if (pressureChips.length) groups.push({ label: 'Pressure / phase field', chips: pressureChips });

  if ((name === 'selenite' || name === 'anhydrite') && typeof waterActivityAssessment === 'function') {
    const aw = waterActivityAssessment(c.fluid, c.temperature);
    groups.push({
      label: 'Water activity',
      chips: [{
        text: `a_w ${aw.value.toFixed(3)} ±${aw.uncertainty.toFixed(3)} · ${aw.salinityPpt.toFixed(1)}‰ salinity`,
        met: true,
        status: 'observer',
        note: `${aw.note} This modifies the literature SI observer (gypsum includes 2 log10(a_w)); the current empirical sulfate gameplay engines do not consume a_w.`,
      }],
    });
  }

  const pH = c.fluid.pH;
  const hasPHMin = gate?.pH_min != null, hasPHMax = gate?.pH_max != null;
  const phMet = typeof pH === 'number'
    && (!hasPHMin || pH >= gate!.pH_min!)
    && (!hasPHMax || pH <= gate!.pH_max!);
  const phNeed = hasPHMin && hasPHMax
    ? `${gate!.pH_min}–${gate!.pH_max}`
    : hasPHMin ? `≥ ${gate!.pH_min}` : hasPHMax ? `≤ ${gate!.pH_max}` : 'no explicit cutoff';
  groups.push({
    label: 'pH gate',
    chips: [{ text: `pH ${_formationNumber(pH, 1)} · ${phNeed}`, met: (!hasPHMin && !hasPHMax) || phMet }],
  });
  groups.push({ label: 'Redox gate', chips: [_formationRedoxChip(gate, c)] });

  const substrateChips: FormationDiagnosticChip[] = substrate.available.length
    ? substrate.available.map(row => ({
      text: `${row.mineral} ×${row.count} · ${row.state} · σcrit ×${row.discount.toFixed(2)}${row.epitaxy ? ' · epitaxy' : ''}`,
      met: true,
      note: 'Executable production host route; availability lowers the barrier only if the stochastic engine selects this surface.',
    }))
    : [{ text: 'bare wall · no registered catalytic host exposed', met: true }];
  if (history.records.length) {
    const last = history.records[history.records.length - 1];
    if (last?.position) substrateChips.unshift({ text: `last formed: ${last.position}`, met: true });
  }
  groups.push({ label: 'Substrate', chips: substrateChips });

  const compChips: FormationDiagnosticChip[] = competition.competitors.length
    ? competition.competitors.map(row => ({
      text: `${row.mineral} ×${row.count} shares ${row.shared.join('/')}`,
      met: false,
      note: 'Potential shared-reagent competition. Actual graduated rationing is local to crystals sharing a fluid cell.',
    }))
    : [{ text: 'no active shared-reagent competitors', met: true }];
  if (competition.initiative) {
    const compMod = competition.initiative.modifiers.find(m => m.source === 'competition');
    compChips.unshift({
      text: `initiative ${_formationNumber(competition.initiative.finalInitiative)}${compMod ? ` · ${compMod.reason}` : ''}`,
      met: !compMod || compMod.value >= 0,
      note: 'The same initiative model used by graduated competition; actual growth allocation is computed per fluid cell.',
    });
  }
  groups.push({ label: 'Competition', chips: compChips });

  let capReached = false;
  let strangled = false;
  const transportChips: FormationDiagnosticChip[] = [];
  if (sim && history.available) {
    const exposed = history.records.filter((cr: any) => cr && !cr.dissolved && cr.enclosed_by == null).length;
    const cap = spec.max_nucleation_count;
    if (typeof cap === 'number') {
      capReached = exposed >= cap;
      transportChips.push({ text: `exposed nuclei ${exposed}/${cap}`, met: !capReached });
    }
    if (sim.conditions === c && chemistryEligible && typeof sim._wallStrangledFor === 'function') {
      try { strangled = !!sim._wallStrangledFor(name); } catch (_e) { strangled = false; }
      transportChips.push({
        text: strangled ? 'all wall cells below σcrit' : 'an accessible wall cell clears σcrit',
        met: !strangled,
        note: 'Boundary-layer depletion / diffusion gate.',
      });
    }
    if (typeof sim._fillDampener === 'number' && sim._fillDampener < 1) {
      const propensity = typeof spec.late_stage_propensity === 'number'
        ? Math.max(0, Math.min(1, spec.late_stage_propensity))
        : (spec.fill_exempt ? 1 : 0);
      const access = sim._fillDampener + propensity * (1 - sim._fillDampener);
      transportChips.push({
        text: `late-fill nucleation chance ${Math.round(access * 100)}%`,
        met: access >= 0.5,
        note: 'Current sigmoid mass-transport access before the engine makes its stochastic draw.',
      });
    }
  }
  if (transportChips.length) groups.push({ label: 'Space & transport', chips: transportChips });

  let state: MineralFormationExplanation['state'] = 'unknown';
  let verdict = 'Formation history is unavailable for this snapshot.';
  if (history.available && history.total > 0) {
    if (productionEligible && !strangled) {
      state = 'formed-supported';
      if (substrateEligible) {
        const best = substrate.available[0];
        verdict = `Formed (${history.active} active, ${history.transformed} transformed, ${history.dissolved} dissolved); the current broth clears the ${best.mineral}-assisted threshold (${_formationNumber(assistedCrit)}) but not the bare-wall threshold, so fresh nucleation remains host-dependent and the engine must select an exposed host.`;
      } else {
        verdict = `Formed (${history.active} active, ${history.transformed} transformed, ${history.dissolved} dissolved); the current broth still clears the bare-wall nucleation threshold.`;
      }
    } else {
      state = 'formed-past';
      const blocker = productionDecision?.available && productionDecision.blockers.length
        ? ` Production now blocks a fresh nucleus: ${productionDecision.blockers.join('; ')}.`
        : '';
      verdict = `Formed earlier (${history.active} active, ${history.transformed} transformed, ${history.dissolved} dissolved); current conditions no longer favor fresh nucleation.${blocker}`;
    }
  } else if (history.available && productionEligible && chemistryEligible && !capReached && !strangled) {
    state = 'eligible';
    verdict = 'Not formed yet, but chemistry is eligible; site selection and the engine\'s stochastic nucleation draw remain.';
  } else if (history.available && productionEligible && substrateEligible && !capReached && !strangled) {
    state = 'conditional';
    verdict = 'Not formed: below the bare-wall threshold, but an exposed registered substrate could lower the nucleation barrier.';
  } else if (history.available) {
    state = 'blocked';
    if (capReached) verdict = 'No fresh nucleation: this mineral has reached its exposed-crystal cap.';
    else if (strangled) verdict = 'No fresh nucleation: boundary-layer depletion leaves every accessible wall cell below threshold.';
    else if (productionDecision?.available && !productionDecision.eligible) {
      verdict = `No fresh nucleation: ${productionDecision.blockers.join('; ')}.`;
    }
    else if (sigma <= 0) verdict = 'Not formed: the supersaturation engine is blocked by chemistry, thermodynamics, or a hard gate.';
    else verdict = 'Not formed: supersaturation remains below the mineral-specific nucleation threshold.';
  }

  return {
    name,
    sigma,
    sigmaCrit,
    chemistryEligible,
    substrateEligible,
    effectiveEligible,
    state,
    verdict,
    groups,
    history: {
      available: history.available,
      total: history.total,
      active: history.active,
      transformed: history.transformed,
      dissolved: history.dissolved,
    },
  };
}

// Pure builder — returns [{label, chips: [{text, met, note?}]}] so
// tests can assert the red/green logic without any DOM. `c` needs only
// plain-readable `temperature` and `fluid` (replay snapshots qualify).
function _nucleationHoverGroups(name, c) {
  const spec = (typeof MINERAL_SPEC !== 'undefined') ? MINERAL_SPEC[name] : null;
  if (!spec || !c || !c.fluid) return [];
  const f = c.fluid;
  const groups = [];

  // T window — one chip, green while T sits inside the growth window.
  if (Array.isArray(spec.T_range_C)) {
    const [lo, hi] = spec.T_range_C;
    const opt = Array.isArray(spec.T_optimum_C) ? ` (optimum ${spec.T_optimum_C[0]}–${spec.T_optimum_C[1]})` : '';
    groups.push({
      label: 'T window',
      chips: [{
        text: `${lo}–${hi}°C${opt}`,
        met: typeof c.temperature === 'number' && c.temperature >= lo && c.temperature <= hi,
      }],
    });
  }

  // Requires — one chip per ingredient floor, green when the broth
  // carries at least that much. Non-numeric spec values (rare) chip as
  // presence checks.
  if (spec.required_ingredients && Object.keys(spec.required_ingredients).length) {
    groups.push({
      label: 'Requires',
      chips: Object.entries(spec.required_ingredients).map(([k, v]) => (
        (typeof v === 'number')
          ? { text: `${k} ≥${v}`, met: (typeof f[k] === 'number' ? f[k] : 0) >= v }
          : { text: k, met: (typeof f[k] === 'number' ? f[k] : 0) > 0 }
      )),
    });
  }

  // Traces — optional chromophores; green means the broth carries the
  // trace so grown zones will pick it up. The spec's flavor text rides
  // as a chip-level tooltip.
  if (spec.trace_ingredients && Object.keys(spec.trace_ingredients).length) {
    groups.push({
      label: 'Traces',
      chips: Object.entries(spec.trace_ingredients).map(([k, v]) => ({
        text: k,
        met: (typeof f[k] === 'number' ? f[k] : 0) > 0,
        note: (typeof v === 'string') ? v : '',
      })),
    });
  }

  // Acid dissolution — REVERSED into survival conditions (see header).
  // Library sources (95-ui-library acidText): acid_dissolution.pH_threshold
  // / pH_dissolution_below = dissolves BELOW → chip `pH ≥ X`;
  // pH_dissolution_above = dissolves ABOVE → chip `pH ≤ Y`.
  {
    const below = (spec.acid_dissolution && spec.acid_dissolution.pH_threshold != null)
      ? spec.acid_dissolution.pH_threshold
      : (spec.pH_dissolution_below != null ? spec.pH_dissolution_below : null);
    const above = (spec.pH_dissolution_above != null) ? spec.pH_dissolution_above : null;
    const pH = (typeof f.pH === 'number') ? f.pH : null;
    const chips = [];
    if (below != null) chips.push({ text: `pH ≥ ${below}`, met: pH != null && pH >= below });
    if (above != null) chips.push({ text: `pH ≤ ${above}`, met: pH != null && pH <= above });
    if (!chips.length && spec.acid_dissolution) {
      // Dict present but no numeric threshold (HF-only / rehydration-
      // only species — the Library shows 'resistant'). Always green:
      // no broth pH endangers it.
      chips.push({ text: 'resistant', met: true });
    }
    if (chips.length) groups.push({ label: 'Acid dissolution', chips });
  }

  return groups;
}

function _nucleationChipGroupHTML(chips) {
  const chipRow = `<div class="nuc-pop-chips">` + chips.map(ch =>
    `<span class="nuc-chip ${ch.status || (ch.met ? 'met' : 'unmet')}"${ch.note ? ` title="${_satEsc(ch.note)}"` : ''}>${_satEsc(ch.text)}</span>`
  ).join('') + `</div>`;
  // A title attribute is mouse-only and the popover intentionally does not
  // take pointer events. Repeat every scientific qualification as persistent
  // visible text so focus and tap expose the same evidence as desktop hover.
  const notes = chips.filter(ch => ch.note).map(ch => {
    const status = ch.status === 'observer'
      ? 'Observer only'
      : (ch.status === 'uncertain' ? 'Uncertain' : 'Note');
    return `<div class="nuc-pop-note is-${_satEsc(ch.status || 'note')}"><strong>${status}:</strong> ${_satEsc(ch.note)}</div>`;
  }).join('');
  return chipRow + notes;
}

function _nucleationHoverHTML(name, c, sim = null, sigmaOverride = null) {
  const explanation = _buildMineralFormationExplanation(name, c, sim, sigmaOverride);
  if (!explanation) return '';
  const displayName = (typeof _SAT_DISPLAY_NAMES !== 'undefined' && _SAT_DISPLAY_NAMES[name])
    || (name.charAt(0).toUpperCase() + name.slice(1));
  let html = `<div class="nuc-pop-head">Why did—or didn't—${_satEsc(displayName)} form?</div>`;
  html += `<div class="nuc-pop-verdict is-${_satEsc(explanation.state)}">${_satEsc(explanation.verdict)}</div>`;
  for (const g of explanation.groups) {
    html += `<div class="nuc-pop-label">${_satEsc(g.label)}</div>`;
    html += _nucleationChipGroupHTML(g.chips);
  }

  // Trace elements affect zoning/colour rather than the nucleation gate,
  // while acid dissolution answers whether an existing face survives the
  // current broth. Keep both as explicitly secondary evidence.
  const recipeGroups = _nucleationHoverGroups(name, c).filter(g => g.label === 'Traces' || g.label === 'Acid dissolution');
  for (const g of recipeGroups) {
    const label = g.label === 'Acid dissolution' ? 'Crystal survival' : 'Trace chemistry';
    html += `<div class="nuc-pop-label">${_satEsc(label)}</div>`;
    html += _nucleationChipGroupHTML(g.chips);
  }
  return html;
}

// Singleton popover element, body-mounted so panel scroll/overflow
// can't clip it. pointer-events:none — it never steals the hover.
function _satHoverEl() {
  let el = document.getElementById('sat-hover-pop');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sat-hover-pop';
    el.className = 'sat-hover-pop';
    el.setAttribute('role', 'tooltip');
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  if (el.dataset.nucEventsWired !== 'true') {
    el.dataset.nucEventsWired = 'true';
    el.addEventListener('click', (ev) => {
      const close = ev.target && ev.target.closest
        ? ev.target.closest('[data-nuc-pop-close]')
        : null;
      if (!close) return;
      const restore = _satHoverPinnedPill;
      _satHoverHide(true);
      if (restore && typeof restore.focus === 'function') {
        restore.focus();
        // focusin normally opens the ephemeral tooltip; explicit Close wins.
        _satHoverHide(true);
      }
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      const restore = _satHoverPinnedPill;
      _satHoverHide(true);
      if (restore && typeof restore.focus === 'function') {
        restore.focus();
        _satHoverHide(true);
      }
    });
  }
  return el;
}

let _satHoverPinnedPill = null;

function _satHoverShowForPill(pill, pinned = false) {
  if (_satHoverPinnedPill && !pinned) return;
  const name = pill.dataset.hlMineral;
  const c = _satLastConditions
    || ((typeof fortressSim !== 'undefined' && fortressSim) ? fortressSim.conditions : null);
  if (!name || !c) return;
  const sigma = Number.parseFloat(pill.dataset.sigma);
  const html = _nucleationHoverHTML(name, c, _satLastSim, Number.isFinite(sigma) ? sigma : null);
  if (!html) { _satHoverHide(); return; }
  const el = _satHoverEl();
  if (pinned) {
    if (_satHoverPinnedPill && _satHoverPinnedPill !== pill) {
      _satHoverPinnedPill.removeAttribute('aria-controls');
      _satHoverPinnedPill.removeAttribute('aria-expanded');
    }
    _satHoverPinnedPill = pill;
    el.classList.add('is-pinned');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Formation diagnosis for ${name}`);
    el.innerHTML = `<button type="button" class="nuc-pop-close" data-nuc-pop-close aria-label="Close formation diagnosis">Close</button>${html}`;
    pill.setAttribute('aria-controls', el.id);
    pill.setAttribute('aria-expanded', 'true');
  } else {
    el.classList.remove('is-pinned');
    el.setAttribute('role', 'tooltip');
    el.removeAttribute('aria-modal');
    el.removeAttribute('aria-label');
    el.innerHTML = html;
  }
  el.style.display = 'block';
  // The singleton panel retains its internal scroll position between
  // minerals. Every newly opened diagnosis starts at its verdict, while
  // the sticky Close control remains reachable during a long mobile read.
  el.scrollTop = 0;
  if (!pinned) pill.setAttribute('aria-describedby', el.id);
  // Position beside the pill; flip left/up when the viewport says no.
  const r = pill.getBoundingClientRect();
  const pw = el.offsetWidth, ph = el.offsetHeight;
  let x = r.right + 10;
  if (x + pw > window.innerWidth - 8) x = Math.max(8, r.left - pw - 10);
  let y = r.top;
  if (y + ph > window.innerHeight - 8) y = Math.max(8, window.innerHeight - ph - 8);
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  if (pinned) {
    const close = el.querySelector('[data-nuc-pop-close]');
    if (close && typeof close.focus === 'function') close.focus();
  }
}

function _satHoverHide(force = false) {
  if (_satHoverPinnedPill && !force) return;
  const el = document.getElementById('sat-hover-pop');
  if (el) {
    el.style.display = 'none';
    el.classList.remove('is-pinned');
    el.removeAttribute('aria-modal');
    el.removeAttribute('aria-label');
    el.setAttribute('role', 'tooltip');
  }
  const described = document.querySelectorAll('.sat-indicator[aria-describedby="sat-hover-pop"]');
  for (const pill of described) pill.removeAttribute('aria-describedby');
  if (_satHoverPinnedPill) {
    _satHoverPinnedPill.removeAttribute('aria-controls');
    _satHoverPinnedPill.removeAttribute('aria-expanded');
  }
  _satHoverPinnedPill = null;
}

// Idempotent — wires hover/click on the sigma panel host once. Re-
// rendering replaces innerHTML but keeps the listeners on the
// container. Hover/click on a `.sat-indicator[data-hl-mineral]` or
// `.sat-class-summary[data-hl-class]` drives the topo highlight
// system the same way the legacy classes-tab legend did. Replaces
// `_wireTopoLegendEvents` for the user-facing functionality.
let _satEventsWired = false;
function _wireFortressSigmaEvents(host) {
  if (!host || _satEventsWired) return;
  _satEventsWired = true;
  function targetFromEvent(ev) {
    const pill = ev.target.closest('.sat-indicator[data-hl-mineral]');
    if (pill) return { type: 'mineral', value: pill.dataset.hlMineral };
    const summary = ev.target.closest('.sat-class-summary[data-hl-class]');
    if (summary) return { type: 'class', value: summary.dataset.hlClass };
    return null;
  }
  host.addEventListener('mouseover', (ev) => {
    topoSetLegendHoverTarget(targetFromEvent(ev));
    // Nucleation popover rides the same delegation: pill → show its
    // recipe chips, anything else under the host → hide.
    const pill = ev.target.closest('.sat-indicator[data-hl-mineral]');
    if (pill) _satHoverShowForPill(pill);
    else _satHoverHide();
  });
  host.addEventListener('mouseleave', () => {
    topoSetLegendHoverTarget(null);
    if (!host.contains(document.activeElement)) _satHoverHide();
  });
  host.addEventListener('focusin', (ev) => {
    const pill = ev.target.closest('.sat-indicator[data-hl-mineral]');
    if (!pill) return;
    topoSetLegendHoverTarget({ type: 'mineral', value: pill.dataset.hlMineral });
    _satHoverShowForPill(pill);
  });
  host.addEventListener('focusout', (ev) => {
    if (ev.relatedTarget && host.contains(ev.relatedTarget)) return;
    topoSetLegendHoverTarget(null);
    _satHoverHide();
  });
  host.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    _satHoverHide(true);
    const pill = ev.target.closest('.sat-indicator[data-hl-mineral]');
    if (pill && typeof pill.blur === 'function') pill.blur();
  });
  // A scroll anywhere (panel column, page) leaves a fixed-position
  // popover floating over the wrong pill — just drop it.
  window.addEventListener('scroll', () => _satHoverHide(), true);
  host.addEventListener('click', (ev) => {
    const target = targetFromEvent(ev);
    // The `<details>` element handles open/close itself on a click
    // anywhere in <summary>. We add legend-toggle on top, but only
    // for clicks on the summary's interactive children — clicking
    // the disclosure caret area still toggles open/close cleanly.
    if (target) {
      topoToggleLockTarget(target);
      const pill = ev.target.closest('.sat-indicator[data-hl-mineral]');
      if (pill) {
        if (_satHoverPinnedPill === pill) _satHoverHide(true);
        else _satHoverShowForPill(pill, true); // pinned, scrollable tap/click detail
      }
      // Don't preventDefault on summary clicks — let <details> do its
      // open/close thing. We still want the lock behavior to apply.
    }
  });
}

// Zone-viz Phase 1c: bar-graph thumbnail for Crystal Inventory specimen
// cards. Falls back to the generic mineral photo/placeholder thumb only
// when the crystal has zero zones recorded (e.g. legacy serialized
// records from before zone data was persisted). A single zone is still
// real history — the moment of nucleation — and renderZoneBarCanvas
// handles it correctly (single dim stripe, per its all-equal-values
// branch). Pre-2026-04-30 this gated on >= 2, which left sub-resolution
// crystals (1 zone, 0.0 mm) showing the generic 💎 placeholder while
// every other species in the inventory had a real bar-graph thumb —
// surfaced as a topaz #6 visual bug in seed-42 ouro_preto.
//
// Implementation note: renderCrystalRow builds its content as an HTML
// string and commits it via el.innerHTML. A live canvas can't be painted
// via innerHTML — it needs a post-insert JS paint. So we render off-
// screen via renderZoneBarCanvas + toDataURL and embed as an <img>.
// The underlying canvas width may exceed the thumbnail display box (e.g.
// 150 zones × 1px-zone = 150px canvas); the <img> CSS stretches/squashes
// it to the display size, which is the right trade-off — the color
// pattern is the message, not pixel-precise zone boundaries.
