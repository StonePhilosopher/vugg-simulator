// A representation/accounting contract, not a new physical calcite model.
// No growth, fluid, RNG, DOM, or graphics dependencies.
const frozen = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
};
export const CALCITE_VOLUME_CONTRACT = frozen({
  schema: 'calcite-volume-reconciliation-v1',
  status: 'scientific-solid-closure-unresolved',
  units: { volumes: 'mm^3', dimensions: 'mm', factors: 'dimensionless' },
  quantities: {
    booked: { field: 'facts.bookedVolumeMm3', owner: 'accepted growth-zone inventory',
      meaning: 'Legacy ellipsoid-equivalent accounting volume; not a measured closed surface.',
      consumers: ['chemistry', 'fill', 'occupancy', 'dissolution-inventory'] },
    full: { field: 'completion.volumeAudit.fullVolumeMm3', owner: 'recorded procedural completion',
      meaning: 'Full Wulff body at the captured normalization, including O1a/O1b; before clipping.',
      consumers: ['factor-inspection'] },
    attached: { field: 'completion.volumeAudit.attachedVolumeMm3', owner: 'recorded procedural completion',
      meaning: 'Full body intersected with the recorded attachment half-space.',
      consumers: ['factor-inspection'] },
    completed: { field: 'completion.volumeMm3', owner: 'recorded procedural completion',
      meaning: 'Closed stored surface after attachment and contact half-spaces; visibility scale exactly one.',
      consumers: ['surface-reconstruction', 'surface-inspection'] },
  },
  relationship: 'completed = booked * fullToBooked * attachmentRetention * contactRetention',
  dimensionConvention: 'booked = pi/6 * aWidthMm^2 * cLengthMm; this does not constrain Wulff extents',
  factorsAre: 'per-record measured representation ratios; not porosity, density, hidden material, or calibration',
  conversionTolerance: { relative: 1e-8, absoluteMm3: 1e-10, dimensionlessAbsolute: 1e-12 },
  conservation: 'Only accepted growth events change booked inventory. Completion, clipping, save/load, and display return no mass.',
  physicalReconciliation: 'unresolved; no equality, rescaling, or inverse conversion is authorized',
  legacy: 'Old or incomplete records remain historical evidence; refuse this contract and require original sources for recapture. Never infer missing factors or history from current fluid.',
  allowedConsumers: { booked: ['chemistry', 'fill', 'occupancy', 'dissolution-inventory'],
    completed: ['surface-reconstruction', 'surface-inspection'] },
  forbidden: 'No geometry-to-mass substitution, renderer rescaling, or feedback.',
});

function positive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw Error(`Invalid calcite volume: ${label}`);
  return value;
}
function near(actual, expected, label, dimensionless = false) {
  const t = CALCITE_VOLUME_CONTRACT.conversionTolerance;
  const tolerance = Math.max(dimensionless ? t.dimensionlessAbsolute : t.absoluteMm3,
    t.relative * Math.abs(expected));
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) throw Error(`Calcite volume contract: ${label}`);
}

// Checks stages individually. Final-product closure cannot excuse a bad stage
// or an arbitrarily large dimensionless error on a very small crystal.
export function assertCalciteVolumeContract(crystal, measuredCompletedMm3) {
  const f = crystal?.facts, c = crystal?.completion, a = c?.volumeAudit;
  if (!f || !a || c.visibilityScale !== 1 || c.volumeIsMassAuthority !== false) throw Error('Missing calcite volume authority');
  const booked = positive(f.bookedVolumeMm3, 'booked'), full = positive(a.fullVolumeMm3, 'full');
  const attached = positive(a.attachedVolumeMm3, 'attached'), completed = positive(c.volumeMm3, 'completed');
  positive(f.cLengthMm, 'length'); positive(f.aWidthMm, 'width');
  near(booked, Math.PI / 6 * f.aWidthMm ** 2 * f.cLengthMm, 'booked dimension convention');
  for (const key of ['fullToBooked', 'attachmentRetention', 'contactRetention']) positive(a[key], key);
  near(a.fullToBooked, full / booked, 'full/booked ratio', true);
  near(a.attachmentRetention, attached / full, 'attachment ratio', true);
  near(a.contactRetention, completed / attached, 'contact ratio', true);
  if (a.attachmentRetention > 1 + 1e-8 || a.contactRetention > 1 + 1e-8) throw Error('Calcite clipping cannot add volume');
  near(full, booked * a.fullToBooked, 'full stage');
  near(attached, full * a.attachmentRetention, 'attachment stage');
  near(completed, attached * a.contactRetention, 'contact stage');
  near(completed, booked * a.fullToBooked * a.attachmentRetention * a.contactRetention, 'factor product');
  near(measuredCompletedMm3, completed, 'stored surface volume');
  return frozen({ schema: CALCITE_VOLUME_CONTRACT.schema, units: 'mm^3',
    booked, full, attached, completed, completedToBooked: completed / booked,
    arithmeticClosure: 'passed', physicalClosure: 'unresolved', productionAllowed: false });
}

// All consumers name the quantity and purpose. There is deliberately no
// density/porosity conversion and no geometry fallback for missing inventory.
export function calciteVolumeForConsumer(crystal, quantity, consumer, measuredCompletedMm3) {
  const values = assertCalciteVolumeContract(crystal, measuredCompletedMm3);
  const definition = CALCITE_VOLUME_CONTRACT.quantities[quantity];
  if (!definition || !definition.consumers.includes(consumer)) throw Error(`Calcite volume consumer not authorized: ${quantity}/${consumer}`);
  return frozen({ value: values[quantity], units: 'mm^3', owner: definition.owner,
    quantity, physicalClosure: 'unresolved' });
}
