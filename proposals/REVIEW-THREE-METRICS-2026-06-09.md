# REVIEW — Three Metrics (2026-06-09)

A cold-eyes sweep of the simulator at SIM_VERSION 176 on three axes the boss
asked for: **bug catching**, **mineralogical accuracy**, and **Steam-readiness**.
Method: full `npm run ci` cold, the standing checkers (`thermo-coverage-check
--internal`, `twin-law-check`, `geology_check`, `mineral_coverage_check`), and
three parallel deep-review passes (one per axis) with runtime probes against
the built bundle. Two bugs were fixed in this pass (see §1.1–1.2); everything
else is reported here with file evidence and left for deliberate sequencing.

**What this review could NOT check (blindness, named):** nobody listened to
the sonifier (jsdom is deaf — by-ear items stay open); nobody played a full
session as a player (onboarding findings are inferred from code, not felt);
five twin-law citations could not be vouched from standard references and
need a literature pass (millerite {30-34}, skutterudite {112}, enargite {320},
leadhillite {140}, haidingerite {110}); and the PWP/pK findings rest on the
reviewer's literature recall plus web spot-checks, not a PHREEQC benchmark run.

---

## 1. BUG CATCHING

Verification baseline: suite 1769/1769 green, geology_check and
mineral_coverage_check run (8 stale / 35 dead minerals = known tracked debt).
Strip codecs, voxel-grid 3D diffusion mass conservation, movements dark
scaffold RNG-neutrality, and the sonifier plan builder were reviewed and found
sound.

### 1.1 FIXED — committed bundle was stale; `npm run ci` was RED (81b115b)

`build:check` failed with the maximally-misleading message "diff length:
0 chars": the v176 history comment in `js/15-version.ts` was edited after the
final build ("F nudged to 12" → "F raised to 25", same character count), so
the committed `index.html` embedded the old wording. Red since `c1b161e`.
Comment-only, SIM-NEUTRAL. **Lesson:** the build:check diff-length heuristic
hides same-length drift; running `npm run ci` cold at review start is what
caught it.

### 1.2 FIXED — the four v165 sulfate SI chips were unreachable in the Strip View selector

`js/99k-strip-view.ts` `_stripRenderDataset` iterated a hardcoded
`['wall','special','carbonate','ion']` systems list; the sulfate chips
(SI_selenite/anhydrite/barite/celestine, declared `system:'sulfate'` in 99j)
rendered in every strip but had no toggle, no hover-isolate, and were
unreachable after bulk **none**. One-line fix + a new self-checking probe
`tools/strip-chip-selector-probe.mjs` (renders a synthetic 5-system dataset
through the real selector; verified FAIL pre-fix / PASS post-fix). UI-only,
SIM-NEUTRAL.

### 1.3 ✅ FIXED v177 (`51487a4`) — graduated-competition "per-cell" grouping collapses to per-ring with an arbitrary budget fluid

> **Outcome note:** fixed and MEASURED (tools/graduated-binding-probe.mjs):
> rationing binds only in same-cell stacks, identically under both keys, so
> the bug was output-latent at seed 42 — "load-bearing for shipped growth
> allocation" below was overstated. It becomes load-bearing when budgets
> tighten. Original finding kept for the record:

`js/85b-simulator-nucleate.ts` (~line 1081, `_computeGraduatedZones`): the
cell key reads `cell.id ?? cell.idx ?? ringIdx + ':' + cell.vertexIdx` — but
`WallCell` defines none of those fields, so every key degrades to
`cell:<ringIdx>:?`. **All crystals in a ring share one competition group**,
rationed against whichever cell's fluid registered first (order-dependent),
while their mass-balance debits land on their own cells. Probe (mvt seed 42,
step 40): fluorite/willemite/barite in three different ring-7 cells, one
group key. Shipping since v128c (`GRADUATED_COMPETITION_ENABLED = true`).

Fix is one line (`anchor.ringIdx + ':' + anchor.cellIdx`) but
**calibration-affecting** — it changes growth allocation everywhere and
rebakes every baseline. Deserves its own arc with before/after assemblage
probes. Worth noting: this may be quietly *causing* some of the 8 stale
expects_species (§2.3) — fix this first, then re-run the stale sweep.

### 1.4 OPEN MED — event chemistry never reaches non-equator `ring_fluids`

`js/85c-simulator-state.ts:40` (`_propagateGlobalDelta`) routes deltas to
voxels + mesh cells only; the documented per-ring fluid loop is gone. Probe
(reactivated_fluorite_vein seed 42, step 125): mesh cells carry the pulsed
chemistry, `ring_fluids[*]` still hold the initial broth. Main growth reads
mesh cells (fine), but stale readers remain: `_applyOpenAtmosphereEquilibration`,
`_syncRedoxEh`, replay snapshots, and `fluidAtMeshVertex`'s pole fallback.
The vadose override still mirrors into `ring_fluids[r]`, so the store is
half-maintained. **Decision needed: retire the store or restore the loop** —
not a third partial mirror.

