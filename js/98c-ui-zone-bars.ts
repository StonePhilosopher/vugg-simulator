// ============================================================
// js/98c-ui-zone-bars.ts — per-zone horizontal-strip visualizers
// ============================================================
// Functions that paint a ZONE-BY-ZONE horizontal bar across a canvas:
//   zoneColor / groupZonesByChemistry / renderChemistryBar
//   zoneFluorescence / groupZonesByFluorescence / renderUVBar / uvSummary
//   renderZoneBarCanvas
//
// Used by the zone-history modal (97d-ui-zone-modal.ts) and by the
// groove-detail strip (98-ui-groove.ts). Lifted out of the groove
// module since they are not turntable-specific.
//
// Phase B19 of PROPOSAL-MODULAR-REFACTOR.

// ─────────────────────────────────────────────────────────────────────────
// Shared zone-bar-graph renderer.
//
// Round-7-dialogue Phase 1: paints a horizontal bar graph for a zone array,
// one vertical column per zone, sub-divided into GROOVE_AXES horizontal
// lanes (Temperature, Growth rate, Fe/Mn/Al/Ti trace). Value per lane is
// range-normalized for visual contrast; alpha 0.2 + 0.7×normalized.
//
// Time reads left (nucleation) → right (rim). Lane order follows
// GROOVE_AXES.
//
// Two consumers:
//   1. Record Player's renderDetailStrip — zoomed-in selection bar
//   2. Zone History modal's bar-graph replacement of the text list
//
// Options:
//   height              — canvas height px (default 120)
//   maxWidth            — cap total canvas width (default 800)
//   minZoneWidth        — minimum column width px (default 1 — honest at
//                         high zone counts; can raise to 4+ for wide modal)
//   maxZoneWidth        — maximum column width px (default 60)
//   showLaneLabels      — draw GROOVE_AXES[i].name on each lane (default
//                         true)
//   showFIGlyphs        — overlay fluid-inclusion teal dots (default true)
//
// Event glyphs intentionally limited to fluid_inclusion + dissolution for
// Phase 1 — those are the only zone-level flags on the data today. Twin
// and phantom-boundary are crystal-level, deferred to Phase 1b when we
// decide how to attach them to specific zones.
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// Chemistry zone bar — the stratigraphic-column view of a crystal.
// Per BRIEF-CHEMISTRY-ZONE-BAR.md (design-tasks repo, commit b50c255).
//
// "A simple horizontal bar that shows the chemistry history of a crystal.
//  Each segment is colored by the dominant chromophore during that growth
//  period. Segment width is proportional to how long that chemical regime
//  lasted." — Professor
//
// Watermelon tourmaline grows green (Fe/Cr) for a long time then shifts
// to pink (Mn) at the end → renders as a wide green segment + thin pink
// segment. The bar IS the growth narrative.
//
// Lives ALONGSIDE the 6-lane chemistry-axis dashboard bar (renderZoneBar
// Canvas), not as a replacement: chem bar shows the story (chromophore →
// visible color), dashboard shows the data (each axis's instrument trace).
// Same color logic the existing crystalColor() uses, just per-zone.
// ─────────────────────────────────────────────────────────────────────────

