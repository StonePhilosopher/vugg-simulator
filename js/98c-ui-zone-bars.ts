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
  if (!ctx) return []; // canvas-less env (headless drives) — nothing to draw on
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
// DOOR 2 LAW (2026-07-09, the UV scale audit — tools/uv-zone-census.mjs
// is the calibration instrument): every gate reads ZONE-scale traces and
// MIRRORS the growth engine's own recorded classifier where one exists —
// the bar must agree with the zone notes it renders beside. The pre-audit
// gates were broth-scale numbers tested against zone-scale traces (the
// lattice partition sits between them), so most were dead or always-on:
// the census measured 1 glowing calcite zone in 1370 fleet-wide while the
// engine's notes declared graded fluorescence the bar never showed.
//
// Voices reconciled here (in provenance order):
//  - js/52 calcite ladder (dark-CL / brilliant / moderate / weak — v103,
//    Rakovan 2002) — mirrored branch-for-branch
//  - js/59 willemite ladder (spec threshold 0.005: "even traces produce
//    strong response") and uranyl-family notes (uranophane 💛)
//  - js/53 fluorite: trace_Y is the recorded REE proxy and the engine's
//    own comment names Eu²⁺ (electronic, REE-tracking) as the UV
//    activator — the old gate read Mn, the wrong element
//  - MINERAL_SPEC fluorescence canon: uraninite NON-fluorescent
//    (research-uraninite.md, boss-canonical 626bb22); autunite's entry
//    records the Cu²⁺ quench that darkens the torbernite family
//
// Famous fluorescent minerals get rules; everything else renders "lamp
// on, no emission" (dark) — the honest answer. Quenched and inert both
// render dark: no emission is no emission.
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
      // Mirrors js/52's recorded 4-tier ladder branch-for-branch (v103
      // graduated Mn²⁺ fluorescence, Rakovan 2002): the bar now agrees
      // with the zone notes it renders beside. The 223a96b single gate
      // (Mn>1 && Fe<0.4) was so tight it false-quenched the famous
      // fluorescents — census 2026-07-09: 1 glowing zone in 1370
      // fleet-wide; elmwood (zone Fe p50 1.27 / Mn 4.0, note "will
      // fluoresce orange") and mvt (3.12 / 7.42) rendered dark while
      // only deccan (Fe 24.8, note "Fe quenching — dark CL") deserved
      // it. Anchors: elmwood/mvt GLOW (weak/moderate), deccan/grimsel/
      // jeffrey DARK, tutorial_mn_calcite dim-early → brilliant-rim
      // (the broth carries the quench — see the v225 tutorial retune).
      if (Mn > 1.0 && Fe > 2.0) return null;       // Fe²⁺ quench — dark CL zone
      if (Mn > 6.0 && Fe < 0.4) return '#ff5040';  // brilliant salmon (manganocalcite)
      if (Mn > 2.0 && Fe < 1.0) return '#e06a30';  // moderate orange
      if (Mn > 1.0 && Fe < 2.0) return '#a05226';  // weak orange
      return null;                                  // no activator

    case 'aragonite':
      // Real aragonite fluoresces VERY OFTEN (fluomin: LW strong, since
      // Kunz & Baskerville's 13,000-specimen 1903 survey) — but the
      // dominant activator is ORGANIC matter, a field the sim's chemistry
      // doesn't carry yet. Dark until the biogenic-drivers stone lands
      // (same door as selenite's 1927 Wiesloch UV hourglass — the
      // SIM 211 sediment sectors are the recorded datum waiting for it).
      return null;

    case 'ruby':
    case 'corundum':
    case 'sapphire': {
      // Cr³⁺ R-line red (694 nm) SW + LW; Fe quenches (Mogok marble-hosted
      // low-Fe → bright vs Thai/Cambodian basalt-hosted high-Fe → dim).
      // Fe gate at the ZONE image: the corundum writer partitions 0.008
      // (js/57), so marble-type broths (Fe ≲ 50) write ≤ 0.4 while
      // basalt-type (Fe ≳ 500) write ≥ 4 — the old Fe < 10 could never
      // quench anything the engine writes. Numeric Cr arm reads trace_Cr
      // where the record carries it (v225+); the note arm keeps pre-v225
      // records replaying honest (the writer always printed the ppm into
      // the note). Pink Cr-sapphire rides the same physics — weak red.
      const Cr = zone.trace_Cr || 0;
      const noteCr = zone.note && /Cr|chromium|ruby/i.test(zone.note);
      if ((Cr > 0.5 || noteCr) && Fe < 2.0) return '#ff5050';
      return null;
    }

    case 'fluorite': {
      // Eu²⁺/REE blue-violet — electronic emission tracking REE content
      // (js/53's own comment names the activator; spec: REE_or_defects) —
      // or radiation defects. NOT Mn: the old Mn > 0.5 arm read the wrong
      // element and lit exactly the wrong tenants (census: mvt/reactivated
      // glowed — IL-KY-type fluorite is famously non-fluorescent — while
      // sunnyside's HREE yttrofluorite only glowed by Mn accident and
      // elmwood correctly-but-accidentally stayed dark). trace_Y is the
      // recorded REE proxy; the note arm covers custom writers (70p
      // sunnyside) + pre-v225 records. The Fe-green body-colour note
      // deliberately does NOT match: "(HREE|REE)-(rich|bearing)" avoids
      // its "different mechanism from Y-yttrofluorite green" mention.
      const Y = zone.trace_Y || 0;
      const noteREE = zone.note && /(HREE|REE)-(rich|bearing)/i.test(zone.note);
      if (Y > 0.01 || noteREE || radDmg > 0.1) return '#5588ff';
      return null;
    }

    case 'scheelite':
      // Tungstate intrinsic (self-activated WO₄²⁻) — always-on, the
      // WWI/WWII prospecting-lamp mineral. Verified hue ladder for the
      // day a tenant carries Mo (Cannon 1944, US2,346,661): 0% Mo blue →
      // 0.35-1% white → >1% yellow (saturating ~5%, the powellite end).
      // No fleet tenant yet; the rule waits with its calibration banked.
      return '#ddddff';

    case 'adamite':
      // The Mapimí lime-green is TRACE-URANYL activated (fluomin; Nature's
      // Rainbows Geiger comparison: bright ~200 cpm vs dim ~80 cpm) — and
      // Cu²⁺ QUENCHES it, the same physics that darkens torbernite against
      // autunite. The pre-audit gate had the sense BACKWARDS (cuproadamite
      // rendered brighter). Three verified legs (2026-07-09): fluomin
      // "cupro- and manganoan-adamite... usually not as bright as pure
      // adamite"; the torbernite structural pair; geology.com Cu-as-
      // quencher. Plain adamite bright; any cuprian signal dim (the
      // v225 writer's middle "cuprian" tier lands here too).
      const zCu = zone.trace_Cu || 0;
      if (zCu > 0.1 || (zone.note && /cupro|cuprian/.test(zone.note))) return '#557744';
      return '#88dd66';

    case 'willemite':
      // Franklin classic — Mn²⁺ in the Zn²⁺ site → bright green SW, often
      // phosphorescent. Mirrors the engine's own ladder (js/59: > 0.05
      // troostite / > 0.005 trace-Mn, both "UV-FLUORESCENT bright green";
      // else "weakly fluorescent") and the spec threshold 0.005 ("even
      // traces produce strong response"). The old Mn > 0.1 gate left
      // 66/69 fleet zones dark against the engine's own verdict — and its
      // "sim doesn't ship willemite yet" comment was stale (mvt + tn457).
      if (Mn > 0.005) return '#88ff44';
      return '#5a9944'; // engine else-tier: pale, weakly fluorescent

    case 'autunite':
      // Uranyl (UO₂)²⁺ — intense apple-green, the brightest uranyl
      // fluorescer in the simulator (spec canon: Ca²⁺ doesn't quench the
      // way Cu²⁺ does in the torbernite family).
      return '#aaff66';

    case 'uranophane':
    case 'uranospinite':
      // Uranyl — diagnostic bright yellow-green (spec: uranophane's
      // intensity often exceeds autunite's; uranospinite a shade dimmer,
      // the heavier As-anion absorbs some emission). Census 2026-07-09:
      // both rendered dark for want of a case.
      return mineral === 'uranophane' ? '#ccff44' : '#aaee55';

    case 'metatorbernite':
    case 'metazeunerite':
      // Cu²⁺ QUENCHES uranyl emission — the classic field contrast with
      // autunite (spec canon on the autunite entry). Dark is diagnostic:
      // same uranyl chromophore, killed by the copper.
      return null;

    case 'uraninite':
      // NON-FLUORESCENT — boss-canonical (research-uraninite.md
      // §Fluorescence, 626bb22): UO₂ is near-metallic and U here is U⁴⁺,
      // not uranyl. The ABSENCE of glow is the diagnostic, separating
      // primary uraninite from its bright secondary uranyl daughters.
      // The old always-on green faked exactly the physics the spec
      // corrects (census: ×584 zones lit wrongly).
      return null;

    case 'wulfenite':
      // Some specimens fluoresce orange under SW but most don't reliably.
      return null;

    case 'apophyllite':
      // Mostly INERT — the literature pass (2026-07-09) found no support
      // for an Mn-orange response (fluomin/Bostwick: weak white/cream SW
      // at Franklin, rare; locality exceptions are trace uranyl/Ce/organic
      // accidents, not a species property). The old Mn > 0.3 arm was also
      // structurally dead — apophyllite zones carry no trace_Mn at all.
      return null;

    case 'sphalerite':
    case 'wurtzite':
      // The low-Fe cleiophane classic: Mn²⁺ orange (~595 nm, fluomin),
      // LW-dominant, with the famous triboluminescence; Fe is the hard
      // veto (cleiophane < 0.1% Fe bright; marmatite dead — ZnS's
      // textbook killer ion). Zone image from the engine's own mol%
      // notes: gemmy elmwood cleiophane (zone Fe ~1.4 ≈ 0.1 mol%) glows;
      // the honey/amber and marmatitic tenants (zone Fe ≥ 5) stay dark.
      // The narrator's old avg_Mn > 5 gate could never fire (fleet zone
      // Mn max 3.13) — the bar had no case at all.
      if (Mn > 0.1 && Fe < 2.0) return '#ff9944';
      return null;

    case 'feldspar':
      // Weak deep-red SW — Fe³⁺ substituting tetrahedral Al³⁺, emission
      // ~700-720 nm (Bostwick: Franklin albite "FL red SW"; J. Lumin.
      // Fe³⁺ feldspar emission). Renders DIM by design — the eye barely
      // catches 700 nm. Gated at the fleet's own top decile (p90 0.333).
      // Amazonite deliberately gets NO arm: its Pb²⁺ is a COLOUR CENTRE,
      // not an activator (the literature pass found no verified amazonite
      // glow — the narrator's yellow-green claim retires in v225).
      if (Fe > 0.35) return '#6a2020';
      return null;

    // Beryl family — emerald has weak red Cr³⁺ emission; aquamarine/
    // morganite/heliodor are largely inert. Goshenite spec lists null.
    case 'emerald':
      // Cr³⁺ red, much dimmer than ruby, and usually Fe-killed: Colombian
      // (low-Fe) emeralds glow red under UV/Chelsea filter; schist-type
      // (Zambian/Brazilian, Fe-rich) are inert. Fe gate at the ZONE
      // image: the beryl writer partitions 0.010 (js/59), so the old
      // Fe < 5.0 meant broth 500 — effectively always-on. 1.0 puts the
      // split at broth ~100: gem_pegmatite's paradox emerald (zone 0.5)
      // keeps its weak glow; a schist-type tenant would arrive quenched.
      if (Fe < 1.0) return '#c04040';
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
  if (!ctx) return []; // canvas-less env (headless drives) — nothing to draw on

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
// The field is a plain string for some species (ruby, emerald) and a
// structured {activator, color, quencher, status} object for others —
// the object form used to template into the modal as "[object Object]"
// (caught by the Door 2 census pass, 2026-07-09).
function uvSummary(mineral) {
  const spec = MINERAL_SPEC[mineral];
  const f = spec && spec.fluorescence;
  if (!f) return 'inert under UV';
  if (typeof f === 'string') return f;
  // Fields are strings when authored, but empty/absent slots arrive as
  // objects from the JSON — only trust non-empty strings (the live check
  // caught calcite's empty-object quencher rendering "[object quenches").
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  if (str(f.status) && /non-fluorescent/i.test(str(f.status))) {
    return 'non-fluorescent — diagnostic';
  }
  const parts = [];
  if (str(f.color)) parts.push(str(f.color).replace(/_/g, ' '));
  if (str(f.activator)) parts.push(`${str(f.activator).replace(/_/g, '/')} activator`);
  // quencher is either a plain string or a {species, threshold_ppm} object
  const q = str(f.quencher) || (f.quencher && str(f.quencher.species));
  if (q) parts.push(`${q.split(/[\s(]/)[0]} quenches`);
  return parts.join(' · ') || 'inert under UV';
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
  if (!ctx) return; // canvas-less env (headless drives) — nothing to draw on
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
