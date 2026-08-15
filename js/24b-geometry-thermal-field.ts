// ============================================================
// js/24b-geometry-thermal-field.ts — localized cavity heat transport
// ============================================================
//
// This is a deliberately dimensionless, local-thermal-equilibrium (LTE)
// transport model.  The simulator has no calibrated voxel length or step
// duration, so its controls are fractions exchanged per simulation step — not
// m²/s, watts, or a claim that rock and water temperatures are resolved
// separately.  The numerical pieces follow the heat-transport structure used
// by hydrogeology models: symmetric conduction, directional advection, and
// explicit boundary sources/sinks.

const THERMAL_FIELD_MODEL = 'lte_geometry_weighted_finite_volume_v2';
const THERMAL_FIELD_MIN_C = -273.15;
const THERMAL_FIELD_MAX_C = 2000;
const THERMAL_CONDUCTION_MAX = 1 / 6; // six-neighbour explicit Laplacian

type ThermalFlowDirection =
  | 'none'
  | 'toward_center'
  | 'toward_wall'
  | 'clockwise'
  | 'counterclockwise'
  | 'toward_ceiling'
  | 'toward_floor';

interface ThermalSourceSpec {
  id: string;
  temperature_C: number;
  ringIdx: number;
  cellIdx: number;
  depthIdx: number;
  coupling_fraction_per_step: number;
  advection_fraction_per_step: number;
  flow_direction: ThermalFlowDirection;
  start_step?: number;
  end_step?: number;
  provenance?: string;
}

const _thermalClamp = (value: number, lo: number, hi: number): number => {
  return Math.max(lo, Math.min(hi, value));
};

const normalizeThermalSourceSpec = (spec: any, grid: any, fallbackId = 'thermal-source'): ThermalSourceSpec | null => {
  if (!grid || !spec) return null;
  const temperature = Number(spec.temperature_C ?? spec.temperatureC ?? spec.temperature);
  if (!Number.isFinite(temperature)) return null;
  const gridAuthority = _cavityVoxelGridAuthorityInternal(grid);
  const R = gridAuthority.ringCount;
  const N = gridAuthority.cellsPerRing;
  const D = gridAuthority.depthCount;
  let ringIdx = Number(spec.ringIdx ?? spec.ring ?? 0) | 0;
  let cellIdx = Number(spec.cellIdx ?? spec.column ?? 0) | 0;
  if (Number.isFinite(Number(spec.cell)) && spec.ringIdx == null && spec.ring == null) {
    const flat = Math.max(0, Number(spec.cell) | 0);
    ringIdx = Math.floor(flat / N);
    cellIdx = flat % N;
  }
  const permitted: ThermalFlowDirection[] = [
    'none', 'toward_center', 'toward_wall', 'clockwise', 'counterclockwise',
    'toward_ceiling', 'toward_floor',
  ];
  const requestedDirection = String(spec.flow_direction ?? spec.flowDirection ?? 'toward_center') as ThermalFlowDirection;
  const rawStartStep = spec.start_step ?? spec.startStep;
  const rawEndStep = spec.end_step ?? spec.endStep;
  return {
    id: String(spec.id || fallbackId),
    temperature_C: _thermalClamp(temperature, THERMAL_FIELD_MIN_C, THERMAL_FIELD_MAX_C),
    ringIdx: _thermalClamp(ringIdx, 0, R - 1) | 0,
    cellIdx: ((cellIdx % N) + N) % N,
    depthIdx: _thermalClamp(Number(spec.depthIdx ?? spec.depth ?? 0) | 0, 0, D - 1),
    coupling_fraction_per_step: _thermalClamp(
      Number(spec.coupling_fraction_per_step ?? spec.couplingFraction ?? 0.35) || 0,
      0, 1,
    ),
    advection_fraction_per_step: _thermalClamp(
      Number(spec.advection_fraction_per_step ?? spec.advectionFraction ?? 0.20) || 0,
      0, 1,
    ),
    flow_direction: permitted.includes(requestedDirection) ? requestedDirection : 'toward_center',
    ...(rawStartStep !== null && rawStartStep !== '' && rawStartStep !== undefined
        && Number.isFinite(Number(rawStartStep))
      ? { start_step: Math.max(0, Number(rawStartStep) | 0) } : {}),
    ...(rawEndStep !== null && rawEndStep !== '' && rawEndStep !== undefined
        && Number.isFinite(Number(rawEndStep))
      ? { end_step: Math.max(0, Number(rawEndStep) | 0) } : {}),
    ...(spec.provenance ? { provenance: String(spec.provenance) } : {}),
  };
};

