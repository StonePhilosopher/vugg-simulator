// ============================================================
// js/85c-simulator-state.ts — VugSimulator methods (Object.assign mixin)
// ============================================================
// Methods attached to VugSimulator.prototype after the class is defined
// in 85-simulator.ts, so direct calls and dynamic dispatch keep working.
//
// Methods here (10): _snapshotGlobal, _propagateGlobalDelta, _applyWaterLevelDrift, _applyVadoseOxidationOverride, _diffuseRingState, _repaintWallState, _wallCellsBlockedByCrystals, get_vug_fill, _check_enclosure, _check_liberation.
//
// Phase B20 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  // Phase C v1: snapshot conditions.fluid + temperature before a
// global-mutating block (events, wall dissolution, ambient cooling).
// Pair with _propagateGlobalDelta to apply the same delta to all
// non-equator rings. Mirrors VugSimulator._snapshot_global in vugg.py.
_snapshotGlobal() {
  return [_cloneFluid(this.conditions.fluid), this.conditions.temperature];
},

  // Phase C v1: apply the delta between current conditions and the
// pre-block snapshot to all non-equator ring_fluids and
// ring_temperatures. The equator ring is aliased to conditions.fluid
// so it already reflects the new value — skip it.
_propagateGlobalDelta(snap) {
  const [preFluid, preTemp] = snap;
  const equator = Math.floor(this.wall_state.ring_count / 2);
  const equatorFluid = this.ring_fluids[equator];  // = conditions.fluid (aliased)
  for (const fname of this._fluidFieldNames) {
    const delta = this.conditions.fluid[fname] - preFluid[fname];
    if (delta === 0) continue;
    for (const rf of this.ring_fluids) {
      if (rf === equatorFluid) continue;
      rf[fname] = rf[fname] + delta;
    }
  }
  const deltaT = this.conditions.temperature - preTemp;
  if (deltaT !== 0) {
    for (let k = 0; k < this.ring_temperatures.length; k++) {
      if (k === equator) {
        this.ring_temperatures[k] = this.conditions.temperature;
      } else {
        this.ring_temperatures[k] += deltaT;
      }
    }
  }
},

  // v26: drain `porosity × WATER_LEVEL_DRAIN_RATE` rings per step
// when the water-level mechanic is active. No-op when
// fluid_surface_ring is null, porosity is 0 (sealed default), or
// surface is already at 0. Asymmetric: porosity is a pure sink, not
// a balance term — refilling stays event-driven. Refill events that
// snap fluid_surface_ring above ring_count get clamped here on the
// next step (so events can write a sentinel like 1e6 to mean
// "fill to ceiling" without needing to know ring_count themselves).
// Mirror of VugSimulator._apply_water_level_drift in vugg.py.
_applyWaterLevelDrift() {
  let s = this.conditions.fluid_surface_ring;
  if (s === null || s === undefined) return 0;
  const n = this.wall_state.ring_count;
  if (s > n) {
    this.conditions.fluid_surface_ring = n;
    s = n;
  }
  const p = this.conditions.porosity;
  if (p <= 0 || s <= 0) return 0;
  const delta = -p * WATER_LEVEL_DRAIN_RATE;
  const newS = Math.max(0, s + delta);
  this.conditions.fluid_surface_ring = newS;
  return newS - s;
},

  // v25: detect rings that just transitioned wet → dry (submerged or
// meniscus → vadose) and force their fluid to oxidizing chemistry.
// Submerged rings keep the scenario's chemistry, so the cavity floor
// stays reducing while the now-exposed ceiling oxidizes — matches
// real-world supergene paragenesis (galena → cerussite, chalcopyrite
// → malachite/azurite, pyrite → limonite, all in the air zone).
// Mirror of VugSimulator._apply_vadose_oxidation_override in vugg.py.
_applyVadoseOxidationOverride() {
  const n = this.wall_state.ring_count;
  const newSurface = this.conditions.fluid_surface_ring;
  const oldSurface = this._prevFluidSurfaceRing;
  this._prevFluidSurfaceRing = newSurface;
  if (newSurface === null || newSurface === undefined) return [];
  if (oldSurface !== null && oldSurface !== undefined && newSurface >= oldSurface) {
    return [];
  }
  const becameVadose = [];
  for (let r = 0; r < n; r++) {
    const was = VugConditions._classifyWaterState(oldSurface, r, n);
    const now = VugConditions._classifyWaterState(newSurface, r, n);
    if (now === 'vadose' && was !== 'vadose') {
      const rf = this.ring_fluids[r];
      if (rf.O2 < 1.8) rf.O2 = 1.8;
      rf.S *= 0.3;
      // v27 evaporative concentration boost (mirror of vugg.py).
      rf.concentration *= EVAPORATIVE_CONCENTRATION_FACTOR;
      becameVadose.push(r);
    }
  }
  return becameVadose;
},

  // Phase C inter-ring homogenization. One discrete-Laplacian step per
