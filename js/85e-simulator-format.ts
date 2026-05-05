// ============================================================
// js/85e-simulator-format.ts — VugSimulator methods (Object.assign mixin)
// ============================================================
// Methods attached to VugSimulator.prototype after the class is defined
// in 85-simulator.ts, so direct calls and dynamic dispatch keep working.
//
// Methods here (2): format_header, format_summary.
//
// Phase B20 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugSimulator.prototype, {
  format_header() {
  const c = this.conditions;
  const sigma_q = c.supersaturation_quartz();
  const sigma_c = c.supersaturation_calcite();
  let wall_info = '';
  if (c.wall.total_dissolved_mm > 0) {
    wall_info = ` │ Vug: ${c.wall.vug_diameter_mm.toFixed(0)}mm (+${c.wall.total_dissolved_mm.toFixed(1)})`;
  }
  return `═══ Step ${String(this.step).padStart(3)} │ T=${this.conditions.temperature.toFixed(1).padStart(6)}°C │ P=${c.pressure.toFixed(2)} kbar │ pH=${c.fluid.pH.toFixed(1)} │ σ(Qz)=${sigma_q.toFixed(2)} σ(Cal)=${sigma_c.toFixed(2)}${wall_info} │ Fluid: ${c.fluid.describe()}`;
},

  format_summary() {
  const lines = [];
  lines.push('');
  const yearsPerStep = timeScale * 10000;
  const totalYears = this.step * yearsPerStep;
  const timeStr = totalYears >= 1e6 ? `~${(totalYears / 1e6).toFixed(1)} million years` : `~${(totalYears / 1000).toFixed(0)},000 years`;
  lines.push('═'.repeat(70));
  lines.push(`FINAL VUG INVENTORY — ${this.step} steps (${timeStr})`);
  lines.push('═'.repeat(70));

  // Vug wall stats if dissolution occurred
  const w = this.conditions.wall;
  if (w.total_dissolved_mm > 0) {
    const orig_diam = w.vug_diameter_mm - w.total_dissolved_mm * 2;
    lines.push('');
    lines.push('VUG CAVITY');
    lines.push(`  Host rock: ${w.composition}`);
    lines.push(`  Original diameter: ${orig_diam.toFixed(0)} mm`);
    lines.push(`  Final diameter: ${w.vug_diameter_mm.toFixed(0)} mm`);
    lines.push(`  Total wall dissolved: ${w.total_dissolved_mm.toFixed(1)} mm`);
    lines.push('  The acid made the room. The room grew the crystals.');
  }

  for (const c of this.crystals) {
    lines.push('');
    lines.push(`${c.mineral.toUpperCase()} #${c.crystal_id}`);
    lines.push(`  Nucleated: step ${c.nucleation_step} at ${c.nucleation_temp.toFixed(0)}°C`);
    lines.push(`  Position: ${c.position}`);
    lines.push(`  Morphology: ${c.describe_morphology()}`);
    lines.push(`  Growth zones: ${c.zones.length}`);
    lines.push(`  Total growth: ${c.total_growth_um.toFixed(0)} µm (${c.c_length_mm.toFixed(1)} mm)`);

    const fi_count = c.zones.filter(z => z.fluid_inclusion).length;
    if (fi_count) {
      const fi_types = [...new Set(c.zones.filter(z => z.fluid_inclusion).map(z => z.inclusion_type))];
      lines.push(`  Fluid inclusions: ${fi_count} (${fi_types.join(', ')})`);
    }
    if (c.twinned) lines.push(`  Twinning: ${c.twin_law}`);
    if (c.dissolved) lines.push(`  Note: partially dissolved (late-stage undersaturation)`);
    if (c.phantom_count > 0) {
      lines.push(`  Phantom boundaries: ${c.phantom_count} (dissolution surfaces preserved inside crystal)`);
    }

    // Provenance (for calcite with wall dissolution)
    if (c.mineral === 'calcite' && c.zones.length) {
      const wall_zones = c.zones.filter(z => z.ca_from_wall > 0.1);
      if (wall_zones.length) {
        const avg_wall = wall_zones.reduce((s, z) => s + z.ca_from_wall, 0) / wall_zones.length;
        const max_wall = Math.max(...wall_zones.map(z => z.ca_from_wall));
        lines.push(`  Provenance: ${wall_zones.length}/${c.zones.length} zones contain wall-derived Ca²⁺`);
        lines.push(`    Average wall contribution: ${(avg_wall * 100).toFixed(0)}%, peak: ${(max_wall * 100).toFixed(0)}%`);
        const first_wall_zone = c.zones.find(z => z.ca_from_wall > 0.1);
        if (first_wall_zone) {
          lines.push(`    Wall-derived Ca first appears at step ${first_wall_zone.step} (T=${first_wall_zone.temperature.toFixed(0)}°C)`);
        }
      }
    }

    const fl = c.predict_fluorescence();
    if (fl !== 'non-fluorescent') lines.push(`  Predicted UV fluorescence: ${fl}`);

    if (c.zones.length) {
      const temps = c.zones.map(z => z.temperature);
      const minT = Math.min(...temps), maxT = Math.max(...temps);
      lines.push(`  Growth temperature range: ${minT.toFixed(0)}–${maxT.toFixed(0)}°C`);
      if (c.mineral === 'quartz') {
        const ti_vals = c.zones.filter(z => z.trace_Ti > 0).map(z => z.trace_Ti);
        if (ti_vals.length) {
          const avg_ti = ti_vals.reduce((a, b) => a + b, 0) / ti_vals.length;
          lines.push(`  Avg Ti-in-quartz: ${avg_ti.toFixed(3)} ppm (TitaniQ range: ${minT.toFixed(0)}–${maxT.toFixed(0)}°C)`);
        }
      }
    }
  }

  lines.push('');
  lines.push('═'.repeat(70));

  const narrative = this.narrate();
  if (narrative) {
    lines.push('');
    lines.push('GEOLOGICAL HISTORY');
    lines.push('─'.repeat(70));
    lines.push(narrative);
    lines.push('═'.repeat(70));
  }

  return lines;
},
});