const _thermalSourceActive = (source: ThermalSourceSpec, step: number): boolean => {
  if (source.start_step != null && step < source.start_step) return false;
  if (source.end_step != null && step >= source.end_step) return false;
  return true;
};

// Geometry-aware control-volume proxies. The surface share of each wall
// vertex is assembled from the exact renderer triangles (one triangle's area
// is divided among its non-pole vertices). The cavity interior is then split
// into concentric radial shells, whose r^3 differences supply the volume
// fractions. This is still a dimensionless mesh model—not a calibrated cubic-
// millimetre fluid inventory—but it removes the false equal-volume assumption
// at polar cells and across radial depth.
const THERMAL_CONTROL_VOLUME_STATE = new WeakMap<object, {
  ringCount: number; cellsPerRing: number; depthCount: number;
  mesh: any; surfaceIdentity: any; weights: Float64Array;
}>();

const _thermalControlVolumeWeights = (grid: any): Float64Array => {
  const gridAuthority = _cavityVoxelGridAuthorityInternal(grid);
  const R = gridAuthority.ringCount;
  const N = gridAuthority.cellsPerRing;
  const D = gridAuthority.depthCount;
  const total = gridAuthority.voxelCount;
  const mesh = gridAuthority.mesh;
  const physicalGeometry = mesh ? _wallMeshThermalGeometryInternal(mesh) : null;
  const cached = THERMAL_CONTROL_VOLUME_STATE.get(grid);
  if (cached?.ringCount === R && cached.cellsPerRing === N && cached.depthCount === D
      && cached.mesh === mesh && cached.surfaceIdentity === physicalGeometry?.surfaceIdentity) {
    return cached.weights;
  }

  const surfaceShares = new Float64Array(R * N);
  if (physicalGeometry?.cellSurfaceAreasMm2?.length === R * N) {
    surfaceShares.set(physicalGeometry.cellSurfaceAreasMm2);
  }
  let surfaceTotal = 0;
  for (const value of surfaceShares) surfaceTotal += value;
  if (!(surfaceTotal > 0)) {
    // Analytic latitudinal bands for headless grids. Unlike sin(phi) at a
    // centre point, band integration stays finite at both polar rings.
    for (let r = 0; r < R; r++) {
      const lo = Math.PI * r / R;
      const hi = Math.PI * (r + 1) / R;
      const bandPerCell = Math.max(1e-12, (Math.cos(lo) - Math.cos(hi)) / N);
      for (let c = 0; c < N; c++) surfaceShares[r * N + c] = bandPerCell;
    }
  }

  const weights = new Float64Array(total);
  let weightTotal = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < N; c++) {
      const surfaceIndex = r * N + c;
      let radius = 1;
      if (physicalGeometry?.radialDistancesMm
          && surfaceIndex < physicalGeometry.radialDistancesMm.length) {
        radius = Number(physicalGeometry.radialDistancesMm[surfaceIndex]) || 1;
      }
      for (let d = 0; d < D; d++) {
        const outer = (D - d) / D;
        const inner = (D - d - 1) / D;
        const shellFraction = outer ** 3 - inner ** 3;
        const index = r * N * D + c * D + d;
        // A_outer * R/3 is the sector volume; the common 1/3 cancels
        // during normalization, so omit it to keep the proxy compact.
        const raw = Math.max(1e-18, surfaceShares[surfaceIndex] * radius * shellFraction);
        weights[index] = raw;
        weightTotal += raw;
      }
    }
  }
  if (weightTotal > 0) {
    for (let i = 0; i < weights.length; i++) weights[i] /= weightTotal;
  }
  THERMAL_CONTROL_VOLUME_STATE.set(grid, {
    ringCount: R, cellsPerRing: N, depthCount: D,
    mesh, surfaceIdentity: physicalGeometry?.surfaceIdentity || null, weights,
  });
  return weights;
};

