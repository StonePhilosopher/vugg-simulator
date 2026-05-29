// ============================================================
// js/85g-strip-recorder.ts — helicoid-as-recorder for strip view
// ============================================================
// Phase B (post-Phase-1 carbonate): strip view bedrock.
//
// THE HELICOID-AS-RECORDER REFRAME (Shy's framing, 2026-05-26)
//
// This module promotes the helicoid from a visualization to an
// instrument. Each sim step, the recorder samples every chip in
// _HELIX_CHEM_PARAMS at every (angular_index, height) position and
// quantizes the value into the strip dataset's chip_data tensor.
// Nucleation events from this step are also captured into the dataset's
// sparse event list.
//
// HOOK POINT: end of VugSimulator.run_step() — see js/85-simulator.ts
// after _diffuseRingState(), before return. Single line addition:
//   if (this._stripRecorder) this._stripRecorder.captureStep(this);
//
// LIFECYCLE
//
//   1. At sim construction OR scenario load, instantiate the recorder
//      with the duration_steps from the scenario (so chip_data is
//      pre-allocated). The recorder reads _HELIX_CHEM_PARAMS once and
//      bakes the chip manifest.
//
//   2. After every run_step(), the recorder's captureStep(sim) writes
//      one step's slice of chip_data and appends any nucleation events
//      from this step.
//
//   3. At run end (sim sealed, or duration_steps reached, or user
//      stops manually), finalize() returns the complete dataset for
//      handoff to IndexedDB (85h-strip-storage.ts).
//
// ANGULAR DOWNSAMPLING (120 native cells → 24 sub-strips)
//
// The wall has cells_per_ring = 120 (15° native resolution would be 24,
// but the wall's mesh is finer for cavity-surface rendering). Strip view
// commits to 24 angular sub-strips per design (15° per sub-strip). The
// recorder downsamples by picking ONE representative cell per angular
// bin — the midpoint cell (cell = bin_start + bin_size/2). This is
// equivalent to averaging when chips are cell-uniform (which is true
// for ~58 of the 59 chips today; only `wall` distance varies per cell.
// `concentration` (v161) varies per ring once drying begins but stays
// cell-uniform within a ring, so the representative cell captures it).
//
// When future spatial chemistry expansion makes chips per-cell aware,
// the representative-cell approach still works — it just becomes a
// nearest-neighbor downsample. Upgrading to true averaging would
// require 5× more chip-read calls per step (~22K → ~111K) and is
// deferred until measurable signal benefit exists.
//
// PERFORMANCE
//
// Per step cost: ~24 angles × 16 rings × 59 chips = ~23K chip.read()
// calls. At ~5M JS function calls/sec, that's ~5 ms per step.
// For a 200-step scenario: ~1 second total recording overhead.
// Acceptable. If perf becomes an issue:
//   - Skip chips disabled in the recorder config
//   - Sample only every Nth step (e.g., every 2-5 steps)
//   - Downsample further (12 sub-strips at 30° each)
//
// ============================================================

// Avoid TypeScript collisions with ambient declarations in 99j-helix-overlay.ts:
// we reference _HELIX_CHEM_PARAMS, stripQuantize, stripAllocateData, etc.
// from this file's scope. Since SCRIPT-mode TS treats these as global,
// no imports needed.

// === HELIX-OVERLAY-FORK ADDITION (strip view bedrock, v149+) =========

// Default angular resolution for sub-strips. 24 × 15° = 360°. Boss-
// committed (locked design 2026-05-26).
const _STRIP_DEFAULT_ANGULAR_INDICES = 24;

