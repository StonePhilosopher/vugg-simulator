// ============================================================
// js/98d-ui-zone-shape.ts — per-zone full-shape canvas renderers
// ============================================================
// Crystal-shape rendering (concentric zone outlines, temperature-
// colored fills, vector-aware silhouettes):
//   zoneTemperatureColor — per-zone gradient color
//   getCrystalVector     — equant / acicular / coating habit dispatch
//   renderZoneShape_equant
//   renderZoneShapeCanvas — the master shape painter used by the
//                           zone-modal "Crystal Shape" panel
//
// Phase B19 of PROPOSAL-MODULAR-REFACTOR.

// ─────────────────────────────────────────────────────────────────────────
// Zone-viz Phase 2: habit-shape-aware zone rendering.
//
// Dispatches on the crystal's `vector` (the canonical 5-family habit
// class: projecting / coating / tabular / equant / dendritic). Each
// family gets a shape renderer that conforms the zone bands to the
// mineral's natural habit outline. Families without a shape renderer
// yet fall back to the bar graph.
//
// Phase 2a (this commit): `equant` — corner-view hexagonal silhouette
// with nested rings, internal Y-edge scaffold to suggest 3D cube/rhomb
// faces. Covers fluorite + halite + galena + pyrite + dolomite +
// every mineral with 'massive' / 'cubic' / 'rhomb' / 'octahedral' as
// an equant habit variant.
//
// Zone color (phase 2a first cut): temperature gradient. HSL mapping
// from blue (cool) → red (hot) across the 0–1000°C range. Richer
// chromophore-aware color_from_zone is phase 2c territory when the
// schema bump lands and every variety's chromophore is captured.
// ─────────────────────────────────────────────────────────────────────────

