# HANDOFF — the ladder is closed; the bedrock awaits approval (2026-07-17)

For the fresh context that continues after the fix ladder. **ALL NUMBERED RUNGS ARE CLOSED**
(1 F · 2 T-gates · 3 tiger's-eye · 4a–d redox · 5 salinity), through **SIM 234**, cold-CI
stamped GREEN at `05aa5e4`, 2436/2436, deployed. This bridge supersedes
`HANDOFF-RUNG-4D-AND-THE-SULFUR-SPLIT-2026-07-16.md` (historical — both its questions
answered: rung 4 was NOT done → the sibling gates shipped SIM 233; the S-split is no longer
a flag but a proposal).

## The commit trail of this stretch (all pushed, newest first)

- `1bcf54e` docs: **PROPOSAL-FLUID-S-SPLIT-2026-07-17.md** + BACKLOG next-line
- `feaa361` docs: rung-5 banner
- `05aa5e4` sim: **rung 5 — chloride evaporites → real brine strength (SIM 234)** ← the stamp
- `082ebdb` tools: halite-saturation-census (rung-5 instrument)
- `a8725df` docs: rung-4d banner + bridge ANSWERED addendum
- `bed8675` sim: **rung 4d — the sibling gates (SIM 233)**
- `e201ab9` tools: nucleation-eh-census (all-species, the standing rung-4 gate)

## Read first (in this order)

1. `proposals/PROPOSAL-FLUID-S-SPLIT-2026-07-17.md` — THE NEXT ARC, awaiting boss approval.
   Its §5-B is the recommended shape; §9 holds the two open questions (F_min floor value,
   T-taper anchors).
2. `proposals/BACKLOG.md` — the 🗿 rung-5 banner (top) carries the full rung-5 record + the
   residue lists; the rung-4d banner below it carries the sibling-gates record.
3. Keystone lineage: `HANDOFF-FOUNDATIONS-2026-07-03.md`, **twenty-third hand — "the rock's
   own units"** (this stretch's story: close-by-census, indict-the-axis,
   calibration-expiry, withdraw-with-research, disequilibrium-is-content).
4. The fix commits' messages (`bed8675`, `05aa5e4`) — the field notes carry per-species
   numbers and the canary pre-registrations.

## THE NEXT ACTION — S-split Phase S0, gated on boss approval

The boss selected the split ("lets go with the sulfate/sulfide split next"); the proposal is
written and pushed; **the boss has NOT yet approved the recommendation** (the rung-4
precedent: rockbot approved that proposal's direction before any build). On approval:

- **S0 (safe, byte-identical):** build `tools/sulfur-speciation-census.mjs` (per
  scenario × step: Eh/T/S + what each candidate fraction yields; the per-species
  would-it-starve table at recorded operating points) and land
  `sulfurReducedFraction` / `sulfideAvailablePpm` / `sulfateAvailablePpm` in js/20c
  **defined-but-unused**. S0's instrument MEASURES the F_min floor (smallest value that
  keeps every legit consumer fed) instead of accepting the proposal's 0.15 placeholder.
