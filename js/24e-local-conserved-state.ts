// Production local-state foundation v1. Dormant for every existing scenario.
// This is an initialization/checkpoint authority, NOT an activated chemistry
// model. Legacy ppm fluids are never converted implicitly or kept as a second
// mutable representation of these inventories.
const LOCAL_CELL_INVENTORY_SCHEMA = 'vugg-local-cell-inventory-v1';
const LOCAL_STATE_FOUNDATION_SCHEMA = 'vugg-local-state-foundation-v1';
const LOCAL_STATE_FOUNDATION_CAPABILITIES = Object.freeze({
  mode: 'inventory-only', reactions: false, transport: false,
  carbonateBuffer: false, legacyProjection: false,
});
const LOCAL_STATE_FOUNDATION_BY_SIM = new WeakMap<object, any>();
const LOCAL_STATE_FOUNDATION_BY_GRID = new WeakMap<object, any>();
const LOCAL_CELL_MOLE_FIELDS = Object.freeze(['dicMolC', 'calciumMol', 'ironMol', 'sulfateMol', 'oxygenMol']);

function _localStateExactKeys(value: any, keys: readonly string[], label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== keys.length
      || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new TypeError(`${label}: complete explicit fields required; no legacy/pH inference`);
  }
}

function validateLocalCellInventory(input: any): any {
  _localStateExactKeys(input, ['schema', 'waterKg', ...LOCAL_CELL_MOLE_FIELDS,
    'alkalinityEq', 'temperatureC', 'fluidPressureKbar', 'pHModel'], 'local cell inventory');
  if (input.schema !== LOCAL_CELL_INVENTORY_SCHEMA) throw new TypeError('Unsupported local cell schema');
  for (const key of ['waterKg', ...LOCAL_CELL_MOLE_FIELDS, 'alkalinityEq', 'temperatureC', 'fluidPressureKbar']) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key])) throw new TypeError(`Nonfinite local inventory ${key}`);
  }
  for (const key of ['waterKg', ...LOCAL_CELL_MOLE_FIELDS]) {
    if (input[key] < 0) throw new RangeError(`Negative local inventory ${key}`);
  }
  if (input.waterKg === 0 && [...LOCAL_CELL_MOLE_FIELDS, 'alkalinityEq'].some(k => input[k] !== 0)) {
    throw new RangeError('A dry cell cannot carry dissolved inventory in schema v1');
  }
  if (input.temperatureC <= -273.15 || input.fluidPressureKbar <= 0) throw new RangeError('Invalid local thermodynamic coordinates');
  if (!['unresolved', 'existing-reduced-carbonate-v1'].includes(input.pHModel)) throw new TypeError('Unsupported local pH model');
  return Object.freeze({...input});
}

function localCellInventoryPH(input: any): any {
  const c = validateLocalCellInventory(input);
  const unresolved = (reason: string) => Object.freeze({status: 'unresolved', pH: null, reason});
  if (c.waterKg === 0) return unresolved('dry-cell');
  if (c.pHModel === 'unresolved') return unresolved('no-commissioned-speciation-model');
  if (c.ironMol !== 0 || c.sulfateMol !== 0) return unresolved('iron-sulfate-speciation-not-commissioned');
  if (c.temperatureC < 0 || c.temperatureC > 90
      || Math.abs(c.fluidPressureKbar - 0.00101325) > 1e-12) return unresolved('outside-reduced-model-envelope');
  // Reuse the existing reduced carbonate equations, without modifying them.
  // Carbon/alkalinity are independent authored inventories; pH is not an input.
  const result = solvePHForReducedCarbonateAlkalinityResult(
    c.dicMolC / c.waterKg, c.alkalinityEq / c.waterKg, c.temperatureC,
  );
  if (!result.ok) return unresolved(`reduced-carbonate-${result.error}`);
  return Object.freeze({status: 'model-estimate', pH: result.pH,
    model: 'existing-reduced-carbonate-v1', residualEqKg: result.residualEqKg,
    authority: 'diagnostic-only-no-production-feedback',
    limitations: Object.freeze(['no-ion-activities-or-calcium-complexation',
      'no-unrecorded-buffer-or-redox-speciation', 'no-full-solvent-H-O-closure'])});
}

function _localStateFoundationContext(sim: any): any {
  if (!sim || sim.step !== 0 || sim.crystals?.length !== 0 || !sim.wall_state?.voxelGridFor) {
    throw new Error('Local state foundation requires a fresh, unadvanced simulator');
  }
  const grid = sim.wall_state.voxelGridFor(sim);
  const authority = _cavityVoxelGridAuthorityInternal(grid);
  const legacyProjection = simulationStateProjection(sim);
  delete legacyProjection.localConservedFoundation;
  return {grid, authority, fingerprint: sha256HexUtf8(JSON.stringify(legacyProjection))};
}

