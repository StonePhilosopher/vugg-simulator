# HANDOFF: Jeffrey Mine (Val-des-Sources, Quebec) — full rodingite arc

Status: planned, not started. Pickup by fresh-context Claude.
Date authored: 2026-05-20 by the agent that just finished the Roughten Gill / Caldbeck Fells arc (v107-v109).
Last updated: 2026-05-20 — boss-locked decisions appended in "Decisions locked" section below.

## Why this handoff exists

Context was getting full at the end of the Roughten Gill arc. The boss asked for the Jeffrey Mine work but recognized it's a multi-commit arc better executed with fresh context than crammed into a tail of an already-long session.

Read this whole file. The dossier sketch below is enough to ship without re-running a research-agent dispatch (though you can dispatch one if you want extra grounding). The boss has approved Option B — the full rodingite assemblage arc.

## Decisions locked (boss-confirmed 2026-05-20)

The four open execution choices were put to the boss before pickup. Decisions:

1. **vugg-add-broth skill ships as v110** before any vugg-simulator code. Same pattern as vugg-add-mineral being created then dogfooded on pyrolusite v102. Skill commit only, no engine code.
2. **Full arc scope (v110-v117)** as outlined below. The Mg-matrix family (chrysotile/serpentine + brucite + awaruite) IS in scope, not deferred.
3. **Stick to the science** for calibration — work from literature (Bernardini 1981 MR 12(5), Coleman 1977, Wicks & Plant 1979, Anthony Handbook v.II/IV, etc.), not from boss's specimens. Boss has Jeffrey specimens but prefers science-anchored work; specimens may surface mid-arc but are not the primary calibration target. Dispatch a fresh research-agent on Bernardini 1981 + rodingite paragenesis at start of arc.
4. **Add 'ultramafic' wall type** (not 'serpentinite' — broader). Covers serpentinite + peridotite + dunite + harzburgite hosts. Wider future utility (Cassiar BC, New Idria CA, Italian Alps, etc.). Lands with the Jeffrey scenario in v116, or as a small pre-scenario infra commit if substrate-priority logic for any rodingite mineral engine needs to know about ultramafic walls before v116.

### Implication flagged at lock time

Awaruite (Ni₂Fe to Ni₃Fe, v115) needs Ni in the fluid. **Ni is not currently a FluidChemistry field** (verify with `Grep "this\.Ni " js/20-chemistry-fluid.ts`). If confirmed absent, v115 splits into: Ni field as a second vugg-add-broth dogfood + awaruite as the consumer. Boss agreed this is the right way (strengthens the new skill). Could push arc to v118 total if Ni field gets its own commit; that's acceptable. Alternatively, stub awaruite for a future arc and ship v115 as chrysotile + brucite only — fallback, not preferred.

## What Jeffrey Mine IS

**Jeffrey Mine, Val-des-Sources (formerly Asbestos), Quebec, Canada.** One of the world's largest chrysotile-asbestos mines, operated 1881-2011. The town renamed itself in 2020 (Val-des-Sources, "Valley of Springs") to step out from under the asbestos-health-crisis baggage. The mine itself closed nine years earlier; current site has visitor-history operations.

**Among mineral collectors, Jeffrey is NOT famous for asbestos — it's famous for the rodingite assemblage.** The chrysotile-asbestos production was the commercial reason the mine existed, but the open-pit excavation exposed hundreds of meters of serpentinized ultramafics + cross-cutting mafic dikes that had been altered to rodingite by metasomatism. The contact zones between dike and serpentinite host produced spectacular Ca-Al-Mg silicate cabinet specimens 1880s through 2011.

## The headline mineralogy (what the scenario should produce)

