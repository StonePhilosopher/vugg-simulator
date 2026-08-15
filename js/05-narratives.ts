// ============================================================
// js/05-narratives.ts — Narrative-template loader
// ============================================================
// Frontmatter-aware Markdown loader for per-species narrators. Pre-fetches
// every entry of the generated _NARRATIVE_MANIFEST in parallel; renderer code
// reads synchronously from _NARRATIVE_CACHE via narrative_blurb,
// narrative_closing, and narrative_variant.
//
// Phase B3 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS (no import/export);
// every top-level declaration is a global available to later modules.


// ============================================================
// NARRATIVE TEMPLATES — narratives/<species>.md
// ============================================================
// Per-species prose lives in narratives/<species>.md as Markdown files with
// frontmatter and named variant sections. tools/narrative-workflow.mjs derives
// the manifest from data/minerals.json + the directory contents and rejects
// missing sections or stale inline fallbacks before a build can ship.

const _NARRATIVE_CACHE = {};
let NARRATIVES_READY = false;

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
      return { species, loaded: true, path: p };
    } catch (e) { /* try next */ }
  }
  console.error(`[narratives] ${species}.md fetch failed — canonical prose is unavailable`);
  _NARRATIVE_CACHE[species] = {};
  return { species, loaded: false, path: null };
}

// Kick off all manifest fetches in parallel and expose a deterministic,
// fail-closed readiness receipt. Simulation entry points await this promise;
// the VugSimulator constructor independently asserts readiness so a direct
// programmatic caller cannot bypass the gate.
const NARRATIVES_READY_PROMISE = Promise.all(_NARRATIVE_MANIFEST.map(_loadNarrative))
  .then(results => {
    const failed = results.filter(result => !result.loaded).map(result => result.species);
    const receipt = Object.freeze({
      expected: _NARRATIVE_MANIFEST.length,
      loaded: results.length - failed.length,
      failed: Object.freeze(failed),
    });
    if (failed.length) {
      const error: any = new Error(
        `[narratives] ${failed.length}/${results.length} canonical files failed: ${failed.join(', ')}`,
      );
      error.name = 'NarrativePreloadError';
      error.receipt = receipt;
      console.error(error.message);
      throw error;
    }
    NARRATIVES_READY = true;
    console.info(`[narratives] loaded ${results.length} species`);
    return receipt;
  });

function narrativesReady() {
  return NARRATIVES_READY;
}

async function waitForNarrativesReady() {
  const receipt = await NARRATIVES_READY_PROMISE;
  if (!NARRATIVES_READY) {
    throw new Error('[narratives] canonical prose preload did not reach ready state');
  }
  return receipt;
}

function assertNarrativesReady() {
  if (!NARRATIVES_READY) {
    throw new Error(
      '[narratives] simulation startup blocked until all canonical prose is available',
    );
  }
}

function _narrative_interp(template, ctx) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    (ctx && Object.prototype.hasOwnProperty.call(ctx, key)) ? String(ctx[key]) : `{${key}}`
  );
}

function narrative_blurb(species, ctx?) {
  const sections = _NARRATIVE_CACHE[species];
  const template = sections && sections.blurb;
  if (!template) return '';
  return _narrative_interp(template, ctx || {});
}

function narrative_closing(species, ctx?) {
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
