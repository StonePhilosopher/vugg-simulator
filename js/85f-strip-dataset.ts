// ============================================================
// js/85f-strip-dataset.ts — strip view dataset format + codecs
// ============================================================
// Phase B (post-Phase-1 carbonate): strip view bedrock.
//
// THE HELICOID-AS-RECORDER REFRAME (Shy's framing, 2026-05-26)
//
// The helicoid is no longer just a visualization — it's a RECORDING DEVICE
// for multidimensional space. Each step, the recorder samples every chip
// at every (ring, cell) location and persists the values into a strip
// dataset. The live helicoid display is one consumer of that recording;
// strip view (filmstrip paragenesis viewer) is another; future record /
// filter / branch mode is a third.
//
// THIS FILE: the dataset format itself — types, quantization helpers,
// manifest schema. NO IndexedDB code (that's 85h); NO recorder logic
// (that's 85g); NO UI (that's 99k). Pure data-format module.
//
// DESIGN GOALS (see HANDOFF-CARBONATE-PHASE-1-COMPLETE.md §"strip view"):
//
//   1. Future-proof via manifest header — readers know what's in the
//      file without prior agreement. Chips that exist in the manifest
//      but not in the reader's current chip set load gracefully (shown
//      as "legacy chips" in the selector, default off). Chips that the
//      reader knows but aren't in the manifest simply don't appear.
//
//   2. Compact storage — uint8 quantization per chip (each chip's
//      [min, max] range mapped to [0, 254]; value 255 reserved for
//      "null/missing"). 4× smaller than float32 with sub-1% precision
//      loss. Browser DecompressionStream provides 2-5× additional
//      gzip compression for free.
//
//   3. Binary-native — chip_data is a Uint8Array stored directly in
//      IndexedDB (which supports binary natively). No base64 inflation.
//      Manifest + nucleation_events are JSON; the binary blob is a
//      separate field. Serialization for download/share concatenates
//      them.
//
//   4. Time × angle × height × depth × chip indexing — the data tensor
//      is [step][angle][height][depth][chip] in row-major order. angle ∈
//      [0, angular_indices), height ∈ [0, height_positions), depth ∈
//      [0, depth_positions), chip ∈ [0, chips.length).
//
//      DEPTH AXIS (format_version 2, PROPOSAL-CAVITY-INTERIOR-VOXELS
//      Phase 3): the radial dimension of the cavity. depth 0 is the wall
//      (= the d=0 boundary voxel, aliased to the wall mesh cell — what
//      format_version 1 recorded), and depth_positions-1 is the cavity
//      center. The recorder samples the CavityVoxelGrid's stored slices
//      (default 4: boundary / near-wall / interior / center) so the
//      viewer can render radial sub-strips showing the wall→center
//      chemistry gradient — the depletion halos + reservoir replenishment
//      that v160's per-voxel diffusion produces.
//
//      BACKWARD COMPATIBILITY: format_version-1 datasets have no
//      depth_positions in their axes. stripDataIndex / stripAllocateData
//      treat a missing-or-1 depth_positions as the degenerate 1-slice
//      case, in which the 4D index formula collapses EXACTLY to the old
//      3D formula. So v1 datasets load + render unchanged, and the same
//      code path serves both.
//
// SIZE ESTIMATES (typical 200-step × 24 × 16 × 4 × 59 dataset):
//   raw uint8:              200 × 24 × 16 × 4 × 59 = 18.1 MB
//   + manifest + events:    ~5 KB
//   after gzip:             ~1.5 - 3 MB (interior slices are largely
//                           uniform — long byte runs compress well, so
//                           the depth axis costs far less than 4× gzipped)
//   (format_version-1, depth-collapsed: 1/4 of the above)
//
// ============================================================

// === HELIX-OVERLAY-FORK ADDITION (strip view bedrock, v149+) =========