| Mineral | Formula | Significance |
|---|---|---|
| **Vesuvianite** (idocrase) | Ca₁₀Mg₂Al₄(SiO₄)₅(Si₂O₇)₂(OH)₄ | Jeffrey produced WORLD'S BEST cyprine variety (sky-to-deep-blue Cu-bearing vesuvianite). The cabinet headline aesthetic. |
| **Grossular garnet** | Ca₃Al₂(SiO₄)₃ | Pale green chromian + orange-pink hessonite varieties. World-class material. |
| **Diopside** | CaMgSi₂O₆ | Often gem-grade chrome-diopside green. |
| **Pectolite** | NaCa₂Si₃O₈(OH) | Spray-aggregate Na-Ca silicate. World-class radiating habit. |
| **Datolite** | CaB(SiO₄)(OH) | Jeffrey's iconic boron silicate, colorless gem crystals up to several cm. |
| **Wollastonite** | CaSiO₃ | Ca-silicate, white acicular crystals. |
| **Prehnite** | Ca₂Al₂Si₃O₁₀(OH)₂ | Pale-green botryoidal Ca-Al silicate. |
| **Apophyllite** | (K,Na)Ca₄Si₈O₂₀(F,OH)·8H₂O | K-Ca silicate, late-stage. Already in catalog (check; if not, add). |
| **Chrysotile / serpentine** | Mg₃Si₂O₅(OH)₄ | The asbestos itself; gangue / matrix. |
| **Brucite** | Mg(OH)₂ | Serpentinization byproduct. |
| **Awaruite** | Ni₂Fe to Ni₃Fe | Ni-Fe alloy from serpentinization. |
| **Chromite, magnetite, calcite, dolomite** | (existing) | Already in catalog. |

**The CYPRINE variety of vesuvianite is the load-bearing aesthetic.** Sky-blue Cu-bearing vesuvianite is the "Jeffrey Mine specimen" in collector terms. Cu trace ~0.5-5 ppm in growth fluid → blue color; pure vesuvianite is brown/green/yellow. This is structurally analogous to v103 Y → octahedral-fluorite habit and v62-era Cr → ruby — trace cation dispatch.

## Geological context (what the broth + events should encode)

```
Tectonic setting    Quebec Appalachians, Thetford Mines ophiolite
                    complex. Ordovician oceanic crust + mantle
                    obducted during the Taconian Orogeny, ~470 Ma.
Host rock           Serpentinite (lizardite + chrysotile + antigorite
                    + minor olivine + chromite); protolith was mantle
                    peridotite (harzburgite/dunite)
Mineralization      Rodingite metasomatism — Ca-Al-rich fluid from
                    serpentinization-driven dehydration reacts with
                    crosscutting mafic dikes (basaltic to gabbroic
                    composition). Mafic dike chemistry (Ca+Al+Si)
                    + serpentinite Mg + alkaline-pH fluid + low Eh
                    → rodingite (Ca-Al-Si calc-silicate) replaces
                    the dike chemistry.
T                   ~200-400°C primary alteration (low-grade
                    metamorphic / metasomatic); some specimens
                    formed at higher T early then re-equilibrated
                    cooler.
pH                  Strongly alkaline (10-12) — serpentinization
                    produces Ca(OH)₂ + Mg(OH)₂-rich fluid.
Eh                  Reducing to mildly oxidizing.
Salinity            Low (1-3 wt% NaCl-eq); metamorphic fluid.
Pressure            0.5-2 kbar (mid-crustal obducted ophiolite).
Wall composition    'basalt' is the closest existing silicate proxy
                    in the sim (no 'serpentinite' wallrock type).
                    The mafic dike + serpentinite host both register
                    as silicate; carbonate-bearing rodingite contacts
                    aren't truly carbonate-hosted, just carbonate-
                    bearing.
```

References (real, load-bearing):