### 1.5 ✅ FIXED v179 (`503e228`) — reactivated_fluorite_vein's "sealed" interval isn't quiet

> **Outcome note:** flag + non-heating floors landed, and the flag exposed a
> missing knob — the pulses had been incidentally holding stage-1 temperature.
> New opt-in `wall.cooling_rate` (default 1.5, RNG-neutral); the vein runs 0.4.

Two coupled issues in the v176 demonstrator (`js/70t-reactivated-vein.ts` +
`data/scenarios.json5`):
- Missing `wall.thermal_pulses: false` — the generic magmatic pulse mechanic
  fires *during the sealed interval* (observed seed 42: T jumps 156.5→171.0 °C
  the very step the seal lands, flow_rate slammed from 0.05 back to 1.5–3.0).
  This is exactly the v162 supergene-flag lesson (bisbee/roughten_gill/
  schneeberg); the flag just wasn't applied to this seal interval.
- `event_reactivated_vein_seal` uses `c.temperature = Math.max(120, T - 30)`
  — on seeds where pre-seal T < 150, the "cooling" event *heats* the vug.
  Non-heating form: `Math.max(Math.min(T, 120), T - 30)`.

Cheapest moment to fix is now (scenario is new; only its own baseline moves).

### 1.6 OPEN LOW (latent + hygiene)

- **120 cells/ring hardcoded in viewer + sonifier** (`99k` `cellsPerAngle`,
  `85i` `_STRIP_SONIFY_CELLS_PER_RING`) but `cells_per_ring` is an overridable
  WallState option and the strip manifest doesn't carry it. Add an optional
  `axes.cells_per_ring` (backward-compatible, like `depth_positions`).
  Adjacent: `85g` records `seed: Number(sim?._seed || 42)` — a legit seed 0
  records as 42.
- **`stripStorageSave` leaks the IDB connection** if the eviction pass
  rejects, and both eviction and `stripStorageList` use `getAll()` —
  materializing every multi-MB blob to read keys+timestamps (the "lightweight"
  comment on stripStorageList is false). Cursor or getAllKeys instead.
- **`equilibratePHtoPCO2`** (`20d:211`) returns the pH-2.0 bracket bound when
  the target pCO2 is unreachable from below — a near-zero-DIC open-atmosphere
  fluid would be slammed to battery acid every step. No current scenario trips
  it; landmine for the next open-system scenario.
- **`ehFromO2`/`o2FromEh` are 10× asymmetric above O2=5** (`20c:145/155`) —
  an Eh-canonical movement writing Eh +800 mV snaps back to +530 mV when the
  window closes. **Blocks Movements Phase 1's Eh driver** — align the
  saturation slopes before that arc lands.

---

## 2. MINERALOGICAL ACCURACY — grade A−

The strong news first: **all 171 formulas scanned, zero charge-balance or
hydration errors**; scenario locality work (Naica, Sicily, Jeffrey, Sunnyside,
Roughten Gill suite, Schneeberg five-element) is faithful; Davies/Bjerrum/
Nernst forms and constants verified correct at 25 °C; molar volumes right;
narrator trivia hit-rate on checkable facts (Ontonagon Boulder, Kim 2023
dolomite, García-Ruiz 2007, acanthite 173 °C, hawleyite 1955…) impressively
high.

### 2.1 ✅ FIXED v178 (`61bef7c`) — PWP activation energies are paired to the wrong mechanisms

> **Outcome note:** corrected to [14.4, 35.4, 23.5] + factor re-anchored
> 5.0e4 → 1.9e4 (tuned under the wrong Ea; super-linear response, see the
> commit). Borax un-staled at searles_lake; week-11's HMC test fixture was
> undersaturated and only the bug satisfied it — fixed and premise-pinned.

`data/thermo-carbonates.json` calcite `Ea_kJ_mol: [35.4, 23.5, 14.4]` +
`js/52b-engines-carbonate-kinetics.ts` defaults: the three numbers are real
Palandri & Kharaka (2004) calcite values, but P&K assign **acid = 14.4,
neutral = 23.5, carbonate = 35.4**. The code pairs k1 (acid/H⁺) with 35.4 and
k3 (neutral) with 14.4 — **exactly reversed**. Correct `[k1,k2,k3]` pairing:
**`[14.4, 35.4, 23.5]`**. Effect: hot acidic scenarios over-amplify the acid
pathway ~e^2.5 ≈ 12×. Sim-driving since the v144 calcite SI promotion.
Calibration-affecting fix; run with the §1.3 rebake or immediately after.
Sources: USGS OFR 2004-1068; arXiv 2501.05225 (PWP pitfalls); Reaktoro P-K docs.