const _thermalSourcePath = (source: ThermalSourceSpec, grid: any): Array<[number, number, number]> => {
  const out: Array<[number, number, number]> = [];
  const gridAuthority = _cavityVoxelGridAuthorityInternal(grid);
  const R = gridAuthority.ringCount;
  const N = gridAuthority.cellsPerRing;
  const D = gridAuthority.depthCount;
  const r = source.ringIdx, c = source.cellIdx, d = source.depthIdx;
  if (source.flow_direction === 'toward_center') {
    for (let k = d + 1; k < D; k++) out.push([r, c, k]);
  } else if (source.flow_direction === 'toward_wall') {
    for (let k = d - 1; k >= 0; k--) out.push([r, c, k]);
  } else if (source.flow_direction === 'clockwise') {
    for (let k = 1; k < N; k++) out.push([r, (c + k) % N, d]);
  } else if (source.flow_direction === 'counterclockwise') {
    for (let k = 1; k < N; k++) out.push([r, (c - k + N) % N, d]);
  } else if (source.flow_direction === 'toward_ceiling') {
    for (let k = r + 1; k < R; k++) out.push([k, c, d]);
  } else if (source.flow_direction === 'toward_floor') {
    for (let k = r - 1; k >= 0; k--) out.push([k, c, d]);
  }
  return out;
};