1. **Bernardini G.P. (1981)** — *The Jeffrey Mine, Asbestos, Quebec.* Mineralogical Record 12(5): 277-291. THE canonical MR article. Per-mineral descriptions + habit + paragenesis.
2. **Hudson R.G.S. (1922)** — Quebec chrysotile geology (the early reference).
3. **Coleman R.G. (1977)** — *Ophiolites: Ancient Oceanic Lithosphere?* Springer. Framework for serpentinite + rodingite mineralogy globally.
4. **Wares R. (1987)** — PhD thesis (McGill or Univ. Sherbrooke), detailed Thetford Mines complex geology.
5. **Wicks F.J. & Plant A.G. (1979)** — Electron-microprobe + transmission-electron-microscope study of serpentine minerals. *Canadian Mineralogist* 17: 785-830. Serpentinite-host chemistry.
6. **O'Hanley D.S. (1996)** — *Serpentinites: Records of Tectonic and Petrological History.* Oxford. Rodingite framework.
7. **Numerous MR Locality issues 1980s-2000s** — Jeffrey Mine specimen photographs and per-find chronology.

Anchor research-agent dispatch (if you want fresh literature) on: Bernardini 1981 MR 12(5) + Coleman 1977 + Wicks & Plant 1979 + rodingite paragenesis at Thetford Mines complex. ~5 minute dispatch in parallel with engine recon.

## The infrastructure burden

This is a multi-commit arc, more substantial than the Silverton arc (v103-v106, 4 commits) — closer to the v93-v101 mineral push (9 commits). Recommended commit sequence below.

### NEW FLUID FIELD NEEDED: B (boron)

Datolite is CaB(SiO₄)(OH) — requires boron. Boron is currently **NOT** in FluidChemistry (verify with `Grep "this\.B " js/20-chemistry-fluid.ts`). This is a v89-Sn + v103-Y pattern: add a new fluid field + a first-consumer engine in the same commit.

**This handoff also recommends creating a `vugg-add-broth` skill** — the pattern has happened at least 4 times now (Sn v89, Y v103, plus Cd, Hg, Ti added over the v62-era). Codifying it would benefit this arc + future work. Suggested location: `~/.claude/skills/vugg-add-broth/SKILL.md`. See "Suggested vugg-add-broth skill outline" at the bottom of this handoff.

### NEW MINERALS NEEDED

Likely 7-8 new minerals. Verify against current catalog first (the catalog is at 129 live minerals as of v109; some may already exist):

```
Grep -E '"(vesuvianite|grossular|diopside|pectolite|datolite|wollastonite|prehnite|apophyllite|chrysotile|serpentine|brucite|awaruite)":' data/minerals.json
```

Items confirmed NOT in catalog (as of pre-v110): vesuvianite, grossular, diopside, pectolite, datolite, wollastonite, prehnite, chrysotile/serpentine, brucite, awaruite. Apophyllite — verify; may already exist.

## Recommended commit sequence