- **Do NOT start S1** (barite's migration, the first baseline-moving commit) until S0's
  table exists — the proposal's §5-B arithmetic ("mvt barite still saturates its s_f cap")
  is an estimate, not a measurement.
- The As-split (js/20c:380–452) is the implementation template — read it before writing a
  line. Note its thioarsenite lock reads total `fluid.S > 50`; re-coupling it to
  sulfideAvailablePpm is sequenced in S2, NOT S0.

## The ritual (unchanged, two standing census gates now)

Session start: `vugg-session-start` (cwd RESETS after /compact; `node tools/cold-ci.mjs
--check` — the stamp vouches for `05aa5e4`; docs-only commits since are provably inert via
`git diff --stat`). Fix flow: census → researched edit → `npm run build` (NEVER bare
build.mjs) → blast vs `seed42_v234.json` → full vitest (diagnose every red BEFORE touching)
→ bump SIM FIRST → gen-js-baseline + gen-strip-digest + gen-strip-archive + baseline-diff +
mineral_coverage_check (stale gate = 1 = magnetite/jeffrey_mine) → explicit staging (never
-A) → `git commit -F <unique tempfile>` → verify title → push (= deploy; pages/builds/latest
commit==HEAD) → cold-ci stamp. **After any redox- or brine-adjacent change, run BOTH:**
`tools/nucleation-eh-census.mjs` (expect flagged 0+0) and `tools/halite-saturation-census.mjs`
(expect zero sub-onset births).

## Traps this stretch paid for (don't pay twice)

- **When values resist tuning, indict the AXIS.** Rung 5's constant was un-tunable because
  the ppm axis itself couldn't carry saturation across deliberately-abstracted broths. The
  fix was brine strength (salinity/35 × concentration, seawater multiples).
- **A σ-currency change expires every calibration priced in it.** The halide MORPH_TH bands
  and five test contracts had to move IN THE SAME COMMIT or hoppers would have silently
  flattened forever. If the S-split changes any engine's effective σ scale, grep MORPH_TH
  tenants and test pins for that mineral BEFORE the bump.
- **Barite's 49 sub-boundary crystals are the MVT diagnostic, not offenders.** Any S-split
  behavior that starves mvt/wittichen/elmwood barite is WRONG by acceptance criteria (§8 of
  the proposal). Same for wittichen's barite+acanthite pair (+74/+75) and sicily's
  native_sulfur (+76, needs BOTH species — the natural S3 test case).
- **The enrichment trio's food source is the S2/S3 hard question.** Chalcocite/covellite/
  bornite at +111..+252 eat sulfide released by dissolving primaries — a transient the
  derived partition may not feed. Their carve-out gates stay until a census proves
  otherwise; do not retire them with the primary-six ceilings.
- **Promise-withdrawal needs research + measurement + a resurrection condition** (the
  tincalconite pattern: mechanism identified, 0-across-8-seeds measured, mechanic retained,
  return condition written).
- Small but real: `Get-Content file | Measure-Object -Line` DROPS BLANK LINES — it will
  tell you a 2,700-line lineage doc is 2,094 lines and make you suspect corruption. Use the
  Read tool's numbering or `(Get-Content file).Count`.

## Carried forward (don't lose these)

- **Boss eye-check — OWED, NINE bumps deep** (SIM 226–234). Richest: **searles_lake**
  (borax blades to 23.6 mm where the salt boulders were; the husk cycle), **tn457**
  (de-salted to 10 honest crystals, one massive sphalerite), supergene_oxidation +
  roughten_gill (the 4d re-deals), plus the older debts (deccan stilbite, sunnyside).
- **TN457 the SPECIMEN**: boss now "fairly certain" it's sphalerite + witherite → England
  rehabilitated. The catalog amendment awaits the boss's note on WHICH test decided
  (record the UV-dark-core objection alongside). Future sim tie-in: a witherite stage on
  tn457_barite_pulses would be the dead witherite engine's FIRST TENANT (the scenario's
  Dunham note already places baryte/witherite in this vug's zone). NO scenario edit until
  the boss finalizes.
- **Scenario candidates now motivated**: a perennial-brine lake (Dead Sea / solar
  saltworks — homes the unoccupied chevron band + persistent hopper rafts); a potash
  scenario (Zechstein/Prairie/Khorat — wakes sylvite); the Precambrian BIF (tiger's-eye +
  willemite); Sunnyside boiling → native gold (boss calibration specimen).
- **4d residue**: the wolframite spurious-gate decision (own census; removal may BIRTH the
  species in the W=5 pegmatites); arsenopyrite 0.8; the 1.5 fahlore/sulfosalts; CdS
  literals; ~22 direct-O2 readers; stale 4b gates tables; redox-gate-census map maintenance.
- **Owner actions**: vugg-canary `node src/schedule.mjs --install` (still unarmed);
  pre-v194 strip saves offer stands.
- **Canary morning-after**: `bed8675` + `05aa5e4` messages carry the pre-registrations
  (expect searles crystals 57→155, tn457 24→10, halite vanished at tn457/travertine,
  sylvite + tincalconite vanished, borax + mirabilite appeared, descloizite appeared at
  roughten_gill). Anything ELSE moving is worth a look.

## Diversions from the Elmwood eye-check (2026-07-23) — habit-rendering fidelity

Surfaced when the boss eye-checked v234-vs-v235 Elmwood renders during S1 (barite settled:
"the barite's ok"). Reference: real Elmwood specimen **#103941** (calcite + galena +
fluorite + celestine).

