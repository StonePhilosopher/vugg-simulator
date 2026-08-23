// ============================================================
// js/21-enclosure-authority.ts — current physical-inclusion authority
// ============================================================
// `enclosed_by` is a convenient rendering/topology projection. It is not a
// chemical seal. Chemistry may withhold a crystal only when the append-only
// lifecycle is chronological and its current event agrees with the guest
// receipt and the host's reciprocal topology.

const _ENCLOSURE_AUTHORITY_ROUTES = new Set([
  'guest-on-host', 'host-on-guest', 'geometric-overlap',
]);
const _isEnclosureCrystalId = (value: any): boolean => typeof value === 'number'
  && Number.isSafeInteger(value) && value > 0;
const _isEnclosureStep = (value: any): boolean => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;
const _isEnclosureMineral = (value: any): boolean => typeof value === 'string'
  && value.trim().length > 0 && value === value.trim();
const _isEnclosureNumber = (value: any): boolean => typeof value === 'number'
  && Number.isFinite(value);
const _enclosureClose = (left: number, right: number): boolean =>
  Math.abs(left - right) <= Math.max(1e-9, Math.abs(left) * 1e-9, Math.abs(right) * 1e-9);

const _enclosurePhysicalInventoryAt = (crystal: any, throughStep: number): any => {
  if (!Array.isArray(crystal?.zones)) return null;
  let positiveCoreUm = 0;
  let lossUm = 0;
  const acceptedZones: any[] = [];
  for (const zone of crystal.zones) {
    if (!zone || !_isEnclosureStep(zone.step)
        || !_isEnclosureNumber(zone.thickness_um)) return null;
    if (zone.step > throughStep) continue;
    acceptedZones.push(zone);
    if (zone.thickness_um > 0 && zone.is_phantom !== true) {
      positiveCoreUm += zone.thickness_um;
    } else if (zone.thickness_um < 0) {
      lossUm += Math.abs(zone.thickness_um);
    }
  }
  return {
    positiveCoreUm,
    lossUm,
    remainingUm: Math.max(0, positiveCoreUm - lossUm),
    acceptedZones,
  };
};

const _ENCLOSURE_DEHYDRATION_LINEAGE: Record<string, string> = {
  borax: 'tincalconite',
  mirabilite: 'thenardite',
  autunite: 'meta-autunite',
  torbernite: 'metatorbernite',
  zeunerite: 'metazeunerite',
  pharmacolite: 'haidingerite',
};

const _enclosureKnownCaSO4Transition = (record: any): boolean => {
  const forward = record?.from === 'selenite' && record?.to === 'anhydrite'
    && record?.driver === 'gypsum-to-anhydrite-replacement'
    && record?.phaseAtTransition === 'anhydrite';
  const reverse = record?.from === 'anhydrite' && record?.to === 'selenite'
    && record?.driver === 'anhydrite-rehydration'
    && record?.phaseAtTransition === 'gypsum';
  if (record?.schema !== 'caso4-phase-replacement-v1' || (!forward && !reverse)) return false;
  const numeric = [
    record.waterTransferMmolKg, record.formulaAmountMmolKg,
    record.boundaryC, record.uncertaintyC, record.waterActivity,
    record.sourceSI, record.productSI, record.caBeforePpm, record.caAfterPpm,
    record.sulfateBeforePpm, record.sulfateAfterPpm, record.temperatureC,
    record.fluidPressureKbar, record.solidGrowthUm,
  ];
  if (!numeric.every(_isEnclosureNumber)
      || !(record.formulaAmountMmolKg > 0) || !(record.solidGrowthUm > 0)
      || !(record.uncertaintyC > 0) || !(record.waterActivity > 0)
      || record.waterActivity > 1 || !(record.productSI > 0)
      || !(record.fluidPressureKbar >= 0)
      || !_enclosureClose(record.formulaAmountMmolKg,
        record.solidGrowthUm * STOICHIOMETRIC_GROWTH_BUDGET_FORMULA_MMOL_PER_KG_PER_UM)
      || !_enclosureClose(record.caBeforePpm, record.caAfterPpm)
      || !_enclosureClose(record.sulfateBeforePpm, record.sulfateAfterPpm)
      || !_enclosureClose(record.waterTransferMmolKg,
        (forward ? 2 : -2) * record.formulaAmountMmolKg)) return false;
  return forward
    ? record.temperatureC > record.boundaryC + record.uncertaintyC
    : record.temperatureC < record.boundaryC - record.uncertaintyC;
};