```
v110  vugg-add-broth SKILL.md
      ~/.claude/skills/vugg-add-broth/SKILL.md (new skill, ~200 lines)
      Codifies the new-fluid-field pattern. No code in vugg-simulator;
      pure skill commit. Self-dogfood on the B field added in v111.

v111  B fluid field + datolite engine (first consumer)
      js/20-chemistry-fluid.ts: this.B = opts.B ?? 0.0
      js/38-supersat-phosphate.ts (or borate-class file if it exists;
        if not, datolite is a SiO4-bearing borosilicate — could land
        in silicate-class js/39): supersaturation_datolite()
      js/58 or 59 engines: grow_datolite() (colorless gem habit +
        botryoidal habit)
      js/88 or 89 nucleation: _nuc_datolite() with substrate priority
        for prehnite + calcite + wollastonite
      js/65-mineral-engines.ts: datolite registered
      data/minerals.json: datolite entry
      tests-js/datolite.test.ts
      tests-js/baselines/seed42_v111.json
      Pattern follows v89 Sn + v103 Y. Per the (now-existing) vugg-
      add-broth skill.

v112  Vesuvianite (with cyprine variety)
      Silicate class (js/39/59/89). supersaturation_vesuvianite
      gate: Ca + Mg + Al + Si all required; T 200-400°C; alkaline pH
      9-12; rodingite-style metasomatic.
      Habit dispatch: cyprine (Cu trace 0.5-5 ppm → sky-blue/deep-
      blue), brown (default), green (Cr trace), yellow (Fe trace).
      Substrate priority: grossular > diopside > wall.
      Pattern follows v62-era Cr→ruby + v103 Y→fluorite trace
      dispatch.

v113  Grossular + diopside (paired calc-silicate commit)
      Two Ca-Mg-Al silicates of the rodingite suite. Pair because
      they share gates (Ca + Mg + Al + Si + alkaline + T window) and
      paragenesis (both early in the rodingite sequence).
      Color dispatch: grossular green (Cr trace), hessonite (Mn/Fe),
      colorless (pure). Diopside green chrome-diopside (Cr trace),
      white (pure).

v114  Pectolite + wollastonite + prehnite (Ca-silicate trio)
      Three later-stage Ca-silicates. Pectolite spray-aggregate habit
      (Na-Ca silicate, needs Na). Wollastonite acicular white. Prehnite
      botryoidal pale-green Ca-Al silicate.
      Triple commit if the engines are close enough in chemistry/
      gate-structure; otherwise split into v114 + v115.

v115  Chrysotile / serpentine + brucite + awaruite (Mg-rich
      gangue / matrix family)
      Lower priority for collector aesthetic but needed for the
      Jeffrey-style geology to read as Jeffrey. Chrysotile is the
      asbestos itself — fibrous habit. Brucite Mg(OH)2 fairly common
      serpentinization byproduct. Awaruite Ni-Fe alloy (would need
      Ni in fluid — likely splits this commit; see "Decisions locked"
      §1 implication note above).

v116  Jeffrey Mine scenario (+ ultramafic wall type infra)
      data/scenarios.json5: jeffrey_mine block
      Wall: 'ultramafic' (NEW wall type — see "Decisions locked" §4;
        if substrate-priority logic in any earlier rodingite mineral
        engine needs to know about ultramafic walls, split the wall-
        type add into a pre-scenario infra commit ahead of where it's
        first referenced)
      T_initial 350°C cooling to 200°C across stages
      pH alkaline 10-12 (KEY DISCRIMINATOR — most existing scenarios
        run pH 4-8; rodingite is the alkaline outlier)
      Stages:
        1 (steps 1-30):   Serpentinization onset (high pH, T 350)
        2 (steps 30-70):  Mafic dike alteration begins (Ca + Al + Si
                          from dike react with Mg + alkaline serpentinite
                          fluid; grossular + diopside fire)
        3 (steps 70-120): Mid-rodingite (vesuvianite + cyprine if Cu
                          trace; T cooling to 280)
        4 (steps 120-160): Late-stage Ca-silicates (pectolite +
                          wollastonite + prehnite)
        5 (steps 160-200): Datolite + apophyllite (boron-bearing late
                          phase + K-Ca-bearing terminal)
      js/70r-jeffrey-mine.ts: event handlers (5 events)
      js/70-events.ts: register handlers
      tests-js/jeffrey-mine.test.ts
      tests-js/baselines/seed42_v116.json
      Anchor on Bernardini 1981 + Coleman 1977. Per vugg-add-scenario
      skill linear path; this is one scenario commit on stable
      infra from v111-v115.

v117  Calibration tune (predicted)
      Per vugg-tune-scenario skill. Predicted misses + extras based on
      Sunnyside + Roughten Gill precedent — cation routing will displace
      some declared expects_species; some cascade extras will land
      geologically wrong. Run probe-diagnose-adjust-verify loop.
```

7-8 commits total. Roughly 1-2 working sessions.

## Per-mineral engine sketches (broth implications)

### Vesuvianite (cyprine variety the headline)

