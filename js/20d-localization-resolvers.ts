// ============================================================
// js/20d-localization-resolvers.ts — wall-mesh localization
// ============================================================
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 4.
//
// Polymorphic accessors that resolve scenario-side fixtures
// (open_to_atmosphere, atmospheric_pCO2_bar, wall_rock_thermal_buffer_C,
// host_rock_composition) to a per-wall-mesh-vertex value. Three input
// forms are accepted:
//
//   scalar          scenario-global value (Phase 1 default)
//   resolver fn     a function (scenario, mesh, vertexIdx) → value
//   per-region map  { _default, floor, wall, ceiling, ... } keyed on
//                   vertex orientation (the wall mesh's existing
//                   per-vertex region tagging from 23-geometry-wall-mesh)
//
// Per-ring array form is INTENTIONALLY OMITTED. PROPOSAL-CAVITY-MESH
// is retiring the ring-grid abstraction; new schema slots don't
// perpetuate it.
//
// Also exposes thin per-vertex chemistry accessors so engines can
// consume fluid + temperature without knowing the underlying data
// model. WallMesh Phase 4 Tranche 4a already unaliased per-vertex
// chemistry onto `mesh.cells[i].fluid` — these accessors are the
// stable API that survives any future schema migration.
//
// And the Henry's-Law equilibrator: a bisection that solves for the
// pH where the fluid's equilibrium pCO2 matches a target (typically
// the local atmospheric value at an open vertex).

// =============================================================
// Per-vertex chemistry accessors
// =============================================================

// Returns the FluidChemistry object for the given mesh vertex.
// WallMesh.cells[i].fluid is the canonical per-vertex storage (Phase
// 4 Tranche 4a). For pole vertices (ringIdx === -1) or pre-bind state
// where cells aren't populated, falls back to the sim's equator-ring
// fluid so callers never get null.
function fluidAtMeshVertex(sim: any, mesh: any, vertexIdx: number): any {
  if (mesh && mesh.cells && vertexIdx >= 0 && vertexIdx < mesh.cells.length) {
    const cell = mesh.cells[vertexIdx];
    if (cell && cell.fluid) return cell.fluid;
  }
  // Fallback chain — pole vertices have no cell; pre-bindRingChemistry
  // mesh may have null fluids. Try ring 0's fluid via the vertex's
  // ringIdx, then the sim's equator-ring fluid, then conditions.fluid.
  if (mesh && mesh.vertices && vertexIdx >= 0 && vertexIdx < mesh.vertices.length) {
    const v = mesh.vertices[vertexIdx];
    if (v && v.ringIdx >= 0 && sim && sim.ring_fluids) {
      return sim.ring_fluids[v.ringIdx];
    }
  }
  if (sim && sim.conditions && sim.conditions.fluid) return sim.conditions.fluid;
  return null;
}

// Returns the temperature (°C) at the given mesh vertex.
// WallMesh.cells[i].temperature_ring indexes into sim.ring_temperatures
// (per Tranche 4a — temperature is still per-ring; per-vertex chemistry
// landed first, per-vertex temperature is a future tranche). Pole
// vertices fall back to the sim's conditions temperature.
function temperatureAtMeshVertex(sim: any, mesh: any, vertexIdx: number): number {
  if (mesh && mesh.cells && vertexIdx >= 0 && vertexIdx < mesh.cells.length) {
    const cell = mesh.cells[vertexIdx];
    if (cell && typeof cell.temperature_ring === 'number'
        && sim && sim.ring_temperatures
        && cell.temperature_ring >= 0
        && cell.temperature_ring < sim.ring_temperatures.length) {
      const T = sim.ring_temperatures[cell.temperature_ring];
      if (typeof T === 'number') return T;
    }
  }
  if (mesh && mesh.vertices && vertexIdx >= 0 && vertexIdx < mesh.vertices.length) {
    const v = mesh.vertices[vertexIdx];
    if (v && v.ringIdx >= 0 && sim && sim.ring_temperatures) {
      const T = sim.ring_temperatures[v.ringIdx];
      if (typeof T === 'number') return T;
    }
  }
  if (sim && sim.conditions && typeof sim.conditions.temperature === 'number') {
    return sim.conditions.temperature;
  }
  return 25; // last-resort lab-standard
}

// =============================================================
// Polymorphic scenario fixture resolvers
// =============================================================

// Core polymorphic resolver. Accepts:
//   scalar  → returned as-is for every vertex
//   fn      → called with (scenarioField, mesh, vertexIdx) — caller
//             pre-binds the scenarioField if needed
//   object  → looked up by vertex orientation:
//             { _default, floor, wall, ceiling } typical;
//             any orientation key recognized by WallMesh works
// Returns defaultValue if the field is undefined or the lookup misses.
function _resolveFixture(field: any, mesh: any, vertexIdx: number, defaultValue: any): any {
  if (field === undefined || field === null) return defaultValue;
  if (typeof field === 'boolean' || typeof field === 'number' || typeof field === 'string') {
    return field;
  }
  if (typeof field === 'function') {
    try {
      const v = field(mesh, vertexIdx);
      return (v === undefined || v === null) ? defaultValue : v;
    } catch (e) {
      return defaultValue;
    }
  }
  if (typeof field === 'object') {
    // Per-region tag map keyed on vertex.orientation
    if (mesh && mesh.vertices && vertexIdx >= 0 && vertexIdx < mesh.vertices.length) {
      const vert = mesh.vertices[vertexIdx];
      const orient = vert ? vert.orientation : null;
      if (orient && Object.prototype.hasOwnProperty.call(field, orient)) {
        return field[orient];
      }
    }
    if (Object.prototype.hasOwnProperty.call(field, '_default')) {
      return field._default;
    }
    return defaultValue;
  }
  return defaultValue;
}

