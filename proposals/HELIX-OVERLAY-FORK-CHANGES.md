# Helix Overlay — Fork Changes Breadcrumb

> **Audience:** Whoever merges `multidimensional-space-simulator` back
> into `vugg-simulator` (or pulls the helix overlay across as a feature).
> Boss has flagged this as a known-hard merge in advance, so every
> change site is bracketed in source with a greppable marker and
> catalogued here.

---

## Fork point

This fork branched from `vugg-simulator @ 7157fea` (commit `d4a6205`
in this repo: "initial: fork from vugg-simulator @ 7157fea"). Every
commit after `d4a6205` on `main` is a helix overlay change. Run

```sh
git log --oneline d4a6205..HEAD
```

to see the full v0 → v17 arc. The commit messages are dense; read them
in order if you want the design rationale for each layer.

---

## How to find every fork addition in source

```sh
git grep "HELIX-OVERLAY-FORK"
```

Every fork-only block in shared files is bracketed with:

```
// === HELIX-OVERLAY-FORK ADDITION (vNN) ===
...
// === END HELIX-OVERLAY-FORK ADDITION ===
```

(or the HTML/CSS equivalent). The all-new file
`js/99j-helix-overlay.ts` has a single marker at the top of the file
covering its entire body. The marker is intentionally verbose so it
shows up cleanly in 3-way merge tools alongside the surrounding
parent-line context.

---

## Files modified (vs. fork point)

```
 index.html                | 1321 +++++++++++++  (regenerated from sources + hand edits)
 js/85c-simulator-state.ts |    9 +++             (one snap-field addition)
 js/99i-renderer-three.ts  |   18 ++++++          (three small additions)
 js/99j-helix-overlay.ts   | 1262 ++++++++++++++  (NEW FILE, fork-only)
 package-lock.json         |    4 +-              (incidental npm install drift)
```

`index.html` is a generated artifact: the JS bundle between
`// === BUILD:bundle:start ===` and `// === BUILD:bundle:end ===`
is rewritten by `tools/build.mjs` from `dist/**/*.js`. The button +
legend `<div>` + `.helix-legend*` CSS are HAND-EDITED outside those
markers and survive rebuilds. During a merge, **rebuild rather than
merge `index.html` line-by-line** — merge the sources and let the
build produce the right bundle.

---

## Site-by-site detail

### 1. `js/99j-helix-overlay.ts` — new file (entire body, v0–v17)

Holds the helicoid geometry, trail buffers, per-frame spin tick, and
all the v12–v17 user-facing features. Loaded by the standard build
pipeline because of the `99j-` prefix (concatenated after the rest of
the JS bundle).

External symbols it depends on from the parent project:

- `THREE` (global, loaded by the index.html script tag)
- `_topoThreeState` (declared in `99i-renderer-three.ts`)
- `_topoRenderThree` calls `_topoHelixOverlayDraw(...)` once per frame
- `topoRender()` (global topo redraw entry point)
- `THREE.BufferGeometry`, `THREE.LineSegments`, `THREE.MeshBasicMaterial`,
  `THREE.LineBasicMaterial`, `THREE.Group`, `THREE.Mesh`,
  `THREE.BufferAttribute`, `THREE.DynamicDrawUsage`, `THREE.DoubleSide`
  (all standard three.js)

External symbols it exposes to the parent project:

- `helixOverlayToggle()` (called from `#helix-overlay-btn`'s `onclick`)
- `_topoHelixOverlayDraw(state, sim, wall)` (called from
  `_topoRenderThree` in `99i-renderer-three.ts`)

If you're moving this file across to vugg-simulator, no edits needed
inside the file — it's self-contained.

### 2. `js/99i-renderer-three.ts` — three small additions

| Site | Lines (post-fix) | Purpose |
|-----|-----|-----|
| `_emitClusterSatellites` `satMesh.userData` | ~2141 | Stamps `naturalOpacity` on satellites so v13 sweep-writes-crystals can restore them when overlay toggles off |
| `_topoSyncCrystalMeshes` `mesh.userData` | ~2610 | Stamps `naturalOpacity` on parent crystal meshes (1.0 ordinary, 0.42 perimorph cast) for the same reason |
| `_topoRenderThree` (after `_topoApplyCameraFromTilt`) | ~2862 | The integration hook — calls `_topoHelixOverlayDraw(state, sim, renderWall)` once per frame. Defensive `typeof` check so the bundle still boots if `99j` is removed during a merge |

All three are 1–10 lines of additions to existing structures. None
modify existing behavior — they only add fields/calls. Merge conflict
risk: low (additions inside existing object literals + one new
function call between two existing ones). The fork markers make the
boundaries unambiguous to a 3-way merge tool.

### 3. `js/85c-simulator-state.ts` — one snap-field addition

| Site | Lines (post-fix) | Purpose |
|-----|-----|-----|
| Inside the `snap` object literal in the wall-state snapshot push | ~286 | Adds two fields: `ring_fluids` (cloned per-ring fluid array) + `ring_temperatures` (sliced array). Sources the v15 rate band's scenario-time Δr |

Storage cost (documented in the comment): ~90 KB beyond the existing
v66 schema for a 120-step MVT run, ~190 KB for a 2400-step pegmatite.
Acceptable for in-memory replay. If the parent project tightens its
snapshot budget after this fork was branched, this is the field to
trim or stride.

Merge conflict risk: low — straight addition inside the object literal.
The parent's `snap` shape evolves over time (v66 schema, v67 stride
decimation, etc.), so a future evolution of the snap could touch the
same area; the fork markers tag what's mine.

### 4. `index.html` — three hand-edited regions

| Region | Lines (post-fix) | Purpose |
|-----|-----|-----|
| `.topo-camera-ctrls` button row | ~2967 | Adds the `<button id="helix-overlay-btn">⌇</button>` toolbar toggle |
| Inside `.topo-body` after `.topo-canvas-wrap` | ~2999 | Adds the `<div id="helix-legend">` sidebar (populated at runtime by the helix module) |
| Style block after `.topo-canvas-wrap` rule | ~438–541 | All `.helix-legend*` and `.legend-mode*` CSS — sidebar layout, header buttons, per-row swatches, focus-mode pills, hover/off states |

These are NOT regenerated by `tools/build.mjs`. They live directly in
`index.html` and survive rebuilds. Merge them as ordinary HTML/CSS.

The JS bundle inside `index.html` IS regenerated by the build, so
don't merge the bundle bytes — merge the sources under `js/` and run
`npm run build` to produce a fresh `index.html`.

---

## Suggested merge procedure

1. `cd` into the vugg-simulator working copy. Branch off `main`.
2. Copy `js/99j-helix-overlay.ts` across wholesale.
3. Apply the three `99i-renderer-three.ts` additions (greppable via
   the fork markers). Each is a small additive change — should
   3-way-merge cleanly.
4. Apply the one `85c-simulator-state.ts` snap-field addition (same
   pattern).
5. Hand-merge the three `index.html` regions (button, legend div,
   CSS block). All bracketed with fork markers in the source HTML.
6. Run `npm run build && npm run typecheck && npm test`. The fork's
   1370-test baseline passes; if any test fails, the most likely
   suspect is the snap-field addition (parent might have evolved
   the snap schema in a conflicting way).
7. Smoke-test in browser: load `index.html`, click ⌇ in the topo
   toolbar to turn the helix overlay on. Legend appears with 47
   params in 3 sections. The cavity hides, the helicoid spins, the
   wall trail tapers at the poles.

---

## Design rationale — read the commits

Each commit message in the v0–v17 arc carries the why for that
slice. The most informative ones for a merger:

- **v8** (`1e9b849`) — final geometry decision: stacked radar screens
  offset to form a helicoid. Boss's verbatim model is in the file
  header comment.
- **v10** (`95e58a4`) — decision to hide cavity + crystals during
  overlay (later refined by v13).
- **v13** (`e0f60d1`) — sweep-writes-crystals visibility mode
  (replaces v10's blanket hide). Most of the renderer-three.ts diff
  comes from this slice.
- **v15** (`5e41e4b`) — scenario-time replay + per-ring chemistry
  history. The `85c-simulator-state.ts` change is here. This commit
  is where the helicoid stops being a frozen-snapshot reader and
  becomes a "the entire scenario in one revolution" instrument.
- **v17** (`ceff566`) — wall-distance lateral-vs-radius bug fix
  (boss caught this watching v15+ run). Also fixed a latent
  `polarProfileFactor` `this`-binding bug in the v15 snap proxy
  that v17 was the first thing to trigger. Both bugs called out in
  the commit message.

If you only have time to read three commit messages, read v8, v15,
and v17. They cover (a) the geometry the whole thing is built on,
(b) the data-substrate move that unlocked the activity model, and
(c) the gotcha that previous merge attempts hit.
