import { describe, expect, it } from 'vitest';

declare const currentEnclosureAuthority: any;
declare const engineExecutableSubstrateRoute: any;
declare const applyFilmDusting: any;
declare const applyBirnessiteTodorokiteTransition: any;
declare const applyCaSO4PhaseTransition: any;
declare const applyParamorphTransitions: any;
declare const applyLightTransitions: any;
declare const FluidChemistry: any;

function actualEnclosure(guest: any, hostMineral = 'calcite') {
  guest.active = false;
  guest.dissolved = false;
  guest.zones = [
    { step: 0, thickness_um: 98.5 },
    { step: 1, thickness_um: 0.5 },
    { step: 2, thickness_um: 0.5 },
    { step: 3, thickness_um: 0.5 },
  ];
  const host: any = {
    crystal_id: 9,
    mineral: hostMineral,
    active: true,
    dissolved: false,
    total_growth_um: 401,
    c_length_mm: 0.401,
    enclosed_crystals: [guest.crystal_id],
    enclosed_at_step: [10],
    zones: [
      { step: 9, thickness_um: 400 },
      { step: 10, thickness_um: 1 },
    ],
  };
  if (hostMineral === 'birnessite') {
    for (const zone of host.zones) {
      zone._remaining_solid_um = zone.thickness_um;
      zone._budget_inventory_per_um = { Mn: 1 };
    }
  }
  const receipt: any = {
    schema: 'enclosure-receipt-v1',
    event: 'enclosed',
    step: 10,
    host_crystal_id: host.crystal_id,
    host_mineral: host.mineral,
    guest_crystal_id: guest.crystal_id,
    guest_mineral: guest.mineral,
    route: 'guest-on-host',
    adjacency_authority: 'exact-substrate-id',
    host_same_step_positive_growth_um: 1,
    host_same_step_negative_growth_um: 0,
    host_same_step_net_growth_um: 1,
    host_physical_size_at_enclosure_um: 401,
    guest_positive_core_um: 100,
    guest_loss_um: 0,
    guest_remaining_growth_um: 100,
    guest_partially_dissolved: false,
    size_ratio: 4.01,
    guest_recent_growth_um: 1.5,
    guest_slowing_threshold_um: 3,
  };
  guest.enclosed_by = host.crystal_id;
  guest.enclosure_receipt = receipt;
  return { host, receipt, sim: { crystals: [guest, host], _enclosureReceipts: [receipt] } };
}

