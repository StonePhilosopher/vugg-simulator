// ============================================================
// js/64a-engines-transformation-products.ts
// Dissolution-only reactivity for terminal dehydration products.
// ============================================================
// These phases cannot nucleate or grow directly. They inherit a parent's
// already-booked shells in place, but they remain chemically reactive after
// transformation. Returning a negative zone lets the authoritative LIFO shell
// ledger release exactly the Ca/Cu/U/P/As that those layers originally took
// from solution. No empirical product credit is written here.

function grow_transformation_terminal(crystal, conditions, step) {
  const spec = MINERAL_SPEC[crystal?.mineral];
  if (!spec?._transformation_only || !(crystal?.total_growth_um > 0)) return null;
  const threshold = Number(spec.pH_dissolution_below ?? spec.acid_dissolution?.pH_threshold);
  const pH = Number(conditions?.fluid?.pH);
  if (!Number.isFinite(threshold) || !Number.isFinite(pH) || !(pH < threshold)) return null;

  // Bounded model rate: retreat 12% of the surviving axial shell stack per
  // simulation step, capped at 2 µm physical thickness. This is explicitly a
  // kinetic proxy; mineral identity and mass return come from the authored
  // threshold and booked layer inventory, respectively.
  const physicalRetreatUm = Math.min(2, Math.max(0, crystal.total_growth_um * 0.12));
  if (!(physicalRetreatUm > 0)) return null;
  const clock = Math.max(1e-12, Number(timeScale) || 1);
  const rawRetreatUm = physicalRetreatUm / clock;
  return new GrowthZone({
    step,
    temperature: Number(conditions?.temperature) || 0,
    thickness_um: -rawRetreatUm,
    growth_rate: -rawRetreatUm,
    dissolutionMode: 'acid',
    transformation_reactivity: {
      schema: 'transformation-terminal-acid-v1',
      pH,
      pH_threshold: threshold,
      physical_retreat_um: physicalRetreatUm,
      inventory_authority: 'booked-layer-lifo',
      positive_growth_allowed: false,
    },
    note: `acid dissolution of ${crystal.mineral} pseudomorph (pH ${pH.toFixed(2)} < ${threshold.toFixed(2)}) — booked parent-layer inventory returned`,
  });
}

function grow_haidingerite(crystal, conditions, step) {
  return grow_transformation_terminal(crystal, conditions, step);
}
function grow_meta_autunite(crystal, conditions, step) {
  return grow_transformation_terminal(crystal, conditions, step);
}
function grow_metatorbernite(crystal, conditions, step) {
  return grow_transformation_terminal(crystal, conditions, step);
}
function grow_metazeunerite(crystal, conditions, step) {
  return grow_transformation_terminal(crystal, conditions, step);
}
