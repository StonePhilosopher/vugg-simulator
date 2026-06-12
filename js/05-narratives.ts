// ============================================================
// js/05-narratives.ts — Narrative-template loader
// ============================================================
// Frontmatter-aware Markdown loader for per-species narrators. Pre-fetches every entry of _NARRATIVE_MANIFEST in parallel; renderer code reads synchronously from _NARRATIVE_CACHE via narrative_blurb / narrative_closing / narrative_variant.
//
// Phase B3 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS (no import/export);
// every top-level declaration is a global available to later modules.


// ============================================================
// NARRATIVE TEMPLATES — narratives/<species>.md
// ============================================================
// Mirrors the Python-side narrative loader. Per-species prose lives
// in narratives/<species>.md as markdown files with frontmatter +
// named variant sections. JS pre-fetches the files at startup;
// narrator methods read synchronously from the cache.
//
// Phase 1 (this commit, 2026-04-30): chalcopyrite proof-of-concept.
// Phase 2 (deferred): the remaining 88 species, after the design
// proves out per
// proposals/TASK-BRIEF-NARRATIVE-READABILITY.md (boss expansion).

const _NARRATIVE_CACHE = {};
// Phase-1 manifest — extend as more species migrate. When all 89 are
// extracted the manifest can become a generated index file fetched
// once at startup.
const _NARRATIVE_MANIFEST = ['chalcopyrite', 'sphalerite', 'aurichalcite', 'dolomite', 'rosasite', 'azurite', 'calcite', 'aragonite', 'siderite', 'rhodochrosite', 'cerussite', 'smithsonite', 'malachite', 'pyrite', 'galena', 'marcasite', 'hematite', 'molybdenite', 'bornite', 'chalcocite', 'covellite', 'cuprite', 'native_copper', 'native_gold', 'native_silver', 'magnetite', 'lepidocrocite', 'goethite', 'barite', 'celestine', 'anhydrite', 'jarosite', 'alunite', 'brochantite', 'antlerite', 'chalcanthite', 'scorodite', 'ferrimolybdite', 'fluorite', 'pyromorphite', 'vanadinite', 'mimetite', 'descloizite', 'mottramite', 'selenite', 'adamite', 'olivenite', 'erythrite', 'annabergite', 'torbernite', 'zeunerite', 'carnotite', 'autunite', 'uranospinite', 'tyuyamunite', 'wulfenite', 'raspite', 'stolzite', 'beryl', 'emerald', 'aquamarine', 'morganite', 'heliodor', 'corundum', 'ruby', 'sapphire', 'albite', 'apophyllite', 'uraninite', 'anglesite', 'tetrahedrite', 'tennantite', 'nickeline', 'millerite', 'cobaltite', 'stibnite', 'arsenopyrite', 'bismuthinite', 'feldspar', 'native_bismuth', 'clinobisvanite', 'acanthite', 'argentite', 'native_tellurium', 'native_sulfur', 'native_arsenic', 'wurtzite', 'spodumene', 'chrysocolla', 'quartz', 'topaz', 'tourmaline', 'halite'];

function _parseNarrative(text) {
  // Strip frontmatter (--- block at top).
  if (text.startsWith('---')) {
    const endIdx = text.indexOf('\n---\n', 4);
    if (endIdx > 0) text = text.slice(endIdx + 5);
  }
  const sections = {};
  const parts = ('\n' + text).split(/\n## /);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const newlineIdx = trimmed.indexOf('\n');
    const head = newlineIdx >= 0 ? trimmed.slice(0, newlineIdx).trim() : trimmed.trim();
    const body = newlineIdx >= 0 ? trimmed.slice(newlineIdx + 1).trim() : '';
    sections[head] = body;
  }
  return sections;
}

async function _loadNarrative(species) {
  const paths = [
    `./narratives/${species}.md`,
    `../narratives/${species}.md`,
    `/narratives/${species}.md`,
  ];
  for (const p of paths) {
    try {
      const r = await fetch(p, { cache: 'no-store' });
      if (!r.ok) continue;
      const text = await r.text();
      _NARRATIVE_CACHE[species] = _parseNarrative(text);
      return;
    } catch (e) { /* try next */ }
  }
  console.warn(`[narratives] ${species}.md fetch failed — narrator will fall back to inline string`);
  _NARRATIVE_CACHE[species] = {};
}

// Kick off all manifest fetches in parallel.
Promise.all(_NARRATIVE_MANIFEST.map(_loadNarrative))
  .then(() => console.info(`[narratives] loaded ${_NARRATIVE_MANIFEST.length} species`))
  .catch(err => console.error(`[narratives] manifest load failed: ${err && err.message}`));

function _narrative_interp(template, ctx) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    (ctx && Object.prototype.hasOwnProperty.call(ctx, key)) ? String(ctx[key]) : `{${key}}`
  );
}

function narrative_blurb(species, ctx?) {
  // Boss-design schema (2026-04-30): blurb may contain {key} placeholders.
  const sections = _NARRATIVE_CACHE[species];
  const template = sections && sections.blurb;
  if (!template) return '';
  return _narrative_interp(template, ctx || {});
}

function narrative_closing(species, ctx?) {
  // Boss-design schema (2026-04-30): `## closing` always emits at end.
  const sections = _NARRATIVE_CACHE[species];
  const template = sections && sections.closing;
  if (!template) return '';
  return _narrative_interp(template, ctx || {});
}

function narrative_variant(species, variant, ctx?) {
  const sections = _NARRATIVE_CACHE[species];
  if (!sections) return '';
  const template = sections[`variant: ${variant}`];
  if (!template) return '';
  return _narrative_interp(template, ctx || {});
}