describe('shared current-enclosure chemistry authority', () => {
  it('keeps a stale display flag chemically accessible to substrate and film paths', () => {
    const guest: any = {
      crystal_id: 4,
      mineral: 'chalcedony',
      active: true,
      dissolved: false,
      enclosed_by: 999,
      _film: null,
    };
    const sim: any = { crystals: [guest], _enclosureReceipts: [] };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    expect(engineExecutableSubstrateRoute(guest, 'quartz', sim).executable).toBe(true);
    expect(applyFilmDusting(
      sim.crystals, 'clay', 0.2, 0.3, 12, ['chalcedony'], sim,
    )).toBe(1);
    expect(guest._film).toMatchObject({ mineral: 'clay', phi_term: 0.2, phi_prism: 0.3 });
  });

  it('withholds the same chemistry only for chronological reciprocal authority', () => {
    const guest: any = {
      crystal_id: 4,
      mineral: 'chalcedony',
      active: true,
      dissolved: false,
      enclosed_by: null,
      _film: null,
    };
    const { sim } = actualEnclosure(guest);
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ guest });
    expect(engineExecutableSubstrateRoute(guest, 'quartz', sim)).toMatchObject({
      executable: false,
      label: 'authenticated physical inclusion',
    });
    expect(applyFilmDusting(
      sim.crystals, 'clay', 0.2, 0.3, 12, ['chalcedony'], sim,
    )).toBe(0);
    expect(guest._film).toBeNull();
  });

  it('rejects a time-reversed attempt to restore a liberated seal', () => {
    const guest: any = {
      crystal_id: 4,
      mineral: 'chalcedony',
      active: true,
      dissolved: false,
      enclosed_by: null,
      _film: null,
    };
    const { host, receipt, sim } = actualEnclosure(guest);
    sim._enclosureReceipts.push({
      schema: 'liberation-receipt-v1', event: 'liberated', step: 15,
      enclosure_step: 10, host_crystal_id: host.crystal_id,
      guest_crystal_id: guest.crystal_id,
      host_mineral: host.mineral, guest_mineral: guest.mineral,
    });
    sim._enclosureReceipts.push(receipt); // old step 10 after step 15
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    guest.active = true; // liberated/mismatched state remains chemically accessible
    expect(engineExecutableSubstrateRoute(guest, 'quartz', sim).executable).toBe(true);
  });

  it('accepts a new reciprocal enclosure strictly after liberation', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, receipt, sim } = actualEnclosure(guest);
    sim._enclosureReceipts.push({
      schema: 'liberation-receipt-v1', event: 'liberated', step: 15,
      enclosure_step: 10, host_crystal_id: host.crystal_id,
      guest_crystal_id: guest.crystal_id,
      host_mineral: host.mineral, guest_mineral: guest.mineral,
    });
    host.enclosed_crystals = [];
    host.enclosed_at_step = [];
    const secondHost: any = {
      crystal_id: 12, mineral: 'quartz', active: true, dissolved: false,
      enclosed_crystals: [guest.crystal_id], enclosed_at_step: [20],
      zones: [{ step: 19, thickness_um: 400 }, { step: 20, thickness_um: 1 }],
    };
    const secondReceipt: any = {
      ...receipt, step: 20, host_crystal_id: secondHost.crystal_id,
      host_mineral: secondHost.mineral, route: 'guest-on-host',
    };
    guest.enclosed_by = secondHost.crystal_id;
    guest.enclosure_receipt = secondReceipt;
    sim.crystals.push(secondHost);
    sim._enclosureReceipts.push(secondReceipt);
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({
      host: secondHost, guest, receipt: secondReceipt,
    });
  });

  it('does not coerce typed identity, chronology, or route into authority', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, receipt, sim } = actualEnclosure(guest);
    const cases = [
      () => { guest.enclosed_by = '9'; },
      () => { guest.enclosed_by = 9; guest.crystal_id = '04'; },
      () => { guest.crystal_id = 4; guest.enclosure_receipt = { ...receipt, step: '10' }; },
      () => { guest.enclosure_receipt = { ...receipt, route: 1 }; },
      () => {
        guest.enclosure_receipt = { ...receipt, route: 'banana' };
        sim._enclosureReceipts = [{ ...receipt, route: 'banana' }];
      },
    ];
    for (const poison of cases) {
      guest.crystal_id = 4;
      guest.enclosed_by = 9;
      guest.enclosure_receipt = receipt;
      host.enclosed_crystals = [4];
      host.enclosed_at_step = [10];
      sim._enclosureReceipts = [receipt];
      poison();
      expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    }
  });

  it('rejects active/dissolved guests and missing or inconsistent physical testimony', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { receipt, sim } = actualEnclosure(guest);
    const cases = [
      () => { guest.active = true; },
      () => { guest.dissolved = true; },
      () => { guest.enclosure_receipt = { ...receipt, host_physical_size_at_enclosure_um: 0 }; },
      () => { guest.enclosure_receipt = { ...receipt, guest_remaining_growth_um: 99 }; },
      () => { guest.enclosure_receipt = { ...receipt, host_same_step_net_growth_um: 2 }; },
      () => { guest.enclosure_receipt = { ...receipt, size_ratio: 4.5 }; },
      () => { guest.enclosure_receipt = { ...receipt, host_mineral: ['calcite'] }; },
    ];
    for (const poison of cases) {
      guest.active = false;
      guest.dissolved = false;
      guest.enclosure_receipt = receipt;
      poison();
      expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    }
  });

  it('keeps a guest sealed through an authenticated birnessite-to-todorokite host transformation', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, sim } = actualEnclosure(guest, 'birnessite');
    const fluid: any = { Mg: 100, Mn: 8, O2: 1.4, pH: 8, SiO2: 40 };
    const transition = applyBirnessiteTodorokiteTransition(host, fluid, 155, 11, sim);
    expect(transition).toMatchObject({
      schema: 'birnessite-todorokite-transformation-v1',
      step: 11,
      from: 'birnessite',
      to: 'todorokite',
      driver: 'Mg-exchanged-birnessite-to-todorokite',
    });
    expect(host.mineral).toBe('todorokite');
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ host, guest });

    host.phase_transition_history[0] = {
      step: 11, from: 'birnessite', to: 'todorokite',
      driver: 'Mg-exchanged-birnessite-to-todorokite',
      bookedMnPreservedPpm: transition.bookedMnPreservedPpm,
      structuralMgBookedPpm: transition.structuralMgBookedPpm,
    };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    host.phase_transition_history[0] = {
      ...transition, mgAfterPpm: transition.mgAfterPpm + 1,
    };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    host.phase_transition_history[0] = transition;
    host.mineral = 'calcite';
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
  });

  it('keeps a guest sealed through an authenticated selenite-to-anhydrite host replacement', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, sim } = actualEnclosure(guest, 'selenite');
    const brine = new FluidChemistry({
      Ca: 1000, S: 1000, O2: 2, pH: 7, salinity: 250,
    });
    const transition = applyCaSO4PhaseTransition(host, brine, 32, 0.05, 10);
    expect(transition).toMatchObject({
      schema: 'caso4-phase-replacement-v1',
      step: 10,
      from: 'selenite',
      to: 'anhydrite',
      driver: 'gypsum-to-anhydrite-replacement',
    });
    expect(host.mineral).toBe('anhydrite');
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ host, guest });

    host.phase_transition_history[0] = {
      step: 10, from: 'selenite', to: 'anhydrite',
      driver: 'gypsum-to-anhydrite-replacement',
    };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    host.phase_transition_history[0] = {
      ...transition, caAfterPpm: transition.caAfterPpm + 1,
    };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
    host.phase_transition_history[0] = {
      ...transition,
      driver: 'unreceipted-label-change',
    };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
  });

  it('keeps a guest sealed through a receipted argentite-to-acanthite cooling transition', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, sim } = actualEnclosure(guest, 'argentite');
    expect(applyParamorphTransitions(host, 172, 10)).toEqual(['argentite', 'acanthite']);
    expect(host.phase_transition_history[0]).toMatchObject({
      schema: 'paramorph-transition-v1',
      step: 10,
      driver: 'cooling-below-phase-boundary',
      temperature_C: 172,
      phase_boundary_C: 173,
    });
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ host, guest });

    host.phase_transition_history[0] = {
      ...host.phase_transition_history[0], temperature_C: 174,
    };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
  });

  it('accepts an authenticated host phase already completed before enclosure', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, receipt, sim } = actualEnclosure(guest, 'argentite');
    expect(applyParamorphTransitions(host, 172, 9)).toEqual(['argentite', 'acanthite']);
    receipt.host_mineral = 'acanthite';
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ host, guest });
  });

  it('keeps a guest sealed through receipted excavation-light realgar isomerization', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, sim } = actualEnclosure(guest, 'realgar');
    for (let exposure = 1; exposure < 60; exposure++) {
      expect(applyLightTransitions(host, true, 10 + exposure, 'excavated')).toBeNull();
    }
    expect(applyLightTransitions(host, true, 70, 'excavated'))
      .toEqual(['realgar', 'pararealgar']);
    expect(host.phase_transition_history[0]).toMatchObject({
      schema: 'light-induced-transformation-v1',
      step: 70,
      driver: 'visible-light-isomerization',
      exposure_route: 'excavated',
      exposure_steps: 60,
      threshold_steps: 60,
    });
    expect(currentEnclosureAuthority(sim, guest)).toMatchObject({ host, guest });

    host.phase_transition_history[0] = {
      ...host.phase_transition_history[0], exposure_route: 'dark',
    };
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
  });

  it('does not treat legacy compact paramorph labels as transformation authority', () => {
    const guest: any = {
      crystal_id: 4, mineral: 'chalcedony', active: true, dissolved: false,
      enclosed_by: null, _film: null,
    };
    const { host, sim } = actualEnclosure(guest, 'realgar');
    host.mineral = 'pararealgar';
    host.paramorph_origin = 'realgar';
    host.paramorph_step = 11;
    host.light_exposure_steps = 60;
    host.light_exposure_route = 'surface';
    expect(currentEnclosureAuthority(sim, guest)).toBeNull();
  });
});
