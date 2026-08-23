// ============================================================
// js/70i-supergene.ts — events for supergene
// ============================================================
// Extracted from 70-events.ts. 9 top-level event handler(s);
// each is referenced by name from EVENT_REGISTRY in 70-events.ts.
//
// Phase B17 of PROPOSAL-MODULAR-REFACTOR.


// --- supergene_oxidation (Tsumeb 1st-stage gossan) ---
// Note: event_supergene_acidification is referenced 4× in the JSON5 spec
// (steps 5/8/12/16) to hold pH near 4 against the limestone wall's
// carbonate buffering. One handler, four independently authored event rows.
function event_supergene_acidification(c, payload) {
  const eventType = 'supergene_acidification';
  _assertAuthoredScenarioEventPayload(c, payload, eventType);
  const boundary = payload?.sulfur_boundary;
  const redox = payload?.redox_boundary;
  const authority = typeof payload?.material_authority === 'string'
    ? payload.material_authority.trim() : '';
  const source = typeof boundary?.source === 'string' ? boundary.source.trim() : '';
  const poolKeys = boundary?.pools && typeof boundary.pools === 'object'
    && !Array.isArray(boundary.pools) ? Object.keys(boundary.pools) : [];
  const sulfatePpm = boundary?.pools?.sulfate;
  if (payload?.boundary_schema !== 'tsumeb-acid-sulfate-boundary-v1'
      || !authority || !source
      || boundary?.kind !== 'addition'
      || poolKeys.length !== 1 || poolKeys[0] !== 'sulfate'
      || typeof sulfatePpm !== 'number' || !Number.isFinite(sulfatePpm) || sulfatePpm <= 0
      || typeof redox?.pH !== 'number' || !Number.isFinite(redox.pH)
      || redox.pH < 0.5 || redox.pH > 14
      || typeof redox?.O2 !== 'number' || !Number.isFinite(redox.O2) || redox.O2 < 0) {
    throw new Error(`${eventType} requires an authored sulfate-only material/redox boundary`);
  }
  c.fluid.pH = redox.pH;
  c.fluid.O2 = redox.O2;
  // This is new sulfate produced by oxidation of an upgradient sulfide
  // source, not an internal relabelling of the vug's starting sulfur. Book it
  // at the event boundary so the whole-pore-fluid ledger and the sulfate
  // supersaturation engines see the same authored valence. See the spatial
  // declaration consumer in 85c and the Supergene closure regression in
  // silica-sulfur-reservoirs.test.ts.
  declareSulfurBoundaryAddition(
    c,
    'sulfate',
    sulfatePpm,
    source,
  );
  return 'Early acidic supergene phase. Primary sulfides oxidize and release H₂SO₄ — pH drops to 4.0, opening the acid window for the arsenate + sulfate suite (scorodite, jarosite, alunite). Carbonate buffering will reverse this at the meteoric flush; the acid-stable phases form during this short ~15-step window.';
}

function event_supergene_meteoric_flush(c) {
  c.fluid.O2 = 2.2;
  c.fluid.CO3 += 30;
  c.fluid.pH = 6.2;
  c.flow_rate = 1.5;
  return 'Rain infiltrates the soil zone and percolates down, picking up CO₂ and oxygen. Fresh supergene brine — cold, oxygen-rich, slightly acidic. Any remaining primary sulfides are on borrowed time.';
}

function event_supergene_pb_mo_pulse(c) {
  c.fluid.Pb += 40;
  c.fluid.Mo += 25;
  c.fluid.O2 = 2.0;
  c.flow_rate = 2.0;
  return 'A weathering rind breaches: Pb²⁺ and MoO₄²⁻ released simultaneously from an oxidizing galena+molybdenite lens. The Seo et al. (2012) condition for wulfenite formation — both parents dying at once — is met.';
}

function event_supergene_cu_enrichment(c, payload) {
  const eventType = 'supergene_cu_enrichment';
  _assertAuthoredScenarioEventPayload(c, payload, eventType);
  const oxygenTarget = payload?.oxygen_target_ppm;
  const scope = typeof payload?.model_scope === 'string' ? payload.model_scope.trim() : '';
  const fluidSource = typeof payload?.fluid_boundary_source === 'string'
    ? payload.fluid_boundary_source.trim() : '';
  const additions = payload?.fluid_transform?.add;
  const additionKeys = additions && typeof additions === 'object' && !Array.isArray(additions)
    ? Object.keys(additions).sort() : [];
  if (payload?.boundary_schema !== 'tsumeb-cu-leachate-boundary-v1'
      || payload?.sulfur_boundary != null
      || additionKeys.join(',') !== 'Cu,Fe'
      || typeof additions.Cu !== 'number' || !Number.isFinite(additions.Cu) || additions.Cu <= 0
      || typeof additions.Fe !== 'number' || !Number.isFinite(additions.Fe) || additions.Fe < 0
      || typeof oxygenTarget !== 'number' || !Number.isFinite(oxygenTarget) || oxygenTarget < 0
      || !fluidSource || !scope || !/parent-solid replacement is not executed/i.test(scope)) {
    throw new Error(`${eventType} requires an authored Cu/Fe boundary with no dissolved-sulfur import and an explicit replacement limitation`);
  }
  const plan = _planAuthoredEventFluidTransform(c, payload, eventType);
  plan.apply();
  declareFluidBoundaryAddition(c, fluidSource, additions);
  c.fluid.O2 = oxygenTarget;
  return `Cu-bearing oxidized leachate descends toward the water table (${plan.changed.join(', ')}; O₂ ${oxygenTarget}). USGS supergene models form chalcocite/covellite by replacing primary pyrite or chalcopyrite, not by inventing dissolved sulfide. This simulator boundary does not yet execute that parent-solid replacement, so those documented Tsumeb phases remain aspirational rather than forced. Authority: ${plan.authority}`;
}