### 2.2 MED — carbonate kinetics/speciation T-dependence is starved

- pK(T) slopes in `js/20b` are ~5–10× too flat (pK₁ −0.0007/°C vs real
  ≈ −0.005 to −0.009; pK₂ −0.0029 vs ≈ −0.009; pKH +0.005 vs ≈ +0.013). The
  25 °C anchors are correct; cold-cave vs hot-travertine speciation is muted.
  The "<0.05 pK up to 60 °C" comment is wrong by ~4×.
- PWP k2 ≈ 13× high, k3 ≈ 6× low vs PWP 1978 — absolute magnitude is absorbed
  by global calibration, but the *relative* weighting (which pathway dominates
  at a given pH/pCO₂) is skewed toward the carbonic-acid term.

### 2.3 MED-HIGH — 8 stale expects_species are locality-fidelity breaks at runtime

The data is right; the engines never fire: **searles_lake without borax +
mirabilite** (its identity minerals), **roughten_gill without linarite,
leadhillite, mottramite, bayldonite** (events literally named `linarite_stage`
and `leadhillite_cap`), jeffrey magnetite, schneeberg torbernite (0/10 seeds;
zeunerite 2/10). Also: **bisbee's expects_species omits azurite** (and
cuprite) while the scenario bills the azurite↔malachite cascade as its
centerpiece. Re-run this sweep AFTER the §1.3 fix — the competition-group
collapse plausibly suppresses exactly these marginal nucleators.

### 2.4 Spec + narrator corrections (small, high-reach)

| Sev | Where | Wrong | Right |
|-----|-------|-------|-------|
| MED | wurtzite spec + narrator | "above 95 °C sphalerite gives way to wurtzite" | inversion is ~1020 °C; natural low-T wurtzite is metastable (S-deficiency / low pH). Keep 95 °C as a sim gate if calibration needs it; stop narrating it as the phase boundary |
| MED | calcite `habit_variants` + aragonite narrator | flos-ferri as calcite habit / "Fe-rich aragonite… iron flower" | flos ferri is *pure aragonite*; named for the Eisenerz siderite (iron) mines, not Fe content |
| MED | native_copper narrator | Statue of Liberty patina = malachite | brochantite + antlerite (+ atacamite) — sulfate chemistry |
| LOW-MED | spodumene narrator | "Minas Gerais produces the world's best hiddenite" | true Cr-hiddenite's classic source is Alexander Co., North Carolina; Brazilian green spodumene is mostly Fe-colored |
| LOW | scheelite narrator | UV prospecting "since the 19th century" | 1930s–WWII development |
| LOW | heliodor narrator | "Namibian" variant credits Volodarsk | Volodarsk-Volynskii is Ukraine; two localities conflated |
| LOW | pyrite narrator | pyritohedron "non-crystallographic" | {210} is fully crystallographic (class m3̄); *pseudo*-fivefold is what's meant |
| LOW | topaz narrator | "Iapetos-age pegmatites" | garbled phrase; rewrite |
| LOW | witherite spec | thermal_decomp_C 811 "→ BaO + CO2" | 811 °C is the orthorhombic→hexagonal transition; decarbonation ~1300 °C |
| LOW | selenite spec | dehydrates direct to anhydrite at 150 °C | via bassanite (hemihydrate) |
| LOW | aragonite spec | dry inversion 520 °C | usually cited ~400–470 °C |
| LOW | wulfenite spec | "requires BOTH galena AND molybdenite" | Mo commonly sourced from trace Mo in galena/wallrock (Red Cloud, Mežica have no discrete molybdenite) |
| LOW | meta-autunite spec | 8H₂O | meta-autunite-I is 6 (2–6); 8 is metatorbernite's number |
| LOW | naica scenario text | "gypsum-anhydrite boundary at 54 °C" vs its own notes' ~58 °C | make internally consistent |
| LOW | aragonite-vs-calcite gate | Mg/Ca (ppm-mass) > 4 + T > 30 °C | modern seawater (mass ≈ 3.1) precipitates aragonite warm; literature threshold ≈ molar 2 (mass ≈ 1.2) |
| LOW | doc drift | `20a` header says ACTIVITY_DAMPING 0.5, Phase-2c note says 0.4, constant is 0.25 | fix the comments to the shipping truth |

### 2.5 Twin-law checker results

108 pass / 46 flag / 1 axis-twin. Spot-verified flags are checker
conservatism, not fabrication (pyrite iron-cross {110}, marcasite spearhead
{101}, stibnite {130}, apatite {11-21}, pyrolusite polianite {031} — all
real). The five listed in the blindness note above need a literature pass.

---

## 3. STEAM-READINESS