```
Gates: Ca ≥ 100, Mg ≥ 30, Al ≥ 10, SiO2 ≥ 200
       T 180-400°C, pH 9-12 (alkaline, rodingite-style)
       (Eh: mildly reducing to mildly oxidizing tolerance)
Color dispatch:
       Cu 0.5-5 ppm → cyprine (sky-blue) — Cu²⁺-O charge transfer
                       analogous to dioptase blue/turquoise blue
       Cu > 5 ppm → deep-blue end-member
       Cr trace → green vesuvianite
       Fe trace → yellow-brown
       (no chromophore) → colorless/brown default
Substrate priority:
       grossular (epitactic) > diopside > wollastonite > wall
Habit:
       prismatic_tetragonal (default) — square cross-section
       blocky_dipyramidal (high σ) — typical "idocrase" cabinet
       cyprine_botryoidal (low σ + Cu trace) — rare
       gemmy_crystallized (rare)
References: Bernardini 1981 MR 12(5); Anthony et al. Handbook v.II;
            Deer Howie Zussman Rock-Forming Minerals v.1A
```

### Datolite (v111 first-consumer of B field)

```
Gates: Ca ≥ 60, B ≥ 1, SiO2 ≥ 50
       T 100-300°C, pH 7-11 (alkaline-tolerant)
Substrate priority:
       prehnite (when prehnite is wired) > calcite > wollastonite
       > wall
Habit:
       crystallized_gem (default — colorless to pale-yellow, often
                          gemmy at Jeffrey)
       botryoidal_white (low σ — calcite-like mass)
References: Anthony Handbook v.IV silicates; Hawthorne et al.
            crystal chemistry papers
```

### Grossular garnet + diopside (paired v113)

```
GROSSULAR Ca3Al2(SiO4)3:
Gates: Ca ≥ 80, Al ≥ 15, SiO2 ≥ 150
       T 250-500°C, pH 7-12 (broad alkaline tolerance)
Color dispatch:
       Cr trace → green (chromian grossular; chrome diopside parallel)
       Mn trace → hessonite (orange-pink)
       (pure) → colorless / pale-yellow
Habit: dodecahedral (default), trapezohedral (high σ)
Substrate: diopside > wollastonite > wall

DIOPSIDE CaMgSi2O6:
Gates: Ca ≥ 60, Mg ≥ 40, SiO2 ≥ 150
       T 200-500°C, pH 7-11
Color: Cr trace → chrome-diopside green; Fe → grey-green-brown;
       pure → colorless/white
Habit: prismatic_square (default — short {100} prism), tabular
Substrate: serpentine_matrix > wall
```

### Pectolite (v114 spray-aggregate)

```
NaCa2Si3O8(OH):
Gates: Na ≥ 30, Ca ≥ 80, SiO2 ≥ 100
       T 150-300°C, pH 9-12
Habit: spray_radiating (default — the iconic Jeffrey habit)
       acicular_white (lower σ)
References: Bernardini 1981 + Schaller 1955 type description for
            Larimar (the Dominican pectolite, but Jeffrey is
            comparable habit)
```

### Wollastonite (v114) + Prehnite (v114)

```
WOLLASTONITE CaSiO3: simple Ca-Si gates; T 200-500°C; acicular
white default; can fire at lower T than grossular (the latest
Ca-silicate in the rodingite sequence).

PREHNITE Ca2Al2Si3O10(OH)2: Ca + Al + Si + alkaline; T 150-300°C;
botryoidal pale-green default; common substrate for datolite.
```

## Suggested vugg-add-broth skill outline

If you ship the vugg-add-broth skill (recommended as v110, before the B field add in v111):

