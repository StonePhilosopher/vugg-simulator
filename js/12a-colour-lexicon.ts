// 12a-colour-lexicon.ts — D1 (Depth-C body colour): D1a DEFAULTS + D1b chemistry variants.
//
// WHY THIS EXISTS
// ---------------
// Body colour was spec.class_color — a 12-hue CLASS-taxonomy wheel (schema:
// "all classes of the same type share one hue"), so galena/sphalerite/pyrite
// rendered ONE grey-green, calcite/malachite/azurite ONE orange (tools/
// d1-bodycolor-probe.mjs: 107/180 species stuck on a shared hue; 97 collide
// in-scene). But data/minerals.json ALREADY carries the real bedrock:
// `color_rules`, a chemistry-cause -> colour-NAME map authored for all 180
// species ("Learning-audience voice; not flavor text"). The mineral->name claim
// is the sourced science (calcite is white, galena is lead-grey, cinnabar is
// cochineal-red — standard mineralogy). This lexicon supplies the second half:
// each colour NAME -> one sRGB from standard colour vocabulary + grounded
// mineral appearance. Resolving it BREAKS every class collision into a spread of
// real, distinct colours (probe [5]: the 19-sulfide hue -> 15 distinct names).
//
// DISCIPLINE (bedrock-over-effect-hacks + the optics `source` column idiom)
// ------------------------------------------------------------------------
// * D1b LANDED for the REACHABLE set (tools/d1b-units-probe.mjs). The units fear
//   was half-right: the sim's trace_Fe IS ppm, but it populates sphalerite Fe up
//   to ~40, so Fe>15 (black_marmatite) DOES fire (31% of the fleet's sphalerites);
//   quartz radiation_damage reaches smoky(>0.3)/morion(>0.6). Those + wurtzite Fe
//   ship as _chemistryVariant overrides. The probe pruned the rest: "<" triggers
//   fire trivially on unpopulated fields (epidote Fe<8, turquoise Fe<2 at 100% —
//   excluded), and 44 variants need a field the sim lacks (Cr×12, Li, Co, Ag…) →
//   D1c "when the sim's chemistry catches up." _FL variants are D4 (UV render).
// * The colourless/white family is kept NEAR-NEUTRAL, not pure white — the
//   Depth-A diaphaneity layer (buildCrystalMaterial opacity) supplies the
//   see-through; a clear quartz wants a faint base, not a chalk one.
// * This colour is the BASE that js/99i _localCrystalColor deepens by trace
//   load and jitters by the id-hash legibility floor. It composes UNDER those.
// * Sector-zoned crystals (tourmaline/chiastolite) keep their baked vertex
//   colours — buildCrystalMaterial's white override still wins; this is moot
//   for them.
//
// Render-only. resolveBodyColour reads spec.color_rules + crystal.mineral,
// consumes NO RNG -> seed-42 baseline byte-identical.

