# Mineral recipe science review — all 184 species (2026-10-21)

**Base:** `origin/main` @ `ab79f195` (SIM 285). The 21 commits it carries beyond canonical
`e75bb4c6` are test-quarry, browser-cleanup and render-cost work; no science file differs, so the
recipes reviewed here are canonical's.
**Ask (boss):** "science review for vugg simulator — double check the recipes for all the minerals."
**Scope:** every entry in `data/minerals.json` (184). A *recipe* here is everything that decides
whether and where a species forms: the `MINERAL_GATES_<m>` constant, the `supersaturation_<m>()`
body (plus the helpers it delegates to), the `_nuc_<m>()` substrate logic, the
`MINERAL_STOICHIOMETRY` booking, and the spec fields (`formula`, `T_range_C`, `redox_requirement`,
`required_ingredients`, `pH_dissolution_*`).
**Nothing in the simulator was changed.** This document and the two read-only instruments it names
are the whole deliverable. A proposed fix order is in §6 and waits for the boss.
**Review history:** §9 — five adversarial rounds (scores 7, 7, 7.5, 8, 8.5); their verified
corrections are folded in.
Where a number below comes from a reviewer's A/B run rather than this session's own measurement,
it says so.

---

## 1. Verdict

The recipe layer is in good shape. 182 of the 184 formulas are right (chabazite's and
meta-autunite's are not — R8), counting the fahlores' Cu12Sb4S13 and Cu12As4S13 as simplified
end-member formulas (R9 explains why natural fahlore needs a divalent cation). Every σ function reads the elements its formula needs; the few
apparent gaps are read inside a helper (calcite's CO3, the CaSO4 pair) or belong to solid-solution
and tunnel-cation sites that do not need them. The hostile-review fix ladder (rungs 1–5: F default,
T gates, tiger's-eye substrate, redox partitions, salinity) and the S-split series still hold in
the σ bodies.

| tier | meaning | count |
|---|---|---|
| **1** | the recipe contradicts its own data, its own stated mechanism, or a fix the codebase already made for a sibling | 9 |
| **2** | a window or selector the literature does not support as written | 8 |
| **3** | metadata, display, comment and instrument drift | 13 |

The most useful findings:
- **The survival-field direction bug** (R2) reaches beyond the UI: the wall-attack engine reads
  the same inverted field, so it is a science fix, not a label fix.
- **Cassiterite's fluorine factor** (R5) has the wrong sign for its own reaction. Every seed-42
  cassiterite birth depends on it, so the obvious one-line fix would make the species extinct.
- **Five contracted fahlore crystals never grow** (R9). The stoichiometry books Fe *and* Zn as
  mandatory, and graduated competition rations Zn-free fahlore to zero. The contracts count first
  appearance, so the suite stays green.
- **The recessive trace-floor template** (R1) that mottramite shed on 2026-06-16 is still in
  descloizite, adamite and olivenite. It never binds at seed 42.

---

## 2. Tier 1 — the recipe contradicts itself

### R1. The recessive trace-floor template survives in three minerals
| mineral | line | gate |
|---|---|---|
| descloizite PbZn(VO4)(OH) | `js/38-supersat-phosphate.ts:293` | `if (Cu < 0.5) return 0` |
| adamite Zn2(AsO4)(OH) | `js/30-supersat-arsenate.ts:308` | `if (Cu < 0.5) return 0` |
| olivenite Cu2(AsO4)(OH) | `js/30-supersat-arsenate.ts:227` | `if (Zn < 0.5) return 0` |

**Origin.** Round 9c (April 2026) added these floors deliberately, so the Cu:Zn fraction selector
would be "meaningful". The stated reason: "real specimens always have at least trace amounts of
the recessive metal — pure end-members basically don't exist in nature"
(`research/arcs/research-broth-ratio-descloizite-mottramite.md:85`; the same reasoning sits in each
spec's `_ingredients_note`).

**The codebase has since rejected that reasoning for the fourth member.** Mottramite's floor was
removed on 2026-06-16 (`js/38-supersat-phosphate.ts:321`) because it "blocked mottramite precisely
when the fluid was purest-Cu … the cu_fraction discriminator below is the correct series gate."
The same logic applies to the other three:
- A crystal carrying trace Cu does not need ≥ 0.5 ppm Cu in the fluid.
- Pure-Zn adamite exists, and fluomin calls it the brighter fluorescent kind: cupro- and manganoan
  adamite are "usually not as bright as pure adamite".
- Round 9c's preference already survives without the floors. All four engines damp an end-member
  above 95 % by ×0.5 (`js/30:240`, `:318`; `js/38:303`, `:339`). Adamite's damping comment ("pure-Zn
  damped because hemimorphite/smithsonite take that territory") is a design choice the Ojuela
  material argues against.

**Stale text that goes with it.** Adamite's floor comment (`js/30:306`), its sweet-spot comment
("Cu trace (the fluorescent variety)", `:314–315`), spec `_ingredients_note`,
`trace_ingredients.Cu`, description and gate `_notes` all still call Cu the fluorescence
*activator*. The v225 audit reversed that elsewhere: uranyl activates, Cu²⁺ quenches (spec
`fluorescence`, `grow_adamite`, the zone-bar renderer). The inline fallback spec
(`js/00-mineral-spec.ts:48`) is stale in another way: activator "intrinsic", Cu quench at 10 ppm,
against the canonical uranyl activator and 0.1 ppm.

**Blast radius: zero at seed 42.** Measured by the round-2 reviewer's in-memory A/B. With all three
floors removed, all 1,212 fleet births are byte-identical and `supergene_oxidation`'s final state
fingerprint is unchanged. The floors never bind today, so this is a correctness fix with no
baseline move.

### R2. The survival field's direction is read backwards — in the UI and in the wall-attack engine
The spec carries two survival fields that overlap: `acid_dissolution.pH_threshold` and
`pH_dissolution_below`/`_above`. Three readers take `acid_dissolution.pH_threshold` as a floor
("dissolves below"). For jarosite, alunite, antlerite and scorodite it is an *upper* bound
(4.5, 4.5, 4.2, 5.5) — the same number as the record's `pH_dissolution_above`, and each record's own
note says "inverse … semantics". The three readers:
- **σ panel** (`js/97b-ui-sigma-panel.ts:1259–1271`): a chip `pH ≥ X` from that field plus a chip
  `pH ≤ X` from `pH_dissolution_above`. Hovering jarosite at pH 3 shows one chip met, one failed.
- **Library card** (`js/95-ui-library.ts:312–318`): "pH < X, pH > X" — dissolves at every pH.
- **Engine.** `dissolve_wall` (limestone and dolomite walls, `js/85d-simulator-step.ts:215–222`)
  lets acid-resistant crystals shield the wall. `_wallSurfaceAttackState`
  (`js/85c-simulator-state.ts:2329–2333`) counts a crystal as resistant only where
  `pH ≥ threshold`, so these four acid-stable minerals shield the wall only above their own
  stability limit.

A fourth reader, the dissolution of transformation-only products
(`js/64a-engines-transformation-products.ts:13–14`), already prefers the floor field:
`pH_dissolution_below ?? acid_dissolution?.pH_threshold`. It reads no ceiling, which leaves
pararealgar's only bound unread.

The engine reads *only* `acid_dissolution.pH_threshold`, which leaves a mirror case. Nineteen species
declare a floor in `pH_dissolution_below` but no `pH_threshold`: their `acid_dissolution` is prose, or
puts the number under a `pH` key. `resistant = acid == null || threshold == null || …`
(`js/85c-simulator-state.ts:2333`) therefore counts them acid-proof at any pH. They include the
evaporites (halite, borax, mirabilite, thenardite), hemimorphite, willemite, hydrozincite, opal,
dioptase, duftite and bayldonite.

This half moves nothing at seed 42. The 19 grow on a carbonate wall in only three scenarios:
- `bisbee` and `supergene_oxidation` are byte-identical when each species is given a `pH_threshold`
  equal to its floor (round-3 reviewer's in-memory A/B);
- `searles_lake`'s fluid never drops below pH 9.5.

The hover test (`tests-js/nucleation-hover.test.ts:80–92`) checks only the first record with
`pH_dissolution_above` (chalcedony), and only its `≤` chip, so it cannot see a contradictory pair.

**Blast radius of the four (round-2 reviewer's A/B, nulling their thresholds):** `bisbee` is
unchanged. `supergene_oxidation` keeps its 98 crystals and species, but growth shifts (final pH
4.502 → 4.525, Ca 587.9 → 585.9 ppm, vug diameter 49.287 → 49.286 mm). The fix is therefore a SIM
bump, not a display edit.

**Fix:** one survival window per species, read the same way by every reader. For example, take the
floor from `pH_dissolution_below` and the ceiling from `pH_dissolution_above`, and leave
`acid_dissolution` to describe the reaction and its products. That needs one backfill, two decisions
and one consequence:
- backfill `pH_dissolution_below: 2` for the five species that carry only
  `acid_dissolution.pH_threshold` (sphalerite, galena, clausthalite, hessite, naumannite);
- decide greenockite and hawleyite, whose two fields disagree (M10). Choosing the floor of 5 changes
  `reactivated_fluorite_vein`'s state fingerprint; its counts, growth and vug diameter stay
  identical, and `mvt` is unchanged (round-4 reviewer's A/B);
- decide the 51 species that carry no numeric survival bound anywhere (olivenite, descloizite,
  mottramite and sylvite among them); 41 have no `acid_dissolution` entry either. Under the proposed
  rule they stay acid-proof shields at every pH;
- accept that ten species gain an engine-read ceiling.
  - The five ceiling-only species are native sulfur (5), chalcanthite (4), realgar (9), orpiment
    (9.5) and pararealgar (9). This is zero at seed 42: chalcanthite never forms, and
    `sicily_solfifera` stays at pH 6.0–6.5.
  - The five with both bounds are chalcedony, marcasite, wulfenite, brochantite and adamite. Of
    these, marcasite's ceiling of 5 matters: it falls inside the wall-attack band (`5.5 − pH > 0`,
    `js/85c:2358`). It moves `reactive_wall`, whose dolomite wall carries a marcasite from step 40
    while the fluid passes between pH 4.0 and 6.5. Births are unchanged, but the growth hash and
    fingerprint change (round-5 reviewer's A/B). `bisbee` is unchanged.

A rule keyed on the mere presence of `pH_dissolution_above` would be wrong: chalcedony, marcasite,
wulfenite, brochantite and adamite carry both a floor and a ceiling. Add the four upper-bound species
to the hover test.

### R3. Jarosite forms where its own research note says it cannot
`MINERAL_GATES_jarosite.pH_max = 5` (`js/40-supersat-sulfate.ts:83`, hard cap at `:297`); σ only
tapers from pH 4 (×0.4 at pH 5). The repo's own dossier says otherwise:
- "Required pH range: Strongly acidic, pH 1.5–3.5" and "jarosite ONLY forms below pH ~3.5"
  (`research/minerals/research-jarosite.md:51, :108`);
- `grow_jarosite`'s own dissolution note calls pH > 4 "goethite-stable territory".

The literature agrees with the dossier. Brown 1971's stability diagrams put jarosite's field at
pH < 3, and Grigg et al. 2023 write "Jarosite is formed under oxic conditions with pH <4". All 12
seed-42 jarosite births are at or above that limit: 6 in `supergene_oxidation` (steps 135–145) at
pH 4.81–4.97 and 6 in `bisbee` at pH 4.0. Alunite has the same cap-5-taper-from-4 shape; its five
births (`bisbee`, pH 4.0) are borderline.

This is a formation question, not a survival one. The engines dissolve only when σ < 1 *and* pH
is past the threshold (`js/60-engines-sulfate.ts:318–319`), and persistence outside the field is
real: Brown 1971 attributes it to slow kinetics, and Barrón & Torrent 2006 find jarosite stable at
circum-neutral pH when water activity is low.
**Fix — with care.** Jarosite is a deterministic species in two contracts:
- `supergene_oxidation`, where all six births are at pH 4.8–5.0;
- `bisbee`, where all six are at exactly pH 4.00, and alunite (five births, also pH 4.00) is
  deterministic too.

The caps are inclusive (`pH > pH_max → 0`, `js/40-supersat-sulfate.ts:297`; alunite `:320`), so
where the new ceiling lands decides which contracts break. In-memory A/Bs by the round-4 and
round-5 reviewers:
- **pH_max 4 on both species** — Grigg's "<4" written the way the file writes caps — keeps
  `bisbee`'s jarosite and alunite. It removes `supergene_oxidation`'s six jarosites
  (98 → 92 crystals). `bisbee`'s later counts still shift (chrysocolla 5 → 7, dioptase 7 → 6,
  native gold 11 → 12).
- **pH_max 3.99 on jarosite only** (or 3.5, the dossier's, or 3, Brown's) removes all 12 jarosite
  births. `bisbee` loses its contracted jarosite but keeps its alunite.
- Alunite's contract breaks only if alunite's own cap also drops below 4. This review gives no
  source for that; alunite's births are borderline, not refuted.

Either way the change must re-examine the acid-stage pH of the scenarios it touches, or their
contracts.

### R4. Coffinite cannot form in its own type setting
Gate and body hard-require `T ≥ 100 °C` (`js/39-supersat-silicate.ts:196, 960`). The gate's own
source, Stieff, Stern & Sherwood 1955, describes coffinite from Colorado Plateau sandstone. Szenknect
et al. 2020 (Sci. Rep. 10:12168) go further: they grew coffinite on the surface of UO2 in the
laboratory at pH 9, room temperature and under anoxic conditions — "the first evidence of the
formation of coffinite" from UO2. Their review also collects 80–130 °C for sedimentary deposits and
"no greater than 50 °C" for an Athabasca roll-front.

**Blast radius: zero** (round-2 reviewer). In the three U-bearing scenarios, every step below
100 °C fails another coffinite gate:

| scenario | steps < 100 °C | gate that fails |
|---|---|---|
| `colorado_plateau` | 180 | O2 > 0.3 |
| `radioactive_pegmatite` | 28 | O2 > 0.3 and P > 1 |
| `schneeberg` | 76 | P > 1 |

### R5. Cassiterite's fluorine factor has the wrong sign — and every cassiterite depends on it
The σ body multiplies by up to 2× with fluid F (`js/37-supersat-oxide.ts:224`), justified by
`SnF6²⁻ + 2 H2O → SnO2 + 4 H⁺ + 6 F⁻` (`:214`). Adding F⁻ drives that reaction to the left —
toward dissolution — so on its own mechanism F should *lower* σ. The code's own citation points the
same way: its comment credits Williamson 2010 with "F-complex destabilization at high pH or upon
dilution" (`:215–216`), i.e. losing F, not gaining it. Fluoride is not the main carrier either.
Jackson & Helgeson 1985 calculate that Sn(II) chloride complexes "predominate by several orders of
magnitude" over fluoride and hydroxide complexes in 1–3 m NaCl. The exceptions are geologically
unrealistic fluoride, or pH above ~3.5 at 250 °C (~5.0 at 350 °C), where hydroxide complexes take
over. All 13 seed-42 births sit at pH 6.5–7.0 and 424–619 °C. That is above the crossover pH J&H
give for 250–350 °C, but hotter than any temperature they quote, and the crossover rises with
temperature. So the transport regime is for the research note to settle. The
verdict on F does not depend on it. In every candidate regime F⁻ is a ligand that can only hold Sn
in solution, so adding it cannot drive SnO2 out. Cassiterite
precipitates on cooling, pH rise, dilution and oxidation; F's real role is indirect (greisenising
granites are F-rich).

**Blast radius, measured with the birth census.** All 13 seed-42 cassiterite births need the F boost.
Divided out, σ falls to 0.73–1.01, below σ_crit 1.2 (`js/37:17`). Cassiterite is in
`expects_species` for all three host scenarios:

| scenario | births | F (ppm) | F factor | σ without it |
|---|---|---|---|---|
| `gem_pegmatite` | 4 | 25 | 1.83 | 0.92–1.01 |
| `radioactive_pegmatite` | 5 | 25 | 1.83 | 0.76–0.77 |
| `schneeberg` | 4 | 20 | 1.67 | 0.73–0.76 |

**Fix:** research note first (transport model). Then replace the F term with the real precipitation
drivers and re-anchor Sn in the same SIM bump. "Just stop rewarding F" is one of §6's traps.

### R6. Wolframite needs oxidising fluid; its own spec says reducing
`MINERAL_GATES_wolframite.O2_min 0.5` (`js/35-supersat-molybdate.ts:93`), checked through
`molybdateRedoxAvailable`, means Eh ≥ +100 mV for an Fe²⁺/Mn²⁺ tungstate from reduced greisen and
vein fluids. The species' own spec says `redox_requirement: "reducing"`. It is the only species in
the catalog whose `redox_requirement` contradicts its gate outright. It was logged as rung-4d residue
(`proposals/BACKLOG.md:450–455`) and is unchanged.

### R7. Gate objects that advertise a redox window the engine no longer uses
The σ panel and Library card read the gate object's `O2_min/O2_max` (`js/97b-ui-sigma-panel.ts:583–614`,
`js/95-ui-library.ts:204`). Three families disagree with the engine:
- **Willemite.** Rung 4a raised the floor in the body to 0.5 (`js/39-supersat-silicate.ts:1045`) but
  left `MINERAL_GATES_willemite.O2_min: 0.3` (`:231`).
- **The six primary sulfides.** The engine enforces `PRIMARY_SULFIDE_CEILING_O2 = 0.5`, i.e.
  Eh ≤ +100 mV (`js/20c-chemistry-redox.ts:1054`). The gate objects still say 1.5 (≈ +290 mV) for
  pyrite, marcasite, chalcopyrite and galena (`js/41-supersat-sulfide.ts:46, 52, 58, 64`), and
  nothing for sphalerite and wurtzite.
- **Sulfate and native-sulfur floors that the engine bypasses or never reads.** The gate objects
  show O2 floors: barite and celestine 0.1, selenite 0.2, anhydrite 0.3, native sulfur 0.1–0.7. The
  census finds 46 seed-42 births below them, every O2-gate flag in the fleet. There are two causes.
  - **Deliberate bypasses, 27 births** (barite 16 in `mvt`; celestine 6 and native sulfur 5 in
    `sicily_solfifera`).
    - Where a fluid carries an explicit sulfate pool, `sulfateRedoxAvailable` admits sulfate at any
      Eh: "an anoxic fluid may retain and precipitate inherited sulfate"
      (`js/20c-chemistry-redox.ts:204–208`).
    - Native sulfur's anaerobic-inherited pathway replaces the window with O2 ≤ 0.1
      (`js/36-supersat-native.ts:200–201`).
    - The floors still apply to fluids without explicit pools; the display should show the bypass.
  - **Floors never read, 19 births** (anhydrite 18 in `mvt`, `reactivated_fluorite_vein` and
    `reactive_wall`; selenite 1 in `sicily_solfifera`).
    - Both σ bodies call only `evaluateCaSO4System` (`js/40-supersat-sulfate.ts:242–248, 437–441`).
      It admits on saturation, temperature, pH and a positive sulfate amount, with no O2 test
      (`js/40b-supersat-sulfate-Ksp.ts:162–169`).
    - Redox enters only through that sulfate amount. `sulfateAvailablePpm` takes the explicit pool
      where there is one (15 births), counts all S as sulfate in a fluid flagged
      `sulfateInherited`, and otherwise partitions S by Eh (`js/20c-chemistry-redox.ts:535–540`).
    - In `reactive_wall` (4 births, Eh −150 mV, no pools) the partition still counts 21 % of the S,
      31–37 ppm, as sulfate.

A player hovering galena at +200 mV is told it is inside its window while the engine refuses it, and
one hovering Sicilian celestine is told "not met" beside a crystal the engine grew. The BACKLOG calls
the sulfide tables stale metadata; it is metadata a player reads.

### R8. Two formula strings are wrong
- **Chabazite** `Ca2Al2Si4O12·6H2O` is charge-unbalanced (+4 +6 +16 = +26 against O12 = −24). The
  stoichiometry books Ca 1, i.e. CaAl2Si4O12·6H2O, the usual simplified chabazite-Ca formula
  (`js/19-mineral-stoichiometry.ts:215`). The description repeats the wrong string, then gives the
  per-Ca form. The stoichiometry line's comment repeats the wrong string, marked "(per-Ca)".
- **Meta-autunite** is given as `·8H2O`, and its description says "three water molecules gone". It
  is the 6-water member, Ca(UO2)2(PO4)2·6H2O; 8 H2O is the metatorbernite/metazeunerite count.

### R9. Booked cations are mandatory — and five contracted fahlore crystals never grow
`MINERAL_STOICHIOMETRY` makes every booked species mandatory, twice over:
- **Graduated competition** (v128) rations each crystal's candidate zone by its scarcest booked
  species in the crystal's cell fluid (debits built at `js/44-graduated-competition.ts:442–450`).
  A crystal with any booked species exhausted is excluded from redistribution ("cofactorBlocked",
  `:287–298`) and rationed to 0 %. Pass 1 then records an "edge-of-gate skip" and stores no zone
  (`js/85b-simulator-nucleate.ts:1838–1850`).
- **The growth budget** then shrinks any zone a reservoir cannot supply
  (`js/19-mineral-stoichiometry.ts:1061–1094`).

Only HMC gets a per-zone formula (`js/52-engines-carbonate.ts:594`). Three recipes book cations their
σ does not need:
- **Tetrahedrite and tennantite** book Fe 1.5 *and* Zn 1.5 (`js/19:106–107`). Their σ reads only Cu,
  Sb or As(III), and S (`js/41-supersat-sulfide.ts:610–638`). Natural fahlore needs divalent
  cations on one shared site — Fe *or* Zn, or another such as Hg. Tetrahedrite-(Fe),
  tetrahedrite-(Zn) and tetrahedrite-(Hg) are all valid species (Biagioni et al. 2020a, b).
- **Tourmaline** books Fe 3 (schorl), but its σ allows Fe-free tourmaline. An elbaite fluid would pass
  the gate and then be rationed to nothing.
- **Vesuvianite** books Fe 1 (`js/19:205`), but its σ requires only Ca, Mg, Al and SiO2
  (`js/39-supersat-silicate.ts:1689`).

**The fahlore half is live at seed 42.** In `bisbee`, `porphyry` and `schneeberg` the fluid carries
Fe (40–200 ppm) but no Zn. Schneeberg authors no Zn source, and since v259 the sim no longer mints
one (`js/15-version.ts:12724–12728`). Every fahlore there is born at σ 5–17. It is then rationed to
0 % on every step its σ allows growth — 64 steps each in `bisbee`, 60 in `porphyry`, 65 in
`schneeberg`, 313 skips in all — with the log line "edge-of-gate skip — Zn-limited after residual
redistribution (scaling 0%)". None ever adds a zone; all five end active, undissolved and
unenclosed. Fleet-wide these are the only crystals rationed to zero. All five crystals are
contracted deterministic species, and the contract audit counts first appearance
(`tools/locality-envelope-audit.mjs:167–193`), so the suite stays green while they stay at zero
size. By contrast, `sunnyside_american_tunnel` carries 120 ppm Zn and grows its pair to 11 and 143
zones.

Tourmaline and vesuvianite are latent:
- every tourmaline birth has 40–60 ppm Fe, and all 483 of its growth steps are fully allocated;
- vesuvianite's only host, `jeffrey_mine`, carries 50–65 ppm Fe.

**Fix:** let the shared site take what the cell offers (Fe, Zn or both), as HMC's per-zone formula
already does. The round-3 reviewer measured the simplest version in memory, booking fahlore as Fe 3
with no Zn:
- the five crystals grow 15–187 zones (958–5,102 µm);
- every birth in `bisbee`, `porphyry` and `schneeberg` is unchanged in species, count and first step;
- no deterministic or expected species is lost.

The growth itself still moves those scenarios' fluids, so it is a SIM bump.

---

## 3. Tier 2 — windows and selectors the literature does not support as written

**S1. Mass-ppm "fractions" where moles matter.** `js/30-supersat-arsenate.ts:189–192` states that a
cation fraction "must therefore convert each field to amount of substance". SIM 259 did so for
pharmacolite and köttigite only. Still in mass ppm:
- **Pb/Cu, ×3.26** — duftite/bayldonite (`js/30:577, :600`). Duftite's "Pb:Cu near 1:1" and
  bayldonite's "Cu/Pb > 2" are mass ratios. Both seed-42 duftite births (deterministic in
  `supergene_oxidation`) sit at molar Cu/Pb ≈ 3.0, which is bayldonite's composition, so a molar
  selector would move them. Under one, the step 1–2 births vanish and duftite nucleates at steps
  40–41 instead (round-3 reviewer's in-memory A/B). Its contract has no step window, so it holds.
- **Ca/Cu, ×1.59** — conichalcite, and the uranyl cation forks (autunite/torbernite,
  uranospinite/zeunerite).
- **The uranyl anion forks** divide by P + As(V) + V in mass (`js/38:410–413, 447–450, 483–486,
  519–522, 550–552, 585–587`): P:As is off by ×2.42 and P:V by ×1.64. No 0.5 cutoff is crossed at
  seed 42, but `schneeberg`'s expected torbernite and autunite sit at a P fraction of 0.82 by mass
  (0.92 molar), so molar fractions would cost them the ×1.3 bonus.

Cu/Zn (2.9 %) and K/Ca (2.5 %) are immaterial.

**S2. Legrandite's hard block at Ca > 20 ppm** (`js/30-supersat-arsenate.ts:519`). Its showcase
localities are carbonate-hosted: Tsumeb is in dolomite, and Ojuela is a limestone replacement
deposit. Pore water there carries tens to hundreds of ppm Ca. The local cavity fluid may still have
been Ca-poor (Ojuela legrandite sits in limonite cavities), so this is a check, not a verdict.

**S3. Anglesite's σ has no carbonate or pH term.** In carbonate-bearing water above pH ≈ 6,
cerussite is the stable Pb phase. The engines respond later: `grow_anglesite` converts to cerussite
above 150 ppm CO3 (`js/60-engines-sulfate.ts:584`), and cerussite prefers to nucleate on dissolving
anglesite (`js/82-nucleation-carbonate.ts:280–283`). But anglesite still nucleates where cerussite
owns the field: three of its four `supergene_oxidation` births are at pH 6.80 with 110 ppm CO3.
Anglesite is deterministic there, so a fix must keep at least the acid-stage birth.

**S4. Lepidocrocite's σ lacks the control that separates it from goethite.** Dissolved CO2 and
carbonate drive Fe(II) oxidation toward goethite:
- Schwertmann & Thalmann 1976 (Clay Minerals 11:189) obtained pure, well-crystallised lepidocrocite
  "only … if CO2 was excluded (to prevent goethite formation)";
- in about 200 syntheses at pH 6 and 7, Carlson & Schwertmann 1990 (Clay Minerals 25:65) saw
  lepidocrocite fall from 100 % to 0 % of the product as carbonate rose and oxidation slowed.

The σ has no carbonate term. `supergene_oxidation`'s only lepidocrocite, a deterministic species,
is born at CO3 ≈ 424 ppm; a carbonate term would likely remove it. (Its temperature is fine in
practice — M9.)

**S5. Sulfide redox ceilings still above the +100 mV primary ceiling.**
- **Kept deliberately** (`js/20c-chemistry-redox.ts:1047–1051`, "latent, T-double-blocked"):
  arsenopyrite at 0.8 (+180 mV); the sulfosalts tetrahedrite, tennantite, proustite, pyrargyrite and
  enargite at 1.5 (+290).
- **Not covered by that note:** stibnite and bismuthinite at 1.0 (+220), rammelsbergite and
  safflorite at 1.0, loellingite at 1.2, cinnabar (direct `O2 > 1.0`), metacinnabar at 0.8, nickeline
  and millerite at 0.6.

All latent at seed 42; every birth of these species is at Eh ≤ +76 mV (cinnabar and metacinnabar in
`sulphur_bank`, +75.5). They will leak the first time a scenario oxidises a fluid carrying Sb, Bi,
Ag, Hg or Ni-As — the way molybdenite and realgar did before rung 4d.

**S6. Willemite's "supergene (Skorpion)" mode.** The σ body labels an 80–150 °C sweet spot
"supergene (Skorpion)" (`js/39-supersat-silicate.ts:1054–1055`). Supergene ores form from
near-surface meteoric water. Mondillo et al. 2015 (after Hitzman et al. 2003) contrast them with
hypogene deposits that "form after mineral precipitation from hydrothermal or metamorphic fluids" —
which is what an 80–150 °C regime is. Skorpion itself is a sauconite deposit: sauconite
"predominates over the other Zn-oxidized minerals" (Mondillo et al. 2015, citing Borg et al. 2003).
The willemite-bearing hypogene examples usually given (Vazante, Beltana, Franklin) come from Hitzman
et al. 2003, not re-read in this session. The nucleation narration
(`js/89-nucleation-silicate.ts:521`) calls every birth below 500 °C "SUPERGENE nonsulfide
(Skorpion)". Willemite is extinct at seed 42.

**S7. Cadmium and silver precipitate as their own sulfides as often as, or more often than, their
hosts — in six of the seven scenarios that grow them.** Greenockite and hawleyite have no Zn
competition term, although Cd substitutes into ZnS until Zn is exhausted. Neither Ag2S polymorph (acanthite, argentite) has a Pb competition term,
although hypogene Ag rides galena. Their only host-like damping is a Cu proxy for fahlore:
acanthite ×0.6 on Fe > 30 with Cu > 20, argentite ×0.6 on Cu > 30
(`js/41-supersat-sulfide.ts:446, :473`). This is the hostile review's July finding, still live at
SIM 285.

Greenockite's presence is locality-licensed: `mvt` lists it as "a minor CdS accessory" documented
at Picher. Its count is not.

| scenario | discrete phase | host |
|---|---|---|
| `mvt` | greenockite 5 | sphalerite 2 |
| `reactivated_fluorite_vein` | greenockite 5, acanthite 4 | sphalerite 2, galena 1 |
| `roughten_gill` | acanthite 6 | galena 4, fahlore 2 |
| `sunnyside_american_tunnel` | argentite 10 | galena 4, fahlore 2 |
| `bisbee` | argentite 4, acanthite 1 | fahlore 2 (no galena) |
| `schneeberg` | argentite 4, acanthite 1 | tennantite 1 |
| `porphyry` (the exception) | argentite 4 | galena 4, fahlore 2 |

**S8. Todorokite's temperature window is a laboratory's, by a documented choice that its own source
contradicts.** SIM 250 removed the direct route and requires an existing birnessite precursor
converted inside a 95–200 °C window. The window comes from synthesis conditions: Golden et al.
autoclaved at 155 °C; Zhao et al. used reflux (`research/arcs/research-surface-growth-fabrics-2026-08-06.md:125–133`;
gate at `js/37-supersat-oxide.ts:142–153`).

Nature says otherwise. The same research note records that Potter & Rossman 1979 — one of the
gate's own three sources — identified mine dendrites as todorokite (`:38–39`). Post 1999 calls
todorokite and birnessite "two of the more common Mn oxide minerals in terrestrial deposits and ocean
nodules". Manceau et al. 2014 (Am. Mineral. 99:2069, after Burns & Burns 1978) call it "the
principal Mn mineral species in deep-sea nodules transformed after deposition", formed topotactically
from 10 Å vernadite in suboxic sediment. Atkins, Shaw & Peacock 2014 (GCA 144:109) describe the
diagenetic birnessite→todorokite path. Jung et al. 2020 (JACS 142:2506) name the gap: laboratory
syntheses from layered Mn oxides need pH far from circumneutral "and/or elevated, nonambient
temperatures", at odds with todorokite's dominance in natural low-temperature environments. They then
made todorokite from δ-MnO2 at room temperature and circumneutral pH by repeated redox cycling.

The same window gates `applyBirnessiteTodorokiteTransition` (`js/75-transitions.ts:342–343`, called
from `js/87-nucleation-oxide.ts:200`). Birnessite and todorokite are both dead at seed 42.

### Noted, not counted (designs with a defensible basis)
- **Quartz's 100 °C floor** is a deliberate kinetic phase selector, "not a claim that quartz is
  thermodynamically impossible below 100 °C" (`research/arcs/research-silica-sulfur-correction-2026-08-06.md:34–36`).
  It does mean the sim cannot stage the low-temperature camp on the Paraná amethyst geodes (Gilg et
  al. 2003). The `amethyst_geode` scenario documents both camps and stages 160 °C. The research note
  already names the way out: time-dependent nucleation.
- **Pyrite's soft acid roll-off** is plausible, though not demonstrated at Sulphur Bank's 66 °C.
  Stanton & Goldhaber 1991 (USGS OFR 91-310):
  - marcasite was "usually the dominant disulfide" in acid-sulfate runs with H2S and S° (50–95 % of
    FeS2), so pyrite formed as a minority;
  - runs with S° only gave 90 to >95 % marcasite;
  - at 0.24 M H2SO4 only a trace of FeS2 formed, and it was pyrite;
  - but at 150 °C or below, disulfides formed only "in small amounts" or not at all, so the
    proportions are mainly ~200 °C results.

  `sulphur_bank` expects both minerals and grows one of each; its only pyrite is born at pH 1.50.
  Only the gate text (`pH_min 3.5`, displayed as hard) is wrong — M9.
- **Turquoise's pH 6–8.5 window** is the repo's documented model: acid groundwater leaches Cu, Al
  and P, and turquoise nucleates as pH recovers (`research/minerals/research-turquoise.md:52, :119`).
  The literature associates turquoise with acid alteration (alunite, jarosite, kaolinite). Neither
  side gives a numeric pH, and the gate is soft (×0.3 below 6).

---

## 4. Tier 3 — metadata, display, comment and instrument drift

- **M1. The Library shows wrong scenarios for 145 of 177 species.** `minerals.json` documents
  `scenarios` as "empirically verified with seed 42". The Library uses it for the scenario filter and
  chips (`js/95-ui-library.ts:25, 68, 300`). Against the SIM 285 strip archive it is stale for 145 of
  the 177 species that list or grow somewhere. Examples:
  - native_arsenic lists bisbee and supergene_oxidation but grows in schneeberg and wittichen;
  - quartz lists 5 scenarios, one of which (porphyry) grows none, and omits 15 of its 19 hosts.

  It should be generated, not hand-kept.
- **M2. Declared `T_range_C` vs gate constant: 45 species disagree** (Appendix A). Where the gate
  carries a dated research note (mimetite 80, goethite 100, selenite 80, anhydrite 100, arsenopyrite
  200–600, the tellurides 300 — all v228), the gate is the researched value and the spec is stale.
  Where neither does, one of the two is wrong (pyrite's gate 100–400 against a spec 25–700; bornite
  80; chalcopyrite 180 — see M9). For four species the census shows which bound the engine
  enforces: each is born inside its gate but outside its spec range. That makes the spec the stale
  side for the engine; whether the gate is right still needs a source (lepidolite at 650 °C most of
  all):
  - acanthite at 35 °C (`bisbee`; spec 50–170);
  - strontianite at 30 °C (`sicily_solfifera`; spec 50–200);
  - lepidolite at 650 °C (`gem_pegmatite`; spec 350–600);
  - argentite at 428–450 °C (`schneeberg`; spec 173–400; its gate has no ceiling, and cubic Ag2S
    is stable to ~586 °C).
- **M3. Leftovers of removed or changed gates.** Mottramite's gate `fluid_min` (`js/38:55`), spec
  `required_ingredients` and `_ingredients_note` still require `Zn: 0.5` although the gate was
  removed; the Library and σ panel show it as a requirement. Descloizite's and mottramite's spec say
  `V: 10` while their gates say `V: 4`.
- **M4.** Aragonite's header comment still lists T > 50 °C and Ω > 10 as selectors (both retired in
  v228).
- **M5.** Amosite's notes say "Ca > 80 + low Mg required" (the code requires Ca ≤ 80), and its
  comment says Fe/Mg > 1.5 where the code uses 1.2. Tremolite's comment says Fe > 50; the code uses
  60.
- **M6.** Greenockite is called the "high-T polymorph"; it is the stable CdS polymorph and hawleyite
  the metastable one.
- **M7.** Fluorite's T comment says solubility "passes through max around 100–250 °C". That would
  make 100–250 the *least* favourable window, the opposite of what the factor does.
- **M8.** Feldspar's comment says "feldspars need HIGH temperature" and "melts above 800 °C", and
  its spec `T_range_C` starts at 250 (albite's too). Against that:
  - adularia is the epithermal K-feldspar (100–250 °C);
  - sanidine melts near 1150 °C dry;
  - `deccan_zeolite` lists albite and adularia-type feldspar as deterministic species, born at
    127–150 °C.

  The decay is soft, so only the text is wrong.
- **M9. Gates displayed as hard that the engine treats as soft — some with wrong values.**
  `js/18a-mineral-gates-types.ts` defines `T_min/T_max` and `pH_min/pH_max` as hard cutoffs ("σ → 0").
  The σ panel scores them met/unmet on that basis (`js/97b-ui-sigma-panel.ts:976–982` for T,
  `:1021–1027` for pH). The table lists the soft gates that seed-42 births cross or whose values are
  wrong. The T-envelope census counts 31 species whose T bounds are soft-only. Two of those are
  really hard: anhydrite and selenite, enforced inside `evaluateCaSO4System`, which the census does
  not follow (M13). So "declare soft where soft" covers at least 29 species. Engines that only
  attenuate:

  | mineral | soft gate |
  |---|---|
  | pyrite | T 100–400; pH 3.5 |
  | chalcopyrite | T 180 |
  | bornite | T 80 |
  | native silver | T 50 |
  | malachite | pH 4.5 (bisbee's only malachite is born under it) |
  | celestine | pH 5 and 9 |
  | azurite, powellite | pH 5 |
  | atacamite | pH 4 / 8.5 |
  | wolframite | pH 4 / 6 |
  | adamite | pH 4 / 8 |
  | olivenite, descloizite, mottramite | pH 4 / 8 |
  | turquoise | pH 6 / 8.5 |

  Two related cases:
  - The beryl family reads its 300–700 °C window only softly, inside `_beryl_base_sigma`.
  - Lepidocrocite's declared 200 °C is unreachable: σ ≤ 3·e^(−0.02(T−50)) falls below its 1.1
    nucleation threshold above about 100 °C, the same ceiling as goethite.

  The T floors for pyrite, bornite and native silver are already logged (`proposals/BACKLOG.md:648–650`)
  as "WRONG-value flags that must NOT be blanket-enforced … all contradict real low-T occurrences".
  Chalcopyrite's 180 joins them: Roughton Gill's documented 110–130 °C primary stage grows it. The
  births are right and the gate text is wrong, so a hovering player sees "not met" next to a crystal
  the engine just grew.
- **M10. Survival chips that disagree with the engine.** Besides R2's contradictions, some births
  happen outside the spec's own displayed survival window. The engines dissolve only when σ < 1 and
  pH is past the threshold, so the crystals grow; the chips mislabel them:
  - scorodite: 4 births at pH 5.53–5.90, chip "≤ 5.5" (its gate allows pH 6 "for hysteresis");
  - atacamite: 4 at pH 4.00–4.50, chip "≥ 5.0";
  - malachite: 1 at pH 4.00, chip "≥ 4.5" (`bisbee`'s only malachite, an expects_species);
  - native sulfur: chip "≤ 5" contradicts the v80 Sicilian BSR window, which deliberately allows
    pH 6.5 (5 births at pH 6.0–6.3);
  - pyrite: `sulphur_bank`'s only pyrite at pH 1.50, chip "≥ 3";
  - three marginal ones: siderite at pH 5.47 (`bisbee`, chip "≥ 5.5"), azurite at 4.94 and
    powellite at 4.95 (`supergene_oxidation`, chip "≥ 5");
  - greenockite and hawleyite carry two acid thresholds: `acid_dissolution` 2 (shown by the panel)
    and `pH_dissolution_below` 5. Their engines dissolve them only on O2 > 1.0.
- **M11.** Calcite's 500 °C ceiling is explained as "Decomposes to CaO + CO2 above ~500 °C … thermal
  decomposition" (`js/32-supersat-carbonate.ts:325–329`). At 1 atm CO2 calcite decarbonates near
  898 °C; the spec says 840, and so does the marble scenario's note. A 500 °C occurrence cap may be
  defensible; the stated reason is not.
- **M12. Two census tools read each birth two samples late.**
  - `tools/t-envelope-census.mjs --strips` reads `Tseries[ev.step]` (`:147`). The archive records
    `sample_index = step − 1` for every event (1,212 of 1,212), so sample n is the end of step n + 1.
    A birth's conditions match sample n − 2 or n − 1, never sample n alone (§5).
  - `tools/nucleation-eh-census.mjs` — the rung-4 redox census — pushes Eh after each `run_step()`
    and reads `eh[c.nucleation_step]`, also the end of step n + 1 (`:66–69`).

  Births next to an event can be misplaced by either. Re-run before trusting a boundary case.
- **M13.** Three static-census artefacts in `tools/t-envelope-census.mjs`:
  - "HMC has no σ function" — `supersaturation_HMC(mg_content?)` exists at `js/32-supersat-carbonate.ts:424`;
    the regex misses parameterised methods.
  - Its "never reads T" class is the five beryl-family species, which read T through the helper,
    plus tincalconite, whose σ is always 0.
  - Its "soft-only" class includes anhydrite and selenite. Their T bounds are enforced hard inside
    `evaluateCaSO4System`: `temperatureC >= 100` and `temperatureC <= 80`
    (`js/40b-supersat-sulfate-Ksp.ts:167, :163`).

---

## 5. Instruments and what they measured

Two read-only instruments produced the evidence. Both ship with this document and write only to
`.local-evidence/`, the directory the identity guard excludes.

1. **`tools/recipe-cards.mjs`** (static, ~1 s). For each of the 184 species it joins the spec
   fields, the gate constant, the σ body and its delegated helpers, the nucleation body and the
   stoichiometry. It flags formula-vs-code mismatches. 179 species have σ functions; the other five
   are transformation-only (haidingerite, meta-autunite, metatorbernite, metazeunerite,
   pararealgar). Its flags are leads, and most are benign.
2. **`tools/birth-census.mjs`** (dynamic, 15–25 min for the fleet). It reruns every scenario at seed 42
   and records, for each nucleation, the fluid it was *admitted* under. That is the bulk fluid,
   unless the wall has per-vertex nucleation or the thermal field is active, in which case it is the
   chosen cell. The landing cell is recorded too. Each birth is checked against the species' own
   gate, its spec survival window and T range, and the ±100 mV redox classes of
   `tools/nucleation-eh-census.mjs`.

**Read births from the run, not the strip archive.** The archive's per-step series hold each step's
end state, and events carry `sample_index = step − 1`, so sample *n* is the end of step *n + 1*. A
birth during step *n* usually matches the start of its step (sample *n − 2*), sometimes sample
*n − 1*, and never sample *n* alone. My first pass read sample *n*. It put one porphyry stibnite
(step 84) at "33.7 °C, +322 mV" — a primary sulfide in the oxidised zone — because sample 84 is
already past step 85's exhumation-and-oxidation event. The run shows 351.1 °C, +44 mV, matching
sample 82.

Fleet-wide, matching each birth's temperature exactly to archive samples n, n − 1 and n − 2:

| match | births |
|---|---|
| uniquely sample n | 0 |
| uniquely n − 1 | 111 |
| uniquely n − 2 | 441 |
| ties on temperature plateaus | 477 |
| none of the three (mid-step changes) | 183 |

Loosening the match to 0.05 °C moves 16 births from n − 1 into ties. Sample n never matches alone at
any tolerance tried (up to 0.5 °C).

Location was not the issue either. Every birth's nucleation temperature equals the bulk temperature,
and the thermal field never activates at seed 42.

**SIM 285 fleet, seed 42** (`node tools/birth-census.mjs`, Node 24.15):
- 1,212 births in 40 of the 41 scenarios, covering 135 species, with no capture failures.
- **Admission.** 1,187 births were admitted on the bulk fluid. The other 25 were admitted on their
  wall cell by per-vertex nucleation: `stalactite_demo` (2) and `zoned_dripstone_cave` (9) by design,
  and `wittichen` (14) from step 170, when its weathering epilogue switches it on
  (`js/44e-weathering-epilogue.ts:243`).
- **Landing cell.** For 16 bulk-admitted births (`porphyry` 3, `schneeberg` 13) the landing cell's pH
  differs from the admitting pH, by at most 0.31 (a `porphyry` ferrimolybdite: 4.50 bulk, 4.19 cell).
  No finding depends on it.

120 flags fall on 105 distinct births:

| check | births | species | where discussed |
|---|---|---|---|
| gate O2 window | 46 | barite, anhydrite, celestine, selenite, native sulfur | R7 (27 deliberate bypasses; 19 CaSO4 births whose floor is never read) |
| spec survival window | 24 | jarosite, scorodite, atacamite, native sulfur, malachite, pyrite, siderite, azurite, powellite | R3, M10 |
| spec `T_range_C` | 18 | albite, feldspar, native silver, argentite, strontianite, acanthite, lepidolite | M2, M8 |
| gate pH window | 14 | celestine (10), pyrite, malachite, azurite, powellite | M9 |
| gate T window | 13 | chalcopyrite, native silver, bornite, pyrite (2) | M9 |
| oxidised class below +100 mV | 5 | tiger's eye (3, `asbestos_hills_crack_seal`, +37 mV); goethite, malachite (`bisbee` step 73, +83 mV) | tiger's eye by design (Heaney & Fisher crack-seal: the colour comes from the step-58 oxidation); `bisbee` marginal |
| reduced class above +100 mV | 0 | — | the rung-4 partitions hold |

Also re-run: `tools/t-envelope-census.mjs` (static). It reports 146 species declaring T bounds — 64
read from the gate, 44 enforced inline, 31 soft-only, 6 "never read T", 1 unparsed (HMC) — with the
artefacts noted in M13.

---

## 6. Proposed fix order (awaiting the boss)

Each rung follows the house ritual: census first, byte-identical foundation where possible, then the
attributable SIM bump, rebake, cold CI. Even a pure text edit to `js/` changes the bundle bytes and
needs a rebake. A gate-constant edit can also move baselines, because the initiative module reads
gate T windows (`js/43-initiative.ts:106–121`) and drives graduated competition.

1. **Metadata and display tranche.** Expected zero baseline move; measured where noted.
   - Text: R8 formula strings, M3 leftovers, M4–M8 and M11 comments, adamite's Cu-activator text (R1).
   - Gate objects: R7 and M9 (declare soft where soft; correct the wrong T floors).
     - R7's willemite and primary-sulfide O2 fields are read only by the UI and the census tools.
       The σ bodies use `PRIMARY_SULFIDE_CEILING_O2` and willemite's inline 0.5.
     - R7's bypass family (barite, celestine, native sulfur) is a display fix, not a constant change.
       Barite's and celestine's σ bodies pass their gate `O2_min` to `sulfateRedoxAvailable`, which
       still applies it to fluids without explicit pools, and native sulfur's oxidative pathway
       reads its gate window. The panel should show the bypass.
     - The CaSO4 floors (anhydrite 0.3, selenite 0.2) are read only by the UI, so dropping or
       relabelling them moves nothing.
     - Giving the CaSO4 evaluator a redox test instead is a science change that breaks contracts.
       Fluid redox is constant in the two pool-free cases: `reactive_wall` sits at −150 mV,
       O2 0.05, in all 120 archive samples, and `sicily_solfifera` at −190 mV, O2 0.02.
       - A test routed like `sulfateRedoxAvailable` (pools bypass) spares `mvt`,
         `reactivated_fluorite_vein` and `sicily_solfifera`, whose births all have sulfate pools.
         It refuses `reactive_wall`'s anhydrite, one of its five contracted species, at every step.
       - A test that ignores pools would also delete `sicily_solfifera`'s selenite, an
         `expects_species`.
       - Boss call (rung 9).
     - M9's T edits feed the initiative module. Deleting the four wrong T floors is byte-identical
       (growth hash and state fingerprint) in all 41 scenarios (round-5 reviewer's A/B). Other gate
       edits still need their own measurement.
   - R1 trace floors: measured zero drift at seed 42, so they can ride in this tranche.
   - M12 and M13 instrument fixes.
2. **R2 + M10: one survival window per species**, read alike by the σ panel, the Library and the
   wall-attack engine — one SIM bump.
   - The four-species half moves `supergene_oxidation` (round-2 A/B).
   - Marcasite's newly read ceiling moves `reactive_wall`, births unchanged (round-5 A/B).
   - The 19-species half measures zero at seed 42 (round-3 A/B).
   - The greenockite/hawleyite decision moves `reactivated_fluorite_vein` if their floor becomes 5
     (round-4 A/B).
   - M10's chip corrections ride here: once R2 lands, chips and engine read the same fields.
3. **R3 jarosite** — census first. An inclusive cap at 4 breaks `supergene_oxidation`'s jarosite
   contract. Any lower jarosite cap also breaks `bisbee`'s jarosite, whose births sit at exactly
   pH 4.00. `bisbee`'s alunite is untouched unless alunite's own cap moves too.
4. **R4 coffinite and S8 todorokite.** Both species are dead. Todorokite's window also drives the
   birnessite→todorokite transition, so change the two together.
5. **R5 cassiterite** — research note, then replace the F term and re-anchor Sn in the same bump.
6. **R9 booked-cation mandates.** Let fahlore's shared site, and tourmaline's and vesuvianite's Fe,
   take what the cell offers, in both the competition pass and the budget. SIM bump: the five
   contracted fahlores start growing in `bisbee`, `porphyry` and `schneeberg`. The round-3 A/B found
   every birth unchanged and no contract lost.
7. **S1 molar selectors** — census-measured re-anchor (the SIM 259 pattern). Duftite's births move
   from steps 1–2 to 40–41, and the schneeberg uranyl phosphates lose the ×1.3 bonus. The round-5
   reviewer's full Pb/Cu molar A/B also moves `supergene_oxidation`'s mimetite (an
   `expects_species`, 2 → 1 births), lepidocrocite (1 → 2) and selenite (1 → 2), with no contract
   lost.
8. **M1 generated `scenarios`** — derive from the strip archive at bake time; the Library reads the
   generated list.
9. **Boss calls:** R6 and S5 redox residue, a redox test for the CaSO4 evaluator (R7; it deletes
   `reactive_wall`'s contracted anhydrite unless that scenario's fluid changes),
   S2 legrandite, S3 anglesite, S4 lepidocrocite CO2, S6 willemite label, S7 Cd/Ag partition, the
   quartz floor.

**Three fixes that look obvious and are wrong:**
- **Enforcing pyrite's pH 3.5** would delete `sulphur_bank`'s only pyrite, an `expects_species`.
  The experiments say pyrite does form in acid as a minority.
- **A blanket "nucleation window ⊆ survival window" guard** would delete four contracted species:
  - `supergene_oxidation`'s jarosite (all six births above its 4.5 ceiling);
  - `sicily_solfifera`'s native sulfur (all five at pH 6.0–6.3, ceiling 5; an `expects_species`);
  - `sulphur_bank`'s only pyrite (pH 1.50, floor 3; an `expects_species`);
  - `bisbee`'s only malachite (an `expects_species`).

  Fix chips and windows species by species.
- **"Just stop rewarding F" in cassiterite** would leave every one of its 13 births below σ_crit, in
  three scenarios that expect it.

---

## 7. Checked and clean (so the next review can skip them)

- 182 formulas, including the IMA-awkward ones: argentite as the >173 °C Ag2S form that paramorphs
  to acanthite; tincalconite as a borax dehydration paramorph; haidingerite and the meta-uranyl
  minerals as transformation-only.
- The carbonate SI engines and the Mg/Co/spring/pressure aragonite selectors; dolomite's kinetic
  no-show; HMC's measured-domain screen.
- The silica Ostwald sequence. The Fournier amorphous-silica and chalcedony curves are the published
  ones: `log C = 4.52 − 731/T` and `4.69 − 1032/T`.
- Halite and sylvite on brine strength (Usiglio onset 10.6×, bittern 70×).
- Native bismuth's 270 °C limit (Bi melts at 271.4 °C at 1 bar). It is soft-only in the T-envelope
  census but effective: σ peaks at 0.30 above 270 °C (bi_f ≤ 3 × T_factor 0.1), under its
  nucleation threshold.
- The rung-4 redox partitions as enforced in the σ bodies: galena/cerussite/pyromorphite,
  sphalerite/smithsonite, the six primary sulfides, molybdenite, realgar/orpiment. Their gate
  *objects* are stale (R7).
- Beryl-family chromophore routing; the corundum SiO2 < 50 upper gate; andalusite's peraluminous
  gate and Al2SiO5 polymorph check.
- Zeolite cation forks (scolecite/mesolite/thomsonite/chabazite) and the stilbite→heulandite order.

---

## 8. Sources consulted (for the claims that moved a verdict)

- **Pyrite/marcasite.** Stanton, M.R. & Goldhaber, M.B. 1991, *Experimental studies of the synthesis
  of pyrite and marcasite (FeS2) from 0° to 200° C and summary of results*, USGS Open-File Report
  91-310. Abstract read first-hand.
- **Jarosite.**
  - Brown, J.B. 1971, *Jarosite–goethite stabilities at 25 °C, 1 atm*, Mineralium Deposita 6(3),
    doi:10.1007/BF00208032. Abstract read: jarosite stable at pH < 3, persisting outside that field
    through slow conversion to goethite.
  - Grigg, A.R.C. et al. 2023, *Stability and transformation of (Al-)jarosite in acid-sulfate paddy
    soils*, Goldschmidt abstract, doi:10.7185/gold2023.15203. Read first-hand.
  - Barrón, V. & Torrent, J. 2006, *Formation of Fe oxides from K-jarosite*, 18th World Congress of
    Soil Science. Abstract read.
  - The repo's `research/minerals/research-jarosite.md`.
- **Todorokite.**
  - Post, J.E. 1999, *Manganese oxide minerals: crystal structures and economic and environmental
    significance*, PNAS 96(7):3447–3454. Abstract read (Europe PMC).
  - Manceau, A., Lanson, M. & Takahashi, Y. 2014, *Mineralogy and crystal chemistry of Mn, Fe, Co,
    Ni, and Cu in a deep-sea Pacific polymetallic nodule*, Am. Mineral. 99:2068–2083,
    doi:10.2138/am-2014-4742. Abstract and introduction read first-hand.
  - Atkins, A.L., Shaw, S. & Peacock, C.L. 2014, GCA 144:109, doi:10.1016/j.gca.2014.08.014.
  - Jung, H. et al. 2020, *Redox cycling driven transformation of layered manganese oxides to tunnel
    structures*, JACS 142:2506–2513, doi:10.1021/jacs.9b12266. Introduction read first-hand.
  - The repo's `research/arcs/research-surface-growth-fabrics-2026-08-06.md` (Potter & Rossman 1979;
    Golden et al.; Zhao et al.).
- **Coffinite.**
  - Stieff, L.R., Stern, T.W. & Sherwood, A.M. 1955 (type description).
  - Szenknect, S. et al. 2020, *Coffinite formation from UO2+x*, Sci. Rep. 10:12168 (PMC7376029).
    Abstract read via Europe PMC: coffinite formed on UO2 at pH 9, room temperature, anoxic.
- **Tin.**
  - Jackson, K.J. & Helgeson, H.C. 1985, *Chemical and thermodynamic constraints on the hydrothermal
    transport and deposition of tin: I*, GCA 49:1–22. Abstract read (repository mirror).
- **Fahlore.** Abstracts read via Crossref.
  - Biagioni, C. et al. 2020a, *The tetrahedrite group: nomenclature and classification*,
    Am. Mineral. 105(1):109–122, doi:10.2138/am-2020-7128. Tetrahedrite-(Fe) and tetrahedrite-(Zn)
    are both valid species, with Me⁺ and Me²⁺ sharing the M(1) site.
  - Biagioni, C. et al. 2020b, *Tetrahedrite-(Hg), a new 'old' member of the tetrahedrite group*,
    Mineral. Mag. 84(4):584–592, doi:10.1180/mgm.2020.36.
- **Calcite decarbonation.** CaCO3 = CaO + CO2 reaches 1 atm CO2 near 898 °C (standard
  thermochemistry).
- **Willemite and Skorpion.**
  - Mondillo, N., Nieto, F. & Balassone, G. 2015, *Micro- and nano-characterization of Zn-clays in
    nonsulfide supergene ores of southern Peru*, Am. Mineral. 100:2484–2496. Introduction read
    first-hand: sauconite predominates at Skorpion (citing Borg et al. 2003; Kärner 2006).
  - Borg, G. et al. 2003, *Geology of the Skorpion supergene zinc deposit, southern Namibia*, Econ.
    Geol. 98(4):749–771. Bibliographic record confirmed; not re-read.
  - Hitzman, M.W. et al. 2003, *Classification, genesis, and exploration guides for nonsulfide zinc
    deposits*, Econ. Geol. 98(4):685–714. Bibliographic record confirmed; its deposit examples not
    re-read.
- **Amethyst geodes.** Gilg, H.A. et al. 2003, Mineralium Deposita 38:1009.
- **Lepidocrocite.** Abstracts read via Crossref.
  - Schwertmann, U. & Thalmann, H. 1976, *The influence of [Fe(II)], [Si], and pH on the formation
    of lepidocrocite and ferrihydrite during oxidation of aqueous FeCl2 solutions*, Clay Minerals
    11(3):189–200, doi:10.1180/claymin.1976.011.3.02.
  - Carlson, L. & Schwertmann, U. 1990, *The effect of CO2 and oxidation rate on the formation of
    goethite versus lepidocrocite from an Fe(II) system at pH 6 and 7*, Clay Minerals 25(1):65–71,
    doi:10.1180/claymin.1990.025.1.07.
- **Adamite fluorescence.** fluomin.org and uvminerals.org (uranyl activator; Cu dims it).

---

## 9. Review history

Rounds follow the standing rule: one skeptic subagent per round, up to five, stopping at 9/10 or
when nothing is must-fix. Every reviewer claim was re-checked in the code or the source before it
changed this text. Three were rejected along the way: two in round 2 (one of them wrongly, reversed
in round 3) and one in round 4.

### Round 1 of 5 — 7/10
The reviewer re-ran the full birth census and reproduced every count. Corrections adopted:
- **Todorokite** had cited Post 1999 as the gate's source and attached a 2–25 °C figure Post does
  not give. Rewritten (now S8).
- **Pyrite's pH gate** was presented as a science error with a "route sub-5 FeS2 to marcasite" fix.
  It is now in the noted designs plus M9.
- **"Born where they dissolve"** overstated the survival fields. It is reframed as formation (R3)
  and display (M10).
- **Added:** the chip bug (R2), the two wrong formulas (R8), the expected-species traps, and the
  Round-9c rationale for R1.
- **Corrected:** the stibnite explanation (archive timing, not wall averaging), quartz's host count
  (19), and the rung list.
- **Removed:** lepidocrocite's temperature as a science claim, the quartz floor as a defect, and
  an unverifiable jarosite citation.

### Round 2 of 5 — 7/10
The reviewer ran a fuller census recording bulk and cell fluid, plus in-memory A/B runs.
Corrections adopted:
- **R2** reaches the wall-attack engine (`js/85c:2329–2333`). Verified in code; the drift numbers
  are the reviewer's A/B.
- **R5** blast radius: all 13 cassiterite births need the F factor. Verified with this session's
  census.
- **R7** extends to the six primary sulfides. Verified.
- **R9 (new):** the growth budget makes optional cations mandatory. Verified in code.
- **R1:** blast radius measured zero (reviewer's A/B), the existing ×0.5 end-member damping, and the
  correct description of `js/00-mineral-spec.ts:48`.
- **S1:** the uranyl anion forks added.
- **S5:** the ≤ +76 mV figure and the "left deliberately" note.
- **S8:** engages the SIM 250 design and the gate's own Potter & Rossman source.
- **Moves:** turquoise to the noted designs (the repo's research gives a coherent acid-leach /
  neutralise model).
- **Additions:** the pyrite temperature caveat; deterministic-species risks for anglesite and
  lepidocrocite; malachite, celestine and the beryl family in M9; greenockite's two acid thresholds;
  M12 and M13 instrument artefacts.
- **§5:** the timing tally re-derived (the earlier "480/108/617" first-match count misled); native
  bismuth's peak σ is 0.30, not 0.45.
- **The census tool** now records the admitting fluid. In most scenarios that is the bulk fluid, and
  the cell is drawn afterwards; the earlier header wrongly said the cell's fluid admitted the birth.

**Not adopted:**
- "Szenknect et al. formed coffinite at 25 °C". I rejected it because the quoted sentence describes
  a leaching test. **That rejection was wrong** — round 3 showed the leaching test is the experiment
  in which the coffinite formed. Now in R4.
- The Aurora Limestone host name — it rests on dealer pages; the text now says only "limestone
  replacement deposit".

### Between rounds 2 and 3 — the author's own pass
- **Every line cite re-read.** One was off: the deliberate-residue note is
  `js/20c-chemistry-redox.ts:1047–1051`.
- **The admitting-fluid census re-run on the fleet.** It supplies §5's table and the per-finding
  counts.
- **New from the census:**
  - R7's third family (46 explicit-pool births);
  - argentite in S7;
  - M2's direction for four species;
  - four more M10 chips.
- **R2 corrected:**
  - its proposed fix was wrong — keying on `pH_dissolution_above` would break five species with
    both bounds;
  - the engine's mirror half: 19 floor-only species shield at any pH.
- **R9 turned from latent to live.** The v1–v2 text called it latent because no growth-budget cap
  binds. A probe of that budget agreed. But the zero-zone fahlores never reach the budget:
  graduated competition rations them to 0 % first, on the same booked Zn. A second probe of the
  competition pass found the skips. An earlier hypothesis, that the budget itself zeroes them, was
  tested and was wrong.
- **Seven citations checked at the source** (full text or abstract, as §8 marks each):
  - Biagioni et al. 2020: added for R9;
  - Jackson & Helgeson 1985: stronger than the review had said;
  - Jung et al. 2020: the quote sits in the introduction, and the paper made todorokite at room
    temperature;
  - Manceau et al. 2014: exact wording now quoted;
  - Post 1999;
  - Schwertmann & Thalmann 1976;
  - Carlson & Schwertmann 1990.

### Round 3 of 5 — 7.5/10
The reviewer re-ran the census analysis, every Tier-1 cite, the contracts and the cited sources.
Every correction below was re-checked before adoption.

**Must-fix, all adopted:**
- **R9's counts.** My skip probe dropped most log lines: `run_step()` resets the log at
  `js/85-simulator.ts:527`, and the probe resumed reading at the previous step's length. Re-counted
  with the probe fixed: 313 skips (64, 64, 60, 60, 65), not 50. Birth σ is 5–17, not 7–17. The
  mechanism stands.
- **Szenknect et al. 2020.** My round-2 rejection was wrong (see round 2). R4 now cites their
  room-temperature coffinite.
- **R3 touches `bisbee` too.** Jarosite and alunite are deterministic there, all at pH 4.00.

**Should-fix, all adopted:**
- R2's mirror half: corrected wording (prose or `pH` keys), plus the reviewer's A/B showing zero
  drift. I confirmed which scenarios have carbonate walls.
- R2's backfill/decision list fixed, including the 51 species with no numeric bound.
- R9: the reviewer's Fe-only A/B; vesuvianite as the third booked-Fe recipe.
- `birth-census.mjs`: `tigers_eye` and `pararealgar` restored to the class lists (§5 re-run).
- M12: a second off-by-two tool, `nucleation-eh-census.mjs`.
- The blanket-guard trap now lists four contracted species.
- R5: the transport regime at the births' pH and temperature is left to the research note.

**Nits, all adopted:**
- R9's exclusion cite; the v259 wording; Biagioni's shared site, which also holds Hg.
- S8's line cite; S7's tie at `roughten_gill`.
- §5's exact-match tally and softened timing.
- `recipe-cards.mjs`'s hyphenated gate lookup (meta-autunite).
- M9's 31 soft-only T gates.
- R2's fourth reader (`js/64a`); R8's comment wording.

**Verified by the author for round 3:**
- Szenknect (Europe PMC abstract), Brown 1971 (abstract), Mondillo et al. 2015 (introduction), the
  vesuvianite σ, the class-list diff, the skip counts, the timing tally at seven tolerances and the
  carbonate-walled scenarios.
- Borg's and Hitzman's wording remain unverified first-hand. §8 says so, and S6 now leans on Mondillo.

### Round 4 of 5 — 8/10
The reviewer re-ran every v4 number and quote. Corrections adopted after re-checking:

**Must-fix:**
- **R3 / rung 3.** The caps are inclusive and `bisbee`'s births sit at exactly pH 4.00. "Every
  supported ceiling removes all 12" was wrong: an inclusive cap at 4 keeps `bisbee`'s contracts and
  breaks only `supergene_oxidation`'s (reviewer's A/B, adopted with its numbers).
- **R7's third family was mis-explained.** Only barite, celestine and native sulfur are deliberate
  bypasses. Anhydrite's and selenite's O2 floors are never read: `evaluateCaSO4System` has no O2 test.
  - My own check refined the reviewer's account. Redox still enters through `sulfateAvailablePpm`'s
    Eh partition: `reactive_wall`'s anhydrites, at −150 mV with no pools, see 21 % of S as sulfate.
  - The fix splits accordingly: a display fix for the bypasses, and a boss call on a CaSO4 redox test.

**Should-fix:**
- Rung 2 no longer calls the mirror half unmeasured.
- R2's fix list gains the five ceiling-only species. It also notes that the greenockite decision
  moves `reactivated_fluorite_vein`'s fingerprint (reviewer's A/B).
- S7 adds `porphyry`, the one scenario where hosts outnumber the Ag sulfides.
- R5 no longer claims the births sit "inside" J&H's hydroxide exception.

**Nits:**
- The header's round count.
- The fourth reader's scope.
- `recipe-cards.mjs`: one gate resolver for all three lookups (meta-autunite's card now prints its
  gate), and a header that lists every flag and the files it reads.
- Liu et al. 2023 removed from §8 (cited nowhere in the body).
- S6 rebuilt on what Mondillo et al. 2015 actually say.

**Not adopted:**
- "Both duftites would vanish under a molar selector." Round 3's A/B shows the step 1–2 births
  vanish but duftite reappears at steps 40–41, so "move" stands. S1 now gives that result.

### Round 5 of 5 — 8.5/10, "ship after the must-fixes"
The reviewer re-ran the census numbers, the R2 rule, the R3 ceilings, the molar selectors and the
T floors, each against a neutral control that reproduced the shipped fingerprints. It also
re-checked round 4's rejected claim and upheld it (duftite still nucleates at steps 40–41 when both
selectors are molar). Adopted after re-checking:

**Must-fix:**
- **Rungs 1 and 9.** A CaSO4 redox test does not merely "move" scenarios. Routed like
  `sulfateRedoxAvailable`, it deletes `reactive_wall`'s contracted anhydrite: the fluid sits at
  −150 mV in all 120 samples. Ignoring pools, it also deletes `sicily_solfifera`'s expected selenite.
  "Anhydrite is the only deterministic species" was wrong: the contract lists five.
- **R3 / rung 3.** Round 4's A/B had lowered both caps. A jarosite-only cap below 4 costs `bisbee`
  its jarosite but not its alunite (reviewer's A/B).

**Should-fix:**
- R2's rule also gives the five both-bound species a read ceiling. Marcasite's moves
  `reactive_wall`, births unchanged (reviewer's A/B; the control is identical).
- M9's soft-only count is 29, not 31: anhydrite and selenite are hard inside the CaSO4 evaluator.
  Added as a third M13 artefact.

**Nits:**
- R7 names the `sulfateInherited` branch.
- M2 no longer says the census "settles" which bound is right.
- Rung 7 lists the molar A/B's other moves (mimetite 2 → 1, an `expects_species`).
- The recipe-cards header names js/25 and the two unfollowed Ksp evaluators.
- §9's rejection count.
- A full file name for the `js/20c` cite.
- §1 calls the fahlore formulas simplified end-members.
- Rung 1 now quotes the measured all-41-scenario T-floor result.

This was the fifth and last round under the standing rule. A sixth would need the owner's go-ahead.

---

## Appendix A — spec `T_range_C` vs gate `T_min–T_max` (°C), from `tools/recipe-cards.mjs`

| species | spec T_range_C | gate | | species | spec T_range_C | gate |
|---|---|---|---|---|---|---|
| acanthite | 50–170 | —–173 | | lepidocrocite | 0–250 | —–200 |
| anhydrite | 25–700 | 100–— | | lepidolite | 350–600 | 350–700 |
| apatite | 50–900 | 50–1000 | | mimetite | 5–180 | —–80 |
| aquamarine | 300–650 | 300–700 | | morganite | 300–650 | 300–700 |
| aragonite | 5–500 | —–400 | | native_bismuth | 50–271 | 100–270 |
| arsenopyrite | 150–700 | 200–600 | | native_copper | 0–300 | 20–300 |
| atacamite | 5–100 | 5–200 | | native_sulfur | 20–119 | —–200 |
| beryl | 300–650 | 300–700 | | naumannite | 80–300 | 50–350 |
| bornite | 20–500 | 80–500 | | olivenite | 10–50 | 10–60 |
| calaverite | 150–400 | 100–300 | | pharmacolite | 5–80 | 5–50 |
| calcite | 0–840 | —–500 | | powellite | 10–200 | 5–250 |
| chalcopyrite | 100–600 | 180–600 | | pyrite | 25–700 | 100–400 |
| chromite | 800–1400 | 800–1500 | | scheelite | 200–600 | 100–700 |
| chrysoprase | 0–80 | 5–80 | | selenite | 5–60 | —–80 |
| clausthalite | 80–350 | 50–450 | | smithsonite | 5–150 | —–100 |
| emerald | 300–650 | 300–700 | | spodumene | 400–700 | 400–800 |
| feldspar | 250–1170 | —–800 | | strontianite | 50–200 | 5–250 |
| goethite | 5–150 | —–100 | | sylvanite | 100–400 | 80–300 |
| greenockite | 25–200 | 25–250 | | sylvite | 10–100 | —–200 |
| heliodor | 300–650 | 300–700 | | tincalconite | 0–320 | —–60 |
| hessite | 100–350 | 50–400 | | turquoise | 0–80 | 5–80 |
| | | | | witherite | 50–200 | 5–250 |
| | | | | wolframite | 250–450 | 200–600 |
| | | | | wurtzite | 95–600 | —–350 |

Whether a gate value is enforced hard, inline or only softly is a separate axis — see M9 and M13.
