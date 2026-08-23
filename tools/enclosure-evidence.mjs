/**
 * Reduce an append-only enclosure/liberation stream into its current physical
 * inclusions. Impossible topology is rejected rather than overwritten: a
 * guest can be enclosed again only after the exact current host/step is
 * liberated.
 */
export function reduceEnclosureLifecycle(enclosures = []) {
  const allowedRoutes = new Set(['guest-on-host', 'host-on-guest', 'geometric-overlap']);
  const isCrystalId = (value) => typeof value === 'number'
    && Number.isSafeInteger(value) && value > 0;
  const isStep = (value) => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= 0;
  const isMineral = (value) => typeof value === 'string'
    && value.trim().length > 0 && value === value.trim();
  const currentEnclosures = new Map();
  const lastStepByGuest = new Map();
  let acceptedEnclosures = 0;
  let liberations = 0;
  for (const event of enclosures) {
    const isEnclosure = event?.schema === 'enclosure-receipt-v1'
      && event?.event === 'enclosed';
    const isLiberation = event?.schema === 'liberation-receipt-v1'
      && event?.event === 'liberated';
    if (!isEnclosure && !isLiberation) {
      throw new Error(`Unknown enclosure lifecycle row: ${event?.schema || 'missing schema'}/${event?.event || 'missing event'}`);
    }
    if (event.host_crystal_id == null || event.guest_crystal_id == null) {
      throw new Error('Enclosure lifecycle row requires non-null host and guest IDs');
    }
    const host = event.host_crystal_id;
    const key = event.guest_crystal_id;
    const step = event.step;
    if (!isCrystalId(host) || !isCrystalId(key) || host === key || !isStep(step)
        || !isMineral(event.host_mineral) || !isMineral(event.guest_mineral)) {
      throw new Error(`Malformed enclosure lifecycle identity/step for guest ${key}`);
    }
    const previousStep = lastStepByGuest.get(key);
    if (previousStep != null && step <= previousStep) {
      throw new Error(
        `Non-chronological enclosure lifecycle for guest ${key}: step ${step} after ${previousStep}`,
      );
    }
    if (isEnclosure) {
      if (typeof event.route !== 'string' || !allowedRoutes.has(event.route)) {
        throw new Error(`Enclosure receipt for guest ${key} requires a route`);
      }
      if (currentEnclosures.has(key)) {
        const prior = currentEnclosures.get(key);
        throw new Error(
          `Duplicate current enclosure receipt for guest ${key}: `
          + `existing host=${prior?.host_crystal_id}, new host=${event?.host_crystal_id}`,
        );
      }
      acceptedEnclosures++;
      currentEnclosures.set(key, event);
    } else {
      liberations++;
      const prior = currentEnclosures.get(key);
      const enclosureStep = event.enclosure_step;
      if (!prior
          || !isStep(enclosureStep)
          || prior.host_crystal_id !== host
          || prior.step !== enclosureStep) {
        throw new Error(
          `Unmatched liberation receipt for guest ${key}: host=${event?.host_crystal_id}, `
          + `enclosure_step=${event?.enclosure_step}`,
        );
      }
      currentEnclosures.delete(key);
    }
    lastStepByGuest.set(key, step);
  }
  return {
    accepted_enclosure_count: acceptedEnclosures,
    liberation_count: liberations,
    current_inclusions: Array.from(currentEnclosures.values()),
  };
}