function event_supergene_dry_spell(c, payload) {
  const eventType = 'supergene_dry_spell';
  _assertAuthoredScenarioEventPayload(c, payload, eventType);
  const boundary = payload?.sulfur_boundary;
  const additions = payload?.fluid_transform?.add;
  const additionKeys = additions && typeof additions === 'object' && !Array.isArray(additions)
    ? Object.keys(additions) : [];
  const poolKeys = boundary?.pools && typeof boundary.pools === 'object'
    && !Array.isArray(boundary.pools) ? Object.keys(boundary.pools) : [];
  const sulfatePpm = boundary?.pools?.sulfate;
  const sulfurSource = typeof boundary?.source === 'string' ? boundary.source.trim() : '';
  const fluidSource = typeof payload?.fluid_boundary_source === 'string'
    ? payload.fluid_boundary_source.trim() : '';
  const temperatureTarget = payload?.temperature_target_C;
  const oxygenTarget = payload?.oxygen_target_ppm;
  const surfaceRingTarget = payload?.fluid_surface_ring_target;
  if (payload?.boundary_schema !== 'tsumeb-dry-season-recharge-v1'
      || additionKeys.length !== 1 || additionKeys[0] !== 'Ca'
      || typeof additions.Ca !== 'number' || !Number.isFinite(additions.Ca) || additions.Ca <= 0
      || boundary?.kind !== 'addition'
      || poolKeys.length !== 1 || poolKeys[0] !== 'sulfate'
      || typeof sulfatePpm !== 'number' || !Number.isFinite(sulfatePpm) || sulfatePpm <= 0
      || !sulfurSource || !fluidSource
      || typeof temperatureTarget !== 'number' || !Number.isFinite(temperatureTarget)
      || typeof oxygenTarget !== 'number' || !Number.isFinite(oxygenTarget) || oxygenTarget < 0
      || typeof surfaceRingTarget !== 'number' || !Number.isFinite(surfaceRingTarget)
      || surfaceRingTarget < 0) {
    throw new Error(`${eventType} requires an exact authored Ca/sulfate recharge and hydrologic boundary`);
  }
  const plan = _planAuthoredEventFluidTransform(c, payload, eventType);
  plan.apply();
  declareFluidBoundaryAddition(c, fluidSource, additions);
  // Tsumeb Mine Notebook TSNB159 documents centimetre-scale gypsum from all
  // three oxidation zones. This pulse represents dissolution/reconcentration
  // of Ca-bearing dolomite plus sulfate liberated by sulfide oxidation; the
  // larger inventory crosses the gypsum SI gate rather than only approaching it.
  // The 350 ppm Ca + sulfate-S SIM-scale recharge clears the same live CaSO4
  // activity evaluator used by nucleation with a modest margin after exact
  // wall-release accounting. It is not a measured fluid-inclusion value.
  declareSulfurBoundaryAddition(
    c,
    'sulfate',
    sulfatePpm,
    sulfurSource,
  );
  c.fluid.O2 = oxygenTarget;
  c.temperature = temperatureTarget;
  // v25: water table drops to mid-cavity → upper rings go vadose.
  c.fluid_surface_ring = surfaceRingTarget;
  return "Dry season. Flow slows and an evaporative dolomite-sulfate recharge concentrates the brine. Water table drops to mid-cavity. Ca²⁺ and SO₄²⁻ cross the documented Tsumeb selenite window. Above the meniscus, air-exposed walls start to oxidize and hydrated arsenates may dehydrate.";
}

function event_supergene_as_rich_seep(c) {
  c.fluid.As += 8;
  c.fluid.Cl += 10;
  c.fluid.Zn += 20;
  c.fluid.Co += 20;
  c.fluid.Ni += 20;
  c.fluid.pH = 6.0;
  c.temperature = 25;
  return 'An arsenic-bearing seep arrives from a weathering arsenopyrite body upslope, carrying trace cobalt and nickel from parallel oxidizing arsenides. Zn²⁺ saturates adamite; Pb²⁺ saturates mimetite; Co²⁺ and Ni²⁺ begin to bloom as crimson erythrite and apple-green annabergite.';
}

function event_supergene_phosphate_seep(c) {
  c.fluid.P += 6.0;
  c.fluid.Cl += 5.0;
  c.fluid.pH = 6.4;
  return "A phosphate-bearing groundwater seeps in from the soil zone — organic decay, weathered apatite bedrock, bat guano from above. P jumps past pyromorphite's saturation threshold, and any Pb still in solution has a new home.";
}

function event_supergene_v_bearing_seep(c) {
  c.fluid.V += 6.0;
  c.fluid.Cl += 8.0;
  c.temperature = 45;
  return "A vanadium-bearing seep arrives from a weathering red-bed ironstone upslope. V⁵⁺ leaches from oxidizing roll-front vanadates, and at Pb + V + Cl saturation the bright red-orange vanadinite nucleates — the classic 'vanadinite on goethite' habit of the Morocco / Arizona desert deposits.";
}

function event_supergene_fracture_seal(c) {
  c.flow_rate = 0.05;
  c.fluid.O2 = 1.0;
  return 'The feeding fractures seal. The vug becomes a closed cold oxidizing system. Whatever is supersaturated will precipitate; whatever is undersaturated will quietly corrode.';
}
