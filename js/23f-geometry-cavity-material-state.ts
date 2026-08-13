// ============================================================
// js/23f-geometry-cavity-material-state.ts
// ============================================================
// Authenticated geological inputs for cavity-wall material appearance. The
// renderer may choose UV or Cartesian triplanar presentation, but it must use
// the lithology, genesis and dissolution-flow state that existed at the frame
// being rendered. In particular, replay may not inherit today's paleo_flow.

const CAVITY_WALL_MATERIAL_STATE_SCHEMA = 'cavity-wall-material-state-v1';
const CAVITY_WALL_MATERIAL_HISTORY_SCHEMA = 'cavity-wall-material-history-v1';

class CavityWallMaterialState {
  static readonly MATRIX_SCALE_UV_PER_MM = Object.freeze([0.05, 0.05]);
  static readonly RELIEF_REFERENCE_SPAN_MM = 50;

  static create(wall: any, opts: any = {}): any {
    if (!wall) throw new TypeError('cavity wall material state requires a wall');
    const lithology = String(wall.matrix || wall.composition || 'limestone');
    const architecture = String(wall.architecture || 'pocket');
    const genesis = wall.genesis == null ? null : String(wall.genesis);
    const paleoFlowValue = Object.prototype.hasOwnProperty.call(opts, 'paleoFlow')
      ? opts.paleoFlow : wall.paleo_flow;
    const paleoFlow = paleoFlowValue == null ? null : Number(paleoFlowValue);
    if (paleoFlow != null && (!(paleoFlow >= 0) || !Number.isFinite(paleoFlow))) {
      throw new RangeError('cavity wall paleo-flow must be finite and non-negative when present');
    }
    const family = typeof _wallReliefFamily === 'function'
      ? _wallReliefFamily(genesis, architecture)
      : ((typeof _WALL_RELIEF_FAMILY !== 'undefined'
        && _WALL_RELIEF_FAMILY[architecture]) || 'scallops');
    const repeat = typeof _wallReliefRepeat === 'function'
      ? _wallReliefRepeat(family, paleoFlow) : [5, 5];
    if (!Array.isArray(repeat) || repeat.length !== 2
        || repeat.some(value => !(Number(value) > 0) || !Number.isFinite(Number(value)))) {
      throw new RangeError('cavity wall relief repeat is invalid');
    }
    const evolution = wall.cavityEvolutionLedger?.();
    const evolutionCursor = evolution && Number.isInteger(wall._cavityEvolutionCursor)
      ? wall._cavityEvolutionCursor : evolution?.cursor ?? null;
    const evolutionSignature = evolution && evolutionCursor != null
      ? evolution.signatureAt(evolutionCursor) : null;
    const receipt: any = {
      schema: CAVITY_WALL_MATERIAL_STATE_SCHEMA,
      lithology,
      architecture,
      genesis,
      cavity_render: wall.cavity_render === 'sharp' ? 'sharp' : 'smooth',
      paleo_flow: paleoFlow,
      relief_family: String(family),
      relief_repeat: [Number(repeat[0]), Number(repeat[1])],
      relief_reference_span_mm: CavityWallMaterialState.RELIEF_REFERENCE_SPAN_MM,
      matrix_scale_uv_per_mm: Array.from(CavityWallMaterialState.MATRIX_SCALE_UV_PER_MM),
      source_evolution_cursor: evolutionCursor,
      source_evolution_signature: evolutionSignature,
    };
    receipt.material_state_digest = CavityEvolutionLedger.digest(receipt);
    CavityEvolutionLedger._deepFreeze(receipt);
    return receipt;
  }

  static assertReceipt(wall: any, stored: any): any {
    if (!stored || stored.schema !== CAVITY_WALL_MATERIAL_STATE_SCHEMA) {
      throw new RangeError('missing or unsupported cavity wall material state receipt');
    }
    const payload = CavityEvolutionLedger._clone(stored);
    const suppliedDigest = payload.material_state_digest;
    delete payload.material_state_digest;
    if (typeof suppliedDigest !== 'string'
        || suppliedDigest !== CavityEvolutionLedger.digest(payload)) {
      throw new RangeError('cavity wall material state receipt digest mismatch');
    }
    const fresh = CavityWallMaterialState.create(wall, { paleoFlow: stored.paleo_flow });
    if (fresh.material_state_digest !== suppliedDigest) {
      throw new RangeError('cavity wall material state differs from authenticated replay');
    }
    return fresh;
  }
}