function zoneColor(zone, mineral, crystal) {
  // Per-zone color via the existing per-mineral crystalColor() switch
  // statement — by building a single-zone fake-crystal and reusing the
  // ~80 lines of mineral-specific color logic. Whole-crystal attributes
  // (radiation_damage, mineral_display, habit) are inherited from the
  // real crystal so e.g. quartz amethyst (Fe + radDmg) renders correctly
  // on each zone with that combination, not just averaged.
  const fake = {
    mineral,
    zones: [zone],
    radiation_damage: (crystal && crystal.radiation_damage) || 0,
    mineral_display: crystal && crystal.mineral_display,
    habit: (crystal && crystal.habit) || zone.habit,
    c_length_mm: (crystal && crystal.c_length_mm) || 0,
  };
  return crystalColor(fake);
}
function groupZonesByChemistry(zones, mineral, crystal) {
  // Walk zones, merge consecutive zones with same color into segments.
  // Dissolution zones (thickness_um < 0) get their own segment regardless
  // — the inward step is a story event the bar should mark.
  if (!zones || !zones.length) return [];
  const segs = [];
  let current = null;
  for (const z of zones) {
    const isDissolution = z.thickness_um < 0;
    const color = zoneColor(z, mineral, crystal);
    const key = isDissolution ? '__dissolution__' : color;
    if (current && current.key === key) {
      current.totalThickness += Math.abs(z.thickness_um || 1);
      current.zones.push(z);
    } else {
      if (current) segs.push(current);
      current = {
        key,
        color,
        isDissolution,
        totalThickness: Math.abs(z.thickness_um || 1),
        zones: [z],
      };
    }
  }
  if (current) segs.push(current);
  return segs;
}
function renderChemistryBar(canvas, crystal, opts: any = {}) {
  const zones = crystal && crystal.zones;
  if (!zones || !zones.length) return [];
  const { width = 600, height = 36 } = opts;
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#070706';
  ctx.fillRect(0, 0, width, height);

  const segs = groupZonesByChemistry(zones, crystal.mineral, crystal);
  const totalT = segs.reduce((s, g) => s + g.totalThickness, 0) || 1;

  let x = 0;
  const segGeom = [];  // for hover tooltip mapping
  for (const seg of segs) {
    const w = Math.max(1, (seg.totalThickness / totalT) * width);
    ctx.fillStyle = seg.color;
    ctx.fillRect(x, 0, w, height);
    if (seg.isDissolution) {
      // Diagonal hash texture so dissolution reads as 'something
      // happened here', not just 'red zone'.
      ctx.strokeStyle = '#882020';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let hx = x - height; hx < x + w; hx += 4) {
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx + height, height);
      }
      ctx.stroke();
    }
    if (x > 0) {
      // Subtle inter-segment separator so adjacent same-hue colors
      // (rare but possible after rounding) still read as boundaries.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    segGeom.push({ x, w, seg });
    x += w;
  }
  return segGeom;
}
// ─────────────────────────────────────────────────────────────────────────
// UV-response zone bar — the "ghost of growth under the lamp" view.
// Same stratigraphic primitive as the chemistry bar, but the segments
// represent fluorescence behavior under shortwave/longwave UV instead of
// visible-light color.
//
// Per-mineral activator/quencher physics:
//  - Calcite: Mn²⁺ activates the Franklin/Sterling-Hill red SW emission;
//    Fe quenches above ~5 ppm (why most calcite outside Franklin is dim)
//  - Ruby/corundum: Cr³⁺ d-d emission at 694 nm; Fe quenches (Mogok =
//    low Fe → bright; Thai basalt-hosted = high Fe → dim)
//  - Fluorite: REE + radiation defects → blue/violet; rare U → green
//  - Adamite: Cu activator → diagnostic apple-green
//  - Scheelite: tungstate intrinsic blue-white (always fluoresces)
//  - Aragonite: organic activators sometimes produce yellow but sim
//    doesn't model organics → inert in this rendering
//  - Most others: inert
//
// First-cut palette is intentionally narrow — the famous fluorescent
// minerals get rules, everything else renders as "lamp on, no emission"
// (dark) which is the honest answer.
// ─────────────────────────────────────────────────────────────────────────