// fluid component and per temperature, with Neumann (no-flux)
// boundary conditions at the floor and ceiling rings.
//
// Uniform rings → no-op (Laplacian of a constant is zero), which
// preserves byte-equality for default scenarios. Non-uniform rings
// relax the gradient by `rate * (neighbor sum - 2*self)` per step.
//
// Old values are read into a snapshot before any writes so each
// ring's update sees the pre-step state of its neighbors —
// otherwise ring k+1's update would already see ring k's new value
// and the diffusion would be asymmetric.
_diffuseRingState(rate?) {
  if (rate == null) rate = this.inter_ring_diffusion_rate;
  if (!(rate > 0)) return;
  const n = this.ring_fluids.length;
  if (n <= 1) return;
  for (const fname of this._fluidFieldNames) {
    const old = this.ring_fluids.map(rf => rf[fname]);
    for (let k = 0; k < n; k++) {
      const kp = k > 0 ? k - 1 : 0;
      const kn = k < n - 1 ? k + 1 : n - 1;
      this.ring_fluids[k][fname] = old[k] + rate * (old[kp] + old[kn] - 2 * old[k]);
    }
  }
  const oldT = this.ring_temperatures.slice();
  for (let k = 0; k < n; k++) {
    const kp = k > 0 ? k - 1 : 0;
    const kn = k < n - 1 ? k + 1 : n - 1;
    this.ring_temperatures[k] = oldT[k] + rate * (oldT[kp] + oldT[kn] - 2 * oldT[k]);
  }
},

  _repaintWallState() {
  // Rebuild ring-0 occupancy from the crystal list. Cheap (~120 × ~20)
  // and keeps per-cell thickness consistent with dissolution / enclosure.
  this.wall_state.updateDiameter(this.conditions.wall.vug_diameter_mm);
  this.wall_state.clear();
  // Paint smallest-first so biggest crystals win overlaps — that's
  // what a viewer would see from outside the vug.
  const sorted = [...this.crystals].sort((a, b) => a.total_growth_um - b.total_growth_um);
  for (const crystal of sorted) {
    if (crystal.dissolved) continue;
    this.wall_state.paintCrystal(crystal);
  }
  // Snapshot ring[0] for the Replay button. Shallow clone of each
  // cell's render-relevant fields — including base_radius_mm so the
  // Phase-1 Fourier profile is preserved across replay frames.
  const snap = new Array(this.wall_state.rings[0].length);
  for (let i = 0; i < snap.length; i++) {
    const c = this.wall_state.rings[0][i];
    snap[i] = {
      wall_depth: c.wall_depth,
      crystal_id: c.crystal_id,
      mineral: c.mineral,
      thickness_um: c.thickness_um,
      base_radius_mm: c.base_radius_mm,
    };
  }
  this.wall_state_history.push(snap);
},

  _wallCellsBlockedByCrystals() {
  // Which ring-0 cells are shielded from wall dissolution. A cell
  // blocks when it holds a non-dissolved crystal whose mineral is
  // stable at the current pH — either permanently acid-stable
  // (acid_dissolution == null, e.g. uraninite/molybdenite) or the
  // current pH is above its threshold.
  const ph = this.conditions.fluid.pH;
  const byId = new Map<number, any>(this.crystals.map(c => [c.crystal_id, c]));
  const blocked = new Set();
  const ring0 = this.wall_state.rings[0];
  for (let i = 0; i < ring0.length; i++) {
    const cell = ring0[i];
    if (cell.crystal_id == null) continue;
    const crystal = byId.get(cell.crystal_id);
    if (!crystal || crystal.dissolved) continue;
    const acid = MINERAL_SPEC[crystal.mineral]?.acid_dissolution;
    if (acid == null) { blocked.add(i); continue; }
    const threshold = acid.pH_threshold;
    if (threshold == null || ph >= threshold) blocked.add(i);
  }
  return blocked;
},

  get_vug_fill() {
  const vugR = this.conditions.wall.vug_diameter_mm / 2;
  const vugVol = (4 / 3) * Math.PI * Math.pow(vugR, 3);
  if (vugVol <= 0) return 0;
  let crystalVol = 0;
  for (const c of this.crystals) {
    if (!c.active) continue;
    const a = c.c_length_mm / 2;
    const b = c.a_width_mm / 2;
    crystalVol += (4 / 3) * Math.PI * a * b * b;
  }
  return crystalVol / vugVol;
},

  // When a big crystal grows past an adjacent smaller one that's stopped