// name -> sRGB. Grouped by colour family. Every color_rules DEFAULT name across
// the 180 species resolves here (tests-js/d1-body-colour.test.ts pins coverage).
const COLOUR_LEXICON: { [name: string]: string } = {
  // --- colourless / white family (near-neutral; diaphaneity supplies clarity) ---
  clear: '#eef1f4', colorless: '#edf0f3', transparent_pearly: '#eef0ee',
  colorless_gem: '#eef1f2', colorless_goshenite: '#eef1f1', colorless_achroite: '#eef0ef',
  colorless_pale_yellow: '#f0f0e6', colorless_to_white: '#eef0ef', colorless_white: '#eff0ec',
  white: '#f1eee7', white_colorless: '#eef0ec', white_to_colorless: '#eef0ee',
  chalk_white: '#f2efe8', pearly_white: '#efece5', white_powdery: '#f2f0ea',
  white_spray: '#f0ede6', white_flesh: '#eaddce', white_pink_zoned: '#ecdcd6',
  white_pale_green: '#e2e6da', white_pale_blue_green: '#dde8e2', common_white_brown: '#e6ddce',
  gray_to_white: '#dcdad2', white_to_pale_yellow: '#eee9d2',
  // --- yellows / golds ---
  pale_yellow: '#e2cb6a', yellow: '#e6d23a', bright_yellow: '#eedc2a', lemon_yellow: '#edea45',
  canary_yellow: '#e9d92c', rich_yellow: '#e8b722', golden_yellow: '#e2b32a', straw_yellow: '#ddca7a',
  honey_yellow: '#d4a437', honey_amber: '#c98a2f', cadmium_yellow: '#e8c31f',
  bright_yellow_powder: '#e4cf3a', dull_meta: '#c9c26a',
  brass_yellow: '#c4a63a', brassy_yellow: '#c8a428', pale_brass_yellow: '#cdbb6e', brassy_yellow_green: '#c6941c',  // chalcopyrite: deeper, more golden than pyrite's pale brass (real)
  // --- oranges / red-oranges ---
  orange_yellow: '#ec9422', yellow_orange: '#e0982c', orange_red: '#e04b28', bright_red_orange: '#dc4529',
  // --- reds / pinks ---
  red: '#c0332c', cochineal_red: '#b21f2b', scarlet_vermilion: '#cc2b24', cherry_red: '#922f38',
  ruby_red: '#a52233', dark_red_black: '#6e201d', crimson_pink: '#ad3d6e', rose_pink: '#dd6f8a',
  pale_pink: '#e2b7bf', pink_morganite: '#e6a6b4', pink_orthoclase: '#dcb59e', peach_salmon: '#e6ab84',
  // --- browns ---
  brown: '#6f5236', deep_brown: '#5e3d22', yellow_brown: '#74501f', yellowish_brown: '#8a6a34',
  red_brown: '#8e3d20', pinkish_brown: '#b08a6e', gold_brown: '#9a6a2a', brown_grey: '#6a5f52',
  brown_yellow_idocrase: '#8a6a2e', honey_brown: '#bf8236',   // titanite/sphene honey-yellow-brown
  // --- greens ---
  green: '#3f8a52', emerald_green: '#1f9060', green_emerald: '#1f8f56', apple_green: '#8bc34a',
  olive_green: '#74822a', yellow_green: '#9db83e', green_yellow: '#a9c23a', pale_green: '#a7cfa0',
  pale_yellow_green: '#c2d089', pistachio_green: '#8aa04a', green_banded: '#237a46', blue_green: '#2f8f80',
  pale_blue_green: '#8fbcae',
  // --- blues / cyans ---
  blue: '#2f5fb0', deep_blue: '#25408f', deep_azure: '#1e50a8', cobalt_blue: '#2a4bb0',
  indigo_blue: '#34408f', cyan_sky_blue: '#2fa8b2', sky_blue: '#45bccb', blue_aquamarine: '#6fb8cf',
  pale_celestial_blue: '#b7cfe0',
  // --- purples ---
  purple: '#8a4bb0', yellow_triphane: '#e6d68a', yellow_heliodor: '#e8d24a',
  // --- metallic greys / silvers (sulfides, natives, oxides) ---
  lead_gray: '#74767c', lead_gray_metallic: '#73767c', lead_steel_gray: '#6d7076', lead_tin_white: '#b7b3a8',
  steel_gray: '#5c5d63', iron_gray: '#5f6167', gray_black: '#3f3f45', dark_gray_black: '#34343a',
  iron_black: '#27272b', black: '#232326', black_metallic: '#2b2b2e', black_ferberite: '#2a2723',
  specular_metallic_gray: '#5a5b5f', silver_gray_metallic: '#8a8d94', silver_white: '#cfcdc6',
  silver_white_fresh: '#cbcabf', silver_white_metallic: '#c9c6bd', silvery_metallic: '#bcbcc2',
  tin_white: '#c2c0b6', tin_white_iridescent: '#bdbcc0', bronze_fresh: '#a06a44', copper_red_fresh: '#bb6a34',
  pinkish_white: '#cebcb6',   // rammelsbergite — tin-white with the diagnostic faint pink cast
  // D1b chemistry-gated variants — the REACHABLE set from tools/d1b-units-probe.mjs
  // (fired by _chemistryVariant below, not the default lookup): Fe darkening +
  // radiation smoky. honey_brown / black_metallic / pale_yellow / yellowish_brown
  // already exist above as bases. amethyst is authored-but-dormant (its Fe+radiation
  // co-location isn't reached at seed 42 — lights up when the sim gets there, D1c).
  black_marmatite: '#2b2018', reddish_brown: '#6b3a26', smoky: '#7a6650', morion: '#201a13', amethyst: '#9966cc',
};

