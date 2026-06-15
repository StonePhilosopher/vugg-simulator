# BUG: Crystals can grow past the cavity wall (`feldspar #7` is bigger than its vug)

**Filed:** 2026-05-06
**Reporter:** boss (visual catch — "I mistook the vug for an overgrowth")
**Severity:** content + visual; not a crash
**Status:** ✅ RESOLVED (by-design) as of 2026-06-15 — see the resolution
banner immediately below. The original lateral-burst case is gone; what
remains (crystals exceeding the wall in the *model*) is intentional
post-v61 "defer to geology" and handled visually by the per-cell clip.

---

## ✅ RESOLUTION — 2026-06-15 (re-verification; boss: "much less noticeable these days")

The body of this doc (everything below this banner) is preserved as the
historical record, but the bug as filed is **resolved**. Three
independent lines of evidence:

**1. The fix shipped, then the sim half was deliberately reverted.**
- **v59** added the exact per-crystal cavity cap this doc requested
  (`add_zone` capped `c_length ≤ vug_radius`, `a_width ≤ vug_diameter`).
- **v60** added the **renderer per-cell cavity clip** (commit `4fb128f`),
  replacing the single-scalar `uVugRadius` whose equatorial-only bound
  caused the polar-gap leak documented in the 2026-05-06 stress-test
  update below.
- **v61** then **removed the v59 cap** per the boss directive *"when in
  doubt, defer to the actual geology"*: real crystals in tight cavities
  compete, deform, or push into host rock — they don't magically halt at
  a wall. So the sim now renders chemistry-true sizes and the per-cell
  clip slices whatever's past the local wall. Calibration drift was
  **zero** (the cap only ever touched rendered `c_length_mm`/`a_width_mm`;
  mass balance uses `zone.thickness_um`). See `js/15-version.ts` v59–v61.

So a crystal *exceeding* the wall in the model is now **intentional**,
not a bug.

**2. Headless measurement (SIM 195, seed 42, all 33 scenarios).**
47/1143 crystals (4.1%) exceed the wall in the model, across 18/33
scenarios — all by design. Crucially, **the originally-reported failure
is gone**: it was a *lateral* tabular burst (feldspar a-axis = 1.5×c
punching sideways). Today gem_pegmatite's feldspar is a platy
cleavelandite at **lateral 0.95×** the radius — right at the wall, not
through it. Every remaining overshoot is **axial** — long acicular /
fibrous / rosette habits (selenite, aragonite columnar) extending along
their *length* (c-length 2–3× radius), exactly the "selenite sword" case
this doc flagged as the hard one.

**3. Visual confirmation (browser, supergene_oxidation seed 42, 3D view).**
The two worst offenders fleet-wide — selenite rosettes at 144 mm and
132 mm c-length in a 62 mm vug radius (2.3× / 2.1×) — render as
**wall-coating rosettes** (`vector: coating`), spread over the cavity
surface, NOT as single wall-piercing swords. No crystal dominates or
engulfs the cavity; the "I mistook the vug for an overgrowth" effect is
absent. At most a few crystal tips graze slightly past the hull at the
edges (the known polar-gap limitation from the renderer's spherical
bound), nothing like the filed report.

**Remaining open sliver (minor, deferred):** the renderer's polar-gap
leak — Options A/B in the 2026-05-06 stress-test update below
(per-ring `uVugRadiusByRing` or a cavity SDF). It only affects
sub-equatorial crystal fragments at non-spherical hulls and is a
documented limitation, not the filed bug. Low priority unless a boss
visual catch resurfaces it.

---

## Summary

