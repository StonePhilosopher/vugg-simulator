import { describe, expect, it } from 'vitest';

declare const SCENARIOS: Record<string, any>;

const ANHYDRITE_ACCESSORY_SCENARIOS = [
  'mvt',
  'reactivated_fluorite_vein',
  'reactive_wall',
  'wittichen',
];

describe('SCI-02 locality reconciliation', () => {
  it('classifies every reproducible corrected-PHREEQC anhydrite as a modeled accessory', () => {
    for (const scenario of ANHYDRITE_ACCESSORY_SCENARIOS) {
      const spec = SCENARIOS[scenario]._json5_spec;
      const entry = spec.deterministic_species
        .find((row: any) => row.mineral === 'anhydrite');
      expect(entry, scenario).toBeDefined();
      expect(entry.reason, scenario).toMatch(/corrected PHREEQC/i);
      expect(entry.reason, scenario).toMatch(/three evidence seeds/i);
      expect(entry.reason, scenario).toMatch(/accessory/i);
      expect(spec.expects_species, scenario).not.toContain('anhydrite');
    }
  });

  it('keeps undocumented Elmwood anhydrite excluded after the locality audit', () => {
    const spec = SCENARIOS.elmwood._json5_spec;
    expect(spec.expects_species).not.toContain('anhydrite');
    for (const tier of [
      'deterministic_species',
      'statistical_species',
      'aspirational_species',
    ]) {
      expect((spec[tier] || [])
        .some((row: any) => row.mineral === 'anhydrite'), tier).toBe(false);
    }
    expect(spec.excluded_species.anhydrite).toMatch(/not documented/i);
    expect(spec.excluded_species.anhydrite).toMatch(/produces none/i);
    expect(spec.excluded_species.anhydrite).toMatch(/improperly substituted chemical plausibility/i);
  });

  it('requires carbon-ledger authority on each reconciled calcite scenario', () => {
    for (const scenario of [
      'grimsel_alpine_cleft',
      'roughten_gill',
      'sunnyside_american_tunnel',
    ]) {
      expect(SCENARIOS[scenario]._json5_spec.carbon_ledger, scenario).toBe(true);
      expect(SCENARIOS[scenario]().conditions._scenario.carbon_ledger, scenario).toBe(true);
    }
  });
});