class StripRecorder {
  // Manifest + chip metadata, frozen at construction.
  private manifest: StripManifest;
  // Reference to runtime chip params for read functions. Same order as
  // manifest.chips. We snapshot the array reference, not the entries,
  // so toolbar toggles don't affect what we record (recorder always
  // captures everything; visibility is a viewer concern).
  private chipsRuntime: any[];
  // Mapping from sub-strip angular_index (0..23) to native cell index
  // (the midpoint cell within that angular bin). Precomputed at
  // construction.
  private cellForAngle: number[];
  // The chip_data tensor — uint8 array, [step][angle][height][chip]
  // row-major. Allocated once at construction; recorder fills slice
  // by slice as captureStep() is called.
  private chipData: Uint8Array;
  // Sparse nucleation event list. Appended to in captureStep().
  private events: StripNucleationEvent[];
  // Track how many crystals existed at the start of each step so we
  // can detect new nucleations via simple delta.
  private lastSeenCrystalCount: number;
  // Step counter — the next step index to write into chipData.
  private capturedSteps: number;
  // Whether the recorder is still accepting steps. Goes false on
  // finalize() OR when capturedSteps reaches axes.steps.
  private active: boolean;

  constructor(sim: any, opts?: {
    angular_indices?: number,
    duration_steps?: number,
    notes?: string,
  }) {
    const o = opts || {};

    // Cache the runtime chip list. The _HELIX_CHEM_PARAMS module is a
    // const after IIFE init; safe to reference directly.
    const params = (typeof _HELIX_CHEM_PARAMS !== 'undefined') ? _HELIX_CHEM_PARAMS : [];
    this.chipsRuntime = params;

    // Build the chip manifest (durable metadata only — no functions).
    const chips: StripChipMeta[] = params.map((p: any) => ({
      id: String(p.id),
      label: String(p.label || p.id),
      system: this._classifyChipSystem(p),
      range: [Number(p.min), Number(p.max)] as [number, number],
      units: this._inferChipUnits(p),
      color: Number(p.color) >>> 0,
    }));

    // Read scenario context off the sim.
    const wall = sim?.wall_state || sim?.conditions?.wall;
    const height_positions = Math.max(1, Number(wall?.ring_count) || 16);
    const angular_indices = Math.max(1, Math.floor(Number(o.angular_indices ?? _STRIP_DEFAULT_ANGULAR_INDICES)));
    const cells_per_ring = Math.max(1, Number(wall?.cells_per_ring) || 120);
    const steps = Math.max(1, Math.floor(Number(o.duration_steps) || sim?.conditions?._scenario?.duration_steps || 100));

    // Phase 3 radial depth axis (PROPOSAL-CAVITY-INTERIOR-VOXELS). Read
    // the cavity voxel grid's slice count (4: boundary/near-wall/interior/
    // center). If the grid isn't available (headless harness, or a build
    // without CavityVoxelGrid), fall back to 1 — a depth-collapsed,
    // wall-only recording that's format-compatible with format_version 1.
    let depth_positions = 1;
    try {
      const grid = (wall && typeof wall.voxelGridFor === 'function')
        ? wall.voxelGridFor(sim) : null;
      if (grid && grid.depth_count > 0) depth_positions = grid.depth_count | 0;
    } catch (_e) { depth_positions = 1; }

    // Precompute angle → midpoint native cell.
    this.cellForAngle = new Array(angular_indices);
    const binSize = cells_per_ring / angular_indices;
    for (let a = 0; a < angular_indices; a++) {
      this.cellForAngle[a] = Math.floor(a * binSize + binSize / 2) % cells_per_ring;
    }

    this.manifest = {
      format_version: 2,
      sim_version: Number((sim && sim.SIM_VERSION) || (typeof SIM_VERSION !== 'undefined' ? SIM_VERSION : 0)),
      scenario_id: String(sim?.conditions?._scenario?.id || sim?.conditions?._scenario_id || 'unknown'),
      seed: Number(sim?._seed || 42),
      recorded_at: Date.now(),
      duration_steps: steps,
      axes: { steps, angular_indices, height_positions, depth_positions },
      chips,
      notes: o.notes,
    };

    this.chipData = stripAllocateData(this.manifest.axes, chips.length);
    this.events = [];
    this.lastSeenCrystalCount = Array.isArray(sim?.crystals) ? sim.crystals.length : 0;
    this.capturedSteps = 0;
    this.active = true;
  }