// format_version 2 (2026-05-28): added the depth axis (radial sub-strips).
// v1 datasets (no depth_positions) still load — see the backward-compat
// note above.
//
// format_version 3 (2026-06-03): added the optional DEPLETION-FLOOR channel
// (floor_data) — a parallel tensor, same shape as chip_data, holding the
// per-bin MINIMUM cell value (vs chip_data's representative/midpoint LEVEL).
// The level is byte-identical to v2 (still the midpoint sample); floor is a
// NEW additive channel. It exists so the strip/sonifier can show the per-cell
// depletion halo a crystal carves into the broth — the midpoint-sampled level
// dilutes/misses it (strip-depletion-probe). The recorder fills floor only for
// ION-system chips (the broth that depletes; cheap cell.fluid reads) and sets
// floor=level for the rest, so the shadow is zero-width where there's no
// depletion. BACKWARD COMPAT: v2 datasets have no floor_data — readers treat a
// missing floor_data as "no depletion shadow" and render the level alone.
const _STRIP_FORMAT_VERSION = 3;
const _STRIP_NULL_BYTE = 255;       // reserved value meaning "no data"
const _STRIP_MAX_DATA_BYTE = 254;   // chip values map to [0, 254]

// One chip's metadata in the dataset manifest. Mirrors the runtime
// _HELIX_CHEM_PARAMS entry but is durable (chips can be added/removed
// over sim versions; the manifest preserves what was actually recorded).
interface StripChipMeta {
  id: string;            // matches _HELIX_CHEM_PARAMS.id
  label: string;         // human-readable short label
  system: string;        // grouping: 'wall' | 'special' | 'carbonate' | 'ions'
  range: [number, number]; // [min, max] used for quantization
  units: string;         // 'ppm' | '' | 'log Ω' | etc.
  color: number;         // hex (matches helicoid color for visual consistency)
}

// A nucleation event captured during the run. Sparse — only the steps
// + (ring, cell) pairs where nucleations actually happened. Cell is
// stored in NATIVE 0-119 resolution (not downsampled to 24 angles) so
// the viewer can route the marker to the correct angular sub-strip on
// demand.
interface StripNucleationEvent {
  step: number;          // sim step index
  ring: number;          // 0 to height_positions-1
  cell: number;          // 0 to 119 (native angular cell index)
  mineral: string;       // mineral id
}

// The manifest — JSON-serializable. Header tells the reader what's in
// the binary blob and how to decode it.
interface StripManifest {
  format_version: number;       // _STRIP_FORMAT_VERSION
  sim_version: number;          // SIM_VERSION at time of recording
  scenario_id: string;
  seed: number;
  recorded_at: number;          // unix ms
  duration_steps: number;       // total step count actually captured
  axes: {
    steps: number;              // = duration_steps
    angular_indices: number;    // sub-strip count (default 24, 15° each)
    height_positions: number;   // = wall.ring_count (typically 16)
    depth_positions?: number;   // radial slices (format_version 2; default
                                // 4 = boundary/near-wall/interior/center).
                                // Absent/1 → degenerate wall-only (v1).
  };
  chips: StripChipMeta[];
  notes?: string;               // optional human note ("v148 baseline run", etc.)
}

// Complete in-memory dataset. The binary `chip_data` is stored
// alongside the manifest (separate IndexedDB field) and is NOT
// JSON-serialized.
interface StripDataset {
  manifest: StripManifest;
  chip_data: Uint8Array;        // [step][angle][height][depth][chip] — the LEVEL (midpoint sample)
  nucleation_events: StripNucleationEvent[];
  // format_version 3: per-bin MINIMUM, same shape/indexing as chip_data.
  // The depletion FLOOR — chip_data is the level, floor_data is how far the
  // most-depleted cell in the bin drops below it. Absent on v1/v2 datasets.
  floor_data?: Uint8Array;
}

// ============================================================
// Quantization helpers
// ============================================================

