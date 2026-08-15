#!/usr/bin/env node
// Seed-42 executable receipt for the North-Pennine physical etch sequence.
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, physicalEtchVisualStateAtStep } =
  await loadSimBundle({
    toolName: 'physical-etch-observe',
    extraExports: ['physicalEtchVisualStateAtStep'],
  });

setSeed(42);
const { conditions, events, defaultSteps } = SCENARIOS.reactivated_fluorite_vein();
const sim = new VugSimulator(conditions, events);

function remaining(crystal, species) {
  let total = 0;
  for (const zone of crystal.zones || []) {
    if (!(zone && zone.thickness_um > 0)) continue;
    const solidUm = Number.isFinite(Number(zone._remaining_solid_um))
      ? Math.max(0, Number(zone._remaining_solid_um))
      : Math.max(0, Number(zone.thickness_um) || 0);
    total += solidUm * (Number(zone._budget_inventory_per_um?.[species]) || 0);
  }
  return total;
}

function localFluid(crystal) {
  const mesh = sim.wall_state.meshFor(sim);
  return mesh.cellOf(crystal, sim.wall_state)?.fluid || sim.conditions.fluid;
}

function fluorites() {
  return sim.crystals.filter((crystal) => crystal.mineral === 'fluorite');
}

function frame(label) {
  const rows = fluorites().map((crystal) => {
    const fluid = localFluid(crystal);
    return {
      id: crystal.crystal_id,
      nucleationStep: crystal.nucleation_step,
      sizeUm: Number(crystal.total_growth_um.toFixed(6)),
      volumeMm3: Number((crystal._volume_mm3 || 0).toFixed(9)),
      dissolved: !!crystal.dissolved,
      etchEvents: crystal.etch_history?.length || 0,
      exposed: physicalEtchVisualStateAtStep(crystal, sim.step),
      gameplaySigma: Number(sim.conditions.supersaturation_fluorite().toFixed(9)),
      localCaPpm: Number(fluid.Ca.toFixed(9)),
      localFPpm: Number(fluid.F.toFixed(9)),
      solidCaPpm: Number(remaining(crystal, 'Ca').toFixed(9)),
      solidFPpm: Number(remaining(crystal, 'F').toFixed(9)),
    };
  });
  console.log(JSON.stringify({ label, step: sim.step, rows }, null, 2));
}

while (sim.step < 117) sim.run_step();
frame('pre-wash');
sim.run_step();
frame('post-etch');
sim.run_step();
frame('post-recharge');
while (sim.step < (defaultSteps || 160)) sim.run_step();
frame('final');

console.log(JSON.stringify({ physicalEtchReceipts: sim._physicalEtchReceipts }, null, 2));