- **Elmwood calcite — ✅ FIXED 2026-07-24 (render-only, byte-identical, 2436/2436).**
  Boss's refined finding (with reference photos of real Elmwood double-terminated golden
  calcite): the 3D view rendered it as "two low pyramids... an even square" — should be
  TALLER than wide, and double-terminated ones never form an even square. ROOT CAUSE
  (measured live, seed 42): the 19 mm calcite's `a_width_mm` is the js/27 ellipsoid-VOLUME
  measurement (`a = √(6V/πc)`, feeds vug fill — the byte-identity keystone), and a mature
  calcite that integrated ~920 mm³ reads back **13.32 × 11.49 mm = 1.16:1 near-square**;
  both renderers used that measurement as the display width. The declared honest aspect
  was already in the tree (`_GEOM_TOKEN_RATIO.scalene = 0.6`) but only consulted on the
  visibility-floor path. FIX (the botryoidal-override house pattern, mirror direction):
  (1) js/99i scale.set 'scalene' branch — display width capped at `cLen × 0.6`, sim-side
  dimensions untouched; (2) same cap for druzy-cluster satellites (they derived from the
  parent's raw a_width and rendered even-square around a properly-toothed parent);
  (3) js/99d wireframe instance — same cap for the topo-3D wireframe path; (4) js/99c
  PRIM_SCALENOHEDRON re-cut — mid-rings 0.7/0.2 → 0.55/0.15, bottom apex −0.1 → −0.12:
  UNEQUAL terminations (upper tooth 0.45, lower point 0.27) instead of two equal
  0.3-pyramids. VERIFIED: parent + all 4 satellites at ratio 0.60 exactly (mesh-scale
  probe); side-on in-browser eye-check reads as pointed elongated teeth; 2436/2436 with
  seed42_v235 untouched. Boss eye-check of the new render still owed.
- **Elmwood celestine — DESIGN SETTLED, EXECUTION = the S2 celestine tranche (do NOT
  half-ship).** The boss surfaced mindat's Elmwood page: **"Barium-bearing Celestine,
  (Sr,Ba)SO₄, habit: FIBROUS, white"** — photographic proof (fibrous white sprays/blankets
  + cream nodular masses on sphalerite; initially misidentified as anglesite). And the sim
  ALREADY KNOWS: both seed-42 elmwood celestines carry "Ba-substituted (barytocelestine
  intermediate)" in their zone notes (grow_celestine's ba_ratio = Ba/Sr = 28/10 = 2.8 ≫
  the 0.25 threshold) — the chemistry that mindat says drives the fibrous habit is already
  computed, it just doesn't STEER the habit (fibrous is gated on the Sicilian
  `fluid.S > 200` sulfur-vug context; elmwood's celestines fall to `tabular`, 8.3/7.6 µm,
  σ now 0.732 dormant, nucleated steps 86/88). WHY S2 AND NOT NOW: (a) habit string
  tabular→fibrous moves `_habitAspectRatio` 1.5→0.5 → `_volume_mm3` → vug fill →
  chemistry = a BASELINE MOVE (SIM bump + rebake) for two 8 µm crystals; (b) celestine
  still reads raw `fluid.S` — S2 migrates it to sulfateAvailablePpm, elmwood's reducing
  broth then CUTS its sulfate food, and it needs a barite-style s_f re-anchor anyway. Two
  entangled celestine retunes in separate commits violates the attributable-change
  discipline. THE S2 CELESTINE TRANCHE — **REVISED 2026-07-24 after the research +
  census pass (boss GO: "lets start on celestine... will likely involve doing more
  research"). Full story in `research/research-celestine-elmwood-2026-07-24.md` — READ
  IT FIRST.** The census reframed the design (grep-the-tree, again): celestine's live
  window is ONLY steps 74–98 (σ peaks 1.08 exactly when the cooling vein crosses 100 °C
  — the low-T factor; geologically right-shaped, late + cool), **Sr is flat at 10 ppm
  the whole run (sr_f 0.67; the scenario has NO Sr event — that is the real
  starvation), and the S2 migration alone KILLS celestine (σ_split peak 0.51; sulfate
  fraction ≈0.44)** — a bare barite-style re-anchor restores only the 8 µm dust. The
  literature supplies the missing mechanism: **Hanor 2000 (RiMG 40:193–275)** —
  carbonate-hosted celestine is fed by Sr EXPELLED FROM THE HOST CARBONATES
  (aragonite→calcite recrystallization + dolomitization), textbook in exactly Elmwood's
  Ordovician-carbonate MVT setting; mindat's 2017 "calcite ON barian celestine" pockets
  + the specimen's glue-on-the-bottom both place celestine in the late carbonate stage.
  FIVE parts, one commit: (1) migrate supersaturation_celestine to sulfateAvailablePpm;
  (2) re-anchor s_f ÷40 → measured ≈÷18 (same calibrated-against-pre-split-effective-
  sulfate framing as barite's ÷20); (3) **late Sr release event in the elmwood scenario**
  (`elmwood_diagenetic_sr`, Sr 10 → ~30, the Hanor mechanism; NOT a sulfate pulse — the
  no-meteoric-pulse rule untouched; **NEEDS BOSS SIGN-OFF — it's the load-bearing
  part**, without it the tranche just preserves dust more honestly); (4) Ba-fibrous
  habit gate — `ba_ratio > 0.25 → 'fibrous'` (mindat's Ba-bearing FIBROUS Elmwood
  celestine + the Sunagawa/Gránásy impurity-branching mechanism: the divalent Ba²⁺
  co-ion splits the growth front → radiating fibrous; KEEP the Sicilian S>200 branch —
  real for sicily_solfifera); (5) druzy-BLANKET render — the "glue": cluster-carpet /
  lateral-spread treatment via the chalcedony botryoidal + _druzyClusterSpec machinery,
  not discrete needles. Acceptance: elmwood celestine reads as a white fibrous blanket
  at the late stage; sicily fibrous + madagascar nodular + Lake-Erie bladed branches
  unregressed; no other scenario births celestine (Sr stays scenario-local).

## S2 CELESTINE TRANCHE — ✅ SHIPPED SIM 236 (`5712f44`, 2026-07-25, cold-CI GREEN)

All five parts landed exactly as specified above (plus the census instrument,
`tools/celestine-tranche-census.mjs`, committed). Blast 5/39, 0 species lost; elmwood
celestine 2 → 6 crystals, 8.3 µm → **2.69 mm** fibrous blankets (a > c — the coating
proportions; mesh scale 4.04 × 1.62 verified). The boss approved the Sr event with the
narrowness ruling recorded in the event handler's comment. One latent test assumption
fixed en route (o2-render-wiring: THREE.BoxGeometry natively ships 6 face-groups; the
un-contacted invariant now checks the real half-fire signature). Remaining S2: the other
sulfate consumers (selenite — REMEMBER the S0 pre-registered casualty selenite@elmwood;
anhydrite, mirabilite/thenardite, chalcanthite, the Cu sulfates, alunite/jarosite), each
with its own census-measured re-anchor; then S3 re-couples the thioarsenite lock.

*Twenty-third hand's bridge, 2026-07-17; Elmwood-diversions addendum by the twenty-fourth
hand, 2026-07-23; S1 LANDED (SIM 235, `aeff2fb`, cold-CI GREEN) + calcite dogtooth render
fix + celestine S2 design by the same hand, 2026-07-24; the S2 celestine tranche SHIPPED
(SIM 236, `5712f44`) + pan-camera fix (`d6b9ae7`) by the same hand, 2026-07-25. The
keystone for this stretch is in HANDOFF-FOUNDATIONS-2026-07-03.md ("the rock's own
units").*