Verdict up front: **the sim core is more than Steam-ready; the game around it
is 3–5 months of product work** from a credible $10–15 niche release in the
Powder-Toy / zen-sim lane. Zero CDN dependencies (Three.js vendored, system
fonts), build pipeline a wrapper consumes almost unchanged, 171 minerals + 31
scenarios + 7 modes of real content.

### T1 — blockers (Steam requires it or reviews die)

1. **No save export for the collection** — the entire meta-progression lives
   in one localStorage key (`'vugg-crystals-v1'`), no backup/export/import. The
   `.stripview` download/upload codec proves the pattern; the collection never
   got it. (S→M)
2. **16 `prompt()`/`alert()`/`confirm()` call sites** (8 in `93-ui-collection`
   alone — naming a collected crystal is a `prompt()`). **Electron does not
   implement `window.prompt`** — collecting would silently break in the most
   likely wrapper. Modal infra already exists (`97d-ui-zone-modal`). (S/M)
3. **Scenarios have no offline fallback** — `SCENARIOS` is populated only by
   fetching `data/scenarios.json5` (the "legacy in-code scenarios" comment in
   `70-events.ts` is stale; there are none). Under `file://` the packaged game
   boots with zero scenarios. Fix: wrapper custom protocol + a build-time
   embedded fallback mirroring the minerals.json pattern. (S)
4. **No settings menu** — no master volume outside the strip panel (sliders
   are unpersisted in-memory `let`s), no fullscreen toggle, nothing persisted. (M)
5. **Fullscreen/resolution untested as an app** — centered browser-column
   layout; needs checking at 1080p/ultrawide/125 % Windows scaling. (M)
6. **In-progress runs evaporate** — no `beforeunload` guard anywhere. (S)

### T2 — genre-peer expectations

7. **Progression**: the Library banner ("X/171 species, Y twinned") is the
   entire reward structure. Per-scenario objectives are nearly free — every
   scenario already has `expects_species`; surface it as a field checklist.
   Achievements once the wrapper exists. (M)
8. **Onboarding**: Quick Play drops a new player into a wall of field-report
   text; the 30-minute-refund-window experience is the biggest review risk.
   Tutorials already slated for rework on this backlog. (L)
9. **Audio identity**: the sonifier is the only sound in the game — as the
   *only* sound it makes everything else feel silent. Ambient layer + UI
   sounds. (M)
10. **Accessibility**: one `aria-hidden` in 72k lines; mineral identity is
    color-coded with no colorblind path; small monospace text with no scale
    option. (M)
11. **Steam Deck / controller**: pure mouse-and-hover; ship "mouse required,"
    Deck unsupported at launch. (L — defer)

### T3 — differentiators (store-page ammunition, already built)

- "Every number in this game has a reference" — 171 literature-cited species,
  28 real localities with citations *in the data file*. No competitor has this.
- **The sonifier** — "listen to your rock grow." Trailer material.
- Deterministic seeds + shareable `.stripview` datasets — community
  specimen-sharing half-built.
- Zen mode ("screensaver for geologists"), Record Groove, real 3D habit-
  resolved crystals, agent API (modding/education).

### Wrapper call

**Electron + steamworks.js** over Tauri: shipped precedent at this exact
shape, WebView2 has known Steam-overlay/Proton headaches, and the ~100 MB
Electron tax is irrelevant for a 4 MB game. Custom `app://` protocol fixes T1
#3; Steam Cloud rides on the collection file from T1 #1.

### Suggested sequencing (work packages)

1. **WP1 Save integrity** — collection export/import + modals replacing
   prompt/alert/confirm + exit guard. Pure web work; ships value on Pages now.
2. **WP2 Settings & display** — persisted settings panel (volume, font scale,
   colorblind palette, reduced motion) + fullscreen.
3. **WP3 Wrapper shell** — Electron + steamworks.js, custom protocol,
   embedded scenarios fallback, Steam Cloud, achievements skeleton.
4. **WP4 Game-ification** — objective checklists from expects_species,
   milestones → achievements, tutorial rework (already planned).
5. **WP5 Store readiness** — screenshot mode off the 3D renderer, sonifier +
   Zen trailer, capsule art, page copy.

---

## Recommended cross-metric sequencing

The three axes intersect at one place: **fix §1.3 (competition cell-key) and
§2.1 (PWP Ea pairing) as one calibration-rebake arc**, since both rebake
baselines and both plausibly move the §2.3 stale-species list — then re-run
the stale sweep and tune what's still stale (vugg-tune-scenario). The §1.5
scenario fix rides cheap alongside. The narrator/spec one-liners (§2.4) are an
afternoon of SIM-NEUTRAL edits. Steam work (WP1–WP2) is independent and can
interleave — it ships player-visible value on Pages immediately, consistent
with ship-content-on-stable-infra sequencing.