```
SKILL.md vugg-add-broth — ~200 lines

WHAT: add a new fluid field to FluidChemistry + ship a first-consumer
engine that uses it. The v89 Sn + v103 Y pattern, codified.

0. Locate yourself (same as add-mineral)

0.5 Preflight: does the field already exist?
    Grep "this.<element>" js/20-chemistry-fluid.ts

1. Justify the new field
    - Is it needed for >1 future mineral, or just 1?
    - Could a trace flag on an existing field cover it?
    - Worth its own field if: distinct chemistry (B, Y, Sn), tracked
      in literature with measured-value anchors, and at least one
      first-consumer mineral is being shipped in the same arc.

2. Add the field to FluidChemistry
    this.<X> = opts.<X> ?? 0.0;
    Include a docstring comment per the v89-Sn / v103-Y format:
       v<N> plumbing field for the <mineral> engine; engines that
       consumed <X> before v<N> silently skipped over it because no
       field existed.

3. Add the field to the describe() text dispatch if you want it to
   show up in scenario summaries (optional).

4. Ship the first-consumer mineral in the same commit (or commit
   pair). Pattern: add-broth-mineral commits are typically
   (a) the field add + the engine in one commit if the engine is
       single-mineral, OR
   (b) field add as standalone if multiple following minerals will
       use it (e.g., a future B field shipping with datolite would
       also enable kornerupine, sussexite, etc).

5. Tests:
    - FluidChemistry default 0.0
    - FluidChemistry accepts override
    - Survives shallow clone via FluidChemistry(src)
    - Mineral engine fires when field is above threshold
    - Mineral engine blocks when field is below threshold

6. Document in v<N> history block:
    - Why the field is being added (which mineral demands it)
    - Reference to past fluid-field additions (v89 Sn, v103 Y, etc)
    - First-consumer engine
    - Future minerals that will use the field

CANONICAL EXAMPLES:
  v89  Sn + cassiterite (the first new field since the v62-era
        Cd, Hg, Ti additions)
  v103 Y + REE-octahedral fluorite habit
  v111 B + datolite (forthcoming; vugg-add-broth skill dogfood)
```

## Boss's standing directions (from prior session memory)

These apply to all Jeffrey work:

- **Specimens are spec — BUT** for Jeffrey specifically, the boss's standing direction is "stick to the science" (locked 2026-05-20). Boss has Jeffrey specimens but prefers literature-anchored work; specimens may surface mid-arc but aren't the primary calibration target. See "Decisions locked" §3.
- **Detailed published records matter.** Jeffrey qualifies (Bernardini 1981 MR is the canonical anchor; rich literature beyond).
- **Type localities matter.** Jeffrey is type for several rare minerals — check Bernardini 1981 for the full list. Cyprine is co-type-quality (best material) even if not strict type.
- **Two-pass correction pattern.** When ground truth (boss observation OR research-agent dispatch) surfaces an error in your scenario, ship a forward-fix in v<N+1> rather than amending v<N>. Document both the original reading and the correction.
- **Cation-budget routing (vugg-add-scenario §4).** Expects_species will be partially aspirational. Plan a vugg-tune-scenario follow-up (v117).
- **Over-tuning antipattern (vugg-tune-scenario §3).** Don't state-pin broth values in events to force gate clearance. Modify the trajectory of fluid evolution.
- **3-iteration soft cap for tuning.** Past 3 probe-adjust-verify cycles, step back — likely Shape B (RNG-cascade displacement) or structural issue.
- **Asbestos health context is real but secondary.** The town renamed itself in 2020; the mine closed 2011. Mention it as cultural context in the scenario notes but don't make it the geological story — the rodingite assemblage IS the story.

## Recent arc context (for orientation)

The vugg-simulator is at SIM_VERSION 109 as of this handoff. Recent commits:

```
v107  6971ed1  Roughten Gill scenario (Caldbeck Fells, UK) — first
               prospective dogfood of vugg-add-scenario
v108  3106d81  Plumbogummite (PbAl3(PO4)2(OH)5·H2O) — type-locality
               mineral for Roughten Gill; second dogfood of vugg-
               add-mineral
v109  e663005  Roughten Gill tune — first dogfood of vugg-tune-
               scenario; 4 of 8 priority targets hit; remaining
               misses Shape B (structural)
```

The Silverton / Sunnyside arc (v103-v106) and the Roughten Gill arc
(v107-v109) are the immediate precedent. Both shipped as multi-commit
arcs with a similar pattern (infra → mineral → scenario → tune).
Jeffrey will follow the same shape but bigger (7-8 commits vs 4 / 3).