function zoneFluorescence(zone, mineral, crystal) {
  // Returns either a hex color string (the UV emission) or null (inert).
  const Fe = zone.trace_Fe || 0;
  const Mn = zone.trace_Mn || 0;
  const Ti = zone.trace_Ti || 0;
  const Al = zone.trace_Al || 0;
  const radDmg = (crystal && crystal.radiation_damage) || 0;

  switch (mineral) {
    case 'calcite':
      // Franklin red SW: Mn²⁺ activates, Fe quenches.
      if (Mn > 1.0 && Fe < 5.0) return '#ff4040';
      return null;

    case 'aragonite':
      // Some specimens fluoresce yellow from organic activators which
      // we don't model. Honest rendering = inert.
      return null;

    case 'ruby':
    case 'corundum':
    case 'sapphire':
      // Cr³⁺ red SW + LW. Fe quenches strongly above ~10 ppm.
      // Reading trace_Cr: not in the standard zone fields list, so check
      // both the trace_Cr field (if present) and infer from notes.
      const Cr = zone.trace_Cr || 0;
      const noteCr = zone.note && /Cr|chromium|emerald|ruby/i.test(zone.note);
      if ((Cr > 1.0 || (mineral === 'ruby' && noteCr)) && Fe < 10.0) {
        return '#ff5050';
      }
      return null;

    case 'fluorite':
      // Mn or radiation defects → blue/violet emission.
      if (Mn > 0.5 || radDmg > 0.1) return '#5588ff';
      return null;

    case 'scheelite':
      // Tungstate intrinsic — bright blue-white, every zone.
      return '#ddddff';

    case 'adamite':
      // Cu activator → apple-green; diagnostic for cuproadamite.
      if (zone.note && zone.note.includes('cuproadamite')) return '#aaff44';
      // Pure adamite is yellow-green under SW.
      return '#88dd66';

    case 'willemite':
      // Franklin classic — Mn²⁺ → bright green SW. (Sim doesn't ship
      // willemite yet but reserve the rule for when it lands.)
      if (Mn > 0.1) return '#88ff44';
      return null;

    case 'autunite':
    case 'uraninite':
      // Uranyl ion → diagnostic green. Uraninite's color comes from
      // U not radiation, so always-on rather than gated.
      return '#aaff66';

    case 'wulfenite':
      // Some specimens fluoresce orange under SW but most don't reliably.
      return null;

    case 'apophyllite':
      // Variable — Mn-bearing zones fluoresce; clean ones don't.
      if (Mn > 0.3) return '#ffaa66';
      return null;

    // Beryl family — emerald has weak red Cr³⁺ emission; aquamarine/
    // morganite/heliodor are largely inert. Goshenite spec lists null.
    case 'emerald':
      // Cr-bearing → weak red, much dimmer than ruby.
      if (Fe < 5.0) return '#cc4040';  // dimmer red than ruby
      return null;

    default:
      return null;
  }
}
function groupZonesByFluorescence(zones, mineral, crystal) {
  if (!zones || !zones.length) return [];
  const segs = [];
  let current = null;
  for (const z of zones) {
    const color = zoneFluorescence(z, mineral, crystal);
    const key = color || '__inert__';
    if (current && current.key === key) {
      current.totalThickness += Math.abs(z.thickness_um || 1);
      current.zones.push(z);
    } else {
      if (current) segs.push(current);
      current = {
        key,
        color,           // null for inert segments
        totalThickness: Math.abs(z.thickness_um || 1),
        zones: [z],
      };
    }
  }
  if (current) segs.push(current);
  return segs;
}
function renderUVBar(canvas, crystal, opts: any = {}) {
  const zones = crystal && crystal.zones;
  if (!zones || !zones.length) return [];
  const { width = 600, height = 36 } = opts;
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');

  // Background — deep cool gray suggesting "lamp on, dark room, no
  // emission yet". Inert segments stay this color.
  ctx.fillStyle = '#181822';
  ctx.fillRect(0, 0, width, height);

  const segs = groupZonesByFluorescence(zones, crystal.mineral, crystal);
  const totalT = segs.reduce((s, g) => s + g.totalThickness, 0) || 1;

  let x = 0;
  const segGeom = [];
  for (const seg of segs) {
    const w = Math.max(1, (seg.totalThickness / totalT) * width);
    if (seg.color) {
      // Glow effect — fill + soft halo so emission segments look like
      // they're shining rather than just colored.
      ctx.shadowColor = seg.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, 4, w, height - 8);
      ctx.shadowBlur = 0;
      // Bright inner highlight so the segment reads as hot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(x, 4, w, Math.max(2, (height - 8) * 0.35));
    }
    if (x > 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    segGeom.push({ x, w, seg });
    x += w;
  }
  return segGeom;
}
// Lookup of the per-mineral expected fluorescence narrator string from
// the spec's `fluorescence` field — used as the modal header subtitle.
function uvSummary(mineral) {
  const spec = MINERAL_SPEC[mineral];
  if (!spec || !spec.fluorescence) return 'inert under UV';
  return spec.fluorescence;
}
function renderZoneBarCanvas(canvas, zones, opts: any = {}) {
  if (!canvas || !zones || !zones.length) return;
  const {
    height = 120,
    maxWidth = 800,
    minZoneWidth = 1,
    maxZoneWidth = 60,
    showLaneLabels = true,
    showFIGlyphs = true,
  } = opts;

  const nZones = zones.length;
  const zoneW = Math.max(minZoneWidth, Math.min(maxZoneWidth, Math.floor(maxWidth / nZones)));
  const W = zoneW * nZones;
  const H = height;
  canvas.width = W;
  canvas.height = H;
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#070706';
  ctx.fillRect(0, 0, W, H);

  // Range-normalize each axis within this zone selection for visual
  // contrast. If all values are equal the range collapses to 1 → every
  // value is 0.0 (dim stripe), which is the honest rendering.
  const norm = (arr) => {
    const mn = Math.min(...arr);
    const mx = Math.max(...arr);
    const range = mx - mn || 1;
    return arr.map(v => (v - mn) / range);
  };
  const allNorm = GROOVE_AXES.map(axis => {
    if (axis.key === 'thickness_um') {
      // Use |thickness| so dissolution rows still rank by magnitude,
      // with direction shown via the dissolution tint below.
      return norm(zones.map(z => Math.abs(z[axis.key] || 0)));
    }
    return norm(zones.map(z => z[axis.key] || 0));
  });
  const laneH = Math.floor(H / GROOVE_AXES.length);

  for (let a = 0; a < GROOVE_AXES.length; a++) {
    const y0 = a * laneH;
    for (let i = 0; i < nZones; i++) {
      const val = allNorm[a][i];
      const x = i * zoneW;
      ctx.fillStyle = GROOVE_AXES[a].color;
      ctx.globalAlpha = 0.2 + val * 0.7;
      const barH = Math.max(1, val * (laneH - 2));
      ctx.fillRect(x + 1, y0 + laneH - barH - 1, Math.max(1, zoneW - 2), barH);
      ctx.globalAlpha = 1;

      // Dissolution tint — overlaid on every lane so a dissolution zone
      // reads as a vertical red stripe through the whole bar graph.
      if (zones[i].thickness_um < 0) {
        ctx.fillStyle = '#cc4444';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(x, y0, zoneW, laneH);
        ctx.globalAlpha = 1;
      }
    }

    if (showLaneLabels && zoneW >= 6) {
      ctx.fillStyle = GROOVE_AXES[a].color;
      ctx.globalAlpha = 0.7;
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(GROOVE_AXES[a].name, 3, y0 + 12);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = '#1a1a14';
    ctx.beginPath();
    ctx.moveTo(0, y0 + laneH);
    ctx.lineTo(W, y0 + laneH);
    ctx.stroke();
  }

  // Fluid-inclusion glyph row — small teal dots at the top of each zone
  // column that has fluid_inclusion === true. Positioned at lane 0's top
  // so they don't overlap lane content.
  if (showFIGlyphs) {
    for (let i = 0; i < nZones; i++) {
      if (!zones[i].fluid_inclusion) continue;
      const cx = i * zoneW + zoneW / 2;
      ctx.fillStyle = '#50c0e0';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(cx, 3, Math.max(1.5, Math.min(2.5, zoneW / 3)), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Phase 1b: phantom-boundary tick — a thin gray vertical line through
  // all lanes marking zones where growth paused and resumed, leaving a
  // ghost surface inside the crystal. Semantically correct to overlay
  // every axis since the phantom is a whole-crystal event at that zone,
  // not a lane-specific signal. Uses zone.is_phantom (already captured
  // per-zone by buildCrystalRecord; no schema change needed).
  if (opts.showPhantomTicks !== false) {
    for (let i = 0; i < nZones; i++) {
      if (!zones[i].is_phantom) continue;
      const cx = i * zoneW + Math.floor(zoneW / 2);
      ctx.strokeStyle = '#aaaaaa';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(1, Math.min(2, zoneW * 0.5));
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, H);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }
  }
}