  // ---- chip classification helpers ----------------------------------

  // Group chips into the same systems the helicoid legend uses. The
  // strip view selector mirrors this grouping.
  private _classifyChipSystem(p: any): string {
    const id = String(p?.id || '');
    if (p?.primary) return 'wall';
    if (id === 'T' || id === 'pH' || id === 'Eh' || id === 'salinity' || id === 'O2') return 'special';
    // v165: sulfate SI chips (selenite/anhydrite/barite/celestine) read
    // the new 40b sulfateSaturationIndex. Classified into their own
    // 'sulfate' group so the strip-view selector + helicoid legend can
    // toggle them as a set, parallel to the carbonate-system group.
    if (id === 'SI_selenite' || id === 'SI_anhydrite' ||
        id === 'SI_barite'   || id === 'SI_celestine') return 'sulfate';
    if (id === 'DIC' || id === 'CO2aq' || id === 'HCO3' || id === 'CO3_2' ||
        id.startsWith('SI_') || id === 'pCO2' || id === 'f_ord') return 'carbonate';
    return 'ion';
  }

  // Heuristic — chip data doesn't carry units, so we infer them from
  // id. Future improvement: add `units` field to ChemParam.
  private _inferChipUnits(p: any): string {
    const id = String(p?.id || '');
    if (id === 'wall') return 'mm';
    if (id === 'T') return '°C';
    if (id === 'pH') return '';
    if (id === 'Eh') return 'mV';
    if (id === 'salinity') return 'psu';
    if (id.startsWith('SI_')) return 'log Ω';
    if (id === 'f_ord') return '';
    if (id === 'pCO2') return 'atm';
    return 'ppm';
  }

  // ---- main capture path --------------------------------------------

  // v3 (2026-05-26): grow chipData capacity when interactive modes
  // (Fortress / Zen) outrun the initial duration_steps allocation.
  // Doubles the step capacity each time it's hit; keeps overhead
  // amortized O(1) per step.
  private _growCapacity(): void {
    const oldSteps = this.manifest.axes.steps;
    const newSteps = oldSteps * 2;
    const chipCount = this.manifest.chips.length;
    const newAxes = { ...this.manifest.axes, steps: newSteps };
    const D = (newAxes.depth_positions && newAxes.depth_positions > 0) ? newAxes.depth_positions : 1;
    const newSize = newSteps * newAxes.angular_indices * newAxes.height_positions * D * chipCount;
    const grown = new Uint8Array(newSize);
    grown.set(this.chipData);  // preserve existing data
    this.chipData = grown;
    this.manifest = { ...this.manifest, axes: newAxes, duration_steps: newSteps };
  }

