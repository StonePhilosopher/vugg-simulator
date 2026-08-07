// ============================================================
// js/70p-sunnyside.ts — events for Sunnyside Mine / American Tunnel
// ============================================================
// Silverton caldera, San Juan Mountains, San Juan County, Colorado.
// Intermediate-sulfidation polymetallic epithermal vein deposit at
// 27.5 Ma (Crystal Lake Tuff eruption) with hydrothermal mineralization
// peaking ~22.5 Ma. The American Tunnel was driven 1959-1991 from the
// Gold King portal at Gladstone, intersecting the Sunnyside vein system
// ~600 ft below the original Sunnyside workings; principal modern
// (post-1960) source of Silverton-district display rhodochrosite +
// octahedral REE-fluorite + manganocalcite.
//
// LABELING NOTE (CORRECTED v106 2026-05-20): specimens labeled
// "Standard Mine, Silverton" refer to material from the Sunnyside
// mine during the Standard Metals Corporation lease period
// (1959-1978). Standard Metals leased Sunnyside in 1959, drove the
// American Tunnel from the Gold King portal at Gladstone to access
// the deeper ore body, and operated continuously until the June 4
// 1978 Lake Emma disaster (surface lake drained into the upper
// workings during a slope failure, flooding the mine and ending
// Standard Metals operations). The "[Operator] Mine" convention is
// well-attested in mineral collecting — Hecla Mine for Sunshine
// material, Anaconda Mine for various Butte properties, etc. The
// label is accurate to a specific 19-year production window and
// identifies the operator who drove the American Tunnel. It is
// NOT (as v105 originally documented) a dealer-conflation with the
// unrelated Standard Mine in Gunnison County (Ruby District near
// Crested Butte, EPA Superfund) — that's a different deposit, and
// the Silverton label is its own legitimate provenance anchor, not
// a label drift. Casadevall & Ohmoto 1977 Econ. Geol. 72:1285 —
// the canonical Sunnyside fluid-inclusion + stable-isotope paper —
// studied Standard-Metals-era ore samples (the paper precedes the
// 1978 disaster by exactly one year), so the simulator's science
// anchor + the boss's specimens come from the same operating window.
//
// Mechanism (Casadevall & Ohmoto 1977 — six-stage paragenesis,
// compressed to four in this scenario):
//   Stage I-IV  (primary ore, T 320-250°C) — pyrite-quartz, banded
//     galena-sphalerite-chalcopyrite-bornite-hematite, Au-Te-quartz.
//     Sulfide-buffered acidic fluid (pH ~4.5), reducing (O2 < 0.1),
//     salinity 4-6 wt% NaCl eq.
//   Stage V    (Mn ores, T 245-200°C, ~20% of vein fill volume) —
//     pale-pink rhodochrosite-rich. Fluid cools, CO3 rises by CO2
//     degassing, pH neutralizes (~6.0), Fe drops to <0.5 mol% in
//     carbonate lattice (the pale-pink signature). Mn²⁺ dominant
//     cation; rhodochrosite nucleates on vug walls + earlier sulfides.
//   Stage VI early (quartz-fluorite, T 230-200°C, ~5% volume) —
//     fluoride pulse. F-rich magmatic vapor mixes with meteoric
//     water in dilating ring-fracture system; REE leached from
//     devitrified ignimbrite glass (Carpenter Ridge Tuff host per
//     Bachmann et al. 2014 — Eu²⁺ from feldspar, Y³⁺ general).
//     Octahedral REE-fluorite per Bosze & Rakovan 2002 GCA 66:997.
//   Stage VI late (manganocalcite cap, T 200-170°C) — Mn budget
//     wanes, Ca dominates fluid, very slow growth gives botryoidal/
//     mammillary manganocalcite (5-15 mol% Mn in lattice; bright
//     Mn²⁺ activator fluorescence under SW UV per Pohl 2011).
//     Closes the paragenesis.
//
// 4 handlers — one per stage transition. The scenario broth starts at
// Stage I (primary ore) and the events advance it through the cooling
// + cation-evolution sequence to terminal manganocalcite cap.

function event_sunnyside_cooling_transition(c) {
  // Stage I-IV → V transition: T drops 280 → 240, sulfide-buffered
  // primary phase ends, fluid neutralizes from acidic to near-neutral
  // (sulfides locked, H+ no longer buffered). Fe drops sharply (most
  // Fe consumed by primary pyrite + chalcopyrite + Fe-rich sphalerite
  // marmatite). Salinity drops slightly (dilution by meteoric mixing).
  c.temperature = 240;
  c.fluid.S = Math.max(40, c.fluid.S * 0.2);          // sulfide budget sequestered
  c.fluid.Fe = Math.max(1.5, c.fluid.Fe * 0.03);      // Fe sequestered in primary
  c.fluid.pH = Math.min(6.0, c.fluid.pH + 1.3);       // pH neutralizes
  c.fluid.salinity = Math.max(3.0, c.fluid.salinity * 0.7);
  c.fluid.O2 = Math.min(0.15, c.fluid.O2 + 0.08);     // still reducing but less so
  c.fluid.CO3 = Math.min(80, c.fluid.CO3 + 30);       // CO2 degassing
  c.flow_rate = 0.3;
  return `Casadevall Stage I-IV conditions close at T ${c.temperature.toFixed(0)}°C. Sulfur and Fe are sequestered into the primary-ore sink (fluid S ${c.fluid.S.toFixed(0)} ppm; Fe ${c.fluid.Fe.toFixed(1)} ppm), destabilizing Au-bisulfide transport and opening the native-Au + quartz window. Any sulfides already present remain recorded; the inventory, not this event text, reports which species actually formed.`;
}