function validateLocalStateFoundationSnapshot(input: any): any {
  _localStateExactKeys(input, ['schema', 'capabilities', 'provenance', 'legacyInitializationFingerprint',
    'dimensions', 'cells'], 'local state snapshot');
  if (input.schema !== LOCAL_STATE_FOUNDATION_SCHEMA) throw new TypeError('Unsupported local state schema');
  _localStateExactKeys(input.capabilities, Object.keys(LOCAL_STATE_FOUNDATION_CAPABILITIES), 'local capabilities');
  for (const [key, value] of Object.entries(LOCAL_STATE_FOUNDATION_CAPABILITIES)) {
    if (input.capabilities[key] !== value) throw new Error(`Local state feature boundary closed: ${key}`);
  }
  _localStateExactKeys(input.provenance, ['kind', 'reference'], 'local provenance');
  if (input.provenance.kind !== 'explicit-component-inventories'
      || typeof input.provenance.reference !== 'string' || !input.provenance.reference.trim()) {
    throw new TypeError('Local state requires explicit inventory provenance; no pH-only migration');
  }
  if (typeof input.legacyInitializationFingerprint !== 'string'
      || !/^[a-f0-9]{64}$/.test(input.legacyInitializationFingerprint)) throw new TypeError('Missing initialization binding');
  const dims = input.dimensions;
  _localStateExactKeys(dims, ['rings', 'cellsPerRing', 'depths'], 'local dimensions');
  if (Object.values(dims).some(n => !Number.isSafeInteger(n) || Number(n) < 1)) throw new RangeError('Invalid local dimensions');
  const count = dims.rings * dims.cellsPerRing * dims.depths;
  if (!Number.isSafeInteger(count) || !Array.isArray(input.cells) || input.cells.length !== count) {
    throw new RangeError('Local inventory must cover every canonical cell exactly once');
  }
  // Array.from visits holes too; Array#map would silently accept missing cells.
  const cells = Array.from(input.cells, (row: any, index: number) => {
    _localStateExactKeys(row, ['address', 'inventory'], 'local cell');
    const expected = [Math.floor(index/(dims.cellsPerRing*dims.depths)),
      Math.floor(index/dims.depths)%dims.cellsPerRing, index%dims.depths];
    if (!Array.isArray(row.address) || row.address.length !== 3
        || expected.some((n: number, i: number) => row.address[i] !== n)) throw new RangeError('Local cell address/order mismatch');
    return Object.freeze({address: Object.freeze(expected), inventory: validateLocalCellInventory(row.inventory)});
  });
  return Object.freeze({schema: LOCAL_STATE_FOUNDATION_SCHEMA,
    capabilities: LOCAL_STATE_FOUNDATION_CAPABILITIES,
    provenance: Object.freeze({...input.provenance}),
    legacyInitializationFingerprint: input.legacyInitializationFingerprint,
    dimensions: Object.freeze({...dims}), cells: Object.freeze(cells)});
}

function createLocalStateFoundationSnapshot(sim: any, cells: any[], reference: string): any {
  const {authority, fingerprint} = _localStateFoundationContext(sim);
  return validateLocalStateFoundationSnapshot({schema: LOCAL_STATE_FOUNDATION_SCHEMA,
    capabilities: LOCAL_STATE_FOUNDATION_CAPABILITIES,
    provenance: {kind: 'explicit-component-inventories', reference},
    legacyInitializationFingerprint: fingerprint,
    dimensions: {rings: authority.ringCount, cellsPerRing: authority.cellsPerRing, depths: authority.depthCount}, cells});
}

function installLocalStateFoundation(sim: any, input: any): any {
  const record = validateLocalStateFoundationSnapshot(input);
  const {grid, authority, fingerprint} = _localStateFoundationContext(sim);
  if (LOCAL_STATE_FOUNDATION_BY_SIM.has(sim) || LOCAL_STATE_FOUNDATION_BY_GRID.has(grid)) throw new Error('Local foundation already installed');
  if (record.legacyInitializationFingerprint !== fingerprint
      || record.dimensions.rings !== authority.ringCount
      || record.dimensions.cellsPerRing !== authority.cellsPerRing
      || record.dimensions.depths !== authority.depthCount) throw new Error('Local initialization/geometry binding mismatch');
  // Atomic publication: complete validation precedes both bindings. No copies
  // are written into legacy fluids or voxel own properties.
  LOCAL_STATE_FOUNDATION_BY_SIM.set(sim, record);
  LOCAL_STATE_FOUNDATION_BY_GRID.set(grid, record);
  return record;
}

function localStateFoundationFor(sim: any): any {
  return LOCAL_STATE_FOUNDATION_BY_SIM.get(sim) || null;
}

function serializeLocalStateFoundation(sim: any): string {
  const record = localStateFoundationFor(sim);
  if (!record) throw new Error('Legacy state has no explicit conserved inventory to serialize');
  if (_localStateFoundationContext(sim).fingerprint !== record.legacyInitializationFingerprint) {
    throw new Error('Legacy state changed outside the closed local foundation boundary');
  }
  return JSON.stringify(record);
}

function restoreLocalStateFoundation(sim: any, text: string): any {
  if (typeof text !== 'string') throw new TypeError('Local checkpoint must be serialized JSON');
  return installLocalStateFoundation(sim, JSON.parse(text));
}

function assertLegacyStepHasNoLocalStateFoundation(sim: any): void {
  if (LOCAL_STATE_FOUNDATION_BY_SIM.has(sim)) {
    throw new Error('Local state foundation is inventory-only: growth/reactions are not commissioned');
  }
}

function assertLegacyDiffusionHasNoLocalStateFoundation(grid: any): void {
  if (LOCAL_STATE_FOUNDATION_BY_GRID.has(grid)) {
    throw new Error('Local state foundation is inventory-only: component transport is not commissioned');
  }
}

function assertLegacySaveHasNoLocalStateFoundation(sim: any): void {
  if (localStateFoundationFor(sim)) {
    throw new Error('Legacy recipe save cannot preserve local inventories; use the versioned local checkpoint');
  }
}