const _ENCLOSURE_TODOROKITE_MG_PER_MN_MASS = 24.305 / (6 * 54.938044);
const _enclosureKnownTodorokiteTransition = (record: any, host: any): boolean => {
  if (record?.schema !== 'birnessite-todorokite-transformation-v1'
      || record?.from !== 'birnessite' || record?.to !== 'todorokite'
      || record?.driver !== 'Mg-exchanged-birnessite-to-todorokite'
      || !Array.isArray(record.temperatureEnvelopeC)
      || record.temperatureEnvelopeC.length !== 2
      || record.temperatureEnvelopeC[0] !== 95
      || record.temperatureEnvelopeC[1] !== 200
      || !Array.isArray(record.zoneAllocations)
      || record.zoneAllocations.length === 0) return false;
  const numeric = [
    record.bookedMnPreservedPpm, record.structuralMgBookedPpm,
    record.mgBeforePpm, record.mgAfterPpm, record.temperatureC,
    record.mgPerMnMassRatio,
  ];
  if (!numeric.every(_isEnclosureNumber)
      || !(record.bookedMnPreservedPpm > 0)
      || !(record.structuralMgBookedPpm > 0)
      || record.temperatureC < 95 || record.temperatureC > 200
      || !_enclosureClose(record.mgPerMnMassRatio, _ENCLOSURE_TODOROKITE_MG_PER_MN_MASS)
      || !_enclosureClose(record.structuralMgBookedPpm,
        record.bookedMnPreservedPpm * _ENCLOSURE_TODOROKITE_MG_PER_MN_MASS)
      || !_enclosureClose(record.mgBeforePpm - record.mgAfterPpm,
        record.structuralMgBookedPpm)) return false;
  const seen = new Set<number>();
  let bookedMn = 0;
  let bookedMg = 0;
  for (const allocation of record.zoneAllocations) {
    const zoneIndex = allocation?.zone_index;
    if (!_isEnclosureStep(zoneIndex) || seen.has(zoneIndex)) return false;
    seen.add(zoneIndex);
    const zone = host?.zones?.[zoneIndex];
    const remainingNow = Number.isFinite(Number(zone?._remaining_solid_um))
      ? Math.max(0, Number(zone._remaining_solid_um))
      : Math.max(0, Number(zone?.thickness_um) || 0);
    const fields = [
      allocation.remaining_solid_um_at_transition, allocation.mn_ppm_per_um,
      allocation.mg_ppm_per_um_before, allocation.mg_ppm_per_um_added,
    ];
    if (!zone || !fields.every(_isEnclosureNumber)
        || !(allocation.remaining_solid_um_at_transition > 0)
        || remainingNow > allocation.remaining_solid_um_at_transition + 1e-9
        || !(allocation.mn_ppm_per_um > 0)
        || !(allocation.mg_ppm_per_um_added > 0)
        || !_enclosureClose(Number(zone._budget_inventory_per_um?.Mn) || 0,
          allocation.mn_ppm_per_um)
        || !_enclosureClose(allocation.mg_ppm_per_um_added,
          allocation.mn_ppm_per_um * _ENCLOSURE_TODOROKITE_MG_PER_MN_MASS)
        || !_enclosureClose(Number(zone._budget_inventory_per_um?.Mg) || 0,
          allocation.mg_ppm_per_um_before + allocation.mg_ppm_per_um_added)) return false;
    bookedMn += allocation.remaining_solid_um_at_transition * allocation.mn_ppm_per_um;
    bookedMg += allocation.remaining_solid_um_at_transition * allocation.mg_ppm_per_um_added;
  }
  return _enclosureClose(bookedMn, record.bookedMnPreservedPpm)
    && _enclosureClose(bookedMg, record.structuralMgBookedPpm);
};

