import { describe, expect, it } from 'vitest';
declare const THREE: any, Crystal: any, GrowthZone: any, WallState: any;
declare const recordQuartzFormObservations: any, quartzFormObservationAtStep: any;
declare const quartzFormRenderProjection: any, quartzFormCollectionText: any, crystalRenderSeed: any;
declare const _topoSyncCrystalMeshes: any, _topoCrystalsSignature: any;
declare const buildCrystalRecord: any, reconstructCrystalFromRecord: any;
declare const classifyDeformation: any;

const clone = (x: any) => JSON.parse(JSON.stringify(x));
function fixture(id: number | string = 44) {
  const wall = new WallState({ vug_diameter_mm: 70, shape_seed: 42 });
  const c = new Crystal({ crystal_id: id, mineral: 'quartz', habit: 'prismatic',
    nucleation_step: 1, nucleation_temp: 300, growth_environment: 'fluid' });
  c.wall_anchor = wall._anchorFromRingCell(6, 12);
  c._nucTilt = { theta: 0.12, azim: 0.4 };
  const sim: any = { crystals: [c], step: 1, _enclosureReceipts: [] };
  const observe = (step: number, change: any = {}, thickness = 0) => {
    Object.assign(c, change); sim.step = step;
    if (thickness) {
      const z = new GrowthZone({ step, thickness_um: thickness, temperature: 300, growth_rate: 1, aspect_ratio: .4 });
      z._time_scaled = true; c.add_zone(z);
    }
    recordQuartzFormObservations(sim);
  };
  observe(1, {}, 8000);
  return { wall, c, sim, observe };
}
function state() { return { geomCache: new Map(), crystals: new THREE.Group(),
  clipUniforms: { uVugRadius: { value: 35 } }, scaleZoomOverride: 4 } as any; }
function render(f: any, step: number, s = state()) {
  _topoSyncCrystalMeshes(s, f.sim, f.wall, step); return s;
}
function meshes(s: any, id: any) {
  return s.crystals.children.filter((m: any) => m.userData.crystal_id === id && !m.userData.o5Band);
}
function imageOf(s: any, id: any) {
  return meshes(s, id).map((m: any) => ({
    positions: [...m.geometry.attributes.position.array], normals: [...m.geometry.attributes.normal.array],
    index: m.geometry.index ? [...m.geometry.index.array] : null,
    scale: m.scale.toArray(), position: m.position.toArray(), rotation: m.quaternion.toArray(),
    satellite: !!m.userData.isSatellite, form: m.userData.quartzForm,
    population: m.userData.populationDisplay ?? null,
  }));
}
const sceptre = (fraction: number, boundaryStep = 1) => ({ boundaryStep,
  stemUm: 8000 * (1 - fraction), capUm: 8000 * fraction, capFrac: fraction, route: 'corrosion' });