In a 50 mm pegmatite vug, `feldspar #7` (tabular habit) grew to
`37.0 × 55.5 mm`. Its **a-axis is 5.5 mm wider than the cavity's
diameter**, and the crystal alone occupies **91.2% of the vug volume**
(by the simulator's own `(4/3)π × c × a²` formula). The mesh literally
bursts through the cavity wall — the renderer faithfully draws the
out-of-bounds geometry, and to the eye the feldspar tablet looks like
the host structure with the vug embedded inside it.

This is the diagnostic visual report — the cavity and the crystal
should not be confusable.

## Repro

| Parameter | Value |
|---|---|
| `SIM_VERSION` | 53 |
| `archetype` | `pegmatite` |
| `seed` | `1778042424470` |
| Steps run | 175 |
| `vug_diameter_mm` | 50.0 |
| Total crystals | 23 |

Steps:
1. Reload the page (`http://localhost:8000/index.html`).
2. Quick Play: pick the Quick Play button on the Home screen with the
   default scenario (this run picked `pegmatite` archetype, seed
   `1778042424470`).
3. Switch to 3D view (the `⬚` button in the topo controls).
4. Zoom out to ~33–47% to see the whole cavity.

Observed: a large blue tabular crystal (feldspar #7) larger than the
cavity, with the cavity surface visible through it.

## Diagnostic numbers

```
feldspar #7 — tabular habit
  c_length_mm      = 37.01
  a_width_mm       = 55.51                  (= 1.5 × c, per habit dispatch)
  total_growth_um  = 37005.59
  zones            = 99                     (kept growing for 99 steps)
  ring             = 11
  cell             = 32

vug
  vug_diameter_mm  = 50.0
  vug_radius_mm    = 25.0
  vug_volume_mm³   = 65,450

feldspar #7 volume (ellipsoid (4/3)π × c × a²)
                  = 59,701 mm³           (91.2% of cavity volume)

bursting checks
  c_length > vug_diameter      ? false  (37 < 50)
  a_width  > vug_diameter      ? TRUE   (55 > 50)
  a_width × 0.5 > vug_radius   ? TRUE   (27.7 > 25.0)
```

The lateral extent of the tablet bursts through the wall. The c-length
also exceeds the vug radius (would clear the wall on the opposite side
of a perfectly inward growth direction), but the immediate visible
issue is the lateral burst.

## Root cause

Two layered issues, both real:

### 1. (sim) No per-crystal cavity-bound check

`get_vug_fill()` in [js/85c-simulator-state.ts:190-202](js/85c-simulator-state.ts:190-202)
sums all crystal volumes and halts ALL growth at the global 100% mark.
But individual crystals can grow past the wall before the global cap
trips, and once they're over they stay over. There is no per-crystal
size cap derived from the cavity geometry.

For tabular crystals specifically, [js/27-geometry-crystal.ts:118](js/27-geometry-crystal.ts:118)
sets `a_width_mm = c_length_mm × 1.5`. So a tabular crystal whose
c-length exceeds `vug_radius / 0.75` (≈ 33 mm in a 50 mm cavity) will
have its lateral extent clip the wall, regardless of cavity-volume
budget.

### 2. (renderer) No clip volume against cavity

[js/99i-renderer-three.ts:1116-1122](js/99i-renderer-three.ts:1116-1122)
positions and orients each crystal mesh using the wall-anchor cell, the
substrate normal, and the crystal's c/a dimensions. There is no test
against the cavity geometry — if the scaled mesh extent exceeds the
cavity boundary, the mesh draws outside the cavity surface. The
cavity mesh itself doesn't act as a stencil/clip volume.

## Severity & user-facing impact

- **Geological honesty:** broken. A real crystal cannot grow past its
  container — it self-terminates against the opposite wall. The sim
  produces shapes that don't exist in nature.
- **Player legibility:** broken in the way the reporter caught — the
  cavity becomes visually subordinate to its largest crystal. New
  players cannot tell which surface is the host vug and which is a
  guest crystal.
- **Volume accounting:** silently wrong. `get_vug_fill()` returns
  values consistent with the (oversize) crystal volumes, so the seal
  event fires correctly even though the geometry has already failed.
- **Affected scenarios:** any scenario with high-growth-rate engines
  in small cavities — pegmatite (kunzite, tourmaline, beryl,
  feldspar), porphyry quartz cores, single-large-crystal habits like
  selenite swords. Multi-crystal cluster scenarios less affected
  because volume budget gets eaten by many small crystals before any
  one bursts.

## Proposed fix (separate work item)

User-directed fix from the conversation: **the vug acts as a natural
slice — clip every crystal mesh against the cavity volume in the
renderer**. Anything past the wall is invisible.

Implementation tier preferred:

**Renderer-level clip via stencil buffer** — render the cavity inner-
surface mesh into the stencil buffer, then crystals only draw where
stencil = 1 (inside the cavity). Three.js supports
`THREE.AlwaysStencilFunc / THREE.ReplaceStencilOp` on materials. The
crystal data stays correct (still 37 × 55 mm in the model); the
visible portion is the in-bounds intersection. This matches the
reporter's natural-slice request — the cavity is the cleaver, the
crystal is what gets sliced.

This does not address the underlying sim issue (crystals shouldn't
grow this large in the first place), but it stops the visual lie and
restores cavity legibility immediately.

A follow-up sim-level fix should still cap individual crystal growth
when its bounding ellipsoid would push past the cavity wall — that
needs a SIM_VERSION bump (54+) and per-scenario calibration, since
limiting crystals' max size will redistribute fluid budget into other
crystals and shift baselines.

---

## Update — 2026-05-06: second canonical case

The renderer-clip band-aid does not catch all cases. Visual verification
of the paragenesis campaign (see HANDOFF-PARAGENESIS-VISUAL-VERIFICATION.md)
turned up a second instance:

| Parameter | Value |
|---|---|
| `SIM_VERSION` | 58 |
| Scenario | `supergene_oxidation` |
| Seed | `42` |
| `vug_diameter_mm` | 61.10 |
| `max_seen_radius_mm` | 63.80 |
| `clipUniforms.uVugRadius` | 51.53 |

| Crystal | habit | c×a (mm) | comment |
|---|---|---|---|
| selenite #6 | rosette | 56.7 × 28.3 | 93% of vug diameter; visibly extends past cavity wall |
| selenite #20 | rosette | 51.0 × 25.5 | 84% of vug diameter; same visual artifact |

Both are gypsum rosettes whose `_emitClusterSatellites` cluster pattern
(rosette `spreadMul`, large `parentAWid`) places satellite meshes far
laterally — and the parent-mesh body itself, scaled by `aWid=28.3`
laterally, has a footprint exceeding the cavity radius even though
`uVugRadius` (51.5) is correctly tracking the cavity hull. The fragments
past `uVugRadius` *are* discarded by the shader, but the visible part
of the parent rosette already extends past the cavity wall before the
clip kicks in (the clip can only hide what's outside the cavity hull,
not shrink the crystal back to fit).

Net: the renderer-clip is and remains a band-aid. The sim-side per-crystal
cap is the real fix. With two canonical cases (feldspar #7 in pegmatite
seed 1778042424470, selenite #6 in supergene_oxidation seed 42), there
are two regression tests for the eventual cap.

---

## Update — 2026-05-06: stress-test reveals the clip's geometric assumption

Forced fluorite #4 in mvt seed 42 to `c_length × a_width = 100 × 30 mm`
in a 50 mm-diameter (36.35 mm-radius) cavity — a crystal twice as long
as the vug. Visible result: a small purple "slice" of the cube remains
visible inside the cavity, plus a faint leak past the wall at non-
equatorial latitudes.

Confirmed the clip shader IS active and firing — setting `uVugRadius = 5`
correctly hides every crystal. So the discard runs. The leak is geometric:

- The cavity hull is **non-spherical** (polar profile squishes top/bottom
  via `wall.polarProfileFactor(phi)`).
- The clip shader uses a single scalar `uVugRadius` = max vertex distance
  on the cavity mesh — i.e. the equatorial bound.
- At sub-equatorial latitudes, the actual hull surface is closer to the
  origin than `uVugRadius`. Fragments past the real hull but inside the
  spherical bound pass the discard test → visible leak.

Two ways to upgrade the renderer-side (both deferred — sim-side cap is
the right answer):

  Option A: pre-bake a `uVugRadiusByRing[ringCount]` uniform array,
    sample by phi in the fragment shader, compare against the latitude-
    specific radius. Cheap; same shape as the cavity build.
  Option B: replace spherical bound with a SDF lookup of the cavity
    mesh. Heavier but accurate.

Until then the clip captures most of the oversized-crystal mass —
only the polar gap leaks. The current behavior is a documented limitation,
not a regression. Cluster-satellite spread is now bounded by the same
`uVugRadius × 0.4` cap (commit c53bb30).

## Related files

| File | Role |
|---|---|
| [js/27-geometry-crystal.ts:117-121](js/27-geometry-crystal.ts:117) | habit→aspect-ratio dispatch (tabular = 1.5× elongation) |
| [js/85c-simulator-state.ts:190-202](js/85c-simulator-state.ts:190-202) | `get_vug_fill` global volume check |
| [js/85-simulator.ts:115-137](js/85-simulator.ts:115) | vug-sealed event trigger |
| [js/99i-renderer-three.ts:1075-1099](js/99i-renderer-three.ts:1075) | per-crystal mesh scale + position + orient |
| [js/99i-renderer-three.ts:935-947](js/99i-renderer-three.ts:935) | cluster satellite mesh same |