const _enclosureKnownPhaseTransition = (record: any, host: any): boolean => {
  if (!_isEnclosureMineral(record?.from) || !_isEnclosureMineral(record?.to)
      || !_isEnclosureMineral(record?.driver) || !_isEnclosureStep(record?.step)) return false;
  return (record.schema === 'paramorph-transition-v1'
      && record.from === 'argentite' && record.to === 'acanthite'
      && record.driver === 'cooling-below-phase-boundary'
      && _isEnclosureNumber(record.temperature_C)
      && _isEnclosureNumber(record.phase_boundary_C)
      && record.temperature_C < record.phase_boundary_C
      && record.phase_boundary_C === 173
      && record.external_form_preserved === true)
    || (record.schema === 'light-induced-transformation-v1'
      && record.from === 'realgar' && record.to === 'pararealgar'
      && record.driver === 'visible-light-isomerization'
      && (record.exposure_route === 'surface' || record.exposure_route === 'excavated')
      && _isEnclosureNumber(record.exposure_steps)
      && _isEnclosureNumber(record.threshold_steps)
      && record.threshold_steps === 60
      && record.exposure_steps >= record.threshold_steps)
    || _enclosureKnownCaSO4Transition(record)
    || _enclosureKnownTodorokiteTransition(record, host);
};

const _enclosureKnownDehydrationTransition = (record: any): boolean =>
  record?.schema === 'dehydration-transformation-v1'
  && _isEnclosureMineral(record.from)
  && _isEnclosureMineral(record.to)
  && _isEnclosureMineral(record.driver)
  && _isEnclosureStep(record.step)
  && _ENCLOSURE_DEHYDRATION_LINEAGE[record.from] === record.to
  && (record.driver === 'temperature' || record.driver === 'dry-exposure')
  && _isEnclosureNumber(record.formula_amount_mmol_kg)
  && record.formula_amount_mmol_kg > 0;

const _enclosureHistoryLineage = (
  history: any[],
  mineralAtEnclosure: string,
  enclosureStep: number,
  currentMineral: string,
  validate: (record: any) => boolean,
): boolean => {
  if (!history.length) return false;
  let mineral = history[0]?.from;
  let mineralAtEvent = mineral;
  let priorStep = -1;
  for (const record of history) {
    if (!validate(record) || record.step <= priorStep || record.from !== mineral) return false;
    mineral = record.to;
    if (record.step < enclosureStep) mineralAtEvent = mineral;
    priorStep = record.step;
  }
  return mineralAtEvent === mineralAtEnclosure && mineral === currentMineral;
};

const _enclosureHostMineralLineage = (
  host: any,
  mineralAtEnclosure: string,
  enclosureStep: number,
): boolean => {
  if (!_isEnclosureMineral(host?.mineral)) return false;
  if (host.mineral === mineralAtEnclosure) return true;
  const phaseHistory = Array.isArray(host.phase_transition_history)
    ? host.phase_transition_history : [];
  if (phaseHistory.length) {
    return _enclosureHistoryLineage(
      phaseHistory, mineralAtEnclosure, enclosureStep, host.mineral,
      (record: any) => _enclosureKnownPhaseTransition(record, host),
    );
  }
  const dehydrationHistory = Array.isArray(host.dehydration_history)
    ? host.dehydration_history : [];
  if (dehydrationHistory.length) {
    return _enclosureHistoryLineage(
      dehydrationHistory, mineralAtEnclosure, enclosureStep, host.mineral,
      _enclosureKnownDehydrationTransition,
    );
  }
  return false;
};