// Resolves scenario.open_to_atmosphere → bool per vertex. Default
// false (closed cavity, legacy behavior).
function isOpenAtMeshVertex(scenario: any, mesh: any, vertexIdx: number): boolean {
  if (!scenario) return false;
  return !!_resolveFixture(scenario.open_to_atmosphere, mesh, vertexIdx, false);
}

// Resolves scenario.atmospheric_pCO2_bar → number per vertex.
// Default 4.2e-4 bar (modern atmospheric ~420 ppm). Pre-industrial
// was ~2.8e-4 (280 ppm); Mesozoic / hyperthermal periods can hit
// 1e-3 to 1e-2; cave atmospheres with biological CO2 buildup can hit
// 1e-2 to 1e-1; CO2-saturated brines and soil gas can hit 1+ bar.
const _DEFAULT_ATMOSPHERIC_PCO2_BAR = 4.2e-4;
function atmosphericPCO2AtMeshVertex(scenario: any, mesh: any, vertexIdx: number): number {
  if (!scenario) return _DEFAULT_ATMOSPHERIC_PCO2_BAR;
  const v = _resolveFixture(scenario.atmospheric_pCO2_bar, mesh, vertexIdx, _DEFAULT_ATMOSPHERIC_PCO2_BAR);
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : _DEFAULT_ATMOSPHERIC_PCO2_BAR;
}

// Resolves scenario.wall_rock_thermal_buffer_C → number per vertex.
// Default 0 (no thermal buffering). Phase 2 may consume.
function wallRockThermalBufferAtMeshVertex(scenario: any, mesh: any, vertexIdx: number): number {
  if (!scenario) return 0;
  const v = _resolveFixture(scenario.wall_rock_thermal_buffer_C, mesh, vertexIdx, 0);
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

// Resolves scenario.host_rock_composition → string per vertex.
// Default 'limestone' (matches existing wall.composition default in
// 22-geometry-wall.ts). Phase 2 may consume per-vertex composition
// (mixed host rocks like limestone + interbedded chert).
function hostRockCompositionAtMeshVertex(scenario: any, mesh: any, vertexIdx: number): string {
  if (!scenario) return 'limestone';
  const v = _resolveFixture(scenario.host_rock_composition, mesh, vertexIdx, 'limestone');
  return typeof v === 'string' && v ? v : 'limestone';
}

// =============================================================
// Henry's-Law pH ↔ pCO2 equilibration
// =============================================================

// At an open vertex, the fluid's equilibrium pCO2 must match the local
// atmospheric pCO2 (Henry's-Law boundary). Given a fluid + temperature
// + target pCO2, solve for the pH that satisfies
//   equilibriumPCO2(fluid_with_this_pH, T) = target
//
// pCO2 is monotonically DECREASING in pH (high pH → more CO3²⁻, less
// H2CO3 → lower pCO2). The function is smooth and well-behaved across
// the entire natural-water pH range, so bisection converges in <20
// iterations to ±1e-6 in pH space.
//
// Returns the equilibrated pH as a number. Does NOT mutate the input
// fluid — caller applies the result by setting `fluid.pH = result`
// after deciding which vertex/ring/cell to apply to. Returns the
// original fluid.pH if (a) target_pCO2 is invalid, (b) fluid has no
// DIC (CO3 ≤ 0), (c) bisection bounds bracket the same sign (rare —
// happens when target is outside the achievable range for this DIC
// at this T; in that case the fluid simply can't equilibrate and we
// return the original pH rather than producing nonsense).
function equilibratePHtoPCO2(fluid: any, T_celsius: number, target_pCO2_bar: number): number {
  if (!fluid) return 7.0;
  const currentPH = typeof fluid.pH === 'number' ? fluid.pH : 7.0;
  if (!isFinite(target_pCO2_bar) || target_pCO2_bar <= 0) return currentPH;
  if (typeof fluid.CO3 !== 'number' || fluid.CO3 <= 0) return currentPH;
  if (typeof equilibriumPCO2 !== 'function') return currentPH;

  // Build a thin wrapper so we can test arbitrary pH without mutating
  // the caller's fluid. equilibriumPCO2 only reads fluid.CO3 and
  // fluid.pH (per 20b-chemistry-carbonate-system.ts).
  const probe = (pH: number) => {
    const proxy = { CO3: fluid.CO3, pH };
    return equilibriumPCO2(proxy, T_celsius);
  };

  // Bisection bounds — natural-water pH range. f(lo) > target,
  // f(hi) < target if target is achievable. If both have same sign
  // relative to target, fluid can't equilibrate at this DIC and T —
  // return the original pH and let the simulator continue.
  let lo = 2.0;
  let hi = 13.0;
  const fLo = probe(lo) - target_pCO2_bar;
  const fHi = probe(hi) - target_pCO2_bar;
  if (fLo * fHi > 0) {
    // Both bracket on the same side → not achievable. Return the
    // bound that's CLOSER to the target (so a target wildly above
    // saturation clamps pH down, a target wildly below clamps up).
    return Math.abs(fLo) < Math.abs(fHi) ? lo : hi;
  }

  // Standard bisection. ~40 iterations gives ~1e-11 in pH space;
  // ~20 is plenty for sim-level precision (±1e-6 in pH).
  for (let iter = 0; iter < 40; iter++) {
    const mid = 0.5 * (lo + hi);
    if (hi - lo < 1e-6) return mid;
    const fMid = probe(mid) - target_pCO2_bar;
    // f decreases as pH increases — so positive fMid means we're at
    // too-low pH (pCO2 too high) and need to move RIGHT (raise pH).
    if (fMid > 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return 0.5 * (lo + hi);
}