## Skill inventory (relevant to this work)

```
~/.claude/skills/vugg-add-mineral/SKILL.md    — current and dogfooded
~/.claude/skills/vugg-add-scenario/SKILL.md   — current and dogfooded
~/.claude/skills/vugg-tune-scenario/SKILL.md  — current and dogfooded
~/.claude/skills/vugg-add-broth/SKILL.md      — RECOMMENDED to create
                                                 as v110 (before B field
                                                 add in v111)
```

The three existing skills were updated multiple times during the
Roughten Gill arc based on actual dogfood friction:
- vugg-add-mineral §10 (scenario-anchor check, v108)
- vugg-add-scenario §4 (cation-budget routing, v107)
- vugg-tune-scenario §2 (Shape B structural fix paths, v109)
- vugg-tune-scenario §3 (over-tuning antipattern, v109)
- vugg-tune-scenario §4 (single-axis cascade ripple, v109)

If you notice friction during the Jeffrey work, apply skill updates
forward (the boss authorizes this autonomously per session memory).

## Adjacent angles worth flagging

- **The asbestos health crisis cultural overlay** — Jeffrey produced ~40% of world chrysotile for most of the 20th century. The 1949 Quebec Asbestos Strike was a labor-history flashpoint. The town renamed itself in 2020. These are cultural facts; the scenario should mention them briefly in notes without making them load-bearing.
- **The rodingite framework is genuinely novel for the sim** — no existing scenario models metasomatic Ca-Al alteration of mafic dikes in ultramafic host. Could be a future template for OTHER rodingite localities (Cassiar British Columbia, New Idria California, Italian Alps, etc).
- **Cyprine as the headline aesthetic** — sky-blue Cu-vesuvianite is iconic. If the boss has Jeffrey specimens, statistically the cyprine vesuvianite is among them.
- **Pectolite + the Larimar connection** — Dominican pectolite is the famous gem material; Jeffrey pectolite is mineralogically equivalent but in different habit. Note in scenario description.
- **The Bernardini 1981 MR article is a single citation** — Mineralogical Record volume 12 issue 5. Worth quoting heavily; it's the canonical anchor.
- **Possible v118 future arc: Black Lake / Thetford Mines area** — adjacent serpentinite locality with overlap mineralogy. Could be a sibling commit if scope permits.

## Recommended starting actions

When you pick this up:

1. Read this handoff fully.
2. Read the latest few commits (v107-v109) to understand the recent voice + commit-message style — `git log -p e663005 3106d81 6971ed1`.
3. Decide: vugg-add-broth skill first (v110) or skip and go straight to v111?
   - RECOMMENDED: ship the skill (v110), then dogfood it immediately on v111. Same pattern as vugg-add-mineral being created then dogfooded on pyrolusite v102.
4. Dispatch a research agent for Jeffrey Mine + Bernardini 1981 + rodingite paragenesis in background while you write the vugg-add-broth skill.
5. When research returns, start v111: B fluid field + datolite engine.
6. Proceed through v112-v117.

Test discipline: 753+ tests should keep passing throughout. Run full suite after every commit. Cascade drift checks expected — Jeffrey work touches new chemistry (B, alkaline pH, new minerals) that COULD ripple through other scenarios.

Commit message style: dense field-notes; the boss reads them as papers. Match v105 sunnyside_american_tunnel and v107 roughten_gill voice for scenarios; match v102 pyrolusite and v108 plumbogummite for individual minerals; match v109 roughten_gill_tune for tune commits.

---

**End of handoff.** Estimated execution: 1-2 working sessions to v117 baseline. Skill updates expected mid-arc per dogfood friction. Jeffrey Mine + Bernardini 1981 will be a satisfying piece of the simulator history.

Co-authored-by: Claude Opus 4.7 (1M context) — the agent that finished the Roughten Gill arc and saw this one coming.