Object.assign(CavityVoxelGrid.prototype, {
  controlVolumeWeights(): Float64Array {
    return new Float64Array(_thermalControlVolumeWeights(this));
  },

  controlVolumeWeightAt(r: number, c: number, d: number): number {
    const index = this._index(r, c, d);
    return index >= 0 ? _thermalControlVolumeWeights(this)[index] : NaN;
  },

  temperatureAt(r: number, c: number, d: number): number {
    const voxel = this.voxelAt(r, c, d);
    return voxel && Number.isFinite(voxel.temperature) ? voxel.temperature : NaN;
  },

  sampleTemperature(r: number, c: number, depth: number): number {
    if (!Number.isFinite(depth)) return NaN;
    const bounded = _thermalClamp(depth, 0, this.depth_count - 1);
    const d0 = Math.floor(bounded);
    const d1 = Math.min(d0 + 1, this.depth_count - 1);
    const f = bounded - d0;
    const a = this.temperatureAt(r, c, d0);
    const b = this.temperatureAt(r, c, d1);
    return Number.isFinite(a) && Number.isFinite(b) ? a * (1 - f) + b * f : NaN;
  },

  propagateTemperatureDelta(deltaC: number, target: string = 'all'): number {
    if (!Number.isFinite(deltaC) || deltaC === 0) return 0;
    const gridAuthority = _cavityVoxelGridAuthorityInternal(this);
    let changed = 0;
    for (let index = 0; index < gridAuthority.voxelCount; index++) {
      const voxel = gridAuthority.voxels[index];
      if (!voxel || !Number.isFinite(voxel.temperature)) continue;
      const depthIdx = index % gridAuthority.depthCount;
      const ringIdx = Math.floor(index
        / (gridAuthority.cellsPerRing * gridAuthority.depthCount));
      const hit = target === 'all'
        || (target === 'boundary' && depthIdx === 0)
        || (target === 'top' && ringIdx === gridAuthority.ringCount - 1)
        || (target === 'bottom' && ringIdx === 0);
      if (!hit) continue;
      voxel.temperature = _thermalClamp(
        voxel.temperature + deltaC, THERMAL_FIELD_MIN_C, THERMAL_FIELD_MAX_C,
      );
      changed++;
    }
    return changed;
  },

  // Apply passive cooling and fracture heating as distinct boundary terms.
  // Cooling is one-way for every local control volume: a cell warmer than the
  // authored environment approaches it but cannot cross it, while a cell that
  // is already colder is left unchanged. A separately receipted positive
  // fracture pulse may then heat all cells.
  applyAmbientThermalStep(coolingDeltaC: number, ambientC: number, pulseDeltaC = 0): number {
    if (!Number.isFinite(ambientC)) return 0;
    const gridAuthority = _cavityVoxelGridAuthorityInternal(this);
    const cooling = Math.min(0, Number(coolingDeltaC) || 0);
    const pulse = Math.max(0, Number(pulseDeltaC) || 0);
    let changed = 0;
    for (const voxel of gridAuthority.voxels) {
      if (!voxel || !Number.isFinite(voxel.temperature)) continue;
      const prior = voxel.temperature;
      const cooled = prior > ambientC ? Math.max(ambientC, prior + cooling) : prior;
      voxel.temperature = _thermalClamp(
        cooled + pulse, THERMAL_FIELD_MIN_C, THERMAL_FIELD_MAX_C,
      );
      if (voxel.temperature !== prior) changed++;
    }
    return changed;
  },

  temperatureMean(): number {
    const gridAuthority = _cavityVoxelGridAuthorityInternal(this);
    const weights = _thermalControlVolumeWeights(this);
    let sum = 0, weightTotal = 0;
    for (let i = 0; i < gridAuthority.voxelCount; i++) {
      const voxel = gridAuthority.voxels[i];
      if (!voxel || !Number.isFinite(voxel.temperature)) continue;
      sum += voxel.temperature * weights[i];
      weightTotal += weights[i];
    }
    return weightTotal ? sum / weightTotal : NaN;
  },

  boundaryTemperatureMeans(): number[] {
    const gridAuthority = _cavityVoxelGridAuthorityInternal(this);
    const means = new Array(gridAuthority.ringCount).fill(0);
    const weightTotals = new Array(gridAuthority.ringCount).fill(0);
    const weights = _thermalControlVolumeWeights(this);
    for (let r = 0; r < gridAuthority.ringCount; r++) {
      for (let c = 0; c < gridAuthority.cellsPerRing; c++) {
        const t = this.temperatureAt(r, c, 0);
        if (!Number.isFinite(t)) continue;
        const weight = weights[this._index(r, c, 0)];
        means[r] += t * weight;
        weightTotals[r] += weight;
      }
      means[r] = weightTotals[r] ? means[r] / weightTotals[r] : NaN;
    }
    return means;
  },

  // One stable explicit LTE finite-volume transport step. Pair exchanges use
  // a symmetric shared-face proxy and inverse control-volume temperature
  // updates, conserving the volume-weighted thermal-state proxy exactly.
  // Rock coupling and authored sources are open boundaries and are receipted.
  advanceTemperatureField(options: any = {}): any {
    const gridAuthority = _cavityVoxelGridAuthorityInternal(this);
    const total = gridAuthority.voxelCount;
    const voxels = gridAuthority.voxels;
    const beforeMean = this.temperatureMean();
    const conduction = _thermalClamp(
      Number(options.conduction_fraction_per_step ?? 0.05) || 0,
      0, THERMAL_CONDUCTION_MAX,
    );
    const old = new Float64Array(total);
    const weights = _thermalControlVolumeWeights(this);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < total; i++) {
      const value = Number(voxels[i]?.temperature);
      old[i] = Number.isFinite(value) ? value : beforeMean;
      min = Math.min(min, old[i]);
      max = Math.max(max, old[i]);
    }
    const R = gridAuthority.ringCount;
    const N = gridAuthority.cellsPerRing;
    const D = gridAuthority.depthCount;
    const ND = N * D;
    if (conduction > 0 && max - min > 1e-12) {
      const energyDelta = new Float64Array(total);
      const exchangePair = (i: number, j: number) => {
        const conductance = Math.min(weights[i], weights[j]);
        const exchange = conduction * conductance * (old[j] - old[i]);
        energyDelta[i] += exchange;
        energyDelta[j] -= exchange;
      };
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < N; c++) {
          for (let d = 0; d < D; d++) {
            const i = r * ND + c * D + d;
            // Each undirected face is visited once. N=1/2 need special
            // handling so the periodic angular neighbor is not double-booked.
            if (N > 1 && (N > 2 || c === 0)) exchangePair(i, r * ND + ((c + 1) % N) * D + d);
            if (r + 1 < R) exchangePair(i, i + ND);
            if (d + 1 < D) exchangePair(i, i + 1);
          }
        }
      }
      for (let i = 0; i < total; i++) {
        voxels[i].temperature = old[i] + energyDelta[i] / weights[i];
      }
    }

    const afterConductionMean = this.temperatureMean();
    const mesh = options.mesh || this._mesh || null;
    const scenario = options.scenario || null;
    const rockCoupling = _thermalClamp(Number(options.wall_coupling_fraction_per_step) || 0, 0, 1);
    let rockControlVolumeDeltaC = 0;
    if (rockCoupling > 0 && scenario?.wall_rock_thermal_buffer_C != null) {
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < N; c++) {
          const i = r * ND + c * D;
          const authoredTarget = wallRockThermalBufferAtMeshVertex(scenario, mesh, r * N + c);
          if (!Number.isFinite(authoredTarget)) continue;
          const target = _thermalClamp(
            authoredTarget, THERMAL_FIELD_MIN_C, THERMAL_FIELD_MAX_C,
          );
          const prior = voxels[i].temperature;
          const next = prior + rockCoupling * (target - prior);
          voxels[i].temperature = next;
          rockControlVolumeDeltaC += weights[i] * (next - prior);
        }
      }
    }

    const sourceReceipts: any[] = [];
    const sources: ThermalSourceSpec[] = (options.sources || [])
      .filter((source: ThermalSourceSpec) => _thermalSourceActive(source, Number(options.step) || 0))
      .slice().sort((a: ThermalSourceSpec, b: ThermalSourceSpec) => a.id.localeCompare(b.id));
    // All source terms read one post-conduction/post-rock snapshot, then combine
    // as a convex weighted update. IDs are provenance only: renaming or
    // reordering otherwise identical sources cannot change the field.
    const sourceBase = new Float64Array(total);
    for (let i = 0; i < total; i++) sourceBase[i] = voxels[i].temperature;
    const contributions: Array<Array<{
      sourceIndex: number; weight: number; target: number; coupling: boolean;
    }>> = Array.from({ length: total }, () => []);
    const receiptDrafts: any[] = [];
    const flatIndex = (r: number, c: number, d: number) => r * ND + c * D + d;
    for (const source of sources) {
      const originIndex = flatIndex(source.ringIdx, source.cellIdx, source.depthIdx);
      if (!voxels[originIndex]) continue;
      const sourceIndex = receiptDrafts.length;
      const beta = source.coupling_fraction_per_step;
      if (beta > 0) contributions[originIndex].push({
        sourceIndex, weight: beta, target: source.temperature_C, coupling: true,
      });
      const path = _thermalSourcePath(source, this)
        .map(([r, c, d]) => flatIndex(r, c, d))
        .filter((index: number) => !!voxels[index]);
      const advectiveWeight = source.advection_fraction_per_step;
      const conditionedOrigin = sourceBase[originIndex]
        + beta * (source.temperature_C - sourceBase[originIndex]);
      for (let i = 0; i < path.length && advectiveWeight > 0; i++) {
        const upstreamTarget = i === 0 ? conditionedOrigin : sourceBase[path[i - 1]];
        contributions[path[i]].push({
          sourceIndex, weight: advectiveWeight, target: upstreamTarget, coupling: false,
        });
      }
      receiptDrafts.push({
        id: source.id,
        targetTemperatureC: source.temperature_C,
        controlVolumeDeltaC: 0,
        sourceCouplingControlVolumeDeltaC: 0,
        advectionControlVolumeDeltaC: 0,
        pathCells: path.length,
        flowDirection: source.flow_direction,
        provenance: source.provenance || null,
      });
    }
    for (let i = 0; i < total; i++) {
      const terms = contributions[i];
      if (!terms.length) continue;
      const totalWeight = terms.reduce((sum, term) => sum + term.weight, 0);
      const scale = 1 / Math.max(1, totalWeight);
      let delta = 0;
      for (const term of terms) {
        const attributed = scale * term.weight * (term.target - sourceBase[i]);
        delta += attributed;
        const receipt = receiptDrafts[term.sourceIndex];
        const volumeAttributed = weights[i] * attributed;
        receipt.controlVolumeDeltaC += volumeAttributed;
        if (term.coupling) receipt.sourceCouplingControlVolumeDeltaC += volumeAttributed;
        else receipt.advectionControlVolumeDeltaC += volumeAttributed;
      }
      voxels[i].temperature = _thermalClamp(
        sourceBase[i] + delta, THERMAL_FIELD_MIN_C, THERMAL_FIELD_MAX_C,
      );
    }
    sourceReceipts.push(...receiptDrafts);

    const afterMean = this.temperatureMean();
    return {
      model: THERMAL_FIELD_MODEL,
      step: Number(options.step) || 0,
      voxelCount: total,
      beforeMeanC: beforeMean,
      afterConductionMeanC: afterConductionMean,
      afterMeanC: afterMean,
      conductionControlVolumeResidualC: afterConductionMean - beforeMean,
      rockControlVolumeDeltaC,
      sources: sourceReceipts,
      unitsDisclosure: 'exchange fractions are per simulation step; deltas are normalized geometry-weighted control-volume × °C proxies, not joules or calibrated fluid volumes',
    };
  },
});
