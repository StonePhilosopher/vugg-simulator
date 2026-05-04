#!/usr/bin/env python3
"""
🪨 Vugg Simulator — A text-based crystal growth engine

Simulates mineral crystallization inside a vug (cavity) under
evolving hydrothermal conditions. Text output describes what grows,
how it grows, and why.

Role in the project (read this before refactoring):
    This file is the **dev/test harness** for the simulation engine.
    The Python is where the builder iterates on new minerals first,
    runs the test suite (`tests/` exercises this file, not the JS),
    and confirms behavior before porting changes to index.html.

    The **shipped product** is index.html — that is what users play
    via GitHub Pages. The same 84 grow_*() functions, scenarios, and
    Crystal/FluidChemistry/VugConditions classes also live there.
    `agent-api/vugg-agent.js` is a third (intentionally simpler)
    runtime for AI agents.

    Yes, that's three engine implementations of the same logic. The
    drift cost is real (and is policed by `tools/sync-spec.js`). The
    decision to keep them all is documented in:
        proposals/TASK-BRIEF-NARRATIVE-READABILITY.md (item 5 / context)
        — and the architecture review session 2026-04-29.

When does this file go away?
    The endgame plan is "drop vugg.py, port pytest to Node, JS becomes
    the only engine." Trigger conditions:
        • mineral count crosses ~100, OR
        • the builder's natural workflow cycles away from Python-first
          development (e.g., new mode work happens browser-first)
    Until then, vugg.py is the right tool — don't rewrite it ahead of
    that trigger. The `data/`-as-truth migration (proposals/
    TASK-BRIEF-DATA-AS-TRUTH.md) is the bridging work that makes the
    eventual drop cheap.

Usage:
  python3 vugg.py                          # default scenario
  python3 vugg.py --scenario cooling       # simple cooling scenario
  python3 vugg.py --scenario pulse         # fluid pulse event
  python3 vugg.py --scenario mvt           # Mississippi Valley-type deposit
  python3 vugg.py --scenario reactive_wall # Acid pulses dissolve limestone walls
  python3 vugg.py --steps 200             # more time steps
  python3 vugg.py --interactive           # manual control mode

The engine is modular — minerals are plugins, events are injectable,
and the output format is extensible.
"""

import argparse
import json
import math
import os
import random
import sys
from dataclasses import dataclass, field, fields, replace
from typing import List, Dict, Optional, Tuple


# ============================================================
# SIM VERSION
# ============================================================
# Monotonic version tag bumped by any change that could shift seed-42
# output for any scenario (chemistry retune, engine change, new mineral,
# new event, new mechanic). Used by the scenario-chemistry audit and
# later by the multi-ring 3D simulation (see PROPOSAL-3D-SIMULATION.md)
# to distinguish v1 (pre-audit) from v2 (post-audit) output streams.
#
#   v1 — pre-audit: generic FluidChemistry defaults, Mg=0 in most scenarios
#   v2 — scenario-chemistry audit (Apr 2026): every scenario anchored to a
#        named locality with cited fluid values; locality_chemistry.json
#        is the data-source-of-truth.
#   v3 — supergene/arsenate expansion (Apr 2026): ferrimolybdite
#        (Pb-absent Mo-oxidation fork), arsenopyrite (Au-trapping primary
#        sulfide), and scorodite (arsenate supergene product with
#        pH-gated dissolution) engines added. Shifts Mo distribution
#        wherever O₂/Fe are available (porphyry, bisbee, supergene), and
#        shifts Au distribution in reducing-As scenarios (arsenopyrite
#        now traps a fraction of Au as invisible-gold trace before
#        native_gold can nucleate).
#   v4 — sulfate expansion round 5 (Apr 2026): seven sulfates added —
#        barite + celestine + jarosite + alunite + brochantite +
#        antlerite + anhydrite. Activated Coorong sabkha celestine +
#        anhydrite immediately; Bingham/Bisbee jarosite/alunite/anhydrite
#        post-event; Bisbee brochantite/antlerite supergene Cu sulfate
#        suite. Engine count 55 → 62. Two gaps documented at the time:
#        Tri-State + Sweetwater O2=0.0 blocked barite + celestine, and
#        Tsumeb pH=6.8 blocked scorodite + jarosite + alunite.
#   v5 — gap-fill follow-ups (Apr 2026): bumps Tri-State + Sweetwater
#        scenarios from O2=0.0 (default — strictly reducing) to O2=0.2
#        (mildly reducing, matching real MVT brine where SO₄²⁻ persists
#        alongside galena's H₂S — the chemistry that makes barite +
#        galena coexistence the diagnostic MVT assemblage). Activates
#        the dormant Ba=20/25 + Sr=15/12 pools in both scenarios.
#        Plus (Tsumeb commit, separate): adds early
#        ev_supergene_acidification event at step 5 + bumps Tsumeb Al
#        3→15, opening a 15-step acid window for scorodite + jarosite +
#        alunite to nucleate before ev_meteoric_flush at step 20
#        carbonate-buffers pH back up.
#   v8 — Round 8 mineral expansion (Apr 2026, COMPLETE): 15 new species
#        across 5 sub-rounds, engine count 69 → 84, tests 842 → 1037.
#        Three new mineral-mechanic patterns added to the sim plus
#        five new chemistry-dispatch patterns.
#
#        Silver suite (8a, 3 species):
#          • acanthite (Ag₂S, monoclinic) — first Ag mineral. Hits
#            seed-42 in mvt/reactive_wall/bisbee.
#          • argentite (Ag₂S, cubic) + 173°C PARAMORPH MECHANIC. First
#            non-destructive polymorph in the sim — argentite crystals
#            cooling past 173°C convert in-place to acanthite while
#            preserving habit + dominant_forms + zones. Module-level
#            PARAMORPH_TRANSITIONS dict + apply_paramorph_transitions
#            hook in run_step. Bisbee shows 5 argentite + 2 paramorphic
#            acanthite-after-argentite at seed-42; porphyry stays >173°C
#            with 8 pure argentite.
#          • native_silver (Ag) — S-DEPLETION GATE engine. Fires only
#            when S<2 AND O2<0.3 (inverse of normal supersaturation).
#            Habit variants include the Kongsberg 30-cm wire.
#
#        Native element trio (8b, 3 species):
#          • native_arsenic (As) — S+Fe overflow gates (S>10 → realgar/
#            arsenopyrite; Fe>50 → arsenopyrite).
#          • native_sulfur (S) — synproportionation Eh-window engine
#            (0.1<O2<0.7), the H₂S/SO₄²⁻ boundary chemistry. First Eh-
#            window engine; pH<5 + Fe+Cu+Pb+Zn<100 base-metal-poverty
#            gates.
#          • native_tellurium (Te) — Au+Ag overflow gates (Au>1 →
#            calaverite; Ag>5 → hessite). Au-Te coupling round now
#            unblocked.
#
#        Ni-Co sulfarsenide cascade (8c, 3 species + Bisbee scenario):
#          • nickeline (NiAs) — high-T Ni arsenide.
#          • millerite (NiS) — capillary brass-yellow needles. Mutual-
#            exclusion gate with nickeline (As>30 + T>200 → 0).
#          • cobaltite (CoAsS) — THREE-ELEMENT GATE engine, the first
#            in the sim (Co + As + S all required simultaneously).
#          • Bisbee scenario chemistry: Co=80 + Ni=70 added (citing
#            Graeme et al. 2019). Activates the supergene erythrite +
#            annabergite cascade at seed-42 (1 + 4 crystals in bisbee,
#            18 + 19 in supergene_oxidation).
#          • Erythrite + annabergite narrators refreshed to surface
#            cobaltite/nickeline/millerite as paragenetic parents.
#
#        VTA suite (8d, 5 species + Tsumeb W chemistry):
#          • descloizite (PbZnVO₄(OH)) + mottramite (PbCu(VO₄)(OH)) —
#            Cu/Zn-RATIO FORK dispatcher (Cu>Zn → mottramite, Zn≥Cu →
#            descloizite). The Tsumeb cherry-red / olive-green pair.
#          • raspite (PbWO₄, monoclinic) + stolzite (PbWO₄, tetragonal)
#            — KINETIC-PREFERENCE DISPATCHER (when both gates clear,
#            stolzite wins ~90% of rolls, reflecting natural ~10:1
#            occurrence ratio). First kinetic-preference engine.
#          • olivenite (Cu₂AsO₄(OH)) — Cu/Zn fork with adamite (the
#            existing Zn arsenate). Adamite engine retrofitted with
#            inverse Cu>Zn gate for symmetric dispatch.
#          • supergene_oxidation scenario: W=20 added (Strunz 1959 —
#            Tsumeb deep oxidation hosts minor scheelite + lead-
#            tungstate suite). Pb thresholds tuned 100→40 to match real
#            supergene fluid concentrations.
#          • Vanadinite + adamite narrators refreshed to surface the
#            descloizite/mottramite + olivenite companions.
#          • Seed-42 hits: bisbee olivenite=10, porphyry olivenite=3,
#            supergene_oxidation stolzite=9 (kinetic winner over
#            raspite) + adamite=1 + vanadinite=5.
#
#        Chalcanthite (8e, 1 species + water-solubility mechanic):
#          • chalcanthite (CuSO₄·5H₂O) — bright blue water-soluble
#            terminal Cu-sulfate phase.
#          • WATER-SOLUBILITY METASTABILITY MECHANIC: per-step hook in
#            run_step re-dissolves chalcanthite when fluid.salinity<4
#            OR fluid.pH>5. When growth<0.5µm, asymptotic decay
#            collapses to full dissolution. Distinct from THERMAL_
#            DECOMPOSITION (high-T destruction) and PARAMORPH_
#            TRANSITIONS (in-place mineral conversion). First re-
#            dissolvable mineral.
#
#        Engine count 69 → 84 (+15). Tests 842 → 1037 (+195).
#   v9 — Round 9 supergene-suite mineral expansion (Apr 2026), shipped
#        in sub-rounds:
#        • 9a: rosasite + aurichalcite + the **broth-ratio branching**
#          mechanic. First mineral pair where the *ratio* of fluid
#          elements (Cu vs Zn for the carbonate pair) — not presence/
#          absence — gates nucleation. Same parent broth, opposite
#          outcome.
#        • 9b: torbernite + zeunerite + the **anion-competition**
#          mechanic. The 3-branch generalization of 9a's 2-branch
#          ratio gate, with three uranyl minerals competing for the
#          same U⁶⁺ cation, differentiated by which anion (PO₄³⁻/
#          AsO₄³⁻/VO₄³⁻) dominates. 9b shipped the P + As branches.
#        • 9c: carnotite + completion of the anion-competition trio.
#          V-branch (canary-yellow Colorado Plateau crusts, K-cation
#          instead of Cu, monoclinic instead of tetragonal). Also
#          widens torbernite + zeunerite supersat denominators from
#          P+As to P+As+V so V-rich fluid properly routes to carnotite.
#          The mechanic now properly 3-way competitive.
#        Both mechanics establish patterns reusable for future
#        ratio-driven pairs/trios. Engine count 84 → 89 (+5 across
#        9a + 9b + 9c). No new FluidChemistry fields. First commits
#        to populate test_cases on data/minerals.json (per
#        proposals/TASK-BRIEF-DATA-AS-TRUTH.md item 6).
#   v10 — Twin bug fix (Apr 2026, Round 9 closeout patch). Pre-fix,
#        each grow_*() function rolled twinning probability per growth
#        step, so a crystal with 30 zones at p=0.1 had ~92% cumulative
#        twinning rate instead of the declared per-roll 10%. Post-fix,
#        the roll happens once at nucleation per declared twin_law in
#        data/minerals.json (VugSimulator._roll_spontaneous_twin).
#        Most existing minerals' realized twin rate drops dramatically —
#        from near-certainty over a typical crystal lifetime down to
#        the spec-declared per-roll probability (typically 1-10%).
#        Quartz Dauphiné (thermal_shock trigger) remains in grow_quartz
#        as event-conditional logic. Cuprite spinel-twin habit branch
#        was removed; spinel-twinned cuprite now carries the default
#        octahedral habit plus the twinned flag. Verified by
#        tools/twin_rate_check.py — all 25 spontaneously-twinned
#        minerals match declared probabilities within ±2σ binomial
#        tolerance at n=2000.
#   v11 — Broth-ratio retrofit (Apr 2026), shipped in pair-by-pair commits
#        per proposals/TASK-BRIEF-RETROFIT-BROTH-RATIO.md:
#        • Pair 1 (malachite/azurite): docstring refresh only — existing
#          CO3-threshold split + paramorph already encode Vink 1986.
#        • Pair 2 (adamite/olivenite): Round 8d strict-comparison Cu/Zn
#          dispatch upgraded to the rosasite/aurichalcite 50%-gate +
#          sweet-spot bonus (0.55-0.85) + pure-element damping (>0.95)
#          + recessive-element trace floor (Cu>=0.5 / Zn>=0.5). Per
#          Hawthorne 1976 + Burns 1995 + Chukanov 2008 (zincolivenite).
#        • Pair 3 (descloizite/mottramite): same retrofit as pair 2.
#          Per Schwartz 1942 + Oyman 2003 + Strunz 1959.
#        • Pair 4 (sphalerite/wurtzite): polymorphism, not solid-solution.
#          Keep T-based gates; add low-T metastable wurtzite branch under
#          pH<4 + sigma>=1 + Fe>=5 per Murowchick & Barnes 1986.
#        Each retrofit is its own commit; baselines regenerated per
#        retrofit. Research artifacts at research/research-broth-ratio-
#        <pair>.md.
#   v12 — Uraninite gatekeeper (May 2026, per research-uraninite.md
#        canonical, boss commit 626bb22):
#        • Oxidative dissolution wired into grow_uraninite (all 3 runtimes,
#          mirroring molybdenite). When sigma<1 + O2>0.3 + grown>3µm,
#          uraninite dissolves and releases UO₂²⁺ (uranyl) back to broth.
#          This makes uraninite the realistic feedstock for the secondary
#          uranium family (torbernite/zeunerite/carnotite/future autunite).
#        • Habit dispatch in grow_uraninite (was always cubic):
#          T>500 → octahedral (pegmatitic); else pitchblende_massive
#          (hydrothermal botryoidal at 200-500, cryptocrystalline below).
#        • supersaturation_uraninite reconciled — pre-existing JS drift
#          (eT-only formula, no O2 gate) replaced with the canonical
#          Python form (reducing + U-gated). All 3 runtimes now identical.
#        • Factual fixes per research: fluorescence flipped to non-
#          fluorescent (ABSENCE of fluorescence is what distinguishes
#          uraninite from its glowing secondaries); T_range tightened
#          200-800 → 150-600.
#        • event_radioactive_pegmatite_oxidizing narration updated —
#          uraninite no longer "endures forever"; it begins to weather
#          when meteoric water arrives (true to the new mechanic + the
#          research's central framing).
#   v13 — Supersat drift audit + sulfide O2-gate fixes (May 2026, per
#        tools/supersat_drift_audit.py). The audit found 11 mineral
#        supersat formulas with structural drift between vugg.py and
#        index.html — most cosmetic, but two are real physics bugs:
#        • galena (JS): pre-v13 had no O2 gate, allowing PbS to form
#          under oxidizing conditions. Now matches Python (O2>1.5
#          returns 0; (1.5-O2) factor in formula).
#        • molybdenite (index.html): same bug class — no O2 gate
#          (agent-api/vugg-agent.js already had the correct version).
#        • chalcopyrite (Python): T window was a flat 1.2/0.6 binary;
#          ported the JS 4-tier formulation (Seo et al. 2012 porphyry
#          window: rare<180, viable 180-300, peak 300-500, fades>500).
#          Richer-canonical per the boss's 2026-04-30 rule.
#        Remaining divergences (effectiveTemperature feature gap +
#        feldspar/fluorite/selenite/smithsonite/wulfenite design
#        divergences) filed in BACKLOG.md.
#   v14 — Round 9d: autunite + cation fork on the P-branch (May 2026,
#        per research/research-uraninite.md §164-178 paragenetic chain).
#        New mineral: autunite Ca(UO₂)₂(PO₄)₂·11H₂O — Ca-cation analog
#        of torbernite. Same parent fluid (U + P + supergene-T +
#        oxidizing) but wins when Ca/(Cu+Ca) > 0.5 — the geological
#        default everywhere except actively-mined Cu districts. The
#        defining feature is fluorescence: Ca²⁺ doesn't quench uranyl
#        emission like Cu²⁺ does, so autunite glows intense apple-green
#        under LW UV while torbernite is dead.
#        Mechanic: cation fork on the P-branch. supersaturation_torbernite
#        gains a Cu/(Cu+Ca) > 0.5 gate (was Cu>=5 only); supersaturation_
#        autunite mirrors with Ca/(Cu+Ca) > 0.5. Both also pass through
#        the existing P/(P+As+V) > 0.5 anion fork. Result: torbernite
#        is now properly geographically rare; autunite picks up the
#        common-groundwater case.
#        Engine count 89 → 90 (+1). Same content gap as 9b/9c (no shipped
#        scenario currently routes U + P at supergene T to fire it,
#        though radioactive_pegmatite + a future Schneeberg-style
#        oxidation event could).
#   v15 — Round 9e: tyuyamunite + uranospinite — Ca-cation analogs of
#        carnotite + zeunerite, completing the cation+anion fork
#        mechanic across all three anion branches (May 2026, per
#        research/research-tyuyamunite.md + research/research-uranospinite.md).
#        Two new minerals shipped together — they share the architectural
#        pattern (Ca-cation, autunite-group fork on a non-P anion):
#        - tyuyamunite Ca(UO₂)₂(VO₄)₂·5-8H₂O — V-branch / Ca-cation,
#          orthorhombic instead of carnotite's monoclinic, weakly
#          fluorescent yellow-green LW (vanadate matrix dampens, but
#          slightly cleaner than carnotite). Type: Tyuya-Muyun, Fergana
#          Valley (Nenadkevich 1912).
#        - uranospinite Ca(UO₂)₂(AsO₄)₂·10H₂O — As-branch / Ca-cation,
#          tetragonal autunite-group, strongly fluorescent yellow-green
#          LW (Ca²⁺ doesn't quench like Cu²⁺ does in zeunerite). Type:
#          Walpurgis Flacher vein, Schneeberg, Saxony (Weisbach 1873).
#        Mechanic: cation forks added to zeunerite + carnotite mirroring
#        torbernite's 9d gate. The full autunite-group cation+anion fork
#        is now complete:
#          P-branch: torbernite (Cu) ↔ autunite (Ca)
#          As-branch: zeunerite (Cu) ↔ uranospinite (Ca)
#          V-branch: carnotite (K) ↔ tyuyamunite (Ca)
#        supersaturation_zeunerite gates on Cu/(Cu+Ca) > 0.5;
#        supersaturation_carnotite gates on K/(K+Ca) > 0.5; the new
#        Ca-cation supersats mirror with Ca/(Cu+Ca) > 0.5 and
#        Ca/(K+Ca) > 0.5 respectively. Each pair preserves the anion
#        fork P/(P+As+V) > 0.5 already in place.
#        Engine count 90 → 92.
#   v16 — Round 9e mechanic-coverage scenarios (May 2026): two new
#        shipped scenarios that finally exercise the autunite-group
#        cation+anion fork end-to-end.
#        • schneeberg (Erzgebirge type locality, Saxony) — 6-event
#          U-pegmatite + arsenopyrite oxidation lifecycle. Fires all
#          four P/As-branch uranyls in a single seed-42 run:
#          torbernite=3, zeunerite=3, autunite=3, uranospinite=4.
#          Plus the v12 uraninite gatekeeper chain (3 uraninite grow
#          then weather, releasing UO₂²⁺ to feed the secondaries).
#        • colorado_plateau (Uravan Mineral Belt, Roc Creek type
#          locality) — 5-event sandstone roll-front lifecycle. Fires
#          the V-branch uranyls: carnotite=4, tyuyamunite=5.
#        Together they fire all 6 secondary U species shipped in
#        Rounds 9b/9c/9d/9e — the cation+anion fork mechanic
#        finally has scenarios that exercise it.
#        No engine changes; engine count remains 92.
#   v17 — Supersat reconciliation v2 (May 2026, post-v13 audit follow-up):
#        Resolved the remaining 5 design-divergent supersats from the
#        v13 audit, plus ported effective_temperature + silica_equilibrium
#        to Python. All decisions research-grounded:
#        • effective_temperature property + silica_equilibrium table
#          ported from JS. Python's chalcopyrite/galena/pyrite/molybdenite/
#          quartz now use eT for Mo-flux porphyry boost. Python's quartz
#          uses Fournier & Potter 1982 / Rimstidt 1997 tabulated solubility
#          (was inline 50*exp(0.008*T) which overshoots ~3x at high T).
#        • feldspar — JS K-or-Na fork removed (albite has its own
#          supersat); both runtimes now K-only with 800°C upper cap
#          (sanidine→melt boundary).
#        • fluorite — both runtimes adopt JS 5-tier T window (Richardson
#          & Holland 1979, MVT deposits 50-152°C) + Python's fluoro-
#          complex penalty (Manning 1979, secondary at T<300°C).
#        • selenite — both runtimes adopt Python's T treatment (decay
#          above 60°C, matches gypsum-anhydrite phase boundary at 55-
#          60°C per Naica/Pulpí studies) + JS's T<40 sweet-spot bonus
#          (Pulpí 20°C). Pre-v17 JS hard cap at 80°C was too lenient.
#        • smithsonite — both runtimes adopt JS pH treatment (hard pH<5
#          cutoff, alkaline boost pH>7) plus tightened T cap to 100°C
#          hard with steep decay above 80°C (research: supergene-only,
#          T 10-50°C optimum). Both pre-v17 T caps too generous.
#        • wulfenite — hybrid: Python's T cap (decay above 80°C, matches
#          research <80°C supergene) + Python's graduated pH penalties
#          (3.5-9.0 window, matches research 6-9) + JS's stricter Pb/Mo
#          thresholds (>=10/>=5, matches research's "rare two-parent
#          mineral" framing). Pre-v17 JS T cap at 250°C was way too
#          lenient.
SIM_VERSION = 20

# Phase C of PROPOSAL-3D-SIMULATION (= proposal's "Phase 2"): per-ring
# chemistry scaffolding. Each ring carries its own FluidChemistry +
# temperature; inter-ring diffusion homogenizes them slowly. Rate is
# the per-step fraction of the difference exchanged between adjacent
# rings — small enough that a vertical gradient survives many steps,
# large enough that uniform broth stays uniform under floating-point
# rounding. Scenarios that don't seed a vertical gradient see all rings
# identical at every step (forward-simulation byte-equality preserved).
DEFAULT_INTER_RING_DIFFUSION_RATE = 0.05


# ============================================================
# MINERAL SPEC — single source of truth
# ============================================================
# Loaded from data/minerals.json. Every mineral declares every
# template field (max_size_cm, thermal_decomp_C, fluorescence,
# twin_laws, acid_dissolution, …). Runtime code reads from here
# so that vugg.py / web/index.html / agent-api stay consistent.

_SPEC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "data", "minerals.json")
with open(_SPEC_PATH, "r", encoding="utf-8") as _f:
    _SPEC_DOC = json.load(_f)
MINERAL_SPEC: Dict[str, dict] = _SPEC_DOC["minerals"]


def spec_for(mineral: str) -> dict:
    """Return spec row for a mineral. Raises KeyError if not declared."""
    return MINERAL_SPEC[mineral]


# ============================================================
# NARRATIVE TEMPLATES — narratives/<species>.md
# ============================================================
# Per-species prose lives in narratives/<species>.md as markdown files
# with frontmatter + named variant sections. Code retains conditional
# dispatch logic (which variants to render, in what order) and supplies
# runtime values; markdown holds the prose itself. Edit narrative wording
# without touching code.
#
# Format:
#   ---
#   species: <name>
#   formula: <formula>
#   description: <one-line tag>
#   ---
#
#   ## blurb
#   <reference-card description, always shown>
#
#   ## variant: <name>
#   <conditional prose; {key} placeholders interpolated from context dict>
#
# Phase 1 (this commit, 2026-04-30): chalcopyrite proof-of-concept.
# Phase 2 (deferred): the remaining 88 species, migrated as the design
# proves out per
# proposals/TASK-BRIEF-NARRATIVE-READABILITY.md (boss expansion).

import re as _re_narratives

_NARRATIVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              "narratives")
_NARRATIVE_CACHE: Dict[str, Dict[str, str]] = {}


def _load_narrative(species: str) -> Dict[str, str]:
    """Parse narratives/<species>.md into {section_name: text}.

    Sections: 'blurb' for the always-shown reference card, 'variant: <name>'
    for conditional blocks. Frontmatter (the --- block at top) is ignored
    by the runtime — it's metadata for human authors.
    """
    if species in _NARRATIVE_CACHE:
        return _NARRATIVE_CACHE[species]
    path = os.path.join(_NARRATIVE_DIR, f"{species}.md")
    if not os.path.exists(path):
        _NARRATIVE_CACHE[species] = {}
        return _NARRATIVE_CACHE[species]
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if text.startswith("---"):
        end_idx = text.find("\n---\n", 4)
        if end_idx > 0:
            text = text[end_idx + 5:]
    sections: Dict[str, str] = {}
    for chunk in _re_narratives.split(r"\n## ", "\n" + text):
        chunk = chunk.strip()
        if not chunk:
            continue
        first_line, _, body = chunk.partition("\n")
        sections[first_line.strip()] = body.strip()
    _NARRATIVE_CACHE[species] = sections
    return sections


def _interpolate(template: str, ctx: dict) -> str:
    return _re_narratives.sub(
        r"\{(\w+)\}",
        lambda m: str(ctx.get(m.group(1), m.group(0))),
        template,
    )


def narrative_blurb(species: str, **ctx) -> str:
    """Return the always-shown reference-card prose for a species.

    Boss-design schema (2026-04-30): blurb may contain {key} placeholders
    (e.g. boss's adamite uses `Adamite #{crystal_id} —` as the opening).
    """
    template = _load_narrative(species).get("blurb", "")
    if not template:
        return ""
    return _interpolate(template, ctx)


def narrative_closing(species: str, **ctx) -> str:
    """Return the always-emitted closing/tail section for a species.

    Boss-design schema (2026-04-30): `## closing` is a structural sibling
    to `## blurb` — both always emit, blurb at the start, closing at the
    end. Used by adamite + feldspar (2026-04-30 push).
    """
    template = _load_narrative(species).get("closing", "")
    if not template:
        return ""
    return _interpolate(template, ctx)


def narrative_variant(species: str, variant: str, **ctx) -> str:
    """Return a variant block with {key} placeholders interpolated.

    Returns empty string if the variant is not declared (caller should
    treat empty as 'skip this paragraph'). Missing context keys leave the
    {key} placeholder in the output as a visible spec-bug signal.
    """
    template = _load_narrative(species).get(f"variant: {variant}")
    if not template:
        return ""
    return _re_narratives.sub(
        r"\{(\w+)\}",
        lambda m: str(ctx.get(m.group(1), m.group(0))),
        template,
    )


def max_size_cm(mineral: str) -> float:
    """Hard cap on crystal size (2x world record). The fix for the 321,248% bug."""
    return MINERAL_SPEC[mineral]["max_size_cm"]


def select_habit_variant(mineral: str, sigma: float, temperature: float,
                         space_constrained: bool = False) -> Optional[dict]:
    """Pick a habit variant for a nucleating crystal based on current conditions.

    Reads habit_variants from data/minerals.json. Scores each variant by:
      - trigger keywords ("low σ" / "moderate σ" / "high σ" / "very high σ",
        and likewise for T) against the actual σ and T;
      - vector preference vs. available wall space (projecting habits
        penalized when the vug is crowded; coating habits favored).

    The top-scoring variant wins, with a tie-breaking weighted random so
    two habits that both look plausible don't always produce the same
    outcome. Returns the variant dict, or None if the mineral has no
    variants declared.
    """
    variants = MINERAL_SPEC.get(mineral, {}).get("habit_variants", [])
    variants = [v for v in variants if isinstance(v, dict)]
    if not variants:
        return None

    def score(v: dict) -> float:
        trig = (v.get("trigger") or "").lower()
        s = 1.0
        # Supersaturation bands. The spec uses "σ" so we match on unicode.
        if "very high σ" in trig:
            s += 2.0 if sigma > 4.0 else -1.5
        elif "high σ" in trig:
            s += 1.5 if sigma > 3.0 else -1.0
        elif "moderate-high σ" in trig or "moderate σ" in trig:
            s += 1.5 if 1.5 <= sigma <= 3.5 else -0.5
        elif "low-moderate σ" in trig:
            s += 1.2 if 1.0 <= sigma <= 2.2 else -0.4
        elif "low σ" in trig:
            s += 1.2 if sigma < 2.0 else -0.8

        # Temperature bands.
        if "high T" in trig:
            s += 1.0 if temperature > 300 else -0.6
        elif "moderate T" in trig:
            s += 1.0 if 150 <= temperature <= 300 else -0.4
        elif "low T" in trig:
            s += 1.0 if temperature < 150 else -0.6

        # Space-vs-vector preference. When the vug is crowded, projecting
        # habits have nowhere to go; coating habits read as wall deposits.
        vec = (v.get("vector") or "").lower()
        if space_constrained:
            if vec == "projecting":
                s -= 0.8
            elif vec == "coating":
                s += 0.6
            elif vec == "tabular":
                s += 0.3  # tabulars lay flat against the wall

        # "default" triggers are the baseline for the mineral — pick them
        # when nothing else matches well.
        if trig.startswith("default"):
            s += 0.3

        return max(s, 0.05)  # avoid hard-zero so weighted draw always works

    scored = [(v, score(v)) for v in variants]
    # Weighted random over score^2 to favor strong matches but keep variety.
    weights = [w * w for _, w in scored]
    total = sum(weights)
    if total <= 0:
        return variants[0]
    r = random.random() * total
    acc = 0.0
    for (v, _), w in zip(scored, weights):
        acc += w
        if r <= acc:
            return v
    return scored[-1][0]


# ============================================================
# PHYSICAL CONSTANTS AND MODELS
# ============================================================

@dataclass
class FluidChemistry:
    """Hydrothermal fluid composition."""
    SiO2: float = 500.0       # ppm — silica concentration
    Ca: float = 200.0          # ppm — calcium
    CO3: float = 150.0         # ppm — carbonate
    F: float = 10.0            # ppm — fluorine
    Zn: float = 0.0            # ppm — zinc
    S: float = 0.0             # ppm — sulfur
    Fe: float = 5.0            # ppm — iron (trace in quartz, major in sphalerite)
    Mn: float = 2.0            # ppm — manganese (fluorescence activator)
    Al: float = 3.0            # ppm — aluminum (smoky quartz)
    Ti: float = 0.5            # ppm — titanium (TitaniQ geothermometer)
    Pb: float = 0.0            # ppm — lead (galena, cerussite, pyromorphite, wulfenite)
    Cu: float = 0.0            # ppm — copper (chalcopyrite, malachite, azurite, chrysocolla)
    Mo: float = 0.0            # ppm — molybdenum (molybdenite, wulfenite)
    U: float = 0.0             # ppm — uranium (uraninite, autunite, torbernite)
    Na: float = 0.0            # ppm — sodium (albite, halite, natrolite)
    K: float = 0.0             # ppm — potassium (orthoclase, microcline, muscovite, adularia)
    Mg: float = 0.0            # ppm — magnesium (dolomite, olivine, serpentine, chlorite)
    Ba: float = 0.0            # ppm — barium (barite, witherite)
    Sr: float = 0.0            # ppm — strontium (celestine, strontianite)
    Cr: float = 0.0            # ppm — chromium (ruby color, uvarovite, kämmererite, chrome diopside)
    P: float = 0.0             # ppm — phosphorus (apatite, pyromorphite, vivianite, turquoise)
    As: float = 0.0            # ppm — arsenic (arsenopyrite, realgar, orpiment, adamite, mimetite)
    Cl: float = 0.0            # ppm — chlorine (halite, pyromorphite, vanadinite, chlorargyrite)
    V: float = 0.0             # ppm — vanadium (vanadinite, cavansite, roscoelite)
    W: float = 0.0             # ppm — tungsten (scheelite, wolframite, ferberite)
    Ag: float = 0.0            # ppm — silver (native silver, acanthite, chlorargyrite, proustite)
    Bi: float = 0.0            # ppm — bismuth (native bismuth, bismuthinite, bismutite)
    Sb: float = 0.0            # ppm — antimony (stibnite, valentinite, kermesite)
    Ni: float = 0.0            # ppm — nickel (millerite, annabergite, garnierite)
    Co: float = 0.0            # ppm — cobalt (cobaltite, erythrite, spherocobaltite)
    B: float = 0.0             # ppm — boron (tourmaline, ulexite, colemanite)
    Li: float = 0.0            # ppm — lithium (spodumene/kunzite, lepidolite, elbaite)
    Be: float = 0.0            # ppm — beryllium (beryl/emerald/aquamarine/morganite, chrysoberyl)
    Te: float = 0.0            # ppm — tellurium (calaverite, sylvanite — Au-Te tellurides)
    Se: float = 0.0            # ppm — selenium (clausthalite, naumannite — often with Ag)
    Ge: float = 0.0            # ppm — germanium (renierite — Tsumeb speciality, Zn sphalerite trace)
    Au: float = 0.0            # ppm — gold (native gold; Bingham/Bisbee porphyry-Cu-Au; eventually calaverite/sylvanite when Te-Au coupling lands)
    O2: float = 0.0            # relative oxygen fugacity (0=reducing, 1=neutral, 2=oxidizing)
    pH: float = 6.5
    salinity: float = 5.0      # wt% NaCl equivalent

    def describe(self) -> str:
        """Human-readable fluid description."""
        parts = []
        if self.SiO2 > 300:
            parts.append(f"silica-rich ({self.SiO2:.0f} ppm SiO₂)")
        if self.Ca > 100:
            parts.append(f"Ca²⁺ {self.Ca:.0f} ppm")
        if self.Fe > 20:
            parts.append(f"Fe-bearing ({self.Fe:.0f} ppm)")
        if self.Mn > 5:
            parts.append(f"Mn-bearing ({self.Mn:.0f} ppm)")
        if self.Zn > 50:
            parts.append(f"Zn-rich ({self.Zn:.0f} ppm)")
        if self.S > 50:
            parts.append(f"sulfur-bearing ({self.S:.0f} ppm)")
        if self.Cu > 20:
            parts.append(f"Cu-bearing ({self.Cu:.0f} ppm)")
        if self.F > 20:
            parts.append(f"fluorine-rich ({self.F:.0f} ppm)")
        if self.O2 > 1.0:
            parts.append("oxidizing")
        elif self.O2 < 0.3 and (self.S > 20 or self.Fe > 20):
            parts.append("reducing")
        if self.pH < 5:
            parts.append(f"acidic (pH {self.pH:.1f})")
        elif self.pH > 8:
            parts.append(f"alkaline (pH {self.pH:.1f})")
        return ", ".join(parts) if parts else "dilute"


@dataclass
class VugWall:
    """Reactive carbonate wall of the vug.

    In real MVT systems, the vug wall IS the host limestone/dolomite.
    Acid dissolves it, releasing Ca²⁺ and CO₃²⁻, neutralizing pH,
    and enlarging the cavity. The dissolved carbonate can then
    reprecipitate on existing crystals during the pH recovery —
    creating rapid growth bursts.
    """
    composition: str = "limestone"    # "limestone" or "dolomite"
    thickness_mm: float = 500.0       # wall thickness (effectively infinite for our purposes)
    vug_diameter_mm: float = 50.0     # initial cavity diameter
    total_dissolved_mm: float = 0.0   # cumulative wall dissolution

    # Trace elements in the host rock (released during dissolution)
    wall_Fe_ppm: float = 2000.0       # iron in the limestone/dolomite
    wall_Mn_ppm: float = 500.0        # manganese in host rock
    wall_Mg_ppm: float = 1000.0       # magnesium (higher if dolomite)

    # Provenance tracking — how much Ca in the fluid came from the wall?
    ca_from_wall_total: float = 0.0   # cumulative Ca²⁺ released from wall dissolution

    # Phase-1 naturalistic void shape (visual only — growth engines still
    # read mean_diameter_mm). Two-stage bubble-merge model:
    #   Stage 1 — primary void: a few large bubbles (radii 40–70% of
    #     vug_diameter_mm) forming the main cavity. Guaranteed to
    #     contain the sampling origin.
    #   Stage 2 — secondary dissolution: smaller bubbles (radii 10–30%
    #     of vug_diameter_mm) spawned ON the outer edge of the primary
    #     union — models percolating fluids eating satellite alcoves
    #     from the cavity wall.
    # See WallState._build_profile() for the geometry.
    #   primary_bubbles: number of stage-1 bubbles (>= 1; 2–5 typical).
    #   secondary_bubbles: number of stage-2 bubbles (>= 0; 3–10 typical).
    #   shape_seed: deterministic seed for bubble positions / radii.
    primary_bubbles: int = 3
    secondary_bubbles: int = 6
    shape_seed: int = 0

    # Player-tunable wall reactivity multiplier (Creative mode slider).
    # Scales the acid-driven dissolution rate and gates a small water-
    # only dissolution path:
    #   0.0  → totally inert (no dissolution even with strong acid)
    #   0.5  → sluggish, dolomite-like (acid takes ~2× longer to enlarge the cavity)
    #   1.0  → DEFAULT, current limestone behavior used by all scenarios
    #   1.5  → reactive limestone (fast acid attack + mild water dissolution)
    #   2.0  → fresh / high-surface-area limestone (max acid + meaningful water dissolution)
    # Only affects carbonate walls (limestone, dolomite); silicate
    # composition still returns {"dissolved": False} regardless of
    # reactivity, because real silicate dissolution at sim T-P-time
    # scales is geologically negligible.
    reactivity: float = 1.0

    def dissolve(self, acid_strength: float, fluid: 'FluidChemistry') -> dict:
        """Dissolve wall rock in response to acid AND (high-reactivity) water.

        CaCO₃ + 2H⁺ → Ca²⁺ + H₂O + CO₂  (acid path)
        CaCO₃ + H₂CO₃ → Ca²⁺ + 2HCO₃⁻   (water path — slow, reactivity-gated)

        Only reactive carbonate walls (limestone, dolomite) buffer this
        way. Silicate host rocks (pegmatite, granite, gneiss, quartzite,
        phyllite) are effectively inert on sim timescales — they don't
        dissolve in mildly acidic hydrothermal fluids, don't release
        cations at a useful rate, and don't buffer pH. Return
        {"dissolved": False} for those so pH can actually drop and
        mineral kaolinization can proceed on the pocket's crystals.

        Two contributions to the per-step dissolution rate:
          • acid_rate = acid_strength × 0.5 × reactivity
          • water_rate = max(0, reactivity − 1.0) × 0.05
        Sum is capped at 2.0 mm/step.

        Returns dict of what happened.
        """
        # Gate by composition first — silicate walls are inert.
        if self.composition not in ("limestone", "dolomite"):
            return {"dissolved": False}

        # Acid attack — scales with how far below the carbonate-attack
        # threshold pH we are, multiplied by the wall's reactivity.
        acid_rate = max(0.0, acid_strength) * 0.5 * self.reactivity

        # Water-only baseline — fires regardless of pH but is slow.
        # Only meaningful when reactivity is set above default (real
        # carbonate dissolution by mildly aggressive groundwater happens
        # over Ma timescales; the slider lets Creative mode players
        # accelerate that to compressed sim-step time).
        water_rate = max(0.0, self.reactivity - 1.0) * 0.05

        rate_mm = min(acid_rate + water_rate, 2.0)
        if rate_mm <= 0.0:
            return {"dissolved": False}

        if self.thickness_mm < rate_mm:
            rate_mm = self.thickness_mm  # can't dissolve more than exists
        
        self.thickness_mm -= rate_mm
        self.total_dissolved_mm += rate_mm
        self.vug_diameter_mm += rate_mm * 2  # expands both sides
        
        # Released chemistry — proportional to volume dissolved
        # 1mm of limestone wall = significant Ca and CO3 release
        ca_released = rate_mm * 15.0      # ppm contribution to fluid
        co3_released = rate_mm * 12.0     # slightly less (some escapes as CO2 gas)
        fe_released = rate_mm * (self.wall_Fe_ppm / 1000.0) * 0.5
        mn_released = rate_mm * (self.wall_Mn_ppm / 1000.0) * 0.5
        
        # pH neutralization — the wall IS the buffer
        # Each mm of dissolution neutralizes significant acid
        ph_recovery = rate_mm * 0.8
        
        # Apply to fluid
        fluid.Ca += ca_released
        fluid.CO3 += co3_released
        fluid.Fe += fe_released
        fluid.Mn += mn_released
        fluid.pH += ph_recovery
        fluid.pH = min(fluid.pH, 8.5)  # can't go above carbonate buffered equilibrium
        
        # Track provenance
        self.ca_from_wall_total += ca_released
        
        return {
            "dissolved": True,
            "rate_mm": rate_mm,
            "ca_released": ca_released,
            "co3_released": co3_released,
            "fe_released": fe_released,
            "mn_released": mn_released,
            "ph_before": fluid.pH - ph_recovery,
            "ph_after": fluid.pH,
            "vug_diameter": self.vug_diameter_mm,
            "total_dissolved": self.total_dissolved_mm,
        }


@dataclass
class WallCell:
    """One cell of the topo-map wall state. Every (ring, cell) pair has
    one — the topo renderer walks the cells in order and draws a line
    whose color and thickness come from the crystal occupying that cell.

    `base_radius_mm` is the pre-run irregular-profile baseline (Phase 1
    naturalistic void shape). Dissolution `wall_depth` then adds on top
    of it, so a cell's current outer radius is `base_radius_mm + wall_depth`.
    Backward-compatible: when left at 0, the renderer substitutes the
    parent WallState's `initial_radius_mm` — old snapshots stay round."""
    wall_depth: float = 0.0            # dissolution depth, mm (negative = eroded)
    crystal_id: Optional[int] = None   # id of the crystal occupying this cell
    mineral: Optional[str] = None      # mineral name for class_color lookup
    thickness_um: float = 0.0          # crystal thickness at this cell, µm
    base_radius_mm: float = 0.0        # Phase-1 Fourier profile baseline, mm


@dataclass
class WallState:
    """Topographic map of the vug interior, rendered as an irregular
    circle viewed from above.

    The data model is 2D: rings × cells. The wall surface is sliced
    vertically into `ring_count` parallel rings stacked along the cavity
    axis (Phase 1 of PROPOSAL-3D-SIMULATION). Each cell is a wedge of
    angular arc, with its own `wall_depth` — how much acid has pushed
    that chunk of wall outward.

    Phase 1 (data shape only): all rings share the same
    `base_radius_mm` profile, and engine writes (paint_crystal,
    erode_cells) still target ring[0]. Rings 1..N-1 hold pristine
    WallCell defaults at every step. Forward-simulation results are
    therefore identical to single-ring runs; only the data shape is
    new. Per-ring chemistry and orientation tags arrive in Phases 2-3.

    Dissolution is per-cell: cells covered by an acid-resistant crystal
    shield their wall slice, so dissolution pushes unblocked cells
    outward more aggressively (total acid budget conserved) and the
    wall ends up shaped like the deposit history rather than a perfect
    circle.

    Phase 1 adds a naturalistic void shape on top: a two-stage
    bubble-merge profile built deterministically from `primary_bubbles`
    + `secondary_bubbles` + `shape_seed` bakes a per-cell
    `base_radius_mm` at init. Stage 1 is the main cavity (few large
    bubbles); stage 2 is satellite alcoves dug from the cavity's outer
    surface. Crystal growth mechanics still read `mean_diameter_mm`
    (visual-only change for Phase 1).
    """
    cells_per_ring: int = 120
    # Phase 1 of PROPOSAL-3D-SIMULATION: 16 vertically-stacked rings as
    # the new default. Engine still operates on ring[0] only — rings 1..15
    # hold pristine WallCell defaults so forward-simulation byte-equality
    # is preserved. Phase 2 (per-ring chemistry) is what makes them differ.
    ring_count: int = 16
    vug_diameter_mm: float = 50.0
    initial_radius_mm: float = 25.0
    ring_spacing_mm: float = 1.0
    # Monotonic scale reference for the renderer. Seeded generously
    # (2× initial radius) so moderate dissolution doesn't shrink the
    # rendered view, and only grows — never snaps back.
    max_seen_radius_mm: float = 0.0
    rings: List[List[WallCell]] = field(default_factory=list)

    # Phase-1 two-stage bubble-merge parameters (see VugWall docstring).
    primary_bubbles: int = 3
    secondary_bubbles: int = 6
    shape_seed: int = 0
    # Populated by _build_profile() — the list of (cx, cy, r) circles
    # in mm whose union is the void, primaries followed by secondaries.
    # Exposed so the renderer (and a future Phase-2 3D slice view) can
    # reconstruct the analytic shape without re-seeding RNG. Already
    # rescaled to match the nominal mean radius.
    bubbles: List[Tuple[float, float, float]] = field(default_factory=list)

    def __post_init__(self):
        if self.initial_radius_mm <= 0:
            self.initial_radius_mm = self.vug_diameter_mm / 2.0
        if not self.rings:
            self.rings = [
                [WallCell() for _ in range(self.cells_per_ring)]
                for _ in range(self.ring_count)
            ]
        # Compute per-cell base_radius_mm deterministically from the
        # shape params. Must run before max_seen_radius_mm is seeded so
        # it can include the largest bulge.
        self._build_profile()
        if self.max_seen_radius_mm <= 0:
            max_base = self.initial_radius_mm
            for ring in self.rings:
                for c in ring:
                    if c.base_radius_mm > max_base:
                        max_base = c.base_radius_mm
            self.max_seen_radius_mm = max_base * 2.0

    # --- Phase 1: two-stage bubble-merge profile --------------------------
    # Bubble size ranges as fractions of vug_diameter_mm. Chosen to
    # match the two-stage dissolution brief: primaries are big enough
    # that a couple of them fill the main cavity, secondaries small
    # enough to read as satellite alcoves on the cavity wall.
    _PRIMARY_SIZE_RANGE = (0.4, 0.7)
    _SECONDARY_SIZE_RANGE = (0.1, 0.3)
    # Primary cluster tightness — secondary bubble centres beyond
    # bubble 0 are placed within this fraction of R of the origin so
    # primaries consistently overlap into one cohesive cavity.
    _PRIMARY_SPREAD = 0.3

    @staticmethod
    def _raycast_union(bubbles: List[Tuple[float, float, float]],
                       theta: float) -> float:
        """Return the outer wall distance from origin at angle `theta`
        through the bubble-union, honouring origin-connectivity.

        Ray-circle intersection per bubble → [(t_enter, t_exit), …]
        clipped to t ≥ 0; sort by t_enter; merge overlapping intervals
        starting from the first; return the endpoint of the first
        merged segment (disconnected-from-origin segments don't count).
        """
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        intervals: List[Tuple[float, float]] = []
        for (cx, cy, r) in bubbles:
            b = cx * cos_t + cy * sin_t
            c = cx * cx + cy * cy - r * r
            disc = b * b - c
            if disc < 0:
                continue
            rt = math.sqrt(disc)
            t_exit = b + rt
            if t_exit <= 0.0:
                continue
            intervals.append((max(0.0, b - rt), t_exit))
        if not intervals:
            return 0.0
        intervals.sort(key=lambda iv: iv[0])
        wall = intervals[0][1]
        for (start, end) in intervals[1:]:
            if start <= wall:
                if end > wall:
                    wall = end
            else:
                break
        return wall

    def _build_profile(self) -> None:
        """Compute per-cell base_radius_mm via two-stage bubble merging.

        Stage 1 — primary void: a few large bubbles (radii 40–70% of
        vug_diameter_mm) clustered near origin, forming the main cavity.
        Bubble 0 is anchored at origin so every ray starts inside the
        union regardless of the random seeds.

        Stage 2 — secondary dissolution: smaller bubbles (radii 10–30%
        of vug_diameter_mm) spawned on the primary union's outer edge
        at random angles. Half of each secondary extends beyond the
        primary boundary (the alcove), the inner half overlaps
        harmlessly back into the primary.

        After both stages, the per-cell profile is sampled by raycasting
        the full union at each of cells_per_ring angles, then rescaled
        so the mean wall radius equals initial_radius_mm. That keeps
        mean_diameter_mm correct for the growth engines.

        Backward compatible: primary_bubbles=1, secondary_bubbles=0
        rescales to a perfect circle.
        """
        import random as _random
        rng = _random.Random(int(self.shape_seed) & 0xFFFFFFFF)

        R = float(self.initial_radius_mm)
        D = 2.0 * R  # vug_diameter_mm, the canonical unit the brief uses
        p_lo, p_hi = self._PRIMARY_SIZE_RANGE
        s_lo, s_hi = self._SECONDARY_SIZE_RANGE

        # ---- Stage 1: primary void -------------------------------------
        # Primary 0 always at origin, mid-size. Anchors the main cavity
        # and guarantees origin coverage no matter what seed lands.
        r0 = D * (p_lo + p_hi) * 0.5
        primaries: List[Tuple[float, float, float]] = [(0.0, 0.0, r0)]
        for _ in range(max(0, int(self.primary_bubbles) - 1)):
            # Clustered near origin — primaries need to overlap each
            # other to read as one cavity, not multiple.
            d = self._PRIMARY_SPREAD * R * rng.random()
            phi = rng.random() * 2.0 * math.pi
            cx = d * math.cos(phi)
            cy = d * math.sin(phi)
            r = D * rng.uniform(p_lo, p_hi)
            primaries.append((cx, cy, r))

        # ---- Stage 2: secondary dissolution ----------------------------
        # Each secondary spawns ON the primary union's outer edge at a
        # random angle. The raycast returns the radial wall distance
        # through the primary union at that angle; the secondary centre
        # is placed at that point so half of the bubble extends into the
        # wall (the alcove) and half overlaps back into the primary.
        secondaries: List[Tuple[float, float, float]] = []
        for _ in range(max(0, int(self.secondary_bubbles))):
            theta = rng.random() * 2.0 * math.pi
            r_prim = self._raycast_union(primaries, theta)
            if r_prim <= 0:
                continue   # primary raycast failed at this angle — skip
            cx = r_prim * math.cos(theta)
            cy = r_prim * math.sin(theta)
            r = D * rng.uniform(s_lo, s_hi)
            secondaries.append((cx, cy, r))

        bubbles = primaries + secondaries

        # ---- Sample the full union at cell angles ----------------------
        N = self.cells_per_ring
        raw_radii: List[float] = [
            self._raycast_union(bubbles, 2.0 * math.pi * i / N) or R
            for i in range(N)
        ]

        # ---- Rescale to nominal mean -----------------------------------
        mean_raw = sum(raw_radii) / max(len(raw_radii), 1)
        scale = R / mean_raw if mean_raw > 1e-6 else 1.0
        self.bubbles = [(cx * scale, cy * scale, r * scale) for (cx, cy, r) in bubbles]
        for ring in self.rings:
            for j, cell in enumerate(ring):
                cell.base_radius_mm = raw_radii[j] * scale

    # ----------------------------------------------------------------------

    @property
    def cell_arc_mm(self) -> float:
        """Wall arc length represented by one cell, in millimeters.
        Uses mean current radius (including per-cell base + depth) so
        the arc metric tracks both the irregular profile and dissolution."""
        ring0 = self.rings[0] if self.rings else []
        if ring0:
            mean_r = sum(c.base_radius_mm + c.wall_depth for c in ring0) / len(ring0)
        else:
            mean_r = self.initial_radius_mm
        return 2.0 * math.pi * mean_r / max(self.cells_per_ring, 1)

    def cell_radius_mm(self, cell_idx: int) -> float:
        """Outer radius of a specific ring-0 cell, including dissolution."""
        cell = self.rings[0][cell_idx % self.cells_per_ring]
        return cell.base_radius_mm + cell.wall_depth

    def mean_diameter_mm(self) -> float:
        """Effective vug diameter, averaged across all cells."""
        ring0 = self.rings[0]
        if not ring0:
            return self.vug_diameter_mm
        mean_r = sum(c.base_radius_mm + c.wall_depth for c in ring0) / len(ring0)
        return 2.0 * mean_r

    def update_diameter(self, new_diameter_mm: float) -> None:
        """Keep the nominal diameter in sync with the host sim's global
        measure. Per-cell `wall_depth` is the authoritative shape."""
        self.vug_diameter_mm = new_diameter_mm

    def ring_index_for_height_mm(self, height_mm: float) -> int:
        """Map a vertical position (mm above the floor) to a ring index.

        Floor (height = 0) → ring 0; ceiling (height = ring_count *
        ring_spacing_mm) → ring_count - 1. Out-of-range heights clamp
        to the nearest valid ring. Used by Phase 2+ for per-ring
        chemistry seeding and Phase 3 orientation tagging; safe to
        call in Phase 1 (just returns 0 for any height when
        ring_count == 1)."""
        if self.ring_count <= 1:
            return 0
        spacing = self.ring_spacing_mm if self.ring_spacing_mm > 0 else 1.0
        idx = int(height_mm / spacing)
        if idx < 0:
            return 0
        if idx >= self.ring_count:
            return self.ring_count - 1
        return idx

    def erode_cells(self, rate_mm: float, blocked: set) -> int:
        """Distribute a radial dissolution amount across unblocked cells.

        `rate_mm` is the average radial depth dissolved (what
        VugWall.dissolve() reports). Blocked cells contribute zero, so
        the acid budget concentrates on unblocked cells — physically,
        the fluid still attacks the same total wall area, just focused
        where nothing's in the way.

        Returns the number of cells eroded (useful for logging)."""
        if rate_mm <= 0:
            return 0
        ring0 = self.rings[0]
        N = len(ring0)
        unblocked = [i for i in range(N) if i not in blocked]
        if not unblocked:
            return 0
        # Conservation: total acid attack is rate_mm × N, spread over
        # unblocked cells only.
        per_cell = rate_mm * N / len(unblocked)
        for i in unblocked:
            ring0[i].wall_depth += per_cell
        # Bump the monotonic render scale if any cell just passed the
        # running max. Uses per-cell base_radius_mm so bulges in the
        # Fourier profile contribute correctly.
        for c in ring0:
            r = c.base_radius_mm + c.wall_depth
            if r > self.max_seen_radius_mm:
                self.max_seen_radius_mm = r
        return len(unblocked)

    def clear(self) -> None:
        """Reset per-step occupancy before repainting all crystals.
        Wall depth is cumulative — don't reset it."""
        for ring in self.rings:
            for cell in ring:
                cell.crystal_id = None
                cell.mineral = None
                cell.thickness_um = 0.0

    def paint_crystal(self, crystal: 'Crystal') -> None:
        """Mark the cells this crystal occupies with its id / mineral /
        thickness. Called after growth each step. Phase C v1: paints
        on the crystal's own ring (`crystal.wall_ring_index`) so
        crystals scatter across the sphere wall. Legacy crystals
        (None ring index) fall through to ring 0.

        Footprint math: wall_spread × total_growth gives the raw arc,
        but the spec's spread values (0.2–0.9) describe the fraction of
        the crystal's base that hugs the wall, so the actual arc a
        coating habit sweeps needs a multiplier. FOOTPRINT_SCALE = 4.0
        puts a 5mm coating (0.8) at ~16mm of arc and a 5mm prismatic
        (0.2) at ~4mm. Anchor cells are painted even at zero thickness
        so fresh nucleations shield their slice of wall immediately.
        """
        if crystal.wall_center_cell is None:
            return
        ring_idx = crystal.wall_ring_index
        if ring_idx is None or ring_idx < 0 or ring_idx >= self.ring_count:
            ring_idx = 0
        FOOTPRINT_SCALE = 4.0
        arc_mm = ((crystal.total_growth_um / 1000.0)
                  * max(crystal.wall_spread, 0.05)
                  * FOOTPRINT_SCALE)
        half_cells = max(1, int(round(arc_mm / self.cell_arc_mm / 2.0)))
        thickness = max(crystal.total_growth_um, 1.0)  # nucleated = visible
        ring = self.rings[ring_idx]
        N = self.cells_per_ring
        for offset in range(-half_cells, half_cells + 1):
            idx = (crystal.wall_center_cell + offset) % N
            cell = ring[idx]
            if cell.thickness_um < thickness:
                cell.crystal_id = crystal.crystal_id
                cell.mineral = crystal.mineral
                cell.thickness_um = thickness


@dataclass
class VugConditions:
    """Current physical/chemical conditions in the vug."""
    temperature: float = 350.0    # °C
    pressure: float = 1.5         # kbar
    fluid: FluidChemistry = field(default_factory=FluidChemistry)
    flow_rate: float = 1.0        # relative (0 = stagnant, 1 = normal, 5 = flood)
    wall: VugWall = field(default_factory=VugWall)  # reactive wall

    # Fluid-level cycle tracking for the Kim 2023 dolomite mechanism.
    # Per-crystal tracking via phantom_count would work in principle but
    # dolomite seeds get enclosed by other carbonates faster than they
    # accumulate cycles. Tracking at the fluid level captures the
    # geological insight ("this environment has been cycling") and
    # propagates ordering credit to ALL active dolomites.
    _dol_cycle_count: int = 0
    _dol_prev_sigma: float = 0.0
    _dol_in_undersat: bool = False

    def update_dol_cycles(self) -> None:
        """Track dolomite saturation crossings — call once per step.

        Counts full undersaturation→supersaturation cycles. Each completed
        cycle ratchets up the f_ord ordering fraction used in grow_dolomite.
        """
        sigma = self.supersaturation_dolomite()
        prev = self._dol_prev_sigma
        if prev > 0.0:  # skip the first call where prev is unset
            if prev >= 1.0 and sigma < 1.0:
                self._dol_in_undersat = True
            elif prev < 1.0 and sigma >= 1.0 and self._dol_in_undersat:
                self._dol_cycle_count += 1
                self._dol_in_undersat = False
        self._dol_prev_sigma = sigma

    @property
    def effective_temperature(self) -> float:
        """Mo-flux thermal modifier. Ports JS's get effectiveTemperature() —
        v17 reconciliation (May 2026, per supersat drift audit).

        Mo flux effect: when Mo > 20 ppm, high-T minerals nucleate as if
        T were up to 15% higher. MoO₃ is a classic flux for growing
        corundum at lower temperatures; here it broadens what can grow
        in porphyry sulfide systems (chalcopyrite, galena, pyrite,
        molybdenite, quartz). Pre-v17 only the JS runtime had this
        effect — Python's same-fluid sigmas were lower in Mo-rich
        scenarios.
        """
        if self.fluid.Mo > 20:
            boost = 1.0 + 0.15 * min((self.fluid.Mo - 20) / 40, 1.0)
            return self.temperature * boost
        return self.temperature

    # SiO₂ solubility table (ppm) — Fournier & Potter 1982 / Rimstidt 1997.
    # Quartz solubility is PROGRADE: increases with T. Quartz precipitates
    # when silica-rich hot fluid cools.
    _SIO2_SOLUBILITY = [
        (25, 6), (50, 15), (75, 30), (100, 60), (125, 90), (150, 130),
        (175, 200), (200, 300), (225, 390), (250, 500), (275, 600),
        (300, 700), (325, 850), (350, 1000), (375, 1100), (400, 1200),
        (450, 1400), (500, 1500), (600, 1600),
    ]

    def silica_equilibrium(self, T: float) -> float:
        """SiO₂ solubility at given T, linearly interpolated from the
        Fournier & Potter 1982 table. v17 ports JS's silica_equilibrium —
        pre-v17 Python quartz used inline `50 * exp(0.008*T)` which
        overshoots the experimental data by ~3x at high T.
        """
        table = self._SIO2_SOLUBILITY
        if T <= table[0][0]:
            return table[0][1]
        if T >= table[-1][0]:
            return table[-1][1]
        for i in range(len(table) - 1):
            t0, s0 = table[i]
            t1, s1 = table[i + 1]
            if t0 <= T <= t1:
                return s0 + (s1 - s0) * (T - t0) / (t1 - t0)
        return table[-1][1]

    def supersaturation_quartz(self) -> float:
        """Calculate quartz supersaturation (simplified).
        
        Based on the solubility curve: SiO2 solubility increases with T.
        At equilibrium, higher T = more SiO2 dissolved.
        Supersaturation occurs when fluid cools below the T where its
        SiO2 concentration would be in equilibrium.

        v17 (May 2026): now uses Fournier & Potter 1982 / Rimstidt 1997
        tabulated solubility via silica_equilibrium(eT), where eT is
        Mo-flux-modified effective_temperature. Pre-v17 Python used
        `50 * exp(0.008*T)` which overshoots the experimental data
        ~3x at high T; JS already used the table-based approach.

        HF ATTACK: Low pH + high fluorine dissolves quartz as SiF4.
        This is real — HF is the only common acid that attacks silicates.
        """
        equilibrium_SiO2 = self.silica_equilibrium(self.effective_temperature)
        if equilibrium_SiO2 <= 0:
            return 0
        sigma = self.fluid.SiO2 / equilibrium_SiO2

        # HF attack on quartz: low pH + high F = dissolution
        if self.fluid.pH < 4.0 and self.fluid.F > 20:
            hf_attack = (4.0 - self.fluid.pH) * (self.fluid.F / 50.0) * 0.3
            sigma -= hf_attack

        return max(sigma, 0)
    
    def supersaturation_calcite(self) -> float:
        """Calcite supersaturation (simplified).

        Calcite has RETROGRADE solubility — less soluble at higher T.
        So heating causes precipitation (opposite of quartz).
        Simplified: solubility ≈ 300 * exp(-0.005 * T)

        pH EFFECT: Acid dissolves carbonates. Below pH ~5, calcite
        dissolves readily. This is how caves form — slightly acidic
        groundwater eats limestone.

        Mg POISONING: Mg²⁺ adsorbs onto calcite's {10ī4} growth steps
        and the dehydration penalty stalls step advancement (Davis et al.
        2000; Nielsen et al. 2013). When Mg/Ca > ~2, calcite nucleation
        gives way to aragonite, which excludes Mg structurally. The
        poisoning factor caps at 85% (some high-Mg calcite always forms
        in marine settings — Folk's HMC).
        """
        equilibrium_Ca = 300.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Ca <= 0:
            return 0
        ca_co3_product = min(self.fluid.Ca, self.fluid.CO3)
        sigma = ca_co3_product / equilibrium_Ca

        # Acid dissolution of carbonates
        if self.fluid.pH < 5.5:
            acid_attack = (5.5 - self.fluid.pH) * 0.5
            sigma -= acid_attack
        # Alkaline conditions favor carbonate precipitation
        elif self.fluid.pH > 7.5:
            sigma *= 1.0 + (self.fluid.pH - 7.5) * 0.15

        # Mg poisoning of calcite growth steps — sigmoid centered on Mg/Ca=2
        mg_ratio = self.fluid.Mg / max(self.fluid.Ca, 0.01)
        mg_inhibition = 1.0 / (1.0 + math.exp(-(mg_ratio - 2.0) / 0.5))
        sigma *= (1.0 - 0.85 * mg_inhibition)

        return max(sigma, 0)

    def supersaturation_dolomite(self) -> float:
        """Dolomite (CaMg(CO₃)₂) — the ordered Ca-Mg double carbonate.

        Trigonal carbonate (R3̄) with alternating Ca and Mg layers — distinct
        from calcite (R3̄c, all Ca). Forms at T > 50°C from fluids carrying
        substantial Mg alongside Ca; surface-T dolomite is rare ('dolomite
        problem' in geology — modern oceans should produce it but don't,
        for kinetic reasons that a vug simulator doesn't try to capture).

        Mg/Ca ratio gate: needs roughly 0.5 < Mg/Ca < 5 (Mg present in
        significant quantity but not so dominant it leaves no Ca). Outside
        that window, calcite (low Mg) or magnesite (no Ca) wins.
        """
        if self.fluid.Mg < 25 or self.fluid.Ca < 30 or self.fluid.CO3 < 20:
            return 0
        # Hard T floor lowered to 10°C (was 50°C) — Kim 2023 shows that
        # ambient-T ordered dolomite is achievable WITH cycling. The
        # f_ord gate in grow_dolomite enforces the kinetics: cool fluids
        # can nucleate but only grow well if they're cycling.
        if self.temperature < 10 or self.temperature > 400:
            return 0
        if self.fluid.pH < 6.5 or self.fluid.pH > 10.0:
            return 0

        # Mg/Ca window — dolomite needs both. Upper gate relaxed to 30
        # because modern sabkha porewaters can reach Mg/Ca 10–25 after
        # aragonite/gypsum precipitation strips Ca preferentially (Hardie
        # 1987; Patterson & Kinsman 1981). The ratio_factor below still
        # heavily penalizes off-1:1 ratios; the gate just permits the
        # high-Mg regime where dolomite still forms in nature.
        mg_ratio = self.fluid.Mg / max(self.fluid.Ca, 0.01)
        if mg_ratio < 0.3 or mg_ratio > 30.0:
            return 0

        # Equilibrium product — both cations matter
        equilibrium = 200.0 * math.exp(-0.005 * self.temperature)
        if equilibrium <= 0:
            return 0
        # Geometric mean of Ca and Mg, capped by CO3 availability
        ca_mg = math.sqrt(self.fluid.Ca * self.fluid.Mg)
        co3_limit = self.fluid.CO3 * 2.0  # dolomite uses 2 CO3 per Ca+Mg
        product = min(ca_mg, co3_limit)
        sigma = product / equilibrium

        # Mg/Ca = 1 is the sweet spot — gentle sigmoid bonus near unity ratio.
        ratio_distance = abs(math.log10(mg_ratio))  # 0 at Mg/Ca=1
        ratio_factor = math.exp(-ratio_distance * 1.0)
        sigma *= ratio_factor

        # T-window now does NOT penalize low T (Kim 2023 — ambient T is
        # thermodynamically fine, the kinetic problem is solved by cycling
        # which f_ord captures separately). High-T penalty preserved.
        if self.temperature > 250:
            sigma *= max(0.3, 1.0 - (self.temperature - 250) / 200.0)

        # Acid dissolution
        if self.fluid.pH < 6.5:
            sigma -= (6.5 - self.fluid.pH) * 0.3

        return max(sigma, 0)

    def supersaturation_siderite(self) -> float:
        """Siderite (FeCO₃) — the iron carbonate, the brown rhomb.

        Trigonal carbonate, calcite-group structure (R3̄c) with Fe²⁺ in the
        Ca site. Forms only in REDUCING conditions — Fe must stay Fe²⁺ to
        be soluble and precipitate as carbonate. Above O₂ ~0.5, Fe oxidizes
        to Fe³⁺ and locks up as goethite/hematite instead.

        Habit signature: curved rhombohedral 'saddle' faces (the {104} faces
        bow, like rhodochrosite's button rhombs). Tan to dark brown with Fe
        content. Sedimentary spherosiderite forms spherulitic concretions in
        coal seams; hydrothermal siderite forms vein crystals.

        Oxidation breakdown is the textbook diagenetic story: siderite →
        goethite → hematite as the system progressively oxidizes. In the
        simulator, rising O₂ dissolves the siderite and releases Fe + CO₃
        for downstream Fe-oxide precipitation.
        """
        if self.fluid.Fe < 10 or self.fluid.CO3 < 20:
            return 0
        if self.temperature < 20 or self.temperature > 300:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 9.0:
            return 0
        # Hard reducing gate — Fe²⁺ must stay reduced
        if self.fluid.O2 > 0.8:
            return 0

        equilibrium_Fe = 80.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Fe <= 0:
            return 0
        fe_co3 = min(self.fluid.Fe, self.fluid.CO3)
        sigma = fe_co3 / equilibrium_Fe

        # Acid dissolution
        if self.fluid.pH < 5.5:
            sigma -= (5.5 - self.fluid.pH) * 0.5
        elif self.fluid.pH > 7.5:
            sigma *= 1.0 + (self.fluid.pH - 7.5) * 0.1

        # Mild oxidation rolloff in 0.3-0.8 O2 window
        if self.fluid.O2 > 0.3:
            sigma *= max(0.2, 1.0 - (self.fluid.O2 - 0.3) * 1.5)

        return max(sigma, 0)

    def supersaturation_rhodochrosite(self) -> float:
        """Rhodochrosite (MnCO₃) — the manganese carbonate, the pink mineral.

        Trigonal carbonate, structurally identical to calcite (R3̄c) but with
        Mn²⁺ replacing Ca²⁺. Forms a continuous solid solution toward calcite
        through the kutnohorite (CaMn carbonate) intermediate, so high-Mn
        carbonates have characteristic banding.

        T range 20-250°C — epithermal vein settings (Capillitas, Sweet Home),
        sedimentary Mn deposits (N'Chwaning), and low-T carbonate replacement.
        Mn²⁺ is stable in moderate-to-reducing conditions; aggressive oxidation
        flips it to Mn³⁺/Mn⁴⁺ → black manganese oxide staining (pyrolusite,
        psilomelane).
        """
        if self.fluid.Mn < 5 or self.fluid.CO3 < 20:
            return 0
        if self.temperature < 20 or self.temperature > 250:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 9.0:
            return 0
        # Mn²⁺ stability — too oxidizing converts it to insoluble Mn oxides
        if self.fluid.O2 > 1.5:
            return 0
        # Same retrograde-style equilibrium as calcite
        equilibrium_Mn = 50.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Mn <= 0:
            return 0
        mn_co3 = min(self.fluid.Mn, self.fluid.CO3)
        sigma = mn_co3 / equilibrium_Mn

        # Acid dissolution
        if self.fluid.pH < 5.5:
            sigma -= (5.5 - self.fluid.pH) * 0.5
        elif self.fluid.pH > 7.5:
            sigma *= 1.0 + (self.fluid.pH - 7.5) * 0.1

        # Mild oxidation penalty — Mn carbonate degrades faster than Ca carbonate
        if self.fluid.O2 > 0.8:
            sigma *= max(0.3, 1.5 - self.fluid.O2)

        return max(sigma, 0)

    def supersaturation_aragonite(self) -> float:
        """Aragonite (CaCO₃, orthorhombic) — the metastable polymorph.

        Same Ca + CO₃ ingredients as calcite, but a different crystal structure
        favored kinetically by four converging factors (Folk 1974; Morse et al.
        1997; Sun et al. 2015):

        1. Mg/Ca ratio (dominant ~70% of signal): Mg poisons calcite growth
           steps but is excluded from aragonite's orthorhombic structure.
           Threshold ~Mg/Ca > 2 molar.
        2. Temperature: aragonite kinetics favored above ~50°C in low-Mg
           waters; in Mg-rich fluid the threshold drops to ~25°C.
        3. Saturation state Ω (Ostwald step rule): high supersaturation
           favors metastable aragonite over thermodynamic calcite.
        4. Trace Sr/Pb/Ba: secondary — these cations match Ca²⁺ in 9-fold
           aragonite coordination but not 6-fold calcite.

        Pressure is the THERMODYNAMIC sorter (aragonite stable above
        ~0.4 GPa) but is irrelevant in vugs and hot springs at <0.5 kbar —
        every natural surface aragonite is metastable. Don't use P as a gate
        unless the scenario is genuinely deep-burial / blueschist.
        """
        if self.fluid.Ca < 30 or self.fluid.CO3 < 20:
            return 0
        if self.fluid.pH < 6.0 or self.fluid.pH > 9.0:
            return 0

        equilibrium_Ca = 300.0 * math.exp(-0.005 * self.temperature)
        if equilibrium_Ca <= 0:
            return 0
        ca_co3 = min(self.fluid.Ca, self.fluid.CO3)
        omega = ca_co3 / equilibrium_Ca

        # Factor 1 (~70%) — Mg/Ca, sigmoid centered Mg/Ca = 1.5
        mg_ratio = self.fluid.Mg / max(self.fluid.Ca, 0.01)
        mg_factor = 1.0 / (1.0 + math.exp(-(mg_ratio - 1.5) / 0.3))

        # Factor 2 (~20%) — T, sigmoid centered 50°C
        T_factor = 1.0 / (1.0 + math.exp(-(self.temperature - 50.0) / 15.0))

        # Factor 3 (~10%) — Ostwald step rule, Ω > ~10 favors aragonite kinetically
        omega_factor = 1.0 / (1.0 + math.exp(-(math.log10(max(omega, 0.01)) - 1.0) / 0.3))

        # Factor 4 (small bonus) — Sr/Pb/Ba trace cation incorporation
        trace_sum = self.fluid.Sr + self.fluid.Pb + self.fluid.Ba
        trace_ratio = trace_sum / max(self.fluid.Ca, 0.01)
        trace_factor = 1.0 + 0.3 / (1.0 + math.exp(-(trace_ratio - 0.01) / 0.005))

        # Weighted SUM (not product) — Mg/Ca dominates; T and Ω each push
        # aragonite over the line in low-Mg regimes. Trace factor multiplies
        # the result. A pure-product would force ALL factors to align, which
        # is wrong: high Mg/Ca alone is enough in nature, regardless of Ω.
        favorability = (0.70 * mg_factor + 0.20 * T_factor + 0.10 * omega_factor) * trace_factor
        return omega * favorability
    
    def supersaturation_fluorite(self) -> float:
        """Fluorite (CaF2) supersaturation. Precipitates when Ca and F meet.
        
        Fluorite has RETROGRADE solubility — less soluble at higher T,
        so it precipitates preferentially as fluid cools from depth.
        Sweet spot: 100-250°C (real hydrothermal fluorite deposits).
        Too cold: slow kinetics. Too hot: limited by fluid composition.
        
        Fluorite dissolves in strong acid: CaF₂ + 2H⁺ → Ca²⁺ + 2HF
        At very high F concentrations, Ca forms fluoro-complexes
        (CaF₃⁻, CaF₄²⁻) which re-dissolve fluorite — this caps runaway growth.
        """
        if self.fluid.Ca < 10 or self.fluid.F < 5:
            return 0
        # v17 reconciliation (May 2026): 5-tier T window per Richardson &
        # Holland 1979 (hydrothermal fluorite solubility) + MVT deposit
        # studies showing 50-152°C formation range. Solubility increases
        # with T below 100°C (kinetically slow precipitation), passes
        # through max around 100-250°C (the MVT sweet spot), declines
        # above 350°C.
        T = self.temperature
        if T < 50:
            T_factor = T / 50.0  # kinetically slow below 50°C
        elif T < 100:
            T_factor = 0.8  # warming up
        elif T <= 250:
            T_factor = 1.2  # sweet spot — MVT range
        elif T <= 350:
            T_factor = 1.0  # still viable
        else:
            T_factor = max(0.1, 1.0 - (T - 350) / 200.0)  # fades above 350°C

        # Product model with JS scaling (Ca/200, F/20)
        product = (self.fluid.Ca / 200.0) * (self.fluid.F / 20.0)
        sigma = product * T_factor

        # Fluoro-complex penalty (Python canonical, kept): at very high F,
        # Ca²⁺ + nF⁻ → CaFₙ complexes re-dissolve fluorite. Real effect
        # documented in Manning 1979 — secondary at T<300°C but real.
        if self.fluid.F > 80:
            complex_penalty = (self.fluid.F - 80) / 200.0
            sigma -= complex_penalty
        
        # Acid attack on fluorite
        if self.fluid.pH < 5.0:
            acid_attack = (5.0 - self.fluid.pH) * 0.4
            sigma -= acid_attack
        return max(sigma, 0)
    
    def supersaturation_sphalerite(self) -> float:
        """Sphalerite (ZnS) supersaturation. Needs Zn + S.

        Sphalerite is the low-T polymorph of ZnS. Above ~95°C, the hexagonal
        dimorph wurtzite is favored. The T factor below the 95°C transition
        favors sphalerite; above it, sigma decays faster so wurtzite wins.
        """
        if self.fluid.Zn < 10 or self.fluid.S < 10:
            return 0
        product = (self.fluid.Zn / 100.0) * (self.fluid.S / 100.0)
        # Below 95°C: full sigma. Above: accelerated decay (wurtzite field).
        if self.temperature <= 95:
            T_factor = 2.0 * math.exp(-0.004 * self.temperature)
        else:
            T_factor = 2.0 * math.exp(-0.01 * self.temperature)
        return product * T_factor

    def supersaturation_wurtzite(self) -> float:
        """Wurtzite ((Zn,Fe)S) — hexagonal dimorph of sphalerite.

        Same (Zn,Fe)S composition as sphalerite, different crystal
        structure. Cubic ABCABC stacking → sphalerite; hexagonal ABABAB
        stacking → wurtzite. The two are end-members of a polytype series
        (the famous Aachen schalenblende banding alternates layers of both).

        Equilibrium phase boundary is 1020°C (Allen & Crenshaw 1912;
        Scott & Barnes 1972) — well above any hydrothermal range. By
        equilibrium thermodynamics alone, sphalerite always wins below
        ~1000°C. But wurtzite forms METASTABLY at lower T under specific
        conditions (Murowchick & Barnes 1986, *Am. Mineralogist*
        71:1196-1208):

        1. Acidic conditions (pH < 4) — H2S/HS- speciation favors
           hexagonal stacking kinetically.
        2. High Zn²⁺ activity — rapid precipitation under high σ
           kinetically traps the hexagonal form.
        3. Fe substitution (>1 mol%) — stabilizes wurtzite over
           sphalerite at low T (Aachen-style 'wurtzite-Fe').

        Round 9c retrofit (Apr 2026): two-branch model. Above 95°C the
        existing equilibrium peak (150-300°C); below 95°C a new
        metastable branch fires only when all three Murowchick & Barnes
        conditions are met. See research/research-broth-ratio-sphalerite-
        wurtzite.md.
        """
        if self.fluid.Zn < 10 or self.fluid.S < 10:
            return 0
        T = self.temperature
        product = (self.fluid.Zn / 100.0) * (self.fluid.S / 100.0)

        if T > 95:
            # Equilibrium high-T branch — peak 150-300°C, decay at extremes.
            if T < 150:
                T_factor = (T - 95) / 55.0  # 0 → 1 across 95-150
            elif T <= 300:
                T_factor = 1.4  # broad peak
            else:
                T_factor = 1.4 * math.exp(-0.005 * (T - 300))
            return product * T_factor

        # Low-T metastable branch (Murowchick & Barnes 1986).
        # All three conditions required — any one alone won't trap the
        # hexagonal form. pH<4 for the speciation; sigma_base>=1 for
        # genuine supersaturation; Fe>=5 for the stabilization.
        if self.fluid.pH >= 4.0:
            return 0
        if product < 1.0:
            return 0
        if self.fluid.Fe < 5:
            return 0
        # Damped relative to the high-T equilibrium peak — wurtzite is
        # the thermodynamically wrong answer here and only forms because
        # kinetics outrun equilibration. 0.4 keeps it less common than
        # sphalerite under the same low-T acidic conditions.
        return product * 0.4
    
    def supersaturation_pyrite(self) -> float:
        """Pyrite (FeS2) supersaturation. Needs Fe + S, reducing conditions.

        Pyrite is the most common sulfide. Forms over huge T range (25-700°C).
        Needs iron AND sulfur AND not too oxidizing.

        Below pH 5, the orthorhombic dimorph marcasite is favored over cubic
        pyrite — same formula, different crystal structure. pH rolloff here
        lets marcasite win that competition without breaking neutral scenarios.
        """
        if self.fluid.Fe < 5 or self.fluid.S < 10:
            return 0
        # Oxidizing conditions destroy sulfides
        if self.fluid.O2 > 1.5:
            return 0
        product = (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        # v17: use effective_temperature (Mo flux widens T window in
        # porphyry sulfide systems).
        eT = self.effective_temperature
        T_factor = 1.0 if 100 < eT < 400 else 0.5
        # pH rolloff below 5 — marcasite takes over
        pH_factor = 1.0
        if self.fluid.pH < 5.0:
            pH_factor = max(0.3, (self.fluid.pH - 3.5) / 1.5)
        return product * T_factor * pH_factor * (1.5 - self.fluid.O2)

    def supersaturation_marcasite(self) -> float:
        """Marcasite (FeS2) — orthorhombic dimorph of pyrite, acid-favored.

        Same composition as pyrite, different crystal structure. Acidic conditions
        (pH < 5) and low temperature (< 240°C) switch the structure from cubic to
        orthorhombic. Metastable — above 240°C, marcasite converts to pyrite.

        The switch is hard: pH ≥ 5 or T > 240°C returns zero. Pyrite handles
        those regimes. Below pH 5, marcasite sigma rises as acidity increases,
        giving it a clean win over pyrite in reactive_wall / supergene fluids.
        """
        if self.fluid.Fe < 5 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        # Hard gates: acid AND low-T regime only
        if self.fluid.pH >= 5.0:
            return 0
        if self.temperature > 240:
            return 0
        product = (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        # Stronger in more acidic fluids — peaks at pH 3
        pH_factor = min(1.4, (5.0 - self.fluid.pH) / 1.2)
        # Low-T preference — marcasite is a surficial/near-surface crystal
        T_factor = 1.2 if self.temperature < 150 else 0.6
        return product * pH_factor * T_factor * (1.5 - self.fluid.O2)
    
    def supersaturation_chalcopyrite(self) -> float:
        """Chalcopyrite (CuFeS2) supersaturation. Needs Cu + Fe + S.

        Main copper ore mineral. Competes with pyrite for Fe and S.

        v13 (May 2026): T window upgraded to 4-tier per Seo et al. 2012
        — main porphyry window 300-500°C, ~90% deposits before 400°C;
        viable but not peak 200-300°C; rare below 180°C; fades above
        500°C. Was previously a flat 1.2/0.6 binary at 150-350°C.
        Brought into line with index.html + agent-api/vugg-agent.js
        which already used this formulation. (Note: JS uses
        effectiveTemperature for Mo-flux modulation; Python uses plain
        temperature — effectiveTemperature is a JS-only feature, filed
        in BACKLOG.)
        """
        if self.fluid.Cu < 10 or self.fluid.Fe < 5 or self.fluid.S < 15:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        product = (self.fluid.Cu / 80.0) * (self.fluid.Fe / 50.0) * (self.fluid.S / 80.0)
        # v17: use effective_temperature for Mo-flux porphyry boost
        T = self.effective_temperature
        if T < 180:
            T_factor = 0.2  # rare at low T
        elif T < 300:
            T_factor = 0.8  # viable, not peak
        elif T <= 500:
            T_factor = 1.3  # sweet spot — porphyry window
        else:
            T_factor = 0.5  # fades above 500°C
        return product * T_factor * (1.5 - self.fluid.O2)
    
    def supersaturation_hematite(self) -> float:
        """Hematite (Fe₂O₃) supersaturation. Needs Fe + oxidizing conditions.
        
        Hematite is the quintessential iron oxide — steel-gray specular plates
        at high T, botryoidal masses at low T, red earthy powder in between.
        Needs OXIDIZING conditions. Won't form under reducing (pyrite wins instead).
        """
        if self.fluid.Fe < 20 or self.fluid.O2 < 0.5:
            return 0
        sigma = (self.fluid.Fe / 100.0) * (self.fluid.O2 / 1.0) * math.exp(-0.002 * self.temperature)
        # Acid penalty — hematite dissolves in strong acid
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)
    
    def supersaturation_malachite(self) -> float:
        """Malachite (Cu₂(CO₃)(OH)₂) supersaturation. Needs Cu + CO₃ + oxidizing.

        The classic green copper carbonate — botryoidal, banded, gorgeous.
        Low-temperature mineral. Forms from oxidation of primary copper sulfides.
        Dissolves easily in acid (fizzes — it's a carbonate).

        Denominators reference realistic supergene weathering fluid
        (Cu ~25 ppm, CO₃ ~100 ppm from dissolved meteoric CO₂). The older
        50/200 values were tuned for Cu-saturated porphyry fluids and
        starved supergene vugs of their flagship copper mineral.

        Malachite-vs-azurite competition is encoded by carbonate-activity
        thresholds (Vink 1986, *Mineralogical Magazine* 50:43-47). Vink's
        univariant boundary sits at log(pCO2) ≈ -3.5 at 25°C: above that,
        azurite is stable; below, malachite wins. The sim's CO3 thresholds
        (malachite ≥20, azurite ≥120) are the sim-scale encoding of that
        boundary. Azurite drops back to malachite via a paramorph
        replacement triggered in grow_azurite when CO3 falls during a run
        (the Bisbee monsoon → drying transition, step 225 ev_co2_drop).
        See research/research-broth-ratio-malachite-azurite.md.
        """
        if self.fluid.Cu < 5 or self.fluid.CO3 < 20 or self.fluid.O2 < 0.3:
            return 0
        sigma = (self.fluid.Cu / 25.0) * (self.fluid.CO3 / 100.0) * (self.fluid.O2 / 1.0)
        # Temperature penalty at high T — malachite is a LOW temperature mineral
        if self.temperature > 50:
            sigma *= math.exp(-0.005 * (self.temperature - 50))
        # Acid penalty — malachite dissolves easily (it fizzes!)
        if self.fluid.pH < 4.5:
            sigma -= (4.5 - self.fluid.pH) * 0.5
        return max(sigma, 0)


    def supersaturation_apophyllite(self) -> float:
        """Apophyllite (KCa₄Si₈O₂₀(F,OH)·8H₂O) — zeolite-facies basalt vesicle fill.

        Hydrothermal silicate of the zeolite group, T 50-250°C optimum 100-200°C.
        Requires K + Ca + lots of SiO₂ + F + alkaline fluid + low pressure
        (near-surface vesicle conditions). Stage III Deccan Traps mineral per
        Ottens et al. 2019. Hematite-included variety ('bloody apophyllite')
        from Nashik when Fe activity is significant.
        """
        if (self.fluid.K < 5 or self.fluid.Ca < 30
                or self.fluid.SiO2 < 800 or self.fluid.F < 2):
            return 0
        if self.temperature < 50 or self.temperature > 250:
            return 0
        if self.fluid.pH < 7.0 or self.fluid.pH > 10.0:
            return 0
        # Low-pressure mineral — vesicle filling, doesn't form at depth
        if self.pressure > 0.5:
            return 0
        product = ((self.fluid.K / 30.0) * (self.fluid.Ca / 100.0)
                   * (self.fluid.SiO2 / 1500.0) * (self.fluid.F / 8.0))
        # T peak 100-200°C
        if 100 <= self.temperature <= 200:
            T_factor = 1.4
        elif 80 <= self.temperature < 100 or 200 < self.temperature <= 230:
            T_factor = 1.0
        else:
            T_factor = 0.6
        # pH peak in 7.5-9 range — strong alkaline preference
        if 7.5 <= self.fluid.pH <= 9.0:
            pH_factor = 1.2
        else:
            pH_factor = 0.8
        return product * T_factor * pH_factor

    def supersaturation_tetrahedrite(self) -> float:
        """Tetrahedrite (Cu₁₂Sb₄S₁₃) — the Sb-endmember fahlore sulfosalt.

        Hydrothermal Cu-Sb-S sulfosalt forming 100-400°C, optimum 200-300°C.
        Paired with tennantite (As endmember) — same cubic structure, continuous
        solid solution. Ag substitutes for Cu, making Ag-rich tetrahedrite
        ('freibergite') an important silver ore.
        """
        if self.fluid.Cu < 10 or self.fluid.Sb < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        if self.fluid.pH < 3.0 or self.fluid.pH > 7.0:
            return 0
        if self.temperature < 100 or self.temperature > 400:
            return 0
        product = (self.fluid.Cu / 40.0) * (self.fluid.Sb / 15.0) * (self.fluid.S / 40.0)
        # T-window centered on 200-300°C
        if 200 <= self.temperature <= 300:
            T_factor = 1.3
        elif 150 <= self.temperature < 200 or 300 < self.temperature <= 350:
            T_factor = 1.0
        else:
            T_factor = 0.6
        return product * T_factor * (1.5 - self.fluid.O2)

    def supersaturation_tennantite(self) -> float:
        """Tennantite (Cu₁₂As₄S₁₃) — the As-endmember fahlore sulfosalt.

        As counterpart to tetrahedrite; same cubic structure, continuous solid
        solution. Optimum 150-300°C — slightly lower-T than tetrahedrite. Thin
        fragments transmit cherry-red light, the diagnostic. Oxidation releases
        AsO₄³⁻, feeding the secondary arsenate paragenesis (adamite, erythrite,
        annabergite, mimetite).
        """
        if self.fluid.Cu < 10 or self.fluid.As < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0
        if self.fluid.pH < 3.0 or self.fluid.pH > 7.0:
            return 0
        if self.temperature < 100 or self.temperature > 400:
            return 0
        product = (self.fluid.Cu / 40.0) * (self.fluid.As / 15.0) * (self.fluid.S / 40.0)
        if 150 <= self.temperature <= 300:
            T_factor = 1.3
        elif 100 <= self.temperature < 150 or 300 < self.temperature <= 350:
            T_factor = 1.0
        else:
            T_factor = 0.6
        return product * T_factor * (1.5 - self.fluid.O2)

    def supersaturation_erythrite(self) -> float:
        """Erythrite (Co₃(AsO₄)₂·8H₂O) — the cobalt bloom.

        Low-T (5-50°C, optimum 10-30°C) supergene arsenate from oxidizing
        Co-arsenides (cobaltite, skutterudite). Paired with annabergite
        (Ni equivalent) — same vivianite-group structure, Co vs Ni changes
        the color from crimson-pink to apple-green. Dehydrates > 200°C.
        """
        if self.fluid.Co < 2 or self.fluid.As < 5 or self.fluid.O2 < 0.3:
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        product = (self.fluid.Co / 20.0) * (self.fluid.As / 30.0) * (self.fluid.O2 / 1.0)
        T_factor = 1.2 if 10 <= self.temperature <= 30 else 0.7
        return product * T_factor

    def supersaturation_annabergite(self) -> float:
        """Annabergite (Ni₃(AsO₄)₂·8H₂O) — the nickel bloom.

        Ni equivalent of erythrite. Same vivianite-group structure, same
        gating conditions, same habit families — only the metal and color
        change. Apple-green to pale green; Mg substitution (cabrerite) pales
        toward white, Co substitution shifts toward pink.
        """
        if self.fluid.Ni < 2 or self.fluid.As < 5 or self.fluid.O2 < 0.3:
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        product = (self.fluid.Ni / 20.0) * (self.fluid.As / 30.0) * (self.fluid.O2 / 1.0)
        T_factor = 1.2 if 10 <= self.temperature <= 30 else 0.7
        return product * T_factor

    def supersaturation_adamite(self) -> float:
        """Adamite (Zn₂(AsO₄)(OH)) supersaturation. Needs Zn + As + oxidizing + low T.

        Secondary mineral forming in oxidation zones of zinc-arsenic deposits.
        Bright green fluorescence under UV (activated by Cu²⁺ substitution).
        Non-fluorescent crystals coexist with fluorescent ones — the contradiction.
        Prismatic to tabular crystals, often on limonite.
        Forms at low temperature (<100°C) in near-surface oxidation zones.

        Adamite-vs-olivenite is a Cu:Zn broth-ratio competition (Hawthorne
        1976 + Burns 1995 + Chukanov 2008 — zincolivenite (Cu,Zn)(AsO4)(OH)
        is the IMA-approved intermediate). Round 9c retrofit (Apr 2026)
        upgrades the Round 8d strict-comparison dispatch to the
        rosasite/aurichalcite 50%-gate + sweet-spot pattern. See
        research/research-broth-ratio-adamite-olivenite.md.
        """
        # Trace Cu floor — the Cu²⁺ activator gives the famous green
        # fluorescence; pure-Zn adamite without any Cu is rare in nature.
        # Recessive-side floor also makes the Cu:Zn ratio meaningful.
        if self.fluid.Zn < 10 or self.fluid.As < 5 or self.fluid.O2 < 0.3:
            return 0
        if self.fluid.Cu < 0.5:
            return 0
        # Broth-ratio gate — adamite is Zn-dominant. Olivenite returns 0
        # when Zn>Cu and adamite returns 0 when Cu>Zn — same parent fluid,
        # opposite outcome.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        zn_fraction = self.fluid.Zn / cu_zn_total  # safe — Zn≥10 above
        if zn_fraction < 0.5:
            return 0
        sigma = (self.fluid.Zn / 80.0) * (self.fluid.As / 30.0) * (self.fluid.O2 / 1.0)
        # Sweet-spot bonus — Zn-dominant but Cu-trace present (the
        # fluorescent variety) is the most aesthetic adamite. Pure-Zn
        # adamite (>0.95 Zn fraction) gets damped because hemimorphite
        # and smithsonite take that territory.
        if 0.55 <= zn_fraction <= 0.85:
            sigma *= 1.3
        elif zn_fraction > 0.95:
            sigma *= 0.5
        # Low temperature mineral — suppressed above 100°C
        if self.temperature > 100:
            sigma *= math.exp(-0.02 * (self.temperature - 100))
        # pH preference: slightly acidic to neutral (4.5-7.5)
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 0.4
        elif self.fluid.pH > 8.0:
            sigma *= 0.5
        return max(sigma, 0)
    
    def supersaturation_mimetite(self) -> float:
        """Mimetite (Pb₅(AsO₄)₃Cl) supersaturation. Needs Pb + As + Cl + oxidizing.
        
        Secondary lead arsenate chloride. Isostructural with pyromorphite and vanadinite
        (the apatite supergroup). Bright yellow-orange barrel-shaped hexagonal prisms.
        "Campylite" variety has barrel-curved faces (Fe substitution).
        Forms in oxidation zones of lead deposits alongside wulfenite, cerussite.
        My foundation stone (TN422) — wulfenite on mimetite, Sonora Mexico.
        """
        if self.fluid.Pb < 5 or self.fluid.As < 3 or self.fluid.Cl < 2 or self.fluid.O2 < 0.3:
            return 0
        sigma = (self.fluid.Pb / 60.0) * (self.fluid.As / 25.0) * (self.fluid.Cl / 30.0) * (self.fluid.O2 / 1.0)
        # Low temperature mineral — suppressed above 150°C
        if self.temperature > 150:
            sigma *= math.exp(-0.015 * (self.temperature - 150))
        # Acid penalty — dissolves in strong acid
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.5
        return max(sigma, 0)

    def supersaturation_galena(self) -> float:
        """Galena (PbS) supersaturation. Needs Pb + S + reducing conditions.

        The most common lead mineral. Perfect cubic cleavage, metallic luster.
        Forms in hydrothermal veins at moderate temperatures (100-400°C).
        Extremely dense (SG 7.6) — "the heavy one" in every collection.
        """
        if self.fluid.Pb < 5 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.5:
            return 0  # sulfides can't survive oxidation
        sigma = (self.fluid.Pb / 50.0) * (self.fluid.S / 80.0) * (1.5 - self.fluid.O2)
        # v17: use effective_temperature for Mo-flux widening.
        eT = self.effective_temperature
        # Moderate temperature preference, decay above 450°C
        if eT > 450:
            sigma *= math.exp(-0.008 * (eT - 450))
        # Sweet-spot bonus 200-400 (mirrors JS)
        if 200 <= eT <= 400:
            sigma *= 1.3
        return max(sigma, 0)

    def supersaturation_smithsonite(self) -> float:
        """Smithsonite (ZnCO₃) supersaturation. Needs Zn + CO₃ + oxidizing.

        Secondary zinc carbonate — the oxidation product of sphalerite.
        Named for James Smithson (founder of the Smithsonian).
        Botryoidal blue-green (Cu), pink (Co), yellow (Cd), white (pure).
        Low temperature mineral — forms in the oxidation zone.
        """
        if self.fluid.Zn < 20 or self.fluid.CO3 < 50 or self.fluid.O2 < 0.2:
            return 0
        # v17 reconciliation (May 2026): supergene-only mineral per
        # research-smithsonite.md (T 10-50°C optimum, decomposes ~300°C
        # but never seen above ~80°C in nature). Pre-v17 both runtimes
        # were too lenient — Python's soft decay above 100°C let it
        # form at hydrothermal T; JS's hard cap at 200°C also too
        # generous. Now hard cap at 100°C with steep decay above 80°C.
        if self.temperature > 100:
            return 0
        # Hard pH window — research says 7.0-8.5 (acidic dissolves
        # carbonate). pH<5 hard cutoff matches.
        if self.fluid.pH < 5.0:
            return 0
        sigma = (self.fluid.Zn / 80.0) * (self.fluid.CO3 / 200.0) * (self.fluid.O2 / 1.0)
        # Steep decay above 80°C (approaching the supergene-T ceiling)
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        # Alkaline boost — carbonates precipitate better in alkaline
        # conditions (research: pH 7.0-8.5 optimum).
        if self.fluid.pH > 7:
            sigma *= 1.2
        return max(sigma, 0)

    def supersaturation_wulfenite(self) -> float:
        """Wulfenite (PbMoO₄) supersaturation. Needs Pb + Mo + oxidizing.

        Lead molybdate — thin square plates, bright orange-red to yellow.
        The oxidized-zone product of galena + molybdenite destruction.
        My foundation stone (TN422). "The sunset caught in stone."
        Requires BOTH Pb and Mo to arrive — typically a late-stage mineral.
        """
        # v17 reconciliation (May 2026): per research-wulfenite.md a
        # "rare two-parent mineral that only appears when chemistry of
        # two different primary ore bodies converges." Pre-v17 Python
        # thresholds (Pb>=5, Mo>=2) let it form too easily; tightened
        # to Pb>=10, Mo>=5 to match the research framing. Python's
        # T cap (decay above 80°C, supergene-only) and graduated pH
        # penalties (3.5-9.0 window) preserved — they match the
        # research perfectly.
        if self.fluid.Pb < 10 or self.fluid.Mo < 5 or self.fluid.O2 < 0.5:
            return 0
        sigma = (self.fluid.Pb / 40.0) * (self.fluid.Mo / 15.0) * (self.fluid.O2 / 1.0)
        # Very low temperature — oxidation zone mineral. Decay above 80°C
        # matches research-wulfenite.md "T <80°C, optimum 20-60°C".
        if self.temperature > 80:
            sigma *= math.exp(-0.025 * (self.temperature - 80))
        # Graduated pH penalties — research says "near-neutral to slightly
        # alkaline (6-9)". Both acidic and alkaline edges have soft penalties.
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.4
        elif self.fluid.pH > 9.0:
            sigma -= (self.fluid.pH - 9.0) * 0.3
        return max(sigma, 0)

    def supersaturation_selenite(self) -> float:
        """Selenite / Gypsum (CaSO₄·2H₂O) supersaturation. Needs Ca + S + O₂.

        The mineral of Marey's crystal. Evaporite — grows when water evaporates.
        Swallow-tail twins, desert rose, satin spar, cathedral blades.
        Forms at LOW temperatures (<60°C). Above that → anhydrite wins.
        Selenite = transparent; gypsum = massive variety. Same mineral.
        """
        if self.fluid.Ca < 20 or self.fluid.S < 15 or self.fluid.O2 < 0.2:
            return 0
        # Need oxidized sulfur (sulfate, not sulfide)
        sigma = (self.fluid.Ca / 60.0) * (self.fluid.S / 50.0) * (self.fluid.O2 / 0.5)
        # Phase boundary: gypsum-anhydrite transition is at ~55-60°C
        # (Naica 54.5°C, Pulpí 20°C, Van Driessche et al. 2016 +
        # MDPI Minerals 2024). Steep decay above 60°C.
        if self.temperature > 60:
            sigma *= math.exp(-0.06 * (self.temperature - 60))
        # v17: cool-T sweet-spot bonus (ported from JS canonical, May 2026).
        # Pulpí 20°C grew at this colder regime via anhydrite dissolution.
        if self.temperature < 40:
            sigma *= 1.5
        # Neutral to slightly alkaline pH preferred
        if self.fluid.pH < 5.0:
            sigma -= (5.0 - self.fluid.pH) * 0.2
        return max(sigma, 0)

    def supersaturation_feldspar(self) -> float:
        """K-feldspar supersaturation. Needs K + Al + SiO₂.

        The most common minerals in Earth's crust.
        Temperature determines the polymorph:
        - High T (>600°C): sanidine (monoclinic)
        - Moderate T (400-600°C): orthoclase (monoclinic)
        - Low T (<400°C): microcline (triclinic, cross-hatched twinning)
        Pb + microcline = amazonite (green, from Pb²⁺ substituting for K⁺).

        Acidic fluids destabilize feldspar irreversibly: KAlSi₃O₈ + H⁺ →
        kaolinite + K⁺ + SiO₂. The sim doesn't model kaolinite as a
        mineral (it's an implicit sink), so below pH 4 we drive sigma
        hard negative — this keeps released K+Al+SiO₂ from re-feeding
        feldspar growth and matches the real-world one-way conversion.
        """
        if self.fluid.K < 10 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
            return 0
        # v17: hard upper cap — feldspar melts above 800°C (sanidine→melt
        # boundary; ported from JS canonical, May 2026).
        if self.temperature > 800:
            return 0
        sigma = (self.fluid.K / 40.0) * (self.fluid.Al / 10.0) * (self.fluid.SiO2 / 400.0)
        # Feldspars need HIGH temperature — they're igneous/metamorphic
        if self.temperature < 300:
            sigma *= math.exp(-0.01 * (300 - self.temperature))
        # Acid destabilization — the kaolinization regime. Mirrors the
        # dissolution threshold in grow_feldspar (pH < 4).
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 2.0
        return max(sigma, 0)

    def supersaturation_albite(self) -> float:
        """Albite (NaAlSi₃O₈) supersaturation. Needs Na + Al + SiO₂.

        The sodium end-member of the plagioclase series.
        Forms at similar conditions to K-feldspar but prefers Na-rich fluids.
        At T < 450°C, albite orders to low-albite (fully ordered Al/Si).
        Peristerite intergrowth (albite + oligoclase) creates moonstone sheen.
        """
        if self.fluid.Na < 10 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
            return 0
        sigma = (self.fluid.Na / 35.0) * (self.fluid.Al / 10.0) * (self.fluid.SiO2 / 400.0)
        # Same high-T preference as K-feldspar
        if self.temperature < 300:
            sigma *= math.exp(-0.01 * (300 - self.temperature))
        # Acid destabilization — albite kaolinizes at lower pH than
        # microcline (plagioclase is more acid-resistant, the field
        # observation). Mirrors grow_albite's pH < 3 dissolution gate.
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 2.0
        return max(sigma, 0)

    def supersaturation_spodumene(self) -> float:
        """Spodumene (LiAlSi₂O₆) supersaturation. Needs Li + Al + SiO₂.

        Monoclinic pyroxene. Lithium is mildly incompatible — builds up
        late in pegmatite crystallization because no early-stage mineral
        takes it (elbaite tourmaline takes some later, but that's
        approximately simultaneous with spodumene). Spodumene + elbaite
        compete for Li in the residual pocket fluid.

        T window 400–700°C with optimum 450–600°C (higher than beryl —
        spodumene takes a hotter pocket).
        """
        if self.fluid.Li < 8 or self.fluid.Al < 5 or self.fluid.SiO2 < 40:
            return 0
        li_f = min(self.fluid.Li / 20.0, 2.0)
        al_f = min(self.fluid.Al / 10.0, 1.5)
        si_f = min(self.fluid.SiO2 / 300.0, 1.5)
        sigma = li_f * al_f * si_f
        # Temperature window
        T = self.temperature
        if 450 <= T <= 600:
            T_factor = 1.0
        elif 400 <= T < 450:
            T_factor = 0.5 + 0.01 * (T - 400)   # 0.5 → 1.0
        elif 600 < T <= 700:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 600))
        elif T > 700:
            T_factor = 0.2
        else:
            T_factor = max(0.1, 0.5 - 0.008 * (400 - T))
        sigma *= T_factor
        return max(sigma, 0)

    def _beryl_base_sigma(self) -> float:
        """Shared Be + Al + SiO₂ supersaturation core for beryl family.

        Round 7 refactor: extracted from supersaturation_beryl so that the
        4 chromophore-variety engines (emerald, aquamarine, morganite,
        heliodor) + goshenite (beryl) all share the same base computation.
        Each variety adds its own chromophore factor and exclusion
        precedence on top.

        Returns 0 if beryl base chemistry (Be + Al + SiO2 + T window) not met.
        """
        if self.fluid.Be < 10 or self.fluid.Al < 6 or self.fluid.SiO2 < 50:
            return 0
        # Cap each factor — see supersaturation_tourmaline for rationale.
        be_f = min(self.fluid.Be / 15.0, 2.5)
        al_f = min(self.fluid.Al / 12.0, 1.5)
        si_f = min(self.fluid.SiO2 / 350.0, 1.5)
        sigma = be_f * al_f * si_f
        T = self.temperature
        if 350 <= T <= 550:
            T_factor = 1.0
        elif 300 <= T < 350:
            T_factor = 0.6 + 0.008 * (T - 300)
        elif 550 < T <= 650:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 550))
        elif T > 650:
            T_factor = 0.2
        else:
            T_factor = max(0.1, 0.6 - 0.006 * (300 - T))
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_beryl(self) -> float:
        """Beryl/goshenite (Be₃Al₂Si₆O₁₈ — colorless/generic) supersaturation.

        Post-Round-7 architecture: this is the **goshenite/generic** engine —
        fires only when NO chromophore trace is above its variety gate. The
        chromophore varieties (emerald/aquamarine/morganite/heliodor) are
        each first-class species with their own supersaturation + grow
        functions. Priority chain: emerald > morganite > heliodor > aquamarine
        > goshenite(beryl). Beryllium is the most incompatible common element
        in magmatic systems — no rock-forming mineral takes it, so it
        accumulates in residual pegmatite fluid until beryl finally nucleates
        at high threshold. That accumulation delay is why beryl crystals can
        be enormous: by the time it forms there's a lot of Be waiting.
        T window 300–650°C with optimum 350–550°C.
        """
        # Goshenite exclusion precedence: don't fire if a chromophore variety
        # would take this nucleation event. Order matches the priority chain
        # used in each variety engine.
        f = self.fluid
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald takes priority
        if f.Mn >= 2.0:
            return 0  # morganite takes priority
        if f.Fe >= 15 and f.O2 > 0.5:
            return 0  # heliodor takes priority
        if f.Fe >= 8:
            return 0  # aquamarine takes priority
        return self._beryl_base_sigma()

    def supersaturation_emerald(self) -> float:
        """Emerald (Be₃Al₂Si₆O₁₈ + Cr³⁺/V³⁺) supersaturation — the chromium
        variety of beryl. The 'emerald paradox': Cr/V is ultramafic, Be is
        pegmatitic, so emerald needs an ultramafic country-rock contact. Top
        priority in the beryl-family chromophore dispatch.
        """
        if self.fluid.Cr < 0.5 and self.fluid.V < 1.0:
            return 0
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        # Chromophore factor — Cr³⁺ is a potent chromophore even at low ppm.
        # Use whichever is higher (Cr OR V); both produce indistinguishable
        # green in the beryl structure.
        chrom_f = max(
            min(self.fluid.Cr / 1.5, 1.8),
            min(self.fluid.V / 3.0, 1.5),
        )
        return base * chrom_f

    def supersaturation_aquamarine(self) -> float:
        """Aquamarine (Be₃Al₂Si₆O₁₈ + Fe²⁺) supersaturation — the blue Fe²⁺
        variety of beryl. Most abundant gem beryl variety. Fires when Fe ≥ 8
        with no higher-priority chromophore and NOT in the heliodor band
        (Fe ≥ 15 + oxidizing).
        """
        f = self.fluid
        if f.Fe < 8:
            return 0
        # Exclusion precedence
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald
        if f.Mn >= 2.0:
            return 0  # morganite
        if f.Fe >= 15 and f.O2 > 0.5:
            return 0  # heliodor
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        fe_f = min(f.Fe / 12.0, 1.8)
        return base * fe_f

    def supersaturation_morganite(self) -> float:
        """Morganite (Be₃Al₂Si₆O₁₈ + Mn²⁺) supersaturation — the pink Mn
        variety of beryl. Late-stage pegmatite mineral. Fires when Mn ≥ 2
        with no emerald-priority chromophore (Cr/V) above threshold.
        """
        f = self.fluid
        if f.Mn < 2.0:
            return 0
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald takes priority
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        mn_f = min(f.Mn / 4.0, 1.8)
        return base * mn_f

    def supersaturation_heliodor(self) -> float:
        """Heliodor (Be₃Al₂Si₆O₁₈ + Fe³⁺) supersaturation — the yellow
        oxidized-Fe variety of beryl. Narrower window than aquamarine (needs
        BOTH high Fe ≥ 15 AND O2 > 0.5). Priority over aquamarine when the
        redox state flips oxidizing.
        """
        f = self.fluid
        if f.Fe < 15 or f.O2 <= 0.5:
            return 0
        if f.Cr >= 0.5 or f.V >= 1.0:
            return 0  # emerald
        if f.Mn >= 2.0:
            return 0  # morganite
        base = self._beryl_base_sigma()
        if base <= 0:
            return 0
        fe_f = min(f.Fe / 20.0, 1.6)
        o2_f = min(f.O2 / 1.0, 1.3)
        return base * fe_f * o2_f

    # ------------------------------------------------------------------
    # Corundum family (Al₂O₃) — first UPPER-bound gate in the sim.
    # SiO₂ < 50 is the defining constraint: with silica present at normal
    # crustal concentrations, Al + SiO₂ drives to feldspar/mica/
    # Al₂SiO₅-polymorphs instead of corundum. Shared helper below.
    # ------------------------------------------------------------------
    def _corundum_base_sigma(self) -> float:
        """Shared Al + SiO₂-undersaturation + T/pH window for corundum family.

        Returns 0 if:
          - Al < 15 (lower gate — needs alumina)
          - SiO₂ > 50 (UPPER gate — novel in sim; silica drives competition)
          - pH outside 6-10 (metamorphic fluid alkalinity)
          - T outside 400-1000°C

        Note: this is the first supersaturation function in the sim that
        gates on an UPPER bound of a fluid field. All previous gates are
        lower bounds (X ≥ threshold); corundum requires X ≤ threshold.
        Implementation care: tests/test_engine_gates.py::
        test_blocks_when_all_ingredients_zero sets all fields to 0, which
        satisfies the SiO2 upper gate trivially; the
        test_fires_with_favorable_fluid search provides enough pH/T
        candidates to pass the window gates without needing to override
        SiO2. If future tests specifically sweep high SiO2, corundum
        family should be expected to block.
        """
        if self.fluid.Al < 15:
            return 0
        if self.fluid.SiO2 > 50:
            return 0  # UPPER gate — defining corundum constraint
        if self.fluid.pH < 6 or self.fluid.pH > 10:
            return 0
        T = self.temperature
        if T < 400 or T > 1000:
            return 0
        # Al factor — capped; marble contact fluid can carry Al up to
        # 100+ ppm in skarn envelopes.
        al_f = min(self.fluid.Al / 25.0, 2.0)
        sigma = al_f
        # T window — 600-900°C optimum; falls off at edges
        if 600 <= T <= 900:
            T_factor = 1.0
        elif 400 <= T < 600:
            T_factor = 0.4 + 0.003 * (T - 400)  # 0.4 → 1.0
        elif 900 < T <= 1000:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 900))
        else:
            T_factor = 0.2
        sigma *= T_factor
        # pH window — sweet spot pH 7-9
        if 7 <= self.fluid.pH <= 9:
            pH_factor = 1.0
        else:
            pH_factor = 0.6
        sigma *= pH_factor
        return max(sigma, 0)

    def supersaturation_corundum(self) -> float:
        """Corundum (Al₂O₃, colorless/generic) supersaturation.

        Post-R7: fires only when no chromophore variety's gate is met —
        ruby takes Cr ≥ 2, sapphire takes Fe ≥ 5. Below those, colorless
        corundum fires. Priority chain: ruby > sapphire > corundum.
        """
        f = self.fluid
        if f.Cr >= 2.0:
            return 0  # ruby priority
        if f.Fe >= 5:
            return 0  # sapphire priority (any Fe ≥ 5 — blue/yellow/pink color dispatch in grow)
        return self._corundum_base_sigma()

    def supersaturation_ruby(self) -> float:
        """Ruby (Al₂O₃ + Cr³⁺) supersaturation — the red chromium variety.

        Top priority in corundum-family dispatch. Cr ≥ 2 ppm is the ruby
        gate (below that, pink-sapphire or colorless corundum). Cr
        enhancement factor: linear up to cap (prevents runaway at
        ultramafic-contact Cr concentrations).
        """
        if self.fluid.Cr < 2.0:
            return 0
        base = self._corundum_base_sigma()
        if base <= 0:
            return 0
        cr_f = min(self.fluid.Cr / 5.0, 2.0)
        return base * cr_f

    def supersaturation_sapphire(self) -> float:
        """Sapphire (Al₂O₃ + Fe + optional Ti/V-trace) — non-red corundum.

        Fe is the universal sapphire chromophore; Ti adds the blue IVCT
        partner when present (Fe+Ti blue); without Ti, high Fe yields
        yellow sapphire. Spec required_ingredients: {Al, Fe}. V-only
        violet-sapphire path is deferred (Tanzania rarity; adding it
        would break the necessity-of-Fe gate test — revisit when we
        split violet into its own species).

        Priority sub-dispatch (engine-internal):
        - Cr >= 2 → ruby (exclusion; ruby has its own engine)
        - Fe ≥ 5 AND Ti ≥ 0.5 → blue sapphire (Fe-Ti IVCT)
        - Fe ≥ 20, Ti < 0.5 → yellow sapphire (Fe³⁺)
        - Fe ≥ 5, low-Cr sub-threshold → pink/padparadscha/green variants
        - Otherwise: base conditions not met
        """
        f = self.fluid
        if f.Cr >= 2.0:
            return 0  # ruby takes priority
        if f.Fe < 5:
            return 0  # Fe is the universal sapphire chromophore threshold
        base = self._corundum_base_sigma()
        if base <= 0:
            return 0
        # Chromophore factor — blue (Fe+Ti) > yellow (Fe alone) > other
        chrom_f = min(f.Fe / 15.0, 1.5)
        if f.Ti >= 0.5:
            chrom_f *= min(f.Ti / 1.5, 1.3)  # blue IVCT boost
        return base * chrom_f

    def supersaturation_tourmaline(self) -> float:
        """Tourmaline (Na(Fe,Li,Al)₃Al₆(BO₃)₃Si₆O₁₈(OH)₄) supersaturation.

        Cyclosilicate — needs Na + B + Al + SiO₂. The B channel is what
        makes tourmaline rare outside pegmatites: boron is incompatible in
        common rock-forming minerals, so it accumulates in residual
        pegmatite fluid until tourmaline crosses saturation.

        Forms high-T (350–700°C, optimum 400–600°C). Extremely acid- and
        weathering-resistant — no dissolution in the sim. The schorl/elbaite
        distinction is a color/composition flag set in grow_tourmaline
        based on which cations the fluid carries when the zone deposits.
        """
        if (self.fluid.Na < 3 or self.fluid.B < 6 or
                self.fluid.Al < 8 or self.fluid.SiO2 < 60):
            return 0
        # Cap each factor — pegmatite fluids can have thousands of ppm SiO₂
        # and tens of ppm of the incompatible elements. The real limiter is
        # the boron channel and temperature window, not sheer abundance.
        na_f = min(self.fluid.Na / 20.0, 1.5)
        b_f  = min(self.fluid.B / 15.0, 2.0)   # B is the gate
        al_f = min(self.fluid.Al / 15.0, 1.5)
        si_f = min(self.fluid.SiO2 / 400.0, 1.5)
        sigma = na_f * b_f * al_f * si_f
        # Temperature window — stable up to ~700°C but nucleates best in
        # the 400–600°C band. Falls off outside.
        T = self.temperature
        if 400 <= T <= 600:
            T_factor = 1.0
        elif 350 <= T < 400:
            T_factor = 0.5 + 0.01 * (T - 350)  # 0.5 → 1.0
        elif 600 < T <= 700:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 600))
        elif 700 < T:
            T_factor = 0.2  # outside stability field
        else:
            T_factor = max(0.1, 0.5 - 0.008 * (350 - T))  # below 350 → starved
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_topaz(self) -> float:
        """Topaz (Al₂SiO₄(F,OH)₂) supersaturation. Needs Al + SiO₂ + F.

        Topaz is a nesosilicate whose structure demands fluorine (or OH) in
        every other anion site. The F channel is what gates nucleation —
        fluorine is incompatible early in hydrothermal evolution, so it
        accumulates in residual fluid until it crosses a saturation threshold.
        Morteani et al. 2002 put Ouro Preto imperial topaz at ~360°C, 3.5 kbar.
        T_optimum 340–400°C; falls off outside that window. Very stable —
        only strong acid (pH < 2) attacks it, and slowly.
        """
        # Hard F threshold: below this the structure simply can't form.
        # This is the mechanism that delays topaz in the ouro_preto scenario —
        # early quartz grows alone while F climbs past the gate.
        if self.fluid.F < 20 or self.fluid.Al < 3 or self.fluid.SiO2 < 200:
            return 0
        # Cap each factor so pegmatite-level Al/SiO₂ (thousands of ppm each)
        # doesn't explode sigma into runaway nucleation territory. Topaz
        # only needs its anion components above threshold, not bazillions
        # of them; the limiter is the F channel and temperature window.
        al_f = min(self.fluid.Al / 8.0, 2.0)
        si_f = min(self.fluid.SiO2 / 400.0, 1.5)
        f_f  = min(self.fluid.F / 25.0, 1.5)
        sigma = al_f * si_f * f_f
        # Temperature window — sweet spot 340-400°C, decays outside.
        T = self.temperature
        if 340 <= T <= 400:
            T_factor = 1.0
        elif 300 <= T < 340:
            T_factor = 0.6 + 0.01 * (T - 300)   # 0.6 → 1.0 across the lower ramp
        elif 400 < T <= 500:
            T_factor = max(0.2, 1.0 - 0.008 * (T - 400))
        elif 500 < T <= 600:
            T_factor = max(0.1, 0.4 - 0.003 * (T - 500))
        else:
            T_factor = 0.1  # outside published range — starved
        sigma *= T_factor
        # Strong-acid dissolution (pH < 2) eats topaz, slowly.
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_uraninite(self) -> float:
        """Uraninite (UO₂) supersaturation. Needs U + reducing conditions.

        Primary uranium mineral — pitchy black masses, rarely crystalline.
        RADIOACTIVE. Gatekeeper for the entire secondary U family
        (torbernite/zeunerite/carnotite). Needs STRONGLY reducing conditions
        — any oxygen converts U⁴⁺ → mobile UO₂²⁺ uranyl ion. Forms in
        pegmatites (high T, octahedral crystals), hydrothermal veins
        (200-400°C botryoidal pitchblende), and reduced sedimentary
        roll-fronts (low T, cryptocrystalline).
        """
        if self.fluid.U < 5 or self.fluid.O2 > 0.3:
            return 0  # needs reducing conditions
        sigma = (self.fluid.U / 20.0) * (0.5 - self.fluid.O2)
        # Stable across wide T range (research: 150-600°C). Slight preference
        # for higher T (pegmatitic > hydrothermal > sedimentary).
        if self.temperature > 200:
            sigma *= 1.3
        return max(sigma, 0)

    def supersaturation_magnetite(self) -> float:
        """Magnetite (Fe₃O₄) supersaturation. Fe + moderate O₂ (HM buffer).

        Mixed-valence Fe²⁺Fe³⁺₂O₄. Forms at the hematite-magnetite (HM)
        redox buffer — too reducing and Fe stays as Fe²⁺ (siderite/
        pyrite); too oxidizing and it goes to hematite/goethite.
        Wide T stability (100–800°C) but prefers moderate/high T.
        """
        if self.fluid.Fe < 25 or self.fluid.O2 < 0.1 or self.fluid.O2 > 1.0:
            return 0
        fe_f = min(self.fluid.Fe / 60.0, 2.0)
        # HM buffer peak around O2=0.4, falls off on both sides
        o_f = max(0.4, 1.0 - abs(self.fluid.O2 - 0.4) * 1.5)
        sigma = fe_f * o_f
        T = self.temperature
        if 300 <= T <= 600:
            T_factor = 1.0
        elif 100 <= T < 300:
            T_factor = 0.5 + 0.0025 * (T - 100)
        elif 600 < T <= 800:
            T_factor = max(0.4, 1.0 - 0.003 * (T - 600))
        else:
            T_factor = 0.2
        sigma *= T_factor
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_lepidocrocite(self) -> float:
        """Lepidocrocite (γ-FeOOH) supersaturation. Fe + rapid oxidation.

        Kinetically favored over goethite when Fe²⁺ oxidizes FAST —
        e.g. pyrite weathering in situ. If oxidation is slow, goethite
        wins. We approximate this with higher O₂ and higher growth rate
        preference.
        """
        if self.fluid.Fe < 15 or self.fluid.O2 < 0.8:
            return 0
        fe_f = min(self.fluid.Fe / 50.0, 2.0)
        o_f = min(self.fluid.O2 / 1.5, 1.5)
        sigma = fe_f * o_f
        # Low-T preference — strictly supergene/weathering
        if self.temperature > 50:
            sigma *= math.exp(-0.02 * (self.temperature - 50))
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.4
        # pH 5-7 is the sweet spot; outside penalty
        if self.fluid.pH > 7.5:
            sigma *= max(0.5, 1.0 - (self.fluid.pH - 7.5) * 0.3)
        return max(sigma, 0)

    def supersaturation_stibnite(self) -> float:
        """Stibnite (Sb₂S₃) supersaturation. Sb + S + moderate T + reducing.

        Hydrothermal antimony sulfide. Low-melting (550°C) so requires
        moderate temperatures — above 400°C it approaches melting;
        below 100°C the chemistry doesn't work.
        """
        if self.fluid.Sb < 10 or self.fluid.S < 15 or self.fluid.O2 > 1.0:
            return 0
        sb_f = min(self.fluid.Sb / 20.0, 2.0)
        s_f  = min(self.fluid.S / 40.0, 1.5)
        sigma = sb_f * s_f
        T = self.temperature
        if 150 <= T <= 300:
            T_factor = 1.0
        elif 100 <= T < 150:
            T_factor = 0.5 + 0.01 * (T - 100)
        elif 300 < T <= 400:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 300))
        else:
            T_factor = 0.2
        sigma *= T_factor
        sigma *= max(0.5, 1.3 - self.fluid.O2)
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_bismuthinite(self) -> float:
        """Bismuthinite (Bi₂S₃) supersaturation. Bi + S + high T + reducing.

        Same orthorhombic structure as stibnite. High-T hydrothermal —
        forms at 200–500°C with cassiterite, wolframite, arsenopyrite
        (greisen suite).
        """
        if self.fluid.Bi < 5 or self.fluid.S < 15 or self.fluid.O2 > 1.0:
            return 0
        bi_f = min(self.fluid.Bi / 20.0, 2.0)
        s_f  = min(self.fluid.S / 50.0, 1.5)
        sigma = bi_f * s_f
        T = self.temperature
        if 200 <= T <= 400:
            T_factor = 1.0
        elif 150 <= T < 200:
            T_factor = 0.5 + 0.01 * (T - 150)
        elif 400 < T <= 500:
            T_factor = max(0.3, 1.0 - 0.007 * (T - 400))
        else:
            T_factor = 0.2
        sigma *= T_factor
        sigma *= max(0.5, 1.3 - self.fluid.O2)
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_native_bismuth(self) -> float:
        """Native bismuth (Bi) supersaturation. Bi + very low S + reducing.

        Forms when sulfur runs out before bismuth does — bismuthinite
        scavenged the available S and residual Bi crystallizes native.
        Melts at unusually low 271.5°C; beyond that, the crystal is
        liquid metal.
        """
        if (self.fluid.Bi < 15 or self.fluid.S > 12 or
                self.fluid.O2 > 0.6):
            return 0
        bi_f = min(self.fluid.Bi / 25.0, 2.0)
        # Low-S preference — any S pulls Bi into bismuthinite instead
        s_mask = max(0.4, 1.0 - self.fluid.S / 20.0)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = bi_f * s_mask * red_f
        T = self.temperature
        if 100 <= T <= 250:
            T_factor = 1.0
        elif T < 100:
            T_factor = 0.6
        elif T <= 270:
            T_factor = max(0.3, 1.0 - 0.05 * (T - 250))   # sharply approaches melting
        else:
            T_factor = 0.1   # melted
        sigma *= T_factor
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_clinobisvanite(self) -> float:
        """Clinobisvanite (BiVO₄) supersaturation. Bi + V + oxidizing + low T.

        End of the Bi oxidation sequence: bismuthinite → native bismuth
        → bismite/bismutite → clinobisvanite (if V is available).
        Microscopic — growth_rate_mult 0.2 is slow.
        """
        if self.fluid.Bi < 2 or self.fluid.V < 2 or self.fluid.O2 < 1.0:
            return 0
        bi_f = min(self.fluid.Bi / 5.0, 2.0)
        v_f  = min(self.fluid.V / 5.0, 2.0)
        o_f  = min(self.fluid.O2 / 1.5, 1.3)
        sigma = bi_f * v_f * o_f
        if self.temperature > 40:
            sigma *= math.exp(-0.04 * (self.temperature - 40))
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_cuprite(self) -> float:
        """Cuprite (Cu₂O) supersaturation. Cu + narrow O₂ window.

        The Eh-boundary mineral. Too reducing → native copper; too
        oxidizing → malachite/tenorite. Cuprite exists in the narrow
        band between. Low T (<100°C). The O₂ sweet spot is 0.3–1.2 —
        on either side, the thermodynamics push elsewhere.
        """
        if self.fluid.Cu < 20 or self.fluid.O2 < 0.3 or self.fluid.O2 > 1.2:
            return 0
        cu_f = min(self.fluid.Cu / 50.0, 2.0)
        # Eh window: peak at O2 ≈ 0.7, falling on both sides
        o_f = max(0.3, 1.0 - abs(self.fluid.O2 - 0.7) * 1.4)
        sigma = cu_f * o_f
        if self.temperature > 100:
            sigma *= math.exp(-0.03 * (self.temperature - 100))
        if self.fluid.pH < 3.5:
            sigma -= (3.5 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_azurite(self) -> float:
        """Azurite (Cu₃(CO₃)₂(OH)₂) supersaturation. Cu + high CO₃ + O₂.

        Needs HIGHER carbonate than malachite — that's why high-pCO₂
        groundwater produces azurite in limestone-hosted copper vugs
        but malachite dominates otherwise. When CO₃ drops during the
        run, grow_azurite flags the crystal for malachite conversion.

        The Cu carbonate competition is encoded by carbonate activity,
        not by a Cu:Zn-style broth ratio (the rosasite/aurichalcite
        Round 9 idiom doesn't fit this pair — they share Cu, not two
        competing metals). Vink 1986 (*Mineralogical Magazine* 50:43-47)
        fixes the azurite/malachite univariant boundary at
        log(pCO2) ≈ -3.5 at 25°C. Above: azurite. Below: malachite.
        Azurite's higher CO3 requirement (≥120 vs malachite ≥20) is
        the sim-scale encoding. See
        research/research-broth-ratio-malachite-azurite.md.
        """
        if (self.fluid.Cu < 20 or self.fluid.CO3 < 120 or
                self.fluid.O2 < 1.0):
            return 0
        cu_f = min(self.fluid.Cu / 40.0, 2.0)
        co_f = min(self.fluid.CO3 / 150.0, 1.8)   # CO3 is the gate
        o_f  = min(self.fluid.O2 / 1.5, 1.3)
        sigma = cu_f * co_f * o_f
        if self.temperature > 50:
            sigma *= math.exp(-0.06 * (self.temperature - 50))
        if self.fluid.pH < 5.0:
            sigma -= (5.0 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_chrysocolla(self) -> float:
        """Chrysocolla (Cu₂H₂Si₂O₅(OH)₄) supersaturation — hydrous copper
        silicate, the cyan enamel of Cu oxidation zones.

        Strictly low-T (<80 °C), strictly meteoric. Needs Cu²⁺ AND
        dissolved SiO₂ above the amorphous-silica floor simultaneously,
        in a near-neutral pH window (5.5–7.5) where both are soluble
        together. Silicate-hosted (or mixed-host) systems supply the Si;
        the limestone-only MVT-style scenarios lack SiO₂ in the fluid
        so chrysocolla stays ~0 there — correct geologically.

        Azurite ↔ malachite ↔ chrysocolla competition rule: when
        CO₃²⁻ > SiO₂ (molar — ppm is close enough in our fluid scale
        since both MW ≈ 60), the carbonates out-compete and
        chrysocolla's σ collapses. Chrysocolla only wins when pCO₂
        has dropped and SiO₂ has risen (the Bisbee late-oxidation
        sequence).
        """
        # Hard gates: the no-go conditions
        if (self.fluid.Cu < 5 or self.fluid.SiO2 < 20 or
                self.fluid.O2 < 0.3):
            return 0
        if self.temperature < 5 or self.temperature > 80:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        # Malachite / azurite win when CO₃ dominates — chrysocolla is
        # the late-stage "no more CO₂" mineral.
        if self.fluid.CO3 > self.fluid.SiO2:
            return 0

        cu_f = min(self.fluid.Cu / 30.0, 3.0)
        si_f = min(self.fluid.SiO2 / 60.0, 2.5)
        o_f = min(self.fluid.O2 / 1.0, 1.5)

        # Temperature factor — optimum 15–40 °C
        T = self.temperature
        if 15 <= T <= 40:
            t_f = 1.0
        elif T < 15:
            t_f = max(0.3, T / 15.0)
        else:
            t_f = max(0.3, 1.0 - (T - 40) / 40.0)

        # pH factor — optimum 6.0–7.5, roll off at edges
        pH = self.fluid.pH
        if 6.0 <= pH <= 7.5:
            ph_f = 1.0
        elif pH < 6.0:
            ph_f = max(0.4, 1.0 - (6.0 - pH) * 0.6)
        else:
            ph_f = max(0.4, 1.0 - (pH - 7.5) * 0.6)

        sigma = cu_f * si_f * o_f * t_f * ph_f
        return max(sigma, 0)

    def supersaturation_native_gold(self) -> float:
        """Native gold (Au) supersaturation.

        Au has extreme affinity for the native form across most natural
        conditions — equilibrium Au activity in any aqueous fluid is
        sub-ppb, so even fractional ppm Au in the broth is hugely
        supersaturated against equilibrium. The threshold here (Au ≥
        0.5 ppm) is the practical sim minimum; below that level the
        gold stays partitioned in solution as Au-Cl or Au-HS complexes
        without nucleating distinct crystals.

        Two precipitation pathways the model collapses into one σ:
          1. High-T magmatic-hydrothermal — Au-Cl complex destabilizes
             at boiling / decompression / cooling. The Bingham
             vapor-plume Au mechanism (Landtwing et al. 2010).
          2. Low-T supergene — Au-Cl reduces to Au0 at the redox
             interface, often coupled with chalcocite enrichment. The
             Bisbee oxidation-cap mechanism (Graeme et al. 2019).

        Unlike native_copper, gold tolerates BOTH oxidizing AND
        reducing fluids because the two transport complexes (Au-Cl
        oxidizing vs Au-HS reducing) cover both regimes — there's no
        Eh window where gold can't deposit if Au activity is high.

        Sulfur suppression is the main competing factor: above
        ~100 ppm S, Au stays in Au-HS solution and/or partitions into
        coexisting Au-Te species (when Te is also present) instead of
        nucleating native gold.
        """
        if self.fluid.Au < 0.5:
            return 0
        # Au activity factor — even small Au is hugely supersaturated.
        # Cap at 4× to keep extreme Au from blowing out the dispatcher.
        au_f = min(self.fluid.Au / 1.0, 4.0)
        # Sulfur suppression — high S keeps Au in Au(HS)2- complex.
        # Above ~100 ppm S the suppression dominates.
        s_f = max(0.2, 1.0 - self.fluid.S / 200.0)
        sigma = au_f * s_f
        # Wide T tolerance — gold deposits span 25-700°C (porphyry to
        # placer to epithermal). Mild dropoff above 400°C and below
        # 20°C.
        T = self.temperature
        if 20 <= T <= 400:
            T_factor = 1.0
        elif T < 20:
            T_factor = 0.5
        elif T <= 700:
            T_factor = max(0.5, 1.0 - 0.001 * (T - 400))
        else:
            T_factor = 0.3
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_native_copper(self) -> float:
        """Native copper (Cu) supersaturation. Very high Cu + strongly reducing.

        Only forms when S²⁻ is low enough not to make sulfides AND Eh
        is strongly reducing (O₂ < 0.4 in our scale). Wide T stability
        (up to 300°C). High σ threshold (1.6) because the specific
        chemistry window is narrow.
        """
        if (self.fluid.Cu < 50 or self.fluid.O2 > 0.4 or
                self.fluid.S > 30):
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 2.5)
        # Reducing preference — stronger than bornite/chalcocite
        red_f = max(0.4, 1.0 - self.fluid.O2 * 2.0)
        # Sulfide-suppression — any S lowers yield
        s_f = max(0.3, 1.0 - self.fluid.S / 40.0)
        sigma = cu_f * red_f * s_f
        T = self.temperature
        if 20 <= T <= 150:
            T_factor = 1.0
        elif T < 20:
            T_factor = 0.7
        elif T <= 300:
            T_factor = max(0.4, 1.0 - 0.004 * (T - 150))
        else:
            T_factor = 0.2
        sigma *= T_factor
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_bornite(self) -> float:
        """Bornite (Cu₅FeS₄) supersaturation. Cu + Fe + S + reducing.

        Wide T stability (20–500°C). Competes with chalcopyrite for
        Cu+Fe+S — bornite wins when Cu:Fe ratio > 3:1. The 228°C order-
        disorder transition (pseudo-cubic above, orthorhombic below)
        is recorded in `grow_bornite` via dominant_forms.
        """
        # Hard cap at very high O2 (bornite dissolves oxidatively above
        # this). Supergene enrichment of Cu²⁺ descending onto reduced
        # primary sulfides is conceptually a "local reducing" event at
        # an oxidizing level; the sim's 1D O2 can't represent the
        # gradient, so we allow up to 1.8 and rely on the Cu:Fe ratio
        # gate for specificity.
        if (self.fluid.Cu < 25 or self.fluid.Fe < 8 or self.fluid.S < 20 or
                self.fluid.O2 > 1.8):
            return 0
        # Needs Cu-rich relative to Fe (Cu/Fe > 2 for bornite structure)
        cu_fe_ratio = self.fluid.Cu / max(self.fluid.Fe, 1)
        if cu_fe_ratio < 2.0:
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 2.0)
        fe_f = min(self.fluid.Fe / 30.0, 1.3)
        s_f  = min(self.fluid.S / 60.0, 1.5)
        sigma = cu_f * fe_f * s_f
        # Wide T stability — slight decline outside optimum
        T = self.temperature
        if 80 <= T <= 300:
            T_factor = 1.0
        elif T < 80:
            T_factor = 0.6 + 0.005 * T        # supergene still OK
        elif T <= 500:
            T_factor = max(0.5, 1.0 - 0.003 * (T - 300))
        else:
            T_factor = 0.2
        sigma *= T_factor
        # Reducing preference, but retains 0.3 floor for supergene
        # enrichment which is nominally oxidizing
        sigma *= max(0.3, 1.5 - self.fluid.O2)
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_chalcocite(self) -> float:
        """Chalcocite (Cu₂S) supersaturation. Cu-rich + S + low T + reducing.

        Supergene enrichment mineral — forms where Cu²⁺-rich descending
        fluids meet reducing conditions and replace chalcopyrite/bornite
        atom-by-atom. 79.8% Cu by weight. Low-T window (< 150°C).
        """
        # O2 ≤ 2.0 — chalcocite forms at the supergene enrichment
        # boundary, which is nominally oxidizing in our 1D O2 model.
        # The mineral is actually stable only under locally reducing
        # conditions (at the interface with primary sulfides below);
        # the 1.9 cap + check_nucleation's preference for chalcopyrite/
        # bornite substrate approximates this.
        if self.fluid.Cu < 30 or self.fluid.S < 15 or self.fluid.O2 > 1.9:
            return 0
        cu_f = min(self.fluid.Cu / 60.0, 2.0)    # Cu-gate, tuned to
                                                 # chalcocite's supergene
                                                 # Cu-enrichment habit
        s_f  = min(self.fluid.S / 50.0, 1.5)
        sigma = cu_f * s_f
        # Strict low-T window
        T = self.temperature
        if T > 150:
            sigma *= math.exp(-0.03 * (T - 150))
        # Reducing preference, floored at 0.3 so supergene-zone
        # chemistry can still fire
        sigma *= max(0.3, 1.4 - self.fluid.O2)
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_covellite(self) -> float:
        """Covellite (CuS) supersaturation. Cu + S-rich + low T.

        Forms at the boundary between reduction and oxidation zones —
        higher S:Cu ratio than chalcocite (1:1 vs 1:2). Decomposes to
        chalcocite + S above 507°C.
        """
        # Transition-zone mineral between reduction and oxidation —
        # gate O2 ≤ 2.0 so it can nucleate on chalcocite/chalcopyrite
        # substrate in supergene zones.
        if self.fluid.Cu < 20 or self.fluid.S < 25 or self.fluid.O2 > 2.0:
            return 0
        cu_f = min(self.fluid.Cu / 50.0, 2.0)
        s_f  = min(self.fluid.S / 60.0, 1.8)    # S is the gate
                                                # (covellite has 2× S of chalcocite)
        sigma = cu_f * s_f
        T = self.temperature
        if T > 100:
            sigma *= math.exp(-0.03 * (T - 100))
        # Transition-zone mineral — likes moderate O2 (the Eh boundary
        # between chalcocite's reduced regime and full oxidation)
        sigma *= max(0.3, 1.3 - abs(self.fluid.O2 - 0.8))
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_anglesite(self) -> float:
        """Anglesite (PbSO₄) supersaturation. Needs Pb + oxidized S + O₂.

        Intermediate step in the lead-oxidation paragenesis. Galena
        oxidizes to Pb²⁺ + SO₄²⁻ → anglesite, which is transient in
        carbonate-bearing groundwater (dissolves and re-precipitates as
        cerussite). Strict low-T window (< 80°C) — anglesite is a
        supergene mineral only.
        """
        if (self.fluid.Pb < 15 or self.fluid.S < 15 or
                self.fluid.O2 < 0.8):
            return 0
        pb_f = min(self.fluid.Pb / 40.0, 2.0)
        s_f  = min(self.fluid.S / 40.0, 1.5)
        o_f  = min(self.fluid.O2 / 1.0, 1.5)
        sigma = pb_f * s_f * o_f
        # Low-T window — anglesite disappears fast above ~80°C
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        # Acid dissolution (pH < 2) — slow
        if self.fluid.pH < 2.0:
            sigma -= (2.0 - self.fluid.pH) * 0.3
        return max(sigma, 0)

    def supersaturation_cerussite(self) -> float:
        """Cerussite (PbCO₃) supersaturation. Needs Pb + CO₃.

        Final stable product of the lead-oxidation sequence in
        carbonate-rich water. Outcompetes anglesite when CO₃ is
        abundant. Stellate cyclic twins on {110} are iconic — "six-ray
        stars" growing as three individuals rotated 120° apart.
        Low-T mineral; dissolves in acid (it's a carbonate, fizzes).
        """
        if self.fluid.Pb < 15 or self.fluid.CO3 < 30:
            return 0
        pb_f = min(self.fluid.Pb / 40.0, 2.0)
        co_f = min(self.fluid.CO3 / 80.0, 1.5)
        sigma = pb_f * co_f
        # Low-T preference — cerussite is strictly supergene
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        # Acid dissolution (pH < 4) — fizzes like calcite
        if self.fluid.pH < 4.0:
            sigma -= (4.0 - self.fluid.pH) * 0.4
        # Alkaline promotes cerussite precipitation (carbonate buffering)
        elif self.fluid.pH > 7.0:
            sigma *= 1.0 + (self.fluid.pH - 7.0) * 0.1
        return max(sigma, 0)

    def supersaturation_pyromorphite(self) -> float:
        """Pyromorphite (Pb₅(PO₄)₃Cl) supersaturation. Needs Pb + P + Cl.

        Apatite-group phosphate, barrel-shaped hexagonal prisms.
        Phosphate is often rare in oxidation-zone fluids — the P
        threshold is the natural gate. When phosphate arrives via
        meteoric water meeting an oxidizing Pb mineral, pyromorphite
        replaces cerussite or coats galena pseudomorphically.
        """
        if self.fluid.Pb < 20 or self.fluid.P < 2 or self.fluid.Cl < 5:
            return 0
        pb_f = min(self.fluid.Pb / 30.0, 1.8)
        p_f  = min(self.fluid.P / 5.0, 2.0)      # P is the gate
        cl_f = min(self.fluid.Cl / 15.0, 1.3)
        sigma = pb_f * p_f * cl_f
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_vanadinite(self) -> float:
        """Vanadinite (Pb₅(VO₄)₃Cl) supersaturation. Needs Pb + V + Cl.

        Vanadate end-member of the apatite-group Pb-trio (pyromorphite
        P / mimetite As / vanadinite V). Vanadium comes from oxidation
        of V-bearing red-bed sediments — arid-climate signature. The V
        threshold is the gate; vanadate is otherwise rare in
        oxidation-zone fluids.
        """
        if self.fluid.Pb < 20 or self.fluid.V < 2 or self.fluid.Cl < 5:
            return 0
        pb_f = min(self.fluid.Pb / 30.0, 1.8)
        v_f  = min(self.fluid.V / 6.0, 2.0)      # V is the gate
        cl_f = min(self.fluid.Cl / 15.0, 1.3)
        sigma = pb_f * v_f * cl_f
        if self.temperature > 80:
            sigma *= math.exp(-0.04 * (self.temperature - 80))
        if self.fluid.pH < 2.5:
            sigma -= (2.5 - self.fluid.pH) * 0.4
        return max(sigma, 0)

    def supersaturation_goethite(self) -> float:
        """Goethite (FeO(OH)) supersaturation. Needs Fe + oxidizing + moderate pH.

        The most common iron oxyhydroxide. Rust's crystal name.
        Botryoidal blackish-brown masses, velvety surfaces.
        The pseudomorph mineral — replaces pyrite, marcasite, siderite.
        Egyptian "Prophecy Stones" = goethite after marcasite.
        Low temperature, oxidation zone. Dissolves in acid.
        """
        if self.fluid.Fe < 15 or self.fluid.O2 < 0.4:
            return 0
        sigma = (self.fluid.Fe / 60.0) * (self.fluid.O2 / 1.0)
        # Low temperature preferred
        if self.temperature > 150:
            sigma *= math.exp(-0.015 * (self.temperature - 150))
        # Dissolves in acid
        if self.fluid.pH < 3.0:
            sigma -= (3.0 - self.fluid.pH) * 0.5
        return max(sigma, 0)

    def supersaturation_molybdenite(self) -> float:
        """Molybdenite (MoS₂) supersaturation. Needs Mo + S + reducing.

        Lead-gray, hexagonal, greasy feel — the softest metallic mineral (H=1).
        Looks like graphite but has a different streak (greenish vs black).
        Primary molybdenum ore. Arrives in a SEPARATE pulse from Cu
        in porphyry systems (Seo et al. 2012, Bingham Canyon).
        Wulfenite requires destroying BOTH molybdenite AND galena.
        """
        if self.fluid.Mo < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 1.2:
            return 0  # sulfide, needs reducing
        sigma = (self.fluid.Mo / 15.0) * (self.fluid.S / 60.0) * (1.5 - self.fluid.O2)
        # v17: use effective_temperature for Mo-flux widening.
        # (Note: somewhat self-referential since molybdenite supplies Mo,
        #  but the porphyry-system co-occurrence is the geological logic.)
        eT = self.effective_temperature
        # Moderate to high temperature
        if eT < 150:
            sigma *= math.exp(-0.01 * (150 - eT))
        elif 300 < eT < 500:
            sigma *= 1.3  # sweet spot for porphyry Mo
        return max(sigma, 0)

    def supersaturation_ferrimolybdite(self) -> float:
        """Ferrimolybdite (Fe₂(MoO₄)₃·nH₂O) — the no-lead branch of Mo oxidation.

        Canary-yellow acicular tufts, the fast-growing powdery fork that
        takes MoO₄²⁻ when it oxidizes out of molybdenite and no Pb is
        around to make wulfenite. In the sim, both fork products can
        coexist — ferrimolybdite's lower σ threshold and higher growth
        rate let it win the early oxidation window; wulfenite catches up
        later if Pb is available.

        Paragenesis: molybdenite → MoO₄²⁻ + Fe³⁺ → ferrimolybdite
        Geology: Climax (Colorado), Kingman (Arizona), and porphyry
        Cu-Mo oxidation zones worldwide. Geologically MORE common than
        wulfenite but under-represented in collections (powdery yellow
        fuzz, not display material — collectors walk past it to get to
        the wulfenite plates).
        """
        if self.fluid.Mo < 2 or self.fluid.Fe < 3 or self.fluid.O2 < 0.5:
            return 0
        # Lower Mo threshold (2 vs wulfenite's 2; scaled /10 vs /15)
        # reflects the faster, less picky growth.
        sigma = (self.fluid.Mo / 10.0) * (self.fluid.Fe / 20.0) * (self.fluid.O2 / 1.0)
        # Strongly low-temperature — supergene/weathering zone only.
        # Cuts off above ~150°C via Arrhenius-shape decay.
        if self.temperature > 50:
            sigma *= math.exp(-0.02 * (self.temperature - 50))
        # pH window — mild acidic to neutral. Acid rock drainage
        # pH 3-6 is typical of sulfide-oxidation environments.
        if self.fluid.pH > 7:
            sigma *= max(0.2, 1.0 - 0.2 * (self.fluid.pH - 7))
        elif self.fluid.pH < 3:
            sigma *= max(0.3, 1.0 - 0.25 * (3 - self.fluid.pH))
        return max(sigma, 0)

    def supersaturation_scorodite(self) -> float:
        """Scorodite (FeAsO₄·2H₂O) — the arsenic sequestration mineral.

        Most common supergene arsenate; pseudo-octahedral pale blue-green
        dipyramids (looks cubic but isn't — orthorhombic). Forms when
        arsenopyrite (or any As-bearing primary sulfide) oxidizes in
        acidic oxidizing conditions: Fe³⁺ + AsO₄³⁻ both required. The
        acidic-end of the arsenate stability field; at pH > 5 scorodite
        dissolves and releases AsO₄³⁻ — which then feeds the rest of
        the arsenate suite (erythrite, annabergite, mimetite, adamite,
        pharmacosiderite at higher pH).

        Type locality Freiberg, Saxony, Germany. World-class deep
        blue-green crystals at Tsumeb (Gröbner & Becker 1973).

        Stability: pH 2-5 (acidic), T < 160°C (above dehydrates to
        anhydrous FeAsO₄), O₂ ≥ 0.3 (Fe must be Fe³⁺).
        """
        if self.fluid.Fe < 5 or self.fluid.As < 3 or self.fluid.O2 < 0.3:
            return 0
        if self.fluid.pH > 6:
            return 0  # dissolves at pH > 5; nucleation gate at 6 for hysteresis
        sigma = (self.fluid.Fe / 30.0) * (self.fluid.As / 15.0) * (self.fluid.O2 / 1.0)
        # Strongly low-temperature — supergene zone only
        if self.temperature > 80:
            sigma *= math.exp(-0.025 * (self.temperature - 80))
        # pH peak around 3-4; fall off above 5
        if self.fluid.pH > 5:
            sigma *= max(0.3, 1.0 - 0.5 * (self.fluid.pH - 5))
        elif self.fluid.pH < 2:
            sigma *= max(0.4, 1.0 - 0.3 * (2 - self.fluid.pH))
        return max(sigma, 0)

    def supersaturation_arsenopyrite(self) -> float:
        """Arsenopyrite (FeAsS) — the arsenic gateway mineral.

        The most common arsenic-bearing mineral; a mesothermal primary
        sulfide that co-precipitates with pyrite in orogenic gold
        systems and arrives alongside chalcopyrite/molybdenite in the
        later-stage porphyry evolution. Striated prismatic crystals
        with diamond cross-section (pseudo-orthorhombic monoclinic),
        metallic silver-white; tarnishes yellowish. Garlic odor when
        struck — arsenic vapor, diagnostic.

        Gold association: arsenopyrite is the #1 gold-trapping mineral.
        Its crystal lattice accommodates Au atoms structurally as
        "invisible gold" up to ~1500 ppm (Reich et al. 2005; Cook &
        Chryssoulis 1990). In the sim, grow_arsenopyrite consumes some
        fluid.Au and records it as trace_Au on the growth zone; when
        the crystal later oxidizes (supergene regime), the trapped Au
        is released back to fluid — the mechanism of supergene Au
        enrichment in orogenic oxidation zones (Graeme et al. 2019).

        Oxidation pathway: arsenopyrite + O₂ + H₂O →
          Fe³⁺ + AsO₄³⁻ + H₂SO₄. The released Fe + As feed scorodite
        nucleation; the H₂SO₄ drop in pH further keeps scorodite in
        its stability window (pH < 5).
        """
        if self.fluid.Fe < 5 or self.fluid.As < 3 or self.fluid.S < 10:
            return 0
        if self.fluid.O2 > 0.8:
            return 0  # sulfide — needs reducing
        sigma = ((self.fluid.Fe / 30.0) * (self.fluid.As / 15.0) *
                 (self.fluid.S / 50.0) * (1.5 - self.fluid.O2))
        # Mesothermal sweet spot 300-500°C
        T = self.temperature
        if 300 <= T <= 500:
            sigma *= 1.4
        elif T < 200:
            sigma *= math.exp(-0.01 * (200 - T))
        elif T > 600:
            sigma *= math.exp(-0.015 * (T - 600))
        # pH window 3-6.5 (slightly broader than scorodite's 2-5)
        if self.fluid.pH < 3:
            sigma *= 0.5
        elif self.fluid.pH > 6.5:
            sigma *= max(0.2, 1.0 - 0.3 * (self.fluid.pH - 6.5))
        return max(sigma, 0)

    def supersaturation_barite(self) -> float:
        """Barite (BaSO₄) — the Ba sequestration mineral.

        The standard barium mineral and the densest non-metallic mineral
        most collectors will encounter (4.5 g/cm³). Galena's primary
        gangue mineral in MVT districts; also abundant in hydrothermal
        vein systems. Wide T window (5-500°C) — MVT brine, hydrothermal
        veins, and oilfield cold-seep barite all share the same engine.

        Eh requirement: O₂ ≥ 0.1 — sulfate stable. Below O₂=0.1 (strictly
        reducing), all S sits as sulfide and barite cannot form. Real MVT
        brine sits at mildly-reducing Eh where some SO₄²⁻ persists alongside
        H₂S, allowing barite + galena to coexist; current Tri-State scenario
        O2=0.0 is too reducing (gap flagged in audit).

        No acid dissolution — barite resists even concentrated H₂SO₄
        (which is why it's the standard drilling-mud weighting agent).
        Thermal decomposition only above 1149°C, well outside sim range.

        Source: Hanor 2000 (Reviews in Mineralogy 40); Anderson & Macqueen
        1982 (MVT mineralogy).
        """
        if self.fluid.Ba < 5 or self.fluid.S < 10 or self.fluid.O2 < 0.1:
            return 0
        # Factor caps to prevent evaporite-level S (thousands of ppm) from
        # producing runaway sigma. See vugg-mineral-template.md §5.
        ba_f = min(self.fluid.Ba / 30.0, 2.0)
        s_f = min(self.fluid.S / 40.0, 2.5)
        # O2 saturation kicks in around SO₄/H₂S Eh boundary (~O2=0.4 in
        # sim scale), not at fully oxidized (O2=1.0). At the boundary,
        # sulfate is at half-availability — barite + galena can coexist
        # there, the diagnostic MVT chemistry. Sabkha O2=1.5 still hits
        # the 1.5 cap.
        o2_f = min(self.fluid.O2 / 0.4, 1.5)
        sigma = ba_f * s_f * o2_f
        # Wide T window — peaks in MVT range (50-200°C)
        T = self.temperature
        if 50 <= T <= 200:
            sigma *= 1.2
        elif T < 5:
            sigma *= 0.3
        elif T > 500:
            sigma *= max(0.2, 1.0 - 0.003 * (T - 500))
        # pH window 4-9, gentle drop outside
        if self.fluid.pH < 4:
            sigma *= max(0.4, 1.0 - 0.2 * (4 - self.fluid.pH))
        elif self.fluid.pH > 9:
            sigma *= max(0.4, 1.0 - 0.2 * (self.fluid.pH - 9))
        return max(sigma, 0)

    def supersaturation_anhydrite(self) -> float:
        """Anhydrite (CaSO₄) — the high-T or saline-low-T Ca sulfate sister of selenite.

        Two distinct stability regimes:
          1. High-T (>60°C): anhydrite stable; Bingham porphyry deep-brine
             zones contain massive anhydrite + chalcopyrite (Roedder 1971).
          2. Low-T (<60°C) with high salinity (>100‰ NaCl-eq): anhydrite
             stable due to lowered water activity; the Persian Gulf /
             Coorong sabkha and Salar de Atacama evaporite habitats.

        Below 60°C in dilute fluid (salinity < 100‰), anhydrite is
        metastable and rehydrates to gypsum (CaSO₄·2H₂O = selenite in
        the sim). Naica's giant selenite crystals grew on top of an
        older anhydrite floor that was the original evaporite layer.

        Source: Hardie 1967 (Am. Mineral. 52 — the canonical phase
        diagram); Newton & Manning 2005 (J. Petrol. 46 — high-T
        hydrothermal anhydrite); Warren 2006 (Evaporites textbook).
        """
        if (self.fluid.Ca < 50 or self.fluid.S < 20
                or self.fluid.O2 < 0.3):
            return 0
        ca_f = min(self.fluid.Ca / 200.0, 2.5)
        s_f = min(self.fluid.S / 40.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = ca_f * s_f * o2_f
        T = self.temperature
        salinity = self.fluid.salinity
        # Two-mode T — high-T branch OR low-T-saline branch
        if T > 60:
            if T < 200:
                T_factor = 0.5 + 0.005 * (T - 60)  # ramp 0.5 → 1.2
            elif T <= 700:
                T_factor = 1.2
            else:
                T_factor = max(0.3, 1.2 - 0.002 * (T - 700))
        else:
            # Low-T branch needs high salinity to suppress gypsum
            if salinity > 100:
                T_factor = min(1.0, 0.4 + salinity / 200.0)
            elif salinity > 50:
                # Marginal — partial activation
                T_factor = 0.3
            else:
                return 0  # dilute low-T → gypsum/selenite wins
        sigma *= T_factor
        # pH 5-9 stable
        if self.fluid.pH < 5:
            sigma *= max(0.4, 1.0 - 0.2 * (5 - self.fluid.pH))
        elif self.fluid.pH > 9:
            sigma *= max(0.4, 1.0 - 0.2 * (self.fluid.pH - 9))
        return max(sigma, 0)

    def supersaturation_brochantite(self) -> float:
        """Brochantite (Cu₄(SO₄)(OH)₆) — the wet-supergene Cu sulfate.

        Emerald-green prismatic crystals; the higher-pH end of the
        brochantite ↔ antlerite pH-fork pair. Forms at pH 4-7 in
        oxidizing supergene conditions; takes over from malachite
        when carbonate buffering tapers off and sulfate residue
        dominates. Atacama Desert (Chile), Bisbee, Mt Lyell, Tsumeb.

        Forks with antlerite below pH 3.5 (acidification converts
        brochantite → antlerite + H₂O; reverse with neutralization).
        Above pH 7 dissolves to tenorite/malachite.

        Source: Pollard et al. 1992 (Mineralogical Magazine 56);
        Vasconcelos et al. 1994 (Atacama supergene Cu geochronology);
        Williams 1990 ("Oxide Zone Geochemistry" — standard reference).
        """
        if (self.fluid.Cu < 10 or self.fluid.S < 15
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH < 3 or self.fluid.pH > 7.5:
            return 0  # hard gates outside stability window
        cu_f = min(self.fluid.Cu / 40.0, 2.5)
        s_f = min(self.fluid.S / 30.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = cu_f * s_f * o2_f
        # Strongly low-T (supergene only)
        if self.temperature > 50:
            sigma *= math.exp(-0.05 * (self.temperature - 50))
        # pH peak 5-6, falls outside 4-7
        if self.fluid.pH < 4:
            sigma *= max(0.3, 1.0 - 0.5 * (4 - self.fluid.pH))
        elif self.fluid.pH > 6:
            sigma *= max(0.3, 1.0 - 0.4 * (self.fluid.pH - 6))
        return max(sigma, 0)

    def supersaturation_antlerite(self) -> float:
        """Antlerite (Cu₃(SO₄)(OH)₄) — the dry-acid-supergene Cu sulfate.

        Same emerald-green color as brochantite but pH 1-3.5 stability —
        the lower-pH end of the brochantite ↔ antlerite fork. Type locality
        Antler mine (Mohave County, AZ); world-class deposits at
        Chuquicamata (Chile) where antlerite was the dominant supergene Cu
        mineral mined 1920s-50s. Cu₃ vs brochantite's Cu₄ — more SO₄ per Cu.

        Forks with brochantite above pH 3.5 (neutralization converts
        antlerite → brochantite). Below pH 1 dissolves to chalcanthite
        (CuSO₄·5H₂O — not in sim).

        Source: Hillebrand 1889 (type description); Pollard et al. 1992
        (joint brochantite-antlerite stability paper).
        """
        if (self.fluid.Cu < 15 or self.fluid.S < 20
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH > 4 or self.fluid.pH < 0.5:
            return 0  # hard gates: needs strong acid, but not extreme
        cu_f = min(self.fluid.Cu / 40.0, 2.5)
        s_f = min(self.fluid.S / 30.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = cu_f * s_f * o2_f
        # Strongly low-T
        if self.temperature > 50:
            sigma *= math.exp(-0.05 * (self.temperature - 50))
        # pH peak 2-3, falls outside 1-3.5
        if self.fluid.pH > 3.5:
            sigma *= max(0.2, 1.0 - 0.5 * (self.fluid.pH - 3.5))
        elif self.fluid.pH < 1.5:
            sigma *= max(0.4, 1.0 - 0.3 * (1.5 - self.fluid.pH))
        return max(sigma, 0)

    def supersaturation_jarosite(self) -> float:
        """Jarosite (KFe³⁺₃(SO₄)₂(OH)₆) — the diagnostic acid-mine-drainage mineral.

        Yellow-to-ocher pseudocubic rhombs and powdery crusts; the
        supergene Fe-sulfate that takes over from goethite when pH
        drops below 4. Confirmed on Mars at Meridiani Planum by MER
        Opportunity Mössbauer (Klingelhöfer et al. 2004) — proof of
        past acidic surface water on Mars. Earth localities: Rio Tinto,
        Red Mountain Pass (CO), every active sulfide-mine tailings pond.

        Stability gates: K ≥ 5 (from concurrent feldspar weathering),
        Fe ≥ 10, S ≥ 20, O2 ≥ 0.5 (strongly oxidizing), pH 1-4
        (above pH 4 jarosite dissolves and Fe goes to goethite),
        T < 100 °C (kinetically supergene only — never hydrothermal).

        Source: Bigham et al. 1996 (Geochim. Cosmochim. Acta 60);
        Stoffregen et al. 2000 (Reviews in Mineralogy 40).
        """
        if (self.fluid.K < 5 or self.fluid.Fe < 10 or self.fluid.S < 20
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH > 5:
            return 0  # hard gate; jarosite only stable in acid drainage
        # Factor caps
        k_f = min(self.fluid.K / 15.0, 2.0)
        fe_f = min(self.fluid.Fe / 30.0, 2.5)
        s_f = min(self.fluid.S / 50.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = k_f * fe_f * s_f * o2_f
        # Strongly low-T — supergene only
        if self.temperature > 50:
            sigma *= math.exp(-0.04 * (self.temperature - 50))
        # pH peak around 2-3, falls outside 1-4
        if self.fluid.pH > 4:
            sigma *= max(0.2, 1.0 - 0.6 * (self.fluid.pH - 4))
        elif self.fluid.pH < 1:
            sigma *= 0.4
        return max(sigma, 0)

    def supersaturation_alunite(self) -> float:
        """Alunite (KAl₃(SO₄)₂(OH)₆) — the Al sister of jarosite (alunite group).

        Same trigonal structure as jarosite, with Al³⁺ replacing Fe³⁺.
        The index mineral of "advanced argillic" alteration in
        porphyry-Cu lithocaps and high-sulfidation epithermal Au
        deposits (Marysvale UT type locality, Goldfield NV, Summitville,
        Yanacocha). Mined as a K source 1900s before potash mining
        took over.

        Stability gates: K ≥ 5, Al ≥ 10 (from feldspar leaching), S ≥ 20,
        O2 ≥ 0.5, pH 1-4. Wider T window than jarosite (50-300 °C
        — hydrothermal acid-sulfate alteration spans the porphyry
        epithermal range, not just supergene).

        Source: Hemley et al. 1969 (Econ. Geol. 64); Stoffregen 1987
        (Summitville Au-Cu-Ag); Stoffregen et al. 2000 (Rev. Mineral. 40).
        """
        if (self.fluid.K < 5 or self.fluid.Al < 10 or self.fluid.S < 20
                or self.fluid.O2 < 0.5):
            return 0
        if self.fluid.pH > 5:
            return 0
        k_f = min(self.fluid.K / 15.0, 2.0)
        al_f = min(self.fluid.Al / 25.0, 2.5)
        s_f = min(self.fluid.S / 50.0, 2.5)
        o2_f = min(self.fluid.O2 / 1.0, 1.5)
        sigma = k_f * al_f * s_f * o2_f
        # Wider T window than jarosite — hydrothermal acid-sulfate
        T = self.temperature
        if 50 <= T <= 200:
            sigma *= 1.2
        elif T < 25:
            sigma *= 0.5
        elif T > 350:
            sigma *= max(0.2, 1.0 - 0.005 * (T - 350))
        # pH peak 2-3
        if self.fluid.pH > 4:
            sigma *= max(0.2, 1.0 - 0.6 * (self.fluid.pH - 4))
        elif self.fluid.pH < 1:
            sigma *= 0.4
        return max(sigma, 0)

    def supersaturation_celestine(self) -> float:
        """Celestine (SrSO₄) — the Sr sequestration mineral.

        Strontium sulfate; isostructural with barite. Pale celestial blue
        F-center color is the diagnostic. Forms primarily in low-T
        evaporite settings (Coorong + Persian Gulf sabkha) and as fibrous
        sulfur-vug overgrowths (Sicilian Caltanissetta). Also in MVT
        veins as the Sr-end of the barite-celestine solid solution.

        Eh requirement: O₂ ≥ 0.1 — sulfate stable. Same Eh constraint as
        barite. No acid dissolution; thermal decomposition only above
        1100°C.

        Source: Hanor 2000 (Reviews in Mineralogy 40); Schwartz et al.
        2018 (Sr-isotope geochronology of MVT-hosted celestine).
        """
        if self.fluid.Sr < 3 or self.fluid.S < 10 or self.fluid.O2 < 0.1:
            return 0
        # Factor caps — see barite for rationale (sabkha S=2700 would
        # otherwise produce sigma > 100). O2 saturation at SO₄/H₂S
        # boundary (O2≈0.4) — same MVT-coexistence rationale.
        sr_f = min(self.fluid.Sr / 15.0, 2.0)
        s_f = min(self.fluid.S / 40.0, 2.5)
        o2_f = min(self.fluid.O2 / 0.4, 1.5)
        sigma = sr_f * s_f * o2_f
        # Low-T preferred — supergene/evaporite/MVT
        T = self.temperature
        if T < 100:
            sigma *= 1.2
        elif 100 <= T <= 200:
            sigma *= 1.0
        elif T > 200:
            sigma *= max(0.3, 1.0 - 0.005 * (T - 200))
        # pH 5-9 stable, narrower than barite
        if self.fluid.pH < 5:
            sigma *= max(0.4, 1.0 - 0.2 * (5 - self.fluid.pH))
        elif self.fluid.pH > 9:
            sigma *= max(0.4, 1.0 - 0.2 * (self.fluid.pH - 9))
        return max(sigma, 0)

    def supersaturation_acanthite(self) -> float:
        """Acanthite (Ag₂S, monoclinic) — the low-T silver sulfide.

        First Ag mineral in the sim. Activates the dormant Ag pool at
        Tri-State (5 ppm), Sweetwater Viburnum (3 ppm), Tsumeb (trace),
        and Bisbee (released by tetrahedrite oxidation). Acanthite is
        the cold-storage form of Ag₂S — above 173°C the same composition
        crystallizes as cubic argentite (handled by its own engine);
        below 173°C, only the monoclinic structure is stable.

        Hard-gated above 173°C: that regime belongs to argentite. Below
        that, σ rises with √(Ag·S) inside an 80–150°C optimum window
        (epithermal sweet spot). Reducing only — sulfide chemistry. Mild
        Fe + Cu inhibition reflects diversion of Ag into tetrahedrite /
        polybasite at higher base-metal loadings (Petruk et al. 1974).

        Source: Hayba & Bethke 1985 (Reviews in Economic Geology 2);
        boss research file research/research-acanthite.md.
        """
        if self.fluid.Ag < 0.5 or self.fluid.S < 5:
            return 0
        # Hard upper-T gate — argentite handles >173°C.
        if self.temperature > 173:
            return 0
        # Reducing requirement — oxidizing fluid puts Ag back in solution.
        if self.fluid.O2 > 0.5:
            return 0
        # Activity factors — Ag is a trace metal; even fractions of a ppm
        # are heavily supersaturated against equilibrium.
        ag_f = min(self.fluid.Ag / 2.5, 2.5)
        s_f = min(self.fluid.S / 25.0, 2.5)
        sigma = ag_f * s_f
        # T window — peak 80-150°C epithermal optimum, falls off either side.
        T = self.temperature
        if 80 <= T <= 150:
            T_factor = 1.2
        elif T < 80:
            T_factor = max(0.4, 1.0 - 0.012 * (80 - T))  # 50°C → ~0.64
        else:  # 150 < T ≤ 173
            T_factor = max(0.5, 1.0 - 0.020 * (T - 150))
        sigma *= T_factor
        # pH preference — neutral to mildly acidic (5-7 sweet spot).
        if self.fluid.pH < 4 or self.fluid.pH > 9:
            sigma *= 0.5
        # Inhibitor — high Fe + high Cu divert Ag into tetrahedrite /
        # polybasite. Soft mid-range gate, not a hard zero.
        if self.fluid.Fe > 30 and self.fluid.Cu > 20:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_argentite(self) -> float:
        """Argentite (Ag₂S, cubic) — the high-T silver sulfide.

        Same composition as acanthite, different polymorph: above 173°C
        the body-centered cubic structure is stable; below 173°C the
        lattice inverts to monoclinic acanthite. The conversion
        preserves the external crystal form (paramorph) — handled
        elsewhere in apply_paramorph_transitions. This σ method gates
        only the high-T nucleation regime.

        Hard lower-T gate at 173°C (acanthite handles below). Optimum
        200-400°C — the epithermal/mesothermal hot zone of an Ag-bearing
        hydrothermal system. Reducing only — sulfide chemistry. Note
        that a primary argentite crystal in the sim is essentially
        always destined for paramorphic conversion: there is no scenario
        that ends above 173°C, so any argentite that nucleates here
        will display as acanthite by the end of the run, retaining its
        cubic habit. That's authentic — every "argentite" in every
        museum drawer is the same trick.

        Source: research/research-argentite.md (boss commit f2939da);
        Petruk et al. 1974.
        """
        if self.fluid.Ag < 0.5 or self.fluid.S < 5:
            return 0
        # Hard lower-T gate — acanthite handles ≤173°C.
        if self.temperature <= 173:
            return 0
        # Reducing requirement.
        if self.fluid.O2 > 0.5:
            return 0
        ag_f = min(self.fluid.Ag / 2.5, 2.5)
        s_f  = min(self.fluid.S  / 25.0, 2.5)
        sigma = ag_f * s_f
        # T window — peak 200-400°C, falls off above and at the cool edge.
        T = self.temperature
        if 200 <= T <= 400:
            T_factor = 1.3
        elif T <= 200:  # 173 < T < 200, narrow ramp-up
            T_factor = max(0.5, (T - 173) / 27.0 + 0.5)
        elif T <= 600:
            T_factor = max(0.4, 1.0 - 0.005 * (T - 400))
        else:
            T_factor = 0.3
        sigma *= T_factor
        # pH preference — neutral to mildly acidic (5-7 sweet spot).
        if self.fluid.pH < 4 or self.fluid.pH > 9:
            sigma *= 0.5
        # Inhibitor — high Cu pushes Ag into sulfosalts (polybasite).
        # Tighter than acanthite because high-T fluids run hotter
        # base-metal loadings.
        if self.fluid.Cu > 30:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_chalcanthite(self) -> float:
        """Chalcanthite (CuSO₄·5H₂O) — the bright-blue water-soluble Cu sulfate.

        The terminal mineral of the Cu sulfate oxidation cascade
        (chalcopyrite → bornite → chalcocite → covellite → cuprite →
        brochantite → antlerite → chalcanthite). Lives only in arid,
        strongly oxidizing, very acidic, salt-concentrated drainage —
        Chuquicamata mine walls, Rio Tinto AMD seeps, Atacama desert
        evaporite crusts.

        Hard gates:
          • Cu < 30 or S < 50 → 0 (needs concentrated Cu²⁺ + SO₄²⁻)
          • pH > 4 → 0 (the most acid-loving of the Cu sulfates)
          • O₂ < 0.8 → 0 (must be fully oxidizing)
          • salinity < 6 → 0 (needs concentrated drainage to overcome
            the ~20 g/100mL solubility)

        The water-solubility metastability mechanic lives in
        VugSimulator.run_step (per-step hook): chalcanthite crystals
        re-dissolve when fluid.salinity < 4 OR fluid.pH > 5. First
        re-dissolvable mineral in the sim — distinct from
        THERMAL_DECOMPOSITION (which destroys + releases at high T)
        and PARAMORPH_TRANSITIONS (which converts in place). Geological
        truth: every chalcanthite specimen is a temporary victory over
        entropy.

        Source: research/research-chalcanthite.md (boss commit f2939da);
        Bandy 1938 (Am. Mineral. 23, on chalcanthite paragenesis).
        """
        if self.fluid.Cu < 30 or self.fluid.S < 50:
            return 0
        if self.fluid.pH > 4:
            return 0
        if self.fluid.O2 < 0.8:
            return 0
        # Salinity gate — needs concentrated drainage (>= 5 wt%, the
        # FluidChemistry default; arid AMD seeps and Bisbee primary
        # brine clear easily; supergene_oxidation at 2.0 stays below).
        if self.fluid.salinity < 5.0:
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 3.0)
        s_f  = min(self.fluid.S  / 100.0, 3.0)
        ox_f = min(self.fluid.O2 / 1.5, 2.0)
        # Salinity factor — the more concentrated, the higher σ.
        sal_f = min(self.fluid.salinity / 30.0, 3.0)
        # Acidic preference — strongest at pH < 2.
        ph_f = max(0.5, 1.0 + (3.0 - self.fluid.pH) * 0.2)
        sigma = cu_f * s_f * ox_f * sal_f * ph_f
        T = self.temperature
        if 20 <= T <= 40:
            T_factor = 1.3
        elif T < 10:
            T_factor = 0.4
        elif T < 20:
            T_factor = 0.4 + 0.09 * (T - 10)
        elif T <= 50:
            T_factor = max(0.4, 1.3 - 0.06 * (T - 40))
        else:
            T_factor = 0.2
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_descloizite(self) -> float:
        """Descloizite (Pb(Zn,Cu)VO₄(OH)) — the Zn end of the descloizite-
        mottramite complete solid solution series.

        Forms only in supergene oxidation zones where Pb-Zn sulfide ore
        (galena + sphalerite) has weathered and the V is delivered by
        groundwater (red-bed roll-front signature). Red-brown to
        orange-brown (no Cu chromophore — V⁵⁺ alone gives the color).

        Round 9c retrofit (Apr 2026): Cu/Zn broth-ratio competition with
        mottramite, upgrading the Round 8d strict-comparison dispatch to
        the rosasite/aurichalcite 50%-gate + sweet-spot pattern. The
        Schwartz 1942 + Oyman 2003 surveys established the complete solid
        solution; intermediate "cuprian descloizite" is common at Tsumeb
        and Berg Aukas. See research/research-broth-ratio-descloizite-
        mottramite.md.

        Source: research/research-descloizite.md (boss commit f2939da);
        Strunz 1959 (Tsumeb monograph).
        """
        if self.fluid.Pb < 40 or self.fluid.Zn < 50 or self.fluid.V < 10:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        # Recessive-side trace floor — real descloizite always has at
        # least trace Cu (cuprian descloizite). Makes the Cu:Zn ratio
        # meaningful instead of degenerate at Cu=0.
        if self.fluid.Cu < 0.5:
            return 0
        # Broth-ratio gate — descloizite is Zn-dominant.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        zn_fraction = self.fluid.Zn / cu_zn_total
        if zn_fraction < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.5)
        zn_f = min(self.fluid.Zn / 80.0, 2.5)
        v_f  = min(self.fluid.V  / 20.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * zn_f * v_f * ox_f
        # Sweet-spot bonus — Zn-dominant with Cu trace (cuprian descloizite)
        # is the most-collected form. Pure-Zn damped because willemite
        # and hemimorphite take that territory.
        if 0.55 <= zn_fraction <= 0.85:
            sigma *= 1.3
        elif zn_fraction > 0.95:
            sigma *= 0.5
        T = self.temperature
        if 30 <= T <= 50:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.4
        elif T < 30:
            T_factor = 0.4 + 0.08 * (T - 20)
        elif T <= 80:
            T_factor = max(0.4, 1.2 - 0.020 * (T - 50))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_mottramite(self) -> float:
        """Mottramite (Pb(Cu,Zn)VO₄(OH)) — the Cu end of the descloizite-
        mottramite complete solid solution series.

        Olive-green to yellowish-green to black (the Cu chromophore
        distinguishing it from the red-brown descloizite). Forms in the
        same supergene oxidation zones; Tsumeb produced the best
        examples of both species.

        Round 9c retrofit (Apr 2026): Cu/Zn broth-ratio competition with
        descloizite, upgrading the Round 8d strict-comparison dispatch to
        the rosasite/aurichalcite 50%-gate + sweet-spot pattern. See
        research/research-broth-ratio-descloizite-mottramite.md.

        Source: research/research-mottramite.md (boss commit f2939da).
        """
        if self.fluid.Pb < 40 or self.fluid.Cu < 50 or self.fluid.V < 10:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        # Recessive-side trace floor — real mottramite always has at
        # least trace Zn (zincian mottramite).
        if self.fluid.Zn < 0.5:
            return 0
        # Broth-ratio gate — mottramite is Cu-dominant.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        cu_fraction = self.fluid.Cu / cu_zn_total
        if cu_fraction < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.5)
        cu_f = min(self.fluid.Cu / 80.0, 2.5)
        v_f  = min(self.fluid.V  / 20.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * cu_f * v_f * ox_f
        # Sweet-spot bonus — Cu-dominant with Zn trace (zincian mottramite)
        # is the most-collected form. Pure-Cu damped because vanadinite
        # and malachite take that territory.
        if 0.55 <= cu_fraction <= 0.85:
            sigma *= 1.3
        elif cu_fraction > 0.95:
            sigma *= 0.5
        T = self.temperature
        if 30 <= T <= 50:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.4
        elif T < 30:
            T_factor = 0.4 + 0.08 * (T - 20)
        elif T <= 80:
            T_factor = max(0.4, 1.2 - 0.020 * (T - 50))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_raspite(self) -> float:
        """Raspite (PbWO₄, monoclinic) — the rare PbWO₄ polymorph.

        Same composition as stolzite (PbWO₄) but a different
        crystal system. Stolzite is tetragonal (more common); raspite
        is monoclinic (rare). The kinetic preference dispatcher in
        check_nucleation favors stolzite ~90% of the time when both
        gates clear — same composition, two minerals separated by
        crystallographic preference.

        Source: research/research-raspite.md (boss commit f2939da).
        """
        if self.fluid.Pb < 40 or self.fluid.W < 5:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.0)
        w_f  = min(self.fluid.W  / 15.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * w_f * ox_f
        T = self.temperature
        if 20 <= T <= 40:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.4
        elif T < 20:
            T_factor = 0.4 + 0.08 * (T - 10)
        elif T <= 50:
            T_factor = max(0.4, 1.2 - 0.040 * (T - 40))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_stolzite(self) -> float:
        """Stolzite (PbWO₄, tetragonal) — the common PbWO₄ polymorph.

        Same composition as raspite (PbWO₄) but tetragonal — much more
        common in nature than raspite. Honey-yellow to orange-yellow,
        the lead analog of scheelite (CaWO₄). The kinetic preference
        dispatcher in check_nucleation favors stolzite ~90% over
        raspite when both gates clear.

        Source: research/research-stolzite.md (boss commit f2939da).
        """
        if self.fluid.Pb < 40 or self.fluid.W < 5:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        pb_f = min(self.fluid.Pb / 80.0, 2.5)
        w_f  = min(self.fluid.W  / 15.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = pb_f * w_f * ox_f
        T = self.temperature
        if 20 <= T <= 80:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.4
        elif T < 20:
            T_factor = 0.4 + 0.08 * (T - 10)
        elif T <= 100:
            T_factor = max(0.4, 1.2 - 0.020 * (T - 80))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_olivenite(self) -> float:
        """Olivenite (Cu₂AsO₄(OH)) — the Cu arsenate.

        Olive-green to grayish-green, the diagnostic Cu chromophore.
        Forms in Cu-rich supergene oxidation zones — the type at Cornwall,
        Tsumeb, Bisbee.

        Adamite-vs-olivenite is a Cu:Zn broth-ratio competition (see
        research/research-broth-ratio-adamite-olivenite.md). Round 9c
        retrofit upgrades the Round 8d strict-comparison dispatch to the
        rosasite/aurichalcite 50%-gate + sweet-spot pattern.

        Source: research/research-olivenite.md (boss commit f2939da).
        """
        if self.fluid.Cu < 50 or self.fluid.As < 10:
            return 0
        if self.fluid.O2 < 0.5:
            return 0
        # Trace Zn floor on the recessive side — makes the Cu:Zn ratio
        # meaningful. Real olivenite always has at least trace Zn
        # (zincolivenite-leaning compositions).
        if self.fluid.Zn < 0.5:
            return 0
        # Broth-ratio gate — olivenite is Cu-dominant.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        cu_fraction = self.fluid.Cu / cu_zn_total
        if cu_fraction < 0.5:
            return 0
        cu_f = min(self.fluid.Cu / 80.0, 2.5)
        as_f = min(self.fluid.As / 20.0, 2.5)
        ox_f = min(self.fluid.O2 / 1.0, 2.0)
        sigma = cu_f * as_f * ox_f
        # Sweet-spot bonus — Cu-dominant with Zn trace is the
        # zincolivenite-leaning olivenite, the most-collected form.
        # Pure-Cu olivenite gets damped since malachite/brochantite
        # take that territory.
        if 0.55 <= cu_fraction <= 0.85:
            sigma *= 1.3
        elif cu_fraction > 0.95:
            sigma *= 0.5
        T = self.temperature
        if 20 <= T <= 40:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.4
        elif T < 20:
            T_factor = 0.4 + 0.08 * (T - 10)
        elif T <= 50:
            T_factor = max(0.4, 1.2 - 0.040 * (T - 40))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 4 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_nickeline(self) -> float:
        """Nickeline (NiAs) — the high-T Ni-arsenide.

        Pale copper-red metallic, the diagnostic color of the Cobalt-
        Ontario veins. Hexagonal NiAs structure (the namesake), Mohs
        5-5.5. Forms in high-T hydrothermal veins where both Ni and As
        are available together; cooler T pushes the chemistry to
        millerite (NiS) instead. Hard pH/Eh window is reducing-only.

        Source: research/research-nickeline.md (boss commit f2939da);
        Petruk 1971 (Co-Ni-Ag paragenesis).
        """
        if self.fluid.Ni < 40 or self.fluid.As < 40:
            return 0
        if self.fluid.O2 > 0.6:
            return 0
        ni_f = min(self.fluid.Ni / 60.0, 2.5)
        as_f = min(self.fluid.As / 80.0, 2.5)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = ni_f * as_f * red_f
        T = self.temperature
        if 300 <= T <= 450:
            T_factor = 1.3
        elif T < 200:
            T_factor = 0.3
        elif T < 300:
            T_factor = 0.3 + 0.010 * (T - 200)
        elif T <= 500:
            T_factor = max(0.5, 1.3 - 0.012 * (T - 450))
        else:
            T_factor = 0.4
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_millerite(self) -> float:
        """Millerite (NiS) — the capillary nickel sulfide.

        Brass-yellow to bronze-yellow capillary needles, the diagnostic
        habit forming radiating sprays in geode cavities. Trigonal NiS,
        Mohs 3-3.5. Forms in lower-T hydrothermal regimes than nickeline
        (NiAs) — when As is depleted, NiS takes the field. Mutual
        exclusion with nickeline: in As-rich fluid above 200°C, nickeline
        wins (NiAs more stable than NiS at high T + As-saturation).

        Source: research/research-millerite.md (boss commit f2939da);
        Bayliss 1969 (Geochim. Cosmochim. Acta 33, on NiS-NiAs
        equilibria).
        """
        if self.fluid.Ni < 50 or self.fluid.S < 30:
            return 0
        if self.fluid.O2 > 0.6:
            return 0
        # Mutual-exclusion gate — nickeline takes priority when As is
        # plentiful AND T is high (the NiAs stability field).
        if self.fluid.As > 30.0 and self.temperature > 200:
            return 0
        ni_f = min(self.fluid.Ni / 80.0, 2.5)
        s_f  = min(self.fluid.S  / 60.0, 2.5)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = ni_f * s_f * red_f
        T = self.temperature
        if 200 <= T <= 350:
            T_factor = 1.2
        elif T < 100:
            T_factor = 0.3
        elif T < 200:
            T_factor = 0.3 + 0.009 * (T - 100)
        elif T <= 400:
            T_factor = max(0.4, 1.2 - 0.013 * (T - 350))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_cobaltite(self) -> float:
        """Cobaltite (CoAsS) — the three-element-gate sulfarsenide.

        Reddish-silver-white pseudocubic crystals (orthorhombic but
        very nearly cubic — pyritohedral habit), Mohs 5.5, the cobalt
        analog of arsenopyrite. The three-element gate is the chemistry
        novelty: Co + As + S must ALL be present simultaneously. Forms
        in high-T hydrothermal veins (Cobalt Ontario, Tunaberg Sweden,
        Skutterud Norway) and contact-metamorphic skarns. The classic
        primary phase that weathers to erythrite (Co arsenate).

        Source: research/research-cobaltite.md (boss commit f2939da);
        Bayliss 1968 (Mineral. Mag. 36, on cobaltite-arsenopyrite
        substitution).
        """
        if self.fluid.Co < 50 or self.fluid.As < 100 or self.fluid.S < 50:
            return 0
        if self.fluid.O2 > 0.5:
            return 0
        co_f = min(self.fluid.Co / 80.0, 2.5)
        as_f = min(self.fluid.As / 120.0, 2.5)
        s_f  = min(self.fluid.S  / 80.0, 2.5)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.5)
        sigma = co_f * as_f * s_f * red_f
        T = self.temperature
        if 400 <= T <= 500:
            T_factor = 1.3
        elif T < 300:
            T_factor = 0.3
        elif T < 400:
            T_factor = 0.3 + 0.010 * (T - 300)
        elif T <= 600:
            T_factor = max(0.4, 1.3 - 0.012 * (T - 500))
        else:
            T_factor = 0.3
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_native_tellurium(self) -> float:
        """Native tellurium (Te⁰) — the metal-telluride-overflow native element.

        The rarest of the native-element overflow trio. Te is rarer
        than platinum in Earth's crust — when it does appear in
        epithermal gold systems, every metal in the broth covets it
        desperately: Au makes calaverite (AuTe₂) and sylvanite, Ag
        makes hessite (Ag₂Te), Pb makes altaite (PbTe), Bi makes
        tetradymite (Bi₂Te₂S), Hg makes coloradoite (HgTe). Native
        Te only crystallizes when every telluride-forming metal has
        had its fill and there's still Te left over.

        Hard gates:
          • Au > 1.0 → 0 (Au consumes Te as calaverite/sylvanite)
          • Ag > 5.0 → 0 (Ag consumes Te as hessite)
          • Hg > 0.5 → 0 (Hg consumes Te as coloradoite)
          • O₂ > 0.5 → 0 (oxidizing fluid takes Te to tellurite/tellurate)
        Soft preferences: T 150-300°C optimum (epithermal range), pH 4-7.

        Geological motifs (research file):
          • Cripple Creek epithermal Au-Te veins
          • Kalgoorlie golden-mile (richest Au-Te ore on Earth)
          • Emperor Mine Vatukoula Fiji

        Source: research/research-native-tellurium.md (boss commit
        f2939da); Spry & Thieben 1996 (Mineralium Deposita 31).
        """
        if self.fluid.Te < 0.5:
            return 0
        # Telluride-forming metal gates — hard zeros.
        if self.fluid.Au > 1.0:
            return 0
        if self.fluid.Ag > 5.0:
            return 0
        # Hg not currently tracked in FluidChemistry; coloradoite (HgTe)
        # gate would go here when Hg is plumbed in a future round.
        # Reducing requirement.
        if self.fluid.O2 > 0.5:
            return 0
        # Activity factor — Te is so rare that even sub-ppm levels are
        # supersaturated against equilibrium.
        te_f = min(self.fluid.Te / 2.0, 3.5)
        # Soft Pb/Bi suppression — these also form tellurides but the
        # dispatcher gives native Te a chance at lower base-metal levels.
        pb_suppr = max(0.5, 1.0 - self.fluid.Pb / 200.0)
        bi_suppr = max(0.5, 1.0 - self.fluid.Bi / 60.0)
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.8)
        sigma = te_f * pb_suppr * bi_suppr * red_f
        # T window — peak 150-300°C epithermal optimum.
        T = self.temperature
        if 150 <= T <= 300:
            T_factor = 1.2
        elif T < 100:
            T_factor = 0.3
        elif T < 150:
            T_factor = 0.3 + 0.018 * (T - 100)
        elif T <= 400:
            T_factor = max(0.4, 1.2 - 0.008 * (T - 300))
        else:
            T_factor = 0.2
        sigma *= T_factor
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_native_sulfur(self) -> float:
        """Native sulfur (S₈) — the synproportionation native element.

        The Eh-window mineral. Native sulfur lives on the H₂S/SO₄²⁻
        boundary: where the fluid is partially oxidized (sulfide and
        sulfate co-exist), the synproportionation reaction
        H₂S + SO₄²⁻ → 2S⁰ + H₂O drops elemental S out of solution.
        Below the boundary (fully reducing) → all S is sulfide bonded
        into pyrite/galena/sphalerite. Above the boundary (fully
        oxidizing) → all S is sulfate, joining barite/celestine/
        anhydrite/jarosite.

        Hard gates:
          • O₂ < 0.1 → 0 (fully reducing — sulfides take everything)
          • O₂ > 0.7 → 0 (fully oxidizing — sulfates take everything)
          • pH > 5  → 0 (high pH stabilizes HS⁻/SO₄²⁻; native S
            requires acidic conditions where H₂S dominates)
          • Sum(Fe+Cu+Pb+Zn) > 100 → 0 (base metals capture S first)
        Soft preference: T < 100°C (β-S above 95.5°C is unstable;
        most native S is α-S below the boundary).

        Geological motifs (research file):
          • Volcanic fumarole sublimation (high σ at vents)
          • Sedimentary biogenic via Desulfovibrio bacteria
            (caprock of salt domes, Tarnobrzeg)
          • Hydrothermal late-stage low-T (Sicilian dipyramids)

        Source: research/research-native-sulfur.md (boss commit
        f2939da); Holland 1965 (Econ. Geol. 60, on H₂S/SO₄ boundary
        thermodynamics).
        """
        if self.fluid.S < 100:
            return 0
        # Synproportionation Eh window — narrow.
        if self.fluid.O2 < 0.1 or self.fluid.O2 > 0.7:
            return 0
        # Acidic only — H₂S dominant in pH < 5.
        if self.fluid.pH > 5:
            return 0
        # Base-metal sulfide capture — Fe+Cu+Pb+Zn together gate the
        # native S window. Each metal preferentially binds S into a
        # sulfide before the synproportionation reaction can fire.
        metal_sum = self.fluid.Fe + self.fluid.Cu + self.fluid.Pb + self.fluid.Zn
        if metal_sum > 100:
            return 0
        # Activity factor — at S=2700 (Coorong sabkha) σ would be huge
        # without a cap. Cap at S/200 to keep within reasonable range.
        s_f = min(self.fluid.S / 200.0, 4.0)
        # Eh-boundary preference — peak in the middle (O2 ≈ 0.4).
        eh_dist = abs(self.fluid.O2 - 0.4)
        eh_f = max(0.4, 1.0 - 2.0 * eh_dist)  # peak at 0.4, half-life 0.3
        # Acidic preference — stronger at lower pH.
        ph_f = max(0.4, 1.0 - 0.15 * self.fluid.pH)
        sigma = s_f * eh_f * ph_f
        # T preference — α-S sweet spot 20-95°C, drops sharply above.
        T = self.temperature
        if 20 <= T <= 95:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.6
        elif T <= 119:
            T_factor = max(0.5, 1.2 - 0.025 * (T - 95))
        elif T < 200:
            T_factor = max(0.3, 0.5 - 0.005 * (T - 119))  # fumarole tail
        else:
            T_factor = 0.0  # melts above 115; no growth
        sigma *= T_factor
        return max(sigma, 0)

    def supersaturation_native_arsenic(self) -> float:
        """Native arsenic (As⁰) — the residual-overflow native element.

        The "leftovers" mineral: native As only forms when As is in
        the fluid AND every other element that wants As (Fe → arsenopyrite,
        Ni → nickeline, Co → safflorite, S → realgar/orpiment) has
        already had its share. Same depletion-overflow logic as
        native_silver, but the gates are reversed: instead of needing
        S to be absent, we need *all the As consumers* to be absent.

        Hard gates:
          • S > 10 → 0 (As goes into realgar/orpiment/arsenopyrite)
          • Fe > 50 → 0 (As goes into arsenopyrite preferentially)
          • O₂ > 0.5 → 0 (oxidizing fluid takes As to scorodite/AsO₄)
        Soft preference: pH 4-7, T 150-300°C optimum.

        Geologically: every famous native-As locality (Freiberg
        Saxony, Sainte-Marie-aux-Mines Alsace, Příbram Czech) is a
        Co-Ni-Ag vein deposit where Co/Ni/Ag captured the metals first
        and S was already locked into other arsenides — so the residual
        As had nothing to bond with except itself.

        Source: research/research-native-arsenic.md (boss commit
        f2939da); Petruk 1971 (Cobalt-Ag paragenesis).
        """
        if self.fluid.As < 5:
            return 0
        # S overflow gate — As goes to realgar/orpiment/arsenopyrite first.
        if self.fluid.S > 10.0:
            return 0
        # Fe overflow gate — As goes to arsenopyrite preferentially.
        if self.fluid.Fe > 50.0:
            return 0
        # Strongly reducing — oxidizing fluid takes As to arsenate.
        if self.fluid.O2 > 0.5:
            return 0
        # Activity factor — high As required to overcome the kinetic
        # barrier to native-metalloid nucleation.
        as_f = min(self.fluid.As / 30.0, 3.0)
        # Reducing preference.
        red_f = max(0.4, 1.0 - self.fluid.O2 * 1.8)
        # Soft S suppression — even sub-threshold S lowers yield.
        s_suppr = max(0.4, 1.0 - self.fluid.S / 12.0)
        sigma = as_f * red_f * s_suppr
        # T window — peak 150-300°C.
        T = self.temperature
        if 150 <= T <= 300:
            T_factor = 1.2
        elif T < 100:
            T_factor = 0.3
        elif T < 150:
            T_factor = 0.3 + 0.018 * (T - 100)
        elif T <= 350:
            T_factor = max(0.5, 1.2 - 0.014 * (T - 300))
        else:
            T_factor = 0.3
        sigma *= T_factor
        # pH preference 4-7.
        if self.fluid.pH < 3 or self.fluid.pH > 8:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_native_silver(self) -> float:
        """Native silver (Ag⁰) — the Kongsberg wire-silver mineral.

        The S-depletion mineral: native silver only forms where every
        sulfur atom is already claimed (the Ag-HS complex equilibrium
        breaks down) AND the fluid is strongly reducing (Ag⁺ → Ag⁰).
        Geologically authentic — every famous wire-silver locality
        sits in a sulfide-depleted reducing pocket: Kongsberg's
        calcite-vein basement (no nearby sulfide source), Cobalt
        Ontario's cobalt-nickel-arsenide veins (Co/Ni/As consume S
        before Ag arrives), Keweenaw's basalt amygdules (no S in
        the host).

        This is the *inverse* of the priority chains in the
        beryl/corundum families. There the high-priority variant
        fires when its chromophore is present; here native_silver
        fires when its competitor's reagent (S²⁻) is *absent*. First
        depletion-gate engine in the sim.

        Source: research/research-native-silver.md (boss commit
        f2939da); Boyle 1968 (GSA Bulletin 79); Kissin & Mango 2014
        (CIM Special Volume 54, on Cobalt-Ag deposits).
        """
        # Hard threshold — Ag must be supersaturated enough to overcome
        # the kinetic barrier to native-metal nucleation.
        if self.fluid.Ag < 1.0:
            return 0
        # S-depletion gate — the chemistry novelty. Above 2 ppm S, all
        # available Ag goes into acanthite first (preferred sulfide
        # stability). Hard zero, no soft rolloff.
        if self.fluid.S > 2.0:
            return 0
        # Strongly reducing — Ag⁺ → Ag⁰ requires a low-Eh fluid. Above
        # 0.3 the Ag stays in solution as Ag⁺ (or as Ag-Cl complexes).
        if self.fluid.O2 > 0.3:
            return 0
        # Ag activity factor — even fractional ppm is hugely
        # supersaturated against native-metal equilibrium.
        ag_f = min(self.fluid.Ag / 2.0, 3.0)
        # Reducing preference — stronger than acanthite, mirrors
        # native_copper.
        red_f = max(0.3, 1.0 - self.fluid.O2 * 2.5)
        # Sulfide suppression — any residual S lowers yield.
        s_f = max(0.2, 1.0 - self.fluid.S / 4.0)
        sigma = ag_f * red_f * s_f
        # T window — peak 100-200°C (epithermal wire-silver), tapers above.
        T = self.temperature
        if 100 <= T <= 200:
            T_factor = 1.2
        elif T < 50:
            T_factor = 0.4
        elif T < 100:
            T_factor = 0.4 + 0.016 * (T - 50)  # 50→0.4 ramps to 100→1.2
        elif T <= 300:
            T_factor = max(0.4, 1.2 - 0.008 * (T - 200))
        else:
            T_factor = 0.3
        sigma *= T_factor
        # pH preference — neutral 5-7 sweet spot, narrower than acanthite
        # because native metals tend to be acid-sensitive.
        if self.fluid.pH < 4 or self.fluid.pH > 9:
            sigma *= 0.6
        return max(sigma, 0)

    def supersaturation_rosasite(self) -> float:
        """Rosasite ((Cu,Zn)₂(CO₃)(OH)₂) — Cu-dominant supergene carbonate.

        First mineral in the sim with the **broth-ratio branching** mechanic
        (Round 9a). Rosasite and aurichalcite consume the same elements
        (Cu + Zn + CO₃) but the Cu:Zn ratio in the fluid determines which
        species nucleates: rosasite when Cu/(Cu+Zn) > 0.5, aurichalcite
        when Zn/(Cu+Zn) > 0.5. Same parent fluid, different outcome —
        the first non-presence/absence chemistry gate in the simulator.

        Forms velvety blue-green botryoidal spheres on supergene oxidation
        zones where chalcopyrite + sphalerite weather together. Type
        locality: Rosas Mine, Sardinia (1908). Most aesthetic specimens
        come from Mapimi (Mexico) and Tsumeb (Namibia).

        Source: research/research-rosasite.md (boss commit 3bfdf4a);
        Pinch & Wilson 1977 (Tsumeb monograph).
        """
        # Required ingredients — Cu, Zn, CO3 all present
        if self.fluid.Cu < 5 or self.fluid.Zn < 3 or self.fluid.CO3 < 30:
            return 0
        # Hard T-gate — supergene/ambient only
        if self.temperature < 10 or self.temperature > 40:
            return 0
        # Oxidizing requirement (supergene zone)
        if self.fluid.O2 < 0.8:
            return 0
        # pH gate — near-neutral to mildly alkaline (carbonate stable)
        if self.fluid.pH < 6.5:
            return 0

        # Broth-ratio branching — Cu-dominant gives rosasite, Zn-dominant
        # gives aurichalcite. Hard zero on the wrong side; the dominant
        # element wins the ratio race.
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        cu_fraction = self.fluid.Cu / cu_zn_total  # safe — Cu>=5 gate above
        if cu_fraction < 0.5:
            return 0

        # Activity factors — Cu and Zn are both moderate (not trace) here
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        zn_f = min(self.fluid.Zn / 25.0, 2.0)
        co3_f = min(self.fluid.CO3 / 100.0, 2.0)
        sigma = cu_f * zn_f * co3_f

        # Cu-fraction sweet spot — peak at 0.55-0.85 (Cu-rich but with real
        # Zn participation). Pure-Cu fluid (>0.95) gets damped because
        # malachite and azurite take that territory.
        if 0.55 <= cu_fraction <= 0.85:
            sigma *= 1.3
        elif cu_fraction > 0.95:
            sigma *= 0.5

        # T optimum — 15-30°C
        T = self.temperature
        if 15 <= T <= 30:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)  # 10→0.6 ramps to 15→0.8
        else:  # 30 < T <= 40
            T_factor = max(0.5, 1.2 - 0.07 * (T - 30))
        sigma *= T_factor

        # Fe inhibitor — high Fe diverts to siderite
        if self.fluid.Fe > 60:
            sigma *= 0.6

        return max(sigma, 0)

    def supersaturation_aurichalcite(self) -> float:
        """Aurichalcite ((Zn,Cu)₅(CO₃)₂(OH)₆) — Zn-dominant supergene carbonate.

        Mirror of rosasite in the broth-ratio branching pair (Round 9a).
        Same parent fluid, opposite outcome: nucleates only when
        Zn/(Cu+Zn) > 0.5. Pale blue-green tufted divergent sprays with
        high birefringence; hardness 2 (scratches with a fingernail).

        Named for Plato's mythical orichalcum — the lost gold-alloy of
        Atlantis. Type locality: Loktevskoye Mine, Western Siberia (1839);
        the most aesthetic specimens come from Mapimi, Mexico (in
        intergrowth with rosasite).

        Source: research/research-aurichalcite.md (boss commit 3bfdf4a).
        """
        # Required ingredients — Zn-dominant
        if self.fluid.Zn < 5 or self.fluid.Cu < 3 or self.fluid.CO3 < 30:
            return 0
        # Hard T-gate — supergene/ambient
        if self.temperature < 10 or self.temperature > 40:
            return 0
        # Oxidizing requirement
        if self.fluid.O2 < 0.8:
            return 0
        # pH gate — slightly more alkaline-leaning than rosasite, but
        # still mildly acidic-tolerant. Research file gives 7-9 as the
        # idealized "stable" range, but real Tsumeb supergene fluids
        # active for aurichalcite have been measured at 5.5-7.5 (Pinch
        # & Wilson 1977; Brady & Walther 1989 on supergene assemblages).
        # 6.0 brings the canonical Tsumeb-anchored scenario both pre-acid
        # (pH=6.8) and post-meteoric-flush (pH=6.2) windows into range,
        # matching the empirical observation that aurichalcite is a
        # diagnostic Tsumeb mineral. Lower bound stops short of the
        # acid-dissolution threshold (5.0 in grow_aurichalcite).
        if self.fluid.pH < 6.0:
            return 0

        # Broth-ratio branching — Zn-dominant gives aurichalcite
        cu_zn_total = self.fluid.Cu + self.fluid.Zn
        zn_fraction = self.fluid.Zn / cu_zn_total
        if zn_fraction < 0.5:
            return 0

        # Activity factors
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        zn_f = min(self.fluid.Zn / 25.0, 2.0)
        co3_f = min(self.fluid.CO3 / 100.0, 2.0)
        sigma = cu_f * zn_f * co3_f

        # Zn-fraction sweet spot — peak at 0.55-0.85 (Zn-rich but with real
        # Cu participation). Pure-Zn fluid (>0.95) gets damped because
        # smithsonite and hydrozincite compete there.
        if 0.55 <= zn_fraction <= 0.85:
            sigma *= 1.3
        elif zn_fraction > 0.95:
            sigma *= 0.5

        # T optimum — 15-28°C, slightly cooler-favoring than rosasite
        T = self.temperature
        if 15 <= T <= 28:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)
        else:  # 28 < T <= 40
            T_factor = max(0.5, 1.2 - 0.06 * (T - 28))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_torbernite(self) -> float:
        """Torbernite (Cu(UO₂)₂(PO₄)₂·12H₂O) — Cu-branch of the autunite-group
        cation+anion fork (Round 9b shipped the anion fork P-vs-As;
        Round 9c widened to P-vs-As-vs-V; Round 9d added the Cu-vs-Ca
        cation fork that pairs torbernite against autunite).

        Two ratio gates now apply:
        - Anion: P/(P+As+V) > 0.5 — torbernite is the P-branch
        - Cation: Cu/(Cu+Ca) > 0.5 — torbernite is the Cu-branch
                 (autunite is the Ca-branch on the same anion side).

        Forms emerald-green tabular plates flattened on {001} — looks like
        green mica. Strongly radioactive (U⁶⁺ in lattice); notably
        non-fluorescent because Cu²⁺ quenches uranyl emission. Dehydrates
        irreversibly to metatorbernite above ~75°C (handled by
        THERMAL_DECOMPOSITION).

        Source: research/research-torbernite.md (boss commit 3bfdf4a);
        research/research-uraninite.md §164-178 (paragenetic chain);
        Schneeberg type locality (Saxony Ore Mountains).
        """
        # Required ingredients — all four
        if (self.fluid.Cu < 5 or self.fluid.U < 0.3
                or self.fluid.P < 1.0 or self.fluid.O2 < 0.8):
            return 0
        # T-gate — supergene oxidation zone (above 50°C → metatorbernite
        # is favored; we don't grow that variant here, just block).
        if self.temperature < 10 or self.temperature > 50:
            return 0
        # pH gate — slightly acidic to neutral (5-7 per research)
        if self.fluid.pH < 5.0 or self.fluid.pH > 7.5:
            return 0
        # Anion competition — P must dominate over As + V (the 9b/9c
        # anion fork). Denominator is P+As+V so V-rich fluid routes to
        # carnotite, As-rich to zeunerite.
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        p_fraction = self.fluid.P / anion_total
        if p_fraction < 0.5:
            return 0
        # Cation competition — Cu must dominate over Ca (the 9d cation
        # fork). Denominator is Cu+Ca so Ca-dominant groundwater routes
        # to autunite. Pre-9d torbernite would have fired even in Ca-
        # saturated fluids if Cu>=5, which is geologically wrong (real
        # torbernite is rare; autunite is common).
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        cu_fraction = self.fluid.Cu / cation_total
        if cu_fraction < 0.5:
            return 0

        # Activity factors — U is trace, Cu and P are moderate
        u_f = min(self.fluid.U / 2.0, 2.0)
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        p_f = min(self.fluid.P / 10.0, 2.0)
        sigma = u_f * cu_f * p_f

        # P-fraction sweet spot — 0.55-0.85 mirrors 9a's tuning.
        if 0.55 <= p_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 15-40°C
        T = self.temperature
        if 15 <= T <= 40:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)
        else:  # 40 < T <= 50
            T_factor = max(0.4, 1.2 - 0.08 * (T - 40))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_autunite(self) -> float:
        """Autunite (Ca(UO₂)₂(PO₄)₂·11H₂O) — Ca-branch of the autunite-group
        cation+anion fork (Round 9d, May 2026).

        The Ca-cation analog of torbernite. Same parent fluid (U + P +
        supergene-T + oxidizing), same anion competition (P-branch), but
        wins when Ca/(Cu+Ca) > 0.5 — which is the geological default,
        because Ca >>> Cu in groundwater. Real autunite is far more common
        than torbernite; mining-museum bias has it backwards.

        The defining feature: where torbernite's Cu²⁺ quenches the uranyl
        emission, autunite's Ca²⁺ does not. Under longwave UV (365nm),
        autunite glows intense apple-green — one of the brightest
        fluorescent species known. This is the cation fork's narrative
        payoff: same uranyl, opposite glow.

        Forms canary-yellow tabular plates flattened on {001}, mohs 2-2.5,
        dehydrates irreversibly to meta-autunite (8H₂O) above ~80°C.
        Type locality: Saint-Symphorien, Autun, France (Adrien Brongniart,
        1852).

        Source: research/research-uraninite.md §Variants for Game §4
        (boss canonical 626bb22, May 2026).
        """
        # Required ingredients — Ca floor at 15 (typical groundwater
        # baseline; for context Cu floor is 5 because Cu is naturally
        # rarer, so a Cu>=5 fluid is already enriched, while Ca>=15 is
        # only just above seawater background)
        if (self.fluid.Ca < 15 or self.fluid.U < 0.3
                or self.fluid.P < 1.0 or self.fluid.O2 < 0.8):
            return 0
        # T-gate — supergene zone, slightly wider than torbernite because
        # autunite forms at colder spring/groundwater temps too
        if self.temperature < 5 or self.temperature > 50:
            return 0
        # pH gate — broader than torbernite (Ca²⁺ doesn't form the same
        # acid-side complexes Cu does)
        if self.fluid.pH < 4.5 or self.fluid.pH > 8.0:
            return 0
        # Anion fork — same as torbernite/zeunerite/carnotite
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        p_fraction = self.fluid.P / anion_total
        if p_fraction < 0.5:
            return 0
        # Cation fork — Ca must dominate over Cu (the 9d gate, mirror of
        # torbernite's Cu>0.5)
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        ca_fraction = self.fluid.Ca / cation_total
        if ca_fraction < 0.5:
            return 0

        # Activity factors — U is trace; Ca is abundant; P is moderate
        u_f = min(self.fluid.U / 2.0, 2.0)
        ca_f = min(self.fluid.Ca / 50.0, 2.0)
        p_f = min(self.fluid.P / 10.0, 2.0)
        sigma = u_f * ca_f * p_f

        # P-fraction sweet spot — mirrors torbernite shape
        if 0.55 <= p_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 10-35°C (slightly cooler than torbernite's 15-40,
        # reflecting the more groundwater/spring-temp character)
        T = self.temperature
        if 10 <= T <= 35:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.5 + 0.07 * (T - 5)  # 5→0.5, 10→1.2
        else:  # 35 < T <= 50
            T_factor = max(0.4, 1.2 - 0.08 * (T - 35))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_zeunerite(self) -> float:
        """Zeunerite (Cu(UO₂)₂(AsO₄)₂·xH₂O) — As-branch / Cu-cation of the
        autunite-group cation+anion fork (Round 9b/9e).

        9b shipped the As/(P+As) anion gate; 9c widened the denominator
        to P+As+V; 9e added the Cu/(Cu+Ca) cation gate to fork against
        uranospinite (Ca-cation analog). Two ratio gates now apply:
        - Anion: As/(P+As+V) > 0.5
        - Cation: Cu/(Cu+Ca) > 0.5

        Mirror of torbernite (Cu-P branch). Same crystal system, same
        tabular habit; distinguishable from torbernite only by chemistry.
        The arsenic is the giveaway: zeunerite localities are former
        mining districts with arsenopyrite or tennantite as primary As ores.

        Sources: research/research-zeunerite.md (boss commit 3bfdf4a);
        research/research-uranospinite.md (Round 9e cation fork);
        Schneeberg type locality (1872).
        """
        # Required ingredients
        if (self.fluid.Cu < 5 or self.fluid.U < 0.3
                or self.fluid.As < 2.0 or self.fluid.O2 < 0.8):
            return 0
        if self.temperature < 10 or self.temperature > 50:
            return 0
        if self.fluid.pH < 5.0 or self.fluid.pH > 7.5:
            return 0

        # Anion competition — As must dominate over P + V
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        as_fraction = self.fluid.As / anion_total
        if as_fraction < 0.5:
            return 0
        # Cation competition (Round 9e) — Cu must dominate over Ca.
        # Mirror of torbernite's Round 9d gate. Without this, zeunerite
        # would fire in Ca-saturated groundwater that should route to
        # uranospinite.
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        cu_fraction = self.fluid.Cu / cation_total
        if cu_fraction < 0.5:
            return 0

        # Activity factors
        u_f = min(self.fluid.U / 2.0, 2.0)
        cu_f = min(self.fluid.Cu / 25.0, 2.0)
        as_f = min(self.fluid.As / 15.0, 2.0)
        sigma = u_f * cu_f * as_f

        # As-fraction sweet spot
        if 0.55 <= as_fraction <= 0.85:
            sigma *= 1.3

        # T optimum
        T = self.temperature
        if 15 <= T <= 40:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.6 + 0.04 * (T - 10)
        else:
            T_factor = max(0.4, 1.2 - 0.08 * (T - 40))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_uranospinite(self) -> float:
        """Uranospinite (Ca(UO₂)₂(AsO₄)₂·10H₂O) — As-branch / Ca-cation of
        the autunite-group cation+anion fork (Round 9e, May 2026).

        Ca-cation analog of zeunerite. Same parent fluid (U + As +
        supergene-T + oxidizing) but wins when Ca/(Cu+Ca) > 0.5 — typically
        when Cu has been depleted from the local fluid but As is still
        around. Strongly fluorescent yellow-green LW UV — Ca²⁺ doesn't
        quench uranyl emission like Cu²⁺ does in zeunerite (mirroring the
        autunite-vs-torbernite story on the As-branch).

        Sources: research/research-uranospinite.md (implementation-grade
        draft, 2026-05-01); MSA Handbook of Mineralogy; Schneeberg
        Walpurgis Flacher vein type locality (Weisbach 1873).
        """
        # Required ingredients — Ca floor at 15 (typical groundwater)
        if (self.fluid.Ca < 15 or self.fluid.U < 0.3
                or self.fluid.As < 2.0 or self.fluid.O2 < 0.8):
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        # pH window broader than zeunerite — Ca²⁺ doesn't form acid-side
        # complexes the way Cu²⁺ does
        if self.fluid.pH < 4.5 or self.fluid.pH > 8.0:
            return 0
        # Anion fork — As must dominate over P + V
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        as_fraction = self.fluid.As / anion_total
        if as_fraction < 0.5:
            return 0
        # Cation fork — Ca must dominate over Cu (mirror of zeunerite)
        cation_total = self.fluid.Cu + self.fluid.Ca
        if cation_total <= 0:
            return 0
        ca_fraction = self.fluid.Ca / cation_total
        if ca_fraction < 0.5:
            return 0

        # Activity factors — Ca activity referenced at 50 ppm (groundwater
        # baseline), mirror autunite
        u_f = min(self.fluid.U / 2.0, 2.0)
        ca_f = min(self.fluid.Ca / 50.0, 2.0)
        as_f = min(self.fluid.As / 15.0, 2.0)
        sigma = u_f * ca_f * as_f

        # As-fraction sweet spot
        if 0.55 <= as_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 10-35°C (mirror autunite)
        T = self.temperature
        if 10 <= T <= 35:
            T_factor = 1.2
        elif T < 10:
            T_factor = 0.5 + 0.07 * (T - 5)
        else:
            T_factor = max(0.4, 1.2 - 0.08 * (T - 35))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_carnotite(self) -> float:
        """Carnotite (K₂(UO₂)₂(VO₄)₂·3H₂O) — V-branch of the autunite-group
        anion-competition trio (Round 9c).

        Singleton — completes the 3-branch generalization started in 9a's
        broth-ratio mechanic. Different cation (K instead of Cu),
        different crystal system (monoclinic vs tetragonal), different
        habit (canary-yellow earthy crusts vs emerald tabular plates),
        same anion-competition mechanic. Nucleates when V/(P+As+V) > 0.5.

        Forms where oxidizing groundwater carries U⁶⁺ + V⁵⁺ + K⁺ together
        at the supergene front. Colorado Plateau sandstone-hosted uranium
        deposits are the type environment — one percent of carnotite
        stains an entire outcrop the color of school buses, which is
        how those districts were prospected before instruments.

        Source: research/research-carnotite.md (boss commit 3bfdf4a);
        Roc Creek type locality (1899).
        """
        # Required ingredients — K, U, V
        if (self.fluid.K < 5 or self.fluid.U < 0.3
                or self.fluid.V < 1.0 or self.fluid.O2 < 0.8):
            return 0
        # T-gate — supergene/ambient (above 50°C the structure dehydrates,
        # collapses around 100°C)
        if self.temperature < 10 or self.temperature > 50:
            return 0
        # pH gate — V is mobile as VO₄³⁻ above pH 6 (Brookins 1988 Eh-pH);
        # below pH 5 the chemistry breaks and acid dissolution kicks in.
        # 5.0-7.5 stability window.
        if self.fluid.pH < 5.0 or self.fluid.pH > 7.5:
            return 0
        # Anion competition — V must dominate over P + As (the carnotite
        # branch of the trio).
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        v_fraction = self.fluid.V / anion_total
        if v_fraction < 0.5:
            return 0
        # Cation competition (Round 9e) — K must dominate over Ca.
        # Mirror of the torbernite/zeunerite cation forks. Without this,
        # carnotite would fire in Ca-saturated groundwater that should
        # route to tyuyamunite.
        cation_total = self.fluid.K + self.fluid.Ca
        if cation_total <= 0:
            return 0
        k_fraction = self.fluid.K / cation_total
        if k_fraction < 0.5:
            return 0

        # Activity factors — U is trace; K is moderate; V is sparse-trace.
        u_f = min(self.fluid.U / 2.0, 2.0)
        k_f = min(self.fluid.K / 30.0, 2.0)
        v_f = min(self.fluid.V / 10.0, 2.0)
        sigma = u_f * k_f * v_f

        # V-fraction sweet spot — same shape as torbernite/zeunerite
        if 0.55 <= v_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 20-40°C (slightly warmer-leaning than tor/zeu since
        # Colorado Plateau roll-fronts sit in arid surface-T conditions)
        T = self.temperature
        if 20 <= T <= 40:
            T_factor = 1.2
        elif T < 20:
            T_factor = 0.5 + 0.07 * (T - 10)  # 10→0.5 ramps to 20→1.2
        else:  # 40 < T <= 50
            T_factor = max(0.4, 1.2 - 0.08 * (T - 40))
        sigma *= T_factor

        return max(sigma, 0)

    def supersaturation_tyuyamunite(self) -> float:
        """Tyuyamunite (Ca(UO₂)₂(VO₄)₂·5-8H₂O) — V-branch / Ca-cation of
        the autunite-group cation+anion fork (Round 9e, May 2026).

        Ca-cation analog of carnotite. Same parent fluid (U + V +
        supergene-T + oxidizing) but wins when Ca/(K+Ca) > 0.5 — the
        geological default in sandstone groundwater where Ca dominates
        K. Tyuyamunite and carnotite are commonly intergrown in Colorado
        Plateau and Tyuya-Muyun deposits, with the cation ratio drawing
        the boundary between them; Britannica notes they are
        interconvertible by cation exchange.

        Weakly to moderately fluorescent yellow-green LW UV (vanadate
        matrix dampens uranyl emission via vibrational coupling, same
        effect as carnotite but slightly lifted by Ca²⁺ vs K⁺).

        Sources: research/research-tyuyamunite.md (implementation-grade
        draft, 2026-05-01); American Mineralogist v.41 (1956); Tyuya-
        Muyun, Fergana Valley type locality (Nenadkevich 1912).
        """
        # Required ingredients — Ca floor at 15
        if (self.fluid.Ca < 15 or self.fluid.U < 0.3
                or self.fluid.V < 1.0 or self.fluid.O2 < 0.8):
            return 0
        if self.temperature < 5 or self.temperature > 50:
            return 0
        # pH window — same as carnotite (V mobile as VO₄³⁻ above pH 5;
        # but slightly broader upper bound since Ca-V is more tolerant
        # of slightly alkaline groundwater)
        if self.fluid.pH < 5.0 or self.fluid.pH > 8.0:
            return 0
        # Anion fork — V must dominate over P + As
        anion_total = self.fluid.P + self.fluid.As + self.fluid.V
        if anion_total <= 0:
            return 0
        v_fraction = self.fluid.V / anion_total
        if v_fraction < 0.5:
            return 0
        # Cation fork — Ca must dominate over K (mirror of carnotite)
        cation_total = self.fluid.K + self.fluid.Ca
        if cation_total <= 0:
            return 0
        ca_fraction = self.fluid.Ca / cation_total
        if ca_fraction < 0.5:
            return 0

        # Activity factors
        u_f = min(self.fluid.U / 2.0, 2.0)
        ca_f = min(self.fluid.Ca / 50.0, 2.0)
        v_f = min(self.fluid.V / 10.0, 2.0)
        sigma = u_f * ca_f * v_f

        # V-fraction sweet spot
        if 0.55 <= v_fraction <= 0.85:
            sigma *= 1.3

        # T optimum — 15-35°C (mirror tyuyamunite's research §formation T)
        T = self.temperature
        if 15 <= T <= 35:
            T_factor = 1.2
        elif T < 15:
            T_factor = 0.5 + 0.07 * (T - 5)
        else:
            T_factor = max(0.4, 1.2 - 0.08 * (T - 35))
        sigma *= T_factor

        return max(sigma, 0)


# ============================================================
# CRYSTAL MODELS
# ============================================================

@dataclass
class GrowthZone:
    """A single growth zone — one layer of the crystal's history."""
    step: int
    temperature: float
    thickness_um: float          # micrometers
    growth_rate: float           # µm per step
    trace_Fe: float = 0.0       # ppm incorporated
    trace_Mn: float = 0.0
    trace_Al: float = 0.0
    trace_Ti: float = 0.0
    trace_Pb: float = 0.0       # Pb — amazonite, galena inclusions
    trace_Au: float = 0.0       # Au — invisible-gold trace (arsenopyrite
                                # structurally traps up to 1500 ppm Au);
                                # released to fluid on supergene oxidation,
                                # feeding native_gold re-precipitation in
                                # the oxidation zone.
    radiation_damage: float = 0.0  # cumulative α-dose (arbitrary units). Quartz
                                   # zones irradiated by nearby uraninite accrue
                                   # damage step-by-step; ≥0.3 averaged across
                                   # zones starts to read as smoky.
    fluid_inclusion: bool = False
    inclusion_type: str = ""     # "2-phase", "3-phase", "vapor-rich"
    note: str = ""
    # Provenance tracking — where did the building material come from?
    ca_from_wall: float = 0.0    # fraction of Ca²⁺ derived from wall dissolution (0-1)
    ca_from_fluid: float = 0.0   # fraction from original fluid
    is_phantom: bool = False     # marks a dissolution surface (phantom boundary)
    dissolution_depth_um: float = 0.0  # how much was dissolved at this boundary


@dataclass
class Crystal:
    """A growing crystal in the vug."""
    mineral: str
    crystal_id: int
    nucleation_step: int
    nucleation_temp: float
    position: str                  # "vug wall", "on sphalerite", etc.
    
    # Dimensions (simplified — c-axis and a-axis for hexagonal/trigonal)
    c_length_mm: float = 0.0      # length along c-axis
    a_width_mm: float = 0.0       # width perpendicular to c
    
    # Morphology
    habit: str = "prismatic"       # prismatic, tabular, acicular, massive, rhombohedral, etc.
    dominant_forms: List[str] = field(default_factory=list)
    twinned: bool = False
    twin_law: str = ""
    # Growth-vector footprint (chosen from data/minerals.json habit_variants
    # at nucleation time based on σ / T / available space). Drives the topo
    # map: wall_spread governs lateral coverage along the wall, void_reach
    # governs projection into the vug interior. `vector` is the categorical
    # style (projecting / coating / tabular / equant / dendritic).
    wall_spread: float = 0.5
    void_reach: float = 0.5
    vector: str = "equant"
    # Anchor cell on the wall where this crystal nucleated. Combined
    # with `wall_ring_index` (below) it identifies the (ring, cell)
    # the crystal sits on. WallState.paint_crystal() grows outward
    # from here by wall_spread × total_growth.
    wall_center_cell: Optional[int] = None
    # Phase C v1: which ring the crystal nucleated on (0 = south pole
    # / floor, ring_count-1 = north pole / ceiling). None means legacy
    # ring-0 placement (loaded from a pre-Phase-C-v1 save). New
    # nucleations always set this. Growth reads the ring's fluid +
    # temperature for chemistry; paint targets this ring's cells.
    wall_ring_index: Optional[int] = None
    
    # Growth history
    zones: List[GrowthZone] = field(default_factory=list)
    total_growth_um: float = 0.0
    
    # State
    active: bool = True            # still growing?
    dissolved: bool = False        # partially dissolved?
    
    # Enclosure tracking — crystals that got swallowed by this one
    enclosed_crystals: List[int] = field(default_factory=list)  # crystal_ids enclosed
    enclosed_at_step: List[int] = field(default_factory=list)   # step when enclosure happened
    enclosed_by: Optional[int] = None  # crystal_id that enclosed THIS crystal
    
    # Phantom tracking — dissolution surfaces preserved as internal boundaries
    phantom_surfaces: List[int] = field(default_factory=list)  # zone indices where dissolution occurred
    phantom_count: int = 0         # number of phantom boundaries

    # Paramorph tracking — set by apply_paramorph_transitions when the crystal
    # crosses a phase-transition T threshold (first instance: argentite → acanthite
    # at 173°C, Round 8a-2). Stores the *original* (pre-transition) mineral name
    # so library + narrator can flag the cubic-acanthite-after-argentite case.
    paramorph_origin: Optional[str] = None
    paramorph_step: Optional[int] = None      # step on which the paramorph fired

    def add_zone(self, zone: GrowthZone):
        # Detect phantom boundaries — dissolution followed by regrowth
        if zone.thickness_um < 0:
            zone.is_phantom = True
            zone.dissolution_depth_um = abs(zone.thickness_um)
            self.phantom_surfaces.append(len(self.zones))
            self.phantom_count += 1
        elif self.zones and self.zones[-1].thickness_um < 0 and zone.thickness_um > 0:
            # This zone is growing OVER a dissolution surface — mark the boundary
            zone.note = (zone.note + " [phantom boundary — growing over dissolution surface]").strip()
        
        self.zones.append(zone)
        self.total_growth_um += zone.thickness_um
        self.total_growth_um = max(self.total_growth_um, 0)  # can't go negative
        self.c_length_mm = self.total_growth_um / 1000.0
        # Width grows slower than length for prismatic habit
        if self.habit == "prismatic":
            self.a_width_mm = self.c_length_mm * 0.4
        elif self.habit == "tabular":
            self.a_width_mm = self.c_length_mm * 1.5
        elif self.habit == "acicular":
            self.a_width_mm = self.c_length_mm * 0.15
        elif self.habit == "rhombohedral":
            self.a_width_mm = self.c_length_mm * 0.8
        else:
            self.a_width_mm = self.c_length_mm * 0.5
    
    def describe_morphology(self) -> str:
        forms = ", ".join(self.dominant_forms) if self.dominant_forms else self.habit
        twin_str = f", {self.twin_law} twin" if self.twinned else ""
        size = f"{self.c_length_mm:.1f} × {self.a_width_mm:.1f} mm"
        return f"{self.habit} [{forms}]{twin_str}, {size}"
    
    def describe_latest_zone(self) -> str:
        if not self.zones:
            return "no growth"
        z = self.zones[-1]
        parts = [f"+{z.thickness_um:.1f} µm"]
        traces = []
        if z.trace_Fe > 1:
            traces.append(f"Fe {z.trace_Fe:.1f}")
        if z.trace_Mn > 0.5:
            traces.append(f"Mn {z.trace_Mn:.1f}")
        if z.trace_Ti > 0.1:
            traces.append(f"Ti {z.trace_Ti:.2f}")
        if z.trace_Al > 1:
            traces.append(f"Al {z.trace_Al:.1f}")
        if traces:
            parts.append(f"traces: {', '.join(traces)} ppm")
        if z.fluid_inclusion:
            parts.append(f"fluid inclusion ({z.inclusion_type})")
        if z.note:
            parts.append(z.note)
        return "; ".join(parts)
    
    def predict_color(self) -> str:
        """Predict visible color based on trace element history and mineral type."""
        if not self.zones:
            return "colorless"
        
        avg_Fe = sum(z.trace_Fe for z in self.zones) / len(self.zones)
        avg_Mn = sum(z.trace_Mn for z in self.zones) / len(self.zones)
        avg_Al = sum(z.trace_Al for z in self.zones) / len(self.zones)
        avg_Ti = sum(z.trace_Ti for z in self.zones) / len(self.zones)
        avg_rad = sum(z.radiation_damage for z in self.zones) / len(self.zones)

        if self.mineral == "quartz":
            # Quartz color depends on trace elements + actual radiation dose
            # integrated across growth zones. Thresholds match the color_rules
            # block in data/minerals.json — pegmatite-grade dose + trace Al
            # produces smoky quartz even when Al is sub-ppm.
            if avg_rad > 0.6:
                if avg_Fe > 3.0 and avg_Al > 1.0:
                    return "dark smoky amethyst — heavy α-dose, Al + Fe color centers"
                if avg_Al > 0.3:
                    return "dark smoky to morion — heavy α-damage in Al-bearing lattice"
                return "faintly smoky — heavy α-dose but Al-starved lattice"
            if avg_rad > 0.3:
                if avg_Fe > 3.0 and avg_Al > 1.0:
                    return "smoky amethyst — α-damage plus Fe³⁺ color centers (zoned)"
                if avg_Al > 0.3:
                    return "smoky — α-damage activated Al-hole color centers"
                if avg_Fe > 3.0:
                    return "amethyst — Fe³⁺ color centers activated by radiation"
                return "pale smoky tint — moderate α-dose, Al-poor lattice"
            if avg_rad > 0.1:
                return "pale smoky tint — modest α-dose"
            if avg_Fe > 3.0 and avg_Al > 3.0:
                return ("iron+aluminum bearing — amethyst if irradiated (Fe³⁺ color centers), "
                        "smoky if Al-dominated radiation damage, citrine if heated")
            elif avg_Fe > 3.0:
                return ("iron-bearing — potential amethyst (needs radiation to activate "
                        "Fe³⁺ color centers), citrine if heated, colorless without radiation")
            elif avg_Al > 5.0:
                return "aluminum-bearing — smoky quartz if irradiated (Al-hole color centers)"
            elif avg_Fe > 1.0:
                return "trace iron — pale citrine possible, likely colorless"
            else:
                return "water-clear (low trace elements)"
        
        elif self.mineral == "calcite":
            # Calcite color: Fe = amber/brown/black, Mn = pink/orange, pure = white/colorless
            # This is Professor's observation about amber/black calcite
            if avg_Fe > 5.0:
                if avg_Fe > 15.0:
                    return "dark brown to black (high iron — opaque in thick sections)"
                elif avg_Fe > 8.0:
                    return "amber to brown (moderate iron)"
                else:
                    return "pale amber/honey (low iron)"
            elif avg_Mn > 3.0 and avg_Fe < 3.0:
                return "pink to salmon (Mn²⁺ without Fe quenching)"
            elif avg_Mn > 1.0:
                return "cream to pale yellow"
            else:
                return "colorless to white"
        
        elif self.mineral == "sphalerite":
            # Already handled in growth zones, but summarize here
            if avg_Fe > 100:
                return "black (marmatite — high Fe substitution)"
            elif avg_Fe > 50:
                return "dark brown to ruby jack"
            elif avg_Fe > 20:
                return "honey/amber"
            else:
                return "pale yellow to colorless (cleiophane — gem quality)"
        
        elif self.mineral == "fluorite":
            # Color from zones
            if avg_Fe > 2:
                return "green (iron-related color centers)"
            elif avg_Mn > 2:
                return "purple (Mn-related)"
            else:
                return "blue-violet to colorless"
        
        elif self.mineral == "hematite":
            # Color depends on habit (recorded in zone notes)
            specular_zones = [z for z in self.zones if "specular" in z.note or "steel-gray" in z.note]
            iridescent_zones = [z for z in self.zones if "iridescent" in z.note]
            if iridescent_zones:
                return "iridescent (thin-plate interference colors, streak always red)"
            elif specular_zones:
                return "steel-gray metallic (specular, streak red)"
            else:
                return "red earthy (massive/botryoidal, streak red)"
        
        elif self.mineral == "malachite":
            # Always green — the question is what kind of green
            zone_count = len(self.zones)
            avg_cu_note = ""
            if self.zones:
                # Check for banding
                banded = any("banded" in z.note for z in self.zones)
                vivid = any("vivid" in z.note for z in self.zones)
                pale = any("pale" in z.note for z in self.zones)
                if banded:
                    return "banded green (alternating light/dark concentric layers)"
                elif vivid:
                    return "vivid green (high Cu)"
                elif pale:
                    return "pale green (Cu-depleted)"
            return "green (classic malachite)"
        
        elif self.mineral == "feldspar":
            # K-feldspar color: amazonite (Pb), orthoclase (flesh), adularia (moonstone)
            amazonite_zones = [z for z in self.zones if "amazonite" in z.note]
            adularia_zones = [z for z in self.zones if "adularia" in z.note]
            perthite_zones = [z for z in self.zones if "perthite" in z.note]
            if amazonite_zones:
                return "amazonite blue-green (Pb²⁺ → K⁺ substitution in microcline)"
            elif adularia_zones and any("moonstone" in z.note for z in adularia_zones):
                return "adularescent moonstone (thin albite intergrowths scatter light)"
            elif adularia_zones:
                return "colorless adularia"
            elif perthite_zones:
                return "perthite — flesh-colored host with white albite stringers"
            else:
                return "flesh-colored to white (typical orthoclase/microcline)"
        
        elif self.mineral == "albite":
            # Albite color: usually white/colorless, but peristerite = moonstone
            cleavelandite_zones = [z for z in self.zones if "cleavelandite" in z.note]
            peristerite_zones = [z for z in self.zones if "peristerite" in z.note]
            if peristerite_zones:
                return "peristerite moonstone (blue-white adularescence from exsolution lamellae)"
            elif cleavelandite_zones:
                return "white cleavelandite (platy lamellar)"
            else:
                return "white to colorless"
        
        return "typical for species"
    
    def predict_fluorescence(self) -> str:
        """Predict UV fluorescence based on trace element history."""
        avg_Mn = sum(z.trace_Mn for z in self.zones) / max(len(self.zones), 1)
        avg_Fe = sum(z.trace_Fe for z in self.zones) / max(len(self.zones), 1)
        
        if self.mineral == "calcite":
            if avg_Mn > 2 and avg_Fe < 10:
                return "orange-red (Mn²⁺ activated)"
            elif avg_Mn > 2 and avg_Fe > 10:
                return "weak/quenched (Fe²⁺ quenching Mn²⁺ emission)"
            else:
                return "non-fluorescent"
        elif self.mineral == "fluorite":
            return "blue-violet (REE/defect centers)"
        elif self.mineral == "quartz":
            avg_Al = sum(z.trace_Al for z in self.zones) / max(len(self.zones), 1)
            if avg_Al > 5:
                return "weak blue (Al-related defects)"
            return "non-fluorescent"
        elif self.mineral in ("pyrite", "marcasite", "chalcopyrite", "galena", "molybdenite", "tetrahedrite", "tennantite"):
            return "non-fluorescent (opaque sulfide)"
        elif self.mineral in ("sphalerite", "wurtzite"):
            # Mn²⁺ activates, Fe quenches — same as calcite
            if avg_Mn > 5 and avg_Fe < 10:
                return "orange or blue (Mn²⁺-activated; color varies by site)"
            elif avg_Mn > 5 and avg_Fe > 10:
                return "quenched (Fe²⁺ masks Mn²⁺ emission)"
            return "non-fluorescent"
        elif self.mineral == "hematite":
            return "non-fluorescent (opaque oxide)"
        elif self.mineral == "goethite":
            return "non-fluorescent (opaque hydroxide)"
        elif self.mineral == "malachite":
            return "non-fluorescent"
        elif self.mineral == "uraninite":
            # Uraninite itself is weakly fluorescent; daughter uranyl minerals are brilliant
            return "weak green-yellow (U) — daughter autunite/torbernite would glow brightly"
        elif self.mineral == "smithsonite":
            if avg_Mn > 2:
                return "pink under LW UV (Mn²⁺-activated)"
            return "non-fluorescent"
        elif self.mineral == "wulfenite":
            return "non-fluorescent (typical)"
        elif self.mineral == "selenite":
            return "non-fluorescent (typical gypsum)"
        elif self.mineral == "adamite":
            # Cu trace: low Cu → strong SW fluorescence; heavy Cu quenches
            avg_Cu = sum(getattr(z, "trace_Cu", 0.0) for z in self.zones) / max(len(self.zones), 1)
            if avg_Cu > 10:
                return "quenched (heavy Cu turns off SW emission)"
            if avg_Cu > 0.5:
                return "bright apple-green under SW UV (cuproadamite)"
            return "green-yellow under SW UV (intrinsic adamite)"
        elif self.mineral == "mimetite":
            return "orange under SW UV (intrinsic emission)"
        elif self.mineral == "feldspar":
            # Amazonite can fluoresce yellow-green under LW UV
            if any("amazonite" in z.note for z in self.zones):
                return "yellow-green under LW UV (Pb²⁺ activator in amazonite)"
            return "non-fluorescent or weak white under SW"
        elif self.mineral == "albite":
            return "weak white under LW UV (common for Na-feldspar)"
        return "unknown"


# ============================================================
# MINERAL GROWTH ENGINES (plugins)
# ============================================================

def grow_quartz(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Quartz growth model."""
    sigma = conditions.supersaturation_quartz()
    
    if sigma < 1.0:
        # Undersaturated — dissolution
        if crystal.total_growth_um > 10:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.1)
            # RECYCLING: dissolved SiO2 returns to fluid
            conditions.fluid.SiO2 += dissolved_um * 0.8
            
            # Determine dissolution type
            if conditions.fluid.pH < 4.0 and conditions.fluid.F > 20:
                note = "HF etching — trigonal etch pits on prism faces, SiO₂ dissolved as SiF₄"
            else:
                note = "dissolution — etching on prism faces"
            
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=note
            )
        return None
    
    # Growth rate: BCF spiral growth simplified
    # rate ∝ (σ - 1)² for spiral growth at low supersaturation
    # rate ∝ (σ - 1) for 2D nucleation at high supersaturation
    excess = sigma - 1.0
    if excess < 0.5:
        rate = 8.0 * excess * excess  # slow, orderly spiral growth
    else:
        rate = 4.0 * excess           # faster, may produce growth hillocks

    # Temperature effect on rate.
    #
    # History: previous formulation was exp(-3000/T_K) * 50, which was
    # calibrated for hot porphyry-style hydrothermal quartz (~400°C). At
    # mid-T (150-250°C, typical of MVT / Herkimer / Alpine / basinal
    # brines) it collapsed the prefactor to 0.03-0.09, suppressing growth
    # below the 0.1 µm "negligible" cutoff and starving scenarios where
    # quartz is actually the most prolific mineral in the field
    # (Herkimer crystals are cm-scale; sim was producing µm-scale
    # micro-crust). The BCF σ²-scaling was left alone — that is
    # physically correct, and real low-σ quartz IS slower than calcite
    # at the same σ.
    #
    # New formulation is normalised so the prefactor ≈ 1.0 at 200°C
    # (the sim's most-common working temperature), with a gentler slope
    # (activation energy ~8 kJ/mol vs 25 kJ/mol previously) that keeps
    # real T-dependence (400°C grows ~3× faster than 100°C) without
    # suppressing mid-T output:
    #   T(°C):   400    300    250    200    180    150    100    50
    #   factor: 1.87   1.44   1.22   1.00   0.90   0.78   0.56  0.38
    # The low activation energy is sim-appropriate — one step compresses
    # ~10,000 yr of real time, so quartz T-sensitivity is effectively
    # integrated down. See proposals TODO for a future refactor that
    # properly separates kinetic rate from step-duration scaling.
    rate *= math.exp(-1000.0 / (conditions.temperature + 273.15)) * 8.27
    
    # Add some natural variation
    rate *= random.uniform(0.7, 1.3)
    
    if rate < 0.1:
        return None  # negligible growth
    
    # Trace element incorporation
    # Ti incorporation increases with T (TitaniQ)
    Ti_partition = 0.01 * math.exp(0.005 * conditions.temperature)
    trace_Ti = conditions.fluid.Ti * Ti_partition
    
    # Al incorporation (smoky quartz potential)  
    Al_partition = 0.02 * (1 + 0.5 * excess)
    trace_Al = conditions.fluid.Al * Al_partition
    
    # Fe — very low partition into quartz
    trace_Fe = conditions.fluid.Fe * 0.005
    
    # Mn — trace
    trace_Mn = conditions.fluid.Mn * 0.003
    
    # Fluid inclusions — more likely at growth zone boundaries, fast growth
    fi = False
    fi_type = ""
    if rate > 15 and random.random() < 0.3:
        fi = True
        if conditions.temperature > 300:
            fi_type = "2-phase (liquid + vapor)"
        elif conditions.temperature > 200:
            fi_type = "2-phase (liquid-dominant)"
        else:
            fi_type = "single-phase liquid"
    
    # Morphology updates
    if conditions.temperature > 400:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["m{100} prism", "r{101} rhombohedron"]
    elif conditions.temperature > 250:
        crystal.habit = "prismatic"  
        crystal.dominant_forms = ["m{100} prism", "r{101}", "z{011}"]
    elif conditions.temperature > 150:
        crystal.dominant_forms = ["m{100}", "r{101}", "z{011} dominant"]
        if excess > 1.0:
            crystal.habit = "scepter overgrowth possible"
    else:
        crystal.dominant_forms = ["m{100}", "r{101}", "z{011}"]
        if excess > 1.5:
            crystal.habit = "skeletal/fenster"
    
    # Twinning — Dauphiné twin from thermal shock
    if not crystal.twinned and len(crystal.zones) > 5:
        if len(crystal.zones) >= 2:
            prev_T = crystal.zones[-1].temperature
            delta_T = abs(conditions.temperature - prev_T)
            if delta_T > 30 and random.random() < 0.15:
                crystal.twinned = True
                crystal.twin_law = "Dauphiné"
    
    note = ""
    if excess > 1.5:
        note = "rapid growth — growth hillocks developing on prism faces"
    elif excess > 1.0:
        note = "moderate supersaturation — clean layer growth"
    elif excess < 0.2:
        note = "near-equilibrium — very slow, high-quality growth"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        trace_Al=trace_Al, trace_Ti=trace_Ti,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=note
    )


def grow_calcite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Calcite growth model — retrograde solubility."""
    sigma = conditions.supersaturation_calcite()
    
    if sigma < 1.0:
        # Acid dissolution — calcite dissolves easily in acid
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.5:
            crystal.dissolved = True
            dissolved_um = min(8.0, crystal.total_growth_um * 0.15)
            # RECYCLING: Ca, CO3, and trace elements return to fluid
            conditions.fluid.Ca += dissolved_um * 0.5
            conditions.fluid.CO3 += dissolved_um * 0.3
            # Mn and Fe that were in the crystal go back into solution
            if crystal.zones:
                avg_mn = sum(z.trace_Mn for z in crystal.zones[-3:]) / min(len(crystal.zones), 3)
                avg_fe = sum(z.trace_Fe for z in crystal.zones[-3:]) / min(len(crystal.zones), 3)
                conditions.fluid.Mn += avg_mn * 0.5
                conditions.fluid.Fe += avg_fe * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Ca²⁺ + CO₃²⁻ released back to fluid"
            )
        return None  # undersaturated for calcite
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    
    # Mn incorporation — THE fluorescence activator
    Mn_partition = 0.1 * (1 + excess * 0.5)
    trace_Mn = conditions.fluid.Mn * Mn_partition
    
    # Fe incorporation — THE fluorescence QUENCHER
    Fe_partition = 0.08
    trace_Fe = conditions.fluid.Fe * Fe_partition
    
    # Provenance tracking — what fraction of Ca came from the wall?
    wall = conditions.wall
    total_ca = conditions.fluid.Ca
    ca_wall_fraction = 0.0
    ca_fluid_fraction = 1.0
    if total_ca > 0 and wall.ca_from_wall_total > 0:
        # Approximate: wall-derived Ca as fraction of total Ca in fluid
        ca_wall_fraction = min(wall.ca_from_wall_total / total_ca, 1.0)
        ca_fluid_fraction = 1.0 - ca_wall_fraction
    
    # Morphology
    if conditions.temperature > 200:
        crystal.habit = "scalenohedral"
        crystal.dominant_forms = ["v{211} scalenohedron", "dog-tooth"]
    elif conditions.temperature > 100:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["e{104} rhombohedron"]
    else:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["e{104}", "possibly nail-head"]
    
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026) —
    # see VugSimulator._roll_spontaneous_twin and data/minerals.json twin_laws.
    
    note = ""
    if trace_Mn > 1.0 and trace_Fe < 2.0:
        note = "Mn-rich zone — will fluoresce orange under UV"
    elif trace_Mn > 1.0 and trace_Fe > 2.0:
        note = "Fe quenching Mn fluorescence — dark CL zone"
    
    # Provenance note when significant wall-derived material
    if ca_wall_fraction > 0.3:
        prov_note = f"[{ca_wall_fraction*100:.0f}% recycled wall rock]"
        note = f"{note} {prov_note}".strip() if note else prov_note
    
    fi = False
    fi_type = ""
    if rate > 8 and random.random() < 0.2:
        fi = True
        fi_type = "2-phase" if conditions.temperature > 150 else "single-phase"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=note,
        ca_from_wall=ca_wall_fraction,
        ca_from_fluid=ca_fluid_fraction,
    )


def grow_aragonite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Aragonite (CaCO₃, orthorhombic) growth — the metastable polymorph.

    Habits: acicular_needle (high-σ fast growth), twinned_cyclic (the iconic
    pseudo-hexagonal six-pointed cyclic twin), columnar (default), flos_ferri
    (Fe-rich dendritic — the 'iron flower' coral-shaped variety from Eisenerz).

    Polymorphic conversion: aragonite is metastable. Above 80°C with water
    present, it converts to calcite over short geologic time (Bischoff & Fyfe
    1968 — half-life ~10³ yr at 80°C, ~10⁵ yr at 25°C). In the simulator,
    sustained T > 100°C triggers in-place pseudomorphic conversion: the
    aragonite dissolves, releasing Ca + CO₃ for a new calcite seed.
    """
    sigma = conditions.supersaturation_aragonite()

    # Polymorphic inversion to calcite — the long-term thermodynamic sink.
    # Triggers when the crystal is mature, the system is hot enough for
    # solution-mediated conversion, and aragonite is no longer favored
    # (Mg/Ca dropped, T pushed it out of the kinetic window, etc.).
    if (crystal.total_growth_um > 10
            and conditions.temperature > 100
            and sigma < 0.8):
        crystal.dissolved = True
        conditions.fluid.Ca += 2.0
        conditions.fluid.CO3 += 1.5
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-2.0, growth_rate=-2.0,
            note=f"polymorphic conversion — orthorhombic CaCO₃ → trigonal calcite (T={conditions.temperature:.0f}°C, sigma_arag={sigma:.2f})"
        )

    if sigma < 1.0:
        # Acid dissolution — same vulnerability as calcite
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.5:
            crystal.dissolved = True
            dissolved_um = min(8.0, crystal.total_growth_um * 0.15)
            conditions.fluid.Ca += dissolved_um * 0.5
            conditions.fluid.CO3 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Ca²⁺ + CO₃²⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 5.5 * excess * random.uniform(0.7, 1.3)

    # Habit selection — Fe-rich → flos_ferri; high σ → acicular; moderate → twinned; low → columnar
    if conditions.fluid.Fe > 30 and excess > 0.6:
        crystal.habit = "flos_ferri"
        crystal.dominant_forms = ["dendritic 'iron flower' coral", "stalactitic ferruginous"]
    elif excess > 1.5:
        crystal.habit = "acicular_needle"
        crystal.dominant_forms = ["acicular needles", "radiating spray"]
    elif excess > 0.6:
        crystal.habit = "twinned_cyclic"
        crystal.dominant_forms = ["pseudo-hexagonal cyclic twin {110}", "six-pointed star (cerussite-like)"]
    else:
        crystal.habit = "columnar"
        crystal.dominant_forms = ["columnar prisms", "transparent to white"]

    # Sr / Pb / Ba uptake — aragonite scavenges these where calcite can't
    sr_uptake = conditions.fluid.Sr * 0.15
    pb_uptake = conditions.fluid.Pb * 0.10
    trace_Mn = conditions.fluid.Mn * 0.05  # less Mn than calcite (orthorhombic excludes it)
    trace_Fe = conditions.fluid.Fe * 0.06

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    note = f"{crystal.habit} CaCO₃"
    if sr_uptake > 0.5 or pb_uptake > 0.5:
        note += f" (Sr+Pb scavenged: aragonite hosts what calcite can't)"
    if conditions.fluid.Mg > 0:
        mg_ratio = conditions.fluid.Mg / max(conditions.fluid.Ca, 0.01)
        if mg_ratio > 1.5:
            note += f" — Mg/Ca={mg_ratio:.1f}, calcite is poisoned here"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        note=note,
    )


def grow_dolomite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Dolomite (CaMg(CO₃)₂) growth — the Ca-Mg ordered carbonate.

    Habits: saddle_rhomb (default — curved 'saddle-shaped' rhombs are the
    diagnostic dolomite habit, the most extreme curved-face expression of
    any calcite-group mineral), massive (low σ), coarse_rhomb (slow growth
    high T — clear textbook rhombohedra).

    KIM 2023 KINETICS — the "dolomite problem" partly resolved.
    Per Kim, Kimura, Putnis, Putnis, Lee, Sun (2023) Science 382:915-920
    (doi:10.1126/science.adi3690), dolomite growth requires CYCLIC
    dissolution-precipitation. Steady-state precipitation produces
    disordered Ca/Mg surface layers that prevent the ordered structure
    from forming. Brief undersaturation strips the disordered fraction
    preferentially (it's more soluble), leaving ordered atoms as a
    template. Each cycle ratchets ordering up; ~10²-10³ cycles in lab,
    less in the abstract sim timescale.

    Mechanism here: when σ_dolomite drops below 1 from above (transient
    undersaturation), emit a small "Kim-cycle etch" zone (-0.3 µm) that
    increments crystal.phantom_count via add_zone(). Growth-rate factor
    f_ord = 1 - exp(-phantom_count / 50) ramps from ~0% (no cycling) to
    ~95% (well-cycled). Steady-state high-σ runs grow disordered HMC;
    only event-driven scenarios (acid pulses, T cycles, mixing-zone
    oscillation) build true dolomite.
    """
    sigma = conditions.supersaturation_dolomite()

    if sigma < 1.0:
        # Strong acid: full dissolution
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 6.0:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Ca += dissolved_um * 0.3
            conditions.fluid.Mg += dissolved_um * 0.3
            conditions.fluid.CO3 += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Ca²⁺ + Mg²⁺ + CO₃²⁻ released"
            )

        # Kim 2023 cycle etch — detected by transition from growth-zone
        # to undersaturation. Last zone was positive (growth) → emit one
        # tiny etch zone to record the cycle. Subsequent low-σ steps wait
        # until σ recovers (last zone is now negative, so this branch skips).
        if crystal.zones and crystal.zones[-1].thickness_um > 0:
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-0.3, growth_rate=-0.3,
                note=f"Kim-cycle etch (Sun & Kim 2023) — disordered Ca/Mg surface stripped, ordered template preserved (cycle #{crystal.phantom_count + 1})"
            )
        return None

    excess = sigma - 1.0
    base_rate = 4.5 * excess * random.uniform(0.7, 1.3)

    # Kim 2023: ordering fraction f_ord ramps with cycle count.
    # Cycles are tracked at the FLUID level (conditions._dol_cycle_count)
    # rather than per-crystal — this captures the geological insight that
    # an oscillatory environment ratchets ordering across all dolomite
    # nuclei, not just the ones lucky enough to survive enclosure.
    # N₀=10 calibrated so that:
    #   - Accidental 1-2 saturation crossings stay DISORDERED (f_ord<0.3)
    #   - Dedicated cycling scenarios (sabkha, microbial mat) reach
    #     ORDERED (f_ord>0.7) within ~12-15 cycles
    #   - Each sim cycle represents many lab cycles (Kim's lab N₀~200-300
    #     was over minute-scale e-beam pulses; one sim "tide" stands in
    #     for thousands of real tidal cycles).
    cycle_count = conditions._dol_cycle_count
    f_ord = 1.0 - math.exp(-cycle_count / 7.0)
    # Min 30% growth (some dolomite always forms, just disordered HMC initially);
    # cycle bonus brings it to ~100% as ordering approaches saturation.
    rate = base_rate * (0.30 + 0.70 * f_ord)

    # Habit selection
    if conditions.temperature > 200 and excess < 0.5:
        crystal.habit = "coarse_rhomb"
        crystal.dominant_forms = ["coarse rhombohedral {104}", "transparent to white textbook crystals"]
    elif excess > 1.2:
        crystal.habit = "massive"
        crystal.dominant_forms = ["massive granular", "white to gray sugary aggregate"]
    else:
        crystal.habit = "saddle_rhomb"
        crystal.dominant_forms = ["e{104} saddle-shaped curved rhombohedron", "the diagnostic dolomite habit (curved-face signature)"]

    # Color by Fe content (Fe-rich dolomite = ankerite intermediate)
    if conditions.fluid.Fe > 30:
        color_note = "tan to brown (Fe-rich, approaching ankerite intermediate)"
    elif conditions.fluid.Mn > 10:
        color_note = "pinkish-white (Mn-bearing kutnohorite-dolomite intermediate)"
    else:
        color_note = "white to colorless (Ca-Mg end-member dolomite)"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    # Annotate ordering state — disordered HMC at low f_ord, true dolomite at high
    if f_ord < 0.3:
        order_note = f" [DISORDERED — f_ord={f_ord:.2f}, fluid_cycles={cycle_count}, growing as Mg-calcite intermediate]"
    elif f_ord < 0.7:
        order_note = f" [PARTIALLY ORDERED — f_ord={f_ord:.2f}, fluid_cycles={cycle_count}]"
    else:
        order_note = f" [ORDERED dolomite — f_ord={f_ord:.2f}, fluid_cycles={cycle_count}]"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.08,
        trace_Mn=conditions.fluid.Mn * 0.05,
        note=f"{crystal.habit} — {color_note}{order_note}",
    )


def grow_siderite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Siderite (FeCO₃) growth — the iron carbonate.

    Habits: rhombohedral (default — curved 'saddle' rhombs are diagnostic),
    scalenohedral (high σ), botryoidal (fast growth, colloidal), spherulitic
    (sedimentary 'spherosiderite' concretions).

    Oxidation pseudomorphism: when O₂ climbs above 0.5, Fe²⁺ → Fe³⁺ and
    siderite progressively converts to goethite/limonite. Models the
    classic 'limonite cube after pyrite' diagenetic story (here goethite
    after siderite). Fe + CO₃ are released to drive Fe-oxide growth
    elsewhere in the simulator.
    """
    sigma = conditions.supersaturation_siderite()

    if sigma < 1.0:
        # Oxidative dissolution — the textbook siderite-to-goethite story
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.5:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.13)
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.CO3 += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative breakdown (O₂={conditions.fluid.O2:.2f}) — Fe²⁺ → Fe³⁺, siderite converting to goethite/limonite (the classic diagenetic pseudomorph)"
            )
        # Acid dissolution
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.5:
            crystal.dissolved = True
            dissolved_um = min(6.0, crystal.total_growth_um * 0.15)
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.CO3 += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Fe²⁺ + CO₃²⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.7, 1.3)

    # Habit selection
    if excess > 1.5:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["botryoidal mammillary crusts", "tan-brown rounded aggregates"]
    elif excess > 1.0 and conditions.temperature < 80:
        crystal.habit = "spherulitic"
        crystal.dominant_forms = ["spherulitic concretions ('spherosiderite')", "radial fibrous interior"]
    elif excess > 0.6:
        crystal.habit = "scalenohedral"
        crystal.dominant_forms = ["v{211} scalenohedral", "sharp brown crystals"]
    else:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["e{104} curved 'saddle' rhombohedron", "tan to brown"]

    # Color depends on Fe content vs trace Mn/Ca substitution
    if conditions.fluid.Mn > 5:
        # Manganosiderite intermediate — toward rhodochrosite
        color_note = "pinkish-brown (Mn-bearing manganosiderite)"
    elif conditions.fluid.Ca > 100:
        color_note = "tan to pale brown (Ca-bearing intermediate toward ankerite)"
    else:
        color_note = "deep brown (Fe-dominant end-member)"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.4,  # siderite IS Fe — high uptake
        trace_Mn=conditions.fluid.Mn * 0.05,
        note=f"{crystal.habit} — {color_note}",
    )


def grow_rhodochrosite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Rhodochrosite (MnCO₃) growth — the pink/red carbonate.

    Habits: rhombohedral (default — curved 'button' rhombs are the diagnostic),
    scalenohedral (high σ, sharp dog-tooth crystals), stalactitic (drip
    environments — the famous Capillitas crystals are stalactitic in cross-
    section), banding_agate (low σ rhythmic Mn/Ca alternation).

    Oxidation breakdown: in O₂-rich conditions, Mn²⁺ → Mn³⁺/Mn⁴⁺ and the
    rhodochrosite converts to a black Mn oxide rind (pyrolusite/psilomelane).
    The rosy crystal goes black. Acid dissolution releases Mn + CO₃ back.
    """
    sigma = conditions.supersaturation_rhodochrosite()

    if sigma < 1.0:
        # Aggressive oxidation — Mn²⁺ flipped to Mn-oxide
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Mn += dissolved_um * 0.4  # most of the Mn locks up as oxide
            conditions.fluid.CO3 += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative breakdown — Mn²⁺ → Mn³⁺/Mn⁴⁺, surface converting to black manganese oxide (pyrolusite/psilomelane staining)"
            )
        # Acid attack
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.5:
            crystal.dissolved = True
            dissolved_um = min(6.0, crystal.total_growth_um * 0.15)
            conditions.fluid.Mn += dissolved_um * 0.5
            conditions.fluid.CO3 += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Mn²⁺ + CO₃²⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.7, 1.3)

    # Substrate-aware: stalactitic when growing on goethite (Capillitas-style
    # ferruginous drip) or on existing rhodochrosite (stalactite cross-section).
    pos_str = crystal.position if isinstance(crystal.position, str) else ""
    on_drip = "goethite" in pos_str or "stalactit" in pos_str

    if on_drip:
        crystal.habit = "stalactitic"
        crystal.dominant_forms = ["concentric stalactitic banding", "rose-pink mammillary aggregates"]
    elif excess > 1.5:
        crystal.habit = "scalenohedral"
        crystal.dominant_forms = ["v{211} scalenohedral 'dog-tooth'", "sharp deep-rose crystals"]
    elif excess > 0.5:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["e{104} curved 'button' rhombohedron", "rose-pink to raspberry"]
    else:
        crystal.habit = "banding_agate"
        crystal.dominant_forms = ["rhythmic Mn/Ca banding", "agate-like layered cross-section"]

    # Color depends on Ca substitution (kutnohorite intermediate)
    ca_in_lattice = conditions.fluid.Ca / max(conditions.fluid.Mn + conditions.fluid.Ca, 0.01)
    if ca_in_lattice > 0.5:
        color_note = "pale pink (Ca-rich, approaching kutnohorite intermediate)"
    elif ca_in_lattice > 0.2:
        color_note = "rose-pink (some Ca substitution)"
    else:
        color_note = "deep raspberry-red (Mn-dominant, end-member rhodochrosite)"

    # Trace Fe darkens toward brown
    if conditions.fluid.Fe > 30:
        color_note += " with brownish tint (Fe-rich)"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Mn=conditions.fluid.Mn * 0.4,  # rhodochrosite IS Mn — high uptake
        trace_Fe=conditions.fluid.Fe * 0.05,
        note=f"{crystal.habit} — {color_note}",
    )


def grow_sphalerite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Sphalerite (ZnS) growth model."""
    sigma = conditions.supersaturation_sphalerite()
    
    if sigma < 1.0:
        return None
    
    excess = sigma - 1.0
    rate = 6.0 * excess * random.uniform(0.7, 1.3)
    
    # Fe substitution — determines color and is a geothermometer
    # More Fe at higher T
    Fe_mol_percent = min(conditions.fluid.Fe * 0.1 * (conditions.temperature / 300.0), 30.0)
    trace_Fe = Fe_mol_percent * 10  # rough ppm equivalent for display
    
    crystal.habit = "tetrahedral"
    crystal.dominant_forms = ["{111} tetrahedron"]
    
    # Color from Fe content
    if Fe_mol_percent > 15:
        color_note = "black (marmatite — high Fe)"
    elif Fe_mol_percent > 8:
        color_note = "dark brown"
    elif Fe_mol_percent > 3:
        color_note = "honey/amber"
    else:
        color_note = "pale yellow (cleiophane — gem quality)"
    
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"color: {color_note}, Fe: {Fe_mol_percent:.1f} mol%"
    )


def grow_wurtzite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Wurtzite ((Zn,Fe)S) growth model — hexagonal dimorph of sphalerite.

    The high-T polymorph. On cooling below 95°C, wurtzite can convert to
    cubic sphalerite — handled here as a dissolution event with Zn+S
    recycled to the fluid (letting a new sphalerite seed nucleate).
    Hemimorphic habit: one end pointed, one end flat — diagnostic of
    the lack of an inversion center in the hexagonal P6₃mc space group.
    """
    # Polymorphic inversion on cooling below 95°C
    if crystal.total_growth_um > 10 and conditions.temperature <= 95:
        crystal.dissolved = True
        conditions.fluid.Zn += 1.5
        conditions.fluid.S += 1.2
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-1.5, growth_rate=-1.5,
            note="polymorphic inversion — T dropped below 95°C, hexagonal (Zn,Fe)S converting to cubic sphalerite"
        )

    sigma = conditions.supersaturation_wurtzite()

    if sigma < 1.0:
        return None

    excess = sigma - 1.0
    rate = 5.5 * excess * random.uniform(0.7, 1.3)

    # Fe substitution — same as sphalerite but at higher T
    Fe_mol_percent = min(conditions.fluid.Fe * 0.12 * (conditions.temperature / 300.0), 35.0)
    trace_Fe = Fe_mol_percent * 10

    # Habit selection — σ + T control the form
    if excess > 1.5:
        crystal.habit = "fibrous_coating"
        crystal.dominant_forms = ["fibrous crust", "{0001} parallel columns"]
    elif excess > 0.8:
        crystal.habit = "radiating_columnar"
        crystal.dominant_forms = ["radiating hexagonal columns", "stellate aggregates"]
    elif excess > 0.3:
        crystal.habit = "hemimorphic_crystal"
        crystal.dominant_forms = ["hemimorphic hexagonal pyramid", "{0001} + {101̄1}"]
    else:
        crystal.habit = "platy_massive"
        crystal.dominant_forms = ["{0001} tabular plate", "micaceous"]

    # Color from Fe content — darker than sphalerite at same Fe
    if Fe_mol_percent > 15:
        color_note = "black metallic (Fe-rich wurtzite)"
    elif Fe_mol_percent > 5:
        color_note = "brownish-black"
    else:
        color_note = "yellowish-brown to dark brown"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"hemimorphic hexagonal (Zn,Fe)S — {color_note}, Fe: {Fe_mol_percent:.1f} mol%"
    )


def grow_fluorite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Fluorite (CaF2) growth model.
    
    Fluorite dissolves in strong acid: CaF₂ + 2HCl → CaCl₂ + 2HF
    This is genuinely dangerous — it releases hydrofluoric acid.
    Also dissolves at very low pH regardless of acid type.
    """
    sigma = conditions.supersaturation_fluorite()
    
    if sigma < 1.0:
        # Acid dissolution of fluorite
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.0:
            crystal.dissolved = True
            dissolved_um = min(6.0, crystal.total_growth_um * 0.12)
            # Release Ca and F back to fluid
            conditions.fluid.Ca += dissolved_um * 0.4
            conditions.fluid.F += dissolved_um * 0.6
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — CaF₂ + 2H⁺ → Ca²⁺ + 2HF (⚠️ releases hydrofluoric acid)"
            )
        return None
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)  # was 7.0, reduced to prevent Groove domination
    
    crystal.habit = "cubic"
    crystal.dominant_forms = ["{100} cube"]
    
    # Color zoning — fluorite is famous for it
    if conditions.fluid.Fe > 10:
        color = "green"
    elif conditions.fluid.Mn > 5:
        color = "purple"
    elif conditions.temperature > 200:
        color = "colorless"
    else:
        color = "blue-violet"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.02,
        trace_Mn=conditions.fluid.Mn * 0.05,
        note=f"color zone: {color}"
    )


def grow_pyrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Pyrite (FeS2) growth model.
    
    The most common sulfide mineral. Famous for cubic and pyritohedral habits.
    Framboids (raspberry-shaped aggregates) form at low T from rapid nucleation.
    """
    sigma = conditions.supersaturation_pyrite()
    
    if sigma < 1.0:
        # Check for oxidation/dissolution
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.1)
            # RECYCLING: Fe and S return to fluid
            conditions.fluid.Fe += dissolved_um * 1.0
            conditions.fluid.S += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidizing — pyrite weathering to goethite/limonite, Fe²⁺ released to fluid"
            )
        # Also dissolves in strong acid
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            conditions.fluid.Fe += 2.0
            conditions.fluid.S += 1.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-2.0, growth_rate=-2.0,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Fe + S released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.7, 1.3)
    
    # Temperature controls habit
    if conditions.temperature > 300:
        crystal.habit = "cubic"
        crystal.dominant_forms = ["{100} cube"]
    elif conditions.temperature > 200:
        crystal.habit = "pyritohedral"
        crystal.dominant_forms = ["{210} pyritohedron"]
    elif conditions.temperature > 100:
        # Mix of forms
        crystal.habit = "cubo-pyritohedral"
        crystal.dominant_forms = ["{100} + {210}"]
    else:
        # Low T — framboidal possible
        if excess > 1.0:
            crystal.habit = "framboidal"
            crystal.dominant_forms = ["framboidal aggregate"]
        else:
            crystal.habit = "cubic"
            crystal.dominant_forms = ["{100} cube, microcrystalline"]
    
    # Trace elements — As substitutes for S, Co/Ni substitute for Fe
    trace_note = "brassy yellow metallic luster"
    if conditions.fluid.Cu > 20:
        trace_note += ", Cu traces (may exsolve chalcopyrite inclusions)"
    
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.15,
        note=trace_note
    )


def grow_marcasite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Marcasite (FeS2) growth model — orthorhombic dimorph of pyrite.

    Same composition as pyrite; pH<5 and T<240°C are the switches. Habits are
    the diagnostic — cockscomb crests, spearhead tips, radiating blades. The
    classic museum-specimen rot: left in humidity, marcasite decomposes to
    sulfuric acid + iron sulfate. Metastable to pyrite on heating above 240°C.
    """
    # Metastable conversion to pyrite — if pH rises or T exceeds 240, the
    # orthorhombic structure collapses to the cubic form. Treat as dissolution
    # with Fe/S released, letting a new pyrite seed nucleate in its place.
    if crystal.total_growth_um > 10 and (conditions.fluid.pH >= 5.0 or conditions.temperature > 240):
        crystal.dissolved = True
        conditions.fluid.Fe += 1.5
        conditions.fluid.S += 1.2
        trigger = "pH rose above 5" if conditions.fluid.pH >= 5.0 else "T exceeded 240°C"
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-1.5, growth_rate=-1.5,
            note=f"metastable inversion — {trigger}, orthorhombic FeS2 converting to pyrite"
        )

    sigma = conditions.supersaturation_marcasite()

    if sigma < 1.0:
        # Oxidative dissolution — marcasite decomposes faster than pyrite
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 0.8:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Fe += dissolved_um * 1.0
            conditions.fluid.S += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidative breakdown — FeS2 + O2 + H2O → FeSO4 + H2SO4 (the museum rot)"
            )
        # Acid-stable down to pH 1.5 — but extreme acid still dissolves
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 1.5:
            crystal.dissolved = True
            conditions.fluid.Fe += 2.0
            conditions.fluid.S += 1.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-2.0, growth_rate=-2.0,
                note=f"extreme-acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.7, 1.3)

    # Habit selection — sigma + T control the form
    if excess > 1.5 and conditions.temperature < 100:
        crystal.habit = "radiating_blade"
        crystal.dominant_forms = ["radiating blades", "fibrous stellate clusters"]
    elif excess > 0.8:
        crystal.habit = "cockscomb"
        crystal.dominant_forms = ["cockscomb aggregate", "crested tabular {010}"]
    elif excess > 0.3:
        crystal.habit = "spearhead"
        crystal.dominant_forms = ["spearhead twins", "pyramidal terminations"]
    else:
        crystal.habit = "tabular_plate"
        crystal.dominant_forms = ["{010} tabular plate"]

    trace_note = "pale brass-yellow metallic, tarnishing iridescent"
    if conditions.fluid.pH < 3.5:
        trace_note += " (strong acid — extra-rapid cockscomb growth)"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.15,
        note=trace_note
    )


def grow_chalcopyrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Chalcopyrite (CuFeS2) growth model.
    
    Main copper ore mineral. Tetragonal but often looks tetrahedral.
    Brassy yellow, develops iridescent tarnish (peacock ore = bornite, 
    but chalcopyrite tarnishes similarly).
    """
    sigma = conditions.supersaturation_chalcopyrite()
    
    if sigma < 1.0:
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.1)
            # RECYCLING: Cu, Fe, S return to fluid
            conditions.fluid.Cu += dissolved_um * 0.8
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidizing — chalcopyrite weathering, Cu²⁺ + Fe²⁺ released (→ malachite/azurite at surface)"
            )
        return None
    
    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.7, 1.3)
    
    crystal.habit = "disphenoidal"
    crystal.dominant_forms = ["{112} disphenoid", "{012}"]
    
    # Color/tarnish note
    if conditions.temperature < 100:
        color_note = "brassy yellow, may develop iridescent tarnish"
    else:
        color_note = "brassy yellow, metallic"
    
    # Cu content tracking through Fe field (reusing for display)
    trace_Cu = conditions.fluid.Cu * 0.1
    
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
    
    # Competes with pyrite for Fe and S — deplete both
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.1,
        note=f"{color_note}, Cu: {trace_Cu:.1f} ppm incorporated"
    )


def grow_hematite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Hematite (Fe₂O₃) growth model.
    
    The most important iron oxide. Specular hematite at high T is stunning —
    metallic silver-black plates that flash like mirrors. At low T, botryoidal
    masses with kidney-ore texture. The red streak is diagnostic regardless of habit.
    """
    sigma = conditions.supersaturation_hematite()
    
    if sigma < 1.0:
        # Strong acid dissolves hematite
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.1)
            # RECYCLING: Fe returns to fluid
            conditions.fluid.Fe += dissolved_um * 1.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Fe²⁺ released back to fluid"
            )
        return None
    
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit varies with temperature — this is well-documented
    if conditions.temperature > 300:
        crystal.habit = "specular"
        crystal.dominant_forms = ["{001} basal plates", "metallic platy"]
    elif conditions.temperature > 150:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["{101} rhombohedron"]
    else:
        if excess > 0.5:
            crystal.habit = "botryoidal"
            crystal.dominant_forms = ["kidney-ore texture"]
        else:
            crystal.habit = "earthy/massive"
            crystal.dominant_forms = ["microcrystalline aggregate"]
    
    # Width depends on habit
    if crystal.habit == "specular":
        crystal.a_width_mm = crystal.c_length_mm * 2.0  # plates are wide
    elif crystal.habit == "botryoidal":
        crystal.a_width_mm = crystal.c_length_mm * 1.2
    
    # Trace Mn incorporation
    trace_Mn = conditions.fluid.Mn * 0.04
    trace_Fe = conditions.fluid.Fe * 0.2  # it IS an iron mineral
    
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
    
    # Color prediction note
    if crystal.habit == "specular":
        if random.random() < 0.03:
            color_note = "iridescent (very thin plates — interference colors)"
        else:
            color_note = "steel-gray metallic"
    elif crystal.habit in ("earthy/massive", "botryoidal"):
        color_note = "red earthy"
    else:
        color_note = "dark gray metallic"
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        note=f"{crystal.habit} habit, {color_note}"
    )


def grow_malachite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Malachite (Cu₂(CO₃)(OH)₂) growth model.
    
    The green copper carbonate. Always green — vivid, banded, botryoidal.
    Forms from oxidation of copper sulfides. Classic paragenesis:
    chalcopyrite → covellite → malachite/azurite. Low temperature only.
    Dissolves in acid with effervescence (it's a carbonate!).
    """
    sigma = conditions.supersaturation_malachite()
    
    if sigma < 1.0:
        # Acid dissolution — malachite dissolves easily (fizzes!)
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(6.0, crystal.total_growth_um * 0.15)
            # RECYCLING: Cu²⁺ and CO₃²⁻ return to fluid
            conditions.fluid.Cu += dissolved_um * 0.8
            conditions.fluid.CO3 += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — fizzing! Cu²⁺ + CO₃²⁻ released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 6.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit depends on growth rate and history
    zone_count = len(crystal.zones)
    if zone_count >= 20:
        crystal.habit = "banded"
        crystal.dominant_forms = ["banded botryoidal", "concentric layers"]
    elif rate > 8:
        crystal.habit = "fibrous/acicular"
        crystal.dominant_forms = ["acicular sprays", "fibrous radiating"]
    else:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["botryoidal masses", "mammillary"]
    
    # Width for botryoidal/banded forms
    if crystal.habit in ("botryoidal", "banded"):
        crystal.a_width_mm = crystal.c_length_mm * 1.5
    elif crystal.habit == "fibrous/acicular":
        crystal.a_width_mm = crystal.c_length_mm * 0.2
    
    # Cu consumption — each growth step depletes Cu from fluid
    conditions.fluid.Cu -= rate * 0.01
    conditions.fluid.Cu = max(conditions.fluid.Cu, 0)
    
    # No twinning for malachite (doesn't typically twin visibly)
    
    # Color — ALWAYS green
    if zone_count >= 20:
        color_note = "banded green (alternating light/dark)"
    elif conditions.fluid.Cu > 30:
        color_note = "vivid green"
    elif conditions.fluid.Cu < 10:
        color_note = "pale green"
    else:
        color_note = "green"
    
    trace_Fe = conditions.fluid.Fe * 0.01  # trace iron
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"{crystal.habit}, {color_note}, Cu fluid: {conditions.fluid.Cu:.0f} ppm"
    )


def grow_apophyllite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Apophyllite (KCa₄Si₈O₂₀(F,OH)·8H₂O) growth — zeolite-facies vesicle filling.

    Habits: prismatic_tabular (default, classic pseudo-cubic blocks),
    hopper_growth (stepped/terraced faces at high σ), druzy_crust (very high σ),
    chalcedony_pseudomorph (when an earlier zeolite blade gets replaced).
    Hematite-bearing growth zones produce the 'bloody apophyllite' phantom
    inclusions of Nashik fame.
    """
    sigma = conditions.supersaturation_apophyllite()

    if sigma < 1.0:
        # Acid attack — apophyllite is alkaline-stable, dissolves at low pH
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            conditions.fluid.K += 0.5
            conditions.fluid.Ca += 2.0
            conditions.fluid.SiO2 += 8.0
            conditions.fluid.F += 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-2.0, growth_rate=-2.0,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — K, Ca, SiO₂, F released"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.7, 1.3)

    # Habit selection — σ controls form
    if excess > 1.8:
        crystal.habit = "druzy_crust"
        crystal.dominant_forms = ["fine-grained drusy coating", "sparkling colorless"]
    elif excess > 1.0:
        crystal.habit = "hopper_growth"
        crystal.dominant_forms = ["stepped/terraced {001} faces", "skeletal hopper crystals"]
    elif excess > 0.4:
        crystal.habit = "prismatic_tabular"
        crystal.dominant_forms = ["pseudo-cubic tabular {001} + {110}", "transparent to pearly"]
    else:
        # Lower σ — slow growth, possible chalcedony pseudomorph after earlier zeolite
        crystal.habit = "chalcedony_pseudomorph"
        crystal.dominant_forms = ["chalcedony pseudomorph after earlier zeolite blade", "massive milky"]

    # Hematite phantom inclusions — when Fe activity is high enough,
    # microcrystalline hematite needles enclose in growth zones, producing
    # the 'bloody apophyllite' habit of Nashik (Deccan Traps).
    hematite_note = ""
    if conditions.fluid.Fe > 8 and conditions.fluid.O2 > 0.2 and random.random() < 0.4:
        hematite_note = " (hematite needle phantoms — bloody apophyllite zone)"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.05,
        note=f"{crystal.habit} K-Ca-Si zeolite{hematite_note}"
    )


def grow_tetrahedrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Tetrahedrite (Cu₁₂Sb₄S₁₃) growth — the Sb-endmember fahlore.

    Habits: tetrahedral (moderate σ), massive (high σ default), crustiform
    (on fracture walls), druzy_coating (fast growth). Silver substitution
    (freibergite variety) when Ag > 10 ppm. Oxidizes to release Cu²⁺, Sb³⁺
    for secondary minerals.
    """
    sigma = conditions.supersaturation_tetrahedrite()

    if sigma < 1.0:
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.1)
            conditions.fluid.Cu += dissolved_um * 0.6
            conditions.fluid.Sb += dissolved_um * 0.3
            conditions.fluid.S += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidative dissolution — Cu²⁺ + Sb³⁺ released (feeds secondary Sb oxides)"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.7, 1.3)

    # Habit selection — σ + setting controls the form
    on_wall = isinstance(crystal.position, str) and ("wall" in crystal.position or "fracture" in crystal.position)
    if excess > 1.2:
        if on_wall:
            crystal.habit = "crustiform"
            crystal.dominant_forms = ["crustiform banded crust", "fracture-wall coating"]
        else:
            crystal.habit = "druzy_coating"
            crystal.dominant_forms = ["fine-grained drusy surface", "sparkling steel-gray"]
    elif excess > 0.6:
        crystal.habit = "massive"
        crystal.dominant_forms = ["massive granular", "steel-gray metallic"]
    else:
        crystal.habit = "tetrahedral"
        crystal.dominant_forms = ["{111} tetrahedron", "classic steel-gray tetrahedra"]

    # Silver substitution — freibergite variety
    ag_note = ""
    if conditions.fluid.Ag > 10:
        ag_note = f", Ag-rich (freibergite — Ag as ore)"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.05,
        note=f"{crystal.habit} Cu12Sb4S13 — steel-gray metallic{ag_note}"
    )


def grow_tennantite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Tennantite (Cu₁₂As₄S₁₃) growth — the As-endmember fahlore.

    Same structure as tetrahedrite, As in place of Sb. Habits: tetrahedral
    (moderate σ), massive (default), crustiform (on fracture walls). Thin
    fragments transmit cherry-red light — the diagnostic. Oxidation releases
    Cu + arsenate, feeding adamite/erythrite/annabergite downstream.
    """
    sigma = conditions.supersaturation_tennantite()

    if sigma < 1.0:
        if crystal.total_growth_um > 10 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.1)
            conditions.fluid.Cu += dissolved_um * 0.6
            conditions.fluid.As += dissolved_um * 0.3
            conditions.fluid.S += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidative dissolution — Cu²⁺ + AsO₄³⁻ released (feeds secondary arsenates: adamite, erythrite, etc.)"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.7, 1.3)

    on_wall = isinstance(crystal.position, str) and ("wall" in crystal.position or "fracture" in crystal.position)
    if excess > 1.2:
        if on_wall:
            crystal.habit = "crustiform"
            crystal.dominant_forms = ["crustiform banded crust", "gray-black fracture coating"]
        else:
            crystal.habit = "druzy_coating"
            crystal.dominant_forms = ["fine-grained drusy surface", "sparkling gray-black"]
    elif excess > 0.6:
        crystal.habit = "massive"
        crystal.dominant_forms = ["massive granular", "gray-black compact"]
    else:
        crystal.habit = "tetrahedral"
        crystal.dominant_forms = ["{111} tetrahedron", "gray-black tetrahedra with cherry-red thin-edge transmission"]

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.05,
        note=f"{crystal.habit} Cu12As4S13 — gray-black metallic, cherry-red transmission in thin fragments"
    )


def grow_erythrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Erythrite (Co₃(AsO₄)₂·8H₂O) growth — the cobalt bloom.

    Low-T supergene arsenate. Four habits: cobalt_bloom (earthy pink crust,
    default), bladed_crystal (rare striated blades when σ high), radiating_fibrous
    (when grown on a primary Co-arsenide substrate), botryoidal_crust (high σ).
    Dehydrates above 200°C. Dissolves in acid.
    """
    # Thermal dehydration — loses its lattice water above 200°C
    if crystal.total_growth_um > 5 and conditions.temperature > 200:
        crystal.dissolved = True
        conditions.fluid.Co += 0.4
        conditions.fluid.As += 0.3
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-1.0, growth_rate=-1.0,
            note="thermal dehydration — Co3(AsO4)2·8H2O loses water, breaks down above 200°C"
        )

    sigma = conditions.supersaturation_erythrite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            conditions.fluid.Co += 0.6
            conditions.fluid.As += 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-1.2, growth_rate=-1.2,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Co²⁺ + AsO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.7, 1.3)

    # Substrate-aware habit: if growing on a primary Co-arsenide, fibrous spray
    on_primary = isinstance(crystal.position, str) and (
        "cobaltite" in crystal.position or "skutterudite" in crystal.position or "arsenide" in crystal.position
    )
    if on_primary:
        crystal.habit = "radiating_fibrous"
        crystal.dominant_forms = ["radiating fibrous sprays", "stellate clusters"]
    elif excess > 1.2:
        crystal.habit = "bladed_crystal"
        crystal.dominant_forms = ["striated prismatic {010} blades", "crimson-pink transparent"]
    elif excess > 0.5:
        crystal.habit = "botryoidal_crust"
        crystal.dominant_forms = ["botryoidal rounded aggregates", "pink-red crust"]
    else:
        crystal.habit = "cobalt_bloom"
        crystal.dominant_forms = ["earthy crimson-pink crust", "cobalt bloom"]

    # Color depends on Co:Ni ratio — Co-dominant is pink, Ni-bearing shifts greenish
    ni_fraction = conditions.fluid.Ni / max(conditions.fluid.Co + conditions.fluid.Ni, 0.01)
    if ni_fraction > 0.3:
        color_note = "purplish-pink (mixed Co-Ni composition)"
    elif ni_fraction > 0.1:
        color_note = "dusty crimson (trace Ni)"
    else:
        color_note = "crimson-pink (Co-dominant — cobalt bloom)"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Mn=conditions.fluid.Mn * 0.01,
        note=f"{crystal.habit} — {color_note}"
    )


def grow_annabergite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Annabergite (Ni₃(AsO₄)₂·8H₂O) growth — the nickel bloom.

    Ni equivalent of erythrite. Habits: nickel_bloom (apple-green earthy crust,
    default), capillary_crystal (hair-like fibers at high σ), cabrerite (Mg
    substitution paling to white), co_bearing (Co substitution shifting pink).
    Dehydrates above 200°C. Dissolves in acid.
    """
    if crystal.total_growth_um > 5 and conditions.temperature > 200:
        crystal.dissolved = True
        conditions.fluid.Ni += 0.4
        conditions.fluid.As += 0.3
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-1.0, growth_rate=-1.0,
            note="thermal dehydration — Ni3(AsO4)2·8H2O loses water, breaks down above 200°C"
        )

    sigma = conditions.supersaturation_annabergite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            conditions.fluid.Ni += 0.6
            conditions.fluid.As += 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-1.2, growth_rate=-1.2,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Ni²⁺ + AsO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.7, 1.3)

    # Composition-dependent habit: Co-bearing vs Mg-bearing vs pure Ni
    co_fraction = conditions.fluid.Co / max(conditions.fluid.Co + conditions.fluid.Ni, 0.01)
    mg_fraction = conditions.fluid.Mg / max(conditions.fluid.Mg + conditions.fluid.Ni, 0.01)

    if co_fraction > 0.25:
        crystal.habit = "co_bearing"
        crystal.dominant_forms = ["pinkish-green intermediate crust"]
        color_note = "pinkish-green (Co-bearing annabergite, transitioning to erythrite)"
    elif mg_fraction > 0.3:
        crystal.habit = "cabrerite"
        crystal.dominant_forms = ["pale green to white crust", "Mg-bearing cabrerite variety"]
        color_note = "pale green to white (cabrerite — Mg substitution)"
    elif excess > 1.5:
        crystal.habit = "capillary_crystal"
        crystal.dominant_forms = ["capillary hair-like fibers", "green silky sprays"]
        color_note = "bright apple-green capillaries"
    else:
        crystal.habit = "nickel_bloom"
        crystal.dominant_forms = ["apple-green earthy crust", "nickel bloom"]
        color_note = "apple-green (Ni-dominant — nickel bloom)"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=f"{crystal.habit} — {color_note}"
    )


def grow_adamite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Adamite (Zn₂(AsO₄)(OH)) growth model.
    
    TN467 — my rock. The contradiction: green-fluorescing crystals next to
    non-fluorescing ones, on the same specimen. Cu²⁺ substitution activates
    the fluorescence; crystals without Cu are dark under UV.
    
    Prismatic to tabular, often fan-shaped sprays. On limonite (iron oxide).
    Color: yellow-green (pure) to vivid green (Cu-bearing = cuproadamite).
    """
    sigma = conditions.supersaturation_adamite()
    
    if sigma < 1.0:
        # Acid dissolution
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.5:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Zn += dissolved_um * 0.5
            conditions.fluid.As += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Zn²⁺ + AsO₄³⁻ released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit
    zone_count = len(crystal.zones)
    if rate > 6:
        crystal.habit = "acicular sprays"
        crystal.dominant_forms = ["radiating fan-shaped sprays", "acicular needles"]
        crystal.a_width_mm = crystal.c_length_mm * 0.15
    elif zone_count > 15:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["elongated prisms", "wedge-shaped"]
        crystal.a_width_mm = crystal.c_length_mm * 0.4
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["tabular crystals", "flattened prisms"]
        crystal.a_width_mm = crystal.c_length_mm * 0.7
    
    # Cu substitution → determines fluorescence!
    cu_in_crystal = conditions.fluid.Cu * 0.02
    
    # Color depends on Cu content
    if cu_in_crystal > 0.5:
        color_note = "vivid green (cuproadamite) — UV-FLUORESCENT 💚"
    elif cu_in_crystal > 0.1:
        color_note = "green — weakly fluorescent"
    else:
        color_note = "yellow-green — NON-FLUORESCENT (no Cu)"
    
    # Deplete Zn and As from fluid
    conditions.fluid.Zn -= rate * 0.008
    conditions.fluid.Zn = max(conditions.fluid.Zn, 0)
    conditions.fluid.As -= rate * 0.005
    conditions.fluid.As = max(conditions.fluid.As, 0)
    
    trace_Fe = conditions.fluid.Fe * 0.01
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"{crystal.habit}, {color_note}"
    )


def grow_mimetite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Mimetite (Pb₅(AsO₄)₃Cl) growth model.
    
    TN422's substrate — my foundation stone's foundation. Wulfenite sits on this.
    Isostructural with pyromorphite (phosphate) and vanadinite (vanadate).
    All three are apatite supergroup: hexagonal prisms, barrel-shaped ("campylite"),
    or tabular. Pb₅(XO₄)₃Cl where X = As (mimetite), P (pyromorphite), V (vanadinite).
    
    Color: yellow, orange, yellow-brown. Campylite variety has curved barrel faces
    from Fe substitution. Resinous to adamantine luster.
    """
    sigma = conditions.supersaturation_mimetite()
    
    if sigma < 1.0:
        # Acid dissolution
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Pb += dissolved_um * 0.8
            conditions.fluid.As += dissolved_um * 0.3
            conditions.fluid.Cl += dissolved_um * 0.1
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Pb²⁺ + AsO₄³⁻ + Cl⁻ released"
            )
        return None
    
    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    
    if rate < 0.1:
        return None
    
    # Habit — the classic apatite supergroup morphologies
    zone_count = len(crystal.zones)
    fe_ratio = conditions.fluid.Fe / max(conditions.fluid.Pb, 1)
    
    if fe_ratio > 0.3 and random.random() < 0.4:
        # Campylite! Barrel-shaped from Fe substitution
        crystal.habit = "campylite (barrel-shaped)"
        crystal.dominant_forms = ["barrel-shaped hexagonal prisms", "curved faces"]
        crystal.a_width_mm = crystal.c_length_mm * 0.6
    elif rate > 7:
        crystal.habit = "acicular"
        crystal.dominant_forms = ["thin hexagonal needles", "hair-like prisms"]
        crystal.a_width_mm = crystal.c_length_mm * 0.15
    elif zone_count > 10:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["hexagonal prisms", "pinacoidal terminations"]
        crystal.a_width_mm = crystal.c_length_mm * 0.4
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["thick tabular hexagons", "stubby prisms"]
        crystal.a_width_mm = crystal.c_length_mm * 0.8
    
    # Color
    if fe_ratio > 0.3:
        color_note = "orange-brown (Fe-rich campylite)"
    elif conditions.fluid.Pb > 100:
        color_note = "bright yellow-orange"
    else:
        color_note = "pale yellow"
    
    # Deplete Pb, As, Cl from fluid
    conditions.fluid.Pb -= rate * 0.015
    conditions.fluid.Pb = max(conditions.fluid.Pb, 0)
    conditions.fluid.As -= rate * 0.008
    conditions.fluid.As = max(conditions.fluid.As, 0)
    conditions.fluid.Cl -= rate * 0.003
    conditions.fluid.Cl = max(conditions.fluid.Cl, 0)
    
    trace_Fe = conditions.fluid.Fe * 0.02  # Fe substitution (campylite factor)
    
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=f"{crystal.habit}, {color_note}"
    )


def grow_feldspar(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """K-feldspar (KAlSi₃O₈) growth model.

    The most abundant mineral group in Earth's crust.
    Temperature determines the polymorph:
    - Sanidine (>600°C): monoclinic, disordered Al/Si — found in volcanic rocks
    - Orthoclase (400-600°C): monoclinic, partially ordered — common in granites
    - Microcline (<400°C): triclinic, fully ordered — characteristic cross-hatch twinning

    Pb²⁺ substituting for K⁺ in microcline produces amazonite (blue-green).
    Adularia: low-T habit variant with pseudo-orthorhombic shape, moonstone adularescence.
    Carlsbad twin: most common K-spar twin law, rotation on c-axis.
    Baveno twin: rarer, reflection on {021}.
    Manebach twin: reflection on {001}, least common.
    """
    sigma = conditions.supersaturation_feldspar()

    if sigma < 1.0:
        # Kaolinization: acidic weathering of feldspar → kaolinite.
        # Balanced reaction: 2 KAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite +
        # 2 K⁺ + 4 SiO₂. All Al stays in the new kaolinite phase; only
        # K and SiO₂ go back to the fluid (and a little Al from crystal-
        # edge effects and pore fluid, ~5% partition).
        # The sim doesn't track kaolinite as a distinct mineral — it's
        # an implicit Al sink. This partition is the honest chemistry.
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 4.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.08)
            conditions.fluid.K += dissolved_um * 0.3
            conditions.fluid.Al += dissolved_um * 0.05   # most Al stays in kaolinite
            conditions.fluid.SiO2 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"kaolinization (pH {conditions.fluid.pH:.1f}) — KAlSi₃O₈ → kaolinite + K⁺ + SiO₂; Al conserved in kaolinite"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.8, 1.2)

    if rate < 0.1:
        return None

    T = conditions.temperature

    # Temperature determines polymorph
    if T > 600:
        polymorph = "sanidine"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{010} platy", "{001} cleavage", "short prismatic"]
    elif T > 400:
        polymorph = "orthoclase"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "{010} face", "Carlsbad twin"]
    else:
        polymorph = "microcline"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "cross-hatch twinning", "{010} face"]

    # Amazonite detection: Pb in microcline
    amazonite = False
    if polymorph == "microcline" and conditions.fluid.Pb > 5:
        if random.random() < 0.3 * (conditions.fluid.Pb / 50.0):
            amazonite = True

    # Adularia detection: low-T, moderate K, specific fluid chemistry
    adularia = False
    if T < 350 and conditions.fluid.K > 20 and conditions.fluid.Na > 5:
        if random.random() < 0.15:
            adularia = True
            crystal.habit = "adularia (pseudo-orthorhombic)"
            crystal.dominant_forms = ["rhombic cross-section", "pseudo-orthorhombic faces"]

    # Twinning — K-feldspar has three common twin laws
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    # Perthite exsolution check
    # At high T, K and Na are fully miscible in alkali feldspar.
    # On cooling below ~500°C, they unmix: Na-rich albite lamellae exsolve from K-spar host.
    perthite = False
    if (polymorph in ("orthoclase", "microcline")
            and conditions.fluid.Na > 8
            and crystal.total_growth_um > 20
            and T < 500):
        if random.random() < 0.2 * (conditions.fluid.Na / 30.0):
            perthite = True
            # Na gets consumed to form albite lamellae within the K-spar
            conditions.fluid.Na -= rate * 0.05
            conditions.fluid.Na = max(conditions.fluid.Na, 0)

    # Color determination
    if amazonite:
        color_note = "amazonite blue-green (Pb²⁺ → K⁺ substitution)"
    elif adularia:
        # Moonstone adularescence from thin albite intergrowths
        if conditions.fluid.Na > 10:
            color_note = "adularescent moonstone (thin albite intergrowths scatter light)"
        else:
            color_note = "colorless adularia"
    else:
        color_note = " flesh-colored to white"

    # Deplete K, Al, SiO₂ from fluid
    conditions.fluid.K -= rate * 0.012
    conditions.fluid.K = max(conditions.fluid.K, 0)
    conditions.fluid.Al -= rate * 0.006
    conditions.fluid.Al = max(conditions.fluid.Al, 0)
    conditions.fluid.SiO2 -= rate * 0.010
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2, 0)

    # Build zone note
    parts = [polymorph]
    if amazonite:
        parts.append("amazonite")
    if adularia:
        parts.append("adularia")
    if perthite:
        parts.append("perthite exsolution (albite lamellae)")
    parts.append(color_note)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Al=conditions.fluid.Al * 0.03,
        trace_Pb=conditions.fluid.Pb * 0.01 if amazonite else 0,
        note=", ".join(parts)
    )


def grow_albite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Albite (NaAlSi₃O₈) growth model.

    The sodium end-member of the plagioclase series.
    Na-feldspar: the other half of the alkali feldspar family.

    High T (>450°C): monalbite (monoclinic, disordered Al/Si)
    Low T (<450°C): low-albite (triclinic, fully ordered)

    Twinning:
    - Albite law: reflection on {010} — most common, produces polysynthetic twins
    - Pericline law: rotation on b-axis — produces "pericline" striations
    - Both together: produces the characteristic grid of pericline + albite twins

    Peristerite: intergrowth of albite + oligoclase (Ab₉₀An₁₀) at low T.
    Creates moonstone adularescence — blue-white schiller from light scattering
    on submicroscopic exsolution lamellae.

    Cleavelandite: platy, lamellar albite habit from low-T hydrothermal fluids.
    """
    sigma = conditions.supersaturation_albite()

    if sigma < 1.0:
        # Albite kaolinization: 2 NaAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite +
        # 2 Na⁺ + 4 SiO₂. Al stays in the kaolinite phase (Al sink);
        # only Na and SiO₂ go back to the fluid. Albite is more
        # acid-resistant than K-feldspar (pH threshold 3 vs 4).
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Na += dissolved_um * 0.3
            conditions.fluid.Al += dissolved_um * 0.05   # most Al stays in kaolinite
            conditions.fluid.SiO2 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"albite kaolinization (pH {conditions.fluid.pH:.1f}) — Na⁺ + SiO₂ released, Al conserved in kaolinite"
            )
        return None

    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)

    if rate < 0.1:
        return None

    T = conditions.temperature

    # Temperature determines ordering state
    if T > 450:
        ordering = "high-albite (monalbite, disordered Al/Si)"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "{010} face", "{110} prism"]
    else:
        ordering = "low-albite (fully ordered)"
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{001} cleavage", "{010} face", "polysynthetic twinning"]

    # Cleavelandite: platy lamellar habit from low-T hydrothermal conditions
    cleavelandite = False
    if T < 350 and rate < 3.0:
        if random.random() < 0.25:
            cleavelandite = True
            crystal.habit = "cleavelandite (platy lamellar)"
            crystal.dominant_forms = ["thin platy lamellae", "curved aggregates"]

    # Twinning — albite has two main twin laws
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    # Peristerite / moonstone check
    # Albite + oligoclase intergrowth creates adularescence
    peristerite = False
    if T < 400 and conditions.fluid.Ca > 2:
        if random.random() < 0.15:
            peristerite = True

    # Color
    if peristerite:
        color_note = "peristerite moonstone (blue-white adularescence from exsolution)"
    elif cleavelandite:
        color_note = "white, lamellar"
    else:
        color_note = "white to colorless"

    # Deplete Na, Al, SiO₂ from fluid
    conditions.fluid.Na -= rate * 0.012
    conditions.fluid.Na = max(conditions.fluid.Na, 0)
    conditions.fluid.Al -= rate * 0.006
    conditions.fluid.Al = max(conditions.fluid.Al, 0)
    conditions.fluid.SiO2 -= rate * 0.010
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2, 0)

    # Build zone note
    parts = [ordering]
    if cleavelandite:
        parts.append("cleavelandite")
    if peristerite:
        parts.append("peristerite intergrowth")
    parts.append(color_note)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Al=conditions.fluid.Al * 0.03,
        note=", ".join(parts)
    )


def grow_topaz(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Topaz (Al₂SiO₄(F,OH)₂) growth model.

    Orthorhombic nesosilicate, prismatic with steep pyramidal terminations and
    perfect basal {001} cleavage. F-gated supersaturation: the crystal won't
    nucleate or grow until fluorine passes a saturation threshold.

    Imperial color: trace Cr³⁺ (sourced from ultramafic country rock, NOT
    from the main pegmatite fluid) substitutes for Al³⁺ in the structure.
    - Cr < 3 ppm → colorless to pale blue (F-rich) or pale yellow
    - Cr 3–8 ppm → imperial golden-orange (the Ouro Preto signature)
    - Cr > 8 ppm → pink imperial (rarest, can be intensified by radiation)

    Fluid inclusions at growth-zone boundaries are the main geothermometer —
    the homogenization temperature of a 2-phase inclusion captures the T at
    which that zone grew.
    """
    sigma = conditions.supersaturation_topaz()

    if sigma < 1.0:
        # Very stable — only strong acid (pH < 2) dissolves topaz.
        if crystal.total_growth_um > 10 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.04)
            conditions.fluid.Al += dissolved_um * 0.3
            conditions.fluid.SiO2 += dissolved_um * 0.2
            conditions.fluid.F += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"strong-acid dissolution (pH {conditions.fluid.pH:.1f}) — Al³⁺, SiO₂, F⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    T = conditions.temperature

    # Habit cues from the variant selector are set at nucleation. Here we
    # refine dominant_forms based on thermal regime — higher T favors
    # stubbier equant forms, lower T gives steep pyramidal terminations.
    if T > 450:
        crystal.dominant_forms = ["m{110} prism", "y{041} pyramid", "c{001} pinacoid", "stubby"]
    elif T > 380:
        crystal.dominant_forms = ["m{110} prism", "y{041} pyramid", "{021} pyramid"]
    else:
        crystal.dominant_forms = ["m{110} prism", "steep {021}+{041} pyramids", "c{001} basal cleavage"]

    # Imperial color flag from trace Cr. Real imperial topaz takes up Cr³⁺
    # as a direct substitute for Al³⁺; the Ouro Preto threshold is sub-ppm
    # in the crystal but needs ~few ppm in the fluid to deposit enough.
    Cr_fluid = conditions.fluid.Cr
    F_fluid = conditions.fluid.F
    if Cr_fluid > 8.0:
        color_note = f"pink imperial (Cr³⁺ {Cr_fluid:.1f} ppm — rare, Cr⁴⁺ oxidation-state coloring)"
        crystal.habit = "prismatic_imperial_pink"
    elif Cr_fluid > 3.0:
        color_note = f"imperial golden-orange (Cr³⁺ {Cr_fluid:.1f} ppm — the Ouro Preto signature)"
        crystal.habit = "prismatic_imperial"
    elif F_fluid > 40 and conditions.fluid.Fe < 5 and Cr_fluid < 0.5:
        color_note = "pale blue (F-rich fluid, no Cr chromophore)"
    elif conditions.fluid.Fe > 15:
        color_note = "pale yellow to brown (Fe³⁺ substitution)"
    else:
        color_note = "colorless to water-clear"

    # Trace element incorporation (rough partition coefficients)
    trace_Fe = conditions.fluid.Fe * 0.008
    trace_Al = conditions.fluid.Al * 0.02  # mostly structural, recorded as trace
    trace_Ti = conditions.fluid.Ti * 0.015  # rutile microinclusions, "sagenite" look

    # Fluid inclusions — topaz is famous for well-preserved 2-phase inclusions.
    # Primary inclusions trap growth fluid; homogenization T is the
    # geothermometer that pinned Ouro Preto at 360°C (Morteani 2002).
    fi = False
    fi_type = ""
    if rate > 4 and random.random() < 0.25:
        fi = True
        if T > 350:
            fi_type = "2-phase (liquid + vapor) — geothermometer primary"
        elif T > 150:
            fi_type = "2-phase (liquid-dominant)"
        else:
            fi_type = "single-phase liquid (late, low-T)"

    # Deplete fluid. Stoichiometry is approximate — we're tracking
    # incompatible-element drawdown, not mass balance.
    conditions.fluid.Al = max(conditions.fluid.Al - rate * 0.015, 0)
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2 - rate * 0.012, 0)
    conditions.fluid.F = max(conditions.fluid.F - rate * 0.018, 0)

    note_parts = [color_note]
    if excess > 1.0:
        note_parts.append("rapid growth — potential growth hillocks on prism faces")
    elif excess < 0.2:
        note_parts.append("near-equilibrium — clean layer growth, gem-quality potential")
    if crystal.twinned:
        note_parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Al=trace_Al, trace_Ti=trace_Ti,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(note_parts),
    )


def grow_tourmaline(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Tourmaline growth model (schorl → elbaite series).

    Cyclosilicate, trigonal, elongated prisms with deep vertical
    striations and a slightly rounded triangular cross-section {101̄0}.
    The schorl→elbaite transition records the pegmatite fluid's
    evolution: schorl (Fe²⁺-dominant black) early, elbaite (Li-dominant
    colored) late as Fe depletes and Li accumulates.

    Color is a fluid composition snapshot, chosen per growth zone:
    - Fe²⁺ dominant → schorl (black)
    - Li-rich + Mn²⁺ → rubellite (pink)
    - Li-rich + Cr³⁺/V³⁺ → verdelite (green)
    - Li-rich + Fe²⁺ + Ti → indicolite (blue)
    - Cu²⁺ trace → Paraíba (neon blue, rare)
    - Otherwise → achroite (colorless)

    Extremely resistant to weathering — no dissolution path in this
    simplified model.
    """
    sigma = conditions.supersaturation_tourmaline()
    if sigma < 1.0:
        return None  # tourmaline is basically immortal once grown

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Color variant from current fluid composition. Log-order checks: most
    # distinctive flags win. Track via zone notes so _narrate_tourmaline
    # can read them; also set crystal.habit on the first colored zone so
    # the library UI picks up the species name.
    f = conditions.fluid
    is_li_rich = f.Li > 10.0
    color_note = ""
    variety = "schorl"  # default — the early Fe²⁺ end-member
    if f.Cu > 1.0:
        variety = "paraiba"
        color_note = f"neon Paraíba blue (Cu²⁺ {f.Cu:.2f} ppm — extreme rarity)"
    elif is_li_rich and f.Mn > 0.3 and f.Fe < 15:
        variety = "rubellite"
        color_note = f"pink rubellite (Mn²⁺ {f.Mn:.1f} + Li {f.Li:.0f} ppm)"
    elif is_li_rich and (f.Cr > 0.5 or f.V > 1.0):
        variety = "verdelite"
        color_note = f"green verdelite ({'Cr³⁺' if f.Cr > 0.5 else 'V³⁺'} + Li {f.Li:.0f} ppm)"
    elif is_li_rich and f.Fe > 5 and f.Ti > 0.3:
        variety = "indicolite"
        color_note = f"blue indicolite (Fe²⁺+Ti with Li {f.Li:.0f} ppm)"
    elif f.Fe > 15 and f.Li < 5:
        variety = "schorl"
        color_note = f"black schorl (Fe²⁺ {f.Fe:.0f} ppm dominant, Li-depleted)"
    elif is_li_rich:
        variety = "elbaite"
        color_note = f"colorless achroite (Li-bearing elbaite, trace elements muted)"
    else:
        color_note = "dark olive-brown (mixed Fe/Mg character)"

    # Stamp the variety onto the crystal. A crystal can span schorl→elbaite
    # zones during a single life — the habit reflects whatever the latest
    # zone says, which is how color-zoned tourmaline records time evolution.
    crystal.habit = variety

    if conditions.temperature > 500:
        crystal.dominant_forms = ["m{10̄10} prism", "r{101̄1} + o{022̄1} terminations", "deep striations"]
    else:
        crystal.dominant_forms = ["m{10̄10} prism", "slight rounded triangular cross-section", "deep striations"]

    # Trace incorporation — Mn, Fe, Cr, Li all captured in notes, but we
    # stash Fe/Mn on the zone so predict_fluorescence and color averaging
    # across zones work.
    trace_Fe = f.Fe * 0.04   # tourmaline is a decent Fe sink
    trace_Mn = f.Mn * 0.02
    trace_Al = f.Al * 0.03
    trace_Ti = f.Ti * 0.01

    # Deplete the fluid — this is how the schorl→elbaite transition drives
    # itself: Fe goes down, Li builds up relative to Fe, and later zones
    # start reading as elbaite varieties.
    f.B = max(f.B - rate * 0.025, 0)
    f.Na = max(f.Na - rate * 0.008, 0)
    f.Al = max(f.Al - rate * 0.015, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.020, 0)
    if variety == "schorl" or variety == "indicolite":
        f.Fe = max(f.Fe - rate * 0.012, 0)
    if is_li_rich or variety in ("rubellite", "verdelite", "indicolite", "elbaite"):
        f.Li = max(f.Li - rate * 0.010, 0)
    if variety == "rubellite":
        f.Mn = max(f.Mn - rate * 0.008, 0)
    if variety == "verdelite":
        if f.Cr > 0.5:
            f.Cr = max(f.Cr - rate * 0.005, 0)
        else:
            f.V = max(f.V - rate * 0.006, 0)
    if variety == "paraiba":
        f.Cu = max(f.Cu - rate * 0.015, 0)

    parts = [color_note]
    # Striated growth is ubiquitous — every zone gets the record.
    parts.append("vertical striations deepen — every growth pulse leaves a ridge")
    if excess > 1.5:
        parts.append("rapid growth — radial sprays possible")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean prismatic growth")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn,
        trace_Al=trace_Al, trace_Ti=trace_Ti,
        note=", ".join(parts),
    )


def _beryl_family_habit_forms(T: float) -> list:
    """Shared hexagonal crystal-form list for all 5 beryl-family engines.

    T > 500°C → elongated prismatic (classic pegmatite pocket habit)
    T 380-500 → standard hexagonal
    T < 380°C → stubby tabular (late-stage cool habit)
    """
    if T > 500:
        return ["m{10̄10} hex prism", "c{0001} basal pinacoid", "elongated"]
    elif T > 380:
        return ["m{10̄10} hex prism", "c{0001} flat pinacoid", "classic hexagonal"]
    else:
        return ["m{10̄10} hex prism", "c{0001} pinacoid", "stubby tabular"]


def _beryl_family_dissolution(
    crystal: Crystal, conditions: VugConditions, step: int,
) -> Optional[GrowthZone]:
    """Shared HF-only dissolution path for all beryl-family crystals.

    Beryl-structure silicates are resistant to most acids — dissolution
    only in HF (pH < 3 + F > 30). Used by goshenite + 4 varieties.
    """
    if crystal.total_growth_um > 20 and conditions.fluid.pH < 3.0 and conditions.fluid.F > 30:
        crystal.dissolved = True
        dissolved_um = min(1.5, crystal.total_growth_um * 0.03)
        conditions.fluid.Be += dissolved_um * 0.2
        conditions.fluid.Al += dissolved_um * 0.2
        conditions.fluid.SiO2 += dissolved_um * 0.4
        return GrowthZone(
            step=step, temperature=conditions.temperature,
            thickness_um=-dissolved_um, growth_rate=-dissolved_um,
            note=(
                f"HF-assisted dissolution (pH {conditions.fluid.pH:.1f}, "
                f"F {conditions.fluid.F:.0f}) — Be²⁺, Al³⁺, SiO₂ released"
            ),
        )
    return None


def grow_beryl(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Beryl/goshenite (Be₃Al₂Si₆O₁₈ — colorless/generic) growth.

    Post-Round-7 architecture: this engine is the **goshenite/generic**
    beryl — fires when no chromophore variety's gate is met. The 4
    chromophore varieties (emerald, aquamarine, morganite, heliodor) are
    now first-class species with their own grow functions.

    Hexagonal cyclosilicate. The growth_rate_mult of 0.25 is slow, but
    beryl rides it for a long time because Be accumulates for ages
    before crossing the nucleation threshold. That accumulation delay is
    why beryl crystals can be enormous — by the time the first crystal
    fires there's a lot of Be waiting.
    """
    sigma = conditions.supersaturation_beryl()
    if sigma < 1.0:
        return _beryl_family_dissolution(crystal, conditions, step)

    excess = sigma - 1.0
    rate = 2.2 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    crystal.habit = "goshenite"
    crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature)

    trace_Fe = f.Fe * 0.010  # below aquamarine gate (Fe < 8); pale tint at most
    trace_Al = f.Al * 0.025

    fi = False
    fi_type = ""
    if rate > 3 and random.random() < 0.22:
        fi = True
        T = conditions.temperature
        if T > 350:
            fi_type = "2-phase (liquid + vapor) — beryl geothermometer"
        elif T > 150:
            fi_type = "2-phase (liquid-dominant)"
        else:
            fi_type = "single-phase liquid (late)"

    f.Be = max(f.Be - rate * 0.025, 0)
    f.Al = max(f.Al - rate * 0.010, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.015, 0)

    parts = ["goshenite colorless (pure beryl — no chromophore above variety gate)"]
    if excess > 1.0:
        parts.append("rapid growth — wider growth ring, thermal history recorder")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Al=trace_Al,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(parts),
    )


def grow_emerald(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Emerald (Be₃Al₂Si₆O₁₈ + Cr³⁺/V³⁺) growth — the chromium variety.

    The 'emerald paradox': Cr/V is ultramafic, Be is pegmatitic; these
    chemistries almost never coexist. Emerald forms where pegmatite fluid
    meets ultramafic country rock. Highest priority in the beryl-family
    dispatch — fires first when Cr ≥ 0.5 or V ≥ 1.0.
    """
    sigma = conditions.supersaturation_emerald()
    if sigma < 1.0:
        return _beryl_family_dissolution(crystal, conditions, step)

    excess = sigma - 1.0
    rate = 2.2 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    # Trapiche: rare 6-spoke wheel pattern (Colombian Muzo specialty) —
    # high σ + fluid-inclusion combo.
    if excess > 1.2 and random.random() < 0.05:
        crystal.habit = "trapiche"
    else:
        crystal.habit = "hex_prism"
    crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature)

    # Chromophore note
    if f.Cr > 0.5:
        color_note = f"emerald green (Cr³⁺ {f.Cr:.2f} ppm — the ultramafic-pegmatite paradox met)"
    else:
        color_note = f"emerald green (V³⁺ {f.V:.2f} ppm — Colombian-type chromophore)"

    trace_Fe = f.Fe * 0.010
    trace_Mn = f.Mn * 0.010
    trace_Al = f.Al * 0.025

    # Fluid-inclusion frequency (especially around trapiche sectors)
    fi = False
    fi_type = ""
    if rate > 3 and random.random() < 0.30:
        fi = True
        fi_type = "2-phase (liquid + vapor) — emerald signature"

    # Deplete fluid — Be, Al, SiO2 + Cr (preferred) or V
    f.Be = max(f.Be - rate * 0.025, 0)
    f.Al = max(f.Al - rate * 0.010, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.015, 0)
    if f.Cr > 0.5:
        f.Cr = max(f.Cr - rate * 0.004, 0)
    else:
        f.V = max(f.V - rate * 0.005, 0)

    parts = [color_note]
    if crystal.habit == "trapiche":
        parts.append("trapiche pattern — 6-spoke sector growth with black inclusion rays (Colombian Muzo)")
    if excess > 1.0:
        parts.append("rapid growth — wider growth ring")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn, trace_Al=trace_Al,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(parts),
    )


def grow_aquamarine(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Aquamarine (Be₃Al₂Si₆O₁₈ + Fe²⁺) growth — the blue Fe²⁺ variety.

    Most abundant gem beryl variety — every gem-producing pegmatite yields
    aquamarine. Fires when Fe ≥ 8 with no higher-priority chromophore and
    Fe NOT in the heliodor band (Fe ≥ 15 + oxidizing → heliodor takes over).
    """
    sigma = conditions.supersaturation_aquamarine()
    if sigma < 1.0:
        return _beryl_family_dissolution(crystal, conditions, step)

    excess = sigma - 1.0
    rate = 2.2 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    T = conditions.temperature
    # Habit selection: long prism is the Cruzeiro signature; stubby at low T.
    if T < 380:
        crystal.habit = "stubby_tabular"
    else:
        crystal.habit = "hex_prism_long"
    crystal.dominant_forms = _beryl_family_habit_forms(T)

    color_note = f"aquamarine blue (Fe²⁺ {f.Fe:.1f} ppm, reducing/moderate-O2)"
    if f.Fe > 12:
        color_note = f"Santa Maria deep blue (Fe²⁺ {f.Fe:.1f} ppm, high-Fe reducing)"

    trace_Fe = f.Fe * 0.015
    trace_Al = f.Al * 0.025

    fi = False
    fi_type = ""
    if rate > 3 and random.random() < 0.22:
        fi = True
        fi_type = "2-phase (liquid + vapor) — beryl geothermometer"

    # Deplete fluid
    f.Be = max(f.Be - rate * 0.025, 0)
    f.Al = max(f.Al - rate * 0.010, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.015, 0)
    f.Fe = max(f.Fe - rate * 0.008, 0)

    parts = [color_note]
    if excess > 1.0:
        parts.append("rapid growth — thermal history recorder")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Al=trace_Al,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(parts),
    )


def grow_morganite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Morganite (Be₃Al₂Si₆O₁₈ + Mn²⁺) growth — the pink Mn variety.

    Late-stage pegmatite mineral; Mn accumulates in residual fluid while
    earlier phases (feldspar, quartz, aquamarine) crystallize. Named by
    George F. Kunz (1911) for J.P. Morgan.
    """
    sigma = conditions.supersaturation_morganite()
    if sigma < 1.0:
        return _beryl_family_dissolution(crystal, conditions, step)

    excess = sigma - 1.0
    rate = 2.2 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    # Morganite's signature habit is the flat tabular plate.
    if excess > 0.5:
        crystal.habit = "tabular_hex"
    else:
        crystal.habit = "stubby_prism"
    crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature)

    color_note = f"morganite pink (Mn²⁺/Mn³⁺ {f.Mn:.1f} ppm, irradiation-oxidized)"
    if f.Mn < 3:
        color_note = f"peach morganite (Mn²⁺ {f.Mn:.1f} ppm, pre-irradiation state)"

    trace_Mn = f.Mn * 0.020
    trace_Al = f.Al * 0.025

    fi = False
    fi_type = ""
    if rate > 3 and random.random() < 0.22:
        fi = True
        fi_type = "2-phase (liquid + vapor) — late-stage pegmatite signature"

    # Deplete fluid
    f.Be = max(f.Be - rate * 0.025, 0)
    f.Al = max(f.Al - rate * 0.010, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.015, 0)
    f.Mn = max(f.Mn - rate * 0.006, 0)

    parts = [color_note]
    if excess > 1.0:
        parts.append("rapid growth — late-stage pocket concentration")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Mn=trace_Mn, trace_Al=trace_Al,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(parts),
    )


def grow_heliodor(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Heliodor (Be₃Al₂Si₆O₁₈ + Fe³⁺) growth — the yellow oxidized-Fe variety.

    Narrower window than aquamarine: needs Fe ≥ 15 AND O2 > 0.5. Same Fe
    as aquamarine but in the 3+ oxidation state — the aquamarine/heliodor
    split is the cleanest redox record in the gem world. Volodarsk
    (Namibia) is the type locality.
    """
    sigma = conditions.supersaturation_heliodor()
    if sigma < 1.0:
        return _beryl_family_dissolution(crystal, conditions, step)

    excess = sigma - 1.0
    rate = 2.2 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    crystal.habit = "hex_prism"
    crystal.dominant_forms = _beryl_family_habit_forms(conditions.temperature)

    color_note = f"heliodor yellow (Fe³⁺ {f.Fe:.0f} ppm, oxidized)"
    if f.Fe > 25:
        color_note = f"Namibian deep-yellow heliodor (Fe³⁺ {f.Fe:.0f} ppm, strongly oxidized)"

    trace_Fe = f.Fe * 0.015
    trace_Al = f.Al * 0.025

    fi = False
    fi_type = ""
    if rate > 3 and random.random() < 0.20:
        fi = True
        fi_type = "2-phase (liquid + vapor) — oxidizing pocket signature"

    # Deplete fluid
    f.Be = max(f.Be - rate * 0.025, 0)
    f.Al = max(f.Al - rate * 0.010, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.015, 0)
    f.Fe = max(f.Fe - rate * 0.008, 0)

    parts = [color_note]
    if excess > 1.0:
        parts.append("rapid growth under oxidizing pulse")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Al=trace_Al,
        fluid_inclusion=fi, inclusion_type=fi_type,
        note=", ".join(parts),
    )


# ============================================================
# CORUNDUM FAMILY (Al₂O₃) — first UPPER-gate mineral in the sim
# ============================================================

def _corundum_family_habit(conditions: VugConditions, excess: float) -> Tuple[str, list]:
    """Shared habit dispatch for corundum/ruby/sapphire.

    High-T (>700°C) typically gives the "barrel" (steep dipyramid) habit
    that's diagnostic of basalt-hosted xenocrysts. Lower-T contact
    metamorphic (marble-hosted Mogok) prefers flat tabular. Short prism
    is the intermediate habit.
    """
    T = conditions.temperature
    if T > 700 and excess > 0.5:
        return "barrel", ["c{0001} short basal", "n{22̄43} steep dipyramid", "barrel profile"]
    elif T < 600:
        return "tabular", ["c{0001} flat basal pinacoid", "m{10̄10} subordinate prism", "flat tabular"]
    else:
        return "prism", ["m{10̄10} hexagonal prism", "c{0001} flat basal", "short hexagonal"]


def grow_corundum(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Corundum (Al₂O₃ — colorless/generic) growth.

    Fires only when no chromophore variety's gate is met (priority chain
    is ruby > sapphire > corundum). The defining constraint is SiO₂ < 50:
    below this, corundum stable; above, Al + SiO₂ partition into feldspar/
    Al₂SiO₅ polymorphs instead. Acid-inert in all sim conditions.
    """
    sigma = conditions.supersaturation_corundum()
    if sigma < 1.0:
        return None  # corundum is acid-inert — no dissolution branch

    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    crystal.habit, crystal.dominant_forms = _corundum_family_habit(conditions, excess)

    # Colorless corundum — trace elements below chromophore thresholds.
    color_note = "colorless corundum (no chromophore above variety gate)"
    if f.Ti > 0.1 and f.Ti < 0.5:
        color_note = f"pale grey corundum (trace Ti {f.Ti:.2f} ppm)"
    elif f.Fe > 1 and f.Fe < 5:
        color_note = f"pale brown corundum (trace Fe {f.Fe:.1f} ppm, below sapphire gate)"

    trace_Fe = f.Fe * 0.008
    trace_Ti = f.Ti * 0.020
    trace_Al = f.Al * 0.025

    # Deplete fluid — Al is the sink; corundum is the Al-sequestration
    # mineral. No competing SiO2 consumption since Si is undersaturated.
    f.Al = max(f.Al - rate * 0.015, 0)

    parts = [color_note]
    if excess > 1.0:
        parts.append("rapid growth — contact metamorphic pulse")
    elif excess < 0.2:
        parts.append("near-equilibrium — gem-clarity interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Ti=trace_Ti, trace_Al=trace_Al,
        note=", ".join(parts),
    )


def grow_ruby(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Ruby (Al₂O₃ + Cr³⁺) growth — the red chromium variety of corundum.

    The Cr chromophore drives color. Asterated ruby (6-rayed star) comes
    from aligned rutile needle inclusions along basal plane; modeled via
    a trace_Ti + high-σ trigger. "Pigeon's blood" tag fires when Cr +
    trace Fe both present (Mogok signature).
    """
    sigma = conditions.supersaturation_ruby()
    if sigma < 1.0:
        return None  # acid-inert

    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    crystal.habit, crystal.dominant_forms = _corundum_family_habit(conditions, excess)

    # 6-rayed asterism — rutile-needle trigger
    if f.Ti > 0.3 and excess > 0.5 and random.random() < 0.08:
        crystal.habit = "asterated"
        crystal.dominant_forms = ["c{0001} basal dominant", "aligned rutile needles", "6-rayed asterism"]

    # Color sub-dispatch for ruby variety
    if f.Cr > 10.0:
        color_note = f"cherry-red ruby (Cr³⁺ {f.Cr:.1f} ppm — deep saturation)"
    elif f.Cr > 5.0 and f.Fe > 1.0:
        color_note = f"pigeon's blood ruby (Cr³⁺ {f.Cr:.1f} + trace Fe — Mogok signature)"
    elif f.Cr > 3.0:
        color_note = f"Mogok ruby red (Cr³⁺ {f.Cr:.1f} ppm)"
    else:
        color_note = f"pinkish ruby (Cr³⁺ {f.Cr:.1f} ppm — near threshold)"

    trace_Fe = f.Fe * 0.008
    trace_Ti = f.Ti * 0.025
    trace_Al = f.Al * 0.025

    # Deplete fluid — Al + Cr
    f.Al = max(f.Al - rate * 0.015, 0)
    f.Cr = max(f.Cr - rate * 0.003, 0)

    parts = [color_note]
    if crystal.habit == "asterated":
        parts.append("6-rayed asterism — rutile needle inclusions aligned along basal")
    if excess > 1.0:
        parts.append("rapid growth — peak metamorphic pulse")
    elif excess < 0.2:
        parts.append("near-equilibrium — gem-clarity interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Ti=trace_Ti, trace_Al=trace_Al,
        note=", ".join(parts),
    )


def grow_sapphire(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Sapphire (Al₂O₃ + Fe/Ti/V/Cr-trace) growth — non-red corundum.

    Multi-color dispatch: blue (Fe+Ti IVCT), yellow (Fe³⁺), padparadscha
    (Cr+trace Fe), pink (low Cr), violet (V), green (Fe alone special).
    Sub-variety selected from current fluid at each zone.
    """
    sigma = conditions.supersaturation_sapphire()
    if sigma < 1.0:
        return None  # acid-inert

    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    crystal.habit, crystal.dominant_forms = _corundum_family_habit(conditions, excess)

    # 6-rayed asterism — rutile-needle trigger
    if f.Ti > 0.5 and excess > 0.5 and random.random() < 0.06:
        crystal.habit = "asterated"
        crystal.dominant_forms = ["c{0001} basal dominant", "aligned rutile needles", "6-rayed star sapphire"]

    # Color sub-dispatch — priority: padparadscha > blue > violet > yellow > pink > green
    if 0.5 <= f.Cr < 2.0 and f.Fe >= 2 and f.Fe < 10:
        # Padparadscha: Cr + trace Fe pink-orange (Sri Lanka, Madagascar)
        color_note = f"padparadscha (Cr³⁺ {f.Cr:.2f} + Fe {f.Fe:.1f} — pink-orange)"
        variety = "padparadscha"
    elif f.Fe >= 5 and f.Ti >= 0.5:
        # Blue: Fe+Ti IVCT
        if f.Fe < 10 and f.Ti < 1.5:
            color_note = f"cornflower blue sapphire (Fe {f.Fe:.1f} + Ti {f.Ti:.2f} — Kashmir-type)"
            variety = "cornflower_kashmir"
        else:
            color_note = f"royal blue sapphire (Fe {f.Fe:.1f} + Ti {f.Ti:.2f} — Fe-Ti intervalence)"
            variety = "royal_blue"
    elif f.V >= 2.0:
        color_note = f"violet sapphire (V³⁺ {f.V:.2f} — Tanzania-type)"
        variety = "violet"
    elif f.Fe >= 20:
        color_note = f"yellow sapphire (Fe³⁺ {f.Fe:.0f} — Fe alone)"
        variety = "yellow"
    elif f.Cr > 0.5 and f.Cr < 2.0:
        color_note = f"pink sapphire (Cr³⁺ {f.Cr:.2f} — sub-ruby threshold)"
        variety = "pink_sapphire"
    else:
        # Catch-all — Fe without Ti at moderate concentration = green
        color_note = f"green sapphire (Fe {f.Fe:.1f} — no Ti, oxidation-dependent)"
        variety = "green"

    trace_Fe = f.Fe * 0.012
    trace_Ti = f.Ti * 0.025
    trace_Al = f.Al * 0.025

    # Deplete fluid — Al + chromophores based on variety
    f.Al = max(f.Al - rate * 0.015, 0)
    if variety in ("cornflower_kashmir", "royal_blue"):
        f.Fe = max(f.Fe - rate * 0.004, 0)
        f.Ti = max(f.Ti - rate * 0.002, 0)
    elif variety == "yellow":
        f.Fe = max(f.Fe - rate * 0.005, 0)
    elif variety == "violet":
        f.V = max(f.V - rate * 0.003, 0)
    elif variety == "padparadscha":
        f.Cr = max(f.Cr - rate * 0.002, 0)
        f.Fe = max(f.Fe - rate * 0.002, 0)
    elif variety == "pink_sapphire":
        f.Cr = max(f.Cr - rate * 0.002, 0)
    else:  # green
        f.Fe = max(f.Fe - rate * 0.003, 0)

    parts = [color_note]
    if crystal.habit == "asterated":
        parts.append("6-rayed asterism — aligned rutile inclusions along basal")
    if excess > 1.0:
        parts.append("rapid growth — peak metamorphic pulse")
    elif excess < 0.2:
        parts.append("near-equilibrium — gem-clarity interior")
    if crystal.twinned:
        parts.append(f"{crystal.twin_law} present")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Ti=trace_Ti, trace_Al=trace_Al,
        note=", ".join(parts),
    )


def grow_spodumene(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Spodumene (LiAlSi₂O₆) growth model.

    Monoclinic pyroxene — the "book shape" flattened tabular prism.
    Two cleavage directions at ~87° produce the characteristic parting
    planes; when the crystal survives dissolution events, parting
    fragments litter the pocket floor.

    Varieties:
    - Pure/Fe-trace → triphane (yellow-green, the default)
    - Mn²⁺ → kunzite (pink-lilac, strong SW fluorescence)
    - Cr³⁺ → hiddenite (green, rarer than kunzite)

    No practical acid dissolution. Can span triphane→kunzite zones
    if Mn rises mid-growth.
    """
    sigma = conditions.supersaturation_spodumene()
    if sigma < 1.0:
        return None  # resistant to acids; no dissolution path

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid

    # Variety selection. Cr → hiddenite; Mn → kunzite; nothing → triphane
    if f.Cr > 0.5:
        variety = "hiddenite"
        color_note = f"hiddenite green (Cr³⁺ {f.Cr:.2f} ppm)"
    elif f.Mn > 2.0:
        variety = "kunzite"
        color_note = f"kunzite pink-lilac (Mn²⁺ {f.Mn:.1f} ppm — strong SW fluorescence)"
    elif f.Fe > 10:
        variety = "triphane_yellow"
        color_note = f"yellow-green triphane (Fe {f.Fe:.0f} ppm, pale tint)"
    else:
        variety = "triphane"
        color_note = "colorless to pale yellow triphane (pure)"

    crystal.habit = variety

    # Dominant forms — monoclinic pyroxene, flattened tabular habit is
    # the signature. Two cleavages at ~87° always written into the form
    # list so narrators can pick it up.
    T = conditions.temperature
    if T > 550:
        crystal.dominant_forms = ["m{110} prism", "a{100} pinacoid", "{110}∧{1̄10} ≈87° prismatic cleavages", "blade"]
    else:
        crystal.dominant_forms = ["m{110} prism", "a{100} + b{010} pinacoids", "{110}∧{1̄10} ≈87° cleavages", "flattened tabular 'book'"]

    trace_Fe = f.Fe * 0.008
    trace_Mn = f.Mn * 0.025   # Mn is a strong spodumene partitioner (kunzite)
    trace_Al = f.Al * 0.020

    # Deplete fluid — Li is the gate element.
    f.Li = max(f.Li - rate * 0.020, 0)
    f.Al = max(f.Al - rate * 0.008, 0)
    f.SiO2 = max(f.SiO2 - rate * 0.020, 0)
    if variety == "kunzite":
        f.Mn = max(f.Mn - rate * 0.010, 0)
    elif variety == "hiddenite":
        f.Cr = max(f.Cr - rate * 0.004, 0)

    parts = [color_note]
    parts.append("~87° pyroxene cleavage direction established")
    if excess > 1.0:
        parts.append("rapid growth — more color-causing impurity trapped")
    elif excess < 0.2:
        parts.append("near-equilibrium — clean gem-grade interior")

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Mn=trace_Mn, trace_Al=trace_Al,
        note=", ".join(parts),
    )


def grow_magnetite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Magnetite (Fe₃O₄) growth — octahedral at the HM redox buffer."""
    sigma = conditions.supersaturation_magnetite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and (conditions.fluid.pH < 2.5 or conditions.fluid.O2 > 1.4):
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Fe += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"dissolution (pH {conditions.fluid.pH:.1f}, O₂ {conditions.fluid.O2:.1f}) — martite conversion if oxidizing"
            )
        return None
    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.5:
        crystal.habit = "granular_massive"
        crystal.dominant_forms = ["granular massive aggregate"]
        color_note = "black massive magnetite"
    elif conditions.temperature > 400 and 0.5 < excess < 1.2:
        crystal.habit = "rhombic_dodecahedral"
        crystal.dominant_forms = ["{110} rhombic dodecahedron", "with mineralizer"]
        color_note = "black rhombic dodecahedral (high-T, mineralizer-assisted)"
    else:
        crystal.habit = "octahedral"
        crystal.dominant_forms = ["{111} octahedron", "metallic black"]
        color_note = "black octahedral — strongly magnetic (lodestone)"
    f.Fe = max(f.Fe - rate * 0.025, 0)
    f.O2 = max(f.O2 - rate * 0.003, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=f.Fe * 0.03, note=color_note,
    )


def grow_lepidocrocite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Lepidocrocite (γ-FeOOH) growth — ruby-red platy dimorph of goethite."""
    sigma = conditions.supersaturation_lepidocrocite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            d = min(1.5, crystal.total_growth_um * 0.06)
            conditions.fluid.Fe += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "fibrous_micaceous"
        crystal.dominant_forms = ["fibrous micaceous aggregate", "rapid-oxidation signature"]
        color_note = "rust-brown fibrous (fast Fe²⁺ oxidation, coarser particles)"
    elif excess > 0.4:
        crystal.habit = "plumose_rosette"
        crystal.dominant_forms = ["plumose rosette", "radiating platy"]
        color_note = "ruby-red plumose rosette"
    else:
        crystal.habit = "platy_scales"
        crystal.dominant_forms = ["{010} platy scales", "perfect basal cleavage (mica-like)"]
        color_note = "pink-mauve to ruby-red platy (nanoscale 'lithium quartz' pigment scale)"
    f.Fe = max(f.Fe - rate * 0.020, 0)
    f.O2 = max(f.O2 - rate * 0.002, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=f.Fe * 0.02, note=color_note,
    )


def grow_stibnite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Stibnite (Sb₂S₃) growth — sword-blade sulfide."""
    sigma = conditions.supersaturation_stibnite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Sb += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.2:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["massive granular aggregate"]
        color_note = "lead-gray massive granular stibnite"
    elif excess > 0.5:
        crystal.habit = "radiating_spray"
        crystal.dominant_forms = ["radiating bladed spray", "sword-blade aggregate"]
        color_note = "radiating spray of steel-gray blades"
    else:
        crystal.habit = "elongated_prism_blade"
        crystal.dominant_forms = ["elongated {110} prism", "sword-blade terminations", "brilliant metallic luster"]
        color_note = "elongated sword-blade — the Ichinokawa habit (lead-gray metallic)"
    f.Sb = max(f.Sb - rate * 0.025, 0)
    f.S = max(f.S - rate * 0.018, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_bismuthinite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Bismuthinite (Bi₂S₃) growth — stibnite's Bi cousin."""
    sigma = conditions.supersaturation_bismuthinite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Bi += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    T = conditions.temperature
    if T > 350:
        crystal.habit = "stout_prismatic"
        crystal.dominant_forms = ["stout {110} prism", "tin-white metallic"]
        color_note = f"stout prismatic bismuthinite (high-T form, T={T:.0f}°C)"
    elif excess > 1.0:
        crystal.habit = "radiating_cluster"
        crystal.dominant_forms = ["radiating cluster", "needle bundle"]
        color_note = "radiating cluster of fine bismuthinite needles"
    else:
        crystal.habit = "acicular_needle"
        crystal.dominant_forms = ["acicular {110} needles", "lead-gray with iridescent tarnish"]
        color_note = f"acicular needles (low-T form, T={T:.0f}°C) — iridescent tarnish develops"
    f.Bi = max(f.Bi - rate * 0.030, 0)
    f.S = max(f.S - rate * 0.018, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_native_bismuth(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native bismuth (Bi) growth — the lowest-melting native metal."""
    sigma = conditions.supersaturation_native_bismuth()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.8:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Bi += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidation (O₂ {conditions.fluid.O2:.1f}) — bismite/bismutite surface forms"
            )
        return None
    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["massive granular silver-white"]
        color_note = "massive granular native bismuth"
    elif excess > 0.25 and random.random() < 0.1:
        crystal.habit = "rhombohedral_crystal"
        crystal.dominant_forms = ["{0001} basal pinacoid", "rhombohedral trigonal"]
        color_note = "rhombohedral crystal (rare — well-formed in open vug)"
    else:
        crystal.habit = "arborescent_dendritic"
        crystal.dominant_forms = ["arborescent branching", "dendritic fracture fill"]
        color_note = "arborescent native bismuth — silver-white tree-like growth, iridescent tarnish expected"
    f.Bi = max(f.Bi - rate * 0.035, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_clinobisvanite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Clinobisvanite (BiVO₄) growth — microscopic yellow Bi-vanadate."""
    sigma = conditions.supersaturation_clinobisvanite()
    if sigma < 1.0:
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 2.5:
            crystal.dissolved = True
            d = min(0.5, crystal.total_growth_um * 0.05)
            conditions.fluid.Bi += d * 0.4
            conditions.fluid.V += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None
    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)   # microscopic, slow
    if rate < 0.1:
        return None
    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "powdery_aggregate"
        crystal.dominant_forms = ["powdery yellow-orange aggregate", "micro-crystalline"]
        color_note = "powdery orange-yellow clinobisvanite (rapid growth, thicker crust)"
    else:
        crystal.habit = "micro_plates_yellow"
        crystal.dominant_forms = ["{010} micro plates", "yellow monoclinic"]
        color_note = "bright yellow micro-platy clinobisvanite (photocatalyst for water splitting)"
    f.Bi = max(f.Bi - rate * 0.025, 0)
    f.V = max(f.V - rate * 0.012, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=color_note,
    )


def grow_cuprite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Cuprite (Cu₂O) growth — the Eh-boundary mineral.

    Four habit variants depending on σ and space:
    - octahedral: slow growth, open vug
    - chalcotrichite (plush/hair): very fast directional, high σ
    - massive earthy ("tile ore"): rapid, space-constrained
    - spinel-law twin: rare, moderate σ
    """
    sigma = conditions.supersaturation_cuprite()
    if sigma < 1.0:
        # Strong acid or pushed past the Eh window → dissolves
        if crystal.total_growth_um > 5 and (conditions.fluid.pH < 3.5 or conditions.fluid.O2 > 1.5):
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.07)
            conditions.fluid.Cu += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"dissolution — Eh window exceeded (pH {conditions.fluid.pH:.1f}, O₂ {conditions.fluid.O2:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if excess > 1.5:
        crystal.habit = "chalcotrichite"
        crystal.dominant_forms = ["hair-like {100} whiskers", "plush velvet texture"]
        color_note = f"chalcotrichite — hair-like Cu₂O whiskers (σ {sigma:.2f}, rapid directional growth)"
    elif excess > 0.8:
        crystal.habit = "massive_earthy"
        crystal.dominant_forms = ["massive earthy 'tile ore'", "dark red-brown"]
        color_note = "massive earthy — 'tile ore' in dark red-brown (rapid growth in tight space)"
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026); the
    # former 0.3<excess<0.8 'spinel_twin' habit branch was driven by the
    # simultaneous spinel-law twin roll, which now happens at nucleation
    # time. The habit name is unused without that twin gate, so any
    # spinel-twinned cuprite (still rolled at p=0.05 per minerals.json)
    # now carries the default "octahedral" habit below + the twinned
    # flag for rendering.
    else:
        crystal.habit = "octahedral"
        crystal.dominant_forms = ["{111} octahedron", "dark red to black with ruby internal reflection"]
        color_note = "dark red octahedral (ruby-red internal reflection in thin crystals)"

    f.Cu = max(f.Cu - rate * 0.035, 0)
    # Cuprite growth slightly consumes O2 (Cu metal + oxygen → Cu oxide)
    f.O2 = max(f.O2 - rate * 0.002, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_azurite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Azurite (Cu₃(CO₃)₂(OH)₂) growth — deep blue copper carbonate.

    Azurite → malachite conversion mechanic: if CO₃ drops below a
    threshold during azurite's lifetime, the crystal is marked dissolved
    and its chemistry is released to fluid — the pseudomorph would then
    form when malachite nucleates on the same wall cell.
    """
    sigma = conditions.supersaturation_azurite()
    if sigma < 1.0:
        # Acid dissolution (carbonate fizzes)
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += d * 0.5
            conditions.fluid.CO3 += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"carbonate dissolution (pH {conditions.fluid.pH:.1f}) — fizzes, Cu²⁺ + CO₃²⁻ released"
            )
        # Azurite → malachite conversion: CO3 dropped below high-pCO2 threshold
        if crystal.total_growth_um > 5 and conditions.fluid.CO3 < 80:
            crystal.dissolved = True
            d = min(2.5, crystal.total_growth_um * 0.08)
            conditions.fluid.Cu += d * 0.5
            conditions.fluid.CO3 += d * 0.3   # less than full dissolve — some CO2 escapes
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"azurite → malachite conversion (CO₃ {conditions.fluid.CO3:.0f} ppm drops below pseudomorph threshold)"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.0:
        crystal.habit = "azurite_sun"
        crystal.dominant_forms = ["radiating flat disc", "azurite-sun in fracture"]
        color_note = "deep blue azurite-sun — radiating disc habit in narrow fracture"
    elif excess > 0.4:
        crystal.habit = "rosette_bladed"
        crystal.dominant_forms = ["radiating bladed crystals", "rosette"]
        color_note = "deep blue rosette of radiating blades"
    else:
        crystal.habit = "deep_blue_prismatic"
        crystal.dominant_forms = ["monoclinic prismatic", "deep azure/midnight blue"]
        color_note = "deep azure-blue monoclinic prism"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.025, 0)
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_chrysocolla(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Chrysocolla (Cu₂H₂Si₂O₅(OH)₄) growth — cryptocrystalline cyan-blue
    copper silicate. Grows as botryoidal enamel crusts, grape-cluster
    reniform globules, pseudomorphs after azurite, or thin films over
    earlier cuprite.

    Dissolves in strong acid (pH < 4.5) — releases Cu + SiO₂. Unlike
    azurite/malachite it does NOT pseudomorph further — it's the
    terminal member of the copper oxidation sequence in the sim.
    """
    sigma = conditions.supersaturation_chrysocolla()
    if sigma < 1.0:
        # Acid dissolution — Cu²⁺ + silicic acid released
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            d = min(2.5, crystal.total_growth_um * 0.08)
            conditions.fluid.Cu += d * 0.4
            conditions.fluid.SiO2 += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — Cu²⁺ + silicic acid released"
            )
        # Thermal decomposition — dehydrates toward plancheite/shattuckite
        # above ~100 °C. Modeled as quiet removal so the Cu is returned
        # to the fluid pool without a growth zone.
        if crystal.total_growth_um > 5 and conditions.temperature > 120:
            crystal.dissolved = True
            d = min(1.5, crystal.total_growth_um * 0.05)
            conditions.fluid.Cu += d * 0.3
            conditions.fluid.SiO2 += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"dehydration at {conditions.temperature:.0f} °C — chrysocolla is a strict low-T phase"
            )
        return None

    excess = sigma - 1.0
    # Cryptocrystalline / slow — growth_rate_mult 0.45 from spec
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — based on substrate and σ
    on_cuprite = "cuprite" in (crystal.position or "")
    on_azurite = "azurite" in (crystal.position or "") or "pseudomorph after azurite" in (crystal.position or "")
    on_native_cu = "native_copper" in (crystal.position or "")
    if on_azurite:
        crystal.habit = "pseudomorph_after_azurite"
        crystal.dominant_forms = ["azurite prism outline preserved", "chrysocolla fill"]
        color_note = "cyan chrysocolla pseudomorph — azurite's monoclinic prisms outline preserved in copper silicate"
    elif on_cuprite:
        crystal.habit = "enamel_on_cuprite"
        crystal.dominant_forms = ["thin conformal film"]
        color_note = "sky-blue enamel over the earlier cuprite — Bisbee signature"
    elif on_native_cu:
        crystal.habit = "botryoidal_crust"
        crystal.dominant_forms = ["grape-cluster lobes"]
        color_note = "cyan botryoidal crust coating the native copper sheets"
    elif excess > 1.2:
        crystal.habit = "reniform_globules"
        crystal.dominant_forms = ["reniform globule cluster", "glassy conchoidal fracture"]
        color_note = "thick reniform chrysocolla globules — grape-cluster cyan"
    elif excess > 0.3:
        crystal.habit = "botryoidal_crust"
        crystal.dominant_forms = ["botryoidal crust", "enamel-like"]
        color_note = "cyan-blue botryoidal crust — hydrous copper silicate enamel"
    else:
        crystal.habit = "silica_gel_hemisphere"
        crystal.dominant_forms = ["gel hemisphere"]
        color_note = "pale cyan silica-gel hemisphere — low σ, rounded drop"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.020, 0)
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2 - rate * 0.035, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_native_gold(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native gold (Au) growth — the noble metal.

    Gold doesn't dissolve in surface or hydrothermal conditions (it's
    famously inert; the only natural dissolver is HCl + HNO3 + heat,
    which doesn't occur in vugs). So no acid-dissolution branch — once
    a gold crystal forms it persists indefinitely.

    Habit selection follows the σ excess gradient and gets a color
    note when alloying elements (Cu, Ag) are present in the parent
    fluid. Future Au-Te or Au-Cu coupling could fork this into native
    gold vs calaverite/sylvanite vs cuproauride, but that needs the
    Te-mineral engines to land first.
    """
    sigma = conditions.supersaturation_native_gold()
    if sigma < 1.0:
        return None  # Au is essentially indestructible — no dissolution path

    excess = sigma - 1.0
    # Gold growth is intrinsically slow (low Au activity even when
    # supersaturated). 1.5x base rate vs native_copper's 2.0x reflects
    # gold's lower free-fluid concentration.
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.05:
        return None

    # Habit by σ excess (parallels native_copper habit logic):
    #   high σ → nugget / massive
    #   moderate σ → dendritic / spongy
    #   low σ → octahedral well-formed
    if excess > 1.5:
        crystal.habit = "nugget"
        crystal.dominant_forms = ["rounded nugget", "massive native gold"]
        habit_note = "nugget — rapid precipitation in pocket"
    elif excess > 0.5:
        crystal.habit = "dendritic"
        crystal.dominant_forms = ["dendritic {111} branching", "spongy gold"]
        habit_note = "dendritic / spongy native gold (the fishbone-and-leaf habit of supergene Au)"
    else:
        crystal.habit = "octahedral"
        crystal.dominant_forms = ["{111} octahedron", "rare well-formed crystal"]
        habit_note = "octahedral well-formed native gold (rare — slow growth)"

    # Alloying elements present in parent fluid set color note.
    # Real-world ranges: Au-Ag electrum < 80% Au is "electrum" proper;
    # Au-Cu rose-gold and cuproauride are diagnostic of Cu-rich systems
    # like Bisbee. The sim picks one note based on which alloying
    # element is dominant; doesn't model both at once.
    if conditions.fluid.Ag > conditions.fluid.Cu * 0.5 and conditions.fluid.Ag > 5:
        habit_note += "; Ag-alloyed (electrum, pale yellow tint)"
    elif conditions.fluid.Cu > 50:
        habit_note += "; Cu-alloyed (rose-gold tint, cuproauride affinity)"

    # Au consumption from the fluid — small because Au activity is low.
    # 0.05 ratio is conservative; high-rate growth still drains the Au
    # pool but slowly enough that Bingham/Bisbee Au=2-3 ppm can sustain
    # multiple crystals.
    conditions.fluid.Au = max(conditions.fluid.Au - rate * 0.05, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_native_copper(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native copper (Cu) growth — the elemental metal."""
    sigma = conditions.supersaturation_native_copper()
    if sigma < 1.0:
        # Oxidative dissolution if conditions shift — native Cu becomes
        # cuprite surface film, eventually malachite coating
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.7:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Cu += d * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidation (O₂ {conditions.fluid.O2:.1f}) — forms cuprite surface film, then malachite if CO₃ is present"
            )
        return None

    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)   # slow
    if rate < 0.1:
        return None

    # Habit selection: narrow channel = wire, open space + fast = sheet,
    # moderate = arborescent, rare slow = cubic/dodecahedral
    crowded = any(c.active and c.crystal_id != crystal.crystal_id for c in []) if False else False
    # Simplified — just use excess value as proxy. Real-world native Cu
    # habits depend on pore geometry which the sim doesn't model.
    if excess > 1.5:
        crystal.habit = "massive_sheet"
        crystal.dominant_forms = ["massive sheet copper", "fills large void"]
        color_note = "massive sheet copper (rapid precipitation in open void)"
    elif excess > 0.6:
        crystal.habit = "arborescent_dendritic"
        crystal.dominant_forms = ["arborescent branching growth", "dendritic {100}"]
        color_note = "arborescent dendritic — tree-like branching copper"
    elif excess > 0.25:
        crystal.habit = "wire_copper"
        crystal.dominant_forms = ["wire growth along narrow channel", "filamentary Cu"]
        color_note = "wire copper — filamentary growth in narrow channel"
    else:
        crystal.habit = "cubic_dodecahedral"
        crystal.dominant_forms = ["{100} cube", "{110} rhombic dodecahedron", "rare well-formed crystal"]
        color_note = "cubic/dodecahedral well-formed native copper (rare)"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.04, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_bornite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Bornite (Cu₅FeS₄) growth — peacock ore.

    228°C order-disorder transition flag in dominant_forms. Iridescent
    tarnish on oxidizing surfaces is a cosmetic flag (recorded in
    zone note). Competes with chalcopyrite for Cu+Fe+S.
    """
    sigma = conditions.supersaturation_bornite()
    if sigma < 1.0:
        # Oxidative dissolution — sulfides go to Cu²⁺ + Fe³⁺ at O2 > 1
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.3:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.08)
            conditions.fluid.Cu += d * 0.4
            conditions.fluid.Fe += d * 0.2
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidative dissolution (O₂ {conditions.fluid.O2:.1f}) — releases Cu²⁺, Fe³⁺, S"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    T = conditions.temperature
    if T > 228:
        crystal.habit = "pseudo_cubic"
        crystal.dominant_forms = ["pseudo-cubic {100}", "disordered high-T form"]
        color_note = f"bronze fresh (high-T disordered Cu/Fe, T={T:.0f}°C)"
    elif T > 80:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["massive granular", "low-T orthorhombic, ordered Cu/Fe"]
        color_note = f"bronze fresh (ordered low-T form, T={T:.0f}°C)"
    else:
        crystal.habit = "peacock_iridescent"
        crystal.dominant_forms = ["peacock tarnish on ordered bornite", "thin-film iridescence"]
        color_note = f"peacock iridescent tarnish (Cu²⁺ surface products, T={T:.0f}°C)"

    trace_Fe = f.Fe * 0.02
    f.Cu = max(f.Cu - rate * 0.03, 0)
    f.Fe = max(f.Fe - rate * 0.008, 0)
    f.S = max(f.S - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe,
        note=color_note,
    )


def grow_chalcocite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Chalcocite (Cu₂S) growth — the supergene Cu enrichment mineral.

    Pseudo-hexagonal cyclic sixling twins fire at moderate σ. The
    'pseudomorph thief' habit is flagged when the crystal grows on
    chalcopyrite or bornite (via position string from nucleate()).
    """
    sigma = conditions.supersaturation_chalcocite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += d * 0.5
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidative dissolution (O₂ {conditions.fluid.O2:.1f}) — Cu²⁺, S released"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    if crystal.twinned and "sixling" in (crystal.twin_law or ""):
        crystal.habit = "stellate_sixling"
        crystal.dominant_forms = ["pseudo-hexagonal sixling twin", "dark gray metallic"]
        color_note = "pseudo-hexagonal sixling twin — the collector habit"
    elif "chalcopyrite" in (crystal.position or "") or "bornite" in (crystal.position or ""):
        crystal.habit = "pseudomorph"
        crystal.dominant_forms = ["pseudomorph after host — inherits outline", "Cu-enriched replacement"]
        color_note = "pseudomorphic — replaced host atom-by-atom (Cu enrichment blanket)"
    elif excess > 1.2:
        crystal.habit = "sooty_massive"
        crystal.dominant_forms = ["sooty microcrystalline aggregate", "supergene enrichment blanket"]
        color_note = "sooty microcrystalline black (rapid enrichment precipitation)"
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{110} prism", "tabular habit"]
        color_note = "dark gray metallic tabular"

    f.Cu = max(f.Cu - rate * 0.04, 0)   # chalcocite is a Cu sink
    f.S = max(f.S - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_covellite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Covellite (CuS) growth — the only common naturally blue mineral.

    Hexagonal platy habit. Iridescent tarnish on fresh cleavage is
    flagged when the crystal is near an oxidation boundary (O₂ mid-
    range 0.5–1.2).
    """
    sigma = conditions.supersaturation_covellite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.2:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += d * 0.4
            conditions.fluid.S += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"oxidative dissolution (O₂ {conditions.fluid.O2:.1f}) — Cu²⁺ + S released"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if excess > 1.0:
        crystal.habit = "rosette_radiating"
        crystal.dominant_forms = ["radiating hexagonal plates", "rosette"]
        color_note = "indigo-blue radiating rosette"
    elif 0.5 < f.O2 < 1.2:
        crystal.habit = "iridescent_coating"
        crystal.dominant_forms = ["iridescent cleavage {0001}", "purple-green thin-film interference"]
        color_note = f"indigo-blue with iridescent purple-green tarnish (near oxidation boundary, O₂ {f.O2:.1f})"
    else:
        crystal.habit = "hex_plate"
        crystal.dominant_forms = ["{0001} hexagonal basal plate", "perfect basal cleavage — peels like mica"]
        color_note = "indigo-blue hexagonal plate — the only common blue mineral"

    f.Cu = max(f.Cu - rate * 0.03, 0)
    f.S = max(f.S - rate * 0.03, 0)   # covellite has 2× S of chalcocite

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=color_note,
    )


def grow_anglesite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Anglesite (PbSO₄) growth — orthorhombic lead sulfate.

    Intermediate in the lead oxidation sequence. Tends to pseudomorph
    galena (inherits cube shape) when it nucleates on a dissolving
    galena crystal. Adamantine luster — one of the most visually
    brilliant non-metallic minerals.
    """
    sigma = conditions.supersaturation_anglesite()
    if sigma < 1.0:
        # Slow acid dissolution
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.05)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        # Carbonate replacement — when CO3 is high, anglesite recrystallizes
        # to cerussite. The sim doesn't "transform" crystals, but we can
        # mark anglesite for dissolution when carbonate is overwhelming.
        if crystal.total_growth_um > 5 and conditions.fluid.CO3 > 150:
            crystal.dissolved = True
            d = min(1.5, crystal.total_growth_um * 0.04)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.S += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"anglesite → cerussite (CO₃ {conditions.fluid.CO3:.0f} ppm overwhelms)"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if f.Fe > 3.0:
        color_note = f"yellow-amber tint (Fe {f.Fe:.0f} ppm)"
    elif f.Cu > 2.0:
        color_note = f"pale blue-green tint (Cu {f.Cu:.1f} ppm)"
    else:
        color_note = "colorless to white, adamantine luster"

    crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism", "o{011} orthorhombic dome"]

    trace_Fe = f.Fe * 0.015
    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.02, 0)
    f.S = max(f.S - rate * 0.018, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_cerussite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Cerussite (PbCO₃) growth — orthorhombic lead carbonate.

    Stellate cyclic twin on {110} is the diagnostic habit: three
    individuals intergrown at 120° producing a perfect six-ray star.
    Twin probability is high at moderate σ (spec: 0.4).
    """
    sigma = conditions.supersaturation_cerussite()
    if sigma < 1.0:
        # Carbonate — fizzes in acid (pH < 4)
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.0:
            crystal.dissolved = True
            d = min(3.0, crystal.total_growth_um * 0.1)
            conditions.fluid.Pb += d * 0.5
            conditions.fluid.CO3 += d * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"carbonate dissolution (pH {conditions.fluid.pH:.1f}) — PbCO₃ + 2H⁺ → Pb²⁺ + H₂O + CO₂, fizzes"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    if f.Cu > 5.0:
        color_note = f"blue-green tint (Cu {f.Cu:.1f} ppm)"
    else:
        color_note = "colorless to white, adamantine, extreme birefringence"
    if crystal.twinned and "sixling" in (crystal.twin_law or ""):
        color_note += " — six-ray stellate twin"

    if crystal.twinned and "sixling" in (crystal.twin_law or ""):
        crystal.habit = "stellate_sixling"
        crystal.dominant_forms = ["cyclic {110} sixling twin", "pseudo-hexagonal outline"]
    elif excess > 1.2:
        crystal.habit = "acicular"
        crystal.dominant_forms = ["fine {110} needles", "radiating sprays"]
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism"]

    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.02, 0)
    f.CO3 = max(f.CO3 - rate * 0.015, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_pyromorphite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Pyromorphite (Pb₅(PO₄)₃Cl) growth — hexagonal apatite-group phosphate.

    Barrel-shaped hexagonal prisms. Olive-green to yellow. Classic
    supergene mineral — P and Cl in meteoric water meet residual Pb
    from an oxidizing Pb-bearing horizon. Can pseudomorph cerussite
    and galena.
    """
    sigma = conditions.supersaturation_pyromorphite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.5:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.P += d * 0.2
            conditions.fluid.Cl += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if f.Fe > 5.0:
        color_note = f"brown to olive-brown (Fe {f.Fe:.0f} ppm)"
        crystal.habit = "brown_hex_barrel"
    elif f.Ca > 80.0:
        color_note = f"pale yellow-orange (phosphoapatite-adjacent, Ca {f.Ca:.0f} ppm)"
        crystal.habit = "yellow_hex_barrel"
    else:
        color_note = "classic olive-green hexagonal barrel"
        crystal.habit = "olive_hex_barrel"

    # Hoppered habit at high σ — edges grow faster than faces
    if excess > 1.5:
        crystal.dominant_forms = ["hoppered {10̄10} hexagonal prism", "step-faced edges"]
    else:
        crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} flat pinacoid", "barrel profile"]

    trace_Fe = f.Fe * 0.015
    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.025, 0)
    f.P = max(f.P - rate * 0.008, 0)
    f.Cl = max(f.Cl - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_vanadinite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Vanadinite (Pb₅(VO₄)₃Cl) growth — hexagonal apatite-group vanadate.

    Bright red-orange hexagonal prisms. Classic desert supergene
    mineral — V from oxidizing red-bed ironstones, Pb from galena.
    Color mechanism: V⁵⁺ in the crystal field produces the red-orange;
    trace As substitutes to give endlichite (yellow).
    """
    sigma = conditions.supersaturation_vanadinite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 2.5:
            crystal.dissolved = True
            d = min(2.0, crystal.total_growth_um * 0.06)
            conditions.fluid.Pb += d * 0.3
            conditions.fluid.V += d * 0.2
            conditions.fluid.Cl += d * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-d, growth_rate=-d,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f})"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    f = conditions.fluid
    if f.As > 2.0:
        color_note = f"yellow endlichite (As {f.As:.1f} + V {f.V:.1f} mix)"
        crystal.habit = "endlichite_yellow"
    elif f.Fe > 5.0:
        color_note = f"brown-orange (Fe {f.Fe:.0f} ppm)"
        crystal.habit = "brown_hex_prism"
    else:
        color_note = f"bright red-orange (V⁵⁺ {f.V:.1f} ppm — the signature)"
        crystal.habit = "red_hex_prism"

    crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} pinacoid", "flat basal termination"]

    trace_Fe = f.Fe * 0.010
    trace_Pb = f.Pb * 0.015

    f.Pb = max(f.Pb - rate * 0.025, 0)
    f.V = max(f.V - rate * 0.008, 0)
    f.Cl = max(f.Cl - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=trace_Fe, trace_Pb=trace_Pb,
        note=color_note,
    )


def grow_galena(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Galena (PbS) growth. Cubic lead sulfide, bright metallic luster, very dense."""
    sigma = conditions.supersaturation_galena()

    if sigma < 1.0:
        # Oxidative dissolution under O2 — the dominant pathway (path to cerussite/anglesite/wulfenite)
        if crystal.total_growth_um > 3 and conditions.fluid.O2 > 1.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Pb += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="oxidation — galena dissolving, releasing Pb²⁺ (path to cerussite/anglesite)"
            )
        # Strong-acid dissolution (per spec acid_dissolution.pH_threshold = 2.0).
        # PbS + 2H⁺ → Pb²⁺ + H₂S — slow, non-oxidative, classic lab reaction.
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 2.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.05)  # slower than oxidative
            conditions.fluid.Pb += dissolved_um * 0.3
            conditions.fluid.S += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"strong-acid dissolution (pH {conditions.fluid.pH:.1f}) — PbS + 2H⁺ → Pb²⁺ + H₂S"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    if 200 <= conditions.temperature <= 400:
        rate *= 1.2
    if rate < 0.1:
        return None

    crystal.habit = "cubic"
    crystal.dominant_forms = ["{100} cube", "{111} octahedron"]

    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.005, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    color_note = "lead-gray, bright metallic luster"
    if conditions.fluid.Ag > 5:
        color_note += ", argentiferous (Ag inclusions)"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.005,
        trace_Pb=conditions.fluid.Pb * 0.01,
        note=color_note
    )


def grow_uraninite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Uraninite (UO₂) growth — pitch-black primary uranium mineral.

    Gatekeeper for the entire secondary uranium family (research-uraninite.md,
    boss canonical 2026-05-01). Forms only under reducing conditions (any
    O₂ converts U⁴⁺ → soluble U⁶⁺ uranyl). When subsequent oxidation reaches
    a grown crystal, the engine dissolves it and releases U back to broth —
    the feedstock event for torbernite, zeunerite, carnotite (and future
    autunite/tyuyamunite). Mirror of molybdenite's oxidation block.

    Habit dispatch (per research §157 game variants):
      T > 500°C → octahedral (pegmatitic, high-T well-formed crystals)
      T 200-500°C → pitchblende_massive (hydrothermal botryoidal, the default)
      T < 200°C → pitchblende_massive (low-T cryptocrystalline, roll-front)
    """
    sigma = conditions.supersaturation_uraninite()

    if sigma < 1.0:
        # Oxidative dissolution — the gatekeeper feedstock event.
        # UO₂ + ½O₂ + 2H⁺ → UO₂²⁺ (soluble uranyl) + H₂O
        # Releases U back to broth so secondary U minerals can nucleate.
        if crystal.total_growth_um > 3 and conditions.fluid.O2 > 0.3:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.U += dissolved_um * 0.6  # uranyl ion released
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=(f"oxidation — uraninite weathers, releasing UO₂²⁺ "
                      f"(U fluid: {conditions.fluid.U:.0f} ppm)")
            )
        return None

    rate = 4.0 * sigma * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit dispatch — research §157
    T = conditions.temperature
    if T > 500:
        crystal.habit = "octahedral"
        crystal.dominant_forms = ["{111} octahedron"]
    else:
        # 200-500 hydrothermal botryoidal AND <200 cryptocrystalline both
        # carry the pitchblende_massive habit per minerals.json variants.
        crystal.habit = "pitchblende_massive"
        crystal.dominant_forms = ["botryoidal masses", "colloform banding"]

    conditions.fluid.U = max(conditions.fluid.U - rate * 0.005, 0)

    if T > 500:
        color_note = "pitch-black, submetallic luster — pegmatitic octahedron"
    elif T >= 200:
        color_note = "greasy black pitchblende, botryoidal crust"
    else:
        color_note = "cryptocrystalline black mass — roll-front uraninite"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.01,
        note=f"{color_note} — radioactive"
    )


def grow_molybdenite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Molybdenite (MoS₂) growth. Soft hexagonal platy, bluish-gray metallic."""
    sigma = conditions.supersaturation_molybdenite()

    if sigma < 1.0:
        # Oxidation releases Mo back to fluid — essential for wulfenite
        if crystal.total_growth_um > 3 and conditions.fluid.O2 > 0.3:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.15)
            conditions.fluid.Mo += dissolved_um * 0.8
            conditions.fluid.S += dissolved_um * 0.2
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidation — molybdenite dissolves, releasing MoO₄²⁻ (Mo fluid: {conditions.fluid.Mo:.0f} ppm)"
            )
        return None

    rate = 4.0 * sigma * random.uniform(0.8, 1.2)
    if 300 <= conditions.temperature <= 500:
        rate *= 1.3
    if rate < 0.1:
        return None

    crystal.habit = "hexagonal platy"
    crystal.dominant_forms = ["{0001} basal pinacoid", "{10-10} prism"]

    conditions.fluid.Mo = max(conditions.fluid.Mo - rate * 0.004, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.002,
        note="bluish-gray metallic, platy habit, sectile"
    )


def grow_goethite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Goethite (FeO(OH)) growth — the ghost mineral made real.

    FeO(OH) — rust with a crystal name. Low-temperature oxidation product of
    Fe-sulfides and Fe²⁺ fluids. Botryoidal, mammillary, fibrous. Often
    pseudomorphs pyrite/marcasite (Egyptian Prophecy Stones = goethite after
    marcasite). Dehydrates to hematite above 300°C — hence the thermal cap.
    """
    sigma = conditions.supersaturation_goethite()

    if sigma < 1.0:
        # Acid dissolution (FeO(OH) + 3H⁺ → Fe³⁺ + 2H₂O)
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.0:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Fe += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — goethite releases Fe³⁺"
            )
        return None

    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.7, 1.3)
    if rate < 0.1:
        return None

    # Habit evolves with zone count — botryoidal aggregates build up
    zone_count = len(crystal.zones)
    if zone_count >= 20:
        crystal.habit = "botryoidal/stalactitic"
        crystal.dominant_forms = ["botryoidal masses", "velvety surfaces"]
    elif zone_count >= 8:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["grape-like clusters", "reniform masses"]
    elif "pseudomorph after" in crystal.position:
        crystal.habit = "pseudomorph_after_sulfide"
        crystal.dominant_forms = ["replaces sulfide cube", "preserves parent habit"]
    else:
        crystal.habit = "fibrous_acicular"
        crystal.dominant_forms = ["radiating needles", "velvet crust"]

    # Botryoidal aggregates expand laterally too
    if "botryoidal" in crystal.habit:
        crystal.a_width_mm = crystal.c_length_mm * 1.6

    conditions.fluid.Fe = max(conditions.fluid.Fe - rate * 0.008, 0)
    # Goethite incorporation of oxygen — decrement O2 slightly
    conditions.fluid.O2 = max(conditions.fluid.O2 - rate * 0.001, 0)

    # Color note
    if "pseudomorph" in crystal.habit:
        color_note = "yellow-brown pseudomorph after pyrite — the boxwork ghost"
    elif "botryoidal" in crystal.habit:
        color_note = "black lustrous botryoidal surfaces, velvety sheen"
    else:
        color_note = "yellow-brown earthy to ochre"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.02,
        note=color_note
    )


def grow_smithsonite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Smithsonite (ZnCO₃) growth. Botryoidal supergene carbonate — sphalerite's oxidation heir."""
    sigma = conditions.supersaturation_smithsonite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Zn += dissolved_um * 0.6
            conditions.fluid.CO3 += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — smithsonite fizzes, releasing Zn²⁺"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    zone_count = len(crystal.zones)
    if zone_count >= 15:
        crystal.habit = "botryoidal/stalactitic"
        crystal.dominant_forms = ["botryoidal crusts", "stalactitic masses"]
    elif rate > 6:
        crystal.habit = "rhombohedral"
        crystal.dominant_forms = ["{10-11} rhombohedron", "curved faces"]
    else:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["grape-like clusters", "reniform masses"]

    if "botryoidal" in crystal.habit:
        crystal.a_width_mm = crystal.c_length_mm * 1.8

    conditions.fluid.Zn = max(conditions.fluid.Zn - rate * 0.008, 0)
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - rate * 0.005, 0)

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    if conditions.fluid.Cu > 15:
        color_note = "apple-green (Cu impurity)"
    elif conditions.fluid.Fe > 20:
        color_note = "yellow-brown (Fe impurity)"
    elif conditions.fluid.Mn > 10:
        color_note = "pink (Mn impurity)"
    else:
        color_note = "blue-green" if random.random() < 0.4 else "white to pale blue"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.01,
        trace_Mn=conditions.fluid.Mn * 0.03,
        note=f"{crystal.habit}, {color_note}"
    )


def grow_wulfenite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Wulfenite (PbMoO₄) growth. Thin tabular plates, orange-yellow. The sunset mineral."""
    sigma = conditions.supersaturation_wulfenite()

    if sigma < 1.0:
        if crystal.total_growth_um > 3 and conditions.fluid.pH < 3.5:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Pb += dissolved_um * 0.5
            conditions.fluid.Mo += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="acid dissolution — wulfenite releases Pb²⁺ and MoO₄²⁻"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    crystal.habit = "tabular"
    crystal.dominant_forms = ["{001} tabular plates", "square outline"]
    # Very flat plates
    crystal.a_width_mm = crystal.c_length_mm * 3.0

    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.006, 0)
    conditions.fluid.Mo = max(conditions.fluid.Mo - rate * 0.004, 0)

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    if conditions.fluid.Cr > 5:
        color_note = "red-orange (Cr impurity)"
    elif rate > 5:
        color_note = "honey-yellow, translucent"
    else:
        color_note = "orange tabular plates" if random.random() < 0.5 else "honey-orange, vitreous luster"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.005,
        trace_Pb=conditions.fluid.Pb * 0.01,
        note=color_note
    )


def grow_ferrimolybdite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Ferrimolybdite (Fe₂(MoO₄)₃·nH₂O) growth. Canary-yellow acicular tufts.

    The "no-lead branch" of Mo oxidation. Fast-growing, powdery to
    fibrous; rarely forms display-grade crystals. Hardness ~2, very
    soft. Coexists with wulfenite (both nucleate from oxidized MoO₄²⁻)
    but wins the early window because ferrimolybdite's σ threshold and
    growth rate are higher.

    Dehydrates / dissolves at moderate T (>150°C) or very acidic
    (pH<2) — Mo and Fe return to fluid, potentially feeding a late
    wulfenite pulse if Pb is present.
    """
    sigma = conditions.supersaturation_ferrimolybdite()

    if sigma < 1.0:
        # Dehydration (T>150) or acid-loss (pH<2) releases Fe + MoO₄²⁻.
        # Ferrimolybdite is metastable — it gives up its MoO₄²⁻ relatively
        # easily compared to wulfenite's stable lead lock.
        if crystal.total_growth_um > 2 and (conditions.fluid.pH < 2 or conditions.temperature > 150):
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.18)
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.Mo += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="dehydration — ferrimolybdite crumbles, releasing Fe³⁺ + MoO₄²⁻"
            )
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)  # fast growth — the defining trait
    if rate < 0.1:
        return None

    # Habit by σ excess:
    #   very high σ → powdery crust (mass accretion, no crystal form)
    #   high σ → fibrous mat (felted yellow aggregate)
    #   moderate σ → acicular tufts (classic radiating hair-like habit)
    if excess > 2.0:
        crystal.habit = "powdery crust"
        crystal.dominant_forms = ["earthy yellow powder", "sulfur-yellow coating"]
        habit_note = "canary-yellow powdery crust on molybdenite"
    elif excess > 0.8:
        crystal.habit = "fibrous mat"
        crystal.dominant_forms = ["dense fibrous mats", "yellow felted aggregate"]
        habit_note = "fibrous mat of yellow ferrimolybdite"
    else:
        crystal.habit = "acicular tuft"
        crystal.dominant_forms = ["radiating acicular tufts", "hair-like fibers"]
        habit_note = "acicular radiating tufts of canary-yellow ferrimolybdite"

    conditions.fluid.Mo = max(conditions.fluid.Mo - rate * 0.003, 0)
    conditions.fluid.Fe = max(conditions.fluid.Fe - rate * 0.004, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.01,
        note=habit_note
    )


def grow_scorodite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Scorodite (FeAsO₄·2H₂O) growth — pale blue-green pseudo-octahedral dipyramids.

    Forms from oxidized arsenopyrite (and any other As-bearing sulfide).
    The arsenic sequestration mineral — locks AsO₄³⁻ in stable crystals
    as long as pH stays below 5. Releases AsO₄³⁻ back to fluid above
    pH 5 (feeds the higher-pH arsenate suite) or above 160°C
    (dehydrates to anhydrous FeAsO₄).
    """
    sigma = conditions.supersaturation_scorodite()

    if sigma < 1.0:
        # Two dissolution paths: alkaline shift (pH > 5.5 with hysteresis)
        # OR thermal dehydration (T > 160°C). Both release AsO₄³⁻ for
        # downstream arsenates.
        if crystal.total_growth_um > 2 and (conditions.fluid.pH > 5.5 or conditions.temperature > 160):
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.As += dissolved_um * 0.5  # AsO₄³⁻ for downstream arsenates
            cause = "pH>5" if conditions.fluid.pH > 5.5 else "T>160°C"
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"dissolution ({cause}) — scorodite releases AsO₄³⁻ for downstream arsenates"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit by σ excess:
    #   high σ → earthy_crust (greenish-brown powder, supergene weathering)
    #   moderate σ → dipyramidal (the diagnostic pseudo-octahedral habit)
    #   low σ → well-formed dipyramids (display quality, deep blue-green)
    if excess > 1.5:
        crystal.habit = "earthy_crust"
        crystal.dominant_forms = ["powdery greenish-brown crust"]
        habit_note = "earthy greenish-brown scorodite crust on arsenopyrite"
    elif excess > 0.5:
        crystal.habit = "dipyramidal"
        crystal.dominant_forms = ["pseudo-octahedral dipyramids"]
        habit_note = "pseudo-octahedral pale blue-green scorodite dipyramids"
    else:
        crystal.habit = "dipyramidal"
        crystal.dominant_forms = ["well-formed dipyramids", "deep blue-green"]
        habit_note = "well-formed deep blue-green scorodite (Tsumeb-style)"

    # Color tint by Fe content
    if conditions.fluid.Fe > 30:
        habit_note += " (deep blue, Fe-rich)"

    conditions.fluid.Fe = max(conditions.fluid.Fe - rate * 0.005, 0)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.005,
        note=habit_note
    )


def grow_arsenopyrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Arsenopyrite (FeAsS) growth — the arsenic gateway, the #1 Au-trapper.

    Mesothermal primary sulfide; silver-white striated prisms with
    diamond cross-section. Consumes Fe + As + S; simultaneously traps
    fluid Au as "invisible-gold" trace — up to 1500 ppm structurally
    bound in the lattice (Reich et al. 2005). This creates a natural
    competition with grow_native_gold: at reducing high-T phases where
    arsenopyrite is happy, it skims Au out of the broth before native
    gold can nucleate freely. When the fluid later oxidizes, the
    released Au comes back, enabling the classic supergene-Au-
    enrichment signature of orogenic oxidation zones (Graeme et al.
    2019 for Bisbee).

    Oxidation-dissolution (O₂>0.5, thickness>3µm) releases Fe + As +
    S back to fluid, acidifies via H₂SO₄, and returns trapped Au.
    The released Fe + AsO₄³⁻ feed scorodite; the returned Au and
    the acidified / oxidizing fluid feed a new generation of
    native_gold nucleation.
    """
    sigma = conditions.supersaturation_arsenopyrite()

    if sigma < 1.0:
        # Oxidation-dissolution — the supergene conversion pathway.
        # arsenopyrite + O₂ + H₂O → Fe³⁺ + AsO₄³⁻ + H₂SO₄
        if crystal.total_growth_um > 3 and conditions.fluid.O2 > 0.5:
            crystal.dissolved = True
            dissolved_um = min(4.0, crystal.total_growth_um * 0.12)
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.As += dissolved_um * 0.4   # now AsO₄³⁻ pool
            conditions.fluid.S += dissolved_um * 0.4    # becomes SO₄²⁻
            # Acidification via H₂SO₄ — modest pH drop bounded at 2.0
            conditions.fluid.pH = max(2.0, conditions.fluid.pH - dissolved_um * 0.02)
            # Release trapped invisible-gold — 12% per dissolution step
            # of the zone-averaged trapped Au. This is the supergene-Au
            # enrichment mechanism.
            total_trapped_au = sum(z.trace_Au for z in crystal.zones)
            released_au = total_trapped_au * 0.12
            if released_au > 0:
                conditions.fluid.Au += released_au
            note_str = "oxidation — arsenopyrite → Fe³⁺ + AsO₄³⁻ + H₂SO₄"
            if released_au > 0.005:
                note_str += f" (releases {released_au:.3f} ppm trapped Au — supergene enrichment)"
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=note_str
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit by σ excess:
    #   very high σ → massive_granular (no crystal form)
    #   high σ → acicular (thin needles)
    #   moderate σ → rhombic_blade (flattened)
    #   low σ → striated_prism (classic diamond-section — the display habit)
    if excess > 2.0:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["granular masses", "metallic silver-white"]
        habit_note = "granular massive arsenopyrite"
    elif excess > 1.2:
        crystal.habit = "acicular"
        crystal.dominant_forms = ["thin needles", "acicular aggregates"]
        habit_note = "acicular arsenopyrite needles"
    elif excess > 0.4:
        crystal.habit = "rhombic_blade"
        crystal.dominant_forms = ["flattened rhombic blades"]
        habit_note = "rhombic-bladed arsenopyrite"
    else:
        crystal.habit = "striated_prism"
        crystal.dominant_forms = ["{110} striated prisms", "diamond cross-section"]
        habit_note = "striated prismatic arsenopyrite with diamond cross-section"

    # Au-trapping — the #1 gold-trapping mineral mechanism.
    # 5% of fluid Au per step gets captured as invisible-gold trace
    # on the growth zone; 30% of the trap rate actually leaves the
    # fluid (other 70% is "reversibly adsorbed" — sim approximation
    # of the real Au-HS / Au-Cl partition dynamics). Cap the per-zone
    # trapped fraction at 1.5 ppm so integrated across a ~15-zone
    # crystal we're in the literature-reported ~1500 ppm ballpark.
    au_trap_ppm = 0.0
    if conditions.fluid.Au > 0.01:
        au_trap_ppm = min(conditions.fluid.Au * 0.05, 1.5)
        conditions.fluid.Au = max(conditions.fluid.Au - au_trap_ppm * 0.3, 0)
        if au_trap_ppm > 0.02:
            habit_note += f"; traps invisible-Au ({au_trap_ppm:.3f} ppm)"

    # Cobaltian arsenopyrite — slight pinkish tint when Co substitutes
    if conditions.fluid.Co > 2:
        habit_note += " (Co-bearing, pinkish tinge)"

    # Consume Fe + As + S
    conditions.fluid.Fe = max(conditions.fluid.Fe - rate * 0.004, 0)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.004, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.003,
        trace_Au=au_trap_ppm,
        note=habit_note
    )


def grow_barite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Barite (BaSO₄) growth — the Ba sequestration mineral.

    The standard Ba mineral; tabular plates ("desert rose"), bladed
    fans (Cumberland), cockscomb cyclic twins. Wide-T habit — MVT
    brine, hydrothermal vein, oilfield cold-seep all converge here.
    Acid-resistant; the standard drilling-mud weighting agent
    (4.5 g/cm³). No dissolution branch — barite is essentially
    permanent at sim T (decomposes only above 1149°C).
    """
    sigma = conditions.supersaturation_barite()
    if sigma < 1.0:
        return None  # no acid path; permanent at sim T

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit by σ excess + Sr substitution flag
    if excess > 1.5:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["stubby prisms", "vein-fill habit"]
        habit_note = "stubby prismatic barite, vein-fill"
    elif excess > 0.8:
        crystal.habit = "cockscomb"
        crystal.dominant_forms = ["cyclic twin crests", "cockscomb"]
        habit_note = "cockscomb barite — cyclic twins giving the diagnostic crested form"
    elif excess > 0.3:
        crystal.habit = "bladed"
        crystal.dominant_forms = ["divergent blades", "Cumberland-style fans"]
        habit_note = "bladed divergent barite, Cumberland-style"
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{001} tabular plates"]
        habit_note = "tabular barite plates — the desert-rose habit"

    # Sr-substitution flag → "celestobarite" intermediate when Sr > Ba/4
    if conditions.fluid.Sr > 0 and conditions.fluid.Ba > 0:
        sr_ratio = conditions.fluid.Sr / max(conditions.fluid.Ba, 0.1)
        if sr_ratio > 0.25:
            habit_note += "; Sr-substituted (celestobarite intermediate)"

    # Color hints — F-center blue (Sterling Hill), honey-yellow Pb-bearing,
    # green Chinese variants. Trace-element flags only.
    if conditions.fluid.Pb > 5:
        habit_note += "; honey-yellow (Pb-bearing — Cumberland gold habit)"

    conditions.fluid.Ba = max(conditions.fluid.Ba - rate * 0.005, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.002,
        trace_Pb=conditions.fluid.Pb * 0.005,
        note=habit_note
    )


def grow_anhydrite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Anhydrite (CaSO₄) growth — high-T or saline-low-T Ca sulfate.

    Tabular cleavage cubes (three perpendicular cleavages — diagnostic),
    prismatic vein-fill, massive granular sabkha layers, fibrous "satin
    spar." Pale lavender "angelite" variant is a Peruvian metaphysical-
    stone fixture.

    Rehydrates to gypsum/selenite when conditions shift to dilute low-T:
    releases the Ca + S pool that selenite's nucleation block can pick up.
    """
    sigma = conditions.supersaturation_anhydrite()

    if sigma < 1.0:
        # Rehydration to gypsum: T < 60 AND salinity dropped below 100‰
        # (e.g., post-evaporite freshening). Releases Ca + S to the fluid
        # — selenite then re-precipitates from the same cation pool.
        if (crystal.total_growth_um > 3
                and conditions.temperature < 55
                and conditions.fluid.salinity < 95):
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ca += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="rehydration to gypsum — anhydrite releases Ca²⁺ + SO₄²⁻ as fluid freshens (salinity < 100‰ at T < 60°C)"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit by σ excess + T context
    high_T = conditions.temperature > 200
    if excess > 1.5:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["granular massive layers"]
        habit_note = (
            "massive granular anhydrite — the sabkha + salt-mine evaporite habit"
            if not high_T else
            "massive granular anhydrite — Bingham porphyry deep-brine vein habit"
        )
    elif excess > 0.8:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["stubby prisms", "vein-fill"]
        habit_note = "stubby prismatic anhydrite, vein-fill"
    elif excess > 0.3 or conditions.temperature < 50:
        crystal.habit = "fibrous"
        crystal.dominant_forms = ["satin spar fibers", "parallel fibrous"]
        habit_note = "fibrous satin-spar anhydrite — parallel fibers across vein"
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["tabular crystals", "three perpendicular cleavages"]
        habit_note = "tabular anhydrite with the diagnostic three perpendicular cleavages"

    # Pale lavender "angelite" — anomalous color, attributed to
    # organic inclusions or trace Mn²⁺
    if conditions.fluid.Mn > 3 or (conditions.temperature < 60
                                    and conditions.fluid.salinity > 150):
        habit_note += "; pale lavender (angelite variant)"

    conditions.fluid.Ca = max(conditions.fluid.Ca - rate * 0.005, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Mn=conditions.fluid.Mn * 0.002,
        note=habit_note
    )


def grow_brochantite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Brochantite (Cu₄(SO₄)(OH)₆) growth — emerald-green wet-supergene Cu sulfate.

    The higher-pH end of the brochantite ↔ antlerite Cu-sulfate fork.
    Acidification (pH < 3) converts brochantite to antlerite + H₂O;
    alkalinization (pH > 7) converts to tenorite/malachite. Substrate
    prefers dissolving Cu sulfides (chalcocite, covellite). The Statue
    of Liberty's patina is largely brochantite (chloride-rich harbor
    air drives this composition over malachite).
    """
    sigma = conditions.supersaturation_brochantite()

    if sigma < 1.0:
        # Acidification dissolution → ions become available for antlerite
        # nucleation. Alkalinization dissolution → tenorite/malachite.
        # Hysteresis at pH 2.8 / 7.5 to avoid oscillation.
        if crystal.total_growth_um > 2 and (
            conditions.fluid.pH < 2.8 or conditions.fluid.pH > 7.5
        ):
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.12)
            conditions.fluid.Cu += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.3
            cause = "pH < 3 → antlerite stable" if conditions.fluid.pH < 2.8 else "pH > 7 → tenorite/malachite stable"
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"dissolution ({cause}) — brochantite releases Cu²⁺ + SO₄²⁻"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.5:
        crystal.habit = "drusy_crust"
        crystal.dominant_forms = ["microcrystalline druse", "emerald-green coating"]
        habit_note = "drusy emerald-green brochantite crust on Cu-bearing wall"
    elif excess > 0.8:
        crystal.habit = "acicular_tuft"
        crystal.dominant_forms = ["radiating acicular needle-tufts"]
        habit_note = "acicular emerald-green brochantite tufts radiating from substrate"
    elif excess > 0.3:
        crystal.habit = "short_prismatic"
        crystal.dominant_forms = ["stubby emerald-green prisms"]
        habit_note = "stubby emerald-green brochantite prisms — the Atacama / Bisbee habit"
    else:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["globular aggregates"]
        habit_note = "botryoidal brochantite — globular emerald-green aggregates"

    # Cl-rich systems push toward atacamite competition (not yet in sim;
    # flag in note when Cl present)
    if conditions.fluid.Cl > 100:
        habit_note += "; Cl-rich (would compete with atacamite — Cl-Cu hydroxychloride)"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.006, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.001,
        note=habit_note
    )


def grow_antlerite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Antlerite (Cu₃(SO₄)(OH)₄) growth — the dry-acid Cu sulfate.

    Same emerald-green color as brochantite but pH 1-3.5 stability.
    Substrate-prefers dissolving brochantite (the direct fork product
    when acidification arrives). Dissolves above pH 3.5 → brochantite
    forms; below pH 1 → chalcanthite (extreme acid, not in sim).
    """
    sigma = conditions.supersaturation_antlerite()

    if sigma < 1.0:
        # Neutralization → brochantite stable. Hysteresis at pH 4.2.
        if crystal.total_growth_um > 2 and conditions.fluid.pH > 4.2:
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.15)
            conditions.fluid.Cu += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="dissolution (pH > 3.5 → brochantite stable) — antlerite releases Cu²⁺ + SO₄²⁻"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.5:
        crystal.habit = "granular"
        crystal.dominant_forms = ["massive granular emerald-green"]
        habit_note = "massive granular antlerite — Chuquicamata habit"
    elif excess > 0.8:
        crystal.habit = "acicular"
        crystal.dominant_forms = ["thin needles", "radiating aggregates"]
        habit_note = "acicular antlerite — radiating dark-green needles"
    elif excess > 0.3:
        crystal.habit = "short_prismatic"
        crystal.dominant_forms = ["stubby green prisms"]
        habit_note = "stubby emerald-green antlerite prisms — visually identical to brochantite, distinguished by acid-resistance test"
    else:
        crystal.habit = "druzy"
        crystal.dominant_forms = ["microcrystalline druse"]
        habit_note = "druzy antlerite microcrystals on dissolving Cu sulfide"

    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.006, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.004, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.001,
        note=habit_note
    )


def grow_jarosite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Jarosite (KFe³⁺₃(SO₄)₂(OH)₆) growth — the AMD-yellow Fe sulfate.

    Pseudocubic yellow rhombs and earthy crusts on weathered sulfides.
    Substrate-prefers dissolving pyrite/marcasite (the classic yellow
    rim). Dissolves above pH 4 — releases K + Fe³⁺ + SO₄ which then
    re-precipitates as goethite (the diagnostic AMD → AMN succession).
    """
    sigma = conditions.supersaturation_jarosite()

    if sigma < 1.0:
        # Alkaline-shift dissolution — releases ions that feed goethite.
        # Hysteresis at pH 4.5 to avoid oscillation.
        if crystal.total_growth_um > 2 and conditions.fluid.pH > 4.5:
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.15)
            conditions.fluid.K += dissolved_um * 0.3
            conditions.fluid.Fe += dissolved_um * 0.5
            conditions.fluid.S += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note="dissolution (pH > 4) — jarosite releases K + Fe³⁺ + SO₄²⁻; goethite-stable territory now"
            )
        return None

    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)  # fast growth
    if rate < 0.1:
        return None

    # Habit by σ excess
    if excess > 1.5:
        crystal.habit = "earthy_crust"
        crystal.dominant_forms = ["powdery yellow coating", "AMD stain"]
        habit_note = "powdery yellow jarosite crust on weathered sulfide — the diagnostic AMD signature"
    elif excess > 0.5:
        crystal.habit = "druzy"
        crystal.dominant_forms = ["microcrystalline druse"]
        habit_note = "druzy jarosite microcrystals — yellow honeycomb on pyrite oxidation surfaces"
    else:
        crystal.habit = "pseudocubic"
        crystal.dominant_forms = ["pseudocubic rhombs", "tabular {0001}"]
        habit_note = "pseudocubic golden-yellow jarosite rhombs"

    conditions.fluid.K = max(conditions.fluid.K - rate * 0.003, 0)
    conditions.fluid.Fe = max(conditions.fluid.Fe - rate * 0.005, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.004, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.005,
        note=habit_note
    )


def grow_alunite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Alunite (KAl₃(SO₄)₂(OH)₆) growth — the advanced argillic index mineral.

    Pseudocubic rhombs in the lithocap of porphyry-Cu systems and in
    high-sulfidation epithermal Au deposits. Substrate-prefers
    dissolving feldspar (the wall-leaching origin of Al). Dissolves
    above pH 4 OR above 350 °C → releases K + Al + SO₄.
    """
    sigma = conditions.supersaturation_alunite()

    if sigma < 1.0:
        if crystal.total_growth_um > 2 and (conditions.fluid.pH > 4.5
                                             or conditions.temperature > 350):
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.12)
            conditions.fluid.K += dissolved_um * 0.3
            conditions.fluid.Al += dissolved_um * 0.4
            conditions.fluid.S += dissolved_um * 0.4
            cause = "pH > 4" if conditions.fluid.pH > 4.5 else "T > 350°C"
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"dissolution ({cause}) — alunite releases K + Al³⁺ + SO₄²⁻"
            )
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit by σ excess
    if excess > 1.5:
        crystal.habit = "earthy"
        crystal.dominant_forms = ["chalky white masses", "feldspar-replacement habit"]
        habit_note = "earthy alunite — chalky white replacement of feldspathic wall (Marysvale alunite-stone habit)"
    elif excess > 0.8:
        crystal.habit = "fibrous"
        crystal.dominant_forms = ["radiating fibers", "vein-fill"]
        habit_note = "fibrous alunite — vein-fill, radiating from substrate"
    elif excess > 0.3:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["sharp tabular blades"]
        habit_note = "tabular alunite blades — Goldfield epithermal habit"
    else:
        crystal.habit = "pseudocubic"
        crystal.dominant_forms = ["pseudocubic rhombs"]
        habit_note = "pseudocubic alunite rhombs"

    # Pinkish tint when present in iron-bearing systems (intermediate to jarosite)
    if conditions.fluid.Fe > 20:
        habit_note += "; pinkish (intermediate to jarosite — natroalunite series)"

    conditions.fluid.K = max(conditions.fluid.K - rate * 0.003, 0)
    conditions.fluid.Al = max(conditions.fluid.Al - rate * 0.005, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.004, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.002,
        trace_Al=conditions.fluid.Al * 0.005,
        note=habit_note
    )


def grow_celestine(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Celestine (SrSO₄) growth — pale celestial blue, the Sr sister of barite.

    Same orthorhombic structure as barite (the two form a partial
    solid solution — celestobarite intermediates are common). Pale
    blue F-center color is the diagnostic. Madagascar geodes
    (huge tabular blue blades), Sicilian sulfur-vug fibrous habit
    (Caltanissetta — celestine fibers radiating in vugs on native
    sulfur), Lake Erie geodes. No dissolution branch; thermal
    decomposition only above 1100°C.
    """
    sigma = conditions.supersaturation_celestine()
    if sigma < 1.0:
        return None  # permanent at sim T

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit by σ excess + sulfur context (fibrous habit when sulfur present)
    sulfur_context = conditions.fluid.S > 200  # Sicilian sulfur-vug context
    if excess > 1.5:
        crystal.habit = "nodular"
        crystal.dominant_forms = ["geodal lining", "concentric blue crust"]
        habit_note = "nodular celestine — Madagascar geode lining"
    elif sulfur_context and excess > 0.5:
        crystal.habit = "fibrous"
        crystal.dominant_forms = ["radiating acicular fibers"]
        habit_note = "fibrous celestine — Sicilian sulfur-vug habit, radiating from substrate"
    elif excess > 0.3:
        crystal.habit = "bladed"
        crystal.dominant_forms = ["divergent blue blades"]
        habit_note = "bladed celestine — Lake Erie / Put-in-Bay habit"
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{001} tabular plates", "pale celestial blue"]
        habit_note = "tabular pale-blue celestine plates"

    # Color tint by Mn trace (rare reddish — Yates mine)
    if conditions.fluid.Mn > 5:
        habit_note += "; reddish tint (Mn²⁺ trace — rare habit)"

    # Ba-substitution flag → "barytocelestine" intermediate
    if conditions.fluid.Ba > 0 and conditions.fluid.Sr > 0:
        ba_ratio = conditions.fluid.Ba / max(conditions.fluid.Sr, 0.1)
        if ba_ratio > 0.25:
            habit_note += "; Ba-substituted (barytocelestine intermediate)"

    conditions.fluid.Sr = max(conditions.fluid.Sr - rate * 0.005, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.001,
        note=habit_note
    )


def grow_acanthite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Acanthite (Ag₂S, monoclinic) — the low-T silver sulfide.

    First-class engine for the cold-storage form of Ag₂S. Most acanthite
    in nature is a paramorph after cooled argentite (handled in §8a-2's
    apply_paramorph_transitions hook); the engine here covers the
    primary low-T thorn / massive habits that nucleate without a high-T
    cubic precursor. Lead-gray to iron-black, metallic, Mohs 2-2.5.

    Habit selection by σ excess:
      - high σ → thorn (the species' name; ακανθα = thorn)
      - mid σ → prismatic (elongated)
      - low σ → massive granular (the dominant economic form)

    Tarnish — surface oxidation darkens fresh metallic gray to deeper
    black over geological time. Hand-waved as a note for now; a per-step
    tarnish counter is deferred to Round 8a-3b alongside native_silver.

    Source: research/research-acanthite.md (boss commit f2939da);
    Petruk et al. 1974 (Canadian Mineralogist 12).
    """
    sigma = conditions.supersaturation_acanthite()

    if sigma < 1.0:
        # Strong oxidation re-dissolves acanthite — Ag goes back into
        # solution, S oxidizes to sulfate. This is the supergene
        # enrichment mechanism (Boyle 1968).
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 1.2:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ag += dissolved_um * 0.4
            conditions.fluid.S = max(conditions.fluid.S - dissolved_um * 0.1, 0)
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative dissolution (O₂={conditions.fluid.O2:.2f}) — Ag⁺ released to solution"
            )
        return None

    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — research file lists thorn (primary), pseudo-cubic
    # (paramorph — handled elsewhere), massive granular (most common).
    if excess > 1.5:
        crystal.habit = "thorn"
        crystal.dominant_forms = ["spiky prismatic projections", "thorn-like aggregates"]
        habit_note = "thorn-habit acanthite — the species' diagnostic"
    elif excess > 0.6:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["elongated {110} prism", "distorted pseudo-orthorhombic"]
        habit_note = "prismatic acanthite — primary low-T growth"
    else:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["granular vein filling", "disseminated"]
        habit_note = "massive granular acanthite — economic ore form"

    # Color — lead-gray to iron-black, depends on tarnish accumulation.
    # Long-lived crystals tarnish darker.
    if len(crystal.zones) > 15:
        habit_note += "; tarnished to iron-black"
    else:
        habit_note += "; lead-gray metallic"

    # Selenium substitution — research file flags Se partial substitution
    # for S, producing the aguilarite series (Ag₂(S,Se)). If Se is in the
    # fluid (currently absent — future field), record as habit_note.

    # Deplete Ag + S
    conditions.fluid.Ag = max(conditions.fluid.Ag - rate * 0.008, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_argentite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Argentite (Ag₂S, cubic) — the high-T silver sulfide.

    Forms only above 173°C. On cooling past that threshold,
    apply_paramorph_transitions converts the crystal in-place to
    acanthite while preserving habit + dominant_forms — every "argentite"
    in every museum drawer is a paramorph of acanthite-after-argentite.

    Habit selection by σ excess (research file lists 3):
      - high σ → arborescent (dendritic / wire-like aggregates)
      - mid σ → octahedral (rarer, growth-rate-dependent on {111})
      - low σ → cubic (the classic Comstock Lode habit, {100} cube)

    Source: research/research-argentite.md (boss commit f2939da).
    """
    sigma = conditions.supersaturation_argentite()

    if sigma < 1.0:
        return None

    excess = sigma - 1.0
    rate = 3.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.5:
        crystal.habit = "arborescent"
        crystal.dominant_forms = ["dendritic Ag₂S branches", "wire-like aggregates"]
        habit_note = "arborescent argentite — dendritic high-σ growth"
    elif excess > 0.8:
        crystal.habit = "octahedral"
        crystal.dominant_forms = ["{111} octahedron", "modified by {100}"]
        habit_note = "octahedral argentite — rarer high-T habit"
    else:
        crystal.habit = "cubic"
        crystal.dominant_forms = ["{100} cube", "sharp isometric form"]
        habit_note = "cubic argentite — Comstock Lode habit"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
        habit_note += "; spinel-law penetration twin"

    # Deplete Ag + S
    conditions.fluid.Ag = max(conditions.fluid.Ag - rate * 0.008, 0)
    conditions.fluid.S  = max(conditions.fluid.S  - rate * 0.003, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_chalcanthite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Chalcanthite (CuSO₄·5H₂O) — the bright-blue water-soluble Cu sulfate.

    The terminal Cu-sulfate oxidation phase. Sky-blue to Berlin-blue,
    Mohs 2.5, the [Cu(H₂O)₅]²⁺ chromophore makes it one of the most
    intensely-colored minerals. Triclinic; natural crystals are RARE
    because most specimens dissolve before reaching collection.

    Habit selection by σ excess:
      - high σ → stalactitic (mine-wall drip, the Chuquicamata habit)
      - mid σ → tabular (rare prismatic blue crystals)
      - low σ → efflorescent_crust (powdery surface bloom)

    The water-solubility mechanic lives in VugSimulator.run_step (the
    per-step hook re-dissolves crystals when salinity drops or pH
    rises). The grow function only handles the active growth path.

    Source: research/research-chalcanthite.md (boss commit f2939da).
    """
    sigma = conditions.supersaturation_chalcanthite()

    if sigma < 1.0:
        return None

    excess = sigma - 1.0
    rate = 5.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.5:
        crystal.habit = "stalactitic"
        crystal.dominant_forms = ["sky-blue stalactitic drip", "blue cone"]
        habit_note = "stalactitic chalcanthite — Chuquicamata mine-wall habit, sky-blue dripstones"
    elif excess > 0.6:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{110} prismatic", "Berlin-blue triclinic"]
        habit_note = "tabular chalcanthite — RARE prismatic blue crystals; most natural specimens are stalactitic"
    else:
        crystal.habit = "efflorescent_crust"
        crystal.dominant_forms = ["powdery blue bloom", "fibrous mass"]
        habit_note = "efflorescent crust chalcanthite — high-evaporation arid habit"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
        habit_note += "; cruciform twin (rare {110} cross-shaped twin)"

    # Deplete Cu, S; salinity stays unchanged (crystal carries away
    # cation+anion together, doesn't change ionic strength much)
    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.012, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.020, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_descloizite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Descloizite (PbZnVO₄(OH)) — the Zn end of the descloizite-mottramite series.

    Cherry-red to brown-red orthorhombic prisms; the Tsumeb display
    standard. Cu/Zn dispatch routes Cu-rich fluids to mottramite.
    """
    sigma = conditions.supersaturation_descloizite()
    if sigma < 1.0:
        return None
    excess = sigma - 1.0
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    if excess > 1.5:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["mammillary cherry-red crust", "concentric layers"]
        habit_note = "botryoidal descloizite — Mibladen / Berg-Aukas habit"
    elif excess > 0.6:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{010} pyramid", "{110} prism"]
        habit_note = "prismatic descloizite — Tsumeb display habit"
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{010} tabular", "cherry-red plates"]
        habit_note = "tabular descloizite — late-stage low-σ growth"
    # Cu fraction in solid solution (research file: Cu can substitute up to ~30%)
    if conditions.fluid.Cu > 10:
        cu_pct = min(30, 100 * conditions.fluid.Cu / max(conditions.fluid.Cu + conditions.fluid.Zn, 1))
        if cu_pct > 5:
            habit_note += f"; Cu-bearing ({cu_pct:.0f}% Cu in Zn-site, mottramite-intermediate)"
    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.005, 0)
    conditions.fluid.Zn = max(conditions.fluid.Zn - rate * 0.010, 0)
    conditions.fluid.V  = max(conditions.fluid.V  - rate * 0.005, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=habit_note,
    )


def grow_mottramite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Mottramite (PbCu(VO₄)(OH)) — the Cu end of the descloizite-mottramite series.

    Olive-green to yellowish-green orthorhombic prisms; the Cu chromophore
    distinguishes from cherry-red descloizite.
    """
    sigma = conditions.supersaturation_mottramite()
    if sigma < 1.0:
        return None
    excess = sigma - 1.0
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    if excess > 1.5:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["mammillary olive-green crust", "concentric layers"]
        habit_note = "botryoidal mottramite — Mottram St Andrew (Cheshire) type habit"
    elif excess > 0.6:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{010} pyramid", "{110} prism"]
        habit_note = "prismatic mottramite — Tsumeb olive-green crystals"
    else:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{010} tabular", "olive-green plates"]
        habit_note = "tabular mottramite — late-stage habit"
    # Zn fraction in solid solution
    if conditions.fluid.Zn > 10:
        zn_pct = min(30, 100 * conditions.fluid.Zn / max(conditions.fluid.Cu + conditions.fluid.Zn, 1))
        if zn_pct > 5:
            habit_note += f"; Zn-bearing ({zn_pct:.0f}% Zn in Cu-site, descloizite-intermediate)"
    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.005, 0)
    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.010, 0)
    conditions.fluid.V  = max(conditions.fluid.V  - rate * 0.005, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=habit_note,
    )


def grow_raspite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Raspite (PbWO₄, monoclinic) — RARE PbWO₄ polymorph.

    Honey-yellow to brownish-yellow tabular crystals. Distinguished
    from stolzite (its tetragonal sibling) only by crystal system; the
    color and locality association are identical.
    """
    sigma = conditions.supersaturation_raspite()
    if sigma < 1.0:
        return None
    excess = sigma - 1.0
    rate = 1.8 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    crystal.habit = "tabular_monoclinic"
    crystal.dominant_forms = ["monoclinic tabular plate", "honey-yellow"]
    habit_note = "raspite — RARE monoclinic PbWO₄, Broken Hill habit"
    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.005, 0)
    conditions.fluid.W  = max(conditions.fluid.W  - rate * 0.020, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=habit_note,
    )


def grow_stolzite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Stolzite (PbWO₄, tetragonal) — the common PbWO₄ polymorph.

    Honey-yellow to orange-yellow tetragonal crystals. The tetragonal
    polymorph favored ~90% of the time over its monoclinic sibling
    raspite (kinetic preference dispatcher in check_nucleation).
    """
    sigma = conditions.supersaturation_stolzite()
    if sigma < 1.0:
        return None
    excess = sigma - 1.0
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    if excess > 1.0:
        crystal.habit = "dipyramidal"
        crystal.dominant_forms = ["{101} dipyramid", "tetragonal honey-yellow"]
        habit_note = "dipyramidal stolzite — Broken Hill / Tsumeb display habit"
    else:
        crystal.habit = "tabular_tetragonal"
        crystal.dominant_forms = ["{001} tabular plate", "tetragonal honey-yellow"]
        habit_note = "tabular stolzite — late-stage low-σ habit"
    conditions.fluid.Pb = max(conditions.fluid.Pb - rate * 0.005, 0)
    conditions.fluid.W  = max(conditions.fluid.W  - rate * 0.020, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=habit_note,
    )


def grow_olivenite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Olivenite (Cu₂AsO₄(OH)) — the Cu arsenate.

    Olive-green to grayish-green orthorhombic prisms. Cu/Zn dispatch
    with adamite (the Zn-end-member of the same structure).
    """
    sigma = conditions.supersaturation_olivenite()
    if sigma < 1.0:
        return None
    excess = sigma - 1.0
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None
    if excess > 1.5:
        crystal.habit = "fibrous"
        crystal.dominant_forms = ["radiating acicular fibers", "olive-green silky"]
        habit_note = "fibrous olivenite — high-σ silky habit"
    elif excess > 0.6:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{110} prism", "olive-green prisms"]
        habit_note = "prismatic olivenite — Cornwall display habit"
    else:
        crystal.habit = "globular"
        crystal.dominant_forms = ["botryoidal globule", "olive crust"]
        habit_note = "globular olivenite — Tsumeb / Bisbee secondary habit"
    if conditions.fluid.Zn > 10:
        zn_pct = min(50, 100 * conditions.fluid.Zn / max(conditions.fluid.Cu + conditions.fluid.Zn, 1))
        if zn_pct > 10:
            habit_note += f"; Zn-bearing ({zn_pct:.0f}% Zn — zincolivenite intermediate toward adamite)"
    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.010, 0)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.005, 0)
    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate, note=habit_note,
    )


def grow_nickeline(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Nickeline (NiAs) — high-T Ni arsenide. Pale copper-red metallic.

    The Cobalt-Ontario habit. Rare as well-formed crystals; usually
    massive granular or columnar. Tarnishes to a darker copper-rose
    color, eventually becoming the supergene annabergite (green).

    Habit selection by σ:
      - high σ → reniform (botryoidal copper-red crusts)
      - mid σ → columnar (vertical aggregates)
      - low σ → massive granular
    """
    sigma = conditions.supersaturation_nickeline()

    if sigma < 1.0:
        # Oxidative dissolution → annabergite cascade
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.8:
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.10)
            conditions.fluid.Ni += dissolved_um * 0.4
            conditions.fluid.As += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative dissolution (O₂={conditions.fluid.O2:.2f}) — Ni²⁺ + AsO₄³⁻ to fluid; downstream annabergite forming"
            )
        return None

    excess = sigma - 1.0
    rate = 3.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.5:
        crystal.habit = "reniform"
        crystal.dominant_forms = ["botryoidal copper-red crust", "concentric layers"]
        habit_note = "reniform nickeline — Cobalt-Ontario botryoidal habit"
    elif excess > 0.6:
        crystal.habit = "columnar"
        crystal.dominant_forms = ["{0001} columnar", "vertical aggregate"]
        habit_note = "columnar nickeline — vertical hexagonal stacks"
    else:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["granular massive", "pale copper-red metallic"]
        habit_note = "massive granular nickeline — primary ore form"

    if len(crystal.zones) > 12:
        habit_note += "; tarnished to darker copper-rose"

    conditions.fluid.Ni = max(conditions.fluid.Ni - rate * 0.010, 0)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.010, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_millerite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Millerite (NiS) — capillary brass-yellow needles in geode cavities.

    Distinctive habit: hair-thin to thread-thin acicular needles
    radiating from a wall point, often forming dense radiating sprays.
    Brass-yellow to bronze-yellow color from intrinsic NiS metallic
    bonding. The classic Sterling Hill / Halls Gap geode habit.

    Habit selection by σ:
      - high σ → capillary (hair-fine needles, the diagnostic habit)
      - mid σ → acicular (longer prismatic needles)
      - low σ → massive
    """
    sigma = conditions.supersaturation_millerite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.8:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ni += dissolved_um * 0.4
            conditions.fluid.S += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative dissolution (O₂={conditions.fluid.O2:.2f}) — Ni²⁺ released to fluid"
            )
        return None

    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.0:
        crystal.habit = "capillary"
        crystal.dominant_forms = ["hair-fine acicular needle", "radiating spray"]
        habit_note = "capillary millerite — Halls Gap geode habit, hair-thin brass-yellow needles"
    elif excess > 0.4:
        crystal.habit = "acicular"
        crystal.dominant_forms = ["thin prismatic needle", "diverging cluster"]
        habit_note = "acicular millerite — slender brass-yellow prisms"
    else:
        crystal.habit = "massive"
        crystal.dominant_forms = ["massive granular", "brass-yellow metallic"]
        habit_note = "massive millerite — granular ore form"

    conditions.fluid.Ni = max(conditions.fluid.Ni - rate * 0.010, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_cobaltite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Cobaltite (CoAsS) — pseudocubic tin-white-with-pink primary ore.

    Three-element gate (Co + As + S) makes this rare; the Cobalt
    Ontario type locality is one of the few places it forms in
    well-developed crystals. Pyritohedral habit with striations
    on {210} faces. Tarnishes to a diagnostic pinkish-blush from Co
    surface oxidation, distinguishing it from pyrite at a glance.

    Habit selection by σ:
      - high σ → reniform (botryoidal at very high σ)
      - mid σ → pyritohedral (the diagnostic primary habit)
      - low σ → massive granular
    """
    sigma = conditions.supersaturation_cobaltite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.7:
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.10)
            conditions.fluid.Co += dissolved_um * 0.4
            conditions.fluid.As += dissolved_um * 0.4
            conditions.fluid.S = max(conditions.fluid.S - dissolved_um * 0.1, 0)
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative dissolution (O₂={conditions.fluid.O2:.2f}) — Co²⁺ + AsO₄³⁻ to fluid; erythrite forming downstream"
            )
        return None

    excess = sigma - 1.0
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    if excess > 1.5:
        crystal.habit = "reniform"
        crystal.dominant_forms = ["botryoidal crust", "concentric"]
        habit_note = "reniform cobaltite — high-σ botryoidal habit"
    elif excess > 0.5:
        crystal.habit = "pyritohedral"
        crystal.dominant_forms = ["{210} pyritohedron", "striated faces"]
        habit_note = "pyritohedral cobaltite — Cobalt Ontario diagnostic habit"
    else:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["granular", "tin-white-with-pink-blush"]
        habit_note = "massive granular cobaltite — Tunaberg ore form"

    # Glaucodot series — Fe substitutes for Co up to ~50%
    if conditions.fluid.Fe > 100:
        habit_note += "; Fe-rich (glaucodot series — (Co,Fe)AsS)"
    if len(crystal.zones) > 10:
        habit_note += "; pinkish-blush surface tarnish (Co oxide skin)"

    conditions.fluid.Co = max(conditions.fluid.Co - rate * 0.012, 0)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.008, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_native_tellurium(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native tellurium (Te⁰) — the metal-telluride-overflow native element.

    Tin-white to steel-gray hexagonal prisms with perfect prismatic
    cleavage on {1010}. Trigonal (P3₁21), Mohs 2-2.5, SG 6.2 (heavy
    for a metalloid). Epithermal Au-Te veins are the type setting —
    Cripple Creek, Kalgoorlie, Emperor Mine. Tarnishes to TeO₂ within
    days of exposure.

    Habit selection by T:
      - high T (>250°C) → prismatic_hex (well-formed striated prisms)
      - mid T (200-250°C) → granular (massive ore form)
      - low T (<200°C) → reticulated (filiform interconnected mass)

    Source: research/research-native-tellurium.md (boss commit f2939da).
    """
    sigma = conditions.supersaturation_native_tellurium()

    if sigma < 1.0:
        # Oxidative dissolution — Te goes to TeO₃²⁻ tellurite.
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.7:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Te += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative dissolution (O₂={conditions.fluid.O2:.2f}) — Te oxidizing to TeO₃²⁻ tellurite"
            )
        return None

    excess = sigma - 1.0
    rate = 2.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    T = conditions.temperature

    if T > 250 and excess < 1.5:
        crystal.habit = "prismatic_hex"
        crystal.dominant_forms = ["{1010} striated prism", "{1011} rhombohedron termination"]
        habit_note = "prismatic native tellurium — well-formed hexagonal prisms, the Kalgoorlie habit"
    elif T < 200:
        crystal.habit = "reticulated"
        crystal.dominant_forms = ["filiform mass", "interconnected wire network"]
        habit_note = "reticulated native tellurium — low-T filamentous habit"
    else:
        crystal.habit = "granular"
        crystal.dominant_forms = ["massive granular", "tin-white metallic mass"]
        habit_note = "granular native tellurium — Cripple Creek ore form"

    if len(crystal.zones) > 6:
        habit_note += "; tellurite tarnish (TeO₂ surface bloom)"
    else:
        habit_note += "; tin-white metallic, fresh fracture"

    # Note brownish iridescence on tarnish (research file flag — narrative)
    # Deplete Te
    conditions.fluid.Te = max(conditions.fluid.Te - rate * 0.005, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_native_sulfur(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native sulfur (S₈) — the synproportionation native element.

    Bright canary-yellow bipyramidal α-sulfur (orthorhombic, T<95.5°C);
    needle-like β-sulfur (monoclinic, 95.5-119°C — converts to α on
    cooling with cracking); volcanic sublimation crust (high σ from
    fumarole gas-phase deposition). Mohs 1.5-2.5, fragile, thermally
    sensitive — a warm hand can crack a cool specimen.

    Habit selection by T at growth time:
      - T < 95.5 + low-mid σ → bipyramidal_alpha (Sicilian Agrigento)
      - 95.5 ≤ T ≤ 119 → prismatic_beta (rare in collections — converts
        to α on cooling, with crack-on-inversion notes in narrator)
      - high σ regardless of T → sublimation_crust (fumarole habit,
        mass deposition from gas phase)

    Source: research/research-native-sulfur.md (boss commit f2939da).
    """
    sigma = conditions.supersaturation_native_sulfur()

    if sigma < 1.0:
        # Strong oxidation re-dissolves native S as sulfate.
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.9:
            crystal.dissolved = True
            dissolved_um = min(3.0, crystal.total_growth_um * 0.10)
            conditions.fluid.S += dissolved_um * 0.6
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative dissolution (O₂={conditions.fluid.O2:.2f}) — S oxidizing to SO₄²⁻"
            )
        return None

    excess = sigma - 1.0
    rate = 4.0 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    T = conditions.temperature

    if excess > 1.5 and T > 60:
        crystal.habit = "sublimation_crust"
        crystal.dominant_forms = ["bright yellow encrustation", "powdery crystalline mass"]
        habit_note = "sublimation crust — fumarole habit, gas-phase deposition (Bolivian fumarole / Vulcano)"
    elif T >= 95:  # within β stability
        crystal.habit = "prismatic_beta"
        crystal.dominant_forms = ["β-sulfur monoclinic prism", "needle-like"]
        habit_note = "β-sulfur prismatic — RARE high-T monoclinic habit; converts to α on cooling with internal cracking"
    else:
        crystal.habit = "bipyramidal_alpha"
        crystal.dominant_forms = ["{111} steep dipyramid", "{113} shallow dipyramid", "{001} pinacoid"]
        habit_note = "α-sulfur bipyramidal — Sicilian Agrigento habit, the iconic bright-yellow crystals"

    # H+ release — synproportionation H₂S + SO₄²⁻ → 2S⁰ + 2H₂O nominally
    # neutral, but in practice native S forms with H+ co-release that
    # acidifies the local fluid. Track via a tiny pH bump (capped).
    conditions.fluid.pH = max(conditions.fluid.pH - rate * 0.0003, 0.5)

    # Deplete S
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.02, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_native_arsenic(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native arsenic (As⁰) — the residual-overflow native element.

    Tin-white to steel-gray metallic on fresh fracture, tarnishes to
    arsenolite (As₂O₃) within hours of exposure. Perfect basal {0001}
    cleavage — splits into papery sheets like dark mica.

    Habit selection:
      - high σ → reniform (botryoidal kidney-shaped crusts, the
        Akatani Mine signature)
      - mid σ → massive (granular crusts, the Freiberg ore form)
      - low σ + high T → rhombohedral_crystal (rare {0001} +
        {1011} crystals)
      - Bi presence → arsenolamprite variety (Bi-rich, possibly
        orthorhombic)

    Source: research/research-native-arsenic.md (boss commit f2939da).
    """
    sigma = conditions.supersaturation_native_arsenic()

    if sigma < 1.0:
        # Oxidative dissolution — As goes back to fluid as AsO₄³⁻.
        if crystal.total_growth_um > 5 and conditions.fluid.O2 > 0.7:
            crystal.dissolved = True
            dissolved_um = min(2.5, crystal.total_growth_um * 0.10)
            conditions.fluid.As += dissolved_um * 0.5
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"oxidative dissolution (O₂={conditions.fluid.O2:.2f}) — As released as AsO₄³⁻ into fluid"
            )
        return None

    excess = sigma - 1.0
    rate = 2.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    bi_present = conditions.fluid.Bi > 5.0
    T = conditions.temperature

    if bi_present and excess > 0.5:
        crystal.habit = "arsenolamprite"
        crystal.dominant_forms = ["Bi-rich orthorhombic As", "lamellar"]
        habit_note = f"arsenolamprite — Bi-rich variety (Bi={conditions.fluid.Bi:.0f} ppm in fluid)"
    elif excess > 1.5:
        crystal.habit = "reniform"
        crystal.dominant_forms = ["botryoidal kidney crust", "concentric layers"]
        habit_note = "reniform native arsenic — Akatani botryoidal habit"
    elif T > 250 and excess < 0.6:
        crystal.habit = "rhombohedral_crystal"
        crystal.dominant_forms = ["{0001} basal pinacoid", "{1011} rhombohedron"]
        habit_note = "rhombohedral native arsenic — RARE high-T crystal habit"
    else:
        crystal.habit = "massive_granular"
        crystal.dominant_forms = ["granular crust", "tin-white metallic mass"]
        habit_note = "massive granular native arsenic — Freiberg ore form"

    # Color note — fresh tin-white tarnishes to arsenolite within steps.
    if len(crystal.zones) > 8:
        habit_note += "; arsenolite tarnish (As₂O₃ surface bloom)"
    else:
        habit_note += "; tin-white metallic, fresh fracture"

    # Garlic-odor note (research file flags this as diagnostic — flavor only)
    # Sb solid solution
    if conditions.fluid.Sb > 10:
        habit_note += "; Sb-substituted (As-Sb solid solution, up to ~3% Sb)"

    # Deplete As — note no S consumed (S>10 was the gate)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.012, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_native_silver(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Native silver (Ag⁰) — the Kongsberg wire-silver mineral.

    Forms only where S is depleted below 2 ppm AND the fluid is
    strongly reducing. Wire silver is the showcase habit, requiring
    open vug space at low T (epithermal); dendritic at moderate T;
    massive nuggets at high Ag concentration regardless of T. Real
    wire specimens at Kongsberg reach 30+ cm — max_size_cm is set
    accordingly.

    Habit selection by σ excess + T window:
      - low T + high σ → wire (the Kongsberg signature, max 30 cm)
      - mid T + mid σ → dendritic (Cobalt-Ontario fern-plates)
      - any T + low σ → massive (Keweenaw nugget)
      - rare modifier: cubic/octahedral when σ is just above threshold
        and T is high (>200°C) — primary hypogene crystal habit

    Source: research/research-native-silver.md (boss commit f2939da).
    """
    sigma = conditions.supersaturation_native_silver()

    if sigma < 1.0:
        # Tarnish — when S re-enters the fluid, the surface skins
        # over with acanthite. Treat as a slow surface dissolution
        # for now; the proper acanthite-rind overlay is deferred to
        # 8a-3b (the tarnish clock — boss-flagged future feature).
        if crystal.total_growth_um > 5 and conditions.fluid.S > 5:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.04)
            conditions.fluid.Ag = max(conditions.fluid.Ag - dissolved_um * 0.3, 0)
            conditions.fluid.S = max(conditions.fluid.S - dissolved_um * 0.4, 0)
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"tarnish — S returned to fluid (S={conditions.fluid.S:.1f}); surface skinning to acanthite"
            )
        return None

    excess = sigma - 1.0
    rate = 4.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    T = conditions.temperature
    is_open_low_T = T < 150
    is_high_T_primary = T > 200 and excess < 0.6

    if is_high_T_primary:
        crystal.habit = "cubic_crystal"
        crystal.dominant_forms = ["{100} cube", "modified by {111}"]
        habit_note = "cubic native silver — rare hypogene primary crystal habit"
    elif is_open_low_T and excess > 1.0:
        crystal.habit = "wire"
        crystal.dominant_forms = ["epithermal wire", "curling thread of metal"]
        habit_note = "wire silver — Kongsberg habit, the collector's prize"
    elif excess > 0.6:
        crystal.habit = "dendritic"
        crystal.dominant_forms = ["dendritic plates", "fern-like branches"]
        habit_note = "dendritic native silver — Cobalt-Ontario fern habit"
    else:
        crystal.habit = "massive"
        crystal.dominant_forms = ["hackly massive", "metallic nugget"]
        habit_note = "massive native silver — Keweenaw nugget habit"

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).
        habit_note += "; {111} penetration twin"

    # Color note — fresh metallic silver, tarnishes inevitably.
    if len(crystal.zones) > 20:
        habit_note += "; tarnishing — acanthite rind beginning to form"
    else:
        habit_note += "; bright silver-white metallic luster"

    # Deplete Ag — note no S consumed (this is the depletion mineral)
    conditions.fluid.Ag = max(conditions.fluid.Ag - rate * 0.012, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_rosasite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Rosasite ((Cu,Zn)₂(CO₃)(OH)₂) — Cu-dominant supergene carbonate.

    First mineral with broth-ratio branching (Round 9a). Forms velvety
    blue-green botryoidal spheres on supergene oxidation zones — the
    diagnostic Mapimi habit is sky-blue spheres on red limonite. Habit
    selection by σ excess + T:
      - low-T (<15°C) + high σ → acicular_radiating (delicate sprays)
      - high σ → botryoidal (the diagnostic)
      - low σ → encrusting (thin mammillary crust)

    Source: research/research-rosasite.md (boss commit 3bfdf4a).
    """
    sigma = conditions.supersaturation_rosasite()

    if sigma < 1.0:
        # Acid dissolution — fizzes like calcite below pH 5
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.08)
            conditions.fluid.Cu += dissolved_um * 0.3
            conditions.fluid.Zn += dissolved_um * 0.2
            conditions.fluid.CO3 += dissolved_um * 0.25
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — Cu²⁺ + Zn²⁺ + CO₃²⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection
    if conditions.temperature < 15 and excess > 0.6:
        crystal.habit = "acicular_radiating"
        crystal.dominant_forms = ["needle-like sprays", "radiating fibrous"]
        habit_note = "delicate acicular sprays — low-T slow growth"
    elif excess > 1.0:
        crystal.habit = "botryoidal"
        crystal.dominant_forms = ["botryoidal", "mammillary crusts"]
        habit_note = "botryoidal spheres — the diagnostic rosasite habit"
    else:
        crystal.habit = "encrusting"
        crystal.dominant_forms = ["thin crust", "mammillary"]
        habit_note = "mammillary crust"

    # Color shift by Cu fraction (recomputed locally; supersat already gated this >0.5)
    cu_zn_total = conditions.fluid.Cu + conditions.fluid.Zn
    cu_frac = conditions.fluid.Cu / cu_zn_total if cu_zn_total > 0 else 0.5
    if cu_frac > 0.85:
        habit_note += "; sky-blue (Cu-rich, approaching malachite composition)"
    elif cu_frac > 0.65:
        habit_note += "; blue-green (typical Cu-dominant rosasite)"
    else:
        habit_note += "; greenish blue-green (transitional toward aurichalcite)"

    # Nickeloan variant
    if conditions.fluid.Ni > 5:
        habit_note += "; nickeloan (darker green from Ni substitution)"

    # Deplete — formula has 2 Cu/Zn cations + 1 CO3 per unit
    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.04, 0)
    conditions.fluid.Zn = max(conditions.fluid.Zn - rate * 0.025, 0)
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - rate * 0.06, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_aurichalcite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Aurichalcite ((Zn,Cu)₅(CO₃)₂(OH)₆) — Zn-dominant supergene carbonate.

    Mirror of rosasite in the broth-ratio branching pair (Round 9a).
    Tufted divergent sprays of pale blue-green acicular crystals. Habit
    selection by σ excess + T:
      - cool (<25°C) + high σ → tufted_spray (the diagnostic)
      - high σ + warmer → radiating_columnar (denser spheres)
      - low σ → encrusting (thin laminar crust)

    Source: research/research-aurichalcite.md (boss commit 3bfdf4a).
    """
    sigma = conditions.supersaturation_aurichalcite()

    if sigma < 1.0:
        # Acid dissolution
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.08)
            conditions.fluid.Zn += dissolved_um * 0.4
            conditions.fluid.Cu += dissolved_um * 0.15
            conditions.fluid.CO3 += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — Zn²⁺ + Cu²⁺ + CO₃²⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection
    if conditions.temperature < 25 and excess > 0.5:
        crystal.habit = "tufted_spray"
        crystal.dominant_forms = ["divergent acicular sprays", "tufted aggregates"]
        habit_note = "delicate tufted sprays — the diagnostic aurichalcite habit"
    elif excess > 1.0:
        crystal.habit = "radiating_columnar"
        crystal.dominant_forms = ["radiating spheres", "spherical aggregates"]
        habit_note = "radiating spherical aggregates"
    else:
        crystal.habit = "encrusting"
        crystal.dominant_forms = ["thin crust", "laminated"]
        habit_note = "thin laminar crust"

    # Color shift by Zn fraction
    cu_zn_total = conditions.fluid.Cu + conditions.fluid.Zn
    zn_frac = conditions.fluid.Zn / cu_zn_total if cu_zn_total > 0 else 0.5
    if zn_frac > 0.85:
        habit_note += "; very pale green-white (Zn-rich, approaching smithsonite composition)"
    elif zn_frac > 0.65:
        habit_note += "; pale blue-green (typical Zn-dominant aurichalcite)"
    else:
        habit_note += "; deeper blue-green (transitional toward rosasite)"

    # Deplete — formula has 5 cations + 2 CO3 per unit (Zn-dominant)
    conditions.fluid.Zn = max(conditions.fluid.Zn - rate * 0.05, 0)
    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.02, 0)
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - rate * 0.07, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_torbernite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Torbernite (Cu(UO₂)₂(PO₄)₂·12H₂O) — P-branch of the uranyl
    anion-competition trio (Round 9b). Tabular emerald-green plates.

    Habit selection: high σ + cool → micaceous_book (stacked plates);
    moderate σ → tabular_plates (default Schneeberg habit); low σ →
    encrusting (powdery green crust on fracture surfaces).

    Source: research/research-torbernite.md (boss commit 3bfdf4a).
    """
    sigma = conditions.supersaturation_torbernite()
    if sigma < 1.0:
        # Acid dissolution — uranyl phosphates dissolve readily below pH 4.5
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += dissolved_um * 0.2
            conditions.fluid.U += dissolved_um * 0.4
            conditions.fluid.P += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — Cu²⁺ + UO₂²⁺ + PO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection
    if excess > 1.0 and conditions.temperature < 30:
        crystal.habit = "micaceous_book"
        crystal.dominant_forms = ["stacked tabular plates", "subparallel books"]
        habit_note = "stacked micaceous plates — high-σ Musonoi habit"
    elif excess > 0.3:
        crystal.habit = "tabular_plates"
        crystal.dominant_forms = ["tabular {001}", "square plates"]
        habit_note = "thin emerald-green plates — the diagnostic Schneeberg habit"
    else:
        crystal.habit = "encrusting"
        crystal.dominant_forms = ["earthy crust", "powdery coating"]
        habit_note = "earthy green crust — low-σ encrustation"

    # Color note — emerald-green (Cu²⁺ chromophore + uranyl absorption)
    habit_note += "; emerald-green (Cu²⁺ + UO₂²⁺); non-fluorescent (Cu²⁺ quenches)"

    # Radiation flag — torbernite carries U, slowly self-irradiates
    habit_note += "; ☢️ radioactive"

    # Deplete — formula has 1 Cu + 2 U + 2 P per unit
    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.025, 0)
    conditions.fluid.U = max(conditions.fluid.U - rate * 0.04, 0)
    conditions.fluid.P = max(conditions.fluid.P - rate * 0.05, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_autunite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Autunite (Ca(UO₂)₂(PO₄)₂·11H₂O) — Ca-branch of the uranyl
    cation+anion fork (Round 9d, May 2026). Mirror of torbernite with
    Ca substituted for Cu and intense fluorescence as the diagnostic.

    Habit selection: same as torbernite (high σ + cool → micaceous_book;
    moderate σ → tabular_plates; low σ → encrusting). Color is canary
    yellow (no Cu²⁺ chromophore, just uranyl absorption); under LW UV
    glows intense apple-green — Ca²⁺ doesn't quench uranyl emission
    the way Cu²⁺ does in torbernite/zeunerite.

    Source: research/research-uraninite.md §Variants for Game §4.
    """
    sigma = conditions.supersaturation_autunite()
    if sigma < 1.0:
        # Acid dissolution — uranyl phosphates dissolve readily below pH 4.5
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ca += dissolved_um * 0.2
            conditions.fluid.U += dissolved_um * 0.4
            conditions.fluid.P += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — Ca²⁺ + UO₂²⁺ + PO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — same shape as torbernite
    if excess > 1.0 and conditions.temperature < 25:
        crystal.habit = "micaceous_book"
        crystal.dominant_forms = ["stacked tabular plates", "subparallel books"]
        habit_note = "stacked micaceous plates — high-σ Margnac/Spruce-Pine habit"
    elif excess > 0.3:
        crystal.habit = "tabular_plates"
        crystal.dominant_forms = ["tabular {001}", "square plates"]
        habit_note = "thin canary-yellow plates — the diagnostic Saint-Symphorien habit"
    else:
        crystal.habit = "encrusting"
        crystal.dominant_forms = ["earthy crust", "yellow staining"]
        habit_note = "earthy yellow crust — 'yellow uranium ore' staining the host rock"

    # Color + fluorescence — the cation-fork narrative payoff
    habit_note += "; canary-yellow (uranyl chromophore, no Cu²⁺ to muddy it)"
    habit_note += "; intense apple-green LW UV fluorescence (Ca²⁺ doesn't quench like Cu²⁺ does)"
    habit_note += "; ☢️ radioactive"

    # Deplete — formula has 1 Ca + 2 U + 2 P per unit
    conditions.fluid.Ca = max(conditions.fluid.Ca - rate * 0.025, 0)
    conditions.fluid.U = max(conditions.fluid.U - rate * 0.04, 0)
    conditions.fluid.P = max(conditions.fluid.P - rate * 0.05, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_zeunerite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Zeunerite (Cu(UO₂)₂(AsO₄)₂·xH₂O) — As-branch of the uranyl
    anion-competition trio (Round 9b). Isostructural with torbernite.

    Same habit selection logic as torbernite (the two species are
    visually indistinguishable in the field — distinguishable only
    by chemistry).

    Source: research/research-zeunerite.md (boss commit 3bfdf4a).
    """
    sigma = conditions.supersaturation_zeunerite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Cu += dissolved_um * 0.2
            conditions.fluid.U += dissolved_um * 0.4
            conditions.fluid.As += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — Cu²⁺ + UO₂²⁺ + AsO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — same as torbernite
    if excess > 1.0 and conditions.temperature < 30:
        crystal.habit = "micaceous_book"
        crystal.dominant_forms = ["stacked tabular plates", "subparallel books"]
        habit_note = "stacked micaceous plates — high-σ Schneeberg habit"
    elif excess > 0.3:
        crystal.habit = "tabular_plates"
        crystal.dominant_forms = ["tabular {001}", "square plates"]
        habit_note = "thin emerald-green plates — the diagnostic Schneeberg habit"
    else:
        crystal.habit = "encrusting"
        crystal.dominant_forms = ["scaly crust", "thin overlapping plates"]
        habit_note = "scaly encrustation — low-σ thin coating"

    habit_note += "; emerald-green (Cu²⁺ + UO₂²⁺); non-fluorescent (Cu²⁺ quenches)"
    habit_note += "; ☢️ radioactive (U + As both decay-active)"

    # Deplete — formula has 1 Cu + 2 U + 2 As per unit
    conditions.fluid.Cu = max(conditions.fluid.Cu - rate * 0.025, 0)
    conditions.fluid.U = max(conditions.fluid.U - rate * 0.04, 0)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.06, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_carnotite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Carnotite (K₂(UO₂)₂(VO₄)₂·3H₂O) — V-branch of the uranyl
    anion-competition trio (Round 9c).

    Almost always forms as canary-yellow earthy crusts on sandstone —
    the diagnostic Colorado Plateau habit. Crystalline carnotite is
    genuinely rare; tabular plates only at very high σ. Habit selection:
    high σ + cool → tabular_plates (rare); moderate σ → earthy_crust
    (default Colorado Plateau habit); low σ → powdery_disseminated
    (the sandstone-stain form).

    Source: research/research-carnotite.md (boss commit 3bfdf4a).
    """
    sigma = conditions.supersaturation_carnotite()
    if sigma < 1.0:
        # Acid dissolution — uranyl vanadates dissolve readily below pH 4.5
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.K += dissolved_um * 0.2
            conditions.fluid.U += dissolved_um * 0.4
            conditions.fluid.V += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — K⁺ + UO₂²⁺ + VO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — crystalline carnotite is RARE; default is the
    # earthy crust. Only very high σ at cool T produces real plates.
    if excess > 1.5 and conditions.temperature < 30:
        crystal.habit = "tabular_plates"
        crystal.dominant_forms = ["diamond-shaped {001} plates", "tabular crystals"]
        habit_note = "rare crystalline carnotite — diamond-shaped plates, the collector's prize"
    elif excess > 0.4:
        crystal.habit = "earthy_crust"
        crystal.dominant_forms = ["canary-yellow earthy crust", "thin coating"]
        habit_note = "canary-yellow earthy crust — the diagnostic Colorado Plateau habit"
    else:
        crystal.habit = "powdery_disseminated"
        crystal.dominant_forms = ["powdery yellow disseminations", "sandstone stain"]
        habit_note = "powdery yellow disseminations — the sandstone-stain form"

    # Color note
    habit_note += "; bright canary-yellow (UO₂²⁺ charge-transfer); ☢️ radioactive"
    habit_note += "; non-fluorescent (vanadate matrix quenches uranyl emission)"

    # Petrified-wood association — carnotite famously concentrates around
    # organic carbon. The sim doesn't track organic matter as a separate
    # species, but if Fe is moderate (oxidizing groundwater) and T is low,
    # flag the roll-front signature.
    if conditions.fluid.Fe > 5 and conditions.temperature < 30:
        habit_note += "; roll-front signature (oxidizing groundwater + sandstone host)"

    # Deplete — formula has 2 K + 2 U + 2 V per unit. K is consumed
    # heavily because carnotite is K-specific.
    conditions.fluid.K = max(conditions.fluid.K - rate * 0.04, 0)
    conditions.fluid.U = max(conditions.fluid.U - rate * 0.04, 0)
    conditions.fluid.V = max(conditions.fluid.V - rate * 0.05, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_uranospinite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Uranospinite (Ca(UO₂)₂(AsO₄)₂·10H₂O) — Ca-branch / As-anion of the
    autunite-group cation+anion fork (Round 9e, May 2026). Mirror of
    autunite with As substituted for P; mirror of zeunerite with Ca
    substituted for Cu.

    Habit selection mirrors autunite (high σ + cool → micaceous_book;
    moderate σ → tabular_plates; low σ → encrusting). Strongly fluorescent
    yellow-green LW UV — Ca²⁺ doesn't quench like Cu²⁺ does in zeunerite.

    Source: research/research-uranospinite.md (implementation-grade
    draft, 2026-05-01); MSA Handbook of Mineralogy.
    """
    sigma = conditions.supersaturation_uranospinite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 4.5:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ca += dissolved_um * 0.2
            conditions.fluid.U += dissolved_um * 0.4
            conditions.fluid.As += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — Ca²⁺ + UO₂²⁺ + AsO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — mirror autunite/zeunerite
    if excess > 1.0 and conditions.temperature < 25:
        crystal.habit = "micaceous_book"
        crystal.dominant_forms = ["stacked tabular plates", "subparallel books"]
        habit_note = "stacked micaceous plates — high-σ Schneeberg/Margnac habit"
    elif excess > 0.3:
        crystal.habit = "tabular_plates"
        crystal.dominant_forms = ["tabular {001}", "square plates"]
        habit_note = "thin yellow tabular plates — the autunite-group habit (Schneeberg form)"
    else:
        crystal.habit = "encrusting"
        crystal.dominant_forms = ["earthy crust", "yellow staining"]
        habit_note = "earthy yellow encrustation — secondary surface staining"

    # Color + fluorescence — the cation-fork narrative payoff
    habit_note += "; yellow to greenish-yellow (uranyl chromophore)"
    habit_note += "; bright yellow-green LW UV fluorescence (Ca²⁺ doesn't quench like Cu²⁺)"
    habit_note += "; ☢️ radioactive (U + As both decay-active)"

    # Deplete — formula has 1 Ca + 2 U + 2 As per unit
    conditions.fluid.Ca = max(conditions.fluid.Ca - rate * 0.025, 0)
    conditions.fluid.U = max(conditions.fluid.U - rate * 0.04, 0)
    conditions.fluid.As = max(conditions.fluid.As - rate * 0.06, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_tyuyamunite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Tyuyamunite (Ca(UO₂)₂(VO₄)₂·5-8H₂O) — Ca-branch / V-anion of the
    autunite-group cation+anion fork (Round 9e, May 2026). Mirror of
    carnotite with Ca substituted for K — orthorhombic instead of
    monoclinic crystal system, but same habit dispatch (rare tabular
    plates / earthy crust default / powdery disseminations low-σ).

    Weakly to moderately fluorescent yellow-green LW UV (vanadate
    matrix dampens emission, but slightly cleaner than carnotite due
    to Ca²⁺ vs K⁺).

    Source: research/research-tyuyamunite.md (implementation-grade
    draft, 2026-05-01); American Mineralogist v.41 (1956); Tyuya-Muyun
    type locality (Nenadkevich 1912).
    """
    sigma = conditions.supersaturation_tyuyamunite()
    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            dissolved_um = min(2.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ca += dissolved_um * 0.2
            conditions.fluid.U += dissolved_um * 0.4
            conditions.fluid.V += dissolved_um * 0.3
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH={conditions.fluid.pH:.1f}) — Ca²⁺ + UO₂²⁺ + VO₄³⁻ released"
            )
        return None

    excess = sigma - 1.0
    rate = 1.5 * excess * random.uniform(0.8, 1.2)
    if rate < 0.1:
        return None

    # Habit selection — mirror carnotite (crystalline tyuyamunite is
    # rare; the default is sandstone-staining earthy crust)
    if excess > 1.5 and conditions.temperature < 30:
        crystal.habit = "tabular_plates"
        crystal.dominant_forms = ["diamond-shaped {001} plates", "tabular crystals"]
        habit_note = "rare crystalline tyuyamunite — diamond-shaped plates from Tyuya-Muyun"
    elif excess > 0.4:
        crystal.habit = "earthy_crust"
        crystal.dominant_forms = ["canary-yellow earthy crust", "thin coating"]
        habit_note = "canary-yellow earthy crust — the standard sandstone-staining habit"
    else:
        crystal.habit = "powdery_disseminated"
        crystal.dominant_forms = ["powdery yellow disseminations", "sandstone stain"]
        habit_note = "powdery yellow disseminations — the sandstone-stain form"

    # Color + fluorescence
    habit_note += "; canary-yellow (UO₂²⁺ charge-transfer); ☢️ radioactive"
    habit_note += "; weakly fluorescent yellow-green LW UV (vanadate dampens emission, but Ca²⁺ helps slightly)"

    # Roll-front / petrified-wood association (mirror carnotite)
    if conditions.fluid.Fe > 5 and conditions.temperature < 30:
        habit_note += "; roll-front signature (oxidizing groundwater + sandstone host)"

    # Deplete — formula has 1 Ca + 2 U + 2 V per unit
    conditions.fluid.Ca = max(conditions.fluid.Ca - rate * 0.025, 0)
    conditions.fluid.U = max(conditions.fluid.U - rate * 0.04, 0)
    conditions.fluid.V = max(conditions.fluid.V - rate * 0.05, 0)

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        note=habit_note,
    )


def grow_selenite(crystal: Crystal, conditions: VugConditions, step: int) -> Optional[GrowthZone]:
    """Selenite / Gypsum (CaSO₄·2H₂O) growth. Low-T evaporite, Naica's giant crystals."""
    sigma = conditions.supersaturation_selenite()

    if sigma < 1.0:
        if crystal.total_growth_um > 5 and conditions.fluid.pH < 5.0:
            crystal.dissolved = True
            dissolved_um = min(5.0, crystal.total_growth_um * 0.10)
            conditions.fluid.Ca += dissolved_um * 0.4
            conditions.fluid.S += dissolved_um * 0.4
            return GrowthZone(
                step=step, temperature=conditions.temperature,
                thickness_um=-dissolved_um, growth_rate=-dissolved_um,
                note=f"acid dissolution (pH {conditions.fluid.pH:.1f}) — selenite dissolves slowly"
            )
        return None

    excess = sigma - 1.0
    rate = 6.0 * excess * random.uniform(0.8, 1.2)
    # Naica sweet spot — exceptionally stable 58°C grows monster crystals
    if 55 <= conditions.temperature <= 58:
        rate *= 1.4
    if rate < 0.1:
        return None

    zone_count = len(crystal.zones)
    if zone_count >= 30:
        crystal.habit = "cathedral_blade"
        crystal.dominant_forms = ["{010} blade", "{110} prism", "swallowtail tip"]
    elif rate > 8:
        crystal.habit = "tabular"
        crystal.dominant_forms = ["{010} tabular", "{120} lateral pinacoid"]
    else:
        crystal.habit = "prismatic"
        crystal.dominant_forms = ["{110} prism", "{011} dome"]

    conditions.fluid.Ca = max(conditions.fluid.Ca - rate * 0.008, 0)
    conditions.fluid.S = max(conditions.fluid.S - rate * 0.005, 0)

    # Twin rolling moved to nucleation (Round 9 bug fix Apr 2026).

    if conditions.temperature < 30:
        color_note = "colorless, glassy, transparent"
    elif conditions.fluid.Fe > 20:
        color_note = "pale amber (Fe stain)"
    else:
        color_note = "water-clear selenite"

    return GrowthZone(
        step=step, temperature=conditions.temperature,
        thickness_um=rate, growth_rate=rate,
        trace_Fe=conditions.fluid.Fe * 0.004,
        note=color_note
    )


# Mineral registry — every spec'd mineral has a growth engine.
# See data/minerals.json for the source-of-truth field declarations.
MINERAL_ENGINES = {
    "quartz": grow_quartz,
    "calcite": grow_calcite,
    "aragonite": grow_aragonite,
    "siderite": grow_siderite,
    "rhodochrosite": grow_rhodochrosite,
    "dolomite": grow_dolomite,
    "sphalerite": grow_sphalerite,
    "wurtzite": grow_wurtzite,
    "fluorite": grow_fluorite,
    "pyrite": grow_pyrite,
    "marcasite": grow_marcasite,
    "chalcopyrite": grow_chalcopyrite,
    "hematite": grow_hematite,
    "malachite": grow_malachite,
    "adamite": grow_adamite,
    "mimetite": grow_mimetite,
    "erythrite": grow_erythrite,
    "annabergite": grow_annabergite,
    "tetrahedrite": grow_tetrahedrite,
    "tennantite": grow_tennantite,
    "apophyllite": grow_apophyllite,
    "feldspar": grow_feldspar,
    "albite": grow_albite,
    "galena": grow_galena,
    "uraninite": grow_uraninite,
    "molybdenite": grow_molybdenite,
    "goethite": grow_goethite,
    "smithsonite": grow_smithsonite,
    "wulfenite": grow_wulfenite,
    "ferrimolybdite": grow_ferrimolybdite,
    "arsenopyrite": grow_arsenopyrite,
    "scorodite": grow_scorodite,
    "barite": grow_barite,
    "celestine": grow_celestine,
    "jarosite": grow_jarosite,
    "alunite": grow_alunite,
    "brochantite": grow_brochantite,
    "antlerite": grow_antlerite,
    "anhydrite": grow_anhydrite,
    "selenite": grow_selenite,
    "topaz": grow_topaz,
    "tourmaline": grow_tourmaline,
    "beryl": grow_beryl,          # goshenite / generic colorless (post-R7)
    "emerald": grow_emerald,      # Cr/V chromophore variety
    "aquamarine": grow_aquamarine,  # Fe²⁺ reducing variety
    "morganite": grow_morganite,  # Mn²⁺ variety
    "heliodor": grow_heliodor,    # Fe³⁺ oxidizing variety
    "corundum": grow_corundum,    # Al2O3 colorless/generic (SiO2-undersaturated)
    "ruby": grow_ruby,            # Al2O3 + Cr chromium variety
    "sapphire": grow_sapphire,    # Al2O3 + Fe/Ti/V/Cr-trace multi-color variety
    "spodumene": grow_spodumene,
    "anglesite": grow_anglesite,
    "cerussite": grow_cerussite,
    "pyromorphite": grow_pyromorphite,
    "vanadinite": grow_vanadinite,
    "bornite": grow_bornite,
    "chalcocite": grow_chalcocite,
    "covellite": grow_covellite,
    "cuprite": grow_cuprite,
    "azurite": grow_azurite,
    "chrysocolla": grow_chrysocolla,
    "native_copper": grow_native_copper,
    "native_gold": grow_native_gold,
    "magnetite": grow_magnetite,
    "lepidocrocite": grow_lepidocrocite,
    "stibnite": grow_stibnite,
    "bismuthinite": grow_bismuthinite,
    "native_bismuth": grow_native_bismuth,
    "clinobisvanite": grow_clinobisvanite,
    "acanthite": grow_acanthite,
    "argentite": grow_argentite,
    "native_silver": grow_native_silver,
    "native_arsenic": grow_native_arsenic,
    "native_sulfur": grow_native_sulfur,
    "native_tellurium": grow_native_tellurium,
    "nickeline": grow_nickeline,
    "millerite": grow_millerite,
    "cobaltite": grow_cobaltite,
    "descloizite": grow_descloizite,
    "mottramite": grow_mottramite,
    "raspite": grow_raspite,
    "stolzite": grow_stolzite,
    "olivenite": grow_olivenite,
    "chalcanthite": grow_chalcanthite,
    "rosasite": grow_rosasite,           # Round 9a: Cu-dominant broth-ratio carbonate
    "aurichalcite": grow_aurichalcite,   # Round 9a: Zn-dominant broth-ratio carbonate
    "torbernite": grow_torbernite,       # Round 9b: P-branch anion-competition uranyl phosphate (Cu-cation)
    "zeunerite": grow_zeunerite,         # Round 9b: As-branch anion-competition uranyl arsenate
    "carnotite": grow_carnotite,         # Round 9c: V-branch anion-competition uranyl vanadate (K-cation)
    "autunite": grow_autunite,           # Round 9d: P-branch with Cu-vs-Ca cation fork — Ca-uranyl phosphate
    "uranospinite": grow_uranospinite,   # Round 9e: As-branch / Ca-cation — autunite-group Ca-uranyl arsenate
    "tyuyamunite": grow_tyuyamunite,     # Round 9e: V-branch / Ca-cation — orthorhombic Ca-uranyl vanadate
}


# ============================================================
# THERMAL DECOMPOSITION SYSTEM
# ============================================================
# Minerals have real melting/decomposition temperatures.
# Extreme heating events (igneous intrusion, deep burial) can
# destroy low-stability minerals, reopening sealed vug space.
# This is a natural balancing mechanism against runaway growth.

THERMAL_DECOMPOSITION = {
    # mineral: (decomp_temp_°C, description, products)
    "calcite":    (840,  "CaCO₃ → CaO + CO₂ (calcination)",                     {"Ca": 0.5, "CO3": 0.4}),
    "aragonite":  (520,  "orthorhombic CaCO₃ → calcite (polymorphic conversion before calcination)", {"Ca": 0.5, "CO3": 0.4}),
    "rhodochrosite": (600, "MnCO₃ → MnO + CO₂ (calcination, lower than calcite)", {"Mn": 0.5, "CO3": 0.4}),
    "siderite":     (550, "FeCO₃ → Fe₃O₄/FeO + CO₂ (decarbonation; oxidation route → goethite at low T)", {"Fe": 0.5, "CO3": 0.4}),
    "dolomite":     (700, "CaMg(CO₃)₂ → CaO + MgO + 2CO₂ (decarbonation in two stages: MgCO₃ first ~500°C, CaCO₃ at ~840°C)", {"Ca": 0.4, "Mg": 0.4, "CO3": 0.4}),
    "malachite":  (200,  "Cu₂CO₃(OH)₂ → CuO + CO₂ + H₂O",                      {"Cu": 0.6, "CO3": 0.3}),
    "sphalerite": (1020, "ZnS → Zn + S (sublimes)",                              {"Zn": 0.3, "S": 0.5}),
    "wurtzite":   (1020, "hexagonal ZnS → sublimation (shares sphalerite decomposition)", {"Zn": 0.3, "S": 0.5}),
    "fluorite":   (1360, "CaF₂ melting — extremely refractory",                   {"Ca": 0.4, "F": 0.4}),
    "pyrite":     (743,  "FeS₂ → FeS + S (sulfur driven off)",                    {"Fe": 0.5, "S": 0.4}),
    "marcasite":  (240,  "orthorhombic FeS₂ → cubic FeS₂ (pyrite) — metastable inversion", {"Fe": 0.4, "S": 0.3}),
    "chalcopyrite": (880, "CuFeS₂ decomposition",                                {"Cu": 0.3, "Fe": 0.3, "S": 0.4}),
    "hematite":   (1560, "Fe₂O₃ — very refractory, barely melts",                 {}),
    "quartz":     (1713, "SiO₂ melting — takes hell itself to melt quartz",       {"SiO2": 0.3}),
    "adamite":    (500,  "Zn₂AsO₄OH → decomposition",                            {"Zn": 0.4, "As": 0.3}),
    "mimetite":   (400,  "Pb₅Cl(AsO₄)₃ → decomposition",                         {"Pb": 0.5, "As": 0.3, "Cl": 0.1}),
    "erythrite":  (200,  "Co₃(AsO₄)₂·8H₂O → dehydration (lattice water lost)",    {"Co": 0.5, "As": 0.3}),
    "annabergite": (200, "Ni₃(AsO₄)₂·8H₂O → dehydration (lattice water lost)",    {"Ni": 0.5, "As": 0.3}),
    "tetrahedrite": (650, "Cu₁₂Sb₄S₁₃ → decomposition (Cu + Sb + S released)",    {"Cu": 0.4, "Sb": 0.3, "S": 0.3}),
    "tennantite":  (620, "Cu₁₂As₄S₁₃ → decomposition (Cu + As + S released)",    {"Cu": 0.4, "As": 0.3, "S": 0.3}),
    "apophyllite": (350, "KCa₄Si₈O₂₀(F,OH)·8H₂O → dehydration (lattice water lost)",    {"K": 0.3, "Ca": 0.4, "SiO2": 0.4, "F": 0.2}),
    "galena":     (1115, "PbS → Pb + S (melting)",                                     {"Pb": 0.5, "S": 0.4}),
    "smithsonite": (300,  "ZnCO₃ → ZnO + CO₂ (calcination)",                            {"Zn": 0.4, "CO3": 0.4}),
    "wulfenite":   (1120, "PbMoO₄ → Pb + MoO₃ (decomposition)",                         {"Pb": 0.4, "Mo": 0.3}),
    "selenite":    (150,  "CaSO₄·2H₂O → CaSO₄ (anhydrite) + H₂O",                       {"Ca": 0.3, "S": 0.2}),
    "feldspar":    (1170, "KAlSi₃O₈ melting — feldspar is refractory",                    {"K": 0.3, "Al": 0.2, "SiO2": 0.3}),
    "albite":      (1118, "NaAlSi₃O₈ melting — albite slightly less refractory",                {"Na": 0.3, "Al": 0.2, "SiO2": 0.3}),
    "uraninite":   (2800, "UO₂ — one of the most refractory oxides",                      {"U": 0.5}),
    "goethite":    (300,  "FeO(OH) → Fe₂O₃ + H₂O (dehydrates to hematite)",              {"Fe": 0.5}),
    "molybdenite": (1185, "MoS₂ decomposition",                                         {"Mo": 0.4, "S": 0.4}),
    "arsenopyrite": (720, "FeAsS → FeAs₂ (loellingite) + S (sulfur driven off; As vapor at higher T)", {"Fe": 0.4, "As": 0.3, "S": 0.3}),
    "ferrimolybdite": (150, "Fe₂(MoO₄)₃·nH₂O → Fe₂(MoO₄)₃ + nH₂O (dehydration)",          {"Fe": 0.4, "Mo": 0.3}),
    "scorodite":     (160, "FeAsO₄·2H₂O → FeAsO₄ + 2H₂O (dehydration to anhydrous arsenate)",  {"Fe": 0.4, "As": 0.4}),
    "barite":        (1149, "BaSO₄ → BaO + SO₃ (decomposition; very high T — outside normal sim range)", {"Ba": 0.5, "S": 0.4}),
    "celestine":     (1100, "SrSO₄ → SrO + SO₃ (decomposition; high T — outside normal sim range)", {"Sr": 0.5, "S": 0.4}),
    "jarosite":      (250, "KFe³⁺₃(SO₄)₂(OH)₆ → K-jarosite dehydration → hematite + K-sulfate (loses lattice OH)", {"K": 0.3, "Fe": 0.5, "S": 0.3}),
    "alunite":       (450, "KAl₃(SO₄)₂(OH)₆ → corundum + K-Al-sulfate (loses lattice OH; basis for the early-1900s K-fertilizer process)", {"K": 0.3, "Al": 0.4, "S": 0.3}),
    "brochantite":   (250, "Cu₄(SO₄)(OH)₆ → tenorite (CuO) + SO₃ + H₂O (dehydration)", {"Cu": 0.5, "S": 0.3}),
    "antlerite":     (200, "Cu₃(SO₄)(OH)₄ → tenorite + SO₃ + H₂O (dehydration)", {"Cu": 0.5, "S": 0.4}),
    "anhydrite":     (1450, "CaSO₄ → CaO + SO₃ (decomposition; very high T — outside normal sim range)", {"Ca": 0.4, "S": 0.4}),
    "native_arsenic": (615, "As (s) → As (vapor) — sublimes at 615°C and 1 atm without melting", {"As": 0.4}),
    "native_sulfur":  (115, "S (s) → S (l) — melts at 115.2°C; burns to SO₂ at ~250°C in air", {"S": 0.6}),
    "native_tellurium": (449, "Te (s) → Te (l) — melts at 449.5°C; boils at 988°C", {"Te": 0.4}),
}


# ============================================================
# PARAMORPH TRANSITIONS
# ============================================================
# In-place polymorph conversions on cooling — distinct from
# THERMAL_DECOMPOSITION (which destroys the crystal). A paramorph
# preserves the external crystal form (habit + dominant_forms +
# total_growth_um) while the internal lattice inverts to a different
# structure.
#
# First entry, Round 8a (Apr 2026):
#   argentite (cubic Ag₂S, >173°C)  →  acanthite (monoclinic Ag₂S, <173°C)
#
# Every "argentite" crystal in any museum drawer is actually a paramorph:
# the high-T cubic form crystallized at depth, then the rising fluid
# cooled past 173°C and the lattice inverted to monoclinic while the
# cubic external geometry stayed frozen. This is the first non-destructive
# polymorph mechanic in the sim — same composition, different structure,
# same crystal you can pick up and hold.
PARAMORPH_TRANSITIONS = {
    # mineral_when_hot: (mineral_when_cool, T_threshold_C)
    "argentite": ("acanthite", 173),
}


def apply_paramorph_transitions(crystal, T, step=None):
    """Convert a crystal in-place when it crosses a paramorph T threshold.

    Mutates `crystal.mineral` to the cool-side polymorph and stamps
    `crystal.paramorph_origin` with the pre-transition mineral name.
    Preserves crystal.habit + dominant_forms + zones (the external
    shape and growth history) — those are what makes a paramorph
    identifiable in a hand specimen.

    Returns the (old, new) mineral pair if a transition fired (so the
    caller can log it), None otherwise. No-op for crystals not in
    PARAMORPH_TRANSITIONS or already past their transition.
    """
    if not crystal.active or crystal.dissolved:
        return None
    if crystal.mineral not in PARAMORPH_TRANSITIONS:
        return None
    cool_mineral, T_thresh = PARAMORPH_TRANSITIONS[crystal.mineral]
    if T >= T_thresh:
        return None
    old_mineral = crystal.mineral
    crystal.mineral = cool_mineral
    crystal.paramorph_origin = old_mineral
    if step is not None:
        crystal.paramorph_step = step
    return (old_mineral, cool_mineral)


def check_thermal_decomposition(crystals: list, conditions, step: int) -> list:
    """Check if any crystals should thermally decompose at current temperature.
    Returns list of log messages.
    """
    log = []
    T = conditions.temperature
    
    for crystal in crystals:
        if not crystal.active or crystal.dissolved:
            continue
        if crystal.mineral not in THERMAL_DECOMPOSITION:
            continue
        
        decomp_temp, description, products = THERMAL_DECOMPOSITION[crystal.mineral]
        
        # Need to be within 50°C of decomposition to start, OR over it
        if T < decomp_temp - 50:
            continue
        
        # Probability increases as T approaches and exceeds decomp_temp
        if T >= decomp_temp:
            prob = 0.8  # almost certain above decomp point
        else:
            # Linear ramp from 0 to 0.3 over the 50°C approach zone
            prob = 0.3 * (T - (decomp_temp - 50)) / 50.0
        
        if random.random() < prob:
            # Decompose this crystal
            dissolved_um = crystal.total_growth_um * random.uniform(0.3, 0.7)
            crystal.total_growth_um -= dissolved_um
            crystal.c_length_mm = crystal.total_growth_um / 1000.0
            
            if crystal.total_growth_um < 1.0:
                crystal.active = False
                crystal.dissolved = True
                status = "DESTROYED"
            else:
                status = f"DECOMPOSING ({dissolved_um:.0f}µm lost)"
            
            # Release decomposition products back to fluid
            for element, fraction in products.items():
                released = dissolved_um * fraction
                if hasattr(conditions.fluid, element):
                    current = getattr(conditions.fluid, element)
                    setattr(conditions.fluid, element, current + released)
            
            log.append(f"  🔥 {crystal.mineral.capitalize()} #{crystal.crystal_id}: {status} — {description}")
    
    return log


# ============================================================
# EVENT SYSTEM
# ============================================================

@dataclass
class Event:
    """A geological event that modifies vug conditions."""
    step: int
    name: str
    description: str
    apply_fn: object  # callable(VugConditions) -> str


def event_fluid_pulse(conditions: VugConditions) -> str:
    """New fluid floods the vug — chemistry changes sharply."""
    conditions.fluid.SiO2 *= 1.8
    conditions.fluid.Fe *= 3.0
    conditions.fluid.Mn *= 2.5
    conditions.fluid.pH -= 0.5
    conditions.flow_rate = 5.0
    return "Fresh hydrothermal fluid floods the vug. Silica and metals spike."


def event_cooling_pulse(conditions: VugConditions) -> str:
    """Rapid cooling event — maybe meteoric water mixing."""
    conditions.temperature -= 50
    conditions.fluid.SiO2 *= 0.6  # some silica precipitates out
    conditions.flow_rate = 3.0
    return f"Meteoric water incursion. Temperature drops to {conditions.temperature:.0f}°C."


def event_tectonic_shock(conditions: VugConditions) -> str:
    """Pressure spike — fracturing, twinning trigger."""
    conditions.pressure += 0.5
    conditions.temperature += 15  # adiabatic compression
    return "Tectonic event. Pressure spike. Crystals may twin."


def event_copper_injection(conditions: VugConditions) -> str:
    """Copper-bearing magmatic fluid enters the vug."""
    conditions.fluid.Cu = 120.0
    conditions.fluid.Fe += 40.0
    conditions.fluid.S += 80.0
    conditions.fluid.SiO2 += 200.0
    conditions.fluid.Pb += 20.0  # porphyry fluids carry Pb too
    conditions.fluid.O2 = 0.3  # reducing, sulfide-stable
    conditions.temperature += 30
    conditions.flow_rate = 4.0
    return (f"Copper-bearing magmatic fluid surges into the vug. "
            f"Cu spikes to {conditions.fluid.Cu:.0f} ppm. T rises to {conditions.temperature:.0f}°C. "
            f"Reducing conditions — sulfides stable.")


def event_oxidation(conditions: VugConditions) -> str:
    """Oxidizing meteoric water infiltrates — sulfides become unstable."""
    conditions.fluid.O2 = 1.8
    conditions.fluid.S *= 0.3  # sulfur oxidizes out
    conditions.temperature -= 40
    return (f"Oxidizing meteoric water infiltrates. Sulfides becoming unstable. "
            f"T drops to {conditions.temperature:.0f}°C.")


def event_acidify(conditions: VugConditions) -> str:
    """Acidic fluid enters — carbonates become unstable."""
    conditions.fluid.pH -= 2.0
    conditions.fluid.pH = max(conditions.fluid.pH, 2.0)
    return (f"Acidic fluid incursion. pH drops to {conditions.fluid.pH:.1f}. "
            f"Carbonates becoming unstable — calcite may dissolve.")


def event_alkalinize(conditions: VugConditions) -> str:
    """Alkaline fluid enters — carbonates favored, sulfides stressed."""
    conditions.fluid.pH += 2.0
    conditions.fluid.pH = min(conditions.fluid.pH, 10.0)
    return (f"Alkaline fluid incursion. pH rises to {conditions.fluid.pH:.1f}. "
            f"Carbonate precipitation favored.")


def event_molybdenum_pulse(conditions: VugConditions) -> str:
    """Late-stage molybdenum pulse — separate from Cu in porphyry systems.

    Per Seo et al. 2012 (Bingham Canyon), Mo arrives in a distinct later
    pulse from Cu. This is what makes wulfenite possible: you need BOTH
    galena (Pb) and molybdenite (Mo) to oxidize in the same vug.
    """
    conditions.fluid.Mo = 80.0
    conditions.fluid.S += 40.0
    conditions.fluid.O2 = 0.3  # reducing — molybdenite stable
    conditions.temperature += 15
    return (f"Late-stage molybdenum fluid arrives separately from Cu. "
            f"Mo spikes to {conditions.fluid.Mo:.0f} ppm. T rises to {conditions.temperature:.0f}°C. "
            f"Molybdenite may form — future wulfenite precursor.")


def event_fluid_mixing(conditions: VugConditions) -> str:
    """Two fluids meet — classic MVT mechanism.

    Note on F: real MVT brines from Mississippi Valley / Cave-in-Rock carry
    tens of ppm F. Bumping from 15 → 40 so fluorite actually crosses σ=1.2
    in the MVT scenario (Task 3 audit finding, phase 2).
    """
    conditions.fluid.Zn = 150.0
    conditions.fluid.S = 120.0
    conditions.fluid.Ca += 100.0
    conditions.fluid.F += 40.0
    conditions.fluid.Pb += 25.0   # MVT fluids carry Pb too — enables galena
    conditions.fluid.Fe += 30.0
    conditions.temperature -= 20
    return "Fluid mixing event. Metal-bearing brine meets sulfur-bearing groundwater. Sphalerite, fluorite, and galena become possible."


# ============================================================
# PHASE 2 EVENT HANDLERS — promoted from inline closures
# ============================================================
# These were originally `def ev_X(cond):` closures inside the legacy
# scenario_* functions. Phase 2 of the data-as-truth refactor promotes
# them to module-level so the parent scenario's initial state can move
# to data/scenarios.json5 and reference these handlers by string id.
# Names are scenario-prefixed (event_<scenario>_<verb>) to keep them
# unambiguous even when other scenarios use similar verbs.

# --- marble_contact_metamorphism (Mogok ruby/sapphire skarn) ---

def event_marble_peak_metamorphism(conditions: VugConditions) -> str:
    """Peak metamorphic pulse: leucogranite dyke injects hot fluid into
    the marble contact, driving peak T and skarn nucleation."""
    conditions.temperature = 700.0
    conditions.fluid.Al += 15
    conditions.fluid.SiO2 += 8
    conditions.fluid.Cr += 1.5
    conditions.flow_rate = 2.5
    return ("Contact metamorphic peak: a leucogranite dyke 50 m away "
            "pumps 700°C fluid into the marble interface. Skarn "
            "alteration zones expand outward; corundum family crystals "
            "begin to nucleate in the most Si-undersaturated patches. "
            "Pigeon's blood ruby paragenesis underway.")


def event_marble_retrograde_cooling(conditions: VugConditions) -> str:
    """Retrograde cooling: slow cooling with fluid migration along
    bleaching front. Main growth window for corundum family."""
    conditions.temperature = 500.0
    conditions.fluid.Al = max(conditions.fluid.Al * 0.9, 30)
    conditions.flow_rate = 1.2
    return ("Retrograde cooling begins. The leucogranite intrusion "
            "stalls; the fluid slowly retreats through the skarn "
            "envelope, depositing corundum at every fracture it "
            "finds. T drops from 700 to 500°C. This is the main "
            "ruby/sapphire growth window.")


def event_marble_fracture_seal(conditions: VugConditions) -> str:
    """Fracture seal — fluid egress halts; system closes."""
    conditions.temperature = 350.0
    conditions.flow_rate = 0.1
    conditions.fluid.pH = min(conditions.fluid.pH + 0.3, 9.0)
    return ("The feeding fracture seals. The Mogok pocket is now a "
            "closed system. Whatever corundum family crystals are "
            "still undersaturated will continue to consume the remaining "
            "Al pool until equilibrium. Everything else is frozen.")


# --- reactive_wall (Sweetwater Mine, Viburnum Trend MVT) ---

def event_reactive_wall_acid_pulse_1(conditions: VugConditions) -> str:
    """First acid pulse — CO₂-rich brine from depth."""
    conditions.fluid.pH = 3.5
    conditions.fluid.S += 40.0
    conditions.fluid.Zn += 60.0
    conditions.fluid.Fe += 15.0
    conditions.flow_rate = 4.0
    return ("CO₂-saturated brine surges into the vug. pH crashes to 3.5. "
            "The limestone walls begin to fizz — carbonate dissolving on contact.")


def event_reactive_wall_acid_pulse_2(conditions: VugConditions) -> str:
    """Second acid pulse — stronger, with metals."""
    conditions.fluid.pH = 3.0
    conditions.fluid.S += 50.0
    conditions.fluid.Zn += 80.0
    conditions.fluid.Fe += 25.0
    conditions.fluid.Mn += 10.0
    conditions.flow_rate = 5.0
    return ("Second acid pulse — stronger than the first. pH drops to 3.0. "
            "Metal-bearing brine floods the vug. The walls are being eaten alive, "
            "but every Ca²⁺ released is a future growth band waiting to happen.")


def event_reactive_wall_acid_pulse_3(conditions: VugConditions) -> str:
    """Third, weaker pulse — system running out of steam."""
    conditions.fluid.pH = 4.0
    conditions.fluid.S += 20.0
    conditions.fluid.Zn += 30.0
    conditions.flow_rate = 3.0
    return ("Third acid pulse — weaker now. pH only drops to 4.0. "
            "The fluid system is exhausting. But the wall still has carbonate to give.")


def event_reactive_wall_seal(conditions: VugConditions) -> str:
    """Fracture seals — fluid stops flowing, final equilibration."""
    conditions.flow_rate = 0.1
    conditions.fluid.pH += 0.5
    conditions.fluid.pH = min(conditions.fluid.pH, 8.0)
    return ("The feeding fracture seals. Flow stops. The vug becomes a closed system. "
            "Whatever's dissolved will precipitate until equilibrium.")


# --- radioactive_pegmatite (generic high-T alkali-granite pocket) ---

def event_radioactive_pegmatite_crystallization(conditions: VugConditions) -> str:
    """Pegmatite melt differentiates — main crystallization pulse."""
    conditions.temperature = 450
    conditions.fluid.SiO2 += 3000  # late-stage silica release from melt
    return ("The pegmatite melt differentiates. Volatile-rich residual "
            "fluid floods the pocket. Quartz begins to grow in earnest — "
            "large, clear crystals claiming space. Uraninite cubes "
            "nucleate where uranium concentration is highest.")


def event_radioactive_pegmatite_deep_time(conditions: VugConditions) -> str:
    """Deep time — radiation accumulates, U → Pb decay quietly transmutes."""
    conditions.temperature = 300
    return ("Deep time passes. The uraninite sits in its cradle of "
            "cooling rock, silently emitting alpha particles. Each decay "
            "transmutes one atom of uranium into lead. The quartz "
            "growing nearby doesn't know it yet, but it's darkening.")


def event_radioactive_pegmatite_oxidizing(conditions: VugConditions) -> str:
    """Late-stage oxidizing meteoric water enters fractures.

    Per the gatekeeper mechanic (v12, research-uraninite.md): once O₂ enters
    the system, uraninite begins to oxidize and release U⁶⁺ back to fluid.
    In a Cu/P-rich vug this would feed torbernite; in this scenario the
    fluid is K+P-bearing without enough V to cross the carnotite gate, so
    the released uranyl mostly disperses without secondary precipitation.
    """
    conditions.fluid.O2 += 0.8
    conditions.temperature = 120
    conditions.flow_rate = 1.5
    return ("Oxidizing meteoric fluids seep through fractures. "
            "The reducing environment shifts. Sulfides become unstable. "
            "The uraninite begins to weather — pitchy edges yellowing as "
            "U⁴⁺ goes back into solution as soluble uranyl ion.")


def event_radioactive_pegmatite_final_cooling(conditions: VugConditions) -> str:
    """System cools to near-ambient. Note: shares the verb 'final_cooling'
    with ouro_preto's closure — the scenario prefix prevents collision."""
    conditions.temperature = 50
    conditions.flow_rate = 0.1
    return ("The system cools to near-ambient. What remains is a "
            "pegmatite pocket: black uraninite cubes, smoky quartz "
            "darkened by radiation, and galena crystallized from the "
            "lead that uranium became. Time wrote this assemblage. "
            "Chemistry just held the pen.")


# --- schneeberg (oxidized U-pegmatite + arsenopyrite, Erzgebirge, Saxony) ---
# Round 9e mechanic-coverage scenario (May 2026): walks the autunite-group
# cation×anion fork through both Cu-cation phases (torbernite + zeunerite
# in P/As branches) then both Ca-cation phases (autunite + uranospinite).

def event_schneeberg_pegmatite_crystallization(conditions: VugConditions) -> str:
    """Hot pegmatitic fluid grows uraninite + chalcopyrite + arsenopyrite primaries."""
    conditions.temperature = 350
    conditions.fluid.O2 = 0.0  # strongly reducing — required for sulfides + uraninite
    conditions.fluid.SiO2 = max(conditions.fluid.SiO2, 6000)
    return ("The Schneeberg pegmatite differentiates. A reducing residual "
            "fluid floods the pocket with uranium, copper, iron, and "
            "arsenic. Uraninite grows as pitch-black masses; chalcopyrite "
            "plates as brassy disphenoids; arsenopyrite forms steel-gray "
            "rhombs. Bismuth is everywhere — Schneeberg's first ore was "
            "bismuth, three centuries before pitchblende became uranium.")


def event_schneeberg_cooling(conditions: VugConditions) -> str:
    """T drops to ambient supergene window; primaries finish forming."""
    conditions.temperature = 30
    conditions.flow_rate = 0.5
    return ("The pegmatite system cools toward ambient. Primary "
            "crystallization closes. The vug holds black uraninite, "
            "brassy chalcopyrite, and steel-gray arsenopyrite — a "
            "characteristic Erzgebirge primary assemblage, not yet "
            "touched by oxidation.")


def event_schneeberg_cu_p_phase(conditions: VugConditions) -> str:
    """Meteoric oxidation flood. P-dominant + Cu-dominant fluid → torbernite plates."""
    conditions.temperature = 25
    conditions.fluid.O2 = 1.5  # oxidizing — primaries begin weathering
    conditions.fluid.pH = 6.0
    conditions.flow_rate = 1.5
    # Phosphate replenishment from soil-zone runoff (Schneeberg-area
    # apatite-bearing pegmatite accessory minerals weather to release P).
    # Set P high, As low — torbernite-favorable anion fork.
    conditions.fluid.P = max(conditions.fluid.P, 18.0)
    conditions.fluid.As = min(conditions.fluid.As, 4.0)
    # Cu boosted by chalcopyrite weathering (the engine itself releases Cu,
    # but we top it up to ensure the cation gate fires the Cu branch).
    conditions.fluid.Cu = max(conditions.fluid.Cu, 70.0)
    # Ca held moderate so Cu/(Cu+Ca) > 0.5 passes
    conditions.fluid.Ca = min(conditions.fluid.Ca, 35.0)
    return ("Meteoric water seeps through fractures and floods the system "
            "with oxygen. Uraninite begins weathering — its U⁴⁺ flips to "
            "soluble UO₂²⁺ uranyl. Chalcopyrite oxidizes; Cu²⁺ enters "
            "solution alongside the uranyl. Arsenopyrite weathering is "
            "delayed (steeper kinetic barrier), so phosphate dominates "
            "the anion pool. Emerald-green torbernite plates begin "
            "appearing on the dissolving uraninite — the diagnostic "
            "Schneeberg habit, the museum-classic.")


def event_schneeberg_cu_as_pulse(conditions: VugConditions) -> str:
    """Arsenopyrite weathering catches up — As-dominant + Cu-dominant → zeunerite plates."""
    conditions.temperature = 22
    # Arsenopyrite weathering finally releases its arsenate. As-dominant fluid.
    conditions.fluid.As = max(conditions.fluid.As, 22.0)
    conditions.fluid.P = min(conditions.fluid.P, 4.0)
    # Some Cu has been consumed by torbernite, but more is released by
    # ongoing chalcopyrite weathering. Net stays Cu-dominant.
    conditions.fluid.Cu = max(conditions.fluid.Cu, 55.0)
    conditions.fluid.Ca = min(conditions.fluid.Ca, 35.0)
    return ("The arsenopyrite has been steadily oxidizing in the "
            "background, and now it catches up. Arsenate floods the "
            "fluid — As pulls past P as the dominant anion. Cu is still "
            "in the pool, ahead of Ca. The same chemistry stage as "
            "torbernite but with arsenate instead of phosphate: zeunerite, "
            "the species Weisbach described from this very mine in 1872. "
            "Visually indistinguishable from torbernite; the chemistry "
            "is the only honest test.")


def event_schneeberg_cu_depletion(conditions: VugConditions) -> str:
    """Cu consumed; Ca rises from carbonate dissolution → autunite plates."""
    conditions.temperature = 20
    # Cu has been consumed by torbernite + zeunerite; what's left in
    # solution is the residual after secondary plating. Set explicitly low.
    conditions.fluid.Cu = min(conditions.fluid.Cu, 5.0)
    # Ca rises — carbonate-buffered pegmatite-country-rock contact
    # dissolves carbonate accessory minerals as Cu²⁺ has been consumed
    # and the local pore fluid acidity drops.
    conditions.fluid.Ca = max(conditions.fluid.Ca, 100.0)
    # Phosphate replenishment for the autunite phase
    conditions.fluid.P = max(conditions.fluid.P, 18.0)
    conditions.fluid.As = min(conditions.fluid.As, 4.0)
    return ("Copper has been pulled out of the fluid by the green plates. "
            "The cation pool flips: calcium, sourced from the carbonate "
            "buffer in the pegmatite country rock, takes over. P "
            "replenishes from continuing apatite weathering. The same "
            "uranyl-phosphate chemistry that grew torbernite now grows "
            "autunite — bright canary yellow instead of emerald green, "
            "and crucially, fluorescent. Where Cu²⁺ killed the uranyl "
            "emission cold, Ca²⁺ leaves it lit.")


def event_schneeberg_as_pulse_late(conditions: VugConditions) -> str:
    """Final arsenate replenishment; Ca dominant → uranospinite plates."""
    conditions.temperature = 18
    conditions.fluid.As = max(conditions.fluid.As, 22.0)
    conditions.fluid.P = min(conditions.fluid.P, 4.0)
    conditions.fluid.Ca = max(conditions.fluid.Ca, 100.0)
    conditions.fluid.Cu = min(conditions.fluid.Cu, 5.0)
    conditions.flow_rate = 0.3
    return ("The arsenate replenishes one final time as the last "
            "arsenopyrite grains weather. Ca is still dominant, As is "
            "now dominant: uranospinite, the calcium analog of zeunerite. "
            "Same mine, same vein, same uranyl ion — but where zeunerite "
            "was dead under UV, this one glows yellow-green. Weisbach "
            "described it in 1873, the year after he characterized "
            "zeunerite a hundred meters away. Four uranyl species in one "
            "vug, the cation+anion fork mechanic finally written into "
            "the rock.")


# --- colorado_plateau (sandstone roll-front uranium-vanadium deposits) ---
# Round 9e companion scenario (May 2026): fires carnotite + tyuyamunite,
# completing the K/Ca cation fork on the V-anion branch.

def event_colorado_plateau_groundwater_pulse(conditions: VugConditions) -> str:
    """U+V replenishment from upstream sandstone weathering; Ca dominant → tyuyamunite plates."""
    conditions.temperature = 22
    conditions.fluid.O2 = 1.5  # oxidizing surface groundwater
    conditions.fluid.pH = 7.0
    conditions.flow_rate = 1.2
    # Replenish U + V from upstream weathering of montroseite/uraninite
    conditions.fluid.U = max(conditions.fluid.U, 18.0)
    conditions.fluid.V = max(conditions.fluid.V, 14.0)
    # Ca dominant initially (groundwater carbonate equilibrium)
    conditions.fluid.Ca = max(conditions.fluid.Ca, 100.0)
    conditions.fluid.K = min(conditions.fluid.K, 20.0)
    return ("Oxidizing groundwater flushes through the Morrison Formation "
            "sandstones, picking up uranium from upstream uraninite "
            "weathering and vanadium from montroseite-bearing layers. "
            "The carbonate-buffered fluid carries Ca dominant over K. "
            "Where it meets a U+V trap — typically petrified wood or "
            "carbonaceous shale — bright canary-yellow tyuyamunite "
            "begins plating. The same yellow that prospectors followed "
            "across mesa tops decades before scintillometers existed.")


def event_colorado_plateau_roll_front_contact(conditions: VugConditions) -> str:
    """Fe rises (organic-iron proxy); T drops; redox front concentrates uranyl-vanadates."""
    conditions.temperature = 18
    conditions.fluid.Fe = max(conditions.fluid.Fe, 12.0)
    conditions.fluid.O2 = 1.0  # slight reduction at the redox front
    conditions.flow_rate = 0.6
    return ("The fluid hits a roll-front — a buried zone of carbonaceous "
            "shale or petrified wood that has held its reducing capacity "
            "for millions of years. Iron rises as the organic carbon "
            "reduces dissolved Fe³⁺ to Fe²⁺ and pulls oxygen from the "
            "system. The uranyl-vanadate complex destabilizes at the "
            "redox boundary, dropping out as concentrated tyuyamunite "
            "crusts where the chemistry crosses. The Colorado Plateau "
            "ore-grade signature.")


def event_colorado_plateau_k_pulse(conditions: VugConditions) -> str:
    """Evaporite K enrichment; K/(K+Ca) crosses 0.5 → carnotite plates."""
    conditions.temperature = 22
    # Arid-zone evaporation concentrates K (groundwater K-feldspar weathering
    # + minor evaporite influence in the discharge zone).
    conditions.fluid.K = max(conditions.fluid.K, 40.0)
    conditions.fluid.Ca = min(conditions.fluid.Ca, 30.0)
    conditions.fluid.V = max(conditions.fluid.V, 10.0)
    conditions.fluid.U = max(conditions.fluid.U, 8.0)
    conditions.fluid.Fe = max(conditions.fluid.Fe, 8.0)
    return ("A drier interval. Evaporation concentrates the alkaline "
            "ions; potassium pulls past calcium in the cation pool. "
            "K/(K+Ca) crosses 0.5 — the carnotite branch of the cation "
            "fork takes over. Carnotite plates beside the existing "
            "tyuyamunite. Same canary-yellow, same uranyl-vanadate, "
            "same chemistry stage; the cation ratio drew the boundary "
            "between them. Friedel and Cumenge described carnotite "
            "from Roc Creek in 1899 from exactly this kind of pore-fluid "
            "regime.")


def event_colorado_plateau_ca_recovery(conditions: VugConditions) -> str:
    """Carbonate dissolution refreshes Ca; second tyuyamunite phase plates alongside carnotite."""
    conditions.temperature = 20
    # Carbonate dissolution (post-evaporite recharge) brings Ca back to dominance
    conditions.fluid.Ca = max(conditions.fluid.Ca, 95.0)
    conditions.fluid.K = min(conditions.fluid.K, 15.0)
    conditions.fluid.V = max(conditions.fluid.V, 9.0)
    conditions.fluid.U = max(conditions.fluid.U, 6.0)
    return ("The dry interval ends; meteoric recharge brings carbonate "
            "back into solution. Ca recovers dominance. Tyuyamunite "
            "resumes plating in the new pore-fluid composition, this "
            "time alongside the carnotite that grew during the K-pulse. "
            "Colorado Plateau specimens preserve exactly this kind of "
            "intergrowth — the same hand specimen, the same emerald "
            "color, the cation chemistry the only honest test of which "
            "is which.")


def event_tutorial_temperature_drop(conditions: VugConditions) -> str:
    """Tutorial 1 — scripted T drop pulling quartz out of its growth window."""
    # Knock T down by 80°C, never below ambient. From the tutorial's
    # 180°C start this lands ~100°C — well outside quartz's comfort
    # window for sustained growth, but not so cold the existing crystal
    # immediately re-dissolves.
    conditions.temperature = max(25.0, conditions.temperature - 80.0)
    return ("The vug cools quickly. Temperature drops out of quartz's "
            "growth window — the silica supply that was happily plating "
            "onto the crystal a moment ago no longer wants to leave the "
            "fluid. Growth slows, then stops. The crystal is still there, "
            "still beautiful, but nothing new is forming on its faces. "
            "Conditions matter; minerals only grow when the broth wants "
            "to give them up.")


def event_tutorial_mn_pulse(conditions: VugConditions) -> str:
    """Tutorial 2 — Mn injection past the calcite-fluorescence activator threshold."""
    # Push Mn well past the 2 ppm activator threshold. From a starting
    # 8 ppm this lands at ~38 ppm — comfortably saturating Mn in the
    # next calcite zones, but not high enough to destabilize calcite
    # toward rhodochrosite (that would need Mn an order of magnitude
    # higher in this broth).
    conditions.fluid.Mn += 30.0
    return ("A fresh fluid pulse brings extra manganese into the broth. "
            "The next zones of calcite to grow will incorporate Mn²⁺ as "
            "a trace dopant — the same activator that lights up the "
            "Franklin / Sterling Hill specimens under longwave UV. The "
            "iron in the broth still quenches most of it for now, but "
            "the chemistry is set: Mn²⁺ is being recorded into every "
            "growth ring from this moment forward.")


def event_tutorial_fe_drop(conditions: VugConditions) -> str:
    """Tutorial 2 — Fe drop revealing the Mn-activated fluorescence."""
    # Crash Fe down to ~5% of its current value (from 10 → 0.5). The
    # quenching threshold is somewhere in the low single digits; this
    # lands clearly under it, so the zones that grow next can fluoresce
    # at the full Mn-activated brightness.
    conditions.fluid.Fe = max(0.0, conditions.fluid.Fe * 0.05)
    return ("An iron-poor recharge flushes the system. Fe²⁺ — the "
            "quencher — falls below the suppression threshold. The "
            "Mn-doped zones that grow next will fluoresce at full "
            "brightness. The boundary between the dim early zones "
            "and the bright new ones records the exact moment the "
            "iron dropped out of the broth. The crystal is now a "
            "stratigraphic record of the chemistry you played with.")


def event_colorado_plateau_arid_stabilization(conditions: VugConditions) -> str:
    """System reaches ambient steady state; both species coexist."""
    conditions.temperature = 20
    conditions.flow_rate = 0.1
    return ("The system reaches its steady state. Carnotite and "
            "tyuyamunite cover the pore walls in roughly equal parts. "
            "Both fluoresce dimly under longwave UV — the vanadate "
            "matrix dampens their emission below autunite-group "
            "brilliance, but Ca²⁺ keeps tyuyamunite's emission slightly "
            "lifted above carnotite's. Time wrote this assemblage. "
            "Geochemistry just held the pen.")


# --- deccan_zeolite (Stage III Deccan Traps zeolite vesicle, ~21-58 Ma post-eruption) ---

def event_deccan_zeolite_silica_veneer(conditions: VugConditions) -> str:
    """Stage I — hot early silica + hematite needle deposition."""
    conditions.fluid.SiO2 += 400
    conditions.fluid.Fe += 50
    conditions.fluid.O2 = 0.9
    conditions.temperature = 200
    return ("Stage I — hot post-eruption hydrothermal fluid coats the "
            "vesicle wall with chalcedony. Silica activity peaks; iron "
            "stripped from the basalt groundmass deposits as hematite "
            "needles on the chalcedony rind. These needles will become "
            "the seeds for the 'bloody apophyllite' phantom inclusions "
            "in Stage III.")


def event_deccan_zeolite_hematite_pulse(conditions: VugConditions) -> str:
    """Iron pulse — produces the bloody apophyllite phantom zone."""
    conditions.fluid.Fe += 80
    conditions.fluid.O2 = 1.0
    conditions.temperature = 175
    return ("An iron-bearing pulse threads through the vesicle. Hematite "
            "needles seed the surfaces of any growing apophyllite. When "
            "the apophyllite resumes crystallization, those needles get "
            "trapped in the next growth zone — the Nashik 'bloody "
            "apophyllite' phantom band.")


def event_deccan_zeolite_stage_ii(conditions: VugConditions) -> str:
    """Stage II — zeolite blades + calcite."""
    conditions.fluid.Ca += 80
    conditions.fluid.K += 10
    conditions.fluid.SiO2 += 200
    conditions.fluid.pH = 8.5
    conditions.temperature = 130
    return ("Stage II — zeolite blades begin to fill the vesicle. "
            "Stilbite, scolecite, heulandite (modeled here as the "
            "zeolite paragenesis pH/Si signature). Calcite forms "
            "as a late-stage carbonate. The vug is filling slowly.")


def event_deccan_zeolite_apophyllite_stage_iii(conditions: VugConditions) -> str:
    """Stage III — apophyllite-saturating alkaline K-Ca-Si-F pulse."""
    conditions.fluid.K += 25
    conditions.fluid.Ca += 50
    conditions.fluid.SiO2 += 300
    conditions.fluid.F += 4
    conditions.fluid.pH = 8.8
    conditions.temperature = 150
    return ("Stage III — the apophyllite-bearing pulse arrives, alkaline "
            "K-Ca-Si-F groundwater. Per Ottens et al. 2019 this is the "
            "long-lasting late stage, 21–58 Ma after the original eruption. "
            "The pseudo-cubic apophyllite tablets begin to crystallize on "
            "the wall, on the chalcedony, on the hematite needles already "
            "present — wherever a nucleation site offers itself.")


def event_deccan_zeolite_late_cooling(conditions: VugConditions) -> str:
    """Stage IV — late cooling, growth slows."""
    conditions.temperature = 80
    conditions.fluid.pH = 8.0
    conditions.flow_rate = 0.1
    return ("Late cooling. The vesicle fluid drops back toward ambient. "
            "Apophyllite growth slows but doesn't stop entirely; the "
            "remaining K-Ca-Si-F supersaturation keeps adding micron-thin "
            "growth zones on the existing crystals. Time, not chemistry, "
            "becomes the limiting reagent.")


# --- ouro_preto (Imperial Topaz veins, Minas Gerais BR — Variant B per Morteani 2002) ---

def event_ouro_preto_vein_opening(conditions: VugConditions) -> str:
    """First fracture propagation — fresh hot fluid floods a narrow slot."""
    conditions.fluid.SiO2 += 150  # fresh silica supply
    conditions.temperature = 380
    conditions.flow_rate = 1.5
    return ("The fracture opens. Fluid pressure exceeded lithostatic "
            "pressure and the vein propagated upward — narrow, barely "
            "wider than your hand. Fresh hot brine floods in at 380°C "
            "and quartz starts lining the walls. The fluorine in the "
            "fluid is still below saturation; topaz holds its breath.")


def event_ouro_preto_f_pulse(conditions: VugConditions) -> str:
    """Metamorphic dehydration of phyllite micas releases fluorine.
    Gate-opener: F jumps past topaz saturation threshold."""
    conditions.fluid.F += 30.0
    conditions.fluid.Al += 8.0
    conditions.temperature = 365
    conditions.flow_rate = 1.2
    return ("A deeper wall of phyllite reaches the dehydration point. "
            "Fluorine-bearing micas break down and release F⁻ into the "
            f"vein fluid — F jumps to {conditions.fluid.F:.0f} ppm, past the "
            "topaz saturation threshold. The chemistry has just tipped. "
            "Imperial topaz is now thermodynamically inevitable.")


def event_ouro_preto_cr_leach(conditions: VugConditions) -> str:
    """Fluid pathway crosses an ultramafic dike — Cr leaches in."""
    conditions.fluid.Cr += 4.0
    conditions.temperature = 340
    return ("The vein system intersects an ultramafic dike on its way "
            f"up. Chromium leaches into the fluid — Cr now {conditions.fluid.Cr:.1f} ppm, "
            "above the imperial-color window. Any topaz growing from "
            "this pulse forward will catch Cr³⁺ in its structure. "
            "Golden-orange is committed to the crystal.")


def event_ouro_preto_steady_cooling(conditions: VugConditions) -> str:
    """Main growth phase — slow steady cooling through the topaz window."""
    conditions.temperature = 320
    conditions.flow_rate = 1.0
    return ("The main topaz growth phase. The vein cools steadily — "
            "320°C now — and topaz is happily projecting from the "
            "quartz-lined walls. Slow, clean layer-by-layer growth. "
            "The crystals are recording the thermal history in their "
            "growth zones and fluid inclusions; a microprobe traverse "
            "across one of these crystals would read like a barometer.")


def event_ouro_preto_late_hydrothermal(conditions: VugConditions) -> str:
    """Dilute late fluid — F drops, kaolinite begins to form from feldspar.
    Note: shares verb 'late_hydrothermal' with gem_pegmatite — scenario
    prefix prevents collision."""
    conditions.temperature = 220
    conditions.fluid.pH = 5.5
    conditions.flow_rate = 0.6
    return ("Late-stage dilute hydrothermal fluid — pH falling, F "
            "depleted by topaz growth. Kaolinite begins replacing any "
            "remaining feldspar in the wall rock; the vein walls soften. "
            "Topaz's perfect basal cleavage means any shift in the "
            "wall can snap a crystal off its base. Cleavage fragments "
            "will accumulate on the pocket floor.")


def event_ouro_preto_oxidation_stain(conditions: VugConditions) -> str:
    """System opens to oxidizing surface water — goethite staining."""
    conditions.temperature = 90
    conditions.fluid.O2 = 1.6
    conditions.fluid.Fe += 20
    conditions.flow_rate = 0.3
    return ("Surface water finds the vein. The system oxidizes — "
            "meteoric O₂ reaches the pocket, iron precipitates as "
            "goethite, and the final topaz generation sits in a "
            "limonite-stained matrix. The assemblage that garimpeiros "
            "will find in 400 Ma is now fully set.")


def event_ouro_preto_final_cooling(conditions: VugConditions) -> str:
    """System reaches near-ambient temperature — story ends.
    Note: shares verb 'final_cooling' with radioactive_pegmatite — scenario
    prefix prevents collision."""
    conditions.temperature = 50
    conditions.flow_rate = 0.05
    return ("The vein cools to near-ambient. What remains is the "
            "assemblage: milky quartz lining the walls, imperial topaz "
            "prisms projecting inward, fluid inclusion planes across "
            "every crystal, iron-stained fractures. The exhalation has "
            "finished. The vug now waits for time.")


# --- gem_pegmatite (Cruzeiro mine, Doce Valley MG — Variant A) ---

def event_gem_pegmatite_outer_shell(conditions: VugConditions) -> str:
    """Phase 1: outer shell continues crystallizing, wall zone fills in."""
    conditions.temperature = 620
    conditions.flow_rate = 1.0
    return ("The outer pegmatite shell is already cooling. Microcline "
            "and quartz dominate the wall zone, growing inward into "
            "the void. The pocket fluid inside is enriched in the "
            "elements nothing else wanted: beryllium, boron, lithium, "
            "fluorine. They haven't crossed any saturation thresholds "
            "yet — they are simply accumulating.")


def event_gem_pegmatite_first_schorl(conditions: VugConditions) -> str:
    """Phase 1->2: Fe + B supersaturation crosses, schorl begins."""
    conditions.temperature = 560
    conditions.flow_rate = 0.9
    return ("The pocket has cooled enough that tourmaline can form. "
            "Boron has been accumulating in the fluid for thousands of "
            "years; with Fe²⁺ still abundant, the schorl variety "
            "nucleates. Deep black prisms begin projecting from the "
            "wall. Each new zone records a fluid pulse — the "
            "striations are the pocket's diary.")


def event_gem_pegmatite_albitization(conditions: VugConditions) -> str:
    """Phase 2: albitization event. K-feldspar -> albite replacement cascade."""
    conditions.fluid.K = max(conditions.fluid.K - 30, 10)
    conditions.fluid.Na += 40
    conditions.fluid.Al += 10
    conditions.fluid.pH += 0.2
    conditions.temperature = 500
    return ("Albitization event. The pocket's K has depleted faster than "
            "its Na — microcline starts dissolving and albite begins "
            "precipitating in its place. K²⁺ returns to the fluid, "
            "enabling a second generation of mica-like phases. This "
            "replacement cascade is the most Minas Gerais thing about "
            "a Minas Gerais pegmatite: the pocket is rearranging itself.")


def event_gem_pegmatite_be_saturation(conditions: VugConditions) -> str:
    """Phase 2: Be finally crosses beryl's nucleation threshold."""
    conditions.temperature = 450
    conditions.flow_rate = 0.8
    return ("Beryllium has been accumulating for a dozen thousand "
            "years. Every earlier mineral refused it. Now σ crosses "
            "1.8 and the first beryl crystal nucleates. Because Be "
            "had so long to build, the crystal has a lot of material "
            "waiting — this is how meter-long beryls form. What "
            "color depends on who else is in the fluid. Morganite if "
            "Mn won the lottery; aquamarine if Fe did; emerald if "
            "Cr leached in from an ultramafic contact somewhere.")


def event_gem_pegmatite_li_phase(conditions: VugConditions) -> str:
    """Phase 2->3: temperature drops into Li-bearing mineral sweet spot."""
    conditions.temperature = 420
    conditions.fluid.Fe = max(conditions.fluid.Fe - 20, 5)
    return ("Temperature drops into the 400s. Lithium, which has been "
            "accumulating since the beginning, is now abundant enough "
            "to nucleate Li-bearing minerals. Spodumene will take "
            "most of it — the Li pyroxene wants its own crystals. "
            "Any remaining Li goes into elbaite overgrowths on the "
            "schorl cores: the crystals become color-zoned as iron "
            "depletes and lithium takes its place.")


def event_gem_pegmatite_late_hydrothermal(conditions: VugConditions) -> str:
    """Phase 3: below ~400C, topaz window opens. Note: shares verb
    'late_hydrothermal' with ouro_preto — scenario prefix prevents collision."""
    conditions.temperature = 360
    conditions.fluid.pH = 5.5
    conditions.flow_rate = 0.5
    return ("Late hydrothermal phase. Temperature drops into topaz's "
            "optimum window (340–400°C). Fluorine has been sitting "
            "unused — nothing else in this pocket consumed it — and "
            "enough Al remains in the residual pocket fluid after "
            "the main silicate crop has taken its share. Topaz "
            "nucleates, projecting from the quartz lining.")


def event_gem_pegmatite_clay_softening(conditions: VugConditions) -> str:
    """Phase 3: kaolinization event. pH drops past microcline stability;
    feldspar engine dissolution branch fires."""
    conditions.temperature = 320
    conditions.fluid.pH = 3.5
    conditions.flow_rate = 0.3
    return ("pH drops into the kaolinization window. Microcline in "
            "the pocket walls starts breaking down into kaolinite — "
            "the signature 'clay gloop' that coats every Minas "
            "Gerais gem pocket by the time garimpeiros crack it "
            "open. The reaction 2 KAlSi₃O₈ + 2 H⁺ + H₂O → kaolinite "
            "+ 2 K⁺ + 4 SiO₂ releases potassium and silica to the "
            "fluid, but the aluminum stays locked in the new "
            "kaolinite. Albite is more acid-resistant and survives "
            "intact — a field observation preserved in the sim.")


def event_gem_pegmatite_final(conditions: VugConditions) -> str:
    """Phase 3 end: system cools to 300C and then ambient over deep time."""
    conditions.temperature = 300
    conditions.flow_rate = 0.1
    return ("The system cools to 300°C, below spodumene's window and "
            "approaching topaz's lower edge. Growth slows to near-"
            "zero. Deep time will do the rest: this pocket will wait "
            "half a billion years before human hands crack it open, "
            "and the garimpeiros will sort the crystals by color in "
            "the order the fluid deposited them.")


# --- supergene_oxidation (Tsumeb 1st-stage gossan) ---

def event_supergene_acidification(conditions: VugConditions) -> str:
    """Early acidic phase: H2SO4 from sulfide oxidation drops pH.

    Note: this single handler is referenced by FOUR event entries
    (steps 5, 8, 12, 16) — it fires repeatedly to hold pH near 4
    against the limestone wall's carbonate buffering. Without the
    repeated pulses, the buffer neutralizes pH back to 6+ within
    ~5 steps; with them, pH stays in the 3.5-5 range until
    ev_meteoric_flush ends the acid window.

    v5 gap-fill (Apr 2026): added to close the Tsumeb pH gap
    documented in BACKLOG.md after Round 5. Without this event,
    scorodite / jarosite / alunite couldn't form at Tsumeb despite
    being world-class display species there.
    """
    conditions.fluid.pH = 4.0
    conditions.fluid.O2 = 1.5  # already oxidizing, slight bump from O2=1.8 baseline
    conditions.fluid.S += 20   # H₂SO₄ contributes SO₄²⁻ to fluid
    return ("Early acidic supergene phase. Primary sulfides oxidize "
            "and release H₂SO₄ — pH drops to 4.0, opening the acid "
            "window for the arsenate + sulfate suite (scorodite, "
            "jarosite, alunite). Carbonate buffering will reverse "
            "this at the meteoric flush; the acid-stable phases "
            "form during this short ~15-step window.")


def event_supergene_meteoric_flush(conditions: VugConditions) -> str:
    """Rain-fed oxygenated water recharges the aquifer."""
    conditions.fluid.O2 = 2.2
    conditions.fluid.CO3 += 30
    conditions.fluid.pH = 6.2
    conditions.flow_rate = 1.5
    return ("Rain infiltrates the soil zone and percolates down, picking "
            "up CO₂ and oxygen. Fresh supergene brine — cold, oxygen-rich, "
            "slightly acidic. Any remaining primary sulfides are on borrowed time.")


def event_supergene_pb_mo_pulse(conditions: VugConditions) -> str:
    """A fracture opens to a primary galena/molybdenite source — Pb and Mo surge."""
    conditions.fluid.Pb += 40
    conditions.fluid.Mo += 25
    conditions.fluid.O2 = 2.0
    conditions.flow_rate = 2.0
    return ("A weathering rind breaches: Pb²⁺ and MoO₄²⁻ released "
            "simultaneously from an oxidizing galena+molybdenite lens. "
            "The Seo et al. (2012) condition for wulfenite formation — "
            "both parents dying at once — is met.")


def event_supergene_cu_enrichment(conditions: VugConditions) -> str:
    """Primary chalcopyrite weathers upslope — Cu2+ descends.
    Drops fluid O2 to 0.6 for a window — the sim's 1D O2 can't directly
    model the Eh gradient between oxidized cap and reduced substrate, so
    we brute-force simulate 'Cu-rich fluid hit the reducing layer' by
    briefly pulling fluid O2 down. Ambient cooling will re-oxidize within ~10 steps."""
    conditions.fluid.Cu += 50.0
    conditions.fluid.S += 30.0   # chalcopyrite is 35% S — significant release
    conditions.fluid.Fe += 10.0
    conditions.fluid.O2 = 0.6   # local reducing pulse at the enrichment zone
    return ("A primary chalcopyrite lens upslope finishes oxidizing. "
            "Cu²⁺ descends with the water table and hits the reducing "
            "layer below — the supergene enrichment blanket, where "
            "mineable copper ore gets made. Bornite precipitates on "
            "the upgradient edge, chalcocite in the core, covellite "
            "where S activity is highest. Real orebodies are often "
            "5–10× richer here than in the primary sulfide below.")


def event_supergene_dry_spell(conditions: VugConditions) -> str:
    """Evaporation concentrates sulfate — selenite potential."""
    conditions.fluid.Ca += 40
    conditions.fluid.S += 30
    conditions.fluid.O2 = 1.5
    conditions.temperature = 50  # slight warming, still below 60°C anhydrite line
    conditions.flow_rate = 0.3
    return ("Dry season. Flow slows, evaporation concentrates the brine. "
            "Ca²⁺ and SO₄²⁻ climb toward selenite's window — the desert-rose "
            "chemistry, the Naica chemistry.")


def event_supergene_as_rich_seep(conditions: VugConditions) -> str:
    """Arsenic-bearing seep — feeds adamite + mimetite + erythrite + annabergite."""
    conditions.fluid.As += 8
    conditions.fluid.Cl += 10
    conditions.fluid.Zn += 20
    # Cobalt + nickel arsenide weathering delivers Co2+ and Ni2+ alongside
    # the arsenate flood — erythrite/annabergite Co/Ni couple only saturates
    # when this event fires.
    conditions.fluid.Co += 20
    conditions.fluid.Ni += 20
    conditions.fluid.pH = 6.0
    conditions.temperature = 25   # cool to erythrite/annabergite optimum window
    return ("An arsenic-bearing seep arrives from a weathering "
            "arsenopyrite body upslope, carrying trace cobalt and "
            "nickel from parallel oxidizing arsenides. Zn²⁺ saturates "
            "adamite; Pb²⁺ saturates mimetite; Co²⁺ and Ni²⁺ begin "
            "to bloom as crimson erythrite and apple-green annabergite.")


def event_supergene_phosphate_seep(conditions: VugConditions) -> str:
    """Phosphate-bearing groundwater — enables pyromorphite."""
    conditions.fluid.P += 6.0
    conditions.fluid.Cl += 5.0
    conditions.fluid.pH = 6.4
    return ("A phosphate-bearing groundwater seeps in from the soil "
            "zone — organic decay, weathered apatite bedrock, bat guano "
            "from above. P jumps past pyromorphite's saturation "
            "threshold, and any Pb still in solution has a new home.")


def event_supergene_v_bearing_seep(conditions: VugConditions) -> str:
    """V-bearing fluid from red-bed sediments — enables vanadinite."""
    conditions.fluid.V += 6.0
    conditions.fluid.Cl += 8.0
    conditions.temperature = 45   # late dry phase, slight warming
    return ("A vanadium-bearing seep arrives from a weathering red-bed "
            "ironstone upslope. V⁵⁺ leaches from oxidizing roll-front "
            "vanadates, and at Pb + V + Cl saturation the bright "
            "red-orange vanadinite nucleates — the classic "
            "'vanadinite on goethite' habit of the Morocco / Arizona "
            "desert deposits.")


def event_supergene_fracture_seal(conditions: VugConditions) -> str:
    """System seals — final equilibration. Note: shares verb 'fracture_seal'
    with marble_contact_metamorphism — scenario prefix prevents collision."""
    conditions.flow_rate = 0.05
    conditions.fluid.O2 = 1.0
    return ("The feeding fractures seal. The vug becomes a closed cold "
            "oxidizing system. Whatever is supersaturated will precipitate; "
            "whatever is undersaturated will quietly corrode.")


# --- bisbee (Warren Mining District, Cochise County, AZ — Cu porphyry + supergene) ---

def event_bisbee_primary_cooling(conditions: VugConditions) -> str:
    """First cooling step — chalcopyrite + bornite crystallize, pyrite +
    magnetite pin down the Fe budget. Still reducing."""
    conditions.temperature = 320
    conditions.fluid.SiO2 += 100     # late-stage silica injection
    conditions.fluid.Cu -= 50        # some Cu locked into early sulfides
    conditions.fluid.O2 = 0.08
    conditions.flow_rate = 1.2
    return ("The Sacramento Hill porphyry finishes its main crystallization "
            "pulse. Chalcopyrite and bornite precipitate in the vein selvages "
            "of the Escabrosa mantos — Cu:Fe:S in the magmatic ratio. Pyrite "
            "frames the assemblage, locked in at 300+ °C. The ore body is set. "
            "For 180 million years, nothing will happen.")


def event_bisbee_uplift_weathering(conditions: VugConditions) -> str:
    """Uplift exposes the ore to meteoric water. Pyrite oxidizes,
    releasing H+ and SO4. pH drops — supergene engine starts."""
    conditions.temperature = 35
    conditions.fluid.pH = 4.0         # acidic from pyrite oxidation
    conditions.fluid.O2 = 0.8         # oxygenated meteoric water
    conditions.fluid.S += 80          # sulfate released from pyrite
    conditions.fluid.Cu += 100        # Cu²⁺ leached from primary chalcopyrite
    conditions.fluid.Fe += 50
    conditions.flow_rate = 1.8
    return ("Mesozoic–Cenozoic uplift tips the Warren basin and strips the "
            "Cretaceous cover. Meteoric water percolates down through "
            "fractures, hitting pyrite; sulfuric acid is the first product. "
            "The pH crashes to 4, and Cu²⁺ starts descending with the water "
            "table. This is the enrichment pulse — primary ore above is "
            "dissolving, concentrating its copper at the redox interface "
            "below.")


def event_bisbee_enrichment_blanket(conditions: VugConditions) -> str:
    """Descending Cu2+ hits the reducing front beneath the water table.
    Chalcocite and covellite mantle the remaining primary sulfides — the
    high-grade supergene enrichment zone."""
    conditions.temperature = 30
    conditions.fluid.Cu += 80         # still descending from above
    conditions.fluid.S += 40
    conditions.fluid.O2 = 0.6         # right at the redox front
    conditions.fluid.pH = 4.5
    conditions.flow_rate = 1.3
    return ("The descending Cu²⁺-bearing fluid reaches the reducing layer "
            "just below the water table. Chalcocite replaces chalcopyrite "
            "atom-for-atom — the Bisbee enrichment blanket, 5–10× the "
            "primary grade. Covellite forms where S activity is highest. "
            "This is the mineable ore. For two generations of miners, this "
            "is what Bisbee MEANS.")


def event_bisbee_reducing_pulse(conditions: VugConditions) -> str:
    """Brief reducing pulse — barren deep fluid displaces the sulfate-rich
    enrichment brine. Eh drops below cuprite stability and native copper
    precipitates as arborescent sheets in fracture fillings."""
    conditions.fluid.O2 = 0.05         # strongly reducing
    conditions.fluid.S = 15             # sulfate almost entirely flushed
    conditions.fluid.Cu += 150          # Cu²⁺ surges from above
    conditions.fluid.pH = 6.0
    conditions.temperature = 28
    conditions.flow_rate = 1.1
    return ("A barren reducing fluid pulses up from depth — lower than "
            "any water table. For a few thousand years the pocket's Eh "
            "is below cuprite stability. Native copper precipitates in "
            "the fracture selvages as arborescent sheets and wire. The "
            "Bisbee native-copper specimens — the Cornish-style copper "
            "trees — are products of exactly these brief windows.")


def event_bisbee_oxidation_zone(conditions: VugConditions) -> str:
    """Water table drops further; system oxidizes. Cuprite mantles the
    native copper sheets — the narrow Eh band between sulfide-stable and
    fully-oxidized."""
    conditions.temperature = 25
    conditions.fluid.O2 = 1.0          # oxidizing but not fully
    conditions.fluid.pH = 6.2          # limestone buffer kicks in
    conditions.fluid.S = max(conditions.fluid.S - 60, 20)  # sulfate flushed
    conditions.fluid.Cu += 40
    conditions.fluid.Fe -= 30          # goethite locks up Fe
    conditions.fluid.CO3 += 30         # limestone dissolution starts
    conditions.flow_rate = 1.0
    return ("The water table drops another 50 meters. The enrichment "
            "blanket is now in the unsaturated zone — oxygen reaches it "
            "directly. Cuprite forms where the Eh is still low; native "
            "copper sheets grow in the fractures where reducing pockets "
            "survive. The limestone walls are finally participating — "
            "pH climbs toward neutral, and CO₃ rises with it.")


def event_bisbee_azurite_peak(conditions: VugConditions) -> str:
    """High pCO2 groundwater surges through — azurite forms in the
    limestone-hosted chambers. The Bisbee blue."""
    conditions.fluid.CO3 += 80          # pCO₂ peak, limestone actively dissolving
    conditions.fluid.Cu += 30
    conditions.fluid.O2 = 1.3
    conditions.fluid.pH = 7.0
    conditions.flow_rate = 0.9
    return ("A monsoon season — the first in many. CO₂-charged rainwater "
            "infiltrates fast, dissolves limestone aggressively, and hits "
            "the copper pocket at pH 7 with CO₃ at 110+ ppm. Azurite — "
            "deep midnight-blue monoclinic prisms and radiating rosettes "
            "— nucleates from the supersaturated brine. This phase "
            "produces the showpiece 'Bisbee Blue' specimens.")


def event_bisbee_co2_drop(conditions: VugConditions) -> str:
    """pCO2 drops as monsoon pattern shifts. Azurite becomes thermodynamically
    unstable; existing crystals begin converting to malachite (pseudomorphs).
    Fresh malachite nucleates from the released Cu + CO3."""
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - 120, 50)  # crash below azurite threshold
    conditions.fluid.O2 = 1.4
    conditions.fluid.pH = 6.8
    conditions.flow_rate = 0.7
    return ("The climate dries. Without CO₂-charged infiltration the "
            "pocket's pCO₂ falls below azurite's stability — every "
            "azurite crystal in the vug starts converting. The color "
            "shift creeps crystal-by-crystal: deep blue → green rind → "
            "green core. Vink (1986) put the crossover at log(pCO₂) ≈ "
            "−3.5 at 25 °C, right where we are. Malachite pseudomorphs "
            "after azurite are the diagnostic Bisbee specimen — frozen "
            "mid-transition.")


def event_bisbee_silica_seep(conditions: VugConditions) -> str:
    """Percolating groundwater carries dissolved SiO2 leached from the
    quartz-monzonite porphyry upslope. Chrysocolla starts forming wherever
    Cu2+ meets SiO2."""
    conditions.fluid.SiO2 += 90        # porphyry weathering delivers silica
    conditions.fluid.Cu += 20
    conditions.fluid.CO3 = max(conditions.fluid.CO3 - 30, 20)   # CO₂ still trending down
    conditions.fluid.pH = 6.5
    conditions.fluid.O2 = 1.3
    conditions.flow_rate = 0.8
    return ("A new seep arrives — from weathering of the Sacramento Hill "
            "quartz-monzonite porphyry uphill, not the limestone. It "
            "brings dissolved SiO₂ at 100+ ppm. Where this fluid meets "
            "the Cu²⁺ still in solution the cyan enamel of chrysocolla "
            "precipitates: thin films over cuprite, botryoidal crusts "
            "on native copper, and — the Bisbee centerpiece — "
            "pseudomorphs replacing the last azurite blues.")


def event_bisbee_final_drying(conditions: VugConditions) -> str:
    """Flow stops. System seals."""
    conditions.temperature = 20
    conditions.flow_rate = 0.1
    conditions.fluid.O2 = 1.0
    return ("The fractures seal with calcite cement. Groundwater stops. "
            "The pocket is a closed system again, this time with the "
            "full oxidation assemblage frozen in place: chalcopyrite "
            "cores wrapped in chalcocite, those wrapped in cuprite, "
            "those overgrown by native copper, those overgrown by "
            "azurite, those converted to malachite, those pseudomorphed "
            "by chrysocolla. A million years from now, when a mining "
            "shaft intersects this pocket, an assayer will photograph "
            "the specimen and write 'Bisbee, Cochise County' on the "
            "label.")


# --- sabkha_dolomitization (Coorong/Persian Gulf cycling brine, Kim 2023 mechanism) ---
#
# The original scenario used factory functions `make_flood(idx)` and
# `make_evap(idx)` to generate 12 cycles of flood + evap closures, each
# with the cycle number baked into a narrator f-string. We follow the
# supergene_acidification precedent: one handler per phase, referenced
# by 12 Event entries each. The cycle number is preserved via the event
# `name` field ("Tidal Flood #1", "Evaporation #1", etc.) — the
# redundant "#{idx}" inside the narrator string is dropped.

def event_sabkha_flood(conditions: VugConditions) -> str:
    """Tidal flood — incoming low-alkalinity seawater RESETS chemistry.

    Each cycle resets to a defined low-σ state, modeling continuous
    tidal pumping (otherwise progressive aragonite/gypsum precipitation
    would drift the brine out of any defined regime within a few cycles).
    Flood state: marine baseline with depressed CO3 (river input), mid
    Mg/Ca, alkaline pH but kinetically below dolomite saturation.
    """
    conditions.fluid.Mg = 800     # marine baseline
    conditions.fluid.Ca = 250     # marine + bivalve dissolution
    conditions.fluid.CO3 = 50     # depressed by freshwater mixing
    conditions.fluid.Sr = 12
    conditions.fluid.pH = 8.0
    conditions.flow_rate = 1.5
    return ("Flood pulse: low-alkalinity tidal seawater enters "
            "the lagoon. CO₃ crashes from sabkha brine levels back to "
            "~50 ppm. Dolomite supersaturation drops below 1 — the "
            "disordered Ca/Mg surface layer detaches preferentially "
            "(Kim 2023 etch).")


def event_sabkha_evap(conditions: VugConditions) -> str:
    """Evaporation — sun concentrates the lagoon back to sabkha brine.

    Set values are high enough that aragonite/selenite consumption
    between events doesn't drag dolomite back below saturation —
    the alkalinity reservoir from microbial mats is generous.
    """
    conditions.fluid.Mg = 2000    # >5x seawater Mg (modern Coorong+)
    conditions.fluid.Ca = 600     # marine + microbial-mat dissolution
    conditions.fluid.CO3 = 800    # microbial mat alkalinity (high)
    conditions.fluid.Sr = 30
    conditions.fluid.pH = 8.4
    conditions.flow_rate = 0.1
    conditions.temperature = 28
    return ("Evaporation pulse: sun bakes the lagoon. Brine "
            "reconcentrates to sabkha state — Mg=2000, Ca=600, CO₃=800. "
            "Dolomite saturation climbs back well above 1; growth "
            "resumes on the ordered template the previous etch left "
            "behind. Cycle complete; ordering ratchets up.")


def event_sabkha_final_seal(conditions: VugConditions) -> str:
    """Lagoon dries up permanently — system seals."""
    conditions.flow_rate = 0.05
    conditions.temperature = 22
    return ("Sabkha matures, then seals. The crust hardens and "
            "groundwater stops cycling. What remains is the result of "
            "twelve dissolution-precipitation cycles — ordered dolomite "
            "where the cycling did its work, disordered HMC where it didn't. "
            "The Coorong recipe for ambient-T ordered dolomite, the natural "
            "laboratory that Kim 2023 finally explained at the atomic scale.")


# ============================================================
# EVENT REGISTRY
# ============================================================
# Maps the event-type string used in data/scenarios.json5 to the
# module-level event handler function. Adding a new event handler
# requires registering it here AND in the JS-side EVENT_REGISTRY in
# index.html. tools/sync-spec.js extends to verify both registries
# cover every type referenced in the JSON5 file.

EVENT_REGISTRY = {
    "fluid_pulse": event_fluid_pulse,
    "cooling_pulse": event_cooling_pulse,
    "tectonic_shock": event_tectonic_shock,
    "copper_injection": event_copper_injection,
    "oxidation": event_oxidation,
    "acidify": event_acidify,
    "alkalinize": event_alkalinize,
    "molybdenum_pulse": event_molybdenum_pulse,
    "fluid_mixing": event_fluid_mixing,
    # Phase 2 — marble_contact_metamorphism
    "marble_peak_metamorphism": event_marble_peak_metamorphism,
    "marble_retrograde_cooling": event_marble_retrograde_cooling,
    "marble_fracture_seal": event_marble_fracture_seal,
    # Phase 2 — reactive_wall
    "reactive_wall_acid_pulse_1": event_reactive_wall_acid_pulse_1,
    "reactive_wall_acid_pulse_2": event_reactive_wall_acid_pulse_2,
    "reactive_wall_acid_pulse_3": event_reactive_wall_acid_pulse_3,
    "reactive_wall_seal": event_reactive_wall_seal,
    # Phase 2 — radioactive_pegmatite
    "radioactive_pegmatite_crystallization": event_radioactive_pegmatite_crystallization,
    "radioactive_pegmatite_deep_time": event_radioactive_pegmatite_deep_time,
    "radioactive_pegmatite_oxidizing": event_radioactive_pegmatite_oxidizing,
    "radioactive_pegmatite_final_cooling": event_radioactive_pegmatite_final_cooling,
    # Phase 2 — deccan_zeolite
    "deccan_zeolite_silica_veneer": event_deccan_zeolite_silica_veneer,
    "deccan_zeolite_hematite_pulse": event_deccan_zeolite_hematite_pulse,
    "deccan_zeolite_stage_ii": event_deccan_zeolite_stage_ii,
    "deccan_zeolite_apophyllite_stage_iii": event_deccan_zeolite_apophyllite_stage_iii,
    "deccan_zeolite_late_cooling": event_deccan_zeolite_late_cooling,
    # Phase 2 — ouro_preto
    "ouro_preto_vein_opening": event_ouro_preto_vein_opening,
    "ouro_preto_f_pulse": event_ouro_preto_f_pulse,
    "ouro_preto_cr_leach": event_ouro_preto_cr_leach,
    "ouro_preto_steady_cooling": event_ouro_preto_steady_cooling,
    "ouro_preto_late_hydrothermal": event_ouro_preto_late_hydrothermal,
    "ouro_preto_oxidation_stain": event_ouro_preto_oxidation_stain,
    "ouro_preto_final_cooling": event_ouro_preto_final_cooling,
    # Phase 2 — gem_pegmatite
    "gem_pegmatite_outer_shell": event_gem_pegmatite_outer_shell,
    "gem_pegmatite_first_schorl": event_gem_pegmatite_first_schorl,
    "gem_pegmatite_albitization": event_gem_pegmatite_albitization,
    "gem_pegmatite_be_saturation": event_gem_pegmatite_be_saturation,
    "gem_pegmatite_li_phase": event_gem_pegmatite_li_phase,
    "gem_pegmatite_late_hydrothermal": event_gem_pegmatite_late_hydrothermal,
    "gem_pegmatite_clay_softening": event_gem_pegmatite_clay_softening,
    "gem_pegmatite_final": event_gem_pegmatite_final,
    # Phase 2 — supergene_oxidation. Note: 'supergene_acidification' is
    # referenced 4× in the JSON5 spec (steps 5/8/12/16) — one handler,
    # multiple Event entries pointing to it.
    "supergene_acidification": event_supergene_acidification,
    "supergene_meteoric_flush": event_supergene_meteoric_flush,
    "supergene_pb_mo_pulse": event_supergene_pb_mo_pulse,
    "supergene_cu_enrichment": event_supergene_cu_enrichment,
    "supergene_dry_spell": event_supergene_dry_spell,
    "supergene_as_rich_seep": event_supergene_as_rich_seep,
    "supergene_phosphate_seep": event_supergene_phosphate_seep,
    "supergene_v_bearing_seep": event_supergene_v_bearing_seep,
    "supergene_fracture_seal": event_supergene_fracture_seal,
    # Phase 2 — bisbee
    "bisbee_primary_cooling": event_bisbee_primary_cooling,
    "bisbee_uplift_weathering": event_bisbee_uplift_weathering,
    "bisbee_enrichment_blanket": event_bisbee_enrichment_blanket,
    "bisbee_reducing_pulse": event_bisbee_reducing_pulse,
    "bisbee_oxidation_zone": event_bisbee_oxidation_zone,
    "bisbee_azurite_peak": event_bisbee_azurite_peak,
    "bisbee_co2_drop": event_bisbee_co2_drop,
    "bisbee_silica_seep": event_bisbee_silica_seep,
    "bisbee_final_drying": event_bisbee_final_drying,
    # Phase 2 — sabkha_dolomitization. flood + evap fire 12× each
    # (steps 10/30/50/.../230 + 20/40/60/.../240) for the Kim 2023
    # ordered-dolomite cycling mechanism. Same handler-reuse precedent
    # as supergene_acidification.
    "sabkha_flood": event_sabkha_flood,
    "sabkha_evap": event_sabkha_evap,
    "sabkha_final_seal": event_sabkha_final_seal,
    # Round 9e mechanic-coverage scenarios (May 2026):
    "schneeberg_pegmatite_crystallization": event_schneeberg_pegmatite_crystallization,
    "schneeberg_cooling": event_schneeberg_cooling,
    "schneeberg_cu_p_phase": event_schneeberg_cu_p_phase,
    "schneeberg_cu_as_pulse": event_schneeberg_cu_as_pulse,
    "schneeberg_cu_depletion": event_schneeberg_cu_depletion,
    "schneeberg_as_pulse_late": event_schneeberg_as_pulse_late,
    "colorado_plateau_groundwater_pulse": event_colorado_plateau_groundwater_pulse,
    "colorado_plateau_roll_front_contact": event_colorado_plateau_roll_front_contact,
    "colorado_plateau_k_pulse": event_colorado_plateau_k_pulse,
    "colorado_plateau_ca_recovery": event_colorado_plateau_ca_recovery,
    "colorado_plateau_arid_stabilization": event_colorado_plateau_arid_stabilization,
    # Tutorials (May 2026) — see proposals/TUTORIAL-SYSTEM-BUILDER-REVIEW.md.
    # Surfaced in the New Game Menu under "Tutorials"; structurally these
    # are scenarios with simple, pedagogically-paced events.
    "tutorial_temperature_drop": event_tutorial_temperature_drop,
    "tutorial_mn_pulse": event_tutorial_mn_pulse,
    "tutorial_fe_drop": event_tutorial_fe_drop,
}


# ============================================================
# SCENARIO LOADER (data/scenarios.json5 → scenario callables)
# ============================================================
# Per proposals/TASK-BRIEF-DATA-AS-TRUTH.md item 1, Option A.
# Initial fluid + T + P + wall config + event timelines are
# declared in data/scenarios.json5; event handler bodies stay
# as code (above, in EVENT_REGISTRY). This loader builds a
# scenario callable for each JSON entry that returns the same
# (VugConditions, [Event...], duration_steps) tuple shape the
# old hand-written scenario functions did.
#
# scenario_random opts out — it's procedural / RNG-driven and
# stays as code below.
#
# Phase 1 (this commit): cooling/pulse/mvt/porphyry — the four
# scenarios that used only module-level event handlers.
# Phase 2 (deferred): the nine remaining scenarios with inline
# event closures, which need their closures promoted to
# module-level handlers before they can be migrated.

def _build_scenario_from_spec(scenario_id, spec):
    """Return a callable that produces (VugConditions, events, duration)
    matching the legacy scenario_* function signature, built from a
    JSON5 spec dict."""
    initial = spec.get("initial", {})
    temperature = float(initial.get("temperature_C", 350.0))
    pressure = float(initial.get("pressure_kbar", 1.0))
    fluid_kwargs = dict(initial.get("fluid", {}))
    wall_kwargs = dict(initial.get("wall", {}))
    duration = int(spec.get("duration_steps", 100))
    event_specs = list(spec.get("events", []))

    # Validate every referenced event type is registered. Better to
    # fail loudly at module import than silently at first use.
    for ev in event_specs:
        et = ev.get("type")
        if et not in EVENT_REGISTRY:
            raise RuntimeError(
                f"scenarios.json5 scenario '{scenario_id}' references unknown event type "
                f"'{et}' — register it in EVENT_REGISTRY (vugg.py) + the JS mirror "
                f"(index.html), or fix the spec entry."
            )

    def scenario_callable():
        conditions = VugConditions(
            temperature=temperature,
            pressure=pressure,
            fluid=FluidChemistry(**fluid_kwargs),
            wall=VugWall(**wall_kwargs),
        )
        events = [
            Event(
                int(ev["step"]),
                ev.get("name", ev.get("type", "")),
                ev.get("description", ""),
                EVENT_REGISTRY[ev["type"]],
            )
            for ev in event_specs
        ]
        return conditions, events, duration

    scenario_callable.__name__ = f"scenario_{scenario_id}"
    scenario_callable.__doc__ = spec.get("description", "")
    scenario_callable._json5_spec = spec  # for narrators/inspection
    return scenario_callable


def _load_scenarios_json5():
    """Read data/scenarios.json5 and return {scenario_id: callable}.

    Falls back to an empty dict if json5 isn't installed or the file
    is missing — the legacy in-code scenarios still ship in that case.
    """
    try:
        import json5
    except ImportError:
        # json5 not installed; legacy code-defined scenarios still work.
        # tests/conftest.py or CI should ensure json5 is available.
        return {}
    spec_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "data", "scenarios.json5")
    if not os.path.exists(spec_path):
        return {}
    with open(spec_path, encoding="utf-8") as f:
        doc = json5.load(f)
    out = {}
    for scenario_id, spec in (doc.get("scenarios") or {}).items():
        out[scenario_id] = _build_scenario_from_spec(scenario_id, spec)
    return out


_JSON5_SCENARIOS = _load_scenarios_json5()


# ============================================================
# SCENARIOS
# ============================================================

# All declarative scenarios live in data/scenarios.json5 (loaded at
# module init by _load_scenarios_json5() above) and reference event
# handlers from EVENT_REGISTRY by string identifier. Only scenario_random
# stays in-code below — it's procedural / RNG-driven generative.
# Phase 1 (commit 2feb338): cooling/pulse/mvt/porphyry.
# Phase 2 (this commit chain): the remaining 9 scenarios, with their
# inline event closures promoted to module-level handlers above.



def scenario_random() -> Tuple[VugConditions, List[Event], int]:
    """Procedurally-generated vugg — each run a different discovery.

    Picks a random geological archetype, then generates realistic but
    randomized fluid chemistry within it. The narrative layer treats the
    resulting specimen like a collector's tag: where it likely came from,
    what the dominant paragenesis is, what trace elements hint at.

    Archetypes:
      hydrothermal   — moderate-T vein, mixed metal sulfides
      pegmatite      — high-T granite pocket, K/Na/Al/SiO₂ + rare elements
      supergene      — low-T oxidation zone, Pb/Zn/Cu secondaries
      mvt            — Mississippi Valley-type carbonate-hosted brine
      porphyry       — magmatic-hydrothermal Cu-Fe-Mo sulfides
      evaporite      — cool Ca-SO₄-rich water-table crust
      mixed          — two generations of fluid, overprinted
    """
    archetypes = ["hydrothermal", "pegmatite", "supergene", "mvt",
                  "porphyry", "evaporite", "mixed"]
    archetype = random.choice(archetypes)

    # Trace garnish — elements the engine tracks but no mineral currently
    # consumes. Sprinkled into most archetypes so the narrator has hints
    # about "what the fluid almost did." Each is optional, per-archetype.
    def sprinkle_traces(fluid, pool):
        for elem, prob, rng in pool:
            if random.random() < prob:
                setattr(fluid, elem, random.uniform(*rng))

    if archetype == "hydrothermal":
        T = random.uniform(220, 380)
        fluid = FluidChemistry(
            SiO2=random.uniform(350, 850),
            Ca=random.uniform(60, 240),
            CO3=random.uniform(40, 180),
            Fe=random.uniform(8, 45),
            Mn=random.uniform(1, 10),
            Al=random.uniform(2, 6),
            Ti=random.uniform(0.3, 1.2),
            Zn=random.uniform(0, 80) if random.random() < 0.5 else 0.0,
            S=random.uniform(30, 90) if random.random() < 0.6 else 0.0,
            Cu=random.uniform(0, 50) if random.random() < 0.4 else 0.0,
            Pb=random.uniform(0, 35) if random.random() < 0.4 else 0.0,
            F=random.uniform(4, 20),
            pH=random.uniform(5.5, 7.2),
            O2=random.uniform(0, 0.6),
        )
        sprinkle_traces(fluid, [
            ("Ba", 0.30, (5, 40)),     # barite-hint
            ("Sr", 0.25, (3, 25)),     # celestine-hint
            ("Ag", 0.20, (0.5, 8)),    # argentiferous hint
            ("Sb", 0.15, (1, 10)),
        ])
        events = [Event(random.randint(40, 60), "Fluid Pulse", "Fresh hydrothermal fluid", event_fluid_pulse)]
        steps = random.randint(100, 140)

    elif archetype == "pegmatite":
        T = random.uniform(520, 780)
        fluid = FluidChemistry(
            SiO2=random.uniform(4000, 14000),
            Ca=random.uniform(20, 100),
            CO3=random.uniform(5, 40),
            K=random.uniform(50, 130),
            Na=random.uniform(35, 90),
            Al=random.uniform(20, 50),
            Fe=random.uniform(20, 80),
            Mn=random.uniform(3, 15),
            F=random.uniform(10, 40),
            Pb=random.uniform(5, 35) if random.random() < 0.4 else 0.0,
            U=random.uniform(30, 180) if random.random() < 0.35 else 0.0,
            pH=random.uniform(6.0, 7.5),
            O2=random.uniform(0, 0.2),
        )
        sprinkle_traces(fluid, [
            ("Be", 0.40, (5, 40)),     # beryl country
            ("Li", 0.40, (10, 80)),    # spodumene/lepidolite
            ("B",  0.35, (5, 50)),     # tourmaline-hint
            ("Cs", 0.10, (1, 10)),     # pollucite? not tracked, but could be
            ("P",  0.20, (2, 15)),
        ])
        events = [
            Event(random.randint(25, 40), "Crystallization", "Melt differentiates",
                  lambda c: (setattr(c, "temperature", max(c.temperature - 120, 350)),
                             setattr(c.fluid, "SiO2", c.fluid.SiO2 + 2500))[0] or
                             "Pegmatite melt differentiates; volatile-rich residual fluid floods the pocket."),
        ]
        steps = random.randint(120, 180)

    elif archetype == "supergene":
        T = random.uniform(18, 55)
        fluid = FluidChemistry(
            SiO2=random.uniform(20, 80),
            Ca=random.uniform(80, 200),
            CO3=random.uniform(60, 200),
            Fe=random.uniform(20, 60),
            Mn=random.uniform(2, 12),
            Zn=random.uniform(40, 140) if random.random() < 0.7 else 0.0,
            S=random.uniform(20, 70),
            Cu=random.uniform(10, 60) if random.random() < 0.6 else 0.0,
            Pb=random.uniform(15, 60) if random.random() < 0.6 else 0.0,
            Mo=random.uniform(5, 25) if random.random() < 0.4 else 0.0,
            As=random.uniform(3, 18) if random.random() < 0.5 else 0.0,
            Cl=random.uniform(5, 30),
            F=random.uniform(1, 8),
            O2=random.uniform(1.5, 2.3),
            pH=random.uniform(5.8, 7.2),
        )
        sprinkle_traces(fluid, [
            ("V",  0.20, (1, 10)),     # vanadinite country
            ("Cr", 0.15, (0.5, 6)),    # redgo wulfenite color
            ("Co", 0.15, (0.5, 5)),    # pink smithsonite
            ("Cd", 0.10, (0.2, 3)),    # yellow sphalerite/smithsonite
        ])
        events = []
        steps = random.randint(140, 200)

    elif archetype == "mvt":
        T = random.uniform(90, 170)
        fluid = FluidChemistry(
            SiO2=random.uniform(60, 180),
            Ca=random.uniform(250, 450),
            CO3=random.uniform(150, 280),
            Fe=random.uniform(15, 45),
            Mn=random.uniform(4, 12),
            Zn=random.uniform(100, 200),
            S=random.uniform(80, 150),
            Pb=random.uniform(20, 60),
            F=random.uniform(25, 55),
            pH=random.uniform(5.5, 7.0),
            O2=random.uniform(0, 0.4),
            salinity=random.uniform(15, 22),
        )
        sprinkle_traces(fluid, [
            ("Ba", 0.45, (15, 60)),    # barite in MVT is classic
            ("Ag", 0.25, (1, 8)),      # argentiferous galena
            ("Cd", 0.30, (0.5, 4)),    # honey sphalerite
        ])
        events = [Event(random.randint(20, 35), "Fluid Mixing", "Brine meets groundwater", event_fluid_mixing)]
        steps = random.randint(100, 150)

    elif archetype == "porphyry":
        T = random.uniform(350, 520)
        fluid = FluidChemistry(
            SiO2=random.uniform(500, 900),
            Ca=random.uniform(50, 150),
            CO3=random.uniform(30, 80),
            Fe=random.uniform(30, 80),
            Mn=random.uniform(1, 6),
            S=random.uniform(50, 120),
            Cu=random.uniform(60, 180),
            Mo=random.uniform(10, 60) if random.random() < 0.7 else 0.0,
            Pb=random.uniform(10, 40),
            F=random.uniform(2, 12),
            O2=random.uniform(0, 0.3),
            pH=random.uniform(4.5, 6.2),
        )
        sprinkle_traces(fluid, [
            ("Ag", 0.30, (1, 8)),
            ("Au", 0.15, (0.1, 2)),    # gold in porphyry — rare but classic
            ("Bi", 0.20, (0.5, 5)),
            ("W",  0.15, (0.5, 6)),    # scheelite-adjacent
        ])
        events = [Event(random.randint(40, 70), "Late Cu Pulse", "Magmatic copper surge", event_copper_injection)]
        steps = random.randint(120, 160)

    elif archetype == "evaporite":
        T = random.uniform(25, 58)  # below gypsum → anhydrite transition
        fluid = FluidChemistry(
            SiO2=random.uniform(15, 60),
            Ca=random.uniform(180, 350),
            CO3=random.uniform(40, 120),
            Fe=random.uniform(2, 20),
            Mn=random.uniform(0.5, 4),
            S=random.uniform(90, 180),
            O2=random.uniform(0.8, 1.8),
            pH=random.uniform(6.8, 7.8),
            salinity=random.uniform(5, 14),
        )
        sprinkle_traces(fluid, [
            ("Sr", 0.45, (10, 50)),    # celestine in evaporites
            ("Mg", 0.50, (20, 80)),    # dolomite/epsomite hint
            ("Cl", 0.55, (15, 60)),    # halite-adjacent
        ])
        events = []
        steps = random.randint(160, 220)

    else:  # mixed — two-generation vugg
        T = random.uniform(280, 420)
        fluid = FluidChemistry(
            SiO2=random.uniform(400, 700),
            Ca=random.uniform(100, 250),
            CO3=random.uniform(50, 180),
            Fe=random.uniform(20, 60),
            Mn=random.uniform(3, 12),
            Zn=random.uniform(40, 120),
            S=random.uniform(50, 120),
            Cu=random.uniform(20, 80) if random.random() < 0.5 else 0.0,
            Pb=random.uniform(15, 50),
            F=random.uniform(8, 25),
            pH=random.uniform(5.5, 7.0),
            O2=random.uniform(0, 0.4),
        )
        sprinkle_traces(fluid, [
            ("Ba", 0.30, (5, 40)),
            ("Sr", 0.20, (3, 20)),
            ("As", 0.30, (3, 15)),
            ("Ag", 0.20, (0.5, 5)),
        ])
        # Two-stage: primary sulfides, then late oxidation pulse.
        events = [
            Event(random.randint(30, 50), "Primary Pulse", "Metal-bearing fluid",
                  event_fluid_pulse),
            Event(random.randint(80, 110), "Oxidizing Overprint", "Meteoric water incursion",
                  event_oxidation),
        ]
        steps = random.randint(160, 220)

    # Phase-1 void shape: map the archetype to two-stage bubble counts.
    # Shape seed is a fresh random so each run of "random" looks
    # different. Fewer secondaries = more cohesive cavity; more
    # secondaries = more satellite alcoves.
    _archetype_shape = {
        # archetype:     (primary_bubbles, secondary_bubbles)
        "hydrothermal": (3, 6),
        "pegmatite":    (4, 5),
        "supergene":    (3, 7),
        "mvt":          (3, 8),
        "porphyry":     (3, 6),
        "evaporite":    (2, 3),
        "mixed":        (3, 6),
    }
    _pb, _sb = _archetype_shape.get(archetype, (3, 6))
    _rand_wall = VugWall(
        primary_bubbles=_pb,
        secondary_bubbles=_sb,
        shape_seed=random.randint(1, 2 ** 30),
    )
    conditions = VugConditions(
        temperature=T,
        pressure=random.uniform(0.3, 2.0),
        fluid=fluid,
        wall=_rand_wall,
    )
    # Side-channel for the narrator to read after simulation.
    conditions._random_archetype = archetype
    return conditions, events, steps


SCENARIOS = {
    # All declarative scenarios load from data/scenarios.json5 via
    # _load_scenarios_json5(). Each value is a callable returning
    # (VugConditions, [Event...], duration_steps).
    # Phase 1 (commit 2feb338, 2026-04-30): cooling/pulse/mvt/porphyry.
    # Phase 2 (this commit chain, 2026-04-30): the remaining 9 scenarios,
    # with the inline event closures promoted to module-level handlers
    # registered in EVENT_REGISTRY above.
    "cooling": _JSON5_SCENARIOS["cooling"],
    "pulse": _JSON5_SCENARIOS["pulse"],
    "mvt": _JSON5_SCENARIOS["mvt"],
    "porphyry": _JSON5_SCENARIOS["porphyry"],
    "reactive_wall": _JSON5_SCENARIOS["reactive_wall"],
    "radioactive_pegmatite": _JSON5_SCENARIOS["radioactive_pegmatite"],
    "supergene_oxidation": _JSON5_SCENARIOS["supergene_oxidation"],
    "ouro_preto": _JSON5_SCENARIOS["ouro_preto"],
    "gem_pegmatite": _JSON5_SCENARIOS["gem_pegmatite"],
    "bisbee": _JSON5_SCENARIOS["bisbee"],
    "deccan_zeolite": _JSON5_SCENARIOS["deccan_zeolite"],
    "sabkha_dolomitization": _JSON5_SCENARIOS["sabkha_dolomitization"],
    "marble_contact_metamorphism": _JSON5_SCENARIOS["marble_contact_metamorphism"],
    # Round 9e mechanic-coverage scenarios (May 2026):
    "schneeberg": _JSON5_SCENARIOS["schneeberg"],
    "colorado_plateau": _JSON5_SCENARIOS["colorado_plateau"],
    # Tutorials (May 2026) — surfaced in New Game Menu under "Tutorials".
    # See proposals/TUTORIAL-SYSTEM-BUILDER-REVIEW.md.
    "tutorial_first_crystal": _JSON5_SCENARIOS["tutorial_first_crystal"],
    "tutorial_mn_calcite": _JSON5_SCENARIOS["tutorial_mn_calcite"],
    # scenario_random opts out — procedural / RNG-driven, stays as code.
    "random": scenario_random,
}


# ============================================================
# SIMULATION ENGINE
# ============================================================

class VugSimulator:
    """The main simulation engine."""
    
    def __init__(self, conditions: VugConditions, events: List[Event] = None):
        self.conditions = conditions
        self.events = sorted(events or [], key=lambda e: e.step)
        self.crystals: List[Crystal] = []
        self.crystal_counter = 0
        self.step = 0
        self.log: List[str] = []
        # Unwrapped topo-map state. v1 uses ring[0] only; the multi-ring
        # structure is there so the future 3D view can slice depth without
        # reshaping the storage. `initial_radius_mm` freezes the pre-run
        # starting point so later per-cell wall_depth readings are
        # interpretable as "how much this slice of wall has retreated."
        self.wall_state = WallState(
            vug_diameter_mm=conditions.wall.vug_diameter_mm,
            initial_radius_mm=conditions.wall.vug_diameter_mm / 2.0,
            # Phase-1 two-stage bubble-merge void shape. Scenarios set
            # these on VugWall; defaults (3 primary, 6 secondary) give
            # a cohesive main cavity with satellite alcoves so scenarios
            # that don't opt in still get an organic dissolution profile.
            primary_bubbles=conditions.wall.primary_bubbles,
            secondary_bubbles=conditions.wall.secondary_bubbles,
            shape_seed=conditions.wall.shape_seed,
        )

        # Phase C of PROPOSAL-3D-SIMULATION: per-ring fluid + temperature.
        # Phase C v1 hooks up: each ring carries its own FluidChemistry,
        # the growth loop swaps conditions.fluid to ring_fluids[k] for
        # the duration of an engine call, and diffusion at end of step
        # equilibrates them. The "equator" ring (index ring_count//2)
        # is aliased to conditions.fluid so events that mutate
        # conditions.fluid (apply_events, dissolve_wall, etc.) propagate
        # naturally to the equator ring's slot in ring_fluids — and
        # diffusion then spreads them outward to floor and ceiling
        # rings over time.
        n_rings = self.wall_state.ring_count
        equator = n_rings // 2
        self.ring_fluids: List[FluidChemistry] = [
            replace(self.conditions.fluid) for _ in range(n_rings)
        ]
        # Make the equator ring share storage with conditions.fluid.
        # Mutations to either propagate to the other.
        self.ring_fluids[equator] = self.conditions.fluid
        self.ring_temperatures: List[float] = [self.conditions.temperature] * n_rings
        self.inter_ring_diffusion_rate: float = DEFAULT_INTER_RING_DIFFUSION_RATE
        # Cache the FluidChemistry numeric fields once — used by the
        # diffusion loop to walk every component without paying for the
        # dataclasses.fields() call on each step.
        self._fluid_field_names: Tuple[str, ...] = tuple(
            f.name for f in fields(FluidChemistry)
        )

    def _snapshot_global(self) -> Tuple['FluidChemistry', float]:
        """Phase C v1: capture conditions.fluid + temperature before a
        block of code that mutates them globally (events, wall
        dissolution, ambient cooling). Pair with
        _propagate_global_delta to push the same change to all
        non-equator rings — the equator ring is aliased to
        conditions.fluid so it already reflects the new value."""
        return (replace(self.conditions.fluid), self.conditions.temperature)

    def _propagate_global_delta(self, snapshot) -> None:
        """Apply the delta between current conditions and `snapshot` to
        all non-equator ring_fluids and ring_temperatures. Used after
        events / dissolve / cooling so a single global pulse reaches
        every ring (otherwise per-ring growth would consume from rings
        that never saw the event, and minerals dependent on the pulse
        would stop nucleating)."""
        pre_fluid, pre_temp = snapshot
        equator = self.wall_state.ring_count // 2
        equator_fluid = self.ring_fluids[equator]  # = conditions.fluid (aliased)
        for fname in self._fluid_field_names:
            delta = (getattr(self.conditions.fluid, fname)
                     - getattr(pre_fluid, fname))
            if delta == 0.0:
                continue
            for rf in self.ring_fluids:
                if rf is equator_fluid:
                    continue
                setattr(rf, fname, getattr(rf, fname) + delta)
        delta_t = self.conditions.temperature - pre_temp
        if delta_t != 0.0:
            for k in range(len(self.ring_temperatures)):
                if k == equator:
                    self.ring_temperatures[k] = self.conditions.temperature
                else:
                    self.ring_temperatures[k] += delta_t

    def _diffuse_ring_state(self, rate: float = None) -> None:
        """Phase C inter-ring homogenization. One discrete-Laplacian step
        per fluid component and per temperature, with Neumann (no-flux)
        boundary conditions at the floor and ceiling rings.

        For uniform rings this is a no-op (Laplacian of a constant is
        zero), which preserves byte-equality for default scenarios. For
        non-uniform rings, the gradient relaxes by `rate * (neighbor
        sum - 2*self)` per step.

        Old values are read into a snapshot before any writes so each
        ring's update sees the pre-step state of its neighbors — without
        this, ring k+1's update would already see ring k's new value
        and the diffusion would be asymmetric.
        """
        if rate is None:
            rate = self.inter_ring_diffusion_rate
        if rate <= 0:
            return
        n = len(self.ring_fluids)
        if n <= 1:
            return
        # Diffuse each fluid component independently.
        for fname in self._fluid_field_names:
            old = [getattr(rf, fname) for rf in self.ring_fluids]
            for k in range(n):
                kp = k - 1 if k > 0 else 0       # Neumann: ring -1 reuses ring 0
                kn = k + 1 if k < n - 1 else n - 1
                new_val = old[k] + rate * (old[kp] + old[kn] - 2.0 * old[k])
                setattr(self.ring_fluids[k], fname, new_val)
        # Diffuse temperature with the same scheme.
        old_t = list(self.ring_temperatures)
        for k in range(n):
            kp = k - 1 if k > 0 else 0
            kn = k + 1 if k < n - 1 else n - 1
            self.ring_temperatures[k] = old_t[k] + rate * (
                old_t[kp] + old_t[kn] - 2.0 * old_t[k]
            )

    def nucleate(self, mineral: str, position: str = "vug wall",
                 sigma: float = 1.0) -> Crystal:
        """Nucleate a new crystal. `sigma` (current supersaturation for this
        mineral) is used to pick a habit variant from data/minerals.json."""
        self.crystal_counter += 1
        crystal = Crystal(
            mineral=mineral,
            crystal_id=self.crystal_counter,
            nucleation_step=self.step,
            nucleation_temp=self.conditions.temperature,
            position=position
        )

        # Pick a growth-vector variant from the spec. The variant's name
        # overrides the legacy per-mineral habit string below when present,
        # and its wall_spread/void_reach/vector populate the topo-map
        # footprint. Falls back to legacy defaults if the spec lacks
        # variants for this mineral.
        variant = select_habit_variant(
            mineral, sigma, self.conditions.temperature,
            space_constrained=self._space_is_crowded(),
        )
        if variant:
            crystal.habit = variant.get("name", crystal.habit)
            crystal.wall_spread = float(variant.get("wall_spread", 0.5))
            crystal.void_reach = float(variant.get("void_reach", 0.5))
            crystal.vector = variant.get("vector", "equant")

        # Anchor on the wall. Crystals that nucleated on another crystal
        # (position string like "on pyrite #3") inherit the host's cell
        # AND ring so they paint over/next to it. Everything else gets a
        # fresh random cell + a random ring (Phase C v1: scatter across
        # the sphere wall). Phase D will weight ring choice by orientation
        # so ceiling habits prefer the upper rings, floor habits the lower.
        crystal.wall_ring_index = self._assign_wall_ring(position)
        crystal.wall_center_cell = self._assign_wall_cell(position)

        # Dominant-form strings are still per-mineral — they describe
        # crystallographic faces, not the habit variant, so the growth-vector
        # selector leaves them alone. The fallback `habit` (when the spec
        # has no variants) is the first value in each arm.
        if mineral == "quartz":
            crystal.dominant_forms = ["m{100} prism", "r{101} rhombohedron"]
        elif mineral == "calcite":
            crystal.dominant_forms = ["e{104} rhombohedron"]
        elif mineral == "aragonite":
            crystal.dominant_forms = ["columnar prisms", "{110} cyclic twin (six-pointed)"]
        elif mineral == "rhodochrosite":
            crystal.dominant_forms = ["e{104} curved 'button' rhombohedron", "rose-pink"]
        elif mineral == "siderite":
            crystal.dominant_forms = ["e{104} curved 'saddle' rhombohedron", "tan to brown"]
        elif mineral == "dolomite":
            crystal.dominant_forms = ["e{104} saddle-shaped curved rhombohedron", "white to colorless"]
        elif mineral == "sphalerite":
            crystal.dominant_forms = ["{111} tetrahedron"]
        elif mineral == "wurtzite":
            crystal.dominant_forms = ["hemimorphic hexagonal pyramid", "{0001} + {101̄1}"]
        elif mineral == "fluorite":
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "pyrite":
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "marcasite":
            crystal.dominant_forms = ["cockscomb aggregate", "{010} tabular crests"]
        elif mineral == "chalcopyrite":
            crystal.dominant_forms = ["{112} disphenoid"]
        elif mineral == "hematite":
            crystal.dominant_forms = ["{001} basal plates"]
        elif mineral == "malachite":
            crystal.dominant_forms = ["botryoidal masses"]
        elif mineral == "galena":
            crystal.dominant_forms = ["{100} cube"]
        elif mineral == "smithsonite":
            crystal.dominant_forms = ["botryoidal masses", "{101̅4} scalenohedra"]
        elif mineral == "wulfenite":
            crystal.dominant_forms = ["{001} thin square plates"]
        elif mineral == "selenite":
            crystal.dominant_forms = ["{010} plates", "swallow-tail twins"]
        elif mineral == "feldspar":
            crystal.dominant_forms = ["{001} cleavage", "{010} face", "Carlsbad twin"]
        elif mineral == "albite":
            crystal.dominant_forms = ["{001} cleavage", "{010} face", "albite twin"]
        elif mineral == "uraninite":
            crystal.dominant_forms = ["massive pitchy aggregates"]
        elif mineral == "goethite":
            crystal.dominant_forms = ["botryoidal masses", "velvety surface"]
        elif mineral == "molybdenite":
            crystal.dominant_forms = ["{0001} basal plates", "hexagonal outline"]
        elif mineral == "topaz":
            crystal.dominant_forms = ["m{110} prism", "y{041} pyramid", "c{001} basal cleavage"]
        elif mineral == "tourmaline":
            crystal.dominant_forms = ["m{10̄10} trigonal prism", "striated faces", "slightly rounded triangular cross-section"]
        elif mineral == "beryl":
            crystal.dominant_forms = ["m{10̄10} hex prism", "c{0001} flat basal pinacoid"]
        elif mineral == "spodumene":
            crystal.dominant_forms = ["m{110} prism", "a{100} + b{010} pinacoids", "~87° pyroxene cleavages"]
        elif mineral == "anglesite":
            crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism", "o{011} orthorhombic dome"]
        elif mineral == "cerussite":
            crystal.dominant_forms = ["b{010} pinacoid", "m{110} prism", "pseudo-hexagonal if twinned"]
        elif mineral == "pyromorphite":
            crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} pinacoid", "barrel profile"]
        elif mineral == "vanadinite":
            crystal.dominant_forms = ["{10̄10} hexagonal prism", "c{0001} pinacoid", "flat basal termination"]
        elif mineral == "erythrite":
            crystal.dominant_forms = ["earthy crimson-pink crust", "cobalt bloom"]
        elif mineral == "annabergite":
            crystal.dominant_forms = ["apple-green earthy crust", "nickel bloom"]
        elif mineral == "tetrahedrite":
            crystal.dominant_forms = ["{111} tetrahedron", "steel-gray metallic"]
        elif mineral == "tennantite":
            crystal.dominant_forms = ["{111} tetrahedron", "gray-black metallic with cherry-red transmission"]
        elif mineral == "apophyllite":
            crystal.dominant_forms = ["pseudo-cubic tabular {001} + {110}", "transparent to pearly"]
        elif mineral == "bornite":
            crystal.dominant_forms = ["massive granular", "iridescent tarnish"]
        elif mineral == "chalcocite":
            crystal.dominant_forms = ["{110} prism", "pseudo-hexagonal if twinned"]
        elif mineral == "covellite":
            crystal.dominant_forms = ["{0001} basal plate", "perfect basal cleavage"]
        elif mineral == "cuprite":
            crystal.dominant_forms = ["{111} octahedron", "dark red with ruby internal reflections"]
        elif mineral == "azurite":
            crystal.dominant_forms = ["monoclinic prism", "deep azure-blue"]
        elif mineral == "chrysocolla":
            crystal.dominant_forms = ["botryoidal crust", "cyan-blue cryptocrystalline enamel"]
        elif mineral == "native_copper":
            crystal.dominant_forms = ["arborescent branching", "copper-red metallic"]
        elif mineral == "magnetite":
            crystal.dominant_forms = ["{111} octahedron", "black metallic, strongly magnetic"]
        elif mineral == "lepidocrocite":
            crystal.dominant_forms = ["{010} platy scales", "ruby-red micaceous"]
        elif mineral == "stibnite":
            crystal.dominant_forms = ["elongated {110} prism", "lead-gray sword-blade"]
        elif mineral == "bismuthinite":
            crystal.dominant_forms = ["acicular {110} needle", "lead-gray metallic"]
        elif mineral == "native_bismuth":
            crystal.dominant_forms = ["arborescent silver-white", "iridescent oxide tarnish"]
        elif mineral == "clinobisvanite":
            crystal.dominant_forms = ["micro-platy {010}", "bright yellow"]

        # Twin roll — once at nucleation per declared twin_laws (Round 9
        # bug fix, Apr 2026). Pre-fix, each grow_*() function rolled
        # `random.random() < probability` per growth step, so a crystal
        # with 30 zones at p=0.1 had ~92% twinning probability instead
        # of the declared 10%. Post-fix the roll happens once here per
        # twin_law, matching declared probability semantics.
        self._roll_spontaneous_twin(crystal)

        self.crystals.append(crystal)
        return crystal

    def _roll_spontaneous_twin(self, crystal: "Crystal") -> None:
        """Roll once at nucleation for each declared twin_law of the
        crystal's mineral, per its probability in MINERAL_SPEC.

        Skipped for triggers containing 'thermal_shock' or 'tectonic'
        — those remain in their grow functions as event-conditional
        logic (e.g., quartz Dauphiné from a sudden temperature drop).
        Habit-conditional triggers (e.g., aragonite cyclic_sextet
        "growth in twinned_cyclic habit") roll regardless of the
        crystal's habit; specific habit dependencies can be
        reintroduced via the trigger string parser as a follow-up
        if the boss decides specific minerals need habit gating.

        First law to fire wins; subsequent laws of the same mineral
        don't compound onto an already-twinned crystal.
        """
        if crystal.twinned:
            return
        spec = MINERAL_SPEC.get(crystal.mineral, {})
        twin_laws = spec.get("twin_laws", []) or []
        for law in twin_laws:
            if not isinstance(law, dict):
                continue
            prob = law.get("probability")
            if not isinstance(prob, (int, float)) or prob <= 0:
                continue
            trigger = (law.get("trigger") or "").lower()
            if "thermal_shock" in trigger or "tectonic" in trigger:
                continue
            if random.random() < prob:
                crystal.twinned = True
                crystal.twin_law = law.get("name", "twin")
                return

    def _space_is_crowded(self) -> bool:
        """Fraction of ring-0 cells already claimed by another crystal.
        Habit selection uses this to penalize projecting habits when the
        vug is filling up and to reward coating habits."""
        ring0 = self.wall_state.rings[0]
        if not ring0:
            return False
        occupied = sum(1 for c in ring0 if c.crystal_id is not None)
        return (occupied / len(ring0)) >= 0.5

    def _assign_wall_cell(self, position: str) -> int:
        """Pick a ring-0 cell for a nucleating crystal.

        Host-substrate crystals (position 'on <mineral> #<id>') inherit
        the host's cell so pseudomorphs / overgrowths paint in the same
        place. Everything else gets a random empty cell if one exists,
        otherwise a random cell (overlaps are fine — paint_crystal picks
        the larger occupant)."""
        host_id = None
        if " #" in position:
            try:
                host_id = int(position.rsplit("#", 1)[1].split()[0])
            except ValueError:
                host_id = None
        if host_id is not None:
            host = next((c for c in self.crystals if c.crystal_id == host_id), None)
            if host and host.wall_center_cell is not None:
                return host.wall_center_cell
        N = self.wall_state.cells_per_ring
        ring0 = self.wall_state.rings[0]
        empty = [i for i, cell in enumerate(ring0) if cell.crystal_id is None]
        return random.choice(empty) if empty else random.randrange(N)

    def _assign_wall_ring(self, position: str) -> int:
        """Pick a ring for a nucleating crystal. Host-substrate
        overgrowths inherit the host's ring so pseudomorphs land on
        the same latitude band. Free-wall nucleations get a random
        ring (Phase C v1: uniform distribution; Phase D will weight
        by orientation).

        Always consumes one RNG number for free-wall nucleations
        (even when ring_count == 1) so simulation parity holds across
        different ring counts — randrange(1) just always returns 0
        but advances the RNG identically to randrange(16)."""
        host_id = None
        if " #" in position:
            try:
                host_id = int(position.rsplit("#", 1)[1].split()[0])
            except ValueError:
                host_id = None
        if host_id is not None:
            host = next((c for c in self.crystals if c.crystal_id == host_id), None)
            if host and host.wall_ring_index is not None:
                return host.wall_ring_index
        n = max(1, self.wall_state.ring_count)
        return random.randrange(n)

    def _repaint_wall_state(self) -> None:
        """Rebuild ring-0 occupancy from the current crystal list. Runs
        once per step, after growth. Larger crystals overwrite smaller
        ones at the same cell (`paint_crystal` guards on thickness)."""
        self.wall_state.update_diameter(self.conditions.wall.vug_diameter_mm)
        self.wall_state.clear()
        # Paint smallest-first so the biggest crystals win ties — they're
        # what the viewer would actually see from outside.
        for crystal in sorted(self.crystals, key=lambda c: c.total_growth_um):
            if crystal.dissolved:
                continue
            self.wall_state.paint_crystal(crystal)

    def _wall_cells_blocked_by_crystals(self) -> set:
        """Which ring-0 cells are shielded from wall dissolution.

        A cell is shielded when it's occupied by a non-dissolved crystal
        that is stable at the current pH — either the mineral has no
        acid_dissolution rule in the spec (permanently acid-stable, e.g.
        uraninite / molybdenite) or the current pH is above its
        threshold.
        """
        ph = self.conditions.fluid.pH
        by_id = {c.crystal_id: c for c in self.crystals}
        blocked = set()
        for i, cell in enumerate(self.wall_state.rings[0]):
            if cell.crystal_id is None:
                continue
            crystal = by_id.get(cell.crystal_id)
            if not crystal or crystal.dissolved:
                continue
            acid = MINERAL_SPEC.get(crystal.mineral, {}).get('acid_dissolution')
            if acid is None:
                blocked.add(i)
                continue
            threshold = acid.get('pH_threshold')
            if threshold is None or ph >= threshold:
                blocked.add(i)
        return blocked

    def _apply_radiation_dose(self) -> None:
        """Accumulate α-damage on every quartz growth zone while any uraninite
        is still active in the vug. The damage is stored per-zone so it persists
        after the uraninite later dissolves; the crystal's final color depends
        on integrated dose across all zones (see Crystal.predict_color)."""
        # Enclosed uraninite still emits — active=False via enclosure doesn't
        # stop alpha decay. Only dissolution removes the crystal as a source
        # (the uranium went back into solution).
        uraninite_sources = [c for c in self.crystals if c.mineral == "uraninite" and not c.dissolved]
        if not uraninite_sources:
            return
        # Dose scales with number of uraninite sources present. 0.02 per source
        # per step puts ~15-25 steps of single-source exposure at the smoky
        # threshold (0.3 avg), matching the spec color_rules in minerals.json.
        dose = 0.02 * len(uraninite_sources)
        for crystal in self.crystals:
            if crystal.mineral != "quartz":
                continue
            for zone in crystal.zones:
                if zone.thickness_um > 0:
                    zone.radiation_damage += dose

    def _at_nucleation_cap(self, mineral: str) -> bool:
        """True if the mineral has reached its spec max_nucleation_count
        for crystals *still exposed on the wall* — enclosed and
        dissolved crystals don't count toward the cap because the
        surface they held is effectively gone (buried by the host, or
        etched away).

        This is what lets a classic MVT calcite accumulate dense
        chalcopyrite inclusion trails: the sulfide nucleates, grows a
        little, gets enveloped, and fresh bare wall from the host's
        advancing front becomes available for another sulfide to
        nucleate. Real specimens can carry hundreds of inclusions."""
        cap = MINERAL_SPEC.get(mineral, {}).get("max_nucleation_count")
        if cap is None:
            return False
        n = 0
        for c in self.crystals:
            if c.mineral != mineral:
                continue
            if c.enclosed_by is not None or c.dissolved:
                continue
            n += 1
            if n >= cap:
                return True
        return False

    def check_nucleation(self):
        """Check if new crystals should nucleate."""
        # Quartz nucleation
        sigma_q = self.conditions.supersaturation_quartz()
        existing_quartz = [c for c in self.crystals if c.mineral == "quartz" and c.active]
        if sigma_q > 1.2 and not self._at_nucleation_cap("quartz"):
            if not existing_quartz or (sigma_q > 2.0 and random.random() < 0.3):
                c = self.nucleate("quartz", sigma=sigma_q)
                self.log.append(f"  ✦ NUCLEATION: Quartz #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_q:.2f})")
        
        # Calcite nucleation
        sigma_c = self.conditions.supersaturation_calcite()
        existing_calcite = [c for c in self.crystals if c.mineral == "calcite" and c.active]
        if sigma_c > 1.3 and not existing_calcite and not self._at_nucleation_cap("calcite"):
            c = self.nucleate("calcite", sigma=sigma_c)
            self.log.append(f"  ✦ NUCLEATION: Calcite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_c:.2f})")

        # Aragonite nucleation — Mg/Ca + T + Ω + trace Sr/Pb/Ba favorability.
        # Polymorph competition with calcite: when Mg poisons calcite's growth
        # steps OR T is high OR Ω is high, aragonite nucleates instead.
        sigma_arag = self.conditions.supersaturation_aragonite()
        existing_arag = [c for c in self.crystals if c.mineral == "aragonite" and c.active]
        if sigma_arag > 1.0 and not existing_arag and not self._at_nucleation_cap("aragonite"):
            pos = "vug wall"
            # Aragonite often nucleates in fissures or on existing iron oxide
            existing_goe_a = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            existing_hem_a = [c for c in self.crystals if c.mineral == "hematite" and c.active]
            if existing_goe_a and random.random() < 0.4:
                pos = f"on goethite #{existing_goe_a[0].crystal_id}"
            elif existing_hem_a and random.random() < 0.3:
                pos = f"on hematite #{existing_hem_a[0].crystal_id}"
            mg_ratio = self.conditions.fluid.Mg / max(self.conditions.fluid.Ca, 0.01)
            c = self.nucleate("aragonite", position=pos, sigma=sigma_arag)
            self.log.append(f"  ✦ NUCLEATION: Aragonite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, Mg/Ca={mg_ratio:.2f}, σ={sigma_arag:.2f})")

        # Dolomite nucleation — Ca-Mg carbonate, needs both cations + T > 50°C.
        sigma_dol = self.conditions.supersaturation_dolomite()
        existing_dol = [c for c in self.crystals if c.mineral == "dolomite" and c.active]
        if sigma_dol > 1.0 and not existing_dol and not self._at_nucleation_cap("dolomite"):
            pos = "vug wall"
            # Often grows on calcite as the system evolves toward dolomitization
            existing_cal_d = [c for c in self.crystals if c.mineral == "calcite" and c.active]
            if existing_cal_d and random.random() < 0.4:
                pos = f"on calcite #{existing_cal_d[0].crystal_id}"
            mg_ratio = self.conditions.fluid.Mg / max(self.conditions.fluid.Ca, 0.01)
            c = self.nucleate("dolomite", position=pos, sigma=sigma_dol)
            self.log.append(f"  ✦ NUCLEATION: Dolomite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, Mg/Ca={mg_ratio:.2f}, σ={sigma_dol:.2f})")

        # Siderite nucleation — Fe carbonate, the brown rhomb. Reducing only.
        sigma_sid = self.conditions.supersaturation_siderite()
        existing_sid = [c for c in self.crystals if c.mineral == "siderite" and c.active]
        if sigma_sid > 1.0 and not existing_sid and not self._at_nucleation_cap("siderite"):
            pos = "vug wall"
            # Substrate: pyrite (concentrated Fe), sphalerite (Fe-bearing host
            # in MVT systems), or wall.
            existing_py_s = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
            existing_sph_s = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
            if existing_py_s and random.random() < 0.4:
                pos = f"on pyrite #{existing_py_s[0].crystal_id}"
            elif existing_sph_s and random.random() < 0.3:
                pos = f"on sphalerite #{existing_sph_s[0].crystal_id}"
            c = self.nucleate("siderite", position=pos, sigma=sigma_sid)
            self.log.append(f"  ✦ NUCLEATION: Siderite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, Fe={self.conditions.fluid.Fe:.0f}, σ={sigma_sid:.2f})")

        # Rhodochrosite nucleation — Mn carbonate, the pink mineral.
        sigma_rho = self.conditions.supersaturation_rhodochrosite()
        existing_rho = [c for c in self.crystals if c.mineral == "rhodochrosite" and c.active]
        if sigma_rho > 1.0 and not existing_rho and not self._at_nucleation_cap("rhodochrosite"):
            pos = "vug wall"
            # Substrate preference: goethite (Capillitas-style stalactitic
            # ferruginous drip), then existing sulfides (epithermal vein paragenesis).
            existing_goe_r = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            existing_py_r = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
            existing_sph_r = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
            if existing_goe_r and random.random() < 0.5:
                pos = f"on goethite #{existing_goe_r[0].crystal_id}"
            elif existing_sph_r and random.random() < 0.4:
                pos = f"on sphalerite #{existing_sph_r[0].crystal_id}"
            elif existing_py_r and random.random() < 0.3:
                pos = f"on pyrite #{existing_py_r[0].crystal_id}"
            c = self.nucleate("rhodochrosite", position=pos, sigma=sigma_rho)
            self.log.append(f"  ✦ NUCLEATION: Rhodochrosite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, Mn={self.conditions.fluid.Mn:.0f}, σ={sigma_rho:.2f})")

        # Sphalerite nucleation
        sigma_s = self.conditions.supersaturation_sphalerite()
        existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
        if sigma_s > 1.0 and not existing_sph and not self._at_nucleation_cap("sphalerite"):
            c = self.nucleate("sphalerite", position="vug wall", sigma=sigma_s)
            self.log.append(f"  ✦ NUCLEATION: Sphalerite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_s:.2f})")

        # Wurtzite nucleation — T>95°C hexagonal ZnS dimorph
        sigma_wz = self.conditions.supersaturation_wurtzite()
        existing_wz = [c for c in self.crystals if c.mineral == "wurtzite" and c.active]
        if sigma_wz > 1.0 and not existing_wz and not self._at_nucleation_cap("wurtzite"):
            c = self.nucleate("wurtzite", position="vug wall", sigma=sigma_wz)
            self.log.append(f"  ✦ NUCLEATION: Wurtzite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_wz:.2f})")
        
        # Fluorite nucleation
        sigma_f = self.conditions.supersaturation_fluorite()
        existing_fl = [c for c in self.crystals if c.mineral == "fluorite" and c.active]
        if sigma_f > 1.2 and not existing_fl and not self._at_nucleation_cap("fluorite"):
            c = self.nucleate("fluorite", position="vug wall", sigma=sigma_f)
            self.log.append(f"  ✦ NUCLEATION: Fluorite #{c.crystal_id} on {c.position}")
        
        # Pyrite nucleation — microcrystalline swarms aren't interesting individually
        # (cap comes from spec).
        sigma_py = self.conditions.supersaturation_pyrite()
        existing_py = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
        if sigma_py > 1.0 and not existing_py and not self._at_nucleation_cap("pyrite"):
            pos = "vug wall"
            existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
            if existing_sph and random.random() < 0.5:
                pos = f"on sphalerite #{existing_sph[0].crystal_id}"
            c = self.nucleate("pyrite", position=pos, sigma=sigma_py)
            self.log.append(f"  ✦ NUCLEATION: Pyrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_py:.2f})")

        # Marcasite nucleation — pH<5, T<240. The acidic dimorph.
        sigma_mc = self.conditions.supersaturation_marcasite()
        existing_mc = [c for c in self.crystals if c.mineral == "marcasite" and c.active]
        if sigma_mc > 1.0 and not existing_mc and not self._at_nucleation_cap("marcasite"):
            pos = "vug wall"
            # Prefer existing sphalerite or galena substrate — classic MVT association
            existing_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
            existing_gal = [c for c in self.crystals if c.mineral == "galena" and c.active]
            if existing_sph and random.random() < 0.5:
                pos = f"on sphalerite #{existing_sph[0].crystal_id}"
            elif existing_gal and random.random() < 0.4:
                pos = f"on galena #{existing_gal[0].crystal_id}"
            c = self.nucleate("marcasite", position=pos, sigma=sigma_mc)
            self.log.append(f"  ✦ NUCLEATION: Marcasite #{c.crystal_id} on {c.position} "
                          f"(pH={self.conditions.fluid.pH:.1f}, σ={sigma_mc:.2f})")

        # Chalcopyrite nucleation
        sigma_cp = self.conditions.supersaturation_chalcopyrite()
        existing_cp = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
        if sigma_cp > 1.0 and not existing_cp and not self._at_nucleation_cap("chalcopyrite"):
            pos = "vug wall"
            if existing_py and random.random() < 0.4:
                pos = f"on pyrite #{existing_py[0].crystal_id}"
            c = self.nucleate("chalcopyrite", position=pos, sigma=sigma_cp)
            self.log.append(f"  ✦ NUCLEATION: Chalcopyrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cp:.2f})")

        # Tetrahedrite nucleation — Sb-endmember fahlore, Cu-Sb-S hydrothermal.
        sigma_td = self.conditions.supersaturation_tetrahedrite()
        existing_td = [c for c in self.crystals if c.mineral == "tetrahedrite" and c.active]
        if sigma_td > 1.0 and not existing_td and not self._at_nucleation_cap("tetrahedrite"):
            pos = "vug wall"
            existing_cp2 = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
            existing_py2 = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
            if existing_cp2 and random.random() < 0.5:
                pos = f"on chalcopyrite #{existing_cp2[0].crystal_id}"
            elif existing_py2 and random.random() < 0.3:
                pos = f"on pyrite #{existing_py2[0].crystal_id}"
            c = self.nucleate("tetrahedrite", position=pos, sigma=sigma_td)
            self.log.append(f"  ✦ NUCLEATION: Tetrahedrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_td:.2f})")

        # Tennantite nucleation — As-endmember fahlore, paired with tetrahedrite.
        sigma_tn = self.conditions.supersaturation_tennantite()
        existing_tn = [c for c in self.crystals if c.mineral == "tennantite" and c.active]
        if sigma_tn > 1.0 and not existing_tn and not self._at_nucleation_cap("tennantite"):
            pos = "vug wall"
            existing_cp3 = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
            existing_td3 = [c for c in self.crystals if c.mineral == "tetrahedrite" and c.active]
            if existing_cp3 and random.random() < 0.4:
                pos = f"on chalcopyrite #{existing_cp3[0].crystal_id}"
            elif existing_td3 and random.random() < 0.3:
                pos = f"alongside tetrahedrite #{existing_td3[0].crystal_id}"
            c = self.nucleate("tennantite", position=pos, sigma=sigma_tn)
            self.log.append(f"  ✦ NUCLEATION: Tennantite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_tn:.2f})")

        # Apophyllite nucleation — alkaline silicate, low-T zeolite vesicle filling.
        sigma_ap = self.conditions.supersaturation_apophyllite()
        existing_ap = [c for c in self.crystals if c.mineral == "apophyllite" and c.active]
        if sigma_ap > 1.0 and not existing_ap and not self._at_nucleation_cap("apophyllite"):
            pos = "vug wall"
            existing_q_ap = [c for c in self.crystals if c.mineral == "quartz" and c.active]
            existing_hem_ap = [c for c in self.crystals if c.mineral == "hematite" and c.active]
            # Hematite-included apophyllite is the Nashik 'bloody apophyllite' habit
            if existing_hem_ap and random.random() < 0.4:
                pos = f"on hematite #{existing_hem_ap[0].crystal_id}"
            elif existing_q_ap and random.random() < 0.3:
                pos = f"on quartz #{existing_q_ap[0].crystal_id}"
            c = self.nucleate("apophyllite", position=pos, sigma=sigma_ap)
            self.log.append(f"  ✦ NUCLEATION: Apophyllite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ap:.2f})")

        # Hematite nucleation — needs sigma > 1.2 (harder to nucleate)
        sigma_hem = self.conditions.supersaturation_hematite()
        existing_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
        if sigma_hem > 1.2 and not existing_hem and not self._at_nucleation_cap("hematite"):
            pos = "vug wall"
            # Can nucleate on existing quartz
            if existing_quartz and random.random() < 0.4:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("hematite", position=pos, sigma=sigma_hem)
            self.log.append(f"  ✦ NUCLEATION: Hematite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_hem:.2f})")
        
        # Malachite nucleation — needs sigma > 1.0
        sigma_mal = self.conditions.supersaturation_malachite()
        existing_mal = [c for c in self.crystals if c.mineral == "malachite" and c.active]
        if sigma_mal > 1.0 and not existing_mal and not self._at_nucleation_cap("malachite"):
            pos = "vug wall"
            # Preference for chalcopyrite surface (classic! oxidation paragenesis)
            dissolving_cp = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
            active_cp = [c for c in self.crystals if c.mineral == "chalcopyrite"]
            if dissolving_cp and random.random() < 0.7:
                pos = f"on chalcopyrite #{dissolving_cp[0].crystal_id}"
            elif active_cp and random.random() < 0.4:
                pos = f"on chalcopyrite #{active_cp[0].crystal_id}"
            elif existing_hem and random.random() < 0.3:
                pos = f"on hematite #{existing_hem[0].crystal_id}"
            c = self.nucleate("malachite", position=pos, sigma=sigma_mal)
            self.log.append(f"  ✦ NUCLEATION: Malachite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mal:.2f})")
        
        # Adamite nucleation — Zn + As + O₂, low T oxidation zone
        sigma_adam = self.conditions.supersaturation_adamite()
        existing_adam = [c for c in self.crystals if c.mineral == "adamite" and c.active]
        if sigma_adam > 1.0 and not existing_adam and not self._at_nucleation_cap("adamite"):
            pos = "vug wall"
            # Preference for limonite/goethite substrate (classic association)
            existing_goethite = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            existing_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
            if existing_goethite and random.random() < 0.6:
                pos = f"on goethite #{existing_goethite[0].crystal_id}"
            elif existing_hem and random.random() < 0.4:
                pos = f"on hematite #{existing_hem[0].crystal_id}"
            # Nucleate multiple crystals — adamite forms sprays
            c = self.nucleate("adamite", position=pos, sigma=sigma_adam)
            self.log.append(f"  ✦ NUCLEATION: Adamite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_adam:.2f})")
            # Second crystal often nucleates nearby — the fluorescent/non-fluorescent pair
            if sigma_adam > 1.3 and random.random() < 0.5 and not self._at_nucleation_cap("adamite"):
                c2 = self.nucleate("adamite", position=pos, sigma=sigma_adam)
                self.log.append(f"  ✦ NUCLEATION: Adamite #{c2.crystal_id} alongside #{c.crystal_id} "
                              f"— will one fluoresce and the other stay dark?")
        
        # Mimetite nucleation — Pb + As + Cl + O₂, oxidation zone
        sigma_mim = self.conditions.supersaturation_mimetite()
        existing_mim = [c for c in self.crystals if c.mineral == "mimetite" and c.active]
        if sigma_mim > 1.0 and not existing_mim and not self._at_nucleation_cap("mimetite"):
            pos = "vug wall"
            # Preference for galena surface (classic! mimetite replaces/coats galena)
            existing_galena = [c for c in self.crystals if c.mineral == "galena"]
            existing_goethite_mim = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            if existing_galena and random.random() < 0.6:
                pos = f"on galena #{existing_galena[0].crystal_id}"
            elif existing_goethite_mim and random.random() < 0.3:
                pos = f"on goethite #{existing_goethite_mim[0].crystal_id}"
            c = self.nucleate("mimetite", position=pos, sigma=sigma_mim)
            self.log.append(f"  ✦ NUCLEATION: Mimetite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mim:.2f})")

        # Erythrite nucleation — the cobalt bloom, low-T oxidation of Co arsenides.
        sigma_ery = self.conditions.supersaturation_erythrite()
        existing_ery = [c for c in self.crystals if c.mineral == "erythrite" and c.active]
        if sigma_ery > 1.0 and not existing_ery and not self._at_nucleation_cap("erythrite"):
            pos = "vug wall"
            # Substrate preference: goethite (limonite), then existing arsenate coatings.
            existing_goe_e = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            existing_adam_e = [c for c in self.crystals if c.mineral == "adamite" and c.active]
            if existing_goe_e and random.random() < 0.5:
                pos = f"on goethite #{existing_goe_e[0].crystal_id}"
            elif existing_adam_e and random.random() < 0.3:
                pos = f"on adamite #{existing_adam_e[0].crystal_id}"
            c = self.nucleate("erythrite", position=pos, sigma=sigma_ery)
            self.log.append(f"  ✦ NUCLEATION: Erythrite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ery:.2f})")

        # Annabergite nucleation — the nickel bloom, Ni equivalent of erythrite.
        sigma_ann = self.conditions.supersaturation_annabergite()
        existing_ann = [c for c in self.crystals if c.mineral == "annabergite" and c.active]
        if sigma_ann > 1.0 and not existing_ann and not self._at_nucleation_cap("annabergite"):
            pos = "vug wall"
            existing_goe_a = [c for c in self.crystals if c.mineral == "goethite" and c.active]
            existing_ery_a = [c for c in self.crystals if c.mineral == "erythrite" and c.active]
            if existing_goe_a and random.random() < 0.5:
                pos = f"on goethite #{existing_goe_a[0].crystal_id}"
            elif existing_ery_a and random.random() < 0.3:
                pos = f"alongside erythrite #{existing_ery_a[0].crystal_id}"
            c = self.nucleate("annabergite", position=pos, sigma=sigma_ann)
            self.log.append(f"  ✦ NUCLEATION: Annabergite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ann:.2f})")

        # Feldspar nucleation — K-feldspar (orthoclase/microcline/sanidine)
        sigma_fsp = self.conditions.supersaturation_feldspar()
        existing_fsp = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
        if sigma_fsp > 1.0 and not existing_fsp and not self._at_nucleation_cap("feldspar"):
            pos = "vug wall"
            # Feldspar can nucleate on quartz — common in pegmatites
            if existing_quartz and random.random() < 0.4:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("feldspar", position=pos, sigma=sigma_fsp)
            self.log.append(f"  ✦ NUCLEATION: K-feldspar #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_fsp:.2f})")
        
        # Albite nucleation — Na-feldspar
        # Can coexist with K-feldspar (perthite pair).
        sigma_ab = self.conditions.supersaturation_albite()
        existing_ab = [c for c in self.crystals if c.mineral == "albite" and c.active]
        if sigma_ab > 1.0 and not existing_ab and not self._at_nucleation_cap("albite"):
            pos = "vug wall"
            # Albite often nucleates on feldspar — the perthite association
            if existing_fsp and random.random() < 0.5:
                pos = f"on feldspar #{existing_fsp[0].crystal_id}"
            elif existing_quartz and random.random() < 0.3:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            c = self.nucleate("albite", position=pos, sigma=sigma_ab)
            self.log.append(f"  ✦ NUCLEATION: Albite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ab:.2f})")

        # Molybdenite nucleation (rare — porphyry systems don't flood the vug)
        sigma_mol = self.conditions.supersaturation_molybdenite()
        if sigma_mol > 2.0 and not self._at_nucleation_cap("molybdenite"):
            if random.random() < 0.08:
                c = self.nucleate("molybdenite", position="vug wall", sigma=sigma_mol)
                self.log.append(f"  ✦ NUCLEATION: Molybdenite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mol:.2f})")

        # Galena nucleation
        sigma_gal = self.conditions.supersaturation_galena()
        if sigma_gal > 1.5 and not self._at_nucleation_cap("galena"):
            if random.random() < 0.12:
                c = self.nucleate("galena", position="vug wall", sigma=sigma_gal)
                self.log.append(f"  ✦ NUCLEATION: Galena #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_gal:.2f})")

        # Wulfenite nucleation — needs both Pb AND Mo oxidized (late-stage)
        sigma_wul = self.conditions.supersaturation_wulfenite()
        if sigma_wul > 1.3 and not self._at_nucleation_cap("wulfenite"):
            if random.random() < 0.15:
                c = self.nucleate("wulfenite", position="vug wall", sigma=sigma_wul)
                self.log.append(f"  ✦ NUCLEATION: Wulfenite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_wul:.2f})")

        # Ferrimolybdite nucleation — the no-lead Mo-oxidation fork.
        # Lower σ threshold (1.0 vs wulfenite's 1.3) + higher probability
        # per check (0.18 vs 0.15) reflect its faster, less-picky growth.
        # Substrate preference: dissolving molybdenite (direct oxidation
        # product) > active molybdenite > free vug wall. Can coexist
        # with wulfenite — both take MoO₄²⁻ from the same pool.
        sigma_fmo = self.conditions.supersaturation_ferrimolybdite()
        if sigma_fmo > 1.0 and not self._at_nucleation_cap("ferrimolybdite"):
            if random.random() < 0.18:
                pos = "vug wall"
                dissolving_mol = [c for c in self.crystals if c.mineral == "molybdenite" and c.dissolved]
                active_mol = [c for c in self.crystals if c.mineral == "molybdenite" and c.active]
                if dissolving_mol and random.random() < 0.7:
                    pos = f"on dissolving molybdenite #{dissolving_mol[0].crystal_id}"
                elif active_mol and random.random() < 0.4:
                    pos = f"on molybdenite #{active_mol[0].crystal_id}"
                c = self.nucleate("ferrimolybdite", position=pos, sigma=sigma_fmo)
                self.log.append(f"  ✦ NUCLEATION: Ferrimolybdite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_fmo:.2f}, "
                              f"Mo={self.conditions.fluid.Mo:.0f}, Fe={self.conditions.fluid.Fe:.0f})")

        # Arsenopyrite nucleation — mesothermal primary sulfide, reducing
        # Fe+As+S. Substrate preference: pyrite (the classic orogenic-gold
        # co-precipitation habit — arsenopyrite rhombs on pyrite cubes) >
        # chalcopyrite (sulfide companion in porphyry evolution) > vug
        # wall. σ threshold 1.2 reflects the mesothermal specificity —
        # arsenopyrite is pickier than pyrite about T and Eh windows.
        sigma_apy = self.conditions.supersaturation_arsenopyrite()
        if sigma_apy > 1.2 and not self._at_nucleation_cap("arsenopyrite"):
            if random.random() < 0.12:
                pos = "vug wall"
                active_py_apy = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
                active_cp_apy = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if active_py_apy and random.random() < 0.5:
                    pos = f"on pyrite #{active_py_apy[0].crystal_id}"
                elif active_cp_apy and random.random() < 0.3:
                    pos = f"on chalcopyrite #{active_cp_apy[0].crystal_id}"
                c = self.nucleate("arsenopyrite", position=pos, sigma=sigma_apy)
                self.log.append(f"  ✦ NUCLEATION: Arsenopyrite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_apy:.2f}, "
                              f"Fe={self.conditions.fluid.Fe:.0f}, As={self.conditions.fluid.As:.0f}, "
                              f"Au={self.conditions.fluid.Au:.2f} ppm)")

        # Scorodite nucleation — the arsenate supergene gateway; the
        # canonical "crystallized on dissolving arsenopyrite" habit. σ
        # threshold 1.0 + per-check 0.20 reflect supergene speed (the
        # arsenate suite forms quickly once acidic oxidizing conditions
        # arrive). Substrate priority: dissolving arsenopyrite (direct
        # parent) > active arsenopyrite > dissolving pyrite (often co-
        # occurs in oxidation zones) > vug wall.
        sigma_sco = self.conditions.supersaturation_scorodite()
        if sigma_sco > 1.0 and not self._at_nucleation_cap("scorodite"):
            if random.random() < 0.20:
                pos = "vug wall"
                diss_apy = [c for c in self.crystals if c.mineral == "arsenopyrite" and c.dissolved]
                active_apy = [c for c in self.crystals if c.mineral == "arsenopyrite" and c.active]
                diss_py_sco = [c for c in self.crystals if c.mineral == "pyrite" and c.dissolved]
                if diss_apy and random.random() < 0.8:
                    pos = f"on dissolving arsenopyrite #{diss_apy[0].crystal_id}"
                elif active_apy and random.random() < 0.5:
                    pos = f"on arsenopyrite #{active_apy[0].crystal_id}"
                elif diss_py_sco and random.random() < 0.4:
                    pos = f"on dissolving pyrite #{diss_py_sco[0].crystal_id}"
                c = self.nucleate("scorodite", position=pos, sigma=sigma_sco)
                self.log.append(f"  ✦ NUCLEATION: Scorodite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_sco:.2f}, "
                              f"Fe={self.conditions.fluid.Fe:.0f}, As={self.conditions.fluid.As:.0f}, "
                              f"pH={self.conditions.fluid.pH:.1f})")

        # Barite nucleation — the Ba sequestration mineral. σ threshold
        # 1.0 + per-check 0.15. Wide-T habit; substrate-agnostic (often
        # nucleates directly on bare wall in MVT/hydrothermal vein
        # contexts rather than overgrowing prior crystals). Sr-substitution
        # to celestobarite when Sr also present in fluid.
        sigma_brt = self.conditions.supersaturation_barite()
        if sigma_brt > 1.0 and not self._at_nucleation_cap("barite"):
            if random.random() < 0.15:
                pos = "vug wall"
                # MVT context: barite often perches on or near galena/
                # sphalerite — co-precipitation paragenesis
                active_gal_brt = [c for c in self.crystals if c.mineral == "galena" and c.active]
                active_sph_brt = [c for c in self.crystals if c.mineral == "sphalerite" and c.active]
                if active_gal_brt and random.random() < 0.3:
                    pos = f"near galena #{active_gal_brt[0].crystal_id}"
                elif active_sph_brt and random.random() < 0.2:
                    pos = f"near sphalerite #{active_sph_brt[0].crystal_id}"
                c = self.nucleate("barite", position=pos, sigma=sigma_brt)
                self.log.append(f"  ✦ NUCLEATION: Barite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_brt:.2f}, "
                              f"Ba={self.conditions.fluid.Ba:.0f}, S={self.conditions.fluid.S:.0f}, "
                              f"O₂={self.conditions.fluid.O2:.2f})")

        # Celestine nucleation — the Sr sequestration mineral; pale
        # celestial blue dipyramids/blades. Substrate priority:
        # dissolving native sulfur if present (Sicilian habit) > vug wall.
        # In sabkha/evaporite contexts often nucleates as nodular geode
        # lining; in MVT as the Sr-end of the barite-celestine pair.
        sigma_cel = self.conditions.supersaturation_celestine()
        if sigma_cel > 1.0 and not self._at_nucleation_cap("celestine"):
            if random.random() < 0.15:
                pos = "vug wall"
                # Sicilian sulfur-vug habit: prefers native sulfur substrate
                # (the sim doesn't model native sulfur yet — fall through to
                # wall). Future scenario could add it.
                active_brt_cel = [c for c in self.crystals if c.mineral == "barite" and c.active]
                if active_brt_cel and random.random() < 0.25:
                    pos = f"on barite #{active_brt_cel[0].crystal_id} (celestobarite-barytocelestine pair)"
                c = self.nucleate("celestine", position=pos, sigma=sigma_cel)
                self.log.append(f"  ✦ NUCLEATION: Celestine #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cel:.2f}, "
                              f"Sr={self.conditions.fluid.Sr:.0f}, S={self.conditions.fluid.S:.0f}, "
                              f"O₂={self.conditions.fluid.O2:.2f})")

        # Jarosite nucleation — the AMD-yellow Fe sulfate. Substrate prefers
        # dissolving pyrite/marcasite (the diagnostic yellow rim on weathered
        # sulfide). σ threshold 1.0 + per-check 0.18 reflects supergene speed.
        sigma_jar = self.conditions.supersaturation_jarosite()
        if sigma_jar > 1.0 and not self._at_nucleation_cap("jarosite"):
            # Higher per-check (0.45 vs default 0.18) reflects the fast
            # kinetics of jarosite formation in acid drainage; helps the
            # mineral fire reliably during brief acid windows. Across
            # 20 seeds at 0.45, jarosite hits ~95%; at 0.18 only ~25%.
            if random.random() < 0.45:
                pos = "vug wall"
                diss_py_jar = [c for c in self.crystals if c.mineral == "pyrite" and c.dissolved]
                diss_mar_jar = [c for c in self.crystals if c.mineral == "marcasite" and c.dissolved]
                active_py_jar = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
                if diss_py_jar and random.random() < 0.7:
                    pos = f"on dissolving pyrite #{diss_py_jar[0].crystal_id}"
                elif diss_mar_jar and random.random() < 0.6:
                    pos = f"on dissolving marcasite #{diss_mar_jar[0].crystal_id}"
                elif active_py_jar and random.random() < 0.4:
                    pos = f"on pyrite #{active_py_jar[0].crystal_id}"
                c = self.nucleate("jarosite", position=pos, sigma=sigma_jar)
                self.log.append(f"  ✦ NUCLEATION: Jarosite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_jar:.2f}, "
                              f"K={self.conditions.fluid.K:.0f}, Fe={self.conditions.fluid.Fe:.0f}, "
                              f"pH={self.conditions.fluid.pH:.1f})")

        # Alunite nucleation — advanced argillic alteration index mineral.
        # Substrate prefers dissolving feldspar (the wall-leaching origin
        # of Al). Wider T window than jarosite (50-300 °C — hydrothermal
        # acid-sulfate). σ threshold 1.0 + per-check 0.15.
        sigma_alu = self.conditions.supersaturation_alunite()
        if sigma_alu > 1.0 and not self._at_nucleation_cap("alunite"):
            # Higher per-check (0.45 vs default 0.15) — same rationale as
            # jarosite: fast acid-sulfate alteration kinetics, brief acid
            # windows in carbonate-buffered systems. Tighter alunite
            # window (Al/25 cap means only 3 of 4 acid pulses cross
            # threshold) makes the boost more important here.
            if random.random() < 0.45:
                pos = "vug wall"
                diss_fel_alu = [c for c in self.crystals if c.mineral == "feldspar" and c.dissolved]
                active_fel_alu = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
                if diss_fel_alu and random.random() < 0.7:
                    pos = f"on dissolving feldspar #{diss_fel_alu[0].crystal_id}"
                elif active_fel_alu and random.random() < 0.4:
                    pos = f"on feldspar #{active_fel_alu[0].crystal_id}"
                c = self.nucleate("alunite", position=pos, sigma=sigma_alu)
                self.log.append(f"  ✦ NUCLEATION: Alunite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_alu:.2f}, "
                              f"K={self.conditions.fluid.K:.0f}, Al={self.conditions.fluid.Al:.0f}, "
                              f"pH={self.conditions.fluid.pH:.1f})")

        # Brochantite nucleation — wet-supergene Cu sulfate (pH 4-7 fork
        # end). Substrate priority: dissolving Cu sulfides (chalcocite,
        # covellite) > Cu sulfide > vug wall.
        sigma_brn = self.conditions.supersaturation_brochantite()
        if sigma_brn > 1.0 and not self._at_nucleation_cap("brochantite"):
            if random.random() < 0.18:
                pos = "vug wall"
                diss_chc_brn = [c for c in self.crystals if c.mineral == "chalcocite" and c.dissolved]
                diss_cov_brn = [c for c in self.crystals if c.mineral == "covellite" and c.dissolved]
                active_chc_brn = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                if diss_chc_brn and random.random() < 0.7:
                    pos = f"on dissolving chalcocite #{diss_chc_brn[0].crystal_id}"
                elif diss_cov_brn and random.random() < 0.6:
                    pos = f"on dissolving covellite #{diss_cov_brn[0].crystal_id}"
                elif active_chc_brn and random.random() < 0.4:
                    pos = f"on chalcocite #{active_chc_brn[0].crystal_id}"
                c = self.nucleate("brochantite", position=pos, sigma=sigma_brn)
                self.log.append(f"  ✦ NUCLEATION: Brochantite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_brn:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, S={self.conditions.fluid.S:.0f}, "
                              f"pH={self.conditions.fluid.pH:.1f})")

        # Antlerite nucleation — dry-acid Cu sulfate (pH 1-3.5 fork end).
        # Substrate priority: dissolving brochantite (the direct fork
        # product of acidification) > dissolving Cu sulfides > vug wall.
        sigma_ant = self.conditions.supersaturation_antlerite()
        if sigma_ant > 1.0 and not self._at_nucleation_cap("antlerite"):
            if random.random() < 0.18:
                pos = "vug wall"
                diss_brn_ant = [c for c in self.crystals if c.mineral == "brochantite" and c.dissolved]
                diss_chc_ant = [c for c in self.crystals if c.mineral == "chalcocite" and c.dissolved]
                if diss_brn_ant and random.random() < 0.8:
                    pos = f"on dissolving brochantite #{diss_brn_ant[0].crystal_id} (pH-fork conversion)"
                elif diss_chc_ant and random.random() < 0.5:
                    pos = f"on dissolving chalcocite #{diss_chc_ant[0].crystal_id}"
                c = self.nucleate("antlerite", position=pos, sigma=sigma_ant)
                self.log.append(f"  ✦ NUCLEATION: Antlerite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ant:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, S={self.conditions.fluid.S:.0f}, "
                              f"pH={self.conditions.fluid.pH:.1f})")

        # Anhydrite nucleation — high-T or saline-low-T Ca sulfate. σ
        # threshold 1.0 + per-check 0.16 (slightly less than selenite's
        # to avoid both flooding the same vug). Substrate-agnostic; can
        # nucleate on bare wall in evaporite + porphyry deep-brine
        # contexts. In sabkha the anhydrite-gypsum stratigraphy is
        # interlayered; in Bingham anhydrite forms with chalcopyrite in
        # the deep-zone vein paragenesis.
        sigma_anh = self.conditions.supersaturation_anhydrite()
        if sigma_anh > 1.0 and not self._at_nucleation_cap("anhydrite"):
            if random.random() < 0.16:
                pos = "vug wall"
                # In deep-brine context, often co-precipitates with chalcopyrite
                active_cp_anh = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if active_cp_anh and self.conditions.temperature > 200 and random.random() < 0.3:
                    pos = f"near chalcopyrite #{active_cp_anh[0].crystal_id} (porphyry deep-brine paragenesis)"
                c = self.nucleate("anhydrite", position=pos, sigma=sigma_anh)
                self.log.append(f"  ✦ NUCLEATION: Anhydrite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_anh:.2f}, "
                              f"Ca={self.conditions.fluid.Ca:.0f}, S={self.conditions.fluid.S:.0f}, "
                              f"salinity={self.conditions.fluid.salinity:.0f}‰)")

        # Uraninite nucleation — strongly reducing, U-bearing. Emits radiation each step.
        sigma_ur = self.conditions.supersaturation_uraninite()
        if sigma_ur > 1.5 and not self._at_nucleation_cap("uraninite") and random.random() < 0.08:
            c = self.nucleate("uraninite", position="vug wall", sigma=sigma_ur)
            self.log.append(f"  ✦ NUCLEATION: Uraninite #{c.crystal_id} on {c.position} "
                          f"☢️  (T={self.conditions.temperature:.0f}°C, σ={sigma_ur:.2f})")

        # Goethite nucleation — the ghost mineral, now real.
        # Classic pseudomorph after pyrite/marcasite; also forms on hematite, or free on walls.
        sigma_goe = self.conditions.supersaturation_goethite()
        existing_goe = [c for c in self.crystals if c.mineral == "goethite" and c.active]
        if sigma_goe > 1.0 and not existing_goe and not self._at_nucleation_cap("goethite"):
            pos = "vug wall"
            dissolving_py = [c for c in self.crystals if c.mineral == "pyrite" and c.dissolved]
            dissolving_cp = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
            active_hem = [c for c in self.crystals if c.mineral == "hematite" and c.active]
            if dissolving_py and random.random() < 0.7:
                pos = f"pseudomorph after pyrite #{dissolving_py[0].crystal_id}"
            elif dissolving_cp and random.random() < 0.5:
                pos = f"pseudomorph after chalcopyrite #{dissolving_cp[0].crystal_id}"
            elif active_hem and random.random() < 0.3:
                pos = f"on hematite #{active_hem[0].crystal_id}"
            c = self.nucleate("goethite", position=pos, sigma=sigma_goe)
            self.log.append(f"  ✦ NUCLEATION: Goethite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_goe:.2f})")

        # Smithsonite nucleation — supergene ZnCO₃ from sphalerite oxidation
        sigma_sm = self.conditions.supersaturation_smithsonite()
        existing_sm = [c for c in self.crystals if c.mineral == "smithsonite" and c.active]
        if sigma_sm > 1.0 and not existing_sm and not self._at_nucleation_cap("smithsonite"):
            pos = "vug wall"
            dissolving_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.dissolved]
            if dissolving_sph and random.random() < 0.6:
                pos = f"on sphalerite #{dissolving_sph[0].crystal_id}"
            c = self.nucleate("smithsonite", position=pos, sigma=sigma_sm)
            self.log.append(f"  ✦ NUCLEATION: Smithsonite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_sm:.2f})")

        # Selenite nucleation — low-T evaporite, needs oxidized Ca-SO4 fluid
        sigma_sel = self.conditions.supersaturation_selenite()
        if sigma_sel > 1.0 and not self._at_nucleation_cap("selenite") and random.random() < 0.12:
            c = self.nucleate("selenite", position="vug wall", sigma=sigma_sel)
            self.log.append(f"  ✦ NUCLEATION: Selenite #{c.crystal_id} on {c.position} "
                          f"(T={self.conditions.temperature:.0f}°C, σ={sigma_sel:.2f})")

        # Spodumene nucleation — Li + Al + SiO₂ (Li-gated).
        # Lithium is mildly incompatible — accumulates late in pegmatite
        # crystallization. Spodumene competes with elbaite tourmaline for
        # Li; whichever threshold fires first depending on which other
        # ingredients are available (B for tourmaline, SiO₂ window for
        # spodumene). max_nucleation_count=4 keeps it realistic.
        sigma_spd = self.conditions.supersaturation_spodumene()
        existing_spd = [c for c in self.crystals if c.mineral == "spodumene" and c.active]
        if sigma_spd > 1.5 and not self._at_nucleation_cap("spodumene"):
            if not existing_spd or (sigma_spd > 2.5 and random.random() < 0.15):
                pos = "vug wall"
                existing_feldspar_spd = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
                if existing_quartz and random.random() < 0.35:
                    pos = f"on quartz #{existing_quartz[0].crystal_id}"
                elif existing_feldspar_spd and random.random() < 0.35:
                    pos = f"on feldspar #{existing_feldspar_spd[0].crystal_id}"
                c = self.nucleate("spodumene", position=pos, sigma=sigma_spd)
                f = self.conditions.fluid
                if f.Cr > 0.5: tag = "hiddenite"
                elif f.Mn > 2.0: tag = "kunzite"
                elif f.Fe > 10: tag = "triphane-yellow"
                else: tag = "triphane"
                self.log.append(f"  ✦ NUCLEATION: Spodumene #{c.crystal_id} ({tag}) on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_spd:.2f}, "
                              f"Li={f.Li:.0f} ppm, Mn={f.Mn:.1f}, Cr={f.Cr:.2f})")

        # Beryl family nucleation — Be + Al + SiO₂ with chromophore dispatch.
        # Beryllium is the most incompatible common element: no other mineral
        # consumes it, so it accumulates freely in pegmatite fluids until σ
        # finally crosses the species-specific threshold. The delay is part
        # of the point — when beryl does nucleate, there's a LOT of Be
        # waiting, which is why crystals can reach meters.
        #
        # Post-Round-7: 5 species (emerald/morganite/heliodor/aquamarine/
        # goshenite(beryl)) each nucleate via their own supersaturation
        # function, which encodes the priority chain through exclusion
        # preconditions. The dispatch below evaluates each in priority order
        # and fires at most ONE per step (first-match-wins) — the shared Be
        # pool would otherwise let two siblings over-nucleate.
        beryl_family_candidates = [
            ("emerald", self.conditions.supersaturation_emerald(), 1.4),
            ("morganite", self.conditions.supersaturation_morganite(), 1.4),
            ("heliodor", self.conditions.supersaturation_heliodor(), 1.4),
            ("aquamarine", self.conditions.supersaturation_aquamarine(), 1.3),
            ("beryl", self.conditions.supersaturation_beryl(), 1.8),
        ]
        existing_feldspar_ber = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
        for species, sigma_bf, threshold in beryl_family_candidates:
            if sigma_bf <= threshold:
                continue
            if self._at_nucleation_cap(species):
                continue
            existing_sp = [c for c in self.crystals if c.mineral == species and c.active]
            # Allow additional nucleation at high σ (emerald gets slightly
            # more, reflecting the rarer paragenesis; first crystal free).
            if existing_sp and not (sigma_bf > threshold + 0.7 and random.random() < 0.15):
                continue
            pos = "vug wall"
            if existing_quartz and random.random() < 0.4:
                pos = f"on quartz #{existing_quartz[0].crystal_id}"
            elif existing_feldspar_ber and random.random() < 0.4:
                pos = f"on feldspar #{existing_feldspar_ber[0].crystal_id}"
            c = self.nucleate(species, position=pos, sigma=sigma_bf)
            f = self.conditions.fluid
            self.log.append(
                f"  ✦ NUCLEATION: {species.title()} #{c.crystal_id} on {c.position} "
                f"(T={self.conditions.temperature:.0f}°C, σ={sigma_bf:.2f}, "
                f"Be={f.Be:.0f} ppm, Cr={f.Cr:.2f}, Fe={f.Fe:.0f}, Mn={f.Mn:.2f})"
            )
            break  # only one beryl-family nucleation per step

        # Corundum family nucleation — Al₂O₃ with SiO₂-undersaturation
        # upper-gate. First UPPER-bound mineral in the sim (all other
        # gates are lower bounds). Priority: ruby > sapphire > corundum.
        # One candidate per step (shared Al pool).
        corundum_family_candidates = [
            ("ruby", self.conditions.supersaturation_ruby(), 1.5),
            ("sapphire", self.conditions.supersaturation_sapphire(), 1.4),
            ("corundum", self.conditions.supersaturation_corundum(), 1.3),
        ]
        for species, sigma_cf, threshold in corundum_family_candidates:
            if sigma_cf <= threshold:
                continue
            if self._at_nucleation_cap(species):
                continue
            existing_sp = [c for c in self.crystals if c.mineral == species and c.active]
            # Ruby is rarer — let additional nucleations happen at higher σ
            if existing_sp and not (sigma_cf > threshold + 0.5 and random.random() < 0.2):
                continue
            pos = "vug wall"  # marble wall is the typical Mogok substrate
            c = self.nucleate(species, position=pos, sigma=sigma_cf)
            f = self.conditions.fluid
            self.log.append(
                f"  ✦ NUCLEATION: {species.title()} #{c.crystal_id} on {c.position} "
                f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cf:.2f}, "
                f"Al={f.Al:.0f}, SiO2={f.SiO2:.0f}, Cr={f.Cr:.2f}, Fe={f.Fe:.1f}, Ti={f.Ti:.2f})"
            )
            break  # only one corundum-family nucleation per step

        # Magnetite nucleation — Fe + moderate O2 (HM buffer).
        sigma_mag = self.conditions.supersaturation_magnetite()
        existing_mag = [c for c in self.crystals if c.mineral == "magnetite" and c.active]
        if sigma_mag > 1.0 and not self._at_nucleation_cap("magnetite"):
            if not existing_mag or (sigma_mag > 1.7 and random.random() < 0.2):
                pos = "vug wall"
                active_hem_mag = [c for c in self.crystals if c.mineral == "hematite" and c.active]
                if active_hem_mag and random.random() < 0.3:
                    pos = f"on hematite #{active_hem_mag[0].crystal_id}"
                c = self.nucleate("magnetite", position=pos, sigma=sigma_mag)
                self.log.append(f"  ✦ NUCLEATION: Magnetite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mag:.2f}, "
                              f"Fe={self.conditions.fluid.Fe:.0f}, O₂={self.conditions.fluid.O2:.2f})")

        # Lepidocrocite nucleation — Fe + rapid oxidation at low T.
        sigma_lep = self.conditions.supersaturation_lepidocrocite()
        existing_lep = [c for c in self.crystals if c.mineral == "lepidocrocite" and c.active]
        if sigma_lep > 1.1 and not self._at_nucleation_cap("lepidocrocite"):
            if not existing_lep or (sigma_lep > 1.7 and random.random() < 0.25):
                pos = "vug wall"
                dissolving_py_lep = [c for c in self.crystals if c.mineral == "pyrite" and c.dissolved]
                active_qtz_lep = [c for c in self.crystals if c.mineral == "quartz" and c.active]
                if dissolving_py_lep and random.random() < 0.6:
                    pos = f"on pyrite #{dissolving_py_lep[0].crystal_id}"
                elif active_qtz_lep and random.random() < 0.3:
                    pos = f"on quartz #{active_qtz_lep[0].crystal_id}"
                c = self.nucleate("lepidocrocite", position=pos, sigma=sigma_lep)
                self.log.append(f"  ✦ NUCLEATION: Lepidocrocite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_lep:.2f}, "
                              f"Fe={self.conditions.fluid.Fe:.0f})")

        # Stibnite nucleation — Sb + S + moderate T + reducing.
        sigma_stb = self.conditions.supersaturation_stibnite()
        existing_stb = [c for c in self.crystals if c.mineral == "stibnite" and c.active]
        if sigma_stb > 1.2 and not self._at_nucleation_cap("stibnite"):
            if not existing_stb or (sigma_stb > 1.8 and random.random() < 0.2):
                pos = "vug wall"
                active_qtz_stb = [c for c in self.crystals if c.mineral == "quartz" and c.active]
                if active_qtz_stb and random.random() < 0.4:
                    pos = f"on quartz #{active_qtz_stb[0].crystal_id}"
                c = self.nucleate("stibnite", position=pos, sigma=sigma_stb)
                self.log.append(f"  ✦ NUCLEATION: Stibnite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_stb:.2f}, "
                              f"Sb={self.conditions.fluid.Sb:.0f}, S={self.conditions.fluid.S:.0f})")

        # Bismuthinite nucleation — Bi + S + high T + reducing.
        sigma_bmt = self.conditions.supersaturation_bismuthinite()
        existing_bmt = [c for c in self.crystals if c.mineral == "bismuthinite" and c.active]
        if sigma_bmt > 1.3 and not self._at_nucleation_cap("bismuthinite"):
            if not existing_bmt or (sigma_bmt > 1.8 and random.random() < 0.2):
                pos = "vug wall"
                active_qtz_bmt = [c for c in self.crystals if c.mineral == "quartz" and c.active]
                active_cp_bmt = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if active_qtz_bmt and random.random() < 0.3:
                    pos = f"on quartz #{active_qtz_bmt[0].crystal_id}"
                elif active_cp_bmt and random.random() < 0.3:
                    pos = f"on chalcopyrite #{active_cp_bmt[0].crystal_id}"
                c = self.nucleate("bismuthinite", position=pos, sigma=sigma_bmt)
                self.log.append(f"  ✦ NUCLEATION: Bismuthinite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_bmt:.2f}, "
                              f"Bi={self.conditions.fluid.Bi:.0f}, S={self.conditions.fluid.S:.0f})")

        # Native bismuth nucleation — Bi + very low S + reducing.
        sigma_nbi = self.conditions.supersaturation_native_bismuth()
        existing_nbi = [c for c in self.crystals if c.mineral == "native_bismuth" and c.active]
        if sigma_nbi > 1.4 and not self._at_nucleation_cap("native_bismuth"):
            if not existing_nbi or (sigma_nbi > 2.0 and random.random() < 0.15):
                pos = "vug wall"
                dissolving_bmt = [c for c in self.crystals if c.mineral == "bismuthinite" and c.dissolved]
                if dissolving_bmt and random.random() < 0.5:
                    pos = f"on bismuthinite #{dissolving_bmt[0].crystal_id}"
                c = self.nucleate("native_bismuth", position=pos, sigma=sigma_nbi)
                self.log.append(f"  ✦ NUCLEATION: Native bismuth #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nbi:.2f}, "
                              f"Bi={self.conditions.fluid.Bi:.0f}, S={self.conditions.fluid.S:.0f})")

        # Argentite nucleation — Ag + S + reducing + T > 173°C.
        # The high-T sibling of acanthite. Will paramorph on cooling
        # (handled in run_step's apply_paramorph_transitions hook),
        # so primary argentite in any cooling scenario is destined to
        # display as acanthite-after-argentite by run end. Substrate
        # preference: galena (the classic Ag-bearing parent) or bare
        # wall when Ag has been delivered as a separate hot pulse.
        sigma_arg = self.conditions.supersaturation_argentite()
        if sigma_arg > 1.0 and not self._at_nucleation_cap("argentite"):
            if random.random() < 0.18:
                pos = "vug wall"
                active_galena = [c for c in self.crystals if c.mineral == "galena" and c.active]
                if active_galena and random.random() < 0.4:
                    pos = f"on galena #{active_galena[0].crystal_id}"
                c = self.nucleate("argentite", position=pos, sigma=sigma_arg)
                self.log.append(f"  ✦ NUCLEATION: Argentite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_arg:.2f}, "
                              f"Ag={self.conditions.fluid.Ag:.2f}, S={self.conditions.fluid.S:.0f})")

        # Chalcanthite nucleation — Cu + S + acidic + oxidizing + concentrated.
        # The terminal Cu-sulfate phase. Substrate preference: dissolving
        # brochantite or antlerite (the next-step-back basic Cu sulfates),
        # or bare wall.
        sigma_cha = self.conditions.supersaturation_chalcanthite()
        if sigma_cha > 1.0 and not self._at_nucleation_cap("chalcanthite"):
            if random.random() < 0.20:
                pos = "vug wall"
                dissolving_brh = [c for c in self.crystals if c.mineral == "brochantite" and c.dissolved]
                dissolving_atl = [c for c in self.crystals if c.mineral == "antlerite" and c.dissolved]
                if dissolving_brh and random.random() < 0.5:
                    pos = f"on brochantite #{dissolving_brh[0].crystal_id}"
                elif dissolving_atl and random.random() < 0.4:
                    pos = f"on antlerite #{dissolving_atl[0].crystal_id}"
                c = self.nucleate("chalcanthite", position=pos, sigma=sigma_cha)
                self.log.append(f"  ✦ NUCLEATION: Chalcanthite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cha:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, S={self.conditions.fluid.S:.0f}, "
                              f"pH={self.conditions.fluid.pH:.1f}, salinity={self.conditions.fluid.salinity:.1f})")

        # Descloizite nucleation — Pb + Zn + V + oxidizing.
        sigma_des = self.conditions.supersaturation_descloizite()
        if sigma_des > 1.0 and not self._at_nucleation_cap("descloizite"):
            if random.random() < 0.18:
                pos = "vug wall"
                active_van = [c for c in self.crystals if c.mineral == "vanadinite" and c.active]
                if active_van and random.random() < 0.4:
                    pos = f"on vanadinite #{active_van[0].crystal_id}"
                c = self.nucleate("descloizite", position=pos, sigma=sigma_des)
                self.log.append(f"  ✦ NUCLEATION: Descloizite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_des:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, Zn={self.conditions.fluid.Zn:.0f}, "
                              f"V={self.conditions.fluid.V:.1f})")

        # Mottramite nucleation — Pb + Cu + V + oxidizing.
        sigma_mot = self.conditions.supersaturation_mottramite()
        if sigma_mot > 1.0 and not self._at_nucleation_cap("mottramite"):
            if random.random() < 0.18:
                pos = "vug wall"
                active_van = [c for c in self.crystals if c.mineral == "vanadinite" and c.active]
                if active_van and random.random() < 0.4:
                    pos = f"on vanadinite #{active_van[0].crystal_id}"
                c = self.nucleate("mottramite", position=pos, sigma=sigma_mot)
                self.log.append(f"  ✦ NUCLEATION: Mottramite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mot:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, Cu={self.conditions.fluid.Cu:.0f}, "
                              f"V={self.conditions.fluid.V:.1f})")

        # Tungstate pair — raspite + stolzite both PbWO₄, kinetic
        # preference dispatcher gives stolzite ~90% of the time.
        sigma_rasp = self.conditions.supersaturation_raspite()
        sigma_stol = self.conditions.supersaturation_stolzite()
        if sigma_rasp > 1.4 and sigma_stol > 1.0 and random.random() < 0.9:
            sigma_rasp = 0  # stolzite preferred kinetically

        if sigma_rasp > 1.4 and not self._at_nucleation_cap("raspite"):
            if random.random() < 0.16:
                pos = "vug wall"
                c = self.nucleate("raspite", position=pos, sigma=sigma_rasp)
                self.log.append(f"  ✦ NUCLEATION: Raspite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_rasp:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, W={self.conditions.fluid.W:.1f})")

        if sigma_stol > 1.0 and not self._at_nucleation_cap("stolzite"):
            if random.random() < 0.18:
                pos = "vug wall"
                c = self.nucleate("stolzite", position=pos, sigma=sigma_stol)
                self.log.append(f"  ✦ NUCLEATION: Stolzite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_stol:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, W={self.conditions.fluid.W:.1f})")

        # Olivenite nucleation — Cu + As + oxidizing (Cu/Zn dispatch
        # routes Zn-rich fluid to adamite).
        sigma_oli = self.conditions.supersaturation_olivenite()
        if sigma_oli > 1.0 and not self._at_nucleation_cap("olivenite"):
            if random.random() < 0.18:
                pos = "vug wall"
                active_mal = [c for c in self.crystals if c.mineral == "malachite" and c.active]
                if active_mal and random.random() < 0.3:
                    pos = f"on malachite #{active_mal[0].crystal_id}"
                c = self.nucleate("olivenite", position=pos, sigma=sigma_oli)
                self.log.append(f"  ✦ NUCLEATION: Olivenite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_oli:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, As={self.conditions.fluid.As:.0f})")

        # Nickeline nucleation — Ni + As + reducing + high T.
        sigma_nik = self.conditions.supersaturation_nickeline()
        if sigma_nik > 1.0 and not self._at_nucleation_cap("nickeline"):
            if random.random() < 0.18:
                pos = "vug wall"
                active_apy_nik = [c for c in self.crystals if c.mineral == "arsenopyrite" and c.active]
                if active_apy_nik and random.random() < 0.4:
                    pos = f"on arsenopyrite #{active_apy_nik[0].crystal_id}"
                c = self.nucleate("nickeline", position=pos, sigma=sigma_nik)
                self.log.append(f"  ✦ NUCLEATION: Nickeline #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nik:.2f}, "
                              f"Ni={self.conditions.fluid.Ni:.0f}, As={self.conditions.fluid.As:.0f})")

        # Millerite nucleation — Ni + S + reducing + As-poor.
        # The capillary brass-yellow needles in geode cavities.
        sigma_mil = self.conditions.supersaturation_millerite()
        if sigma_mil > 1.0 and not self._at_nucleation_cap("millerite"):
            if random.random() < 0.18:
                pos = "vug wall"
                # Often nucleates inside geode cavities; substrate
                # preference for pyrite (the geological companion).
                active_pyr_mil = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
                if active_pyr_mil and random.random() < 0.3:
                    pos = f"on pyrite #{active_pyr_mil[0].crystal_id}"
                c = self.nucleate("millerite", position=pos, sigma=sigma_mil)
                self.log.append(f"  ✦ NUCLEATION: Millerite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_mil:.2f}, "
                              f"Ni={self.conditions.fluid.Ni:.0f}, S={self.conditions.fluid.S:.0f})")

        # Cobaltite nucleation — three-element gate (Co + As + S) +
        # reducing + high T. Substrate preference: arsenopyrite (the
        # paragenetic predecessor at most Cobalt-Ontario veins).
        sigma_cob = self.conditions.supersaturation_cobaltite()
        if sigma_cob > 1.2 and not self._at_nucleation_cap("cobaltite"):
            if random.random() < 0.16:
                pos = "vug wall"
                active_apy_cob = [c for c in self.crystals if c.mineral == "arsenopyrite" and c.active]
                if active_apy_cob and random.random() < 0.5:
                    pos = f"on arsenopyrite #{active_apy_cob[0].crystal_id}"
                c = self.nucleate("cobaltite", position=pos, sigma=sigma_cob)
                self.log.append(f"  ✦ NUCLEATION: Cobaltite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cob:.2f}, "
                              f"Co={self.conditions.fluid.Co:.0f}, As={self.conditions.fluid.As:.0f}, "
                              f"S={self.conditions.fluid.S:.0f})")

        # Native tellurium nucleation — Te + reducing + telluride-metal-poor.
        # Substrate preference: native gold (the Au-Te epithermal pair —
        # when Au-Te fluid passes the boundary where Au has been
        # exhausted but Te remains, native Te accretes onto the gold).
        sigma_nte = self.conditions.supersaturation_native_tellurium()
        if sigma_nte > 1.0 and not self._at_nucleation_cap("native_tellurium"):
            if random.random() < 0.16:
                pos = "vug wall"
                active_au_nte = [c for c in self.crystals if c.mineral == "native_gold" and c.active]
                if active_au_nte and random.random() < 0.4:
                    pos = f"on native_gold #{active_au_nte[0].crystal_id}"
                c = self.nucleate("native_tellurium", position=pos, sigma=sigma_nte)
                self.log.append(f"  ✦ NUCLEATION: Native tellurium #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nte:.2f}, "
                              f"Te={self.conditions.fluid.Te:.2f}, Au={self.conditions.fluid.Au:.2f})")

        # Native sulfur nucleation — S + Eh window + acidic + low base metals.
        # The synproportionation mineral. Substrate preferences:
        # celestine/aragonite (the Sicilian sulfur-vug companions),
        # gypsum (caprock / sabkha context), or bare wall.
        sigma_nsu = self.conditions.supersaturation_native_sulfur()
        if sigma_nsu > 1.0 and not self._at_nucleation_cap("native_sulfur"):
            if random.random() < 0.18:
                pos = "vug wall"
                active_cel_nsu = [c for c in self.crystals if c.mineral == "celestine" and c.active]
                active_arag_nsu = [c for c in self.crystals if c.mineral == "aragonite" and c.active]
                active_gyp_nsu = [c for c in self.crystals if c.mineral == "selenite" and c.active]
                if active_cel_nsu and random.random() < 0.5:
                    pos = f"on celestine #{active_cel_nsu[0].crystal_id}"
                elif active_arag_nsu and random.random() < 0.4:
                    pos = f"on aragonite #{active_arag_nsu[0].crystal_id}"
                elif active_gyp_nsu and random.random() < 0.3:
                    pos = f"on selenite #{active_gyp_nsu[0].crystal_id}"
                c = self.nucleate("native_sulfur", position=pos, sigma=sigma_nsu)
                self.log.append(f"  ✦ NUCLEATION: Native sulfur #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nsu:.2f}, "
                              f"S={self.conditions.fluid.S:.0f}, O₂={self.conditions.fluid.O2:.2f}, "
                              f"pH={self.conditions.fluid.pH:.1f})")

        # Native arsenic nucleation — As + strongly_reducing + S<10 + Fe<50.
        # The residual-overflow mineral. Substrate preference: dissolving
        # arsenopyrite (the supergene route — when arsenopyrite oxidizes,
        # the freed As that doesn't go to scorodite can re-precipitate
        # as native As if the local pocket stays reducing), or bare wall.
        sigma_nas = self.conditions.supersaturation_native_arsenic()
        if sigma_nas > 1.0 and not self._at_nucleation_cap("native_arsenic"):
            if random.random() < 0.16:
                pos = "vug wall"
                dissolving_apy = [c for c in self.crystals if c.mineral == "arsenopyrite" and c.dissolved]
                if dissolving_apy and random.random() < 0.5:
                    pos = f"on arsenopyrite #{dissolving_apy[0].crystal_id}"
                c = self.nucleate("native_arsenic", position=pos, sigma=sigma_nas)
                self.log.append(f"  ✦ NUCLEATION: Native arsenic #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nas:.2f}, "
                              f"As={self.conditions.fluid.As:.0f}, S={self.conditions.fluid.S:.1f}, "
                              f"Fe={self.conditions.fluid.Fe:.0f})")

        # Native silver nucleation — Ag + strongly_reducing + S < 2.
        # The depletion mineral. Substrate preferences track the
        # geological pathway: dissolving acanthite (the supergene
        # enrichment route at Tsumeb), dissolving tetrahedrite
        # (oxidation released Ag now meeting reducing pocket), or
        # native_copper (the Keweenaw co-precipitation — both metals
        # native in S-poor basalt amygdules).
        sigma_nag = self.conditions.supersaturation_native_silver()
        if sigma_nag > 1.2 and not self._at_nucleation_cap("native_silver"):
            if random.random() < 0.16:
                pos = "vug wall"
                dissolving_aca = [c for c in self.crystals if c.mineral == "acanthite" and c.dissolved]
                dissolving_tet_nag = [c for c in self.crystals if c.mineral == "tetrahedrite" and c.dissolved]
                active_ncopper = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
                if dissolving_aca and random.random() < 0.6:
                    pos = f"on acanthite #{dissolving_aca[0].crystal_id}"
                elif dissolving_tet_nag and random.random() < 0.5:
                    pos = f"on tetrahedrite #{dissolving_tet_nag[0].crystal_id}"
                elif active_ncopper and random.random() < 0.4:
                    pos = f"on native_copper #{active_ncopper[0].crystal_id}"
                c = self.nucleate("native_silver", position=pos, sigma=sigma_nag)
                self.log.append(f"  ✦ NUCLEATION: Native silver #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nag:.2f}, "
                              f"Ag={self.conditions.fluid.Ag:.2f}, S={self.conditions.fluid.S:.1f})")

        # Acanthite nucleation — Ag + S + reducing + T < 173°C.
        # Substrate preference: galena (the classic Ag-bearing sulfide
        # parent), tetrahedrite (often the dissolving Ag source in
        # supergene fluid), or bare wall when Ag has been delivered by
        # diffusion alone. First Ag mineral in the sim — paragenetic
        # successor to galena/tetrahedrite/proustite, predecessor to
        # native_silver in S-depleted reducing pockets.
        sigma_aca = self.conditions.supersaturation_acanthite()
        if sigma_aca > 1.0 and not self._at_nucleation_cap("acanthite"):
            if random.random() < 0.18:
                pos = "vug wall"
                active_galena = [c for c in self.crystals if c.mineral == "galena" and c.active]
                dissolving_tet = [c for c in self.crystals if c.mineral == "tetrahedrite" and c.dissolved]
                if active_galena and random.random() < 0.4:
                    pos = f"on galena #{active_galena[0].crystal_id}"
                elif dissolving_tet and random.random() < 0.6:
                    pos = f"on tetrahedrite #{dissolving_tet[0].crystal_id}"
                c = self.nucleate("acanthite", position=pos, sigma=sigma_aca)
                self.log.append(f"  ✦ NUCLEATION: Acanthite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_aca:.2f}, "
                              f"Ag={self.conditions.fluid.Ag:.2f}, S={self.conditions.fluid.S:.0f})")

        # Clinobisvanite nucleation — Bi + V + oxidizing + low T.
        sigma_cbv = self.conditions.supersaturation_clinobisvanite()
        existing_cbv = [c for c in self.crystals if c.mineral == "clinobisvanite" and c.active]
        if sigma_cbv > 1.5 and not self._at_nucleation_cap("clinobisvanite"):
            if not existing_cbv or (sigma_cbv > 2.0 and random.random() < 0.3):
                pos = "vug wall"
                dissolving_nbi = [c for c in self.crystals if c.mineral == "native_bismuth" and c.dissolved]
                dissolving_bmt_cbv = [c for c in self.crystals if c.mineral == "bismuthinite" and c.dissolved]
                if dissolving_nbi and random.random() < 0.5:
                    pos = f"on native_bismuth #{dissolving_nbi[0].crystal_id}"
                elif dissolving_bmt_cbv and random.random() < 0.4:
                    pos = f"on bismuthinite #{dissolving_bmt_cbv[0].crystal_id}"
                c = self.nucleate("clinobisvanite", position=pos, sigma=sigma_cbv)
                self.log.append(f"  ✦ NUCLEATION: Clinobisvanite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cbv:.2f}, "
                              f"Bi={self.conditions.fluid.Bi:.1f}, V={self.conditions.fluid.V:.1f})")

        # Cuprite nucleation — Cu + narrow O₂ window.
        # Prefers native copper substrate (next step in the oxidation
        # sequence) or chalcocite.
        sigma_cpr = self.conditions.supersaturation_cuprite()
        existing_cpr = [c for c in self.crystals if c.mineral == "cuprite" and c.active]
        if sigma_cpr > 1.2 and not self._at_nucleation_cap("cuprite"):
            if not existing_cpr or (sigma_cpr > 1.8 and random.random() < 0.2):
                pos = "vug wall"
                active_nc = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
                active_chc_cpr = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                if active_nc and random.random() < 0.6:
                    pos = f"on native_copper #{active_nc[0].crystal_id}"
                elif active_chc_cpr and random.random() < 0.3:
                    pos = f"on chalcocite #{active_chc_cpr[0].crystal_id}"
                c = self.nucleate("cuprite", position=pos, sigma=sigma_cpr)
                self.log.append(f"  ✦ NUCLEATION: Cuprite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cpr:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, O₂={self.conditions.fluid.O2:.1f})")

        # Azurite nucleation — Cu + high CO₃ + O₂.
        # Grows on cuprite or free on wall.
        sigma_azr = self.conditions.supersaturation_azurite()
        existing_azr = [c for c in self.crystals if c.mineral == "azurite" and c.active]
        if sigma_azr > 1.4 and not self._at_nucleation_cap("azurite"):
            if not existing_azr or (sigma_azr > 2.0 and random.random() < 0.25):
                pos = "vug wall"
                active_cpr_azr = [c for c in self.crystals if c.mineral == "cuprite" and c.active]
                active_nc_azr = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
                if active_cpr_azr and random.random() < 0.4:
                    pos = f"on cuprite #{active_cpr_azr[0].crystal_id}"
                elif active_nc_azr and random.random() < 0.3:
                    pos = f"on native_copper #{active_nc_azr[0].crystal_id}"
                c = self.nucleate("azurite", position=pos, sigma=sigma_azr)
                self.log.append(f"  ✦ NUCLEATION: Azurite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_azr:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, CO₃={self.conditions.fluid.CO3:.0f})")

        # Chrysocolla nucleation — Cu²⁺ + SiO₂ at low-T oxidation, the
        # cyan finale of the copper paragenesis. Wins over azurite/
        # malachite when CO₃ has dropped and SiO₂ has risen (see
        # supersaturation_chrysocolla's CO₃/SiO₂ gate). Prefers to
        # crust over cuprite or native copper and to pseudomorph
        # azurite once the pCO₂ drop arrives — the Bisbee story.
        sigma_chry = self.conditions.supersaturation_chrysocolla()
        existing_chry = [c for c in self.crystals if c.mineral == "chrysocolla" and c.active]
        if sigma_chry > 1.2 and not self._at_nucleation_cap("chrysocolla"):
            if not existing_chry or (sigma_chry > 1.8 and random.random() < 0.25):
                pos = "vug wall"
                active_azr_chry = [c for c in self.crystals if c.mineral == "azurite" and c.active]
                dissolving_azr_chry = [c for c in self.crystals if c.mineral == "azurite" and c.dissolved]
                active_cpr_chry = [c for c in self.crystals if c.mineral == "cuprite" and c.active]
                active_nc_chry = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
                # Pseudomorph-after-azurite preferred when azurite has
                # just dissolved (pCO₂ drop) AND silica is available.
                if dissolving_azr_chry and random.random() < 0.6:
                    pos = f"pseudomorph after azurite #{dissolving_azr_chry[0].crystal_id}"
                elif active_azr_chry and random.random() < 0.3:
                    pos = f"on azurite #{active_azr_chry[0].crystal_id}"
                elif active_cpr_chry and random.random() < 0.5:
                    pos = f"on cuprite #{active_cpr_chry[0].crystal_id}"
                elif active_nc_chry and random.random() < 0.4:
                    pos = f"on native_copper #{active_nc_chry[0].crystal_id}"
                c = self.nucleate("chrysocolla", position=pos, sigma=sigma_chry)
                self.log.append(f"  ✦ NUCLEATION: Chrysocolla #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_chry:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, SiO₂={self.conditions.fluid.SiO2:.0f}, "
                              f"CO₃={self.conditions.fluid.CO3:.0f})")

        # Native copper nucleation — Cu + strongly reducing + low S.
        # Grows on chalcocite/bornite or free on wall when the fluid is
        # very reducing.
        sigma_nc = self.conditions.supersaturation_native_copper()
        existing_nc_nuc = [c for c in self.crystals if c.mineral == "native_copper" and c.active]
        if sigma_nc > 1.6 and not self._at_nucleation_cap("native_copper"):
            if not existing_nc_nuc or (sigma_nc > 2.2 and random.random() < 0.15):
                pos = "vug wall"
                active_chc_nc = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                active_brn_nc = [c for c in self.crystals if c.mineral == "bornite" and c.active]
                if active_chc_nc and random.random() < 0.4:
                    pos = f"on chalcocite #{active_chc_nc[0].crystal_id}"
                elif active_brn_nc and random.random() < 0.3:
                    pos = f"on bornite #{active_brn_nc[0].crystal_id}"
                c = self.nucleate("native_copper", position=pos, sigma=sigma_nc)
                self.log.append(f"  ✦ NUCLEATION: Native copper #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_nc:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, O₂={self.conditions.fluid.O2:.2f})")

        # Native gold nucleation — Au + tolerant of both Eh regimes.
        # Substrate preference: chalcocite (Bisbee supergene Au often
        # rides on the chalcocite enrichment blanket) > pyrite (orogenic
        # gold-on-pyrite habit) > bornite > free vug wall.
        sigma_au = self.conditions.supersaturation_native_gold()
        existing_au = [c for c in self.crystals if c.mineral == "native_gold" and c.active]
        if sigma_au > 1.0 and not self._at_nucleation_cap("native_gold"):
            if not existing_au or (sigma_au > 1.5 and random.random() < 0.2):
                pos = "vug wall"
                active_chc_au = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                active_py_au = [c for c in self.crystals if c.mineral == "pyrite" and c.active]
                active_brn_au = [c for c in self.crystals if c.mineral == "bornite" and c.active]
                if active_chc_au and random.random() < 0.4:
                    pos = f"on chalcocite #{active_chc_au[0].crystal_id}"
                elif active_py_au and random.random() < 0.25:
                    pos = f"on pyrite #{active_py_au[0].crystal_id}"
                elif active_brn_au and random.random() < 0.2:
                    pos = f"on bornite #{active_brn_au[0].crystal_id}"
                c = self.nucleate("native_gold", position=pos, sigma=sigma_au)
                self.log.append(f"  ✦ NUCLEATION: Native gold #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_au:.2f}, "
                              f"Au={self.conditions.fluid.Au:.2f} ppm)")

        # Bornite nucleation — Cu + Fe + S, Cu:Fe > 2:1 (competes with
        # chalcopyrite for the same elements).
        sigma_brn = self.conditions.supersaturation_bornite()
        existing_brn = [c for c in self.crystals if c.mineral == "bornite" and c.active]
        if sigma_brn > 1.0 and not self._at_nucleation_cap("bornite"):
            if not existing_brn or (sigma_brn > 1.7 and random.random() < 0.2):
                pos = "vug wall"
                dissolving_cp_brn = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
                active_cp_brn = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if dissolving_cp_brn and random.random() < 0.5:
                    pos = f"on chalcopyrite #{dissolving_cp_brn[0].crystal_id}"
                elif active_cp_brn and random.random() < 0.3:
                    pos = f"on chalcopyrite #{active_cp_brn[0].crystal_id}"
                c = self.nucleate("bornite", position=pos, sigma=sigma_brn)
                self.log.append(f"  ✦ NUCLEATION: Bornite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_brn:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, Fe={self.conditions.fluid.Fe:.0f})")

        # Chalcocite nucleation — Cu-rich + S + low T + reducing.
        # The pseudomorph thief: prefers chalcopyrite or bornite hosts
        # to replace them atom-by-atom (the supergene enrichment story).
        sigma_chc = self.conditions.supersaturation_chalcocite()
        existing_chc = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
        if sigma_chc > 1.1 and not self._at_nucleation_cap("chalcocite"):
            if not existing_chc or (sigma_chc > 1.7 and random.random() < 0.25):
                pos = "vug wall"
                dissolving_cp_chc = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
                active_cp_chc = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                dissolving_brn = [c for c in self.crystals if c.mineral == "bornite" and c.dissolved]
                active_brn = [c for c in self.crystals if c.mineral == "bornite" and c.active]
                if dissolving_cp_chc and random.random() < 0.6:
                    pos = f"on chalcopyrite #{dissolving_cp_chc[0].crystal_id}"
                elif active_cp_chc and random.random() < 0.4:
                    pos = f"on chalcopyrite #{active_cp_chc[0].crystal_id}"
                elif dissolving_brn and random.random() < 0.6:
                    pos = f"on bornite #{dissolving_brn[0].crystal_id}"
                elif active_brn and random.random() < 0.4:
                    pos = f"on bornite #{active_brn[0].crystal_id}"
                c = self.nucleate("chalcocite", position=pos, sigma=sigma_chc)
                self.log.append(f"  ✦ NUCLEATION: Chalcocite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_chc:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, S={self.conditions.fluid.S:.0f})")

        # Covellite nucleation — Cu + S-rich + low T (transition zone).
        # Often nucleates on chalcocite at the S-Cu stoichiometry break.
        sigma_cov = self.conditions.supersaturation_covellite()
        existing_cov = [c for c in self.crystals if c.mineral == "covellite" and c.active]
        if sigma_cov > 1.2 and not self._at_nucleation_cap("covellite"):
            if not existing_cov or (sigma_cov > 1.7 and random.random() < 0.2):
                pos = "vug wall"
                active_chc = [c for c in self.crystals if c.mineral == "chalcocite" and c.active]
                active_cp_cov = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.active]
                if active_chc and random.random() < 0.5:
                    pos = f"on chalcocite #{active_chc[0].crystal_id}"
                elif active_cp_cov and random.random() < 0.3:
                    pos = f"on chalcopyrite #{active_cp_cov[0].crystal_id}"
                c = self.nucleate("covellite", position=pos, sigma=sigma_cov)
                self.log.append(f"  ✦ NUCLEATION: Covellite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cov:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, S={self.conditions.fluid.S:.0f})")

        # Anglesite nucleation — Pb + oxidized S + O₂ (supergene).
        # Strongly paragenetic — prefers dissolving/oxidizing galena.
        sigma_ang = self.conditions.supersaturation_anglesite()
        existing_ang = [c for c in self.crystals if c.mineral == "anglesite" and c.active]
        if sigma_ang > 1.1 and not self._at_nucleation_cap("anglesite"):
            if not existing_ang or (sigma_ang > 1.8 and random.random() < 0.25):
                pos = "vug wall"
                dissolving_gal = [c for c in self.crystals if c.mineral == "galena" and (c.dissolved or random.random() < 0.6)]
                active_gal = [c for c in self.crystals if c.mineral == "galena" and c.active]
                if dissolving_gal and random.random() < 0.6:
                    pos = f"on galena #{dissolving_gal[0].crystal_id}"
                elif active_gal and random.random() < 0.4:
                    pos = f"on galena #{active_gal[0].crystal_id}"
                c = self.nucleate("anglesite", position=pos, sigma=sigma_ang)
                self.log.append(f"  ✦ NUCLEATION: Anglesite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ang:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, S={self.conditions.fluid.S:.0f})")

        # Cerussite nucleation — Pb + CO₃ (supergene).
        # Final stable Pb phase in carbonate groundwater. Prefers
        # anglesite or galena hosts (replacement pseudomorph).
        sigma_cer = self.conditions.supersaturation_cerussite()
        existing_cer = [c for c in self.crystals if c.mineral == "cerussite" and c.active]
        if sigma_cer > 1.0 and not self._at_nucleation_cap("cerussite"):
            if not existing_cer or (sigma_cer > 1.8 and random.random() < 0.3):
                pos = "vug wall"
                dissolving_ang = [c for c in self.crystals if c.mineral == "anglesite" and c.dissolved]
                dissolving_gal_c = [c for c in self.crystals if c.mineral == "galena" and c.dissolved]
                active_gal_c = [c for c in self.crystals if c.mineral == "galena" and c.active]
                if dissolving_ang and random.random() < 0.7:
                    pos = f"on anglesite #{dissolving_ang[0].crystal_id}"
                elif dissolving_gal_c and random.random() < 0.5:
                    pos = f"on galena #{dissolving_gal_c[0].crystal_id}"
                elif active_gal_c and random.random() < 0.3:
                    pos = f"on galena #{active_gal_c[0].crystal_id}"
                c = self.nucleate("cerussite", position=pos, sigma=sigma_cer)
                self.log.append(f"  ✦ NUCLEATION: Cerussite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_cer:.2f}, "
                              f"Pb={self.conditions.fluid.Pb:.0f}, CO3={self.conditions.fluid.CO3:.0f})")

        # Pyromorphite nucleation — Pb + P + Cl (supergene, P-gated).
        # Can replace existing cerussite or galena when P-bearing water
        # arrives. max_nucleation_count=6 — these often form in groups.
        sigma_pyr = self.conditions.supersaturation_pyromorphite()
        existing_pyr = [c for c in self.crystals if c.mineral == "pyromorphite" and c.active]
        if sigma_pyr > 1.2 and not self._at_nucleation_cap("pyromorphite"):
            if not existing_pyr or (sigma_pyr > 1.8 and random.random() < 0.3):
                pos = "vug wall"
                dissolving_cer = [c for c in self.crystals if c.mineral == "cerussite" and c.dissolved]
                active_cer = [c for c in self.crystals if c.mineral == "cerussite" and c.active]
                existing_goe_pyr = [c for c in self.crystals if c.mineral == "goethite" and c.active]
                if dissolving_cer and random.random() < 0.6:
                    pos = f"on cerussite #{dissolving_cer[0].crystal_id}"
                elif active_cer and random.random() < 0.3:
                    pos = f"on cerussite #{active_cer[0].crystal_id}"
                elif existing_goe_pyr and random.random() < 0.3:
                    pos = f"on goethite #{existing_goe_pyr[0].crystal_id}"
                c = self.nucleate("pyromorphite", position=pos, sigma=sigma_pyr)
                self.log.append(f"  ✦ NUCLEATION: Pyromorphite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_pyr:.2f}, "
                              f"P={self.conditions.fluid.P:.1f}, Cl={self.conditions.fluid.Cl:.0f})")

        # Vanadinite nucleation — Pb + V + Cl (supergene, V-gated).
        # Classic iron-oxide-on-goethite habit. Grows on goethite or
        # free on wall.
        sigma_vnd = self.conditions.supersaturation_vanadinite()
        existing_vnd = [c for c in self.crystals if c.mineral == "vanadinite" and c.active]
        if sigma_vnd > 1.3 and not self._at_nucleation_cap("vanadinite"):
            if not existing_vnd or (sigma_vnd > 1.8 and random.random() < 0.3):
                pos = "vug wall"
                existing_goe_vnd = [c for c in self.crystals if c.mineral == "goethite" and c.active]
                dissolving_cer_v = [c for c in self.crystals if c.mineral == "cerussite" and c.dissolved]
                if existing_goe_vnd and random.random() < 0.7:
                    pos = f"on goethite #{existing_goe_vnd[0].crystal_id}"
                elif dissolving_cer_v and random.random() < 0.4:
                    pos = f"on cerussite #{dissolving_cer_v[0].crystal_id}"
                c = self.nucleate("vanadinite", position=pos, sigma=sigma_vnd)
                self.log.append(f"  ✦ NUCLEATION: Vanadinite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_vnd:.2f}, "
                              f"V={self.conditions.fluid.V:.1f}, Pb={self.conditions.fluid.Pb:.0f})")

        # Tourmaline nucleation — Na + B + Al + SiO₂ (B-gated).
        # Threshold nucleation_sigma=1.3 is the pegmatite gate: needs
        # boron accumulated past saturation, which no other current
        # mineral consumes, so B builds freely in the pegmatite fluid.
        # Schorl (Fe²⁺-dominant black) nucleates first when Fe is high;
        # later zones transition to elbaite varieties as Fe depletes
        # and Li accumulates in residual pocket fluid.
        sigma_tml = self.conditions.supersaturation_tourmaline()
        existing_tml = [c for c in self.crystals if c.mineral == "tourmaline" and c.active]
        if sigma_tml > 1.3 and not self._at_nucleation_cap("tourmaline"):
            if not existing_tml or (sigma_tml > 2.0 and random.random() < 0.25):
                pos = "vug wall"
                # Can nucleate on quartz or feldspar substrate in pegmatites
                existing_feldspar = [c for c in self.crystals if c.mineral == "feldspar" and c.active]
                if existing_quartz and random.random() < 0.4:
                    pos = f"on quartz #{existing_quartz[0].crystal_id}"
                elif existing_feldspar and random.random() < 0.4:
                    pos = f"on feldspar #{existing_feldspar[0].crystal_id}"
                c = self.nucleate("tourmaline", position=pos, sigma=sigma_tml)
                # Preview variety label from current fluid
                f = self.conditions.fluid
                if f.Cu > 1.0: tag = "Paraíba"
                elif f.Li > 10 and f.Mn > 0.3: tag = "rubellite"
                elif f.Li > 10 and (f.Cr > 0.5 or f.V > 1.0): tag = "verdelite"
                elif f.Fe > 15 and f.Li < 5: tag = "schorl"
                elif f.Li > 10: tag = "elbaite"
                else: tag = "mixed"
                self.log.append(f"  ✦ NUCLEATION: Tourmaline #{c.crystal_id} ({tag}) on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_tml:.2f}, "
                              f"B={f.B:.0f} ppm, Fe={f.Fe:.0f}, Li={f.Li:.0f})")

        # Topaz nucleation — Al + SiO₂ + F (F-gated).
        # Threshold nucleation_sigma=1.4 is the Ouro Preto gate — early
        # quartz grows alone while fluorine accumulates; only when F
        # crosses saturation does topaz appear. Can nucleate on quartz
        # (vein-lining paragenesis — quartz first, topaz grows on the
        # quartz surface after F-rich fluid arrives).
        sigma_tpz = self.conditions.supersaturation_topaz()
        existing_tpz = [c for c in self.crystals if c.mineral == "topaz" and c.active]
        if sigma_tpz > 1.4 and not self._at_nucleation_cap("topaz"):
            if not existing_tpz or (sigma_tpz > 2.0 and random.random() < 0.3):
                pos = "vug wall"
                if existing_quartz and random.random() < 0.5:
                    pos = f"on quartz #{existing_quartz[0].crystal_id}"
                c = self.nucleate("topaz", position=pos, sigma=sigma_tpz)
                imperial = (self.conditions.fluid.Cr > 3.0)
                flag = " ✨ imperial color window open" if imperial else ""
                self.log.append(f"  ✦ NUCLEATION: Topaz #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_tpz:.2f}, "
                              f"F={self.conditions.fluid.F:.0f} ppm, "
                              f"Cr={self.conditions.fluid.Cr:.1f} ppm){flag}")

        # Rosasite nucleation — Cu-dominant supergene carbonate (Round 9a).
        # Substrate preference: weathering chalcopyrite (Cu source), or
        # bare wall when supergene fluid has cooled and accumulated CO3.
        # Broth-ratio gate is enforced inside supersaturation_rosasite —
        # σ returns 0 when Cu/(Cu+Zn) < 0.5, so we don't double-check here.
        sigma_ros = self.conditions.supersaturation_rosasite()
        if sigma_ros > 1.0 and not self._at_nucleation_cap("rosasite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_cpy = [c for c in self.crystals if c.mineral == "chalcopyrite" and c.dissolved]
                weathering_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.dissolved]
                if weathering_cpy and random.random() < 0.4:
                    pos = f"on weathering chalcopyrite #{weathering_cpy[0].crystal_id}"
                elif weathering_sph and random.random() < 0.3:
                    pos = f"on weathering sphalerite #{weathering_sph[0].crystal_id}"
                c = self.nucleate("rosasite", position=pos, sigma=sigma_ros)
                cu_zn = self.conditions.fluid.Cu + self.conditions.fluid.Zn
                cu_pct = (self.conditions.fluid.Cu / cu_zn * 100) if cu_zn > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Rosasite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_ros:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, Zn={self.conditions.fluid.Zn:.0f}, "
                              f"Cu-fraction={cu_pct:.0f}%) — broth-ratio branch: Cu-dominant")

        # Aurichalcite nucleation — Zn-dominant supergene carbonate (Round 9a).
        # Mirror of rosasite: same parent fluid, opposite ratio. Substrate
        # preference: weathering sphalerite (Zn source), or rosasite (the
        # two species are commonly intergrown at the ratio boundary).
        sigma_aur = self.conditions.supersaturation_aurichalcite()
        if sigma_aur > 1.0 and not self._at_nucleation_cap("aurichalcite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_sph = [c for c in self.crystals if c.mineral == "sphalerite" and c.dissolved]
                active_ros = [c for c in self.crystals if c.mineral == "rosasite" and c.active]
                if weathering_sph and random.random() < 0.4:
                    pos = f"on weathering sphalerite #{weathering_sph[0].crystal_id}"
                elif active_ros and random.random() < 0.4:
                    pos = f"adjacent to rosasite #{active_ros[0].crystal_id}"
                c = self.nucleate("aurichalcite", position=pos, sigma=sigma_aur)
                cu_zn = self.conditions.fluid.Cu + self.conditions.fluid.Zn
                zn_pct = (self.conditions.fluid.Zn / cu_zn * 100) if cu_zn > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Aurichalcite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_aur:.2f}, "
                              f"Cu={self.conditions.fluid.Cu:.0f}, Zn={self.conditions.fluid.Zn:.0f}, "
                              f"Zn-fraction={zn_pct:.0f}%) — broth-ratio branch: Zn-dominant")

        # Torbernite nucleation — P-branch of the uranyl anion-competition
        # trio (Round 9b). Substrate preference: weathering uraninite (the
        # primary U source as it oxidizes to U⁶⁺) or bare wall.
        sigma_tor = self.conditions.supersaturation_torbernite()
        if sigma_tor > 1.0 and not self._at_nucleation_cap("torbernite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_urn = [c for c in self.crystals if c.mineral == "uraninite" and c.dissolved]
                if weathering_urn and random.random() < 0.5:
                    pos = f"on weathering uraninite #{weathering_urn[0].crystal_id}"
                c = self.nucleate("torbernite", position=pos, sigma=sigma_tor)
                p_as = self.conditions.fluid.P + self.conditions.fluid.As
                p_pct = (self.conditions.fluid.P / p_as * 100) if p_as > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Torbernite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_tor:.2f}, "
                              f"U={self.conditions.fluid.U:.2f}, P={self.conditions.fluid.P:.1f}, "
                              f"As={self.conditions.fluid.As:.1f}, P-fraction={p_pct:.0f}%) — "
                              f"anion-competition branch: P-dominant")

        # Zeunerite nucleation — As-branch of the uranyl anion-competition
        # trio. Substrate preference: weathering uraninite + arsenopyrite
        # (As source) or adjacent torbernite (isostructural intergrowth).
        sigma_zeu = self.conditions.supersaturation_zeunerite()
        if sigma_zeu > 1.0 and not self._at_nucleation_cap("zeunerite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_urn = [c for c in self.crystals if c.mineral == "uraninite" and c.dissolved]
                weathering_apy = [c for c in self.crystals if c.mineral == "arsenopyrite" and c.dissolved]
                active_tor = [c for c in self.crystals if c.mineral == "torbernite" and c.active]
                if weathering_urn and random.random() < 0.4:
                    pos = f"on weathering uraninite #{weathering_urn[0].crystal_id}"
                elif weathering_apy and random.random() < 0.4:
                    pos = f"on weathering arsenopyrite #{weathering_apy[0].crystal_id}"
                elif active_tor and random.random() < 0.3:
                    pos = f"adjacent to torbernite #{active_tor[0].crystal_id}"
                c = self.nucleate("zeunerite", position=pos, sigma=sigma_zeu)
                p_as = self.conditions.fluid.P + self.conditions.fluid.As
                as_pct = (self.conditions.fluid.As / p_as * 100) if p_as > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Zeunerite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_zeu:.2f}, "
                              f"U={self.conditions.fluid.U:.2f}, P={self.conditions.fluid.P:.1f}, "
                              f"As={self.conditions.fluid.As:.1f}, As-fraction={as_pct:.0f}%) — "
                              f"anion-competition branch: As-dominant")

        # Carnotite nucleation — V-branch of the uranyl anion-competition trio
        # (Round 9c). Substrate preference: weathering uraninite (the U
        # source) or "organic-rich" position via Fe>5 + low-T proxy
        # (real carnotite famously concentrates around petrified wood and
        # carbonaceous shales — the sim doesn't track organic matter as
        # a separate species).
        sigma_car = self.conditions.supersaturation_carnotite()
        if sigma_car > 1.0 and not self._at_nucleation_cap("carnotite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_urn = [c for c in self.crystals if c.mineral == "uraninite" and c.dissolved]
                if weathering_urn and random.random() < 0.5:
                    pos = f"on weathering uraninite #{weathering_urn[0].crystal_id}"
                elif (self.conditions.fluid.Fe > 5
                      and self.conditions.temperature < 30
                      and random.random() < 0.3):
                    pos = "around organic carbon (roll-front position)"
                c = self.nucleate("carnotite", position=pos, sigma=sigma_car)
                anion_total = (self.conditions.fluid.P
                               + self.conditions.fluid.As
                               + self.conditions.fluid.V)
                v_pct = (self.conditions.fluid.V / anion_total * 100) if anion_total > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Carnotite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_car:.2f}, "
                              f"K={self.conditions.fluid.K:.0f}, U={self.conditions.fluid.U:.2f}, "
                              f"V={self.conditions.fluid.V:.1f}, V-fraction={v_pct:.0f}%) — "
                              f"anion-competition branch: V-dominant")

        # Autunite nucleation — Ca-branch of the uranyl cation+anion fork
        # (Round 9d). Substrate preference: weathering uraninite (canonical
        # paragenesis) or fluorapatite/carbonate matrix surfaces (Ca source
        # context). The cation fork (Ca/(Cu+Ca)>0.5) means autunite typically
        # nucleates in plain groundwater fluids while torbernite stays
        # quarantined to Cu-rich mining-district settings.
        sigma_aut = self.conditions.supersaturation_autunite()
        if sigma_aut > 1.0 and not self._at_nucleation_cap("autunite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_urn = [c for c in self.crystals if c.mineral == "uraninite" and c.dissolved]
                if weathering_urn and random.random() < 0.5:
                    pos = f"on weathering uraninite #{weathering_urn[0].crystal_id}"
                c = self.nucleate("autunite", position=pos, sigma=sigma_aut)
                cation_total = self.conditions.fluid.Cu + self.conditions.fluid.Ca
                ca_pct = (self.conditions.fluid.Ca / cation_total * 100) if cation_total > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Autunite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_aut:.2f}, "
                              f"Ca={self.conditions.fluid.Ca:.0f}, U={self.conditions.fluid.U:.2f}, "
                              f"P={self.conditions.fluid.P:.1f}, Ca-fraction={ca_pct:.0f}%) — "
                              f"cation+anion fork: Ca-dominant on the P-branch")

        # Uranospinite nucleation — Ca-branch / As-anion of the autunite-
        # group fork (Round 9e). Substrate preference: weathering uraninite
        # OR weathering arsenopyrite (the As source) OR active zeunerite
        # (the Cu-cation partner often co-mineralizes at Schneeberg).
        sigma_uros = self.conditions.supersaturation_uranospinite()
        if sigma_uros > 1.0 and not self._at_nucleation_cap("uranospinite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_urn = [c for c in self.crystals if c.mineral == "uraninite" and c.dissolved]
                weathering_apy = [c for c in self.crystals if c.mineral == "arsenopyrite" and c.dissolved]
                active_zeu = [c for c in self.crystals if c.mineral == "zeunerite" and c.active]
                if weathering_urn and random.random() < 0.4:
                    pos = f"on weathering uraninite #{weathering_urn[0].crystal_id}"
                elif weathering_apy and random.random() < 0.4:
                    pos = f"on weathering arsenopyrite #{weathering_apy[0].crystal_id}"
                elif active_zeu and random.random() < 0.3:
                    pos = f"adjacent to zeunerite #{active_zeu[0].crystal_id}"
                c = self.nucleate("uranospinite", position=pos, sigma=sigma_uros)
                cation_total = self.conditions.fluid.Cu + self.conditions.fluid.Ca
                ca_pct = (self.conditions.fluid.Ca / cation_total * 100) if cation_total > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Uranospinite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_uros:.2f}, "
                              f"Ca={self.conditions.fluid.Ca:.0f}, U={self.conditions.fluid.U:.2f}, "
                              f"As={self.conditions.fluid.As:.1f}, Ca-fraction={ca_pct:.0f}%) — "
                              f"cation+anion fork: Ca-dominant on the As-branch")

        # Tyuyamunite nucleation — Ca-branch / V-anion of the autunite-group
        # fork (Round 9e). Substrate preference: weathering uraninite OR
        # active carnotite (the K-cation partner — they're commonly
        # intergrown in Colorado Plateau and Tyuya-Muyun deposits) OR
        # roll-front position via Fe>5 + low-T proxy.
        sigma_tyu = self.conditions.supersaturation_tyuyamunite()
        if sigma_tyu > 1.0 and not self._at_nucleation_cap("tyuyamunite"):
            if random.random() < 0.20:
                pos = "vug wall"
                weathering_urn = [c for c in self.crystals if c.mineral == "uraninite" and c.dissolved]
                active_car = [c for c in self.crystals if c.mineral == "carnotite" and c.active]
                if weathering_urn and random.random() < 0.4:
                    pos = f"on weathering uraninite #{weathering_urn[0].crystal_id}"
                elif active_car and random.random() < 0.4:
                    pos = f"adjacent to carnotite #{active_car[0].crystal_id}"
                elif (self.conditions.fluid.Fe > 5
                      and self.conditions.temperature < 30
                      and random.random() < 0.3):
                    pos = "around organic carbon (roll-front position)"
                c = self.nucleate("tyuyamunite", position=pos, sigma=sigma_tyu)
                cation_total = self.conditions.fluid.K + self.conditions.fluid.Ca
                ca_pct = (self.conditions.fluid.Ca / cation_total * 100) if cation_total > 0 else 0
                self.log.append(f"  ✦ NUCLEATION: Tyuyamunite #{c.crystal_id} on {c.position} "
                              f"(T={self.conditions.temperature:.0f}°C, σ={sigma_tyu:.2f}, "
                              f"Ca={self.conditions.fluid.Ca:.0f}, U={self.conditions.fluid.U:.2f}, "
                              f"V={self.conditions.fluid.V:.1f}, Ca-fraction={ca_pct:.0f}%) — "
                              f"cation+anion fork: Ca-dominant on the V-branch")

    def apply_events(self):
        """Apply any events scheduled for this step."""
        for event in self.events:
            if event.step == self.step:
                result = event.apply_fn(self.conditions)
                self.log.append(f"\n  ⚡ EVENT: {event.name}")
                self.log.append(f"     {result}")
                self.log.append("")
    
    def ambient_cooling(self, rate: float = 1.5):
        """Default ambient cooling per step."""
        self.conditions.temperature -= rate * random.uniform(0.8, 1.2)
        self.conditions.temperature = max(self.conditions.temperature, 25)

        # pH recovery toward equilibrium — scaled by flow rate.
        # Fresh fluid flushing through the vug dilutes acid and restores
        # pH; a sealed pocket can't exchange fluid, so acidity persists
        # until mineral reactions buffer it. Recovery rate 0.1/step at
        # flow_rate=1.0, scaling down to near-zero at flow_rate~0.1
        # (sealed pocket). This preserves realistic kaolinization
        # windows in pegmatite pockets without breaking scenarios that
        # have quick acid pulses at normal flow.
        if self.conditions.fluid.pH < 6.5:
            recovery = 0.1 * min(self.conditions.flow_rate / 1.0, 2.0)
            self.conditions.fluid.pH += recovery
        
        # Flow rate decays toward normal
        if self.conditions.flow_rate > 1.0:
            self.conditions.flow_rate *= 0.9
        
        # Slight fluid evolution — elements deplete as minerals grow
        active_quartz = [c for c in self.crystals if c.mineral == "quartz" and c.active]
        if active_quartz:
            depletion = sum(c.zones[-1].thickness_um if c.zones else 0 for c in active_quartz) * 0.1
            self.conditions.fluid.SiO2 = max(self.conditions.fluid.SiO2 - depletion, 10)
        
        # Sulfide growth depletes Fe, S, Cu, Zn
        active_sulfides = [c for c in self.crystals if c.mineral in ("pyrite", "chalcopyrite", "sphalerite") and c.active]
        for c in active_sulfides:
            if c.zones:
                dep = c.zones[-1].thickness_um * 0.05
                self.conditions.fluid.S = max(self.conditions.fluid.S - dep, 0)
                self.conditions.fluid.Fe = max(self.conditions.fluid.Fe - dep * 0.5, 0)
                if c.mineral == "chalcopyrite":
                    self.conditions.fluid.Cu = max(self.conditions.fluid.Cu - dep * 0.8, 0)
                if c.mineral == "sphalerite":
                    self.conditions.fluid.Zn = max(self.conditions.fluid.Zn - dep * 0.8, 0)
    
    def check_enclosure(self):
        """Check if growing crystals have enclosed smaller crystals.
        
        This is the Sweetwater mechanism: pyrite forms first, then calcite 
        grows around it. The pyrite ends up INSIDE the calcite — not because 
        it grew there, but because the calcite swallowed it.
        
        Rule: if crystal A is growing and crystal B is:
          1. Smaller than A
          2. Positioned on the same surface or on A itself
          3. Crystal B has stopped growing (inactive or very slow)
        Then A can enclose B.
        """
        for grower in self.crystals:
            if not grower.active or grower.c_length_mm < 0.5:
                continue
            if grower.enclosed_by is not None:
                continue  # already enclosed itself
            
            for candidate in self.crystals:
                if candidate.crystal_id == grower.crystal_id:
                    continue
                if candidate.enclosed_by is not None:
                    continue  # already enclosed
                if candidate.crystal_id in grower.enclosed_crystals:
                    continue  # already swallowed this one
                
                # Can this grower enclose this candidate?
                # Conditions: grower must be significantly larger
                # and candidate must be adjacent (same position, or on grower)
                size_ratio = grower.c_length_mm / max(candidate.c_length_mm, 0.001)
                
                adjacent = (
                    candidate.position == grower.position or  # same wall
                    f"#{grower.crystal_id}" in candidate.position or  # candidate is ON grower
                    grower.position == candidate.position  # same spot
                )
                
                # Require the candidate to have actually lived a bit
                # before it can be swallowed. Without this, a just-
                # nucleated crystal with zero zones qualifies on step 1
                # and gets enveloped before it grows a single face — a
                # loop of nucleate-then-instantly-enclose piles up
                # hundreds of inclusions in a handful of steps. Real
                # Sweetwater-style pyrite needs time to exhaust its
                # chemistry and stop growing before the calcite takes
                # it.
                if not candidate.zones or len(candidate.zones) < 3:
                    continue
                recent_growth = sum(z.thickness_um for z in candidate.zones[-3:])
                candidate_slowing = recent_growth < 3.0  # barely growing
                
                if size_ratio > 3.0 and adjacent and candidate_slowing:
                    # Enclosure event!
                    grower.enclosed_crystals.append(candidate.crystal_id)
                    grower.enclosed_at_step.append(self.step)
                    candidate.enclosed_by = grower.crystal_id
                    candidate.active = False  # can't grow once enclosed
                    
                    self.log.append(
                        f"  💎 ENCLOSURE: {grower.mineral.capitalize()} #{grower.crystal_id} "
                        f"({grower.c_length_mm:.1f}mm) has grown around "
                        f"{candidate.mineral} #{candidate.crystal_id} ({candidate.c_length_mm:.2f}mm). "
                        f"The {candidate.mineral} is now an inclusion inside the {grower.mineral}."
                    )
    
    def check_liberation(self):
        """Check if dissolution has freed enclosed crystals.
        
        When a host crystal dissolves back past the point where it 
        enclosed something, the inclusion is freed. The pyrite that was 
        trapped inside calcite is exposed again when acid eats the calcite.
        
        Track enclosure by the host's size at enclosure time. If the host
        dissolves below that size, the inclusion is liberated.
        """
        for host in self.crystals:
            if not host.enclosed_crystals:
                continue
            if not host.dissolved:
                continue  # only check hosts that are actively dissolving
            
            # Check each enclosed crystal — was it enclosed when host was bigger?
            freed = []
            for i, (enc_id, enc_step) in enumerate(zip(host.enclosed_crystals, host.enclosed_at_step)):
                enc_crystal = next((x for x in self.crystals if x.crystal_id == enc_id), None)
                if not enc_crystal:
                    continue
                
                # Estimate host size at enclosure time
                # Find the zone closest to enc_step
                host_size_at_enc = 0
                for z in host.zones:
                    if z.step <= enc_step:
                        host_size_at_enc += z.thickness_um
                
                # If host has dissolved back past the enclosure size, free the crystal
                if host.total_growth_um < host_size_at_enc * 0.7:
                    freed.append(i)
                    enc_crystal.enclosed_by = None
                    enc_crystal.active = True  # can grow again!
                    self.log.append(
                        f"  🔓 LIBERATION: {enc_crystal.mineral} #{enc_id} freed from "
                        f"dissolving {host.mineral} #{host.crystal_id}! "
                        f"The inclusion is exposed again and can resume growth."
                    )
            
            # Remove freed crystals from enclosure list (reverse order to preserve indices)
            for i in sorted(freed, reverse=True):
                host.enclosed_crystals.pop(i)
                host.enclosed_at_step.pop(i)
    
    def check_liberation(self):
        """Check if dissolution of a host crystal frees enclosed inclusions.
        
        Professor's insight: if you track enclosures, you need to track
        liberation too. When the enclosing crystal dissolves back past
        the point where it swallowed the inclusion, the inclusion is freed
        and can resume growing. The outer enclosures dissolve first —
        last in, first out.
        """
        for host in self.crystals:
            if not host.enclosed_crystals:
                continue
            if not host.dissolved:
                continue
            
            # Check if dissolution has eaten back enough to free inclusions
            # Compare current size to size at time of enclosure
            # Liberation happens when the host shrinks below the size it was
            # when it swallowed the inclusion
            to_free = []
            for enc_id, enc_step in zip(host.enclosed_crystals, host.enclosed_at_step):
                # Estimate host size at enclosure time
                # (sum of growth up to that step)
                size_at_enclosure = 0
                for z in host.zones:
                    if z.step <= enc_step:
                        size_at_enclosure += z.thickness_um
                
                # If host has dissolved back past enclosure size, free the inclusion
                if host.total_growth_um < size_at_enclosure * 0.8:  # 80% threshold
                    to_free.append(enc_id)
            
            for enc_id in to_free:
                enc_crystal = next((c for c in self.crystals if c.crystal_id == enc_id), None)
                if enc_crystal:
                    enc_crystal.enclosed_by = None
                    enc_crystal.active = True  # can grow again!
                    
                    # Remove from host's enclosure lists (paired removal)
                    if enc_id in host.enclosed_crystals:
                        idx = host.enclosed_crystals.index(enc_id)
                        host.enclosed_crystals.pop(idx)
                        if idx < len(host.enclosed_at_step):
                            host.enclosed_at_step.pop(idx)
                    
                    self.log.append(
                        f"  🔓 LIBERATION: {enc_crystal.mineral} #{enc_id} freed from "
                        f"dissolving {host.mineral} #{host.crystal_id}! "
                        f"The {enc_crystal.mineral} can grow again."
                    )
    
    def dissolve_wall(self):
        """Check if acid conditions are dissolving the vug wall.

        This is the key feedback loop Professor identified:
        Acid enters → dissolves carbonate wall → neutralizes acid +
        releases Ca²⁺/CO₃²⁻ → supersaturates fluid → rapid crystal growth.
        The vug enlarges as its crystals grow. The room makes the furniture.

        Always calls wall.dissolve() so the wall's reactivity slider
        (Creative mode) can drive a small water-only dissolution path
        even at neutral pH. wall.dissolve() short-circuits when
        reactivity=1.0 (default) AND pH ≥ 5.5, so non-reactive scenarios
        are unaffected.
        """
        wall = self.conditions.wall

        # Acid strength is the gap below the carbonate-attack pH threshold.
        # Negative when pH ≥ 5.5; clipped to 0 in wall.dissolve().
        acid_strength = max(0.0, 5.5 - self.conditions.fluid.pH)

        # Skip the call entirely when there is no work to do — neutral
        # fluid AND default reactivity. Avoids logging noise.
        if acid_strength <= 0.0 and wall.reactivity <= 1.0:
            return
        
        # Record pre-dissolution supersaturation for comparison
        pre_sigma_cal = self.conditions.supersaturation_calcite()
        pre_Ca = self.conditions.fluid.Ca
        
        result = wall.dissolve(acid_strength, self.conditions.fluid)

        if result["dissolved"]:
            # Distribute the radial dissolution across unblocked wall cells.
            # Cells shielded by acid-resistant crystal growth don't erode,
            # concentrating the acid attack on the exposed slices — the
            # vug becomes lopsided as the deposit history accrues.
            blocked = self._wall_cells_blocked_by_crystals()
            self.wall_state.erode_cells(result['rate_mm'], blocked)

            post_sigma_cal = self.conditions.supersaturation_calcite()

            self.log.append(f"  🧱 WALL DISSOLUTION: {result['rate_mm']:.2f} mm of {wall.composition} dissolved")
            if blocked:
                self.log.append(f"     {len(blocked)} cell{'s' if len(blocked) != 1 else ''} shielded by acid-resistant crystal growth")
            self.log.append(f"     pH {result['ph_before']:.1f} → {result['ph_after']:.1f} (carbonate buffering)")
            self.log.append(f"     Released: Ca²⁺ +{result['ca_released']:.0f} ppm, "
                          f"CO₃²⁻ +{result['co3_released']:.0f} ppm, "
                          f"Fe +{result['fe_released']:.1f}, Mn +{result['mn_released']:.1f}")
            self.log.append(f"     Vug diameter: {result['vug_diameter']:.1f} mm "
                          f"(+{result['total_dissolved']:.1f} mm total enlargement)")
            
            # Flag the supersaturation spike if significant
            if post_sigma_cal > pre_sigma_cal * 1.3 and post_sigma_cal > 1.0:
                self.log.append(f"     ⚡ SUPERSATURATION SPIKE: σ(Cal) {pre_sigma_cal:.2f} → "
                              f"{post_sigma_cal:.2f} — rapid calcite growth expected!")
    
    def run_step(self) -> List[str]:
        """Execute one time step."""
        self.log = []
        self.step += 1

        # Phase C v1: events apply to conditions (= equator ring fluid
        # via aliasing). Snapshot before so the delta can be propagated
        # to non-equator rings — otherwise a global event pulse never
        # reaches the rings where crystals are actually growing.
        snap = self._snapshot_global()
        self.apply_events()
        self._propagate_global_delta(snap)

        # Track dolomite saturation crossings for the Kim 2023 cycle
        # mechanism — must run after events (which set chemistry) and
        # before crystal growth (which reads the cycle count).
        self.conditions.update_dol_cycles()

        # Wall dissolution BEFORE crystal growth — this is the feedback loop
        # Acid attacks wall → releases Ca/CO3 → supersaturates → crystals grow fast.
        # Same propagate-to-rings treatment as events.
        snap = self._snapshot_global()
        self.dissolve_wall()
        self._propagate_global_delta(snap)
        
        # Check for new nucleation
        self.check_nucleation()
        
        # Grow existing crystals
        for crystal in self.crystals:
            if not crystal.active:
                continue

            engine = MINERAL_ENGINES.get(crystal.mineral)
            if not engine:
                continue

            # Universal max-size cap — 2x world record per data/minerals.json.
            # Closes the 321,248% runaway growth bug: crystals that hit the cap
            # retire from growth but remain in the inventory.
            cap_cm = MINERAL_SPEC.get(crystal.mineral, {}).get("max_size_cm")
            if cap_cm is not None and crystal.c_length_mm / 10.0 >= cap_cm:
                crystal.active = False
                self.log.append(
                    f"  ⛔ {crystal.mineral.capitalize()} #{crystal.crystal_id}: "
                    f"reached size cap ({cap_cm:g} cm = 2× world record) — growth halts"
                )
                continue

            # Phase C v1: swap conditions.fluid + temperature to the
            # crystal's ring's values so the engine reads ring-local
            # chemistry. The engine never sees ring_fluids directly —
            # it just observes "the fluid" via conditions, the same
            # interface as before. Mass-balance side effects (Ca/CO3
            # consumption, byproduct release) hit ring_fluids[k]
            # because that's the object swapped in. Restore globals
            # afterward so subsequent code (events, narrators, log)
            # sees the bulk-fluid view.
            ring_idx = crystal.wall_ring_index
            saved_fluid = None
            saved_temp = None
            if (ring_idx is not None
                    and 0 <= ring_idx < len(self.ring_fluids)):
                saved_fluid = self.conditions.fluid
                saved_temp = self.conditions.temperature
                self.conditions.fluid = self.ring_fluids[ring_idx]
                self.conditions.temperature = self.ring_temperatures[ring_idx]
            try:
                zone = engine(crystal, self.conditions, self.step)
            finally:
                if saved_fluid is not None:
                    self.conditions.fluid = saved_fluid
                if saved_temp is not None:
                    # Track any temperature change the engine made so it
                    # mirrors back into the ring's temperature.
                    self.ring_temperatures[ring_idx] = self.conditions.temperature
                    self.conditions.temperature = saved_temp
            if zone:
                crystal.add_zone(zone)
                if zone.thickness_um < 0:
                    self.log.append(f"  ⬇ {crystal.mineral.capitalize()} #{crystal.crystal_id}: "
                                  f"DISSOLUTION {zone.note}")
                elif abs(zone.thickness_um) > 0.5:
                    self.log.append(f"  ▲ {crystal.mineral.capitalize()} #{crystal.crystal_id}: "
                                  f"{crystal.describe_latest_zone()}")

        # Paramorph transitions — convert any crystal whose host fluid has
        # cooled past its phase-transition T (Round 8a-2: argentite →
        # acanthite at 173°C). Preserves habit + dominant_forms + zones;
        # only crystal.mineral changes. First in-place mineral conversion
        # mechanic in the sim — distinct from THERMAL_DECOMPOSITION which
        # destroys the crystal.
        for crystal in self.crystals:
            transition = apply_paramorph_transitions(crystal, self.conditions.temperature, self.step)
            if transition:
                old_m, new_m = transition
                self.log.append(
                    f"  ↻ PARAMORPH: {old_m.capitalize()} #{crystal.crystal_id} "
                    f"→ {new_m} (T dropped to {self.conditions.temperature:.0f}°C, "
                    f"crossed {old_m}/{new_m} phase boundary; cubic external form preserved)"
                )

        # Water-solubility metastability — Round 8e (Apr 2026). Chalcanthite
        # (CuSO₄·5H₂O) is the most water-soluble mineral in the sim;
        # specimens re-dissolve when the host fluid becomes more dilute
        # (salinity < 4) OR less acidic (pH > 5). Distinct from
        # THERMAL_DECOMPOSITION (high-T destruction) and PARAMORPH_
        # TRANSITIONS (in-place mineral change) — this is just
        # solubility, the geological truth that every chalcanthite
        # is a temporary victory over entropy.
        for crystal in self.crystals:
            if crystal.mineral != "chalcanthite" or crystal.dissolved or not crystal.active:
                continue
            if self.conditions.fluid.salinity < 4.0 or self.conditions.fluid.pH > 5.0:
                # 40%/step decay, with a 0.5-µm absolute floor below which
                # the asymptotic decay collapses to full dissolution
                # (otherwise total_growth_um decays toward 0 forever).
                dissolved_um = min(5.0, crystal.total_growth_um * 0.4)
                if crystal.total_growth_um < 0.5:
                    dissolved_um = crystal.total_growth_um
                crystal.total_growth_um -= dissolved_um
                crystal.c_length_mm = max(crystal.total_growth_um / 1000.0, 0)
                self.conditions.fluid.Cu += dissolved_um * 0.5
                self.conditions.fluid.S += dissolved_um * 0.5
                if crystal.total_growth_um <= 0:
                    crystal.dissolved = True
                    crystal.active = False
                    self.log.append(
                        f"  💧 RE-DISSOLVED: Chalcanthite #{crystal.crystal_id} "
                        f"completely returned to solution (salinity={self.conditions.fluid.salinity:.1f}, "
                        f"pH={self.conditions.fluid.pH:.1f}) — Cu²⁺ + SO₄²⁻ back in fluid"
                    )
                else:
                    self.log.append(
                        f"  💧 Chalcanthite #{crystal.crystal_id}: re-dissolving "
                        f"({dissolved_um:.1f} µm lost; salinity={self.conditions.fluid.salinity:.1f}, "
                        f"pH={self.conditions.fluid.pH:.1f})"
                    )

        # Alpha-damage any quartz present while uraninite exists in the vug.
        # Each existing zone accumulates dose per step — damage is permanent,
        # persisting even after the uraninite later dissolves away.
        self._apply_radiation_dose()

        # Refresh the topo-map wall state from the current crystal list.
        # Cheap (~120 cells × ~20 crystals/step) and keeps per-cell
        # occupancy consistent with dissolution / enclosure changes below.
        self._repaint_wall_state()

        # Check for enclosure events — larger crystals swallowing smaller ones
        self.check_enclosure()
        
        # Check for liberation events — dissolution freeing enclosed crystals
        self.check_liberation()
        
        # Thermal decomposition — extreme heat destroys low-stability minerals
        decomp_logs = check_thermal_decomposition(self.crystals, self.conditions, self.step)
        if decomp_logs:
            self.log.extend(decomp_logs)
        
        # Ambient cooling — propagate the temperature drop to all rings
        # so non-equator rings cool too.
        snap = self._snapshot_global()
        self.ambient_cooling()
        self._propagate_global_delta(snap)

        # Phase C: inter-ring fluid/temperature diffusion runs at the
        # very end of the step so chemistry exchanges happen against a
        # stable post-events post-growth state. No-op when all rings
        # carry identical values (Laplacian of a constant is zero) —
        # this preserves byte-equality for default scenarios.
        self._diffuse_ring_state()

        return self.log
    
    def format_header(self) -> str:
        """Format the step header."""
        c = self.conditions
        sigma_q = c.supersaturation_quartz()
        sigma_c = c.supersaturation_calcite()
        wall_info = ""
        if c.wall.total_dissolved_mm > 0:
            wall_info = f" │ Vug: {c.wall.vug_diameter_mm:.0f}mm (+{c.wall.total_dissolved_mm:.1f})"
        header = (f"═══ Step {self.step:3d} │ "
                 f"T={c.temperature:6.1f}°C │ "
                 f"P={c.pressure:.2f} kbar │ "
                 f"pH={c.fluid.pH:.1f} │ "
                 f"σ(Qz)={sigma_q:.2f} σ(Cal)={sigma_c:.2f}"
                 f"{wall_info} │ "
                 f"Fluid: {c.fluid.describe()}")
        return header
    
    def format_summary(self) -> str:
        """Final summary of all crystals."""
        lines = ["\n" + "═" * 70]
        lines.append("FINAL VUG INVENTORY")
        lines.append("═" * 70)
        
        # Vug wall stats if dissolution occurred
        w = self.conditions.wall
        if w.total_dissolved_mm > 0:
            orig_diam = w.vug_diameter_mm - w.total_dissolved_mm * 2
            lines.append(f"\nVUG CAVITY")
            lines.append(f"  Host rock: {w.composition}")
            lines.append(f"  Original diameter: {orig_diam:.0f} mm")
            lines.append(f"  Final diameter: {w.vug_diameter_mm:.0f} mm")
            lines.append(f"  Total wall dissolved: {w.total_dissolved_mm:.1f} mm")
            lines.append(f"  The acid made the room. The room grew the crystals.")
        
        for c in self.crystals:
            lines.append(f"\n{c.mineral.upper()} #{c.crystal_id}")
            lines.append(f"  Nucleated: step {c.nucleation_step} at {c.nucleation_temp:.0f}°C")
            lines.append(f"  Position: {c.position}")
            lines.append(f"  Morphology: {c.describe_morphology()}")
            lines.append(f"  Growth zones: {len(c.zones)}")
            lines.append(f"  Total growth: {c.total_growth_um:.0f} µm ({c.c_length_mm:.1f} mm)")
            
            # Fluid inclusions
            fi_count = sum(1 for z in c.zones if z.fluid_inclusion)
            if fi_count:
                fi_types = set(z.inclusion_type for z in c.zones if z.fluid_inclusion)
                lines.append(f"  Fluid inclusions: {fi_count} ({', '.join(fi_types)})")
            
            if c.twinned:
                lines.append(f"  Twinning: {c.twin_law}")
            
            if c.dissolved:
                lines.append(f"  Note: partially dissolved (late-stage undersaturation)")
            
            # Phantom surfaces
            if c.phantom_count > 0:
                lines.append(f"  Phantom boundaries: {c.phantom_count} (dissolution surfaces preserved inside crystal)")
            
            # Enclosure — batch by mineral type
            if c.enclosed_crystals:
                enc_by_mineral = {}
                for enc_id, enc_step in zip(c.enclosed_crystals, c.enclosed_at_step):
                    enc_crystal = next((x for x in self.crystals if x.crystal_id == enc_id), None)
                    if enc_crystal:
                        enc_by_mineral.setdefault(enc_crystal.mineral, []).append(
                            (enc_crystal, enc_step))
                for mineral, group in enc_by_mineral.items():
                    if len(group) <= 2:
                        for enc_crystal, enc_step in group:
                            lines.append(f"  Enclosed: {mineral} #{enc_crystal.crystal_id} "
                                       f"({enc_crystal.c_length_mm:.2f}mm) at step {enc_step}")
                    else:
                        steps = [s for _, s in group]
                        lines.append(f"  Enclosed: {len(group)} {mineral} inclusions "
                                   f"(steps {min(steps)}-{max(steps)})")
            if c.enclosed_by is not None:
                encloser = next((x for x in self.crystals if x.crystal_id == c.enclosed_by), None)
                if encloser:
                    lines.append(f"  ⚠ Now an inclusion inside {encloser.mineral} #{c.enclosed_by}")
            
            # Provenance (for calcite with wall dissolution)
            if c.mineral == "calcite" and c.zones:
                wall_zones = [z for z in c.zones if z.ca_from_wall > 0.1]
                if wall_zones:
                    avg_wall = sum(z.ca_from_wall for z in wall_zones) / len(wall_zones)
                    max_wall = max(z.ca_from_wall for z in wall_zones)
                    lines.append(f"  Provenance: {len(wall_zones)}/{len(c.zones)} zones contain wall-derived Ca²⁺")
                    lines.append(f"    Average wall contribution: {avg_wall*100:.0f}%, peak: {max_wall*100:.0f}%")
                    # Find the transition
                    first_wall_zone = next((z for z in c.zones if z.ca_from_wall > 0.1), None)
                    if first_wall_zone:
                        lines.append(f"    Wall-derived Ca first appears at step {first_wall_zone.step} "
                                   f"(T={first_wall_zone.temperature:.0f}°C)")
            
            # Color prediction
            color = c.predict_color()
            if color != "typical for species":
                lines.append(f"  Color: {color}")
            
            # Fluorescence prediction
            fl = c.predict_fluorescence()
            if fl != "non-fluorescent":
                lines.append(f"  Predicted UV fluorescence: {fl}")
            
            # Temperature range from zones
            if c.zones:
                temps = [z.temperature for z in c.zones]
                lines.append(f"  Growth temperature range: {min(temps):.0f}–{max(temps):.0f}°C")
                
                # Ti-in-quartz geothermometer
                if c.mineral == "quartz":
                    ti_vals = [z.trace_Ti for z in c.zones if z.trace_Ti > 0]
                    if ti_vals:
                        avg_ti = sum(ti_vals) / len(ti_vals)
                        lines.append(f"  Avg Ti-in-quartz: {avg_ti:.3f} ppm "
                                   f"(TitaniQ range: {min(temps):.0f}–{max(temps):.0f}°C)")
        
        lines.append("\n" + "═" * 70)
        
        # Add narrative summary
        narrative = self.narrate()
        if narrative:
            lines.append("\nGEOLOGICAL HISTORY")
            lines.append("─" * 70)
            lines.append(narrative)
            lines.append("═" * 70)
        
        return "\n".join(lines)
    
    def narrate(self) -> str:
        """Generate a legends-mode narrative of the vug's history."""
        if not self.crystals:
            return "The vug remained empty. No minerals precipitated under these conditions."
        
        paragraphs = []
        
        # Opening — what kind of vug is this?
        first_crystal = self.crystals[0]
        start_T = first_crystal.nucleation_temp
        mineral_names = list(set(c.mineral for c in self.crystals))
        
        if start_T > 300:
            setting = "deep hydrothermal"
        elif start_T > 150:
            setting = "moderate-temperature hydrothermal"
        else:
            setting = "low-temperature"
        
        vug_growth = ""
        if self.conditions.wall.total_dissolved_mm > 0:
            vug_growth = (
                f" The cavity itself expanded from {self.conditions.wall.vug_diameter_mm - self.conditions.wall.total_dissolved_mm * 2:.0f}mm "
                f"to {self.conditions.wall.vug_diameter_mm:.0f}mm diameter as acid pulses "
                f"dissolved {self.conditions.wall.total_dissolved_mm:.1f}mm of the "
                f"{self.conditions.wall.composition} host rock."
            )
        
        paragraphs.append(
            f"This vug records a {setting} crystallization history beginning at "
            f"{start_T:.0f}°C. {len(self.crystals)} crystals grew across "
            f"{self.step} time steps, producing an assemblage of "
            f"{', '.join(mineral_names)}.{vug_growth}"
        )
        
        # Tell the story phase by phase
        # Phase 1: first mineral(s) to nucleate
        first_step = min(c.nucleation_step for c in self.crystals)
        first_minerals = [c for c in self.crystals if c.nucleation_step == first_step]
        
        for c in first_minerals:
            if c.mineral == "calcite":
                paragraphs.append(
                    f"Calcite was the first mineral to crystallize, nucleating on the "
                    f"vug wall at {c.nucleation_temp:.0f}°C. "
                    + self._narrate_calcite(c)
                )
            elif c.mineral == "quartz":
                paragraphs.append(
                    f"Quartz nucleated first at {c.nucleation_temp:.0f}°C on the vug wall. "
                    + self._narrate_quartz(c)
                )
            else:
                paragraphs.append(
                    f"{c.mineral.capitalize()} nucleated at {c.nucleation_temp:.0f}°C.")
        
        # Subsequent minerals — what triggered them?
        later_crystals = [c for c in self.crystals if c.nucleation_step > first_step]
        if later_crystals:
            def _triggering_event(step: int):
                for e in self.events:
                    if abs(e.step - step) <= 2:
                        return e
                return None

            # Event-triggered batches come out step-by-step (their language
            # references the specific event). Untriggered nucleations are
            # deferred and then consolidated per-mineral below so a mineral
            # that re-nucleates 30× in a stable brine reads as one sentence
            # instead of 30 repeating lines.
            nuc_steps = sorted(set(c.nucleation_step for c in later_crystals))
            untriggered_by_mineral: Dict[str, List[Crystal]] = {}
            for ns in nuc_steps:
                batch = [c for c in later_crystals if c.nucleation_step == ns]
                batch_names = [c.mineral for c in batch]
                triggering_event = _triggering_event(ns)

                if triggering_event:
                    if "mixing" in triggering_event.name.lower():
                        paragraphs.append(
                            f"A fluid mixing event at step {triggering_event.step} transformed "
                            f"the vug's chemistry. "
                            + self._narrate_mixing_event(batch, triggering_event)
                        )
                    elif "pulse" in triggering_event.name.lower():
                        paragraphs.append(
                            f"A fresh pulse of hydrothermal fluid at step {triggering_event.step} "
                            f"introduced new chemistry. {', '.join(c.capitalize() for c in set(batch_names))} "
                            f"nucleated in response."
                        )
                    elif "tectonic" in triggering_event.name.lower():
                        paragraphs.append(
                            f"A tectonic event at step {triggering_event.step} produced a "
                            f"pressure spike." + self._narrate_tectonic(batch)
                        )
                    else:
                        for c in batch:
                            untriggered_by_mineral.setdefault(c.mineral, []).append(c)
                else:
                    for c in batch:
                        untriggered_by_mineral.setdefault(c.mineral, []).append(c)

            # Reference temp for "stable vs. falling" language: the starting
            # temperature of the first mineral to nucleate.
            ref_T = first_minerals[0].nucleation_temp if first_minerals else None

            for mineral, crystals in untriggered_by_mineral.items():
                crystals.sort(key=lambda c: c.nucleation_step)
                temps = [c.nucleation_temp for c in crystals]
                t_min, t_max = min(temps), max(temps)
                s_min = crystals[0].nucleation_step
                s_max = crystals[-1].nucleation_step
                mineral_cap = mineral.capitalize()

                if len(crystals) == 1:
                    c = crystals[0]
                    # Describe the thermal context of this single event.
                    if ref_T is not None and abs(c.nucleation_temp - ref_T) <= 2:
                        paragraphs.append(
                            f"At {c.nucleation_temp:.0f}°C, {mineral} nucleated at step "
                            f"{c.nucleation_step} — the brine had held its window long "
                            f"enough for saturation to tip over."
                        )
                    elif ref_T is not None and c.nucleation_temp < ref_T - 2:
                        paragraphs.append(
                            f"As temperature continued to fall, {mineral} nucleated at step "
                            f"{c.nucleation_step} ({c.nucleation_temp:.0f}°C)."
                        )
                    else:
                        paragraphs.append(
                            f"{mineral_cap} nucleated at step {c.nucleation_step} "
                            f"({c.nucleation_temp:.0f}°C)."
                        )
                    continue

                # Multiple nucleations of the same mineral with no event
                # attached — consolidate into one sentence.
                if t_max - t_min <= 4:
                    paragraphs.append(
                        f"Between step {s_min} and step {s_max}, {mineral} nucleated "
                        f"{len(crystals)} times as conditions held steady around "
                        f"{t_min:.0f}°C — the window stayed open."
                    )
                else:
                    direction = "cooled" if crystals[0].nucleation_temp > crystals[-1].nucleation_temp else "warmed"
                    paragraphs.append(
                        f"{mineral_cap} nucleated {len(crystals)} times between step "
                        f"{s_min} ({crystals[0].nucleation_temp:.0f}°C) and step "
                        f"{s_max} ({crystals[-1].nucleation_temp:.0f}°C) as the fluid "
                        f"{direction} through its window."
                    )
        
        # Narrate individual crystal stories for the larger ones.
        # Dispatch via _narrate_<mineral> — spec says every mineral must have one.
        significant = [c for c in self.crystals if c.total_growth_um > 100]
        for c in significant:
            fn = getattr(self, f"_narrate_{c.mineral}", None)
            story = fn(c) if fn else ""
            if story and c not in first_minerals:
                paragraphs.append(story)
        
        # Enclosure events — batch by host crystal and enclosed mineral type
        enclosers = [c for c in self.crystals if c.enclosed_crystals]
        for c in enclosers:
            enclosed = []
            for enc_id in c.enclosed_crystals:
                enc = next((x for x in self.crystals if x.crystal_id == enc_id), None)
                if enc:
                    enclosed.append(enc)
            
            if not enclosed:
                continue
            
            # Group by mineral type
            by_mineral = {}
            for enc in enclosed:
                by_mineral.setdefault(enc.mineral, []).append(enc)
            
            for mineral, group in by_mineral.items():
                if len(group) == 1:
                    enc = group[0]
                    paragraphs.append(
                        f"As {c.mineral} #{c.crystal_id} continued to grow, it engulfed "
                        f"{enc.mineral} #{enc.crystal_id} ({enc.c_length_mm:.2f}mm). The "
                        f"{enc.mineral} is now an inclusion — a crystal trapped inside a crystal, "
                        f"recording the moment the {c.mineral}'s growth front overtook it."
                    )
                else:
                    sizes = [f"{e.c_length_mm:.2f}mm" for e in group]
                    paragraphs.append(
                        f"As {c.mineral} #{c.crystal_id} grew, it swallowed {len(group)} "
                        f"{mineral} crystals (sizes: {', '.join(sizes)}). These are now "
                        f"inclusions — a constellation of tiny {mineral} specks frozen "
                        f"inside the {c.mineral}, each marking where a microcrystal nucleated "
                        f"and was overtaken by the larger crystal's advancing growth front."
                    )
            
            # Note any liberated crystals
            freed = [x for x in self.crystals if x.enclosed_by is None and x.active 
                     and any(x.crystal_id not in c.enclosed_crystals for c2 in enclosers)]
            # (liberation is handled in the log, not the narrative — events are ephemeral)
        
        # Phantom growth narrative
        phantom_crystals = [c for c in self.crystals if c.phantom_count > 0]
        for c in phantom_crystals:
            if c.phantom_count >= 2:
                paragraphs.append(
                    f"{c.mineral.capitalize()} #{c.crystal_id} shows {c.phantom_count} phantom "
                    f"boundaries — internal surfaces where acid dissolved the crystal before "
                    f"new growth covered the damage. Each phantom preserves the shape of the "
                    f"crystal at the moment the acid arrived. In a polished section, these "
                    f"appear as ghost outlines nested inside the final crystal — the crystal's "
                    f"autobiography, written in dissolution and regrowth."
                )
            elif c.phantom_count == 1:
                paragraphs.append(
                    f"{c.mineral.capitalize()} #{c.crystal_id} contains a single phantom surface — "
                    f"a dissolution boundary where the crystal was partially eaten and then "
                    f"regrew over the wound. The phantom preserves the crystal's earlier shape "
                    f"as a ghost outline inside the final form."
                )
        
        # Provenance narrative for calcite
        for c in self.crystals:
            if c.mineral == "calcite" and c.zones:
                wall_zones = [z for z in c.zones if z.ca_from_wall > 0.3]
                fluid_zones = [z for z in c.zones if z.ca_from_wall < 0.1 and z.thickness_um > 0]
                if wall_zones and fluid_zones:
                    paragraphs.append(
                        f"The calcite tells two stories in one crystal. Early growth zones "
                        f"are built from the original fluid — Ca²⁺ that traveled through the "
                        f"basin. Later zones are built from recycled wall rock — limestone that "
                        f"was dissolved by acid and reprecipitated. The trace element signature "
                        f"shifts at the boundary: wall-derived zones carry the host rock's Fe "
                        f"and Mn signature, distinct from the fluid-derived zones. A "
                        f"microprobe traverse across this crystal would show the moment the "
                        f"vug started eating itself to feed its children."
                    )
        
        # Closing — what would a collector see?
        paragraphs.append(self._narrate_collectors_view())

        # Random scenarios earn a procedural "discovery" paragraph.
        archetype = getattr(self.conditions, "_random_archetype", None)
        if archetype:
            disc = self._narrate_discovery(archetype)
            if disc:
                paragraphs.append(disc)

        return "\n\n".join(paragraphs)

    def _render_fluid_table(self) -> str:
        """Render the pre-growth fluid as a markdown-style stats block:
        header line (T/P/pH) + element ppm table (descending) + absence callout
        for the marquee elements that are missing.
        """
        fluid = self.conditions.fluid
        T, P, pH = self.conditions.temperature, self.conditions.pressure, fluid.pH

        # Which elements we bother to report (ppm-scale species only)
        candidates = [
            'SiO2', 'Ca', 'CO3', 'Fe', 'Mn', 'Mg', 'Al', 'Ti', 'F', 'S', 'Cl',
            'Zn', 'Cu', 'Pb', 'Mo', 'U', 'Na', 'K', 'Ba', 'Sr', 'Cr', 'P', 'As',
            'V', 'W', 'Ag', 'Au', 'Bi', 'Sb', 'Ni', 'Co', 'B', 'Li', 'Be',
            'Te', 'Se', 'Ge',
        ]
        present, absent = [], []
        # Elements whose *absence* is narratively interesting to call out
        marquee = {'Zn', 'Mo', 'Cu', 'Pb', 'W', 'U', 'Au', 'Ag', 'F', 'S', 'As'}
        for c in candidates:
            val = getattr(fluid, c, 0) or 0
            if val > 0.1:
                present.append((c, val))
            elif c in marquee:
                absent.append(c)
        present.sort(key=lambda kv: -kv[1])

        rows = ["| Element | ppm |", "|---------|-----|"]
        for elem, val in present:
            rows.append(f"| {elem:<7s} | {val:>5.0f} |")
        table = "\n".join(rows)

        abs_line = ""
        if absent:
            abs_line = "\n\n" + ". ".join(f"No {a}" for a in absent) + ". The absence is data too. 🪨"

        header = f"🌡️ {T:.0f}°C at {P:.1f} kbar | pH {pH:.1f}"
        return header + "\n\n" + table + abs_line

    def narrate_preamble(self, archetype: str) -> str:
        """Text-adventure preamble for a random vugg. Second-person, present
        tense, scene-setting. Called *before* the simulation runs so the
        reader enters the cavity as it is: bare walls, fluid at supersaturation,
        nothing yet crystallized. Ends with a chemistry stats table and a
        callout of marquee elements that are absent.
        """
        fluid = self.conditions.fluid
        T, P, pH = self.conditions.temperature, self.conditions.pressure, fluid.pH
        depth_km = max(P * 1.0, 0.1)  # rough: 1 kbar ≈ 1 km crustal overburden

        def have(elem, thresh=0.5):
            return (getattr(fluid, elem, 0) or 0) > thresh

        def ppm(elem):
            return getattr(fluid, elem, 0) or 0

        paragraphs = []

        if archetype == "pegmatite":
            paragraphs.append(
                f"You stand at the mouth of a cavity in cooling granite, deep underground. "
                f"The rock around you bears the weight of {depth_km:.1f} kilometers of crust. "
                f"The air here isn't air — it's supercritical fluid, {T:.0f} degrees, thick with dissolved metal."
            )
            dom_line = []
            if have('Fe', 10):
                dom_line.append(f"The walls gleam wet. Not with water — with iron-rich brine, {ppm('Fe'):.0f} parts per million, the color of old blood if you could see it through the heat shimmer.")
            if have('Cu', 5) and have('U', 10):
                dom_line.append(f"Copper threads through it at {ppm('Cu'):.0f} ppm, and uranium glows invisibly at {ppm('U'):.0f}.")
            elif have('U', 10):
                dom_line.append(f"Uranium glows invisibly at {ppm('U'):.0f} ppm — the cavity is faintly radioactive even before anything precipitates.")
            elif have('Cu', 5):
                dom_line.append(f"Copper threads through it at {ppm('Cu'):.0f} ppm, a warm-blooded metal in a hotter fluid.")
            dom_line.append("The rock itself is warm to the touch. Hot, actually. Everything is hot.")
            paragraphs.append(" ".join(dom_line))
            paragraphs.append(
                "This pocket formed when the granite cracked as it cooled. Magma doesn't shrink quietly — "
                "it fractures, and the last gasp of mineral-rich fluid fills every void. That's where you are now: "
                "inside that last gasp."
            )
            rare = []
            if have('Li', 5): rare.append(f"lithium at {ppm('Li'):.0f} ppm")
            if have('Be', 3): rare.append(f"beryllium at {ppm('Be'):.0f}")
            if have('B',  5): rare.append(f"boron at {ppm('B'):.0f}")
            if have('P',  2): rare.append(f"phosphorus at {ppm('P'):.0f}")
            if rare:
                paragraphs.append(
                    "The broth carries the signature of a rare-element pegmatite: "
                    + ", ".join(rare) + ". These elements ride the same fluid path and rarely end up here by accident."
                )
            paragraphs.append(
                "Nothing has crystallized yet. The walls are bare granite, still dissolving at their margins, "
                "feeding K and Al and SiO₂ back into the mix. The fluid is oversaturated with possibility but "
                "nothing has tipped over the edge."
            )
            paragraphs.append(
                "The temperature is falling. Slowly, imperceptibly, but falling. And when it crosses the right "
                "threshold — when supersaturation finally exceeds nucleation energy — the first crystal will spark "
                "into existence on these bare walls."
            )

        elif archetype == "hydrothermal":
            paragraphs.append(
                f"You stand inside a vein cavity split open in foliated country rock, roughly {depth_km:.1f} kilometers "
                f"below daylight. The walls are dark — slate and quartzite shot through with older, gray-white quartz "
                f"ribbons from earlier fluid pulses. The fluid filling this space is {T:.0f} degrees; hot enough to "
                f"sting, not quite to scald."
            )
            metal = []
            if have('Fe', 5): metal.append(f"Iron rides at {ppm('Fe'):.0f} ppm")
            if have('Mn', 2): metal.append(f"manganese at {ppm('Mn'):.0f}")
            if have('Zn', 5): metal.append(f"zinc at {ppm('Zn'):.0f}")
            if have('Cu', 5): metal.append(f"copper at {ppm('Cu'):.0f}")
            if have('Pb', 5): metal.append(f"lead at {ppm('Pb'):.0f}")
            if metal:
                paragraphs.append(
                    ", ".join(metal)
                    + f". Silica saturates the fluid at roughly {ppm('SiO2'):.0f} ppm — enough that a degree of cooling "
                      "will start to crack out quartz."
                )
            paragraphs.append(
                "This cavity opened when tectonic stress bent the host rock and a fracture propagated through. "
                "Fluid rose from deeper still, following the path of least resistance, and this particular pocket is "
                "where the flow eddied long enough to begin depositing. You're standing in a pause in the plumbing."
            )
            paragraphs.append(
                "The walls are not idle. Hot fluid at pH "
                f"{pH:.1f} is slowly stripping Ca and CO₃ from carbonate seams in the country rock and feeding them "
                "into the broth. The vug is eating its way larger, one millimeter per millennium."
            )
            paragraphs.append(
                "Somewhere upstream, the heat source is dying. This fluid has a finite window. When the broth cools "
                "below quartz's solubility curve, or pH climbs past calcite's, the cavity will begin to fill."
            )

        elif archetype == "supergene":
            paragraphs.append(
                f"You stand inside a cavity maybe ten meters below the ground surface, in the oxidized zone above the "
                f"water table. The air is cool — {T:.0f} degrees, barely warmer than the bedrock. Oxygen-rich rainwater "
                f"has been percolating through for a long time, finding its way down through soil and fractures."
            )
            paragraphs.append(
                "The walls are stained. Rust-orange where iron oxidized, patchy green where copper lingered, "
                "dark where sulfides are still rotting quietly. Everything here has already been something else — the "
                "primary ore that made this zone interesting is being rewritten. "
                f"The fluid carries those rewrites in solution: Zn {ppm('Zn'):.0f}, Pb {ppm('Pb'):.0f}, "
                f"Cu {ppm('Cu'):.0f}, O₂ {fluid.O2:.1f}."
            )
            paragraphs.append(
                "This cavity is a negative-space museum. Oxygen-bearing groundwater attacked the softest parts of the "
                "primary ore, and the walls retreated. What remains is the argument that the ore is making with the "
                "atmosphere."
            )
            secondary = []
            if have('As', 3): secondary.append(f"arsenic at {ppm('As'):.0f} ppm (from arsenopyrite dying somewhere upslope)")
            if have('Mo', 2): secondary.append(f"molybdenum at {ppm('Mo'):.0f} (galena + molybdenite both oxidizing — wulfenite weather)")
            if have('Cl', 5): secondary.append(f"chloride at {ppm('Cl'):.0f} (rain carrying salt air, or an evaporite signature)")
            if secondary:
                paragraphs.append("Trace hints: " + "; ".join(secondary) + ".")
            paragraphs.append(
                "The fluid does not have to cool to precipitate here. It only has to change: shift its pH, lose its "
                "dissolved oxygen, or meet a fresh surface that will let secondary minerals nucleate. Any of those "
                "triggers will do."
            )

        elif archetype == "mvt":
            paragraphs.append(
                f"You stand inside a limestone dissolution cavity — karst, the geologist's word for rock with holes. "
                f"The air is dark and faintly briny. {T:.0f} degrees. The walls are pale Paleozoic limestone, still "
                f"retreating wherever the brine touches them."
            )
            paragraphs.append(
                f"The fluid here is a dense saline brine, roughly {fluid.salinity:.0f}% NaCl, mineralized with base metals. "
                f"Zinc at {ppm('Zn'):.0f} ppm, lead at {ppm('Pb'):.0f}, sulfur at {ppm('S'):.0f} — which in this "
                f"environment means H₂S, the smell of rotten eggs if the brine weren't in the way."
            )
            paragraphs.append(
                "This cavity was dissolved into limestone by an earlier, lower-pH brine. Then a second fluid arrived — "
                "the one you're standing in — bearing metals from a basin possibly hundreds of kilometers away. Two "
                "fluids met; this cavity is where they're still mixing."
            )
            mvt_hints = []
            if have('F', 10): mvt_hints.append(f"fluorite is already saturating ({ppm('F'):.0f} ppm F)")
            if have('Ba', 10): mvt_hints.append(f"barium at {ppm('Ba'):.0f} ppm is a barite near-miss")
            if have('Ag', 1):  mvt_hints.append(f"silver at {ppm('Ag'):.0f} hints at argentiferous galena to come")
            if mvt_hints:
                paragraphs.append("; ".join(h[0].upper() + h[1:] for h in mvt_hints) + ".")
            paragraphs.append(
                "The limestone doesn't fight back. It dissolves peacefully, releasing Ca²⁺ and CO₃²⁻ into the broth. "
                "The vug grows slowly larger, and every Ca²⁺ released is a future growth band waiting to happen."
            )

        elif archetype == "porphyry":
            paragraphs.append(
                f"You stand inside a vug at the top of an intrusive porphyry stock — a shallow magma body that "
                f"crystallized into a cupola of ore-bearing granite. Two kilometers of rock above you, daylight; "
                f"immediately below, the still-magma continues to exhale metal-laden fluid. {T:.0f} degrees here, "
                f"{P:.2f} kbar, on the borderline between supercritical and boiling."
            )
            paragraphs.append(
                f"The fluid is metal-rich soup. Copper at {ppm('Cu'):.0f} ppm, iron at {ppm('Fe'):.0f}, sulfur at "
                f"{ppm('S'):.0f}. The walls weep with it. Everything looks brassy and wet, and the whole pocket smells "
                f"metallic even through the hiss of pressure."
            )
            paragraphs.append(
                "This pocket is one of many. Porphyry systems are lacework: fractures, veins, stockwork cavities all "
                "feeding off the same cooling intrusion. Each vug is a local eddy where the flow paused long enough to "
                "deposit. You're in one of those eddies."
            )
            porp_hints = []
            if have('Mo', 5): porp_hints.append(f"Molybdenum at {ppm('Mo'):.0f} ppm — the Mo pulse has already arrived; molybdenite is likely")
            if have('Au', 0.1): porp_hints.append(f"gold at {ppm('Au'):.1f} (invisible in pyrite, traditionally)")
            if have('W', 0.3): porp_hints.append(f"tungsten at {ppm('W'):.1f} (scheelite-adjacent)")
            if have('Bi', 0.3): porp_hints.append(f"bismuth at {ppm('Bi'):.1f}")
            if porp_hints:
                paragraphs.append(". ".join(p[0].upper() + p[1:] for p in porp_hints) + ".")
            paragraphs.append(
                "The walls are quartz-feldspar porphyry, potassically altered — the intrusion has already stained them "
                "pink with K-feldspar metasomatism. That alteration is older than the fluid you're standing in."
            )
            paragraphs.append(
                "The first sulfides will form within a few degrees of cooling. Pyrite nucleates fastest, then "
                "chalcopyrite settles onto it, then — if the late Mo pulse keeps delivering — molybdenite platelets."
            )

        elif archetype == "evaporite":
            paragraphs.append(
                f"You stand inside a crust that hasn't been buried deep. Barely below the surface. {T:.0f} degrees — "
                f"the sun warmed the ground this morning; by night it will cool again. The air is dry and still."
            )
            paragraphs.append(
                f"The fluid is a brine so concentrated it feels like syrup. Calcium at {ppm('Ca'):.0f} ppm, sulfate "
                f"(as S) at {ppm('S'):.0f}, with a pH of {pH:.1f} — the chemistry of drying out. The walls are pale "
                f"Ca-SO₄ with streaks of iron where earlier water rusted through."
            )
            paragraphs.append(
                "A shallow pond sat here once. Inflow slowed, or stopped; evaporation didn't. The water retreated, "
                "concentrating its dissolved ions, until the first crystals formed on the sediment surface and the "
                "whole thing went from pond to crust. You're inside the crust."
            )
            evap_hints = []
            if have('Mg', 20): evap_hints.append(f"magnesium at {ppm('Mg'):.0f} ppm hints at dolomite-adjacent chemistry, or epsomite if the brine dries further")
            if have('Sr', 10): evap_hints.append(f"strontium at {ppm('Sr'):.0f} is a celestine near-miss — the missing SrSO₄ is the ghost sulfate")
            if have('Cl', 15): evap_hints.append(f"chloride at {ppm('Cl'):.0f} is halite-adjacent; one more round of drying and NaCl will crust out alongside the gypsum")
            if evap_hints:
                paragraphs.append(". ".join(h[0].upper() + h[1:] for h in evap_hints) + ".")
            paragraphs.append(
                "There are no walls to dissolve here. The cavity IS the fluid, and the fluid is shrinking. The only "
                "question is how slowly it shrinks, and whether the temperature holds below 60°C long enough for "
                "selenite to finish what anhydrite might otherwise interrupt."
            )

        else:  # mixed
            paragraphs.append(
                f"You stand inside a pocket that has seen two fluids. The older one left behind mineral coatings on "
                f"the walls — dull sulfides, margins slightly oxidized. The new fluid is different: cooler, more "
                f"oxidizing. {T:.0f} degrees, and the mix is unsettled."
            )
            paragraphs.append(
                f"Metal is in solution: {ppm('Zn'):.0f} ppm Zn, {ppm('Pb'):.0f} ppm Pb, {ppm('Fe'):.0f} ppm Fe. "
                f"O₂ is {fluid.O2:.1f} — enough to attack the old sulfide coatings where it touches them."
            )
            paragraphs.append(
                "This is an overprint. A pocket that once equilibrated with reducing brine is being re-visited by "
                "something newer. Two timescales meet here: the older paragenesis frozen in the walls, and the new "
                "one about to begin on top of it."
            )
            paragraphs.append(
                "The walls are dissolving where the new fluid is undersaturated, and re-precipitating where it's "
                "saturated. You can watch both processes happen at once, on different parts of the same crystal — if "
                "you have patience measured in centuries."
            )
            paragraphs.append(
                "What grows next will tell you which fluid won. Secondary minerals on primary — that's the signature "
                "of overprint. The vug is writing its second chapter."
            )

        # Append chemistry stats block
        return "\n\n".join(paragraphs) + "\n\n" + self._render_fluid_table()

    def _narrate_discovery(self, archetype: str) -> str:
        """Procedural discovery flavor for the random scenario.

        Reads the resulting assemblage + archetype + trace-element fluid
        and assembles a collector's-tag paragraph: where it probably came
        from, what the dominant paragenesis is, what trace elements hint
        at even if no mineral consumed them, and which classic locality
        the assemblage recalls.
        """
        from collections import Counter
        by_mineral = Counter(c.mineral for c in self.crystals if c.total_growth_um > 0)
        if not by_mineral:
            return ("*Discovery tag —* The cavity was opened, and nothing had grown. "
                    "Sometimes that is the whole story: a chamber where the fluid "
                    "arrived, lingered, and left without leaving a signature.")

        fluid = self.conditions.fluid

        setting = {
            "hydrothermal": "a fracture-fed solution cavity in altered country rock",
            "pegmatite":    "the cooled core of a granite pegmatite pocket",
            "supergene":    "a shallow oxidation-zone pocket just below the water table",
            "mvt":          "a karst dissolution cavity in Paleozoic limestone",
            "porphyry":     "a late-stage vug in a porphyry copper stockwork",
            "evaporite":    "a desiccated Ca-SO₄ crust near an ancient playa margin",
            "mixed":        "an overprinted pocket with two generations of fluid",
        }.get(archetype, "an unnamed cavity")

        # Sort minerals by biggest crystal for each
        mineral_sizes = {}
        for c in self.crystals:
            s = c.c_length_mm
            if s > mineral_sizes.get(c.mineral, 0):
                mineral_sizes[c.mineral] = s
        by_size = sorted(mineral_sizes.items(), key=lambda kv: -kv[1])

        parts = [f"*Discovery tag —* This specimen was recovered from {setting}."]

        # Primary + subordinates
        if by_size:
            primary, psize = by_size[0]
            if len(by_size) == 1:
                parts.append(f"The pocket is a single-mineral chamber: {primary} reached {psize:.1f} mm and claimed the whole vug.")
            else:
                subs = ", ".join(f"{m}" for m, _ in by_size[1:4])
                parts.append(f"The dominant mineral is {primary} ({psize:.1f} mm), with subordinate {subs}.")

        assemblage = set(by_mineral)

        # Paragenetic call-outs
        if "goethite" in assemblage and any(c.mineral == "goethite" and "pseudomorph" in c.position for c in self.crystals):
            parts.append("Goethite boxwork pseudomorphs after pyrite record a weathering front that moved through the vug long after the primary sulfides formed.")
        if "wulfenite" in assemblage:
            parts.append("The wulfenite is the prize — bright tablets that only formed because both galena and molybdenite oxidized together (Seo et al. 2012).")
        if {"malachite", "chalcopyrite"} <= assemblage:
            parts.append("A malachite-after-chalcopyrite pathway is evident: the copper walked out of the sulfide and met carbonate on its way to the wall.")
        if "uraninite" in assemblage and "quartz" in assemblage:
            parts.append("The quartz near the uraninite carries alpha-damage; if this specimen sat in its cradle long enough, the clear crystals darkened into smoky.")
        if "selenite" in assemblage and archetype == "evaporite":
            parts.append("The selenite blades are the clock: they grew slowly at a steady sub-60°C, the Naica chemistry in miniature.")
        if "adamite" in assemblage and "mimetite" in assemblage:
            parts.append("Adamite and mimetite together place this pocket near an arsenopyrite weathering body — Zn and Pb fighting over the same arsenate.")

        # Trace-element hints — lets untapped fields speak
        trace_lines = []
        if getattr(fluid, "Ba", 0) > 15:
            trace_lines.append("The fluid carried enough Ba that barite was a near miss — look in the matrix for the missing sulfate")
        if getattr(fluid, "Sr", 0) > 15:
            trace_lines.append("Strontium above typical MVT values suggests a celestine-bearing parent brine somewhere upstream")
        if getattr(fluid, "Li", 0) > 20 or getattr(fluid, "B", 0) > 20 or getattr(fluid, "Be", 0) > 15:
            trace_lines.append("Trace Li/B/Be hints that the pegmatite parent fluid ran toward the rare-element side of the LCT family")
        if getattr(fluid, "Au", 0) > 0.5:
            trace_lines.append("Invisible gold in the pyrite is likely — the fluid ran Au-enriched even if no native gold crystallized here")
        if getattr(fluid, "Ag", 0) > 3:
            trace_lines.append("The galena is argentiferous; thin-section microprobe traces would light up with silver")
        if getattr(fluid, "Cr", 0) > 3:
            trace_lines.append("Chromium in the fluid would have shifted wulfenite toward the classic blood-orange Red Cloud hue")
        if getattr(fluid, "Co", 0) > 1:
            trace_lines.append("Cobalt traces would pink up any smithsonite that grew here")
        if getattr(fluid, "Mg", 0) > 30 and archetype == "evaporite":
            trace_lines.append("High Mg suggests dolomite-adjacent chemistry; epsomite could bloom if the crust evaporated a bit further")

        if trace_lines:
            parts.append(trace_lines[0] + ".")
            if len(trace_lines) > 1:
                parts.append("Secondary traces: " + "; ".join(trace_lines[1:3]) + ".")

        # Locality hint
        locality = None
        if {"adamite", "goethite"} <= assemblage or ({"mimetite", "goethite"} <= assemblage):
            locality = "Ojuela Mine at Mapimí, Durango — the classic oxidation-zone type locality"
        elif "wulfenite" in assemblage and "hematite" in assemblage:
            locality = "Los Lamentos or Red Cloud Mine — the wulfenite capitals"
        elif {"sphalerite", "galena", "fluorite"} <= assemblage:
            locality = "Cave-in-Rock, Illinois — MVT paragenesis at its textbook best"
        elif {"chalcopyrite", "pyrite", "quartz"} <= assemblage and archetype == "porphyry":
            locality = "Bingham Canyon or Butte — porphyry copper's ground truth"
        elif "uraninite" in assemblage and "feldspar" in assemblage:
            locality = "the Bancroft district, Ontario — uraninite-bearing pegmatites"
        elif {"calcite", "sphalerite", "galena"} <= assemblage:
            locality = "the Tri-State district (Joplin, MO)"
        if locality:
            parts.append(f"The assemblage recalls {locality}.")

        # Closing
        closing_options = [
            "What the rock held, the rock now reveals.",
            "The fluid is long gone; only the crystals remember.",
            "Every face was drawn in slow ink, one layer at a time.",
            "This is what the dark grew when no one was watching.",
            "The cavity is a museum and a letter.",
        ]
        parts.append(random.choice(closing_options))

        return " ".join(parts)
    
    def _narrate_calcite(self, c: Crystal) -> str:
        """Narrate a calcite crystal's story.

        Prose lives in narratives/calcite.md. Code keeps the zone
        analysis (Mn-vs-Fe segregation, fluorescence-quench detection)
        and final-size descriptor; markdown owns the words.
        """
        parts = []
        if c.zones:
            mn_zones = [z for z in c.zones if z.trace_Mn > 1.0 and z.trace_Fe < 2.0]
            fe_zones = [z for z in c.zones if z.trace_Fe > 3.0]
            if mn_zones and fe_zones:
                mn_end = mn_zones[-1].step
                fe_start = fe_zones[0].step
                if fe_start > mn_end - 5:
                    parts.append(narrative_variant("calcite", "mn_fe_quench",
                                                   fe_start=fe_start))
            elif mn_zones:
                parts.append(narrative_variant("calcite", "mn_only"))

        if c.twinned:
            parts.append(narrative_variant("calcite", "twinned",
                                           twin_law=c.twin_law))

        size_desc = "microscopic" if c.c_length_mm < 0.5 else "small" if c.c_length_mm < 2 else "well-developed"
        parts.append(narrative_variant("calcite", "final_size",
                                       size_desc=size_desc,
                                       mm=f"{c.c_length_mm:.1f}",
                                       habit=c.habit))

        return " ".join(p for p in parts if p)

    def _narrate_aragonite(self, c: Crystal) -> str:
        """Narrate an aragonite crystal's story — the metastable polymorph.

        Prose lives in narratives/aragonite.md. Code dispatches habit
        + dissolved-with-conversion-note signal.
        """
        parts = [f"Aragonite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("aragonite"))

        if c.habit == "acicular_needle":
            parts.append(narrative_variant("aragonite", "acicular_needle"))
        elif c.habit == "twinned_cyclic":
            parts.append(narrative_variant("aragonite", "twinned_cyclic"))
        elif c.habit == "flos_ferri":
            parts.append(narrative_variant("aragonite", "flos_ferri"))
        else:
            parts.append(narrative_variant("aragonite", "columnar_prisms"))

        if c.dissolved:
            note = c.zones[-1].note if c.zones else ""
            if "polymorphic conversion" in note:
                parts.append(narrative_variant("aragonite", "polymorphic_conversion"))
            else:
                parts.append(narrative_variant("aragonite", "acid_dissolution"))
        else:
            parts.append(narrative_variant("aragonite", "preserved"))

        return " ".join(p for p in parts if p)

    def _narrate_dolomite(self, c: Crystal) -> str:
        """Narrate a dolomite crystal's story — the Ca-Mg ordered carbonate.

        Prose lives in narratives/dolomite.md. Code keeps the
        cycle-count → f_ord computation and the threshold dispatch
        (Kim 2023 ordering tiers); markdown owns the words.
        """
        parts = [f"Dolomite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        # Compute final ordering fraction for narration — use fluid-level cycles
        cycle_count = self.conditions._dol_cycle_count
        f_ord = 1.0 - math.exp(-cycle_count / 7.0) if cycle_count > 0 else 0.0

        parts.append(narrative_blurb("dolomite"))

        if cycle_count > 0:
            if f_ord > 0.7:
                variant = "kim_ordered"
            elif f_ord > 0.3:
                variant = "kim_partial"
            else:
                variant = "kim_disordered"
            parts.append(narrative_variant("dolomite", variant,
                                           cycle_count=cycle_count,
                                           f_ord=f"{f_ord:.2f}"))
        else:
            parts.append(narrative_variant("dolomite", "no_cycling"))

        if c.habit == "saddle_rhomb":
            parts.append(narrative_variant("dolomite", "saddle_rhomb"))
        elif c.habit == "coarse_rhomb":
            parts.append(narrative_variant("dolomite", "coarse_rhomb"))
        else:
            parts.append(narrative_variant("dolomite", "massive_granular"))

        if "calcite" in c.position:
            parts.append(narrative_variant("dolomite", "on_calcite"))

        if c.dissolved:
            parts.append(narrative_variant("dolomite", "dissolved"))
        return " ".join(p for p in parts if p)

    def _narrate_siderite(self, c: Crystal) -> str:
        """Narrate a siderite crystal's story — the iron carbonate.

        Prose lives in narratives/siderite.md. Code dispatches habit
        + dissolved-with-oxidative-note signal.
        """
        parts = [f"Siderite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("siderite"))

        if c.habit == "rhombohedral":
            parts.append(narrative_variant("siderite", "rhombohedral"))
        elif c.habit == "scalenohedral":
            parts.append(narrative_variant("siderite", "scalenohedral"))
        elif c.habit == "botryoidal":
            parts.append(narrative_variant("siderite", "botryoidal"))
        else:
            parts.append(narrative_variant("siderite", "spherulitic_concretion"))

        if c.dissolved:
            note = c.zones[-1].note if c.zones else ""
            if "oxidative breakdown" in note:
                parts.append(narrative_variant("siderite", "oxidative_breakdown"))
            else:
                parts.append(narrative_variant("siderite", "acid_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_rhodochrosite(self, c: Crystal) -> str:
        """Narrate a rhodochrosite crystal's story — the manganese carbonate.

        Prose lives in narratives/rhodochrosite.md. Code dispatches
        habit + on-sulfide position-string match + dissolved-with-
        oxidative-note signal.
        """
        parts = [f"Rhodochrosite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("rhodochrosite"))

        if c.habit == "rhombohedral":
            parts.append(narrative_variant("rhodochrosite", "rhombohedral"))
        elif c.habit == "scalenohedral":
            parts.append(narrative_variant("rhodochrosite", "scalenohedral"))
        elif c.habit == "stalactitic":
            parts.append(narrative_variant("rhodochrosite", "stalactitic"))
        else:
            parts.append(narrative_variant("rhodochrosite", "rhythmic_banding"))

        if "sphalerite" in c.position or "pyrite" in c.position or "galena" in c.position:
            parts.append(narrative_variant("rhodochrosite", "on_sulfide",
                                           position=c.position))

        if c.dissolved:
            note = c.zones[-1].note if c.zones else ""
            if "oxidative breakdown" in note:
                parts.append(narrative_variant("rhodochrosite", "oxidative_breakdown"))
            else:
                parts.append(narrative_variant("rhodochrosite", "acid_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_quartz(self, c: Crystal) -> str:
        """Narrate a quartz crystal — the most variable narrator in the sim.

        Prose lives in narratives/quartz.md. No-blurb pattern; almost every
        sentence is a computed-condition variant with interpolated values.
        Code keeps all the threshold logic; markdown holds the prose.
        Failed-to-develop fast-path returns early (no zones at all).
        """
        if not c.zones:
            return narrative_variant("quartz", "failed_to_develop",
                                     crystal_id=c.crystal_id,
                                     nucleation_temp=f"{c.nucleation_temp:.0f}")

        parts = []

        ti_vals = [z.trace_Ti for z in c.zones if z.trace_Ti > 0]
        if ti_vals and max(ti_vals) > 0.01:
            parts.append(narrative_variant("quartz", "titanium_zoning",
                                           max_ti=f"{max(ti_vals):.3f}",
                                           min_ti=f"{min(ti_vals):.3f}"))

        fi_zones = [z for z in c.zones if z.fluid_inclusion]
        if fi_zones:
            fi_types = set(z.inclusion_type for z in fi_zones)
            parts.append(narrative_variant("quartz", "fluid_inclusions",
                                           count=len(fi_zones),
                                           types=", ".join(fi_types)))

        if c.twinned:
            parts.append(narrative_variant("quartz", "twinned",
                                           twin_law=c.twin_law))

        fast_zones = [z for z in c.zones if z.growth_rate > 15]
        slow_zones = [z for z in c.zones if 0 < z.growth_rate < 2]
        if fast_zones and slow_zones:
            parts.append(narrative_variant("quartz", "growth_oscillation",
                                           max_rate=f"{max(z.growth_rate for z in fast_zones):.0f}"))

        rad_zones = [z for z in c.zones if z.radiation_damage > 0]
        if rad_zones:
            avg_rad = sum(z.radiation_damage for z in c.zones) / len(c.zones)
            avg_Al = sum(z.trace_Al for z in c.zones) / len(c.zones)
            avg_Fe = sum(z.trace_Fe for z in c.zones) / len(c.zones)
            dosed_fraction = len(rad_zones) / len(c.zones)
            if avg_rad > 0.6 and avg_Al > 0.3:
                parts.append(narrative_variant("quartz", "morion",
                                               rad_count=len(rad_zones),
                                               total_count=len(c.zones)))
            elif avg_rad > 0.3 and avg_Al > 0.3:
                parts.append(narrative_variant("quartz", "smoky",
                                               dosed_pct=f"{dosed_fraction*100:.0f}"))
            elif avg_rad > 0.3 and avg_Fe > 3.0:
                parts.append(narrative_variant("quartz", "amethyst_tint"))
            elif avg_rad > 0.1:
                parts.append(narrative_variant("quartz", "mild_smoky",
                                               avg_rad=f"{avg_rad:.2f}"))

        size_desc = "microscopic" if c.c_length_mm < 0.5 else "thumbnail" if c.c_length_mm < 5 else "cabinet-sized"
        parts.append(narrative_variant("quartz", "final_size",
                                       size_desc=size_desc,
                                       mm=f"{c.c_length_mm:.1f}",
                                       a_width_mm=f"{c.a_width_mm:.1f}"))

        return " ".join(p for p in parts if p)

    def _narrate_sphalerite(self, c: Crystal) -> str:
        """Narrate a sphalerite crystal's story.

        Prose lives in narratives/sphalerite.md. Code keeps the
        Fe-zoning analysis (early/late thirds, ratio threshold) and
        picks which named variant — fe_zoning_increasing or
        fe_zoning_decreasing — applies. Markdown owns the words.
        """
        parts = [f"Sphalerite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if c.zones:
            fe_vals = [z.trace_Fe for z in c.zones if z.trace_Fe > 0]
            if fe_vals:
                max_fe = max(fe_vals)
                min_fe = min(fe_vals)
                if max_fe > min_fe * 1.5:
                    # Compute early-vs-late Fe averages over the first and
                    # last thirds of the growth zones; pick the matching
                    # variant from the markdown.
                    third = max(len(c.zones) // 3, 1)
                    early_fe = sum(z.trace_Fe for z in c.zones[:third]) / third
                    late_fe = sum(z.trace_Fe for z in c.zones[-third:]) / third
                    variant = ("fe_zoning_increasing" if early_fe < late_fe
                               else "fe_zoning_decreasing")
                    parts.append(narrative_variant("sphalerite", variant))

        if c.twinned:
            parts.append(narrative_variant("sphalerite", "twinned",
                                           twin_law=c.twin_law))

        return " ".join(p for p in parts if p)

    def _narrate_wurtzite(self, c: Crystal) -> str:
        """Narrate a wurtzite crystal — the high-T hexagonal ZnS dimorph.

        Prose lives in narratives/wurtzite.md. No-blurb pattern + 4-way
        habit + Fe-content threshold variant (with {fe_pct} interp) +
        twinned (with {twin_law}) + paired polymorphic_inversion-vs-
        kept_hexagonal branches.
        """
        parts = [f"Wurtzite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if c.habit == "hemimorphic_crystal":
            parts.append(narrative_variant("wurtzite", "hemimorphic_crystal"))
        elif c.habit == "radiating_columnar":
            parts.append(narrative_variant("wurtzite", "radiating_columnar"))
        elif c.habit == "fibrous_coating":
            parts.append(narrative_variant("wurtzite", "fibrous_coating"))
        else:
            parts.append(narrative_variant("wurtzite", "tabular_default"))

        if c.zones:
            fe_vals = [z.trace_Fe for z in c.zones if z.trace_Fe > 0]
            if fe_vals:
                max_fe_pct = max(fe_vals) / 10.0
                if max_fe_pct > 10:
                    parts.append(narrative_variant("wurtzite", "fe_content",
                                                   fe_pct=f"{max_fe_pct:.0f}"))

        if c.twinned:
            parts.append(narrative_variant("wurtzite", "twinned",
                                           twin_law=c.twin_law))

        if c.dissolved:
            parts.append(narrative_variant("wurtzite", "polymorphic_inversion"))
        else:
            parts.append(narrative_variant("wurtzite", "kept_hexagonal"))

        return " ".join(p for p in parts if p)

    def _narrate_fluorite(self, c: Crystal) -> str:
        """Narrate a fluorite crystal's story.

        Prose lives in narratives/fluorite.md. Code computes color set from
        zones (parsing 'color zone:' notes), then dispatches multi-color vs
        single-color variant. Adds twinned (with {twin_law}) + fluorescence
        (with {fl}) variants. No blurb — entirely conditional.
        """
        parts = [f"Fluorite #{c.crystal_id} grew as {c.habit} crystals to {c.c_length_mm:.1f} mm."]

        if c.zones:
            colors = set()
            for z in c.zones:
                if z.note and "color zone:" in z.note:
                    color = z.note.split("color zone:")[1].strip()
                    colors.add(color)
            if len(colors) > 1:
                parts.append(narrative_variant("fluorite", "color_zoning_multi",
                                               colors_list=", ".join(colors)))
            elif colors:
                parts.append(narrative_variant("fluorite", "color_zoning_single",
                                               color=list(colors)[0]))

        if c.twinned:
            parts.append(narrative_variant("fluorite", "twinned", twin_law=c.twin_law))

        fl = c.predict_fluorescence()
        if fl != "non-fluorescent":
            parts.append(narrative_variant("fluorite", "fluorescence", fl=fl))

        return " ".join(p for p in parts if p)
    
    def _narrate_pyrite(self, c: Crystal) -> str:
        """Narrate a pyrite crystal's story.

        Prose lives in narratives/pyrite.md. Code dispatches habit (framboidal /
        pyritohedral / cubic) + twinned + dissolved.
        """
        parts = [f"Pyrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if c.habit == "framboidal":
            parts.append(narrative_variant("pyrite", "framboidal"))
        elif c.habit == "pyritohedral":
            parts.append(narrative_variant("pyrite", "pyritohedral"))
        elif "cubic" in c.habit:
            parts.append(narrative_variant("pyrite", "cubic"))

        if c.twinned:
            parts.append(narrative_variant("pyrite", "twinned", twin_law=c.twin_law))

        if c.dissolved:
            parts.append(narrative_variant("pyrite", "acid_oxidation"))

        return " ".join(p for p in parts if p)

    def _narrate_marcasite(self, c: Crystal) -> str:
        """Narrate a marcasite crystal's story — the acid-loving iron sulfide.

        Prose lives in narratives/marcasite.md. Code dispatches 4-way habit
        (cockscomb / spearhead / radiating_blade / tabular_plates default) +
        twinned (with {twin_law}) + dissolved-vs-kept_orthorhombic dimorph
        commentary.
        """
        parts = [f"Marcasite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if c.habit == "cockscomb":
            parts.append(narrative_variant("marcasite", "cockscomb"))
        elif c.habit == "spearhead":
            parts.append(narrative_variant("marcasite", "spearhead"))
        elif c.habit == "radiating_blade":
            parts.append(narrative_variant("marcasite", "radiating_blade"))
        else:
            parts.append(narrative_variant("marcasite", "tabular_plates"))

        if c.twinned:
            parts.append(narrative_variant("marcasite", "twinned", twin_law=c.twin_law))

        if c.dissolved:
            parts.append(narrative_variant("marcasite", "dissolved_inversion"))
        else:
            parts.append(narrative_variant("marcasite", "kept_orthorhombic"))

        return " ".join(p for p in parts if p)

    def _narrate_chalcopyrite(self, c: Crystal) -> str:
        """Narrate a chalcopyrite crystal's story.

        Prose lives in narratives/chalcopyrite.md. Code keeps the
        conditional-dispatch logic (which variants apply); markdown
        owns the words. Edit prose without touching code.
        """
        parts = [f"Chalcopyrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("chalcopyrite"))
        if c.twinned:
            parts.append(narrative_variant("chalcopyrite", "twinned",
                                           twin_law=c.twin_law))
        if c.dissolved:
            parts.append(narrative_variant("chalcopyrite", "dissolved"))
        return " ".join(p for p in parts if p)
    
    def _narrate_hematite(self, c: Crystal) -> str:
        """Narrate a hematite crystal's story.

        Prose lives in narratives/hematite.md. Code dispatches 4-way habit
        (specular / rhombohedral / botryoidal / earthy_massive) + an
        iridescent sub-branch on specular when zone-note contains 'iridescent'
        + twinned (with {twin_law}) + dissolved.
        """
        parts = [f"Hematite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if c.habit == "specular":
            parts.append(narrative_variant("hematite", "specular"))
            if c.zones and any("iridescent" in z.note for z in c.zones):
                parts.append(narrative_variant("hematite", "specular_iridescent"))
        elif c.habit == "rhombohedral":
            parts.append(narrative_variant("hematite", "rhombohedral"))
        elif c.habit == "botryoidal":
            parts.append(narrative_variant("hematite", "botryoidal"))
        elif c.habit == "earthy/massive":
            parts.append(narrative_variant("hematite", "earthy_massive"))

        if c.twinned:
            parts.append(narrative_variant("hematite", "twinned", twin_law=c.twin_law))

        if c.dissolved:
            parts.append(narrative_variant("hematite", "acid_dissolution"))

        return " ".join(p for p in parts if p)
    
    def _narrate_malachite(self, c: Crystal) -> str:
        """Narrate a malachite crystal's story.

        Prose lives in narratives/malachite.md. Code dispatches paragenesis
        (on_chalcopyrite), 3-way habit (banded / botryoidal / fibrous_acicular),
        dissolved, and final color summary (predict_color() result interpolates
        into the {color} variant).
        """
        parts = [f"Malachite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if "chalcopyrite" in (c.position or ""):
            parts.append(narrative_variant("malachite", "on_chalcopyrite"))

        if c.habit == "banded":
            parts.append(narrative_variant("malachite", "banded"))
        elif c.habit == "botryoidal":
            parts.append(narrative_variant("malachite", "botryoidal"))
        elif c.habit == "fibrous/acicular":
            parts.append(narrative_variant("malachite", "fibrous_acicular"))

        if c.dissolved:
            parts.append(narrative_variant("malachite", "acid_dissolution"))

        color = c.predict_color()
        if color:
            parts.append(narrative_variant("malachite", "color", color=color))

        return " ".join(p for p in parts if p)

    def _narrate_goethite(self, c: Crystal) -> str:
        """Narrate a goethite crystal's story — the ghost mineral, now real.

        Prose lives in narratives/goethite.md. Code dispatches 3-way
        paragenesis (after_pyrite / after_chalcopyrite / on_hematite,
        all elif) + 2-way habit (botryoidal_stalactitic / fibrous_acicular)
        + acid_dissolution. No always-shown blurb.
        """
        parts = [f"Goethite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]

        if "pseudomorph after pyrite" in c.position:
            parts.append(narrative_variant("goethite", "pseudomorph_after_pyrite"))
        elif "pseudomorph after chalcopyrite" in c.position:
            parts.append(narrative_variant("goethite", "pseudomorph_after_chalcopyrite"))
        elif "hematite" in c.position:
            parts.append(narrative_variant("goethite", "on_hematite"))

        if c.habit == "botryoidal/stalactitic":
            parts.append(narrative_variant("goethite", "botryoidal_stalactitic"))
        elif c.habit == "fibrous_acicular":
            parts.append(narrative_variant("goethite", "fibrous_acicular"))

        if c.dissolved:
            parts.append(narrative_variant("goethite", "acid_dissolution"))

        return " ".join(p for p in parts if p)

    def _narrate_uraninite(self, c: Crystal) -> str:
        """Narrate a uraninite crystal — the radioactive heart of the vug.

        Prose lives in narratives/uraninite.md. Code dispatches blurb +
        T-threshold (pegmatite_high_t when >400, roll_front_low_t else)
        + oxidative_dissolution.
        """
        parts = [f"Uraninite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm ☢️."]
        parts.append(narrative_blurb("uraninite"))
        if c.nucleation_temp > 400:
            parts.append(narrative_variant("uraninite", "pegmatite_high_t"))
        else:
            parts.append(narrative_variant("uraninite", "roll_front_low_t"))
        if c.dissolved:
            parts.append(narrative_variant("uraninite", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_galena(self, c: Crystal) -> str:
        """Narrate a galena crystal's story — the heavy one.

        Prose lives in narratives/galena.md. Code dispatches blurb +
        twinned (with {twin_law}) + argentiferous (numeric trace_Ag OR
        'Ag inclusions' note string) + dissolved.
        """
        parts = [f"Galena #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("galena"))

        if c.twinned:
            parts.append(narrative_variant("galena", "spinel_twin", twin_law=c.twin_law))

        avg_Ag = sum(getattr(z, "trace_Ag", 0.0) for z in c.zones) / max(len(c.zones), 1)
        if avg_Ag > 0 or any("Ag inclusions" in z.note for z in c.zones):
            parts.append(narrative_variant("galena", "argentiferous"))

        if c.dissolved:
            parts.append(narrative_variant("galena", "oxidative_breakdown"))

        return " ".join(p for p in parts if p)

    def _narrate_molybdenite(self, c: Crystal) -> str:
        """Narrate a molybdenite crystal's story — the wulfenite precursor.

        Prose lives in narratives/molybdenite.md. Code dispatches blurb +
        porphyry sweet-spot temperature window + oxidative dissolution.
        """
        parts = [f"Molybdenite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("molybdenite"))

        if 300 <= c.nucleation_temp <= 500:
            parts.append(narrative_variant("molybdenite", "porphyry_sweet_spot"))

        if c.dissolved:
            parts.append(narrative_variant("molybdenite", "oxidative_dissolution"))

        return " ".join(p for p in parts if p)

    def _narrate_smithsonite(self, c: Crystal) -> str:
        """Narrate a smithsonite crystal's story — sphalerite's carbonate heir.

        Prose lives in narratives/smithsonite.md. Code dispatches blurb +
        sphalerite paragenesis (with oxidized sub-branch), habit (botryoidal /
        rhombohedral), zone-note color tints, and dissolved. Drift consolidation:
        Python dispatcher gains rhombohedral + zone-note color branches that
        the JS side already had.
        """
        parts = [f"Smithsonite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("smithsonite"))

        if "sphalerite" in (c.position or ""):
            if "oxidized" in c.position:
                parts.append(narrative_variant("smithsonite", "on_sphalerite_oxidized"))
            else:
                parts.append(narrative_variant("smithsonite", "on_sphalerite_fresh"))

        if "botryoidal" in (c.habit or ""):
            parts.append(narrative_variant("smithsonite", "botryoidal"))
        elif c.habit == "rhombohedral":
            parts.append(narrative_variant("smithsonite", "rhombohedral"))

        last_zone = c.zones[-1] if c.zones else None
        last_note = getattr(last_zone, "note", "") if last_zone else ""
        if last_note:
            if "apple-green" in last_note:
                parts.append(narrative_variant("smithsonite", "color_apple_green"))
            elif "pink" in last_note:
                parts.append(narrative_variant("smithsonite", "color_pink"))
            elif "blue-green" in last_note:
                parts.append(narrative_variant("smithsonite", "color_blue_green"))

        if c.dissolved:
            parts.append(narrative_variant("smithsonite", "acid_dissolution"))

        return " ".join(p for p in parts if p)

    def _narrate_wulfenite(self, c: Crystal) -> str:
        """Narrate a wulfenite crystal — the sunset caught in stone.

        Prose lives in narratives/wulfenite.md. Merged narrator: JS
        canonical for blurb (collector's-prize framing) + on_galena
        paragenesis (with oxidized sub-branch) + zone-note color tints
        (honey, Red Cloud); Python canonical for twinned + acid_dissolution.
        Drift consolidations: Python gains JS's habit + zone-note dispatches;
        JS gains Python's acid_dissolution branch.
        """
        parts = [f"Wulfenite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("wulfenite"))

        if "galena" in (c.position or ""):
            if "oxidized" in c.position:
                parts.append(narrative_variant("wulfenite", "on_oxidized_galena"))
            else:
                parts.append(narrative_variant("wulfenite", "on_galena"))

        last_zone = c.zones[-1] if c.zones else None
        last_note = getattr(last_zone, "note", "") if last_zone else ""
        if last_note:
            if "honey" in last_note:
                parts.append(narrative_variant("wulfenite", "color_honey"))
            elif "red" in last_note:
                parts.append(narrative_variant("wulfenite", "color_red_cloud"))

        if c.twinned:
            parts.append(narrative_variant("wulfenite", "twinned", twin_law=c.twin_law))

        if c.dissolved:
            parts.append(narrative_variant("wulfenite", "acid_dissolution"))

        return " ".join(p for p in parts if p)

    def _narrate_selenite(self, c: Crystal) -> str:
        """Narrate a selenite crystal — the cool-water cathedral blade.

        Prose lives in narratives/selenite.md. Substantively merged Python
        + JS narrators per user direction (2026-04-30): JS prose was richer
        and more poetic ('the crystal that grows when everything else is
        ending', 'gypsum is the gravestone of pyrite', 'the epilogue
        crystal'); JS canonical, Python branches added on top. Final shape:
        epigraph (always) + 4-way habit (rosette / fibrous / cathedral_blade
        / blades_default) + on_sulfide paragenesis + swallowtail_twin +
        giant_naica when c_length_mm > 10 + dissolved + ALWAYS-emitted
        epilogue tail.
        """
        parts = [f"Selenite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_variant("selenite", "epigraph"))

        if c.habit == "rosette":
            parts.append(narrative_variant("selenite", "rosette"))
        elif c.habit and "fibrous" in c.habit:
            parts.append(narrative_variant("selenite", "fibrous"))
        elif c.habit == "cathedral_blade":
            parts.append(narrative_variant("selenite", "cathedral_blade"))
        else:
            parts.append(narrative_variant("selenite", "blades_default",
                                           mm=f"{c.c_length_mm:.1f}"))

        if "pyrite" in (c.position or "") or "chalcopyrite" in (c.position or ""):
            parts.append(narrative_variant("selenite", "on_sulfide"))

        if c.twinned and "swallowtail" in (c.twin_law or ""):
            parts.append(narrative_variant("selenite", "swallowtail_twin",
                                           twin_law=c.twin_law))

        if c.c_length_mm > 10:
            parts.append(narrative_variant("selenite", "giant_naica"))

        if c.dissolved:
            parts.append(narrative_variant("selenite", "dissolved"))

        parts.append(narrative_variant("selenite", "epilogue_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_barite(self, c: Crystal) -> str:
        """Narrate a barite crystal — the heavy spar.

        Prose lives in narratives/barite.md. Code dispatches blurb +
        4-way habit (tabular / bladed / cockscomb / prismatic) +
        zone-note independent flags (celestobarite, honey_yellow) +
        ALWAYS-emitted industrial tail.
        """
        parts = [f"Barite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("barite"))
        if c.habit == "tabular":
            parts.append(narrative_variant("barite", "tabular"))
        elif c.habit == "bladed":
            parts.append(narrative_variant("barite", "bladed"))
        elif c.habit == "cockscomb":
            parts.append(narrative_variant("barite", "cockscomb"))
        elif c.habit == "prismatic":
            parts.append(narrative_variant("barite", "prismatic"))
        any_note = " ".join(z.note or "" for z in c.zones)
        if "celestobarite" in any_note:
            parts.append(narrative_variant("barite", "celestobarite"))
        if "honey-yellow" in any_note:
            parts.append(narrative_variant("barite", "honey_yellow"))
        parts.append(narrative_variant("barite", "industrial_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_celestine(self, c: Crystal) -> str:
        """Narrate a celestine crystal — the celestial-blue Sr sulfate.

        Prose lives in narratives/celestine.md. Code dispatches blurb +
        4-way habit (nodular / fibrous / bladed / tabular_default) +
        zone-note independent flags (barytocelestine, sicilian_paragenesis)
        + ALWAYS-emitted industrial tail.
        """
        parts = [f"Celestine #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("celestine"))
        if c.habit == "nodular":
            parts.append(narrative_variant("celestine", "nodular"))
        elif c.habit == "fibrous":
            parts.append(narrative_variant("celestine", "fibrous"))
        elif c.habit == "bladed":
            parts.append(narrative_variant("celestine", "bladed"))
        else:
            parts.append(narrative_variant("celestine", "tabular_default"))
        any_note = " ".join(z.note or "" for z in c.zones)
        if "barytocelestine" in any_note:
            parts.append(narrative_variant("celestine", "barytocelestine"))
        if "Sicilian" in any_note or "sulfur-vug" in any_note:
            parts.append(narrative_variant("celestine", "sicilian_paragenesis"))
        parts.append(narrative_variant("celestine", "industrial_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_jarosite(self, c: Crystal) -> str:
        """Narrate a jarosite crystal — the AMD-yellow Fe sulfate.

        Prose lives in narratives/jarosite.md. Code dispatches blurb +
        3-way habit (earthy_crust / druzy / pseudocubic_default) +
        alkaline_shift on dissolved + ALWAYS-emitted Mars connection tail.
        """
        parts = [f"Jarosite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("jarosite"))
        if c.habit == "earthy_crust":
            parts.append(narrative_variant("jarosite", "earthy_crust"))
        elif c.habit == "druzy":
            parts.append(narrative_variant("jarosite", "druzy"))
        else:
            parts.append(narrative_variant("jarosite", "pseudocubic_default"))
        if c.dissolved:
            parts.append(narrative_variant("jarosite", "alkaline_shift"))
        parts.append(narrative_variant("jarosite", "mars_connection"))
        return " ".join(p for p in parts if p)

    def _narrate_alunite(self, c: Crystal) -> str:
        """Narrate an alunite crystal — the advanced argillic alteration index.

        Prose lives in narratives/alunite.md. Code dispatches blurb +
        4-way habit (earthy / fibrous / tabular / pseudocubic_default) +
        pinkish_natroalunite zone-note flag + dissolved (alkaline OR
        thermal) + ALWAYS-emitted Ar/Ar geochronology tail.
        """
        parts = [f"Alunite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("alunite"))
        if c.habit == "earthy":
            parts.append(narrative_variant("alunite", "earthy"))
        elif c.habit == "fibrous":
            parts.append(narrative_variant("alunite", "fibrous"))
        elif c.habit == "tabular":
            parts.append(narrative_variant("alunite", "tabular"))
        else:
            parts.append(narrative_variant("alunite", "pseudocubic_default"))
        any_note = " ".join(z.note or "" for z in c.zones)
        if "pinkish" in any_note or "natroalunite" in any_note:
            parts.append(narrative_variant("alunite", "pinkish_natroalunite"))
        if c.dissolved:
            parts.append(narrative_variant("alunite", "dissolved_alkaline_thermal"))
        parts.append(narrative_variant("alunite", "ar_ar_geochronology"))
        return " ".join(p for p in parts if p)

    def _narrate_brochantite(self, c: Crystal) -> str:
        """Narrate a brochantite crystal — the wet-supergene Cu sulfate.

        Prose lives in narratives/brochantite.md. Code dispatches blurb +
        4-way habit (drusy_crust / acicular_tuft / short_prismatic /
        botryoidal_default) + cl_rich zone-note flag + dissolved_pH_fork
        with computed {cause} interpolation + ALWAYS-emitted patina tail.
        """
        parts = [f"Brochantite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("brochantite"))
        if c.habit == "drusy_crust":
            parts.append(narrative_variant("brochantite", "drusy_crust"))
        elif c.habit == "acicular_tuft":
            parts.append(narrative_variant("brochantite", "acicular_tuft"))
        elif c.habit == "short_prismatic":
            parts.append(narrative_variant("brochantite", "short_prismatic"))
        else:
            parts.append(narrative_variant("brochantite", "botryoidal_default"))
        any_note = " ".join(z.note or "" for z in c.zones)
        if "Cl-rich" in any_note:
            parts.append(narrative_variant("brochantite", "cl_rich"))
        if c.dissolved:
            cause = "alkalinization (pH > 7) → tenorite/malachite stable" \
                if any("pH > 7" in (z.note or "") for z in c.zones) \
                else "acidification (pH < 3) → antlerite stable"
            parts.append(narrative_variant("brochantite", "dissolved_pH_fork", cause=cause))
        parts.append(narrative_variant("brochantite", "patina_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_antlerite(self, c: Crystal) -> str:
        """Narrate an antlerite crystal — the dry-acid Cu sulfate.

        Prose lives in narratives/antlerite.md. Code dispatches blurb +
        4-way habit (granular / acicular / short_prismatic / drusy_default)
        + dissolved_neutralization + on_dissolving_brochantite zone-note
        flag + ALWAYS-emitted pragmatic tail.
        """
        parts = [f"Antlerite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("antlerite"))
        if c.habit == "granular":
            parts.append(narrative_variant("antlerite", "granular"))
        elif c.habit == "acicular":
            parts.append(narrative_variant("antlerite", "acicular"))
        elif c.habit == "short_prismatic":
            parts.append(narrative_variant("antlerite", "short_prismatic"))
        else:
            parts.append(narrative_variant("antlerite", "drusy_default"))
        if c.dissolved:
            parts.append(narrative_variant("antlerite", "dissolved_neutralization"))
        any_note = " ".join(z.note or "" for z in c.zones)
        if any("on dissolving brochantite" in (z.note or "") for z in c.zones) or "pH-fork" in any_note:
            parts.append(narrative_variant("antlerite", "on_dissolving_brochantite"))
        parts.append(narrative_variant("antlerite", "pragmatic_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_anhydrite(self, c: Crystal) -> str:
        """Narrate an anhydrite crystal — the high-T or saline-low-T Ca sulfate.

        Prose lives in narratives/anhydrite.md. Code dispatches blurb +
        4-way habit (massive_granular with size sub-branch / prismatic /
        fibrous / tabular_default) + angelite zone-note flag +
        rehydration-to-gypsum on dissolved + ALWAYS-emitted industrial
        tail. The massive_granular branch splits at c_length_mm < 100
        into sabkha vs porphyry sub-variants.
        """
        parts = [f"Anhydrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("anhydrite"))
        if c.habit == "massive_granular":
            if c.c_length_mm < 100:
                parts.append(narrative_variant("anhydrite", "massive_granular_sabkha"))
            else:
                parts.append(narrative_variant("anhydrite", "massive_granular_porphyry"))
        elif c.habit == "prismatic":
            parts.append(narrative_variant("anhydrite", "prismatic"))
        elif c.habit == "fibrous":
            parts.append(narrative_variant("anhydrite", "fibrous"))
        else:
            parts.append(narrative_variant("anhydrite", "tabular_default"))
        any_note = " ".join(z.note or "" for z in c.zones)
        if "angelite" in any_note:
            parts.append(narrative_variant("anhydrite", "angelite"))
        if c.dissolved:
            parts.append(narrative_variant("anhydrite", "rehydration_to_gypsum"))
        parts.append(narrative_variant("anhydrite", "industrial_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_adamite(self, c: Crystal) -> str:
        """Narrate adamite — JS tone + Python facts blend (boss direction).

        Prose lives in narratives/adamite.md (boss-pushed canonical 2026-04-30,
        commit fca14e6). Boss-design schema: blurb is the opening line (no
        separate '#N grew to X mm' preamble), closing is always-emitted tail.

        Code dispatches blurb (with {crystal_id}) + fluorescent-vs-non_fluorescent
        on numeric trace_Cu (Python's avg_Cu logic, more precise than the JS
        FLUORESCENT-note check, per boss direction in HANDOFF) + on_goethite
        paragenesis (broadened to include hematite) + acicular habit +
        olivenite_companion (sim crystal scan) + dissolved + closing.
        """
        parts = [narrative_blurb("adamite", crystal_id=c.crystal_id)]

        avg_Cu = sum(getattr(z, "trace_Cu", 0.0) for z in c.zones) / max(len(c.zones), 1)
        if avg_Cu > 0.5 or "cuproadamite" in " ".join(z.note for z in c.zones):
            parts.append(narrative_variant("adamite", "fluorescent"))
        else:
            parts.append(narrative_variant("adamite", "non_fluorescent"))

        if "goethite" in c.position or "hematite" in c.position:
            parts.append(narrative_variant("adamite", "on_goethite"))

        if c.habit == "acicular sprays":
            parts.append(narrative_variant("adamite", "acicular"))

        active_oli = [oc for oc in self.crystals if oc.mineral == "olivenite" and oc.active]
        if active_oli:
            parts.append(narrative_variant("adamite", "olivenite_companion"))

        if c.dissolved:
            parts.append(narrative_variant("adamite", "dissolved"))

        parts.append(narrative_closing("adamite"))
        return " ".join(p for p in parts if p)

    def _narrate_mimetite(self, c: Crystal) -> str:
        """Narrate a mimetite crystal's story — the mimic of pyromorphite.

        Prose lives in narratives/mimetite.md. Code dispatches blurb +
        3-way habit (campylite / prismatic / tabular_default) +
        on_galena paragenesis + acid_dissolution + ALWAYS-emitted
        imitator tail. Drift consolidation: Python dispatcher gains the
        habit branches and ALWAYS-emitted tail that the JS side already
        had — both runtimes converge on the richer (JS-canonical) prose.
        """
        parts = [f"Mimetite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("mimetite"))

        if "campylite" in (c.habit or ""):
            parts.append(narrative_variant("mimetite", "campylite"))
        elif c.habit == "prismatic":
            parts.append(narrative_variant("mimetite", "prismatic"))
        else:
            parts.append(narrative_variant("mimetite", "tabular_default"))

        if "galena" in c.position:
            parts.append(narrative_variant("mimetite", "on_galena"))

        if c.dissolved:
            parts.append(narrative_variant("mimetite", "acid_dissolution"))

        parts.append(narrative_variant("mimetite", "imitator_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_apophyllite(self, c: Crystal) -> str:
        """Narrate an apophyllite crystal — the Deccan Traps vesicle filling.

        Prose lives in narratives/apophyllite.md. Code dispatches blurb +
        4-way habit (prismatic_tabular / hopper_growth / druzy_crust /
        chalcedony_pseudomorph default) + bloody_phantoms zone-note count
        (with {count} interp for the Nashik 'bloody apophyllite') +
        on_hematite paragenesis + dissolved.
        """
        parts = [f"Apophyllite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("apophyllite"))

        if c.habit == "prismatic_tabular":
            parts.append(narrative_variant("apophyllite", "prismatic_tabular"))
        elif c.habit == "hopper_growth":
            parts.append(narrative_variant("apophyllite", "hopper_growth"))
        elif c.habit == "druzy_crust":
            parts.append(narrative_variant("apophyllite", "druzy_crust"))
        else:
            parts.append(narrative_variant("apophyllite", "chalcedony_pseudomorph"))

        hematite_zones = [z for z in c.zones if z.note and "hematite needle phantom" in z.note]
        if hematite_zones:
            parts.append(narrative_variant("apophyllite", "bloody_phantoms",
                                           count=len(hematite_zones)))

        if "hematite" in c.position:
            parts.append(narrative_variant("apophyllite", "on_hematite"))

        if c.dissolved:
            parts.append(narrative_variant("apophyllite", "dissolved"))
        return " ".join(p for p in parts if p)

    def _narrate_tetrahedrite(self, c: Crystal) -> str:
        """Narrate a tetrahedrite crystal — the Sb-endmember fahlore.

        Prose lives in narratives/tetrahedrite.md. Code dispatches blurb +
        4-way habit (tetrahedral / crustiform / druzy_coating /
        massive_default) + on_chalcopyrite paragenesis +
        oxidative_dissolution.
        """
        parts = [f"Tetrahedrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("tetrahedrite"))

        if c.habit == "tetrahedral":
            parts.append(narrative_variant("tetrahedrite", "tetrahedral"))
        elif c.habit == "crustiform":
            parts.append(narrative_variant("tetrahedrite", "crustiform"))
        elif c.habit == "druzy_coating":
            parts.append(narrative_variant("tetrahedrite", "druzy_coating"))
        else:
            parts.append(narrative_variant("tetrahedrite", "massive_default"))

        if "chalcopyrite" in c.position:
            parts.append(narrative_variant("tetrahedrite", "on_chalcopyrite"))

        if c.dissolved:
            parts.append(narrative_variant("tetrahedrite", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_tennantite(self, c: Crystal) -> str:
        """Narrate a tennantite crystal — the As-endmember fahlore.

        Prose lives in narratives/tennantite.md. Code dispatches blurb +
        4-way habit (tetrahedral / crustiform / druzy_coating /
        massive_default) + alongside_tetrahedrite paragenesis +
        oxidative_dissolution.
        """
        parts = [f"Tennantite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("tennantite"))

        if c.habit == "tetrahedral":
            parts.append(narrative_variant("tennantite", "tetrahedral"))
        elif c.habit == "crustiform":
            parts.append(narrative_variant("tennantite", "crustiform"))
        elif c.habit == "druzy_coating":
            parts.append(narrative_variant("tennantite", "druzy_coating"))
        else:
            parts.append(narrative_variant("tennantite", "massive_default"))

        if "tetrahedrite" in c.position:
            parts.append(narrative_variant("tennantite", "alongside_tetrahedrite"))

        if c.dissolved:
            parts.append(narrative_variant("tennantite", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_erythrite(self, c: Crystal) -> str:
        """Narrate an erythrite crystal's story — the cobalt bloom.

        Prose lives in narratives/erythrite.md. Code dispatches blurb +
        4-way habit (radiating_fibrous / bladed_crystal / botryoidal_crust /
        earthy_default) + on_substrate paragenesis (with {position} interp)
        + paragenetic_source_cobaltite (with {cobaltite_id} interp) +
        dehydration on dissolved.
        """
        parts = [f"Erythrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("erythrite"))

        if c.habit == "radiating_fibrous":
            parts.append(narrative_variant("erythrite", "radiating_fibrous"))
        elif c.habit == "bladed_crystal":
            parts.append(narrative_variant("erythrite", "bladed_crystal"))
        elif c.habit == "botryoidal_crust":
            parts.append(narrative_variant("erythrite", "botryoidal_crust"))
        else:
            parts.append(narrative_variant("erythrite", "earthy_default"))

        if "cobaltite" in c.position or "arsenide" in c.position:
            parts.append(narrative_variant("erythrite", "on_substrate", position=c.position))

        dissolving_cob = [cb for cb in self.crystals if cb.mineral == "cobaltite" and cb.dissolved]
        if dissolving_cob and "cobaltite" not in c.position:
            parts.append(narrative_variant("erythrite", "paragenetic_source_cobaltite",
                                           cobaltite_id=dissolving_cob[0].crystal_id))

        if c.dissolved:
            parts.append(narrative_variant("erythrite", "dehydration"))

        return " ".join(p for p in parts if p)

    def _narrate_annabergite(self, c: Crystal) -> str:
        """Narrate an annabergite crystal's story — the nickel bloom.

        Prose lives in narratives/annabergite.md. Code dispatches blurb +
        4-way habit (cabrerite / co_bearing / capillary_crystal /
        earthy_default) + paragenetic_source_nickeline OR _millerite (with
        {nickeline_id}/{millerite_id} interpolation; mutually exclusive
        elif) + dehydration.
        """
        parts = [f"Annabergite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("annabergite"))

        if c.habit == "cabrerite":
            parts.append(narrative_variant("annabergite", "cabrerite"))
        elif c.habit == "co_bearing":
            parts.append(narrative_variant("annabergite", "co_bearing"))
        elif c.habit == "capillary_crystal":
            parts.append(narrative_variant("annabergite", "capillary_crystal"))
        else:
            parts.append(narrative_variant("annabergite", "earthy_default"))

        dissolving_nik = [nk for nk in self.crystals if nk.mineral == "nickeline" and nk.dissolved]
        dissolving_mil = [ml for ml in self.crystals if ml.mineral == "millerite" and ml.dissolved]
        if dissolving_nik:
            parts.append(narrative_variant("annabergite", "paragenetic_source_nickeline",
                                           nickeline_id=dissolving_nik[0].crystal_id))
        elif dissolving_mil:
            parts.append(narrative_variant("annabergite", "paragenetic_source_millerite",
                                           millerite_id=dissolving_mil[0].crystal_id))

        if c.dissolved:
            parts.append(narrative_variant("annabergite", "dehydration"))

        return " ".join(p for p in parts if p)

    def _narrate_feldspar(self, c: Crystal) -> str:
        """Narrate feldspar — JS canonical (boss-pushed 2026-04-30, commit 34ed3e8).

        Prose lives in narratives/feldspar.md. Boss-design schema: blurb
        is opening line (with {polymorph} + {crystal_id} interp), closing
        is always-emitted tail.

        Code dispatches blurb + 4-way polymorph from nucleation_temp
        (sanidine > 500, orthoclase 300-500, microcline < 300; adularia
        is JS-only declared via mineral_display, not reachable from Python
        T-threshold inference) + amazonite zone-note + perthite zone-note
        + 5-way twin dispatch (Carlsbad / Baveno / cross-hatched / albite /
        generic) + dissolved + closing.
        """
        if c.nucleation_temp > 500:
            polymorph = "Sanidine"
        elif c.nucleation_temp > 300:
            polymorph = "Orthoclase"
        else:
            polymorph = "Microcline"
        parts = [narrative_blurb("feldspar", polymorph=polymorph,
                                 crystal_id=c.crystal_id)]

        if polymorph == "Sanidine":
            parts.append(narrative_variant("feldspar", "sanidine"))
        elif polymorph == "Orthoclase":
            parts.append(narrative_variant("feldspar", "orthoclase"))
        else:
            parts.append(narrative_variant("feldspar", "microcline"))

        zone_notes = [z.note or "" for z in c.zones]
        if any("amazonite" in n for n in zone_notes):
            parts.append(narrative_variant("feldspar", "amazonite"))
        if any("perthite" in n for n in zone_notes):
            parts.append(narrative_variant("feldspar", "perthite"))

        if c.twinned:
            tl = c.twin_law or ""
            if "Carlsbad" in tl:
                parts.append(narrative_variant("feldspar", "carlsbad_twin"))
            elif "Baveno" in tl:
                parts.append(narrative_variant("feldspar", "baveno_twin"))
            elif "cross-hatched" in tl:
                parts.append(narrative_variant("feldspar", "cross_hatch_twin"))
            elif "albite" in tl:
                parts.append(narrative_variant("feldspar", "albite_twin"))
            else:
                parts.append(narrative_variant("feldspar", "generic_twin", twin_law=tl))

        if c.dissolved:
            parts.append(narrative_variant("feldspar", "dissolved"))

        parts.append(narrative_closing("feldspar"))
        return " ".join(p for p in parts if p)

    def _narrate_albite(self, c: Crystal) -> str:
        """Narrate an albite crystal's story — the sodium end-member.

        Prose lives in narratives/albite.md. Code dispatches blurb +
        peristerite zone-note flag + cleavelandite habit (drift
        consolidation — gained from JS) + twinned (with {twin_law}) +
        dissolved.
        """
        parts = [f"Albite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("albite"))

        peristerite = any("peristerite" in z.note for z in c.zones)
        if peristerite:
            parts.append(narrative_variant("albite", "peristerite"))

        if c.habit and "cleavelandite" in c.habit:
            parts.append(narrative_variant("albite", "cleavelandite"))

        if c.twinned:
            parts.append(narrative_variant("albite", "twinned", twin_law=c.twin_law))

        if c.dissolved:
            parts.append(narrative_variant("albite", "dissolved"))

        return " ".join(p for p in parts if p)

    def _narrate_topaz(self, c: Crystal) -> str:
        """Narrate topaz — the fluorine-bearing nesosilicate.

        Prose lives in narratives/topaz.md. Code dispatches blurb +
        5-way zone-note color (pink_imperial / imperial_gold / pale_blue /
        pale_yellow / colorless_default elif chain) + 2-way fluid_inclusions
        (geothermometer with {avg_T} sub-branch / regular {count} count) +
        trace_ti_rutile when avg Ti > 0.05 + phantom_boundary with computed
        {phantom_phrase} pluralization + dissolved.
        """
        parts = [f"Topaz #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("topaz"))

        zone_notes = [z.note or "" for z in c.zones]
        if any("pink imperial" in n for n in zone_notes):
            parts.append(narrative_variant("topaz", "pink_imperial"))
        elif any("imperial golden-orange" in n for n in zone_notes):
            parts.append(narrative_variant("topaz", "imperial_gold"))
        elif any("pale blue" in n for n in zone_notes):
            parts.append(narrative_variant("topaz", "pale_blue"))
        elif any("pale yellow" in n for n in zone_notes):
            parts.append(narrative_variant("topaz", "pale_yellow"))
        else:
            parts.append(narrative_variant("topaz", "colorless_default"))

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            geothermometer = any("geothermometer" in z.inclusion_type for z in inclusion_zones)
            if geothermometer:
                avg_T = sum(z.temperature for z in inclusion_zones) / len(inclusion_zones)
                parts.append(narrative_variant("topaz", "fluid_inclusions_geothermometer",
                                               count=len(inclusion_zones),
                                               avg_T=f"{avg_T:.0f}"))
            else:
                parts.append(narrative_variant("topaz", "fluid_inclusions",
                                               count=len(inclusion_zones)))

        avg_Ti = sum(z.trace_Ti for z in c.zones) / max(len(c.zones), 1)
        if avg_Ti > 0.05:
            parts.append(narrative_variant("topaz", "trace_ti_rutile"))

        if c.phantom_count >= 1:
            phantom_phrase = (f"{c.phantom_count} phantom boundaries"
                              if c.phantom_count > 1
                              else f"{c.phantom_count} phantom boundary")
            parts.append(narrative_variant("topaz", "phantom_boundary",
                                           phantom_phrase=phantom_phrase))

        if c.dissolved:
            parts.append(narrative_variant("topaz", "dissolved"))

        return " ".join(p for p in parts if p)

    def _narrate_tourmaline(self, c: Crystal) -> str:
        """Narrate tourmaline — the schorl→elbaite color diary.

        Prose lives in narratives/tourmaline.md. Code dispatches blurb +
        zone-note variety detection (color_zoned_schorl with {others}
        interp if multi-variety crystal includes schorl, OR single-variety
        elif chain) + ALWAYS-emitted closing tail.
        """
        parts = [f"Tourmaline #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("tourmaline"))

        zone_notes = [z.note or "" for z in c.zones]
        varieties = set()
        for n in zone_notes:
            if "schorl" in n: varieties.add("schorl")
            if "rubellite" in n: varieties.add("rubellite")
            if "verdelite" in n: varieties.add("verdelite")
            if "indicolite" in n: varieties.add("indicolite")
            if "Paraíba" in n or "paraiba" in n: varieties.add("paraiba")
            if "achroite" in n: varieties.add("achroite")

        if {"schorl"} < varieties:
            other = sorted(varieties - {"schorl"})
            parts.append(narrative_variant("tourmaline", "color_zoned_schorl",
                                           others=", ".join(other)))
        elif "paraiba" in varieties:
            parts.append(narrative_variant("tourmaline", "paraiba"))
        elif "rubellite" in varieties:
            parts.append(narrative_variant("tourmaline", "rubellite"))
        elif "verdelite" in varieties:
            parts.append(narrative_variant("tourmaline", "verdelite"))
        elif "indicolite" in varieties:
            parts.append(narrative_variant("tourmaline", "indicolite"))
        elif "schorl" in varieties:
            parts.append(narrative_variant("tourmaline", "schorl"))
        elif "achroite" in varieties:
            parts.append(narrative_variant("tourmaline", "achroite"))

        parts.append(narrative_closing("tourmaline"))
        return " ".join(p for p in parts if p)

    def _narrate_beryl(self, c: Crystal) -> str:
        """Narrate a beryl/goshenite crystal — post-Round-7 the colorless fallback.

        Prose lives in narratives/beryl.md. Code dispatches blurb +
        ALWAYS-emitted goshenite_clean (the chromophore-gate explanation) +
        fluid_inclusions count (with {count} interp) + ALWAYS-emitted
        c-axis thermal history tail + hf_dissolution.

        In the split architecture, `beryl` is specifically the goshenite /
        generic colorless engine — fires only when no chromophore trace is
        above its variety gate. Green/blue/pink/yellow varieties are
        emerald/aquamarine/morganite/heliodor (their own narrators).
        """
        parts = [f"Goshenite (beryl) #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("beryl"))
        parts.append(narrative_variant("beryl", "goshenite_clean"))

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            parts.append(narrative_variant("beryl", "fluid_inclusions",
                                           count=len(inclusion_zones)))

        parts.append(narrative_variant("beryl", "c_axis_thermal_history"))

        if c.dissolved:
            parts.append(narrative_variant("beryl", "hf_dissolution"))

        return " ".join(p for p in parts if p)

    def _narrate_emerald(self, c: Crystal) -> str:
        """Narrate an emerald — the Cr-paradox beryl variety.

        Prose lives in narratives/emerald.md. Code dispatches blurb +
        trapiche habit (zone-note OR habit string match) + jardin
        fluid_inclusions count (with {count} interp) + hf_dissolution.
        """
        parts = [f"Emerald #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("emerald"))

        zone_notes = [z.note or "" for z in c.zones]
        is_trapiche = any("trapiche" in n for n in zone_notes) or c.habit == "trapiche"
        if is_trapiche:
            parts.append(narrative_variant("emerald", "trapiche"))

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            parts.append(narrative_variant("emerald", "jardin",
                                           count=len(inclusion_zones)))

        if c.dissolved:
            parts.append(narrative_variant("emerald", "hf_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_aquamarine(self, c: Crystal) -> str:
        """Narrate an aquamarine — the Fe²⁺ blue variety of beryl.

        Prose lives in narratives/aquamarine.md. Code dispatches blurb +
        fluid_inclusions count (with {count} interp) + 2-way habit
        (stubby_tabular / hex_prism_long; no default) + hf_dissolution.
        """
        parts = [f"Aquamarine #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("aquamarine"))

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            parts.append(narrative_variant("aquamarine", "fluid_inclusions",
                                           count=len(inclusion_zones)))

        if c.habit == "stubby_tabular":
            parts.append(narrative_variant("aquamarine", "stubby_tabular"))
        elif c.habit == "hex_prism_long":
            parts.append(narrative_variant("aquamarine", "hex_prism_long"))

        if c.dissolved:
            parts.append(narrative_variant("aquamarine", "hf_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_morganite(self, c: Crystal) -> str:
        """Narrate a morganite — the Mn pink variety of beryl.

        Prose lives in narratives/morganite.md. Code dispatches blurb +
        ALWAYS-emitted late_stage_pegmatite (the Mn-accumulation story) +
        tabular_hex habit + fluid_inclusions count (with {count} interp)
        + hf_dissolution.
        """
        parts = [f"Morganite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("morganite"))
        parts.append(narrative_variant("morganite", "late_stage_pegmatite"))

        if c.habit == "tabular_hex":
            parts.append(narrative_variant("morganite", "tabular_hex"))

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            parts.append(narrative_variant("morganite", "fluid_inclusions",
                                           count=len(inclusion_zones)))

        if c.dissolved:
            parts.append(narrative_variant("morganite", "hf_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_heliodor(self, c: Crystal) -> str:
        """Narrate a heliodor — the Fe³⁺ yellow variety of beryl.

        Prose lives in narratives/heliodor.md. Code dispatches blurb +
        namibian_deep_yellow zone-note flag + fluid_inclusions count
        (with {count} interp) + ALWAYS-emitted color_stability tail +
        hf_dissolution.
        """
        parts = [f"Heliodor #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("heliodor"))

        zone_notes = [z.note or "" for z in c.zones]
        if any("Namibian" in n for n in zone_notes):
            parts.append(narrative_variant("heliodor", "namibian_deep_yellow"))

        inclusion_zones = [z for z in c.zones if z.fluid_inclusion]
        if inclusion_zones:
            parts.append(narrative_variant("heliodor", "fluid_inclusions",
                                           count=len(inclusion_zones)))

        parts.append(narrative_variant("heliodor", "color_stability"))

        if c.dissolved:
            parts.append(narrative_variant("heliodor", "hf_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_corundum(self, c: Crystal) -> str:
        """Narrate a colorless corundum — the generic Al₂O₃ variety.

        Prose lives in narratives/corundum.md. Code dispatches blurb +
        2-way habit (tabular / barrel; no default) + trace_ti when avg
        Ti > 0.05 + dissolved.
        """
        parts = [f"Corundum #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("corundum"))
        if c.habit == "tabular":
            parts.append(narrative_variant("corundum", "tabular"))
        elif c.habit == "barrel":
            parts.append(narrative_variant("corundum", "barrel"))
        avg_Ti = sum(z.trace_Ti for z in c.zones) / max(len(c.zones), 1)
        if avg_Ti > 0.05:
            parts.append(narrative_variant("corundum", "trace_ti"))
        if c.dissolved:
            parts.append(narrative_variant("corundum", "dissolved"))
        return " ".join(p for p in parts if p)

    def _narrate_ruby(self, c: Crystal) -> str:
        """Narrate a ruby crystal — the chromium red variety.

        Prose lives in narratives/ruby.md. Code dispatches blurb +
        zone-note color grade (pigeons_blood / cherry / pinkish, elif) +
        3-way habit (asterated / barrel / tabular).
        """
        parts = [f"Ruby #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("ruby"))
        zone_notes = [z.note or "" for z in c.zones]
        if any("pigeon" in n for n in zone_notes):
            parts.append(narrative_variant("ruby", "pigeons_blood"))
        elif any("cherry" in n for n in zone_notes):
            parts.append(narrative_variant("ruby", "cherry"))
        elif any("pinkish" in n for n in zone_notes):
            parts.append(narrative_variant("ruby", "pinkish"))
        if c.habit == "asterated":
            parts.append(narrative_variant("ruby", "asterated"))
        elif c.habit == "barrel":
            parts.append(narrative_variant("ruby", "barrel"))
        elif c.habit == "tabular":
            parts.append(narrative_variant("ruby", "tabular"))
        return " ".join(p for p in parts if p)

    def _narrate_sapphire(self, c: Crystal) -> str:
        """Narrate a sapphire — the multi-color non-red corundum family.

        Prose lives in narratives/sapphire.md. Code dispatches blurb +
        7-way zone-note color (cornflower / royal_blue / padparadscha /
        yellow / violet / pink / green, elif chain) + 3-way habit
        (asterated / barrel / tabular).
        """
        parts = [f"Sapphire #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("sapphire"))
        zone_notes = [z.note or "" for z in c.zones]
        if any("cornflower" in n for n in zone_notes):
            parts.append(narrative_variant("sapphire", "cornflower"))
        elif any("royal blue" in n for n in zone_notes):
            parts.append(narrative_variant("sapphire", "royal_blue"))
        elif any("padparadscha" in n for n in zone_notes):
            parts.append(narrative_variant("sapphire", "padparadscha"))
        elif any("yellow" in n for n in zone_notes):
            parts.append(narrative_variant("sapphire", "yellow"))
        elif any("violet" in n for n in zone_notes):
            parts.append(narrative_variant("sapphire", "violet"))
        elif any("pink" in n for n in zone_notes):
            parts.append(narrative_variant("sapphire", "pink"))
        elif any("green" in n for n in zone_notes):
            parts.append(narrative_variant("sapphire", "green"))
        if c.habit == "asterated":
            parts.append(narrative_variant("sapphire", "asterated"))
        elif c.habit == "barrel":
            parts.append(narrative_variant("sapphire", "barrel"))
        elif c.habit == "tabular":
            parts.append(narrative_variant("sapphire", "tabular"))
        return " ".join(p for p in parts if p)

    def _narrate_spodumene(self, c: Crystal) -> str:
        """Narrate spodumene — the lithium pyroxene book.

        Prose lives in narratives/spodumene.md. Code dispatches blurb +
        zone-note variety detection (kunzite / hiddenite / triphane elif
        chain) + ALWAYS-emitted pyroxene-structure closing.
        """
        parts = [f"Spodumene #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("spodumene"))

        zone_notes = [z.note or "" for z in c.zones]
        varieties = set()
        for n in zone_notes:
            if "kunzite" in n: varieties.add("kunzite")
            if "hiddenite" in n: varieties.add("hiddenite")
            if "triphane" in n: varieties.add("triphane")

        if "kunzite" in varieties:
            parts.append(narrative_variant("spodumene", "kunzite"))
        elif "hiddenite" in varieties:
            parts.append(narrative_variant("spodumene", "hiddenite"))
        elif "triphane" in varieties:
            parts.append(narrative_variant("spodumene", "triphane"))

        parts.append(narrative_closing("spodumene"))
        return " ".join(p for p in parts if p)

    def _narrate_anglesite(self, c: Crystal) -> str:
        """Narrate an anglesite crystal — the transient lead sulfate.

        Prose lives in narratives/anglesite.md. Code dispatches blurb +
        on_galena paragenesis + converting_to_cerussite zone-note flag +
        dissolved.
        """
        parts = [f"Anglesite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("anglesite"))
        if "galena" in (c.position or ""):
            parts.append(narrative_variant("anglesite", "on_galena"))
        if any("→ cerussite" in (z.note or "") for z in c.zones):
            parts.append(narrative_variant("anglesite", "converting_to_cerussite"))
        if c.dissolved:
            parts.append(narrative_variant("anglesite", "dissolved"))
        return " ".join(p for p in parts if p)

    def _narrate_cerussite(self, c: Crystal) -> str:
        """Narrate a cerussite crystal — the star-twin lead carbonate.

        Prose lives in narratives/cerussite.md. Code dispatches blurb +
        flag conditionals (sixling twin, galena paragenesis, dissolved).
        """
        parts = [f"Cerussite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("cerussite"))
        if c.twinned and "sixling" in (c.twin_law or ""):
            parts.append(narrative_variant("cerussite", "sixling_twin"))
        if "galena" in (c.position or ""):
            parts.append(narrative_variant("cerussite", "on_galena"))
        if c.dissolved:
            parts.append(narrative_variant("cerussite", "acid_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_pyromorphite(self, c: Crystal) -> str:
        """Narrate a pyromorphite crystal — the phosphate lead apatite.

        Prose lives in narratives/pyromorphite.md. Code dispatches blurb +
        2-way habit (olive_classic / non_canonical_color) + ALWAYS-emitted
        environmental remediation tail.
        """
        parts = [f"Pyromorphite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("pyromorphite"))
        if "olive" in (c.habit or ""):
            parts.append(narrative_variant("pyromorphite", "olive_classic"))
        elif "yellow" in (c.habit or "") or "brown" in (c.habit or ""):
            parts.append(narrative_variant("pyromorphite", "non_canonical_color"))
        parts.append(narrative_variant("pyromorphite", "remediation_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_vanadinite(self, c: Crystal) -> str:
        """Narrate a vanadinite crystal — the red desert lead vanadate.

        Prose lives in narratives/vanadinite.md. Code dispatches blurb +
        2-way habit (endlichite / red_signature) + ALWAYS-emitted desert tail
        + vanadate_companions (with {companions} interpolation) when
        descloizite or mottramite is active in the same vug.
        """
        parts = [f"Vanadinite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("vanadinite"))
        if "endlichite" in (c.habit or ""):
            parts.append(narrative_variant("vanadinite", "endlichite"))
        elif "red" in (c.habit or ""):
            parts.append(narrative_variant("vanadinite", "red_signature"))
        parts.append(narrative_variant("vanadinite", "desert_tail"))

        # Round 8d addition: descloizite + mottramite paragenetic companions.
        active_des = [dc for dc in self.crystals if dc.mineral == "descloizite" and dc.active]
        active_mot = [mc for mc in self.crystals if mc.mineral == "mottramite" and mc.active]
        if active_des or active_mot:
            companions = []
            if active_des:
                companions.append(f"descloizite #{active_des[0].crystal_id}")
            if active_mot:
                companions.append(f"mottramite #{active_mot[0].crystal_id}")
            parts.append(narrative_variant("vanadinite", "vanadate_companions",
                                           companions=" and ".join(companions)))

        return " ".join(p for p in parts if p)

    def _narrate_bornite(self, c: Crystal) -> str:
        """Narrate a bornite crystal — the 228°C order-disorder mineral.

        Prose lives in narratives/bornite.md. Code dispatches blurb +
        2-way habit (pseudo_cubic / peacock) + oxidative dissolution.
        """
        parts = [f"Bornite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("bornite"))
        if "pseudo_cubic" in (c.habit or ""):
            parts.append(narrative_variant("bornite", "pseudo_cubic"))
        elif "peacock" in (c.habit or ""):
            parts.append(narrative_variant("bornite", "peacock"))
        if c.dissolved:
            parts.append(narrative_variant("bornite", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_chalcocite(self, c: Crystal) -> str:
        """Narrate a chalcocite crystal — the pseudomorph thief.

        Prose lives in narratives/chalcocite.md. Code dispatches blurb +
        sixling twin + INDEPENDENT pseudomorph and sooty branches (both
        can fire for a 'pseudomorph_sooty' habit string).
        """
        parts = [f"Chalcocite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("chalcocite"))
        if c.twinned and "sixling" in (c.twin_law or ""):
            parts.append(narrative_variant("chalcocite", "sixling_twin"))
        if "pseudomorph" in (c.habit or ""):
            parts.append(narrative_variant("chalcocite", "pseudomorph"))
        if "sooty" in (c.habit or ""):
            parts.append(narrative_variant("chalcocite", "sooty"))
        return " ".join(p for p in parts if p)

    def _narrate_covellite(self, c: Crystal) -> str:
        """Narrate a covellite crystal — the only common blue mineral.

        Prose lives in narratives/covellite.md. Code dispatches blurb +
        2-way habit (iridescent / rosette) + ALWAYS-emitted stoichiometry
        tail + dissolved.
        """
        parts = [f"Covellite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("covellite"))
        if "iridescent" in (c.habit or ""):
            parts.append(narrative_variant("covellite", "iridescent"))
        elif "rosette" in (c.habit or ""):
            parts.append(narrative_variant("covellite", "rosette"))
        parts.append(narrative_variant("covellite", "stoichiometry"))
        if c.dissolved:
            parts.append(narrative_variant("covellite", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_cuprite(self, c: Crystal) -> str:
        """Narrate a cuprite crystal — the Eh-boundary oxide.

        Prose lives in narratives/cuprite.md. Code dispatches blurb +
        4-way habit (chalcotrichite / massive / spinel_twin (twinned
        sub-condition) / octahedral_default) + Eh-shift dissolution.
        """
        parts = [f"Cuprite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("cuprite"))
        if c.habit == "chalcotrichite":
            parts.append(narrative_variant("cuprite", "chalcotrichite"))
        elif "massive" in (c.habit or ""):
            parts.append(narrative_variant("cuprite", "massive"))
        elif c.twinned and "spinel" in (c.twin_law or ""):
            parts.append(narrative_variant("cuprite", "spinel_twin"))
        else:
            parts.append(narrative_variant("cuprite", "octahedral_default"))
        if c.dissolved:
            parts.append(narrative_variant("cuprite", "eh_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_azurite(self, c: Crystal) -> str:
        """Narrate an azurite crystal — the deep-blue carbonate.

        Prose lives in narratives/azurite.md. Code dispatches on habit
        and on the paramorph-conversion zone-note signal; markdown owns
        the words.
        """
        parts = [f"Azurite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("azurite"))
        if c.habit == "azurite_sun":
            parts.append(narrative_variant("azurite", "azurite_sun"))
        elif c.habit == "rosette_bladed":
            parts.append(narrative_variant("azurite", "rosette_bladed"))
        else:
            parts.append(narrative_variant("azurite", "monoclinic_prismatic"))
        has_conversion = any("→ malachite" in (z.note or "") for z in c.zones)
        if has_conversion:
            parts.append(narrative_variant("azurite", "malachite_conversion"))
        if c.dissolved and not has_conversion:
            parts.append(narrative_variant("azurite", "dissolved"))
        return " ".join(p for p in parts if p)

    def _narrate_chrysocolla(self, c: Crystal) -> str:
        """Narrate chrysocolla — the cyan copper silicate.

        Prose lives in narratives/chrysocolla.md. Code dispatches blurb +
        5-way habit (pseudomorph_after_azurite / enamel_on_cuprite /
        botryoidal_crust / reniform_globules / silica_gel_default) +
        dissolved.
        """
        parts = [f"Chrysocolla #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("chrysocolla"))
        if c.habit == "pseudomorph_after_azurite":
            parts.append(narrative_variant("chrysocolla", "pseudomorph_after_azurite"))
        elif c.habit == "enamel_on_cuprite":
            parts.append(narrative_variant("chrysocolla", "enamel_on_cuprite"))
        elif c.habit == "botryoidal_crust":
            parts.append(narrative_variant("chrysocolla", "botryoidal_crust"))
        elif c.habit == "reniform_globules":
            parts.append(narrative_variant("chrysocolla", "reniform_globules"))
        else:
            parts.append(narrative_variant("chrysocolla", "silica_gel_default"))
        if c.dissolved:
            parts.append(narrative_variant("chrysocolla", "dissolved"))
        return " ".join(p for p in parts if p)

    def _narrate_native_copper(self, c: Crystal) -> str:
        """Narrate a native copper crystal — the elemental metal.

        Prose lives in narratives/native_copper.md. Code dispatches blurb +
        4-way habit (massive_sheet / arborescent_dendritic / wire_copper /
        cubic_dodecahedral default) + ALWAYS-emitted Statue-of-Liberty tail.
        """
        parts = [f"Native copper #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("native_copper"))
        if c.habit == "massive_sheet":
            parts.append(narrative_variant("native_copper", "massive_sheet"))
        elif c.habit == "arborescent_dendritic":
            parts.append(narrative_variant("native_copper", "arborescent_dendritic"))
        elif c.habit == "wire_copper":
            parts.append(narrative_variant("native_copper", "wire_copper"))
        else:
            parts.append(narrative_variant("native_copper", "cubic_dodecahedral"))
        parts.append(narrative_variant("native_copper", "statue_of_liberty_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_native_gold(self, c: Crystal) -> str:
        """Narrate a native gold crystal — the noble metal.

        Prose lives in narratives/native_gold.md. Code dispatches blurb +
        3-way habit (nugget / dendritic / octahedral_default) + 2-way
        alloy on dominant_forms (electrum vs cuproauride) + ALWAYS-emitted
        noble tail.
        """
        parts = [f"Native gold #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("native_gold"))
        if c.habit == "nugget":
            parts.append(narrative_variant("native_gold", "nugget"))
        elif c.habit == "dendritic":
            parts.append(narrative_variant("native_gold", "dendritic"))
        else:
            parts.append(narrative_variant("native_gold", "octahedral_default"))
        # Alloy notes derived from broth's dominant_forms at nucleation.
        if c.dominant_forms and any("electrum" in f.lower() for f in c.dominant_forms):
            parts.append(narrative_variant("native_gold", "alloy_electrum"))
        elif c.dominant_forms and any("cuproauride" in f.lower() or "rose-gold" in f.lower() for f in c.dominant_forms):
            parts.append(narrative_variant("native_gold", "alloy_cuproauride"))
        parts.append(narrative_variant("native_gold", "noble_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_magnetite(self, c: Crystal) -> str:
        """Narrate a magnetite crystal — the lodestone spinel.

        Prose lives in narratives/magnetite.md. Code dispatches blurb +
        3-way habit (octahedral / rhombic_dodecahedral / granular_massive
        default) + dissolved (martite pseudomorph).
        """
        parts = [f"Magnetite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("magnetite"))
        if c.habit == "octahedral":
            parts.append(narrative_variant("magnetite", "octahedral"))
        elif c.habit == "rhombic_dodecahedral":
            parts.append(narrative_variant("magnetite", "rhombic_dodecahedral"))
        else:
            parts.append(narrative_variant("magnetite", "granular_massive"))
        if c.dissolved:
            parts.append(narrative_variant("magnetite", "martite_pseudomorph"))
        return " ".join(p for p in parts if p)

    def _narrate_lepidocrocite(self, c: Crystal) -> str:
        """Narrate a lepidocrocite crystal — the kinetically-favored FeOOH.

        Prose lives in narratives/lepidocrocite.md. Code dispatches blurb +
        3-way habit (platy_scales / plumose_rosette / fibrous_micaceous
        default) + ALWAYS-emitted conversion-to-goethite tail.
        """
        parts = [f"Lepidocrocite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("lepidocrocite"))
        if c.habit == "platy_scales":
            parts.append(narrative_variant("lepidocrocite", "platy_scales"))
        elif c.habit == "plumose_rosette":
            parts.append(narrative_variant("lepidocrocite", "plumose_rosette"))
        else:
            parts.append(narrative_variant("lepidocrocite", "fibrous_micaceous"))
        parts.append(narrative_variant("lepidocrocite", "conversion_tail"))
        return " ".join(p for p in parts if p)

    def _narrate_stibnite(self, c: Crystal) -> str:
        """Narrate stibnite — the Ichinokawa sword-blade Sb sulfide.

        Prose lives in narratives/stibnite.md.
        """
        parts = [f"Stibnite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("stibnite"))
        if c.habit == "elongated_prism_blade":
            parts.append(narrative_variant("stibnite", "elongated_prism_blade"))
        elif c.habit == "radiating_spray":
            parts.append(narrative_variant("stibnite", "radiating_spray"))
        else:
            parts.append(narrative_variant("stibnite", "massive_default"))
        return " ".join(p for p in parts if p)

    def _narrate_arsenopyrite(self, c: Crystal) -> str:
        """Narrate arsenopyrite — the arsenic gateway + invisible-gold trap.

        Prose lives in narratives/arsenopyrite.md. Code dispatches blurb +
        invisible_gold (with {trapped_au} 3-decimal interp) when zones-summed
        trace_Au > 0.01 ppm + 4-way habit (striated_prism / rhombic_blade /
        acicular / massive_default) + oxidation_front when dissolved.
        """
        parts = [f"Arsenopyrite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("arsenopyrite"))

        total_trapped_au = sum(z.trace_Au for z in c.zones)
        if total_trapped_au > 0.01:
            parts.append(narrative_variant("arsenopyrite", "invisible_gold",
                                           trapped_au=f"{total_trapped_au:.3f}"))

        if c.habit == "striated_prism":
            parts.append(narrative_variant("arsenopyrite", "striated_prism"))
        elif c.habit == "rhombic_blade":
            parts.append(narrative_variant("arsenopyrite", "rhombic_blade"))
        elif c.habit == "acicular":
            parts.append(narrative_variant("arsenopyrite", "acicular"))
        else:
            parts.append(narrative_variant("arsenopyrite", "massive_default"))

        if c.dissolved:
            parts.append(narrative_variant("arsenopyrite", "oxidation_front"))
        return " ".join(p for p in parts if p)

    def _narrate_scorodite(self, c: Crystal) -> str:
        """Narrate scorodite — the arsenic sequestration arsenate.

        Prose lives in narratives/scorodite.md. Code dispatches blurb +
        2-way habit (dipyramidal with Fe-rich/pale sub-branch on avg_Fe
        threshold / earthy_default) + dissolved (arsenic_remobilization).
        """
        parts = [f"Scorodite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("scorodite"))

        if c.habit == "dipyramidal":
            avg_Fe = sum(z.trace_Fe for z in c.zones) / max(len(c.zones), 1)
            if avg_Fe > 0.15:
                parts.append(narrative_variant("scorodite", "dipyramidal_fe_rich"))
            else:
                parts.append(narrative_variant("scorodite", "dipyramidal_pale"))
        else:
            parts.append(narrative_variant("scorodite", "earthy_default"))

        if c.dissolved:
            parts.append(narrative_variant("scorodite", "dissolved_arsenic_remobilization"))
        return " ".join(p for p in parts if p)

    def _narrate_ferrimolybdite(self, c: Crystal) -> str:
        """Narrate ferrimolybdite — the canary-yellow no-lead Mo oxidation.

        Prose lives in narratives/ferrimolybdite.md. Code dispatches blurb +
        3-way habit ('acicular tuft' / 'fibrous mat' / powdery_default) +
        dissolved (dehydration). Habit strings have spaces — preserve as-is.
        """
        parts = [f"Ferrimolybdite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("ferrimolybdite"))

        if c.habit == "acicular tuft":
            parts.append(narrative_variant("ferrimolybdite", "acicular_tuft"))
        elif c.habit == "fibrous mat":
            parts.append(narrative_variant("ferrimolybdite", "fibrous_mat"))
        else:
            parts.append(narrative_variant("ferrimolybdite", "powdery_default"))

        if c.dissolved:
            parts.append(narrative_variant("ferrimolybdite", "dehydration"))
        return " ".join(p for p in parts if p)

    def _narrate_bismuthinite(self, c: Crystal) -> str:
        """Narrate bismuthinite — the Bi sulfide cousin of stibnite.

        Prose lives in narratives/bismuthinite.md.
        """
        parts = [f"Bismuthinite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("bismuthinite"))
        if "stout" in (c.habit or ""):
            parts.append(narrative_variant("bismuthinite", "stout"))
        elif "radiating" in (c.habit or ""):
            parts.append(narrative_variant("bismuthinite", "radiating"))
        else:
            parts.append(narrative_variant("bismuthinite", "acicular_default"))
        return " ".join(p for p in parts if p)

    def _narrate_native_bismuth(self, c: Crystal) -> str:
        """Narrate native bismuth — the lowest-melting native metal.

        Prose lives in narratives/native_bismuth.md.
        """
        parts = [f"Native bismuth #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("native_bismuth"))
        if c.habit == "arborescent_dendritic":
            parts.append(narrative_variant("native_bismuth", "arborescent_dendritic"))
        elif c.habit == "rhombohedral_crystal":
            parts.append(narrative_variant("native_bismuth", "rhombohedral_crystal"))
        else:
            parts.append(narrative_variant("native_bismuth", "massive_default"))
        return " ".join(p for p in parts if p)

    def _narrate_clinobisvanite(self, c: Crystal) -> str:
        """Narrate clinobisvanite — the end of the bismuth oxidation chain.

        Prose lives in narratives/clinobisvanite.md. Blurb-only with a
        '## closing' photocatalyst tail (boss-design schema).
        """
        parts = [f"Clinobisvanite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("clinobisvanite"))
        parts.append(narrative_closing("clinobisvanite"))
        return " ".join(p for p in parts if p)

    def _narrate_acanthite(self, c: Crystal) -> str:
        """Narrate acanthite — the cold-storage form of Ag₂S.

        Prose lives in narratives/acanthite.md. Code dispatches blurb +
        either paramorph (with {step_phrase} + {habit_pretty} interp;
        early-return — paramorphic crystals don't get the standard
        habit/dissolved/tarnish branches) OR primary path: 3-way habit
        (thorn / prismatic / massive_default) + paired oxidative_dissolution-
        vs-tarnish branches.
        """
        parts = [f"Acanthite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("acanthite"))

        if c.paramorph_origin == "argentite":
            step_phrase = f" at step {c.paramorph_step}" if c.paramorph_step else ""
            habit_pretty = c.habit.replace("_", " ")
            parts.append(narrative_variant("acanthite", "paramorph",
                                           step_phrase=step_phrase,
                                           habit_pretty=habit_pretty))
            return " ".join(p for p in parts if p)

        if c.habit == "thorn":
            parts.append(narrative_variant("acanthite", "thorn"))
        elif c.habit == "prismatic":
            parts.append(narrative_variant("acanthite", "prismatic"))
        else:
            parts.append(narrative_variant("acanthite", "massive_default"))

        if c.dissolved:
            parts.append(narrative_variant("acanthite", "oxidative_dissolution"))
        elif len(c.zones) > 15:
            parts.append(narrative_variant("acanthite", "tarnish"))
        return " ".join(p for p in parts if p)

    def _narrate_chalcanthite(self, c: Crystal) -> str:
        """Narrate chalcanthite — the bright-blue water-soluble Cu sulfate.

        Prose lives in narratives/chalcanthite.md. Code dispatches blurb +
        3-way habit (stalactitic / tabular / efflorescent_default) +
        cruciform twin + cyclic_dissolution.
        """
        parts = [f"Chalcanthite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("chalcanthite"))

        if c.habit == "stalactitic":
            parts.append(narrative_variant("chalcanthite", "stalactitic"))
        elif c.habit == "tabular":
            parts.append(narrative_variant("chalcanthite", "tabular"))
        else:
            parts.append(narrative_variant("chalcanthite", "efflorescent_default"))

        if c.twinned and "cruciform" in (c.twin_law or ""):
            parts.append(narrative_variant("chalcanthite", "cruciform_twin"))

        if c.dissolved:
            parts.append(narrative_variant("chalcanthite", "cyclic_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_descloizite(self, c: Crystal) -> str:
        """Narrate descloizite — the cherry-red Zn-end Pb vanadate.

        Prose lives in narratives/descloizite.md. Code dispatches blurb +
        3-way habit (botryoidal / prismatic / tabular_default).
        """
        parts = [f"Descloizite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("descloizite"))
        if c.habit == "botryoidal":
            parts.append(narrative_variant("descloizite", "botryoidal"))
        elif c.habit == "prismatic":
            parts.append(narrative_variant("descloizite", "prismatic"))
        else:
            parts.append(narrative_variant("descloizite", "tabular_default"))
        return " ".join(p for p in parts if p)

    def _narrate_mottramite(self, c: Crystal) -> str:
        """Narrate mottramite — the olive-green Cu-end Pb vanadate.

        Prose lives in narratives/mottramite.md. Code dispatches blurb +
        3-way habit (botryoidal / prismatic / tabular_default).
        """
        parts = [f"Mottramite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("mottramite"))
        if c.habit == "botryoidal":
            parts.append(narrative_variant("mottramite", "botryoidal"))
        elif c.habit == "prismatic":
            parts.append(narrative_variant("mottramite", "prismatic"))
        else:
            parts.append(narrative_variant("mottramite", "tabular_default"))
        return " ".join(p for p in parts if p)

    def _narrate_raspite(self, c: Crystal) -> str:
        """Narrate raspite — the rare monoclinic PbWO₄.

        Prose lives in narratives/raspite.md. Blurb-only narrator (no
        habit dispatch — raspite is uniformly tabular).
        """
        parts = [f"Raspite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("raspite"))
        return " ".join(p for p in parts if p)

    def _narrate_stolzite(self, c: Crystal) -> str:
        """Narrate stolzite — the common tetragonal PbWO₄.

        Prose lives in narratives/stolzite.md. Code dispatches blurb +
        2-way habit (dipyramidal / tabular_default).
        """
        parts = [f"Stolzite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("stolzite"))
        if c.habit == "dipyramidal":
            parts.append(narrative_variant("stolzite", "dipyramidal"))
        else:
            parts.append(narrative_variant("stolzite", "tabular_default"))
        return " ".join(p for p in parts if p)

    def _narrate_olivenite(self, c: Crystal) -> str:
        """Narrate olivenite — the olive-green Cu arsenate.

        Prose lives in narratives/olivenite.md. Code dispatches blurb +
        3-way habit (fibrous / prismatic / globular_default).
        """
        parts = [f"Olivenite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("olivenite"))
        if c.habit == "fibrous":
            parts.append(narrative_variant("olivenite", "fibrous"))
        elif c.habit == "prismatic":
            parts.append(narrative_variant("olivenite", "prismatic"))
        else:
            parts.append(narrative_variant("olivenite", "globular_default"))
        return " ".join(p for p in parts if p)

    def _narrate_nickeline(self, c: Crystal) -> str:
        """Narrate nickeline — the high-T pale-copper-red Ni arsenide.

        Prose lives in narratives/nickeline.md. Code dispatches blurb +
        3-way habit (reniform / columnar / massive_default) +
        oxidative_dissolution-vs-tarnish paired branches (dissolved or
        zone count > 12).
        """
        parts = [f"Nickeline #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("nickeline"))
        if c.habit == "reniform":
            parts.append(narrative_variant("nickeline", "reniform"))
        elif c.habit == "columnar":
            parts.append(narrative_variant("nickeline", "columnar"))
        else:
            parts.append(narrative_variant("nickeline", "massive_default"))
        if c.dissolved:
            parts.append(narrative_variant("nickeline", "oxidative_dissolution"))
        elif len(c.zones) > 12:
            parts.append(narrative_variant("nickeline", "tarnish"))
        return " ".join(p for p in parts if p)

    def _narrate_millerite(self, c: Crystal) -> str:
        """Narrate millerite — the capillary brass-yellow nickel sulfide.

        Prose lives in narratives/millerite.md. Code dispatches blurb +
        3-way habit (capillary / acicular / massive_default) +
        oxidative_dissolution.
        """
        parts = [f"Millerite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("millerite"))
        if c.habit == "capillary":
            parts.append(narrative_variant("millerite", "capillary"))
        elif c.habit == "acicular":
            parts.append(narrative_variant("millerite", "acicular"))
        else:
            parts.append(narrative_variant("millerite", "massive_default"))
        if c.dissolved:
            parts.append(narrative_variant("millerite", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_cobaltite(self, c: Crystal) -> str:
        """Narrate cobaltite — the three-element-gate sulfarsenide.

        Prose lives in narratives/cobaltite.md. Code dispatches blurb +
        3-way habit (pyritohedral / reniform / massive_default) +
        glaucodot_series when avg trace_Fe > 0.3 + oxidative_dissolution.
        """
        parts = [f"Cobaltite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("cobaltite"))
        if c.habit == "pyritohedral":
            parts.append(narrative_variant("cobaltite", "pyritohedral"))
        elif c.habit == "reniform":
            parts.append(narrative_variant("cobaltite", "reniform"))
        else:
            parts.append(narrative_variant("cobaltite", "massive_default"))

        avg_Fe_proxy = sum(z.trace_Fe for z in c.zones) / max(len(c.zones), 1)
        if avg_Fe_proxy > 0.3:
            parts.append(narrative_variant("cobaltite", "glaucodot_series"))

        if c.dissolved:
            parts.append(narrative_variant("cobaltite", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_native_tellurium(self, c: Crystal) -> str:
        """Narrate native tellurium — the residual-overflow rare element.

        Prose lives in narratives/native_tellurium.md.
        """
        parts = [f"Native tellurium #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("native_tellurium"))
        if c.habit == "prismatic_hex":
            parts.append(narrative_variant("native_tellurium", "prismatic_hex"))
        elif c.habit == "reticulated":
            parts.append(narrative_variant("native_tellurium", "reticulated"))
        else:
            parts.append(narrative_variant("native_tellurium", "granular_default"))
        if "native_gold" in (c.position or ""):
            parts.append(narrative_variant("native_tellurium", "on_native_gold"))
        if c.dissolved:
            parts.append(narrative_variant("native_tellurium", "oxidative_dissolution"))
        elif len(c.zones) > 6:
            parts.append(narrative_variant("native_tellurium", "tellurite_tarnish"))
        return " ".join(p for p in parts if p)

    def _narrate_native_sulfur(self, c: Crystal) -> str:
        """Narrate native sulfur — the synproportionation mineral.

        Prose lives in narratives/native_sulfur.md.
        """
        parts = [f"Native sulfur #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("native_sulfur"))
        if c.habit == "bipyramidal_alpha":
            parts.append(narrative_variant("native_sulfur", "bipyramidal_alpha"))
        elif c.habit == "prismatic_beta":
            parts.append(narrative_variant("native_sulfur", "prismatic_beta"))
        elif c.habit == "sublimation_crust":
            parts.append(narrative_variant("native_sulfur", "sublimation_crust"))
        if "celestine" in (c.position or ""):
            parts.append(narrative_variant("native_sulfur", "on_celestine"))
        elif "aragonite" in (c.position or "") or "selenite" in (c.position or ""):
            parts.append(narrative_variant("native_sulfur", "biogenic_caprock"))
        if c.dissolved:
            parts.append(narrative_variant("native_sulfur", "oxidative_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_native_arsenic(self, c: Crystal) -> str:
        """Narrate native arsenic — the residual-overflow native element.

        Prose lives in narratives/native_arsenic.md.
        """
        parts = [f"Native arsenic #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("native_arsenic"))
        if c.habit == "reniform":
            parts.append(narrative_variant("native_arsenic", "reniform"))
        elif c.habit == "rhombohedral_crystal":
            parts.append(narrative_variant("native_arsenic", "rhombohedral_crystal"))
        elif c.habit == "arsenolamprite":
            parts.append(narrative_variant("native_arsenic", "arsenolamprite"))
        else:
            parts.append(narrative_variant("native_arsenic", "massive_default"))
        if c.dissolved:
            parts.append(narrative_variant("native_arsenic", "oxidative_dissolution"))
        elif len(c.zones) > 8:
            parts.append(narrative_variant("native_arsenic", "arsenolite_tarnish"))
        return " ".join(p for p in parts if p)

    def _narrate_native_silver(self, c: Crystal) -> str:
        """Narrate native silver — the Kongsberg wire mineral.

        Prose lives in narratives/native_silver.md. Code dispatches blurb +
        4-way habit (wire / dendritic / cubic_crystal / massive default) +
        {111} penetration twin + dissolved-vs-late-zone tarnish paired
        branches + acanthite paragenesis position note.
        """
        parts = [f"Native silver #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("native_silver"))

        if c.habit == "wire":
            parts.append(narrative_variant("native_silver", "wire"))
        elif c.habit == "dendritic":
            parts.append(narrative_variant("native_silver", "dendritic"))
        elif c.habit == "cubic_crystal":
            parts.append(narrative_variant("native_silver", "cubic_crystal"))
        else:
            parts.append(narrative_variant("native_silver", "massive"))

        if c.twinned and "{111}" in (c.twin_law or ""):
            parts.append(narrative_variant("native_silver", "penetration_twin"))

        if c.dissolved:
            parts.append(narrative_variant("native_silver", "tarnishing_full"))
        elif len(c.zones) > 20:
            parts.append(narrative_variant("native_silver", "tarnishing_early"))

        if "acanthite" in (c.position or ""):
            parts.append(narrative_variant("native_silver", "on_acanthite"))
        return " ".join(p for p in parts if p)

    def _narrate_argentite(self, c: Crystal) -> str:
        """Narrate argentite — the high-T cubic Ag₂S.

        Prose lives in narratives/argentite.md. A primary argentite crystal
        in the sim only displays as argentite if the simulation ended above
        173°C without a cooling pass — any cooling pulse converts the crystal
        in-place to acanthite via apply_paramorph_transitions, at which point
        the acanthite narrator's paramorph_origin branch takes over.
        """
        parts = [f"Argentite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("argentite"))
        if c.habit == "cubic":
            parts.append(narrative_variant("argentite", "cubic"))
        elif c.habit == "octahedral":
            parts.append(narrative_variant("argentite", "octahedral"))
        elif c.habit == "arborescent":
            parts.append(narrative_variant("argentite", "arborescent"))
        if c.twinned and "spinel" in (c.twin_law or ""):
            parts.append(narrative_variant("argentite", "spinel_twin"))
        return " ".join(p for p in parts if p)

    def _narrate_rosasite(self, c: Crystal) -> str:
        """Narrate rosasite — Cu-dominant broth-ratio carbonate.

        Prose lives in narratives/rosasite.md (mirror of aurichalcite).
        Code dispatches on habit; markdown owns the words.
        """
        parts = [f"Rosasite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("rosasite"))
        if c.habit == "acicular_radiating":
            parts.append(narrative_variant("rosasite", "acicular_radiating"))
        elif c.habit == "botryoidal":
            parts.append(narrative_variant("rosasite", "botryoidal"))
        else:
            parts.append(narrative_variant("rosasite", "encrusting_mammillary"))
        return " ".join(p for p in parts if p)

    def _narrate_torbernite(self, c: Crystal) -> str:
        """Narrate torbernite — P-branch uranyl phosphate (Round 9b).

        Prose lives in narratives/torbernite.md. Code dispatches blurb +
        3-way habit (micaceous_book / tabular_plates / earthy_crust default)
        + metatorbernite_warning when nucleation_temp > 60.
        """
        parts = [f"Torbernite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("torbernite"))
        if c.habit == "micaceous_book":
            parts.append(narrative_variant("torbernite", "micaceous_book"))
        elif c.habit == "tabular_plates":
            parts.append(narrative_variant("torbernite", "tabular_plates"))
        else:
            parts.append(narrative_variant("torbernite", "earthy_crust"))
        if c.nucleation_temp > 60:
            parts.append(narrative_variant("torbernite", "metatorbernite_warning"))
        return " ".join(p for p in parts if p)

    def _narrate_zeunerite(self, c: Crystal) -> str:
        """Narrate zeunerite — As-branch uranyl arsenate (Round 9b).

        Prose lives in narratives/zeunerite.md. Code dispatches blurb +
        3-way habit (micaceous_book / tabular_plates / scaly_encrustation
        default).
        """
        parts = [f"Zeunerite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("zeunerite"))
        if c.habit == "micaceous_book":
            parts.append(narrative_variant("zeunerite", "micaceous_book"))
        elif c.habit == "tabular_plates":
            parts.append(narrative_variant("zeunerite", "tabular_plates"))
        else:
            parts.append(narrative_variant("zeunerite", "scaly_encrustation"))
        return " ".join(p for p in parts if p)

    def _narrate_carnotite(self, c: Crystal) -> str:
        """Narrate carnotite — V-branch uranyl vanadate (Round 9c).

        Prose lives in narratives/carnotite.md. Code dispatches blurb +
        3-way habit (tabular_plates / earthy_crust / powdery_disseminated
        default) + roll_front when nucleation_temp < 30.
        """
        parts = [f"Carnotite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("carnotite"))
        if c.habit == "tabular_plates":
            parts.append(narrative_variant("carnotite", "tabular_plates"))
        elif c.habit == "earthy_crust":
            parts.append(narrative_variant("carnotite", "earthy_crust"))
        else:
            parts.append(narrative_variant("carnotite", "powdery_disseminated"))
        if c.nucleation_temp < 30:
            parts.append(narrative_variant("carnotite", "roll_front"))
        return " ".join(p for p in parts if p)

    def _narrate_autunite(self, c: Crystal) -> str:
        """Narrate autunite — Ca-branch uranyl phosphate (Round 9d).

        Prose lives in narratives/autunite.md. Code dispatches blurb +
        habit (micaceous_book / tabular_plates / encrusting) + dissolved
        + paragenetic on_uraninite when the position notes weathering
        uraninite (the canonical chain).
        """
        parts = [f"Autunite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm ☢️."]
        parts.append(narrative_blurb("autunite"))
        if c.habit == "micaceous_book":
            parts.append(narrative_variant("autunite", "micaceous_book"))
        elif c.habit == "tabular_plates":
            parts.append(narrative_variant("autunite", "tabular_plates"))
        else:
            parts.append(narrative_variant("autunite", "encrusting"))
        if "uraninite" in (c.position or ""):
            parts.append(narrative_variant("autunite", "on_weathering_uraninite"))
        if c.dissolved:
            parts.append(narrative_variant("autunite", "acid_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_uranospinite(self, c: Crystal) -> str:
        """Narrate uranospinite — Ca-As branch uranyl arsenate (Round 9e).

        Prose lives in narratives/uranospinite.md. Code dispatches blurb +
        habit (micaceous_book / tabular_plates / encrusting) + paragenetic
        on_uraninite or on_zeunerite when position notes hint + dissolved.
        """
        parts = [f"Uranospinite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm ☢️."]
        parts.append(narrative_blurb("uranospinite"))
        if c.habit == "micaceous_book":
            parts.append(narrative_variant("uranospinite", "micaceous_book"))
        elif c.habit == "tabular_plates":
            parts.append(narrative_variant("uranospinite", "tabular_plates"))
        else:
            parts.append(narrative_variant("uranospinite", "encrusting"))
        if "uraninite" in (c.position or ""):
            parts.append(narrative_variant("uranospinite", "on_weathering_uraninite"))
        elif "arsenopyrite" in (c.position or ""):
            parts.append(narrative_variant("uranospinite", "on_weathering_arsenopyrite"))
        elif "zeunerite" in (c.position or ""):
            parts.append(narrative_variant("uranospinite", "on_zeunerite"))
        if c.dissolved:
            parts.append(narrative_variant("uranospinite", "acid_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_tyuyamunite(self, c: Crystal) -> str:
        """Narrate tyuyamunite — Ca-V branch uranyl vanadate (Round 9e).

        Prose lives in narratives/tyuyamunite.md. Code dispatches blurb +
        habit (tabular_plates / earthy_crust / powdery_disseminated) +
        paragenetic carnotite_companion when position hints + dissolved.
        """
        parts = [f"Tyuyamunite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm ☢️."]
        parts.append(narrative_blurb("tyuyamunite"))
        if c.habit == "tabular_plates":
            parts.append(narrative_variant("tyuyamunite", "tabular_plates"))
        elif c.habit == "earthy_crust":
            parts.append(narrative_variant("tyuyamunite", "earthy_crust"))
        else:
            parts.append(narrative_variant("tyuyamunite", "powdery_disseminated"))
        if "carnotite" in (c.position or ""):
            parts.append(narrative_variant("tyuyamunite", "carnotite_companion"))
        elif "uraninite" in (c.position or ""):
            parts.append(narrative_variant("tyuyamunite", "on_weathering_uraninite"))
        elif "roll-front" in (c.position or ""):
            parts.append(narrative_variant("tyuyamunite", "roll_front"))
        if c.dissolved:
            parts.append(narrative_variant("tyuyamunite", "acid_dissolution"))
        return " ".join(p for p in parts if p)

    def _narrate_aurichalcite(self, c: Crystal) -> str:
        """Narrate aurichalcite — Zn-dominant broth-ratio carbonate.

        Prose lives in narratives/aurichalcite.md. Code keeps the habit
        dispatch; markdown owns the words. Habit names map directly to
        variant names (tufted_spray, radiating_columnar); the else
        branch picks the laminar_crust variant.
        """
        parts = [f"Aurichalcite #{c.crystal_id} grew to {c.c_length_mm:.1f} mm."]
        parts.append(narrative_blurb("aurichalcite"))
        if c.habit == "tufted_spray":
            parts.append(narrative_variant("aurichalcite", "tufted_spray"))
        elif c.habit == "radiating_columnar":
            parts.append(narrative_variant("aurichalcite", "radiating_columnar"))
        else:
            parts.append(narrative_variant("aurichalcite", "laminar_crust"))
        return " ".join(p for p in parts if p)

    def _narrate_mixing_event(self, batch: List[Crystal], event: Event) -> str:
        """Narrate what happened after a fluid mixing event."""
        mineral_names = set(c.mineral for c in batch)
        parts = []
        
        if "sphalerite" in mineral_names and "fluorite" in mineral_names:
            parts.append(
                "When metal-bearing brine met sulfur-bearing groundwater, "
                "sphalerite (ZnS) and fluorite (CaF₂) nucleated simultaneously — "
                "a classic Mississippi Valley-type precipitation event. "
                "The zinc and sulfur couldn't coexist in solution; they combined "
                "on contact and the minerals fell out of the fluid like rain."
            )
        elif "sphalerite" in mineral_names:
            parts.append(
                "Sphalerite nucleated as zinc-bearing brine mixed with sulfur-rich "
                "groundwater. The two fluids were stable apart; together, ZnS "
                "became insoluble."
            )
        
        return " ".join(parts)
    
    def _narrate_tectonic(self, batch: List[Crystal]) -> str:
        """Narrate tectonic event effects."""
        twinned = [c for c in self.crystals if c.twinned]
        if twinned:
            names = [f"{c.mineral} #{c.crystal_id}" for c in twinned]
            return (
                f" The stress may have induced twinning in {', '.join(names)}. "
                f"Twin planes formed as the crystal lattice accommodated the "
                f"sudden strain — a record of the event frozen in the structure."
            )
        return " No visible twinning resulted, but the pressure change altered subsequent growth conditions."
    
    def _narrate_collectors_view(self) -> str:
        """What would a collector see picking up this specimen?"""
        parts = ["A collector examining this specimen would find:"]
        
        for c in self.crystals:
            if c.total_growth_um < 10 and not c.zones:
                continue
            
            if c.mineral == "quartz":
                if c.c_length_mm > 2:
                    desc = f"a {c.c_length_mm:.1f}mm quartz crystal"
                    if c.twinned:
                        desc += f" ({c.twin_law} twinned)"
                    fi_count = sum(1 for z in c.zones if z.fluid_inclusion)
                    if fi_count > 3:
                        desc += f" with visible fluid inclusions"
                    parts.append(f"  • {desc}")
                elif c.c_length_mm > 0.1:
                    parts.append(f"  • tiny quartz crystals on the vug wall")
            
            elif c.mineral == "calcite":
                fl = c.predict_fluorescence()
                desc = f"a {c.c_length_mm:.1f}mm {c.habit} calcite"
                if c.twinned:
                    desc += f" (twinned)"
                if "orange" in fl:
                    desc += f" — glows orange under UV"
                elif "quenched" in fl:
                    desc += f" — patchy UV response (Mn zones glow, Fe zones dark)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "sphalerite":
                desc = f"a {c.c_length_mm:.1f}mm sphalerite"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                # Get dominant color from late zones
                if c.zones:
                    last_note = c.zones[-1].note
                    if "color:" in last_note:
                        color = last_note.split("color:")[1].split(",")[0].strip()
                        desc += f", {color}"
                parts.append(f"  • {desc}")

            elif c.mineral == "wurtzite":
                desc = f"a {c.c_length_mm:.1f}mm wurtzite"
                if c.habit == "hemimorphic_crystal":
                    desc += " hexagonal pyramid"
                elif c.habit == "radiating_columnar":
                    desc = f"radiating wurtzite columns, {c.c_length_mm:.1f}mm across"
                elif c.habit == "fibrous_coating":
                    desc = f"fibrous wurtzite crust, {c.c_length_mm:.1f}mm thick"
                else:
                    desc += " tabular plate"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — hexagonal (Zn,Fe)S, darker than cubic sphalerite"
                if c.dissolved:
                    desc += ", inverted to sphalerite on cooling"
                parts.append(f"  • {desc}")

            elif c.mineral == "fluorite":
                desc = f"a {c.c_length_mm:.1f}mm fluorite cube"
                if c.twinned:
                    desc += f" (penetration twin)"
                fl = c.predict_fluorescence()
                if fl != "non-fluorescent":
                    desc += f" — fluoresces {fl.split('(')[0].strip()}"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "pyrite":
                desc = f"a {c.c_length_mm:.1f}mm pyrite"
                if c.habit == "framboidal":
                    desc = f"framboidal pyrite aggregate"
                elif c.habit == "pyritohedral":
                    desc += f" pyritohedron"
                else:
                    desc += f" cube"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — bright metallic luster"
                if c.dissolved:
                    desc += ", partially oxidized (limonite staining)"
                parts.append(f"  • {desc}")

            elif c.mineral == "marcasite":
                desc = f"a {c.c_length_mm:.1f}mm marcasite"
                if c.habit == "cockscomb":
                    desc += " cockscomb"
                elif c.habit == "spearhead":
                    desc += " spearhead"
                elif c.habit == "radiating_blade":
                    desc = f"radiating marcasite blades, {c.c_length_mm:.1f}mm across"
                else:
                    desc += " tabular plate"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — pale brass, iridescent tarnish"
                if c.dissolved:
                    desc += ", partially replaced by pyrite (metastable inversion)"
                parts.append(f"  • {desc}")

            elif c.mineral == "chalcopyrite":
                desc = f"a {c.c_length_mm:.1f}mm chalcopyrite"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                desc += " — brassy yellow, greenish tint"
                if c.dissolved:
                    desc += ", oxidation rind (green Cu carbonate staining)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "hematite":
                if c.habit == "specular":
                    desc = f"a {c.c_length_mm:.1f}mm specular hematite"
                    if any("iridescent" in z.note for z in c.zones):
                        desc += " — iridescent rainbow plates"
                    else:
                        desc += " — brilliant metallic silver-black plates"
                elif c.habit == "botryoidal":
                    desc = f"a {c.c_length_mm:.1f}mm botryoidal hematite — kidney-ore, dark metallic"
                elif c.habit == "rhombohedral":
                    desc = f"a {c.c_length_mm:.1f}mm rhombohedral hematite — sharp dark crystals"
                else:
                    desc = f"earthy red hematite mass"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                if c.dissolved:
                    desc += ", partially dissolved"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "malachite":
                desc = f"a {c.c_length_mm:.1f}mm malachite"
                if c.habit == "banded":
                    desc += " — banded green, concentric layers"
                elif c.habit == "fibrous/acicular":
                    desc += " — sprays of acicular green needles"
                else:
                    desc += " — botryoidal green masses"
                color = c.predict_color()
                if "vivid" in color:
                    desc += ", vivid green"
                elif "pale" in color:
                    desc += ", pale green"
                if c.dissolved:
                    desc += ", partially dissolved (acid attack)"
                if "chalcopyrite" in c.position:
                    desc += " (growing on chalcopyrite — classic oxidation paragenesis)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "feldspar":
                desc = f"a {c.c_length_mm:.1f}mm feldspar"
                color = c.predict_color()
                if "amazonite" in color:
                    desc += " — amazonite, blue-green microcline"
                elif "moonstone" in color:
                    desc += " — moonstone with adularescence"
                elif "perthite" in color:
                    desc += " — perthite with albite stringers"
                else:
                    desc += " — flesh-colored to white"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                fl = c.predict_fluorescence()
                if "yellow-green" in fl:
                    desc += ", fluoresces yellow-green under LW UV"
                if "on quartz" in c.position:
                    desc += " (on quartz — pegmatitic texture)"
                parts.append(f"  • {desc}")
            
            elif c.mineral == "albite":
                desc = f"a {c.c_length_mm:.1f}mm albite"
                color = c.predict_color()
                if "moonstone" in color:
                    desc += " — peristerite moonstone, blue adularescence"
                elif "cleavelandite" in color:
                    desc += " — cleavelandite, platy lamellar habit"
                else:
                    desc += " — white to colorless"
                if c.twinned:
                    desc += f" ({c.twin_law})"
                if "on feldspar" in c.position:
                    desc += " (on feldspar — perthite pair)"
                parts.append(f"  • {desc}")
        
        if len(parts) == 1:
            return "The vug produced only microscopic crystals — a thin crust on the cavity wall."
        
        return "\n".join(parts)


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='🪨 Vugg Simulator — crystal growth engine')
    parser.add_argument('--scenario', choices=list(SCENARIOS.keys()), default='cooling',
                        help='Growth scenario (default: cooling)')
    parser.add_argument('--steps', type=int, default=None,
                        help='Override number of steps')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show every step (default: show every 5th + events)')
    parser.add_argument('--summary-only', action='store_true',
                        help='Only show final summary')
    parser.add_argument('--seed', type=int, default=None,
                        help='Random seed for reproducibility')
    parser.add_argument('--json', action='store_true',
                        help='Output final state as JSON')
    parser.add_argument('--interactive', '-i', action='store_true',
                        help='Interactive mode — pause between steps')
    
    args = parser.parse_args()
    
    if args.seed is not None:
        random.seed(args.seed)
    
    # Load scenario
    scenario_fn = SCENARIOS[args.scenario]
    conditions, events, default_steps = scenario_fn()
    total_steps = args.steps or default_steps
    
    print(f"🪨 Vugg Simulator — {args.scenario} scenario")
    print(f"   {total_steps} time steps, starting at {conditions.temperature:.0f}°C, {conditions.pressure:.1f} kbar")
    print(f"   Initial fluid: {conditions.fluid.describe()}")
    print(f"   Events: {len(events)}")
    for e in events:
        print(f"     Step {e.step}: {e.name}")
    print("═" * 70)

    sim = VugSimulator(conditions, events)

    # Text-adventure preamble for random scenarios: scene-setting BEFORE sim.
    archetype = getattr(conditions, "_random_archetype", None)
    if archetype:
        print()
        print("┈┈┈┈┈ PREAMBLE ┈┈┈┈┈")
        print()
        print(sim.narrate_preamble(archetype))
        print()
        print("═" * 70)
        print()
    
    for step in range(total_steps):
        log = sim.run_step()
        
        if args.summary_only:
            continue
        
        # Print logic: show every 5th step, or any step with events/nucleation/significant growth
        show = args.verbose or (step % 5 == 0) or any("EVENT" in l or "NUCLEATION" in l for l in log)
        
        if show and log:
            print(sim.format_header())
            for line in log:
                print(line)
        
        if args.interactive:
            try:
                cmd = input("\n[Enter=continue, q=quit, s=summary] > ").strip().lower()
                if cmd == 'q':
                    break
                elif cmd == 's':
                    print(sim.format_summary())
            except (EOFError, KeyboardInterrupt):
                break
    
    # Final summary
    if args.json:
        # JSON output for future frontends
        state = {
            "scenario": args.scenario,
            "steps": sim.step,
            "final_temperature": conditions.temperature,
            "crystals": []
        }
        for c in sim.crystals:
            state["crystals"].append({
                "mineral": c.mineral,
                "id": c.crystal_id,
                "habit": c.habit,
                "forms": c.dominant_forms,
                "c_mm": round(c.c_length_mm, 2),
                "a_mm": round(c.a_width_mm, 2),
                "zones": len(c.zones),
                "twinned": c.twinned,
                "twin_law": c.twin_law,
                "fluorescence": c.predict_fluorescence(),
            })
        print(json.dumps(state, indent=2))
    else:
        print(sim.format_summary())


if __name__ == '__main__':
    main()