function zoneTemperatureColor(zone) {
  // HSL gradient — blue 220° at 0°C, red 0° at ≥1000°C. Warmer hues
  // also shift brighter so 'hot zone' reads obvious at a glance.
  const T = Math.max(0, Math.min(1000, zone.temperature || 0));
  const t = T / 1000;
  const hue = 220 - 220 * t;
  const light = 32 + 18 * t;
  return `hsl(${hue.toFixed(0)}, 68%, ${light.toFixed(0)}%)`;
}
function getCrystalVector(crystal) {
  // Look up the habit's vector classification from the mineral spec.
  // Each habit variant declares its vector (projecting/coating/tabular/
  // equant/dendritic); fall back to the first variant's vector if the
  // crystal's habit isn't in the list, or null if the mineral has no
  // variants declared yet.
  if (!crystal || !crystal.mineral) return null;
  const spec = MINERAL_SPEC[crystal.mineral];
  if (!spec || !spec.habit_variants) return null;
  const variants = spec.habit_variants.filter(v => v && typeof v === 'object');
  if (!variants.length) return null;
  const current = variants.find(v => v.name === crystal.habit) || variants[0];
  return current.vector || null;
}
function renderZoneShape_equant(canvas, crystal, opts: any = {}) {
  // Nested hexagonal silhouette with internal Y to suggest corner-view
  // cube/rhomb faces. Each zone is a concentric ring; ring thickness is
  // proportional to the zone's |thickness_um| so a long dissolution
  // event reads as a wide inward step.
  const zones = crystal.zones || [];
  if (!zones.length) return;
  const { size = 240 } = opts;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#070706';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  // Flatten y slightly to suggest iso-projection foreshortening (0.866
  // = cos(30°), the iso-projection y-shrink factor).
  const hexVertex = (angleDeg, r) => {
    const a = (angleDeg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.866];
  };

  // Cumulative thickness normalizes each zone's ring radius. Minimum
  // band width = 1% of maxR so high-zone-count crystals don't produce
  // rings thinner than a pixel.
  const totalT = zones.reduce((s, z) => s + Math.abs(z.thickness_um || 1), 0) || 1;
  const minBandFrac = 0.008;
  let cumT = 0;
  let prevR = 0;

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    cumT += Math.abs(z.thickness_um || 1);
    let outerR = (cumT / totalT) * maxR;
    // Enforce minimum band width so every zone is visible even in a
    // crystal with hundreds of zones.
    if (outerR - prevR < minBandFrac * maxR) {
      outerR = prevR + minBandFrac * maxR;
    }

    // Fill this ring. Draw outer hexagon filled, then punch out inner.
    ctx.fillStyle = zoneTemperatureColor(z);
    ctx.beginPath();
    for (let v = 0; v < 6; v++) {
      const [vx, vy] = hexVertex(v * 60, outerR);
      if (v === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();

    // Dissolution tint — darken the band by overlaying red at 0.35.
    if (z.thickness_um < 0) {
      ctx.fillStyle = '#cc4444';
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    prevR = outerR;
  }

  // Internal Y scaffold — three low-alpha edges from apex / lower-left /
  // lower-right corner of the OUTER hex to the center, to suggest the
  // three visible cube faces meeting at the front corner of a corner-on
  // isometric cube. Purely poetic — no data in it — but without it the
  // rendering reads as nested hexagons instead of a cube.
  const rimR = prevR;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const apex = hexVertex(0, rimR);
  const ll = hexVertex(240, rimR);
  const lr = hexVertex(120, rimR);
  ctx.moveTo(apex[0], apex[1]); ctx.lineTo(cx, cy);
  ctx.moveTo(ll[0], ll[1]); ctx.lineTo(cx, cy);
  ctx.moveTo(lr[0], lr[1]); ctx.lineTo(cx, cy);
  ctx.stroke();

  // Outer silhouette edge — slightly brighter outline so the crystal
  // outline reads against the dark background.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let v = 0; v < 6; v++) {
    const [vx, vy] = hexVertex(v * 60, rimR);
    if (v === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.stroke();

  // Phantom boundaries — small gray ticks at the ring corresponding to
  // zones with is_phantom true. Rendered as short radial notches on the
  // outer edge of that ring, which reads as 'growth paused here'.
  cumT = 0;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    cumT += Math.abs(z.thickness_um || 1);
    if (!z.is_phantom) continue;
    const r = (cumT / totalT) * maxR;
    ctx.strokeStyle = '#aaaaaa';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Notches on the three visible-face midpoints (60°, 180°, 300°).
    for (const angle of [60, 180, 300]) {
      const [x1, y1] = hexVertex(angle, r - 3);
      const [x2, y2] = hexVertex(angle, r + 3);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Fluid inclusions — teal dots at the midpoint of the zone's ring,
  // placed near the apex angle so multiple FIs stagger.
  cumT = 0;
  let fiCount = 0;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const zT = Math.abs(z.thickness_um || 1);
    const midR = ((cumT + zT * 0.5) / totalT) * maxR;
    cumT += zT;
    if (!z.fluid_inclusion) continue;
    const angle = (fiCount * 37) % 360;  // scatter around the ring
    const [fx, fy] = hexVertex(angle, midR);
    ctx.fillStyle = '#50c0e0';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    fiCount++;
  }
}
function renderZoneShapeCanvas(canvas, crystal, opts: any = {}) {
  // Dispatcher. Branches on canonical habit vector; falls back to the
  // Phase 1 bar graph for vectors that don't have a shape renderer yet.
  const zones = crystal.zones || [];
  if (!zones.length) return;
  const vector = getCrystalVector(crystal);
  switch (vector) {
    case 'equant':
      return renderZoneShape_equant(canvas, crystal, opts);
    // TODO: projecting (hex prism with c-axis elongation), tabular (flat
    // plate with concentric ring bands), coating (wall-anchored shells),
    // dendritic (branching skeletal)
    default:
      return renderZoneBarCanvas(canvas, zones, opts);
  }
}