const _runtimeEnclosureLifecycleState = (events: any): Map<number, any> | null => {
  if (!Array.isArray(events)) return null;
  const current = new Map<number, any>();
  const lastStep = new Map<number, number>();
  for (const event of events) {
    const isEnclosure = event?.schema === 'enclosure-receipt-v1'
      && event?.event === 'enclosed';
    const isLiberation = event?.schema === 'liberation-receipt-v1'
      && event?.event === 'liberated';
    if (!isEnclosure && !isLiberation) return null;
    if (event.host_crystal_id == null || event.guest_crystal_id == null) return null;
    const hostId = event.host_crystal_id;
    const guestId = event.guest_crystal_id;
    const step = event.step;
    if (!_isEnclosureCrystalId(hostId) || !_isEnclosureCrystalId(guestId)
        || hostId === guestId || !_isEnclosureStep(step)
        || !_isEnclosureMineral(event.host_mineral)
        || !_isEnclosureMineral(event.guest_mineral)) return null;
    const previous = lastStep.get(guestId);
    if (previous != null && step <= previous) return null;

    if (isEnclosure) {
      if (current.has(guestId) || typeof event.route !== 'string'
          || !_ENCLOSURE_AUTHORITY_ROUTES.has(event.route)) return null;
      current.set(guestId, event);
    } else {
      const enclosureStep = event.enclosure_step;
      const prior = current.get(guestId);
      if (!_isEnclosureStep(enclosureStep)
          || !prior
          || prior.host_crystal_id !== hostId
          || prior.step !== enclosureStep) return null;
      current.delete(guestId);
    }
    lastStep.set(guestId, step);
  }
  return current;
};