// growing, the smaller crystal becomes an inclusion inside the bigger
// one. Classic "Sweetwater mechanism" — pyrite first, then calcite
// grows around it. Ports check_enclosure from vugg.py 1:1.
_check_enclosure() {
  for (const grower of this.crystals) {
    if (!grower.active || grower.c_length_mm < 0.5) continue;
    if (grower.enclosed_by != null) continue;
    for (const candidate of this.crystals) {
      if (candidate.crystal_id === grower.crystal_id) continue;
      if (candidate.enclosed_by != null) continue;
      if (grower.enclosed_crystals.includes(candidate.crystal_id)) continue;

      const sizeRatio = grower.c_length_mm / Math.max(candidate.c_length_mm, 0.001);
      const adjacent = (
        candidate.position === grower.position
        || candidate.position.includes(`#${grower.crystal_id}`)
      );
      // Require the candidate to have actually lived a bit before it
      // can be swallowed. Without this, a just-nucleated crystal with
      // zero zones qualifies on step 1 and gets enveloped before it
      // grows a single face — 600 inclusions pile up in a loop of
      // nucleate-then-instantly-enclose. Real Sweetwater-style
      // pyrite needs time to exhaust its chemistry and stop growing
      // before the calcite takes it.
      if (!candidate.zones || candidate.zones.length < 3) continue;
      const recent = candidate.zones.slice(-3).reduce((s, z) => s + z.thickness_um, 0);
      const slowing = recent < 3.0;
      if (sizeRatio > 3.0 && adjacent && slowing) {
        grower.enclosed_crystals.push(candidate.crystal_id);
        grower.enclosed_at_step.push(this.step);
        candidate.enclosed_by = grower.crystal_id;
        candidate.active = false;
        this.log.push(
          `  💎 ENCLOSURE: ${capitalize(grower.mineral)} #${grower.crystal_id} ` +
          `(${grower.c_length_mm.toFixed(1)}mm) has grown around ` +
          `${candidate.mineral} #${candidate.crystal_id} (${candidate.c_length_mm.toFixed(2)}mm). ` +
          `The ${candidate.mineral} is now an inclusion inside the ${grower.mineral}.`
        );
      }
    }
  }
},

  // When the host crystal is dissolving back past the point it enclosed
// a neighbor, the neighbor is freed. Ports check_liberation from
// vugg.py 1:1.
_check_liberation() {
  for (const host of this.crystals) {
    if (!host.enclosed_crystals.length) continue;
    if (!host.dissolved) continue;
    const freed = [];
    for (let i = 0; i < host.enclosed_crystals.length; i++) {
      const encId = host.enclosed_crystals[i];
      const encStep = host.enclosed_at_step[i];
      const enc = this.crystals.find(c => c.crystal_id === encId);
      if (!enc) continue;
      let hostSizeAtEnc = 0;
      for (const z of host.zones) if (z.step <= encStep) hostSizeAtEnc += z.thickness_um;
      if (host.total_growth_um < hostSizeAtEnc * 0.7) {
        freed.push(i);
        enc.enclosed_by = null;
        enc.active = true;
        this.log.push(
          `  🔓 LIBERATION: ${enc.mineral} #${encId} freed from ` +
          `dissolving ${host.mineral} #${host.crystal_id}! ` +
          `The inclusion is exposed again and can resume growth.`
        );
      }
    }
    for (const i of freed.sort((a, b) => b - a)) {
      host.enclosed_crystals.splice(i, 1);
      host.enclosed_at_step.splice(i, 1);
    }
  }
},
});