function event_sunnyside_stage_v_mn_carbonate(c) {
  // Stage V: pale-pink rhodochrosite-rich phase. CO3 rises further
  // (continued CO2 degassing + meteoric mixing). T drops to 215.
  // Mn²⁺ already dominant; existing engine's Ca/(Mn+Ca) fraction
  // dispatch produces "pale pink (Ca-rich, approaching kutnohorite
  // intermediate)" with Ca=200 + Mn=30 (Ca-fraction ~0.87). The
  // small-pale-rhomb specimen aesthetic is the Stage V signature.
  c.temperature = 215;
  c.fluid.CO3 = Math.min(110, c.fluid.CO3 + 35);      // strong CO2 degassing
  c.fluid.pH = Math.min(6.5, c.fluid.pH + 0.3);
  c.fluid.O2 = Math.max(0.05, c.fluid.O2 - 0.05);     // re-reducing slightly (organics in cool fluid)
  c.fluid.salinity = Math.max(2.5, c.fluid.salinity * 0.85);
  c.flow_rate = 0.25;
  return `Stage V Mn-carbonate conditions arrive: T ${c.temperature.toFixed(0)}°C, CO3 ${c.fluid.CO3.toFixed(0)} ppm, pH ${c.fluid.pH.toFixed(1)}. These conditions favor pale-pink, Ca-bearing rhodochrosite; the inventory reports whether nucleation and growth actually occurred.`;
}

function event_sunnyside_stage_vi_fluoride_pulse(c) {
  // Stage VI early: F-rich pulse from magmatic vapor mixing with
  // meteoric water in dilating ring-fracture system. F surges from
  // ~10 to ~35 ppm. Y leached from devitrified ignimbrite glass —
  // Carpenter Ridge Tuff REE budget per Bachmann et al. 2014; Eu²⁺
  // from feldspar at residence-T, Y³⁺ general. Y enters fluid at
  // 3 ppm, triggering REE-octahedral fluorite habit per Bosze &
  // Rakovan 2002 GCA 66:997. T drops to 205 C, inside the measured
  // 230-200 C Stage-VI window and just above the calibrated chalcedony
  // kinetic field; the co-pulse can therefore form the documented
  // quartz-fluorite assemblage without relabeling chalcedony as quartz.
  // Visible color of
  // fresh fluorite: grass-green (yttrofluorite character, Pierce
  // 1990 + Naumov & Naumova 1980 — Y-cluster mechanism); SW UV
  // brilliant blue (Eu²⁺ activator).
  c.temperature = 205;
  c.fluid.F = Math.min(35, c.fluid.F + 27);           // magmatic F pulse
  c.fluid.Y = Math.min(3.5, c.fluid.Y + 3.2);         // REE leached from wallrock
  c.fluid.SiO2 = Math.min(450, c.fluid.SiO2 + 50);    // co-pulse silica
  c.fluid.salinity = Math.max(1.5, c.fluid.salinity * 0.85);
  c.flow_rate = 0.2;
  return `Stage VI fluoride pulse: F reaches ${c.fluid.F.toFixed(0)} ppm and Y ${c.fluid.Y.toFixed(1)} ppm at ${c.temperature.toFixed(0)}°C. This opens the octahedral REE-fluorite route; only a crystal recorded in the inventory counts as formation.`;
}

function event_sunnyside_stage_vi_manganocalcite_cap(c) {
  // Stage VI late: Mn budget wanes; Ca dominates fluid; T drops to
  // 175. Engine triggers manganocalcite branch when Mn>5 + Fe<2 +
  // excess<0.4 (the cauliflower botryoidal habit + bright Mn²⁺
  // fluorescence under SW UV). The specimens show this terminal
  // overgrowth capping rhodochrosite + fluorite — the closing
  // texture of the entire Sunnyside paragenesis.
  c.temperature = 175;
  c.fluid.Mn = Math.max(6.0, c.fluid.Mn * 0.35);      // Mn budget mostly spent
  c.fluid.CO3 = Math.max(200, c.fluid.CO3);           // terminal CO2-degassing alkalinity
  c.fluid.F = Math.max(8, c.fluid.F * 0.4);           // F mostly spent in fluorite stage
  c.fluid.Y = Math.max(0.5, c.fluid.Y * 0.3);         // Y mostly locked in fluorite
  c.fluid.Ca = Math.max(240, c.fluid.Ca);             // Ca continues dominating
  c.fluid.pH = Math.max(7.2, c.fluid.pH);             // CO2 loss raises carbonate-ion activity
  c.fluid.O2 = Math.min(0.2, c.fluid.O2 + 0.05);
  c.flow_rate = 0.1;
  return `Stage VI terminal carbonate conditions: T ${c.temperature.toFixed(0)}°C, pH ${c.fluid.pH.toFixed(1)}, Ca ${c.fluid.Ca.toFixed(0)} ppm, CO3 ${c.fluid.CO3.toFixed(0)} ppm, Mn ${c.fluid.Mn.toFixed(1)} ppm, Fe ${c.fluid.Fe.toFixed(1)} ppm. Positive calcite SI permits an Mn-substituting manganocalcite cap, but the inventory reports whether it formed.`;
}
