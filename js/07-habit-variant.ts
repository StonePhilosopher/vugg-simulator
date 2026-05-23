// ============================================================
// js/07-habit-variant.ts — Habit-variant picker
// ============================================================
// selectHabitVariant — scores each habit_variants[] entry of MINERAL_SPEC[mineral] by trigger keywords (low/moderate/high σ, T) and vector vs. space constraint, then weighted-randoms a pick. Mirrors select_habit_variant in vugg.py. Reads the global rng (declared later in 99-legacy-bundle.ts).
//
// Phase B3 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS (no import/export);
// every top-level declaration is a global available to later modules.

// Pick a habit variant for a nucleating crystal based on current σ / T / space / fill.
// Mirrors select_habit_variant in vugg.py: triggers like "low σ" / "high σ" /
// "moderate T" are matched against current conditions; vectors ("coating"
// vs "projecting") are weighed against how crowded the vug is. Returns
// the chosen variant dict, or null if the mineral has no variant objects.
//
// 2026-05-18 Proposal B (high-fill habit transitions): added `localFill`
// parameter. Habit variants can now carry trigger keywords "high fill" /
// "high-fill" / "drusy" / "post-seal" (favored when vugFill > 0.75) or
// "low fill" / "low-fill" (favored when vugFill < 0.7). This encodes the
// geological reality that boundary-layer diffusion at high fill biases
// growth toward edge-favored skeletal/hopper habits or microcrystalline
// drusy crusts. See proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md §5 (Proposal B).
//
// `localFill` is optional and defaults to undefined when fill info isn't
// available (legacy call paths, library/preview rendering). When absent,
// the fill scoring is skipped — backward compatible.
function selectHabitVariant(mineral, sigma, temperature, spaceConstrained, localFill) {
  const entry = MINERAL_SPEC[mineral];
  if (!entry) return null;
  const variants = (entry.habit_variants || []).filter(v => v && typeof v === 'object');
  if (!variants.length) return null;

  const score = (v) => {
    const trig = (v.trigger || '').toLowerCase();
    let s = 1.0;
    if (trig.includes('very high σ')) s += sigma > 4.0 ? 2.0 : -1.5;
    else if (trig.includes('high σ')) s += sigma > 3.0 ? 1.5 : -1.0;
    else if (trig.includes('moderate-high σ') || trig.includes('moderate σ')) s += (sigma >= 1.5 && sigma <= 3.5) ? 1.5 : -0.5;
    else if (trig.includes('low-moderate σ')) s += (sigma >= 1.0 && sigma <= 2.2) ? 1.2 : -0.4;
    else if (trig.includes('low σ')) s += sigma < 2.0 ? 1.2 : -0.8;

    if (trig.includes('high t')) s += temperature > 300 ? 1.0 : -0.6;
    else if (trig.includes('moderate t')) s += (temperature >= 150 && temperature <= 300) ? 1.0 : -0.4;
    else if (trig.includes('low t')) s += temperature < 150 ? 1.0 : -0.6;

    // Proposal B (2026-05): high-fill / drusy / post-seal triggers. Skip
    // entirely if localFill wasn't passed (legacy call sites, library
    // preview, etc.) — preserves backward compat for those paths.
    if (typeof localFill === 'number') {
      if (trig.includes('post-seal')) s += localFill > 0.95 ? 2.0 : -1.5;
      else if (trig.includes('high fill') || trig.includes('high-fill') || trig.includes('drusy')) {
        s += localFill > 0.75 ? 1.5 : -1.0;
      } else if (trig.includes('low fill') || trig.includes('low-fill')) {
        s += localFill < 0.7 ? 0.6 : -0.4;
      }
    }

    // Vector taxonomy (descriptive tag for how the crystal extends from
    // substrate; also shown in the hovertext via 99f-renderer-interaction):
    //   equant       — extends equally all directions (cubes, octahedra)
    //   projecting   — extends outward into cavity (acicular, prismatic)
    //   coating      — spreads along the wall (botryoidal, druzy crust)
    //   tabular      — flat plates parallel to the wall
    //   dendritic    — true branching / tree-like growth (native silver
    //                  wire, native copper arborescent, gold dendrites)
    //   skeletal     — partial-growth crystal-form silhouette with
    //                  inward-growing faces (galena hopper, quartz
    //                  fenster, halite hopper, bismuth staircase cubes).
    //                  v135 (2026-05-22) split out from `dendritic`: both
    //                  are partial-growth phenomena under supersaturation
    //                  but geometrically distinct — dendrites branch like
    //                  trees, skeletal/hopper crystals KEEP their
    //                  crystal-form silhouette but with stair-stepped or
    //                  hollow faces.
    // Only projecting/coating/tabular are space-aware below — the rest
    // are descriptive labels with no dispatch effect (they're for the
    // hovertext + library card text only).
    const vec = (v.vector || '').toLowerCase();
    if (spaceConstrained) {
      if (vec === 'projecting') s -= 0.8;
      else if (vec === 'coating') s += 0.6;
      else if (vec === 'tabular') s += 0.3;
    }
    if (trig.startsWith('default')) s += 0.3;

    return Math.max(s, 0.05);
  };

  const weights = variants.map(v => {
    const sc = score(v);
    return sc * sc;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return variants[0];
  let r = rng.random() * total;
  for (let i = 0; i < variants.length; i++) {
    r -= weights[i];
    if (r <= 0) return variants[i];
  }
  return variants[variants.length - 1];
}