class CavityWallMaterialHistoryLedger {
  [key: string]: any;

  constructor(wall: any) {
    const identity = CavityEvolutionLedger.identityForWall(wall);
    this.schema = CAVITY_WALL_MATERIAL_HISTORY_SCHEMA;
    this.shape_identity = identity.shape;
    this.tessellation_identity = identity.tessellation;
    this._entries = [];
    this._signatures = [`cavity-wall-material-history:v1:${CavityEvolutionLedger.digest({
      shape_identity: this.shape_identity,
      tessellation_identity: this.tessellation_identity,
    })}`];
  }

  get cursor(): number { return this._entries.length; }
  get signature(): string { return this._signatures[this._signatures.length - 1]; }
  get entries(): readonly any[] { return Object.freeze(this._entries.slice()); }

  signatureAt(cursor: number): string {
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > this.cursor) {
      throw new RangeError('cavity wall material history cursor is invalid');
    }
    return this._signatures[cursor];
  }

  append(step: number, wall: any, materialReceipt: any): any {
    const identity = CavityEvolutionLedger.identityForWall(wall);
    if (identity.shape !== this.shape_identity
        || identity.tessellation !== this.tessellation_identity) {
      throw new RangeError('cavity wall material history geometry identity changed');
    }
    if (!Number.isInteger(step) || step < 0
        || (this.cursor && step < this._entries[this.cursor - 1].step)) {
      throw new RangeError('cavity wall material history step is invalid');
    }
    const authenticated = CavityWallMaterialState.assertReceipt(wall, materialReceipt);
    const evolution = wall.cavityEvolutionLedger?.();
    const payload: any = {
      schema: CAVITY_WALL_MATERIAL_HISTORY_SCHEMA,
      event_id: this.cursor + 1,
      step,
      pre_state_signature: this.signature,
      cavity_evolution_cursor: evolution?.cursor ?? null,
      cavity_evolution_signature: evolution?.signature ?? null,
      material_state_digest: authenticated.material_state_digest,
      paleo_flow: authenticated.paleo_flow,
    };
    payload.entry_digest = CavityEvolutionLedger.digest(payload);
    CavityEvolutionLedger._deepFreeze(payload);
    this._entries.push(payload);
    this._signatures.push(`cavity-wall-material-history:v1:${CavityEvolutionLedger.digest({
      prior: this.signatureAt(this.cursor - 1), entry: payload.entry_digest,
    })}`);
    return payload;
  }

  assertSnapshot(wall: any, snapshot: any): any {
    const identity = CavityEvolutionLedger.identityForWall(wall);
    const cursor = snapshot?.cavity_material_history_cursor;
    if (identity.shape !== this.shape_identity
        || identity.tessellation !== this.tessellation_identity
        || !Number.isInteger(cursor) || cursor < 1 || cursor > this.cursor
        || this.signatureAt(cursor) !== snapshot.cavity_material_history_signature) {
      throw new RangeError('cavity wall material history identity or cursor mismatch');
    }
    const entry = this._entries[cursor - 1];
    const stored = snapshot?.cavity_material_state;
    if (entry.entry_digest !== snapshot.cavity_material_history_entry_digest
        || entry.step !== snapshot.step
        || entry.cavity_evolution_cursor !== snapshot.cavity_evolution_cursor
        || entry.cavity_evolution_signature !== snapshot.cavity_evolution_signature
        || entry.material_state_digest !== stored?.material_state_digest
        || entry.paleo_flow !== stored?.paleo_flow) {
      throw new RangeError('cavity wall material snapshot differs from append-only history');
    }
    CavityWallMaterialState.assertReceipt(wall, stored);
    return entry;
  }
}