// The 20 species whose color_rules default is the "default_color" placeholder
// (no descriptive name) get an explicit body colour, read straight off their own
// minerals.json description (the source is in-tree): e.g. millerite "brass-yellow
// to bronze", cobaltite "tin-white", chalcanthite "bright sky-blue".
const SPECIES_BODY_COLOUR: { [mineral: string]: string } = {
  acanthite: '#37373d', argentite: '#34343a',            // Ag2S — dark lead-grey to black
  native_silver: '#d4d2cb', native_arsenic: '#8f8c84',   // silver-white; As tin-white weathering dark grey
  native_sulfur: '#eedc2f', native_tellurium: '#c2c2c8', // canary yellow; tin/silver-white
  nickeline: '#c97e62', millerite: '#b89a2e',            // pale copper-red; brass-yellow
  cobaltite: '#bcbab0',                                  // tin-white / steel
  descloizite: '#6e3623', mottramite: '#63702e',         // red-brown-black; olive-green-black
  raspite: '#cf9e38', stolzite: '#cf9e38',               // honey-yellow to orange (PbWO4)
  olivenite: '#70792c',                                  // olive-green
  chalcanthite: '#2f74d6',                               // bright sky-blue [Cu(H2O)5]2+
  rosasite: '#339490', aurichalcite: '#94cdc4',          // blue-green; pale blue-green
  torbernite: '#33a04f', zeunerite: '#35a352',           // emerald-green uranyl P / As
  carnotite: '#e6d32f',                                  // canary-yellow uranyl vanadate
};

// The color_rules DEFAULT variant name for a spec (the one flagged {default:true},
// else the first listed — sphalerite/hematite have no explicit default).
function _defaultColourName(spec: any): string | null {
  const cr = spec && spec.color_rules;
  if (!cr) return null;
  for (const v of Object.keys(cr)) if (cr[v] && cr[v].default === true) return v;
  const ks = Object.keys(cr);
  return ks.length ? ks[0] : null;
}

// --- D1b: chemistry-gated variants -------------------------------------------
// color_rules variants gated on the crystal's OWN chemistry (sphalerite
// pale_yellow→honey_brown→black_marmatite by Fe; quartz clear→smoky→morion by
// radiation). The sim carries these chromophore fields only (js/27 GrowthZone
// traces, PPM; + crystal radiation_damage, 0-1); triggers naming any other
// element (Cr/Li/Sm/Y/Zn/Cd…) have NO DATA and stay on the default — that is D1c,
// "when the sim's chemistry catches up." tools/d1b-units-probe.mjs validated the
// reachable set at seed 42. Render-only, RNG-free.
const _BODY_ZONE_TRACE: { [k: string]: string } = { Fe: 'trace_Fe', Mn: 'trace_Mn', Al: 'trace_Al', Ti: 'trace_Ti', Pb: 'trace_Pb', Au: 'trace_Au', Cu: 'trace_Cu' };
const _BODY_CRYSTAL_FIELD: { [k: string]: string } = { radiation_damage: 'radiation_damage', radiation: 'radiation_damage' };

// growth-weighted zone trace (how the render reads the crystal's chemistry) or a
// crystal-level field; null if the sim carries no such field.
function _bodyFieldVal(crystal: any, field: string): number | null {
  if (_BODY_CRYSTAL_FIELD[field]) return (crystal && crystal[_BODY_CRYSTAL_FIELD[field]]) || 0;
  const zf = _BODY_ZONE_TRACE[field];
  if (!zf) return null;
  let acc = 0, G = 0;
  for (const z of (crystal && crystal.zones) || []) { const w = z.thickness_um; if (!(w > 0)) continue; acc += (z[zf] || 0) * w; G += w; }
  return G > 0 ? acc / G : 0;
}