describe('C — quartz observations consumed by actual replay meshes', () => {
  it('leaves non-quartz IDs and form routes in the baseline contract',()=>{
    const c={mineral:'calcite',crystal_id:'C37',habit:'rhombohedral'};
    expect(crystalRenderSeed(c)).toBe('C37');expect(quartzFormRenderProjection(c,c,1)).toBe(c);
  });
  it('keeps parent and population geometry, transforms and cached identity invariant under future descriptors and neighbours', () => {
    const f = fixture(), s = render(f, 1), early = imageOf(s, f.c.crystal_id);
    expect(early.length).toBeGreaterThan(1);
    expect(early.every(m => m.form.status === 'recorded-form-selection')).toBe(true);
    expect(early[0].form.withheld).toContain('neighbour-shape-contact-clipping');
    const body = meshes(s, f.c.crystal_id)[0], sig = s.crystalsSig;
    f.observe(2, { habit: 'scepter_overgrowth', _sceptre: sceptre(.6), twinned: true,
      twin_law: 'Dauphiné', _gwindel: { twistDeg: 90, lengthUm: 9000, span: 1 },
      _split: { index: .9, rung: 'spherulite' }, _surfaceGrowth: { coverage_fraction: .8 },
      growth_environment: 'air', _deformation: { kind: 'bend', amount: .7, atStep: 2 },
      _occlusion: { attachedFraction: .8 }, _sectorZoned: { kind: 'cross' }, _polarAxis: { pointGroup: '6mm' },
      _nucTilt:{theta:.4,azim:2},
    }, 1000);
    render(f, 1, s);
    expect(s.crystalsSig).toBe(sig); expect(meshes(s, f.c.crystal_id)[0]).toBe(body);
    expect(imageOf(render(f, 1), f.c.crystal_id)).toEqual(early); // fresh geometry cache
    s.crystalsSig = ''; render(f, 1, s); expect(imageOf(s, f.c.crystal_id)).toEqual(early); // forced warm rebuild
    const n = new Crystal({ mineral: 'calcite', habit: 'scalenohedral', crystal_id: 89, nucleation_step: 1 });
    n.wall_anchor = f.c.wall_anchor; n.zones = [{ step: 1, thickness_um: 14000, aspect_ratio: 1 }];
    f.sim.crystals.push(n); n.habit = 'botryoidal'; n.growth_environment = 'air'; n._occlusion = { attachedFraction: .8 };
    expect(imageOf(render(f, 1), f.c.crystal_id)).toEqual(early);
  });

  it('uses observation time rather than backdating sceptre selection to its resorption boundary', () => {
    const f = fixture(); f.observe(2); const early = imageOf(render(f, 2), f.c.crystal_id);
    f.observe(3, { habit: 'scepter_overgrowth', _sceptre: sceptre(.25) });
    f.observe(4, { _sceptre: sceptre(.75) });
    const at3 = render(f, 3), at4 = render(f, 4);
    expect(imageOf(render(f, 2), f.c.crystal_id)).toEqual(early);
    expect(meshes(at3, f.c.crystal_id)[0].userData.quartzForm).toMatchObject({ route: 'sceptre', observation_step: 3 });
    expect(imageOf(at3, f.c.crystal_id)[0].positions).not.toEqual(imageOf(at4, f.c.crystal_id)[0].positions);
    f.c._sceptre.capFrac = .1; f.c._gwindel = { twistDeg: 120 };
    expect(imageOf(render(f, 3), f.c.crystal_id)).toEqual(imageOf(at3, f.c.crystal_id));
  });

  it('rewinds changing gwindel twist, winning-route priority, and explicit descriptor removal', () => {
    const f = fixture(); f.observe(2, { habit: 'scepter_overgrowth', _sceptre: sceptre(.4) });
    f.observe(3, { habit: 'gwindel', _gwindel: { twistDeg: 45, lengthUm: 8000, span: 2 } });
    f.observe(4, { _gwindel: { twistDeg: 100, lengthUm: 8000, span: 3 } });
    const third = render(f, 3), fourth = render(f, 4);
    expect(meshes(third, f.c.crystal_id)[0].userData.quartzForm.route).toBe('gwindel');
    expect(imageOf(third, f.c.crystal_id)[0].positions).not.toEqual(imageOf(fourth, f.c.crystal_id)[0].positions);
    delete f.c._gwindel; f.observe(5, { _sceptre: null, habit: 'doubly_terminated' });
    const fifth = render(f, 5), projection = quartzFormRenderProjection(f.c, f.c, 5);
    expect(projection).not.toHaveProperty('_gwindel'); expect(projection._sceptre).toBeNull();
    expect(meshes(fifth, f.c.crystal_id)[0].userData.quartzForm.route).toBe('double-prism');
    const double=meshes(fifth,f.c.crystal_id)[0].geometry;
    expect(double.userData.quartzR4.doubleEnded).toBe(true);
    expect(double.userData.quartzR4.families).not.toContain('scar');
    const positions=double.attributes.position.array,ys=[];
    for(let i=1;i<positions.length;i+=3)ys.push(positions[i]);
    expect(Math.min(...ys)).toBeCloseTo(-.5,6);expect(Math.max(...ys)).toBeCloseTo(.5,6);
    expect(imageOf(render(f, 3), f.c.crystal_id)).toEqual(imageOf(third, f.c.crystal_id));
  });

  it('retains zero cap fraction rather than replacing it with the display default', () => {
    const f = fixture(); f.observe(2, { habit: 'scepter_overgrowth', _sceptre: sceptre(0) });
    const zero = render(f, 2);
    expect([...zero.geomCache.keys()].some(k => String(k).startsWith('__recorded_sceptre_0_'))).toBe(true);
    f.observe(3, { habit: 'prismatic', _sceptre: null });
    expect(imageOf(render(f, 2), f.c.crystal_id)).toEqual(imageOf(zero, f.c.crystal_id));
  });

  it('withholds a bend tagged later with an earlier event date by the actual threshold classifier', () => {
    const f = fixture();
    // A separate authored, small crystal has not yet reached DEFORM_MIN_UM.
    const c = new Crystal({ mineral: 'quartz', habit: 'prismatic', crystal_id: 55, nucleation_step: 1 });
    c.wall_anchor = f.c.wall_anchor;
    const sim: any = { crystals: [c], step: 1, _enclosureReceipts: [],
      _deformationEvents: [{ step: 2, style: 'bend', amount: .7 }] };
    const add = (step: number, thickness: number) => {
      const z = new GrowthZone({ step, thickness_um: thickness, aspect_ratio: .4, temperature: 300 });
      z._time_scaled = true; c.add_zone(z);
    };
    add(1, 50); recordQuartzFormObservations(sim);
    sim.step = 2; classifyDeformation(sim); recordQuartzFormObservations(sim);
    expect(c._deformation).toBeFalsy();
    const record = clone(quartzFormObservationAtStep(c, 2)), subject = { ...f, c, sim };
    const s = render(subject, 2), earlier = imageOf(s, c.crystal_id), body = meshes(s, c.crystal_id)[0];
    add(3, 100); sim.step = 3; classifyDeformation(sim); recordQuartzFormObservations(sim);
    expect(c._deformation).toMatchObject({ kind: 'bend', amount: .7, atStep: 2 });
    expect(quartzFormObservationAtStep(c, 2)).toEqual(record);
    render(subject, 2, s); expect(meshes(s, c.crystal_id)[0]).toBe(body);
    expect(imageOf(render(subject, 2), c.crystal_id)).toEqual(earlier);
    expect(earlier[0].form.withheld).toContain('unrecorded-deformation-application-time');
  });

  it.each([
    [{ twinned: true }, 'twinned-or-unknown-twin-state'],
    [{ twinned: null }, 'twinned-or-unknown-twin-state'],
    [{ _split: { index: .4 } }, 'split-parameters-not-recorded'],
    [{ _surfaceGrowth: {} }, 'surface-fabric-parameters-not-recorded'],
    [{ growth_environment: 'air' }, 'outside-fluid-growth-envelope'],
    [{ growth_environment: null }, 'outside-fluid-growth-envelope'],
    [{ habit: 'future-unrecognised-habit' }, 'habit-outside-reviewed-routes'],
    [{ _polymorph: 'beta-quartz' }, 'polymorph-outside-reviewed-routes'],
    [{ habit: 'gwindel', _gwindel: null }, 'missing-special-form-parameters'],
    [{ enclosed_by:undefined }, 'topology-scope-not-recorded'],
    [{ cdr_replaces_crystal_id:undefined }, 'topology-scope-not-recorded'],
    [{ dissolved:undefined }, 'topology-scope-not-recorded'],
    [{ perimorph_eligible:undefined }, 'topology-scope-not-recorded'],
  ])('declares unsupported interval %j without removing earlier coverage', (change, reason) => {
    const f = fixture(), early = imageOf(render(f, 1), f.c.crystal_id); f.observe(2, change);
    const p = quartzFormRenderProjection(f.c, f.c, 2);
    expect(p._quartzFormRender).toMatchObject({ status: 'legacy-current-form', reason });
    expect(imageOf(render(f, 1), f.c.crystal_id)).toEqual(early);
  });

  it('marks missing, invalid, mismatched, late-start and closed coverage honestly', () => {
    const f = fixture(); f.observe(2); f.observe(4); // missing finalized step 3
    for (const step of [0, 3, 4, 5]) expect(quartzFormRenderProjection(f.c, f.c, step)._quartzFormRender.status).toBe('legacy-current-form');
    expect(quartzFormRenderProjection(f.c, f.c, 2)._quartzFormRender.status).toBe('recorded-form-selection');
    const plain = { ...f.c, _quartzFormHistory: clone(f.c._quartzFormHistory) };
    plain._quartzFormHistory.source_crystal_id = 999;
    expect(quartzFormObservationAtStep(plain, 2).reason).toBe('source-identity-mismatch');
    plain._quartzFormHistory.source_crystal_id = f.c.crystal_id; plain.nucleation_step = 2;
    expect(quartzFormObservationAtStep(plain, 2).status).toBe('unavailable');
    const old = { ...f.c }; delete old._quartzFormHistory;
    expect(quartzFormCollectionText(old)).toContain('unknown');
    expect(quartzFormCollectionText(plain)).toContain('cannot be validated');
  });

  it('keeps collection source variation while display IDs and source coordinates remain separate', () => {
    const f = fixture('quartz-source-α'); f.observe(2, { habit: 'scepter_overgrowth', _sceptre: sceptre(.4) });
    const record = buildCrystalRecord(f.c, { mode: 'simulation', scenario: 'controlled-quartz-display', seed: 42, sim: f.sim });
    const stand = reconstructCrystalFromRecord(record), displayId = stand.crystal_id;
    expect(displayId).not.toBe(f.c.crystal_id); expect(stand.wall_anchor).not.toEqual(f.c.wall_anchor);
    const p = quartzFormRenderProjection(stand, stand, 2);
    expect(p._quartzFormRender.status).toBe('recorded-form-selection');
    expect(p.crystal_id).toBe(displayId); expect(crystalRenderSeed(p)).toBe(crystalRenderSeed(f.c));
    expect(quartzFormCollectionText(stand)).toContain('Record Player displays growth zones');
    // Authored fixture supplies a display anchor; source coordinates stay inert.
    stand.wall_anchor = f.c.wall_anchor;
    const original = imageOf(render(f, 2), f.c.crystal_id);
    const collected = imageOf(render({ ...f, sim: { ...f.sim, crystals: [stand] } }, 2), displayId);
    // Collection placement remains an isolated display. This tranche promises
    // source-scoped form selection, not reconstruction of the original wall.
    expect(collected.map(m => [m.positions, m.scale])).toEqual(original.map(m => [m.positions, m.scale]));
  });

  it('does not claim CDR inheritance, cast-boundary or included-host geometry', () => {
    for (const [change, reason] of [
      [{ cdr_replaces_crystal_id: 17 }, 'parent-form-inheritance-unavailable'],
      [{ dissolved: true, perimorph_eligible: true }, 'cast-boundary-form-unavailable'],
      [{ enclosed_by: 17 }, 'enclosed-host-form-not-supported'],
    ] as any[]) {
      const f=fixture();f.observe(2,change);
      expect(quartzFormRenderProjection(f.c, f.c, 2)._quartzFormRender.reason).toBe(reason);
      expect(quartzFormRenderProjection(f.c, f.c, 1)._quartzFormRender.status).toBe('recorded-form-selection');
    }
  });

  it('carries explicit cast and enclosure fallbacks through real replay meshes at the boundaries', () => {
    const f = fixture(); f.c.perimorph_eligible = true;
    f.observe(2, { dissolved: true, habit: 'doubly_terminated' }, -8000);
    expect(meshes(render(f, 1), f.c.crystal_id)[0].userData.quartzForm.status).toBe('recorded-form-selection');
    const cast = meshes(render(f, 2), f.c.crystal_id)[0];
    expect(cast.userData.quartzForm).toMatchObject({ status: 'legacy-current-form', reason: 'cast-boundary-form-unavailable' });
    expect(cast.material.userData.optics.perimorph).toBe(true);

    const enclosed = fixture(); enclosed.observe(2,{enclosed_by:17}); enclosed.observe(3,{enclosed_by:null});
    const host = new Crystal({ mineral: 'calcite', habit: 'rhombohedral', crystal_id: 17, nucleation_step: 1 });
    host.wall_anchor = enclosed.c.wall_anchor;
    Object.assign(host, { c_length_mm: 20, a_width_mm: 20, zones: [{ step: 1, thickness_um: 20000, aspect_ratio: 1 }] });
    enclosed.sim.crystals.push(host);
    const event = { schema: 'enclosure-receipt-v1', event: 'enclosed', step: 2,
      host_crystal_id: 17, guest_crystal_id: enclosed.c.crystal_id,
      host_mineral: 'calcite', guest_mineral: 'quartz', route: 'geometric-overlap' };
    enclosed.sim._enclosureReceipts = [event, { ...event, schema: 'liberation-receipt-v1', event: 'liberated', step: 3, enclosure_step: 2 }];
    const before = meshes(render(enclosed, 1), enclosed.c.crystal_id)[0];
    const during = meshes(render(enclosed, 2), enclosed.c.crystal_id)[0];
    const after = meshes(render(enclosed, 3), enclosed.c.crystal_id)[0];
    expect(before.userData.quartzForm.status).toBe('recorded-form-selection');
    expect(during.userData.quartzForm).toMatchObject({ status: 'legacy-current-form', reason: 'enclosed-host-form-not-supported' });
    expect(during.userData.quartzForm.observation_step).toBe(2);
    expect(after.userData.quartzForm.status).toBe('recorded-form-selection');
  });

  it('leaves scientific state and ledger untouched across the non-enumerable observation boundary', () => {
    const f = fixture(), before = JSON.stringify(f.c), history = f.c._quartzFormHistory;
    expect({...f.c}).not.toHaveProperty('_quartzFormHistory');
    const s = render(f, 1); expect(meshes(s, f.c.crystal_id)[0].userData.quartzForm.status).toBe('recorded-form-selection');
    expect(JSON.stringify(f.c)).toBe(before); expect(f.c._quartzFormHistory).toBe(history);
    expect(_topoCrystalsSignature(f.sim, f.wall, 1)).toContain('recorded-form-selection');
  });

  it('reports the surviving prefix of a conflicting final observation and never invents late-start coverage', () => {
    const f = fixture(); f.observe(2); f.observe(2, { habit: 'doubly_terminated' });
    expect(quartzFormCollectionText(f.c)).toContain('steps 1–1');
    expect(quartzFormCollectionText(f.c)).toContain('stops at step 2');
    const late = new Crystal({ crystal_id: 77, mineral: 'quartz', habit: 'prismatic', nucleation_step: 0 });
    recordQuartzFormObservations({ step: 8, crystals: [late] });
    expect(quartzFormRenderProjection(late, late, 7)._quartzFormRender.status).toBe('legacy-current-form');
    expect(quartzFormRenderProjection(late, late, 8)._quartzFormRender.status).toBe('recorded-form-selection');
  });
});
