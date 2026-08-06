// ============================================================
// js/92l-narrators-borate.ts — VugSimulator._narrate_<mineral> (borate)
// ============================================================
// Per-mineral narrators for borate-class minerals. Mirror of the other
// 92x narrator files. Methods attach to VugSimulator.prototype via
// Object.assign so direct calls (this._narrate_borax(c)) and dynamic
// dispatch (this[`_narrate_${c.mineral}`]) keep working unchanged.
//
// Minerals (2): borax, tincalconite.
//
// Tier 1 A port (post-v69) — these were on the BACKLOG.md L34 list of
// 5 unported narrators after the Python tree deletion 2026-05-07.
// Authored fresh from the data/minerals.json description blocks
// (canonical pin per stored memory feedback_narrative_canonical_richer
// — when JS and Python diverged the richer narrator wins, and here JS
// is the only runtime so the JS author sets the canon).
//
// The two minerals share an unusual property: borax self-destructs in
// dry air over weeks, losing 5 of its 10 water molecules and becoming
// tincalconite. Every tincalconite crystal in nature is a former
// borax crystal whose lattice has collapsed but whose external form
// has been preserved. The narrators below reference each other where
// the paramorph relationship matters.

Object.assign(VugSimulator.prototype, {
  _narrate_borax(c) {
    const parts = [`Borax #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Na₂[B₄O₅(OH)₄]·8H₂O — sodium tetraborate decahydrate (the formula counts crystal water differently depending on whether you trust the structural-OH or the bulk-H₂O bookkeeping). The mineral that doesn\'t belong in a typical hydrothermal vug: a playa-lake evaporite that crystallizes only from alkaline (pH > 8.5) brines rich in Na and B at low T. Searles Lake, Boron CA, the Atacama, and the Anatolian Beypazarı district produce essentially all of the world\'s mined borax.');

    if (c.habit === 'prismatic') {
      parts.push("Prismatic habit — slow low-T evaporation from a deep stable brine produces clean elongated prisms. The Boron CA museum-grade habit. Transparent and colorless when fresh; the surface goes powdery within months in any normal indoor humidity.");
    } else if (c.habit === 'cottonball') {
      parts.push('Cottonball habit — rapid surface evaporation on a hot playa floor produces matted fibrous masses that look like dirty cotton. The Death Valley playa name for it ("cottonball borax") is also the historical commercial-grade name for the unrefined product the 20-mule teams hauled out in the 1880s.');
    } else if (c.habit === 'massive') {
      parts.push('Massive habit — tincal nodules from buried ancient-lake beds. The commercial ore form; the brine deposited at depth where humidity was buffered enough for the decahydrate to stay intact over geologic time.');
    }

    if (c.dissolved) {
      parts.push('Dissolved — borax is soluble enough that the next meteoric pulse, or the next rise in playa-floor water table, will take it back into solution. Like all the highly-soluble evaporites: lifespan is measured in dry seasons.');
    } else {
      parts.push("Living on a dehydration clock. Leave fresh borax in dry indoor air and within weeks the surface effloresces white-powdery as 5 of the 10 water molecules leave the lattice. The result is tincalconite (Na₂B₄O₇·5H₂O), preserving the external prism shape but with a collapsed interior structure. Every museum borax specimen has its tincalconite afterlife waiting. The only common mineral that self-destructs in normal collection conditions.");
    }

    return parts.filter(p => p).join(' ');
  },

  _narrate_tincalconite(c) {
    const parts = [`Tincalconite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push("Na₂B₄O₇·5H₂O — borax with five water molecules gone. Tincalconite appears in the simulator only as a paramorph product of borax: the external crystal shape is preserved (the cubic outline, the prismatic terminations, all the field marks of the parent) but the lattice has collapsed and the surface has bloomed into white powder. A tincalconite specimen IS a former borax crystal frozen mid-decay.");

    if (c.habit === 'pseudomorph') {
      parts.push('Pseudomorph after borax — the diagnostic habit. Cleavage planes from the parent borax structure show as chalky discontinuities in the powdery overcoat. Under a hand lens you can sometimes still read the original prism striations through the surface bloom.');
    }

    if (c.dissolved) {
      parts.push("Dissolved — tincalconite is still water-soluble (less than borax, since it has fewer water molecules to give up to the solvent), so a wet pulse takes it. Whatever Na and B the brine reabsorbs may re-crystallize as borax if the local humidity comes up and the equilibrium swings back, but the original crystal won't reassemble — the historical specimen is gone.");
    } else {
      parts.push("Stable while it stays on the dry side of the borax–tincalconite water-activity boundary. Controlled-humidity X-ray experiments show that tincalconite can hydrate back toward borax at high relative humidity; the current simulator records the dehydration half-cycle but does not yet replay reversible humidity cycling. Treat the preserved white pseudomorph as a dry-state snapshot, not an irreversible endpoint.");
    }

    return parts.filter(p => p).join(' ');
  },
});