// Parse a color_rules trigger into POSITIVE-deviation LOWER-THRESHOLD clauses.
// Returns null unless every clause is a ">"/">="/range (chromophore PRESENCE) over
// a field the sim carries. A "<"/"<=" clause → null: the low end is the DEFAULT/
// base, and a "<" fires trivially against an unpopulated field (the false-positive
// the probe caught — epidote Fe<8, turquoise Fe<2 fire at 100% because Fe≈0).
// Prose → null. RANGES collapse to their LOWER bound (a "≥lo" threshold): the
// shipped variants are monotonic darkening LADDERS (sphalerite pale→honey→black),
// so a value in a data gap (Fe 10-15, above honey's 2-10 top but below marmatite's
// >15) must round DOWN to honey, never fall through to the pale default. Priority
// then picks the highest threshold cleared, so the top of the ladder still wins.
function _parseBodyTrigger(raw: string): any {
  const t = String(raw || '').replace(/[–—]/g, '-');
  const clauses: any[] = [];
  for (let part of t.split(/\band\b/i)) {
    part = part.trim();
    let m = part.match(/\b([A-Za-z_]+)\s*(>=|>)\s*([\d.]+)/);
    if (m) { const f = m[1]; if (!_BODY_ZONE_TRACE[f] && !_BODY_CRYSTAL_FIELD[f]) return null; clauses.push({ field: f, lo: parseFloat(m[3]), strict: m[2] === '>' }); continue; }
    m = part.match(/\b([A-Za-z_]+)\s+([\d.]+)\s*-\s*([\d.]+)/);   // "Fe 2-10" range → ≥2 threshold (upper bound dropped)
    if (m) { const f = m[1]; if (!_BODY_ZONE_TRACE[f] && !_BODY_CRYSTAL_FIELD[f]) return null; clauses.push({ field: f, lo: parseFloat(m[2]), strict: false }); continue; }
    if (/<=?\s*[\d.]/.test(part)) return null;   // a "<" clause → low-end/base variant, not an override
    // else: a clause with no numeric bound → prose; ignore it
  }
  if (!clauses.length) return null;
  return { clauses, nClauses: clauses.length, maxLo: Math.max(...clauses.map((c) => c.lo)) };
}

// The highest-priority chemistry variant that FIRES for this crystal, or null.
// Priority: more clauses (more specific), then higher lower-bound (more extreme
// chromophore — black_marmatite beats honey_brown, morion beats smoky).
// Fluorescence (_FL) variants excluded — that is UV render (D4), not body colour.
function _chemistryVariant(crystal: any, spec: any): string | null {
  const cr = spec && spec.color_rules;
  if (!cr || !crystal) return null;
  let best: any = null;
  for (const variant of Object.keys(cr)) {
    const rule = cr[variant] || {};
    if (rule.default === true || /_fl$|fluor/i.test(variant)) continue;
    const p = _parseBodyTrigger(rule.trigger);
    if (!p) continue;
    let fires = true;
    for (const cl of p.clauses) { const v = _bodyFieldVal(crystal, cl.field); if (v === null || !(cl.strict ? v > cl.lo : v >= cl.lo)) { fires = false; break; } }
    if (!fires) continue;
    if (!best || p.nClauses > best.nClauses || (p.nClauses === best.nClauses && p.maxLo > best.maxLo)) best = { variant, nClauses: p.nClauses, maxLo: p.maxLo };
  }
  return best ? best.variant : null;
}

// Resolve a crystal's body colour. D1b chemistry variant (if one fires) wins;
// then the D1a chain: per-species override → named default → class_color fallback.
function resolveBodyColour(crystal: any, spec: any): string {
  const cv = _chemistryVariant(crystal, spec);
  if (cv && COLOUR_LEXICON[cv]) return COLOUR_LEXICON[cv];
  const m = crystal && crystal.mineral;
  if (m && SPECIES_BODY_COLOUR[m]) return SPECIES_BODY_COLOUR[m];
  const name = _defaultColourName(spec);
  if (name && COLOUR_LEXICON[name]) return COLOUR_LEXICON[name];
  return (spec && spec.class_color) || '#d2691e';
}
