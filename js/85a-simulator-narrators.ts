// ============================================================
// js/85a-simulator-narrators.ts — cross-cutting narrator helpers
// ============================================================
// After B16, this file holds only the non-mineral narrator helpers
// that don't fit a single-mineral _narrate_<X>(c) helper:
// _narrate_mixing_event, _narrate_tectonic, _narrate_collectors_view.
// The 95 per-mineral narrators moved to js/92x-narrators-<class>.ts.

Object.assign(VugSimulator.prototype, {
  _narrate_mixing_event(batch, event) {
  const mineral_names = new Set(batch.map(c => c.mineral));
  const parts = [];
  if (mineral_names.has('sphalerite') && mineral_names.has('fluorite')) {
    parts.push("When metal-bearing brine met sulfur-bearing groundwater, sphalerite (ZnS) and fluorite (CaF₂) nucleated simultaneously — a classic Mississippi Valley-type precipitation event. The zinc and sulfur couldn't coexist in solution; they combined on contact and the minerals fell out of the fluid like rain.");
  } else if (mineral_names.has('sphalerite')) {
    parts.push("Sphalerite nucleated as zinc-bearing brine mixed with sulfur-rich groundwater. The two fluids were stable apart; together, ZnS became insoluble.");
  }
  return parts.join(' ');
},

  _narrate_tectonic(batch) {
  const twinned = this.crystals.filter(c => c.twinned);
  if (twinned.length) {
    const names = twinned.map(c => `${c.mineral} #${c.crystal_id}`);
    return ` The stress may have induced twinning in ${names.join(', ')}. Twin planes formed as the crystal lattice accommodated the sudden strain — a record of the event frozen in the structure.`;
  }
  return ' No visible twinning resulted, but the pressure change altered subsequent growth conditions.';
},

  _narrate_collectors_view() {
  const parts = ['A collector examining this specimen would find:'];
  for (const c of this.crystals) {
    if (c.total_growth_um < 10 && !c.zones.length) continue;

    if (c.mineral === 'quartz') {
      if (c.c_length_mm > 2) {
        let desc = `a ${c.c_length_mm.toFixed(1)}mm quartz crystal`;
        if (c.twinned) desc += ` (${c.twin_law} twinned)`;
        const fi_count = c.zones.filter(z => z.fluid_inclusion).length;
        if (fi_count > 3) desc += ' with visible fluid inclusions';
        parts.push(`  • ${desc}`);
      } else if (c.c_length_mm > 0.1) {
        parts.push('  • tiny quartz crystals on the vug wall');
      }
    } else if (c.mineral === 'calcite') {
      const fl = c.predict_fluorescence();
      let desc = `a ${c.c_length_mm.toFixed(1)}mm ${c.habit} calcite`;
      if (c.twinned) desc += ' (twinned)';
      if (fl.includes('orange')) desc += ' — glows orange under UV';
      else if (fl.includes('quenched')) desc += " — patchy UV response (Mn zones glow, Fe zones dark)";
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'aragonite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm aragonite`;
      if (c.habit === 'twinned_cyclic') desc += ' six-pointed cyclic twin';
      else if (c.habit === 'acicular_needle') desc = `acicular aragonite spray, ${c.c_length_mm.toFixed(1)}mm`;
      else if (c.habit === 'flos_ferri') desc = `flos ferri aragonite — dendritic 'iron flower', ${c.c_length_mm.toFixed(1)}mm`;
      else desc += ' columnar prism';
      if (c.twinned && c.habit !== 'twinned_cyclic') desc += ` (${c.twin_law})`;
      desc += ' — orthorhombic CaCO₃';
      if (c.dissolved) desc += ', converted to calcite (pseudomorph)';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'rhodochrosite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm rhodochrosite`;
      if (c.habit === 'rhombohedral') desc += " 'button' rhombohedron";
      else if (c.habit === 'scalenohedral') desc += " scalenohedral 'dog-tooth'";
      else if (c.habit === 'stalactitic') desc = `stalactitic rhodochrosite, ${c.c_length_mm.toFixed(1)}mm — concentric rose-pink banding`;
      else desc += ' banded crust';
      if (c.twinned) desc += ` (${c.twin_law})`;
      desc += ' — pink to raspberry-red MnCO₃';
      if (c.dissolved) desc += ', oxidized to black Mn-oxide rind';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'dolomite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm dolomite`;
      if (c.habit === 'saddle_rhomb') desc += ' saddle-shaped curved rhomb';
      else if (c.habit === 'coarse_rhomb') desc += ' coarse rhombohedron';
      else desc += ' massive granular';
      if (c.twinned) desc += ` (${c.twin_law})`;
      desc += ' — white CaMg(CO₃)₂';
      if (c.dissolved) desc += ', acid-dissolved';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'siderite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm siderite`;
      if (c.habit === 'rhombohedral') desc += " 'saddle' rhombohedron";
      else if (c.habit === 'scalenohedral') desc += " scalenohedral";
      else if (c.habit === 'spherulitic') desc = `spherosiderite concretion, ${c.c_length_mm.toFixed(1)}mm`;
      else desc += ' botryoidal crust';
      if (c.twinned) desc += ` (${c.twin_law})`;
      desc += ' — tan to brown FeCO₃';
      if (c.dissolved) desc += ', oxidized to goethite/limonite (diagenetic pseudomorph)';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'sphalerite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm sphalerite`;
      if (c.twinned) desc += ` (${c.twin_law})`;
      if (c.zones.length) {
        const last_note = c.zones[c.zones.length - 1].note;
        if (last_note.includes('color:')) {
          const color = last_note.split('color:')[1].split(',')[0].trim();
          desc += `, ${color}`;
        }
      }
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'wurtzite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm wurtzite`;
      if (c.habit === 'hemimorphic_crystal') desc += ' hexagonal pyramid';
      else if (c.habit === 'radiating_columnar') desc = `radiating wurtzite columns, ${c.c_length_mm.toFixed(1)}mm across`;
      else if (c.habit === 'fibrous_coating') desc = `fibrous wurtzite crust, ${c.c_length_mm.toFixed(1)}mm thick`;
      else desc += ' tabular plate';
      if (c.twinned) desc += ` (${c.twin_law})`;
      desc += ' — hexagonal (Zn,Fe)S, darker than cubic sphalerite';
      if (c.dissolved) desc += ', inverted to sphalerite on cooling';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'fluorite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm fluorite cube`;
      if (c.twinned) desc += ' (penetration twin)';
      const fl = c.predict_fluorescence();
      if (fl !== 'non-fluorescent' && !fl.includes('opaque')) desc += ` — fluoresces ${fl.split('(')[0].trim()}`;
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'pyrite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm pyrite`;
      if (c.habit === 'framboidal') {
        desc = 'framboidal pyrite aggregate';
      } else if (c.habit === 'pyritohedral') {
        desc += ' pyritohedron';
      } else {
        desc += ' cube';
      }
      if (c.twinned) desc += ` (${c.twin_law})`;
      desc += ' — bright metallic luster';
      if (c.dissolved) desc += ', partially oxidized (limonite staining)';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'marcasite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm marcasite`;
      if (c.habit === 'cockscomb') {
        desc += ' cockscomb';
      } else if (c.habit === 'spearhead') {
        desc += ' spearhead';
      } else if (c.habit === 'radiating_blade') {
        desc = `radiating marcasite blades, ${c.c_length_mm.toFixed(1)}mm across`;
      } else {
        desc += ' tabular plate';
      }
      if (c.twinned) desc += ` (${c.twin_law})`;
      desc += ' — pale brass, iridescent tarnish';
      if (c.dissolved) desc += ', partially replaced by pyrite (metastable inversion)';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'chalcopyrite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm chalcopyrite`;
      if (c.twinned) desc += ` (${c.twin_law})`;
      desc += ' — brassy yellow, greenish tint';
      if (c.dissolved) desc += ', oxidation rind (green Cu carbonate staining)';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'hematite') {
      let desc;
      if (c.habit === 'specular') {
        desc = `a ${c.c_length_mm.toFixed(1)}mm specular hematite`;
        if (c.zones.some(z => z.note && z.note.includes('iridescent'))) {
          desc += ' — iridescent rainbow plates';
        } else {
          desc += ' — brilliant metallic silver-black plates';
        }
      } else if (c.habit === 'botryoidal') {
        desc = `a ${c.c_length_mm.toFixed(1)}mm botryoidal hematite — kidney-ore, dark metallic`;
      } else if (c.habit === 'rhombohedral') {
        desc = `a ${c.c_length_mm.toFixed(1)}mm rhombohedral hematite — sharp dark crystals`;
      } else {
        desc = 'earthy red hematite mass';
      }
      if (c.twinned) desc += ` (${c.twin_law})`;
      if (c.dissolved) desc += ', partially dissolved';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'malachite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm malachite`;
      if (c.habit === 'banded') {
        desc += ' — banded green, concentric layers';
      } else if (c.habit === 'fibrous/acicular') {
        desc += ' — sprays of acicular green needles';
      } else {
        desc += ' — botryoidal green masses';
      }
      if (c.dissolved) desc += ', partially dissolved (acid attack)';
      if (c.position.includes('chalcopyrite')) desc += ' (on chalcopyrite — oxidation paragenesis)';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'uraninite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm uraninite cube — dense, black, radioactive`;
      if (c.twinned) desc += ` (${c.twin_law})`;
      parts.push(`  • ☢️ ${desc}`);
    } else if (c.mineral === 'galena') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm galena — lead-gray, perfect cubic cleavage`;
      if (c.twinned) desc += ` (${c.twin_law})`;
      if (c.dissolved) desc += ', partially oxidized';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'smithsonite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm smithsonite`;
      const lastNote = c.zones.length ? c.zones[c.zones.length - 1].note : '';
      if (lastNote.includes('blue-green')) desc += ' — blue-green (Cu impurity)';
      else if (lastNote.includes('pink')) desc += ' — pink (Mn impurity)';
      else if (lastNote.includes('yellow')) desc += ' — yellow-brown (Fe impurity)';
      else desc += ' — white to pale blue';
      if (c.position.includes('sphalerite')) desc += ' (on oxidized sphalerite)';
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'wulfenite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm wulfenite — bright orange tabular plates`;
      if (c.twinned) desc += ` (${c.twin_law})`;
      if (c.position.includes('galena')) desc += ' (on galena)';
      parts.push(`  • 🟠 ${desc}`);
    } else if (c.mineral === 'selenite') {
      const dName = crystalDisplayName(c);
      let desc = `a ${c.c_length_mm.toFixed(1)}mm ${dName}`;
      if (c.habit === 'rosette') desc += ' — lenticular plates with sand inclusions';
      else if (c.habit && c.habit.includes('fibrous')) desc += ' — chatoyant silky fibers';
      else desc += ' — transparent blades, pearly luster';
      if (c.twinned) desc += ` (${c.twin_law})`;
      if (c.position.includes('pyrite') || c.position.includes('chalcopyrite')) desc += ' (on oxidized sulfide surface)';
      parts.push(`  • 💎 ${desc}`);
    } else if (c.mineral === 'feldspar') {
      const dName = crystalDisplayName(c);
      let desc = `a ${c.c_length_mm.toFixed(1)}mm ${dName}`;
      if (dName === 'amazonite') desc += ' — green from Pb²⁺ substitution';
      else if (c.mineral_display === 'albite' && c.habit.includes('cleavelandite')) desc += ' — platy white blades';
      else if (c.mineral_display === 'sanidine') desc += ' — glassy, high-temperature';
      else if (c.mineral_display === 'adularia') desc += ' — pseudo-orthorhombic, alpine habit';
      else if (c.mineral_display === 'orthoclase') desc += ' — prismatic, partially ordered';
      else if (c.mineral_display === 'microcline') desc += ' — fully ordered, triclinic';
      if (c.twinned) desc += ` (${c.twin_law})`;
      if (c.zones.some(z => z.note && z.note.includes('perthite'))) desc += ' with perthite exsolution (possible moonstone)';
      parts.push(`  • 🏔️ ${desc}`);
    } else if (c.mineral === 'goethite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm goethite — earthy brown-yellow`;
      parts.push(`  • ${desc}`);
    } else if (c.mineral === 'adamite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm adamite`;
      const isFluorescent = c.zones.some(z => z.note && z.note.includes('FLUORESCENT') && !z.note.includes('NON-'));
      if (isFluorescent) desc += ' — vivid green (cuproadamite), UV-fluorescent 💚';
      else desc += ' — yellow-green, non-fluorescent';
      if (c.habit === 'acicular sprays') desc += ', fan-shaped sprays';
      if (c.position.includes('goethite') || c.position.includes('hematite')) desc += ' (on iron oxide)';
      if (c.dissolved) desc += ', partially dissolved';
      parts.push(`  • 💚 ${desc}`);
    } else if (c.mineral === 'mimetite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm mimetite`;
      if (c.habit && c.habit.includes('campylite')) desc += ' — orange-brown barrel-shaped campylite!';
      else desc += ' — yellow-orange hexagonal prisms';
      if (c.position.includes('galena')) desc += ' (on galena — child on parent)';
      if (c.dissolved) desc += ', partially dissolved';
      parts.push(`  • 🟡 ${desc}`);
    } else if (c.mineral === 'molybdenite') {
      let desc = `a ${c.c_length_mm.toFixed(1)}mm molybdenite`;
      desc += ' — bluish-gray hexagonal plates, soft and sectile';
      if (c.dissolved) desc += ', oxidized — MoO₄²⁻ released to fluid';
      else desc += '. The Mo source for wulfenite if conditions oxidize.';
      parts.push(`  • ${desc}`);
    } else {
      // Catch-all for any future minerals
      let desc = `a ${c.c_length_mm.toFixed(1)}mm ${c.mineral}`;
      if (c.twinned) desc += ` (${c.twin_law})`;
      parts.push(`  • ${desc}`);
    }
  }

  if (parts.length === 1) return "The vug produced only microscopic crystals — a thin crust on the cavity wall.";
  return parts.join('\n');
},
});