const currentEnclosureAuthority = (sim: any, guest: any): any => {
  if (!sim || !guest || guest.enclosed_by == null) return null;
  if (guest.active !== false || guest.dissolved === true) return null;
  const crystals = Array.isArray(sim.crystals) ? sim.crystals : [];
  const guestId = guest.crystal_id;
  const hostId = guest.enclosed_by;
  if (!_isEnclosureCrystalId(guestId) || !_isEnclosureCrystalId(hostId)
      || guestId === hostId) return null;
  const host = crystals.find((row: any) => row && row.crystal_id === hostId);
  if (!host || host.dissolved === true) return null;

  const receipt = guest.enclosure_receipt;
  if (!receipt || receipt.schema !== 'enclosure-receipt-v1'
      || receipt.event !== 'enclosed'
      || receipt.host_crystal_id !== hostId
      || receipt.guest_crystal_id !== guestId
      || !_isEnclosureMineral(receipt.host_mineral)
      || !_isEnclosureMineral(receipt.guest_mineral)
      || !_isEnclosureMineral(guest.mineral)
      || receipt.guest_mineral !== guest.mineral
      || !_isEnclosureStep(receipt.step)
      || typeof receipt.route !== 'string'
      || !_ENCLOSURE_AUTHORITY_ROUTES.has(receipt.route)) return null;
  if (!_enclosureHostMineralLineage(host, receipt.host_mineral, receipt.step)) return null;

  const physicalFields = [
    receipt.host_same_step_positive_growth_um,
    receipt.host_same_step_negative_growth_um,
    receipt.host_same_step_net_growth_um,
    receipt.host_physical_size_at_enclosure_um,
    receipt.guest_positive_core_um,
    receipt.guest_loss_um,
    receipt.guest_remaining_growth_um,
    receipt.size_ratio,
    receipt.guest_recent_growth_um,
    receipt.guest_slowing_threshold_um,
  ];
  if (!physicalFields.every(_isEnclosureNumber)
      || !(receipt.host_same_step_positive_growth_um > 0)
      || !(receipt.host_same_step_negative_growth_um >= 0)
      || !(receipt.host_same_step_net_growth_um > 0)
      || !(receipt.host_physical_size_at_enclosure_um > 0)
      || !(receipt.guest_positive_core_um > 0)
      || !(receipt.guest_loss_um >= 0)
      || !(receipt.guest_remaining_growth_um > 0)
      || !(receipt.size_ratio > 3)
      || receipt.guest_slowing_threshold_um !== 3
      || !(receipt.guest_recent_growth_um < receipt.guest_slowing_threshold_um)
      || typeof receipt.guest_partially_dissolved !== 'boolean') return null;

  const hostPhysical = _enclosurePhysicalInventoryAt(host, receipt.step);
  const guestPhysical = _enclosurePhysicalInventoryAt(guest, receipt.step);
  if (!hostPhysical || !guestPhysical || guestPhysical.acceptedZones.length < 3) return null;
  const hostStepZones = hostPhysical.acceptedZones.filter((zone: any) => zone.step === receipt.step);
  const hostPositive = hostStepZones.reduce((sum: number, zone: any) => sum + (
    zone.thickness_um > 0 && zone.is_phantom !== true ? zone.thickness_um : 0
  ), 0);
  const hostNegative = hostStepZones.reduce((sum: number, zone: any) => sum + (
    zone.thickness_um < 0 ? Math.abs(zone.thickness_um) : 0
  ), 0);
  const hostNet = hostPositive - hostNegative;
  const guestRecent = guestPhysical.acceptedZones.slice(-3).reduce(
    (sum: number, zone: any) => sum + (
      zone.thickness_um > 0 && zone.is_phantom === true ? 0 : zone.thickness_um
    ),
    0,
  );
  const expectedRatio = (hostPhysical.remainingUm / 1000)
    / Math.max(guestPhysical.remainingUm / 1000, 0.001);
  if (!_enclosureClose(receipt.host_same_step_positive_growth_um, hostPositive)
      || !_enclosureClose(receipt.host_same_step_negative_growth_um, hostNegative)
      || !_enclosureClose(receipt.host_same_step_net_growth_um, hostNet)
      || !_enclosureClose(receipt.host_same_step_net_growth_um,
        receipt.host_same_step_positive_growth_um - receipt.host_same_step_negative_growth_um)
      || !_enclosureClose(receipt.host_physical_size_at_enclosure_um, hostPhysical.remainingUm)
      || !_enclosureClose(receipt.guest_positive_core_um, guestPhysical.positiveCoreUm)
      || !_enclosureClose(receipt.guest_loss_um, guestPhysical.lossUm)
      || !_enclosureClose(receipt.guest_remaining_growth_um, guestPhysical.remainingUm)
      || !_enclosureClose(receipt.guest_remaining_growth_um,
        Math.max(0, receipt.guest_positive_core_um - receipt.guest_loss_um))
      || !_enclosureClose(receipt.size_ratio, expectedRatio)
      || !_enclosureClose(receipt.guest_recent_growth_um, guestRecent)
      || receipt.guest_partially_dissolved !== (
        guestPhysical.lossUm > 0 && guestPhysical.remainingUm > 0
      )) return null;
  const expectedAdjacency = receipt.route === 'geometric-overlap'
    ? 'wall-anchor-footprint' : 'exact-substrate-id';
  if (receipt.adjacency_authority !== expectedAdjacency) return null;
  if (receipt.route === 'geometric-overlap') {
    if (!_isEnclosureNumber(receipt.anchor_distance_mm)
        || !_isEnclosureNumber(receipt.footprint_reach_mm)
        || receipt.anchor_distance_mm < 0 || receipt.footprint_reach_mm < 0
        || receipt.anchor_distance_mm > receipt.footprint_reach_mm + 1e-9) return null;
  }

  const hostGuests = Array.isArray(host.enclosed_crystals) ? host.enclosed_crystals : [];
  const hostSteps = Array.isArray(host.enclosed_at_step) ? host.enclosed_at_step : [];
  if (hostGuests.length !== hostSteps.length) return null;
  const reciprocal = [];
  for (let i = 0; i < hostGuests.length; i++) {
    if (hostGuests[i] === guestId) reciprocal.push(i);
  }
  if (reciprocal.length !== 1) return null;
  const topologyIndex = reciprocal[0];
  if (!_isEnclosureStep(hostSteps[topologyIndex])
      || hostSteps[topologyIndex] !== receipt.step) return null;

  const lifecycle = _runtimeEnclosureLifecycleState(sim._enclosureReceipts);
  const latest = lifecycle?.get(guestId);
  if (!latest
      || latest.host_crystal_id !== hostId
      || latest.guest_crystal_id !== guestId
      || latest.step !== receipt.step
      || latest.host_mineral !== receipt.host_mineral
      || latest.guest_mineral !== receipt.guest_mineral
      || latest.route !== receipt.route) return null;

  return { host, guest, receipt, lifecycleEvent: latest, topologyIndex };
};