// Quantize a single chip value to uint8. Out-of-range values clamp.
// null/undefined/NaN/non-finite → _STRIP_NULL_BYTE.
function stripQuantize(value: number | null | undefined, min: number, max: number): number {
  if (value === null || value === undefined) return _STRIP_NULL_BYTE;
  if (typeof value !== 'number' || !isFinite(value)) return _STRIP_NULL_BYTE;
  if (max <= min) return _STRIP_NULL_BYTE;
  const normalized = (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, normalized));
  // round to integer in [0, 254]; reserve 255 for null.
  return Math.round(clamped * _STRIP_MAX_DATA_BYTE);
}

// Dequantize a uint8 byte back to a number (or null). Returns the
// reconstructed value in chip-native units (NOT normalized).
function stripDequantize(byte: number, min: number, max: number): number | null {
  if (byte === _STRIP_NULL_BYTE) return null;
  if (byte < 0 || byte > _STRIP_MAX_DATA_BYTE) return null;
  return min + (byte / _STRIP_MAX_DATA_BYTE) * (max - min);
}

// Dequantize to NORMALIZED value (0..1) — what the strip viewer wants
// for per-chip-normalized rendering. Returns null for missing data.
function stripDequantizeNormalized(byte: number): number | null {
  if (byte === _STRIP_NULL_BYTE) return null;
  if (byte < 0 || byte > _STRIP_MAX_DATA_BYTE) return null;
  return byte / _STRIP_MAX_DATA_BYTE;
}

// ============================================================
// Tensor indexing
// ============================================================

// Linear index into the [step][angle][height][depth][chip] row-major
// chip_data array. Validates bounds and returns -1 if out of range.
//
// `depth` is a TRAILING optional param (default 0) so every pre-depth
// caller keeps working untouched. With depth_positions absent-or-1 the
// formula collapses to the original 3D layout (depth must be 0, and the
// D=1 strides equal the old strides), so format_version-1 datasets index
// identically. New (v2) callers pass depth ∈ [0, depth_positions).
function stripDataIndex(
  step: number, angle: number, height: number, chip: number,
  axes: StripManifest['axes'], chip_count: number, depth: number = 0
): number {
  const D = (axes.depth_positions && axes.depth_positions > 0) ? axes.depth_positions : 1;
  if (step < 0 || step >= axes.steps) return -1;
  if (angle < 0 || angle >= axes.angular_indices) return -1;
  if (height < 0 || height >= axes.height_positions) return -1;
  if (depth < 0 || depth >= D) return -1;
  if (chip < 0 || chip >= chip_count) return -1;
  return (
    step * axes.angular_indices * axes.height_positions * D * chip_count +
    angle * axes.height_positions * D * chip_count +
    height * D * chip_count +
    depth * chip_count +
    chip
  );
}

// Allocate a freshly-zeroed chip_data tensor for the given dimensions.
// All bytes start at 0 (which dequantizes to chip.range[0], NOT null).
// The recorder is responsible for filling every byte; if it skips one,
// it should explicitly write _STRIP_NULL_BYTE.
function stripAllocateData(
  axes: StripManifest['axes'], chip_count: number
): Uint8Array {
  const D = (axes.depth_positions && axes.depth_positions > 0) ? axes.depth_positions : 1;
  const total = axes.steps * axes.angular_indices * axes.height_positions * D * chip_count;
  return new Uint8Array(total);
}

// ============================================================
// Serialization (for download / share — NOT IndexedDB)
// ============================================================
//
// IndexedDB stores manifest + chip_data + nucleation_events as
// separate fields (cheap). For DOWNLOAD as a single file, we
// concatenate into a binary blob with a JSON header preamble:
//
//   [4 bytes: manifest_json_length (little-endian uint32)]
//   [manifest_json_length bytes: utf-8 JSON manifest]
//   [4 bytes: events_json_length (little-endian uint32)]
//   [events_json_length bytes: utf-8 JSON nucleation events array]
//   [format_version 3 ONLY: 4 bytes floor_data_length (LE uint32) + that many
//                           floor bytes; length 0 means "no floor channel"]
//   [remainder: chip_data uint8 bytes]
//
// The floor section is keyed off manifest.format_version (read first on
// deserialize), so v1/v2 blobs — which never wrote it — round-trip unchanged.
//
// Optionally the whole blob is gzipped via CompressionStream before
// download. Header byte 0 is the gzip magic (0x1F) when compressed.