  // Called from VugSimulator.run_step() at end-of-step. Records one
  // step's slice of chip data + any new nucleation events this step.
  // Safe to call when the recorder is finished — just becomes a no-op.
  captureStep(sim: any): void {
    if (!this.active) return;
    if (this.capturedSteps >= this.manifest.axes.steps) {
      this._growCapacity();
    }

    const wall = sim?.wall_state || sim?.conditions?.wall;
    const step = this.capturedSteps;
    const axes = this.manifest.axes;
    const chipCount = this.manifest.chips.length;
    const chips = this.chipsRuntime;

    // Walk (angle, height, depth, chip). For each chip, call its runtime
    // read with the representative cell for that angle. The depth axis
    // (Phase 3) is driven via the ambient _setStripChipReadDepth selector
    // in 99j: setting it before the chip-k loop makes _chipFluid pull the
    // voxel grid's interior slice (depth 0 = wall, depth_count-1 = center).
    // Depth-invariant chips (wall geometry, per-ring temperature, global
    // f_ord) return the same value at every depth — recorded redundantly
    // (gzip-friendly: long identical byte runs) rather than special-cased.
    const depthPositions = (axes.depth_positions && axes.depth_positions > 0) ? axes.depth_positions : 1;
    const hasDepthSetter = (typeof _setStripChipReadDepth === 'function');
    for (let a = 0; a < axes.angular_indices; a++) {
      const cellIdx = this.cellForAngle[a];
      for (let h = 0; h < axes.height_positions; h++) {
        for (let d = 0; d < depthPositions; d++) {
          if (hasDepthSetter) _setStripChipReadDepth(d);
          for (let k = 0; k < chipCount; k++) {
            const p = chips[k];
            if (!p || typeof p.read !== 'function') {
              // Missing runtime entry — record null.
              const idx = stripDataIndex(step, a, h, k, axes, chipCount, d);
              if (idx >= 0) this.chipData[idx] = 255; // _STRIP_NULL_BYTE
              continue;
            }
            let val: any;
            try {
              val = p.read(sim, wall, h, cellIdx);
            } catch (_err) {
              val = null;
            }
            const meta = this.manifest.chips[k];
            const byte = stripQuantize(val, meta.range[0], meta.range[1]);
            const idx = stripDataIndex(step, a, h, k, axes, chipCount, d);
            if (idx >= 0) this.chipData[idx] = byte;
          }
        }
      }
    }
    // Reset the ambient depth so nothing else (live helicoid, other
    // consumers) sees a stale interior-slice selector.
    if (hasDepthSetter) _setStripChipReadDepth(0);

    // Capture nucleation events from this step. Crystals carry
    // nucleation_step + wall_anchor.{ringIdx, cellIdx}, so we just
    // walk the newly-added tail of sim.crystals.
    if (Array.isArray(sim?.crystals)) {
      const total = sim.crystals.length;
      for (let i = this.lastSeenCrystalCount; i < total; i++) {
        const c = sim.crystals[i];
        if (!c || c.nucleation_step !== sim.step) continue;
        const anchor = c.wall_anchor;
        const ring = anchor && Number.isFinite(anchor.ringIdx) ? anchor.ringIdx : 0;
        const cell = anchor && Number.isFinite(anchor.cellIdx) ? anchor.cellIdx : 0;
        this.events.push({
          step,
          ring,
          cell,
          mineral: String(c.mineral),
        });
      }
      this.lastSeenCrystalCount = total;
    }

    this.capturedSteps++;
    // v3: no longer deactivate on capacity — _growCapacity handles
    // overflow now. Recorder stays active until finalize() is called
    // externally (run-end for Random/Simulation, mode-leave or seal
    // for Fortress/Zen).
  }

  // ---- finalize ------------------------------------------------------

  // Trim chipData if the run ended before reaching duration_steps
  // (vug sealed early). Returns the complete dataset ready for
  // serialization / IndexedDB.
  finalize(): StripDataset {
    this.active = false;
    if (this.capturedSteps < this.manifest.axes.steps) {
      // Shrink axes.steps + slice chipData to match what we actually
      // captured. Keeps the dataset honest.
      const actual = this.capturedSteps;
      const chipCount = this.manifest.chips.length;
      const oldAxes = this.manifest.axes;
      const D = (oldAxes.depth_positions && oldAxes.depth_positions > 0) ? oldAxes.depth_positions : 1;
      const newSize = actual * oldAxes.angular_indices * oldAxes.height_positions * D * chipCount;
      const trimmed = this.chipData.slice(0, newSize);
      this.manifest = {
        ...this.manifest,
        duration_steps: actual,
        axes: { ...oldAxes, steps: actual },
      };
      this.chipData = trimmed;
    }
    return {
      manifest: this.manifest,
      chip_data: this.chipData,
      nucleation_events: this.events,
    };
  }

  // ---- introspection -------------------------------------------------

  isActive(): boolean { return this.active; }
  capturedStepCount(): number { return this.capturedSteps; }
  getManifest(): StripManifest { return this.manifest; }
}

// === END HELIX-OVERLAY-FORK ADDITION ==================================