async function stripSerialize(
  ds: StripDataset,
  gzip: boolean = true
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const manifestBytes = enc.encode(JSON.stringify(ds.manifest));
  const eventsBytes = enc.encode(JSON.stringify(ds.nucleation_events));
  // Floor section only for format_version ≥ 3. floor_data may be absent even
  // then (e.g. a v3 reader handed a v2-origin dataset) → write length 0.
  const writeFloor = (ds.manifest.format_version || 0) >= 3;
  const floorBytes: Uint8Array | null = (writeFloor && ds.floor_data) ? ds.floor_data : null;
  const floorSection = writeFloor ? (4 + (floorBytes ? floorBytes.length : 0)) : 0;

  const headerSize = 4 + manifestBytes.length + 4 + eventsBytes.length + floorSection;
  const buf = new Uint8Array(headerSize + ds.chip_data.length);
  const dv = new DataView(buf.buffer);
  let offset = 0;
  dv.setUint32(offset, manifestBytes.length, true); offset += 4;
  buf.set(manifestBytes, offset); offset += manifestBytes.length;
  dv.setUint32(offset, eventsBytes.length, true); offset += 4;
  buf.set(eventsBytes, offset); offset += eventsBytes.length;
  if (writeFloor) {
    dv.setUint32(offset, floorBytes ? floorBytes.length : 0, true); offset += 4;
    if (floorBytes) { buf.set(floorBytes, offset); offset += floorBytes.length; }
  }
  buf.set(ds.chip_data, offset);

  if (!gzip) return buf;
  // Browser DecompressionStream is available; CompressionStream is too
  // in modern browsers. If not available, skip compression.
  if (typeof (globalThis as any).CompressionStream !== 'function') {
    return buf;
  }
  const cs = new (globalThis as any).CompressionStream('gzip');
  const stream = new Blob([buf as BlobPart]).stream().pipeThrough(cs);
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

// Reverse of stripSerialize. Handles both gzipped and raw input via
// magic-byte sniff.
async function stripDeserialize(input: Uint8Array): Promise<StripDataset> {
  let buf = input;
  // gzip magic = 0x1F 0x8B
  if (buf.length >= 2 && buf[0] === 0x1F && buf[1] === 0x8B) {
    if (typeof (globalThis as any).DecompressionStream !== 'function') {
      throw new Error('strip: gzipped dataset but DecompressionStream unavailable');
    }
    const ds = new (globalThis as any).DecompressionStream('gzip');
    const stream = new Blob([buf as BlobPart]).stream().pipeThrough(ds);
    const decompressed = await new Response(stream).arrayBuffer();
    buf = new Uint8Array(decompressed);
  }
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();
  let offset = 0;
  const manifestLen = dv.getUint32(offset, true); offset += 4;
  const manifest = JSON.parse(dec.decode(buf.subarray(offset, offset + manifestLen))) as StripManifest;
  offset += manifestLen;
  const eventsLen = dv.getUint32(offset, true); offset += 4;
  const nucleation_events = JSON.parse(
    dec.decode(buf.subarray(offset, offset + eventsLen))
  ) as StripNucleationEvent[];
  offset += eventsLen;
  // Floor section: only present for format_version ≥ 3 (v1/v2 blobs skip
  // straight to chip_data). A written length of 0 means "v3 but no floor".
  let floor_data: Uint8Array | undefined;
  if ((manifest.format_version || 0) >= 3) {
    const floorLen = dv.getUint32(offset, true); offset += 4;
    if (floorLen > 0) { floor_data = buf.slice(offset, offset + floorLen); offset += floorLen; }
  }
  const chip_data = buf.slice(offset);
  return floor_data ? { manifest, chip_data, nucleation_events, floor_data }
                    : { manifest, chip_data, nucleation_events };
}

// === END HELIX-OVERLAY-FORK ADDITION ==================================
