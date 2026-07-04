# SPECIMEN DIGITIZATION — the template + the pipeline

**2026-07-03 · implements roadmap W-A rung A2 (capture protocol) + A3's input contract ·
answers `ROSE-ENGINE-MICROSCOPE-2026-03-11.md` open question #1 (design mirrored in-tree) ·
research-verified this session (4-agent sweep, fetched sources) · boss ask: "a template for
turning images of crystals into the kind of data you need to grow those crystals… if we have
thousands of crystals to document we need a way to streamline processing… talking about a rock
usually takes 3-4 rounds of back and forth and usually 20ish pictures… UV light doesn't show
up well on camera."**

## 0. The problem, sized honestly

Today's per-rock cost: ~20 photos (macro + micro + UV) and **3–4 rounds of dialogue** — and the
dialogue is the expensive part, because it's the boss's time. At catalog scale (1,217) that's
~4,000 rounds; at collection scale (~6,000) it is unaffordable, full stop. The fix is not
faster conversation — it is **making the conversation unnecessary**: a template whose slots are
named in advance, an agent pass that fills every slot it can from the photo dump, and ONE
consolidated gap list per LOT instead of per-rock rounds.

Three design decisions carry the whole thing:

1. **Tiered depth** — not every rock earns 20 photos. The Smithsonian digitizes ~155M objects
   this way: mass 2D throughput for everything, selective 3D for the few, "Item Driven Image
   Fidelity" per object (dpo.si.edu, fetched). Full 3D for everything is a fantasy at any budget.
2. **Dialogue compression** — named slots + evidence levels + one gap pass. The only prose
   field is the one worth human words: the rock's BIOGRAPHY (the ontogeny read).
3. **Capture-source agnosticism** — the same template is filled by iPhone-in-hand today and by
   🪨's Eyes (the rose engine) tomorrow. The rig changes fill RATE and QUALITY, never record
   shape. That answers the rose-engine design's open question #1: **output = this record,
   JSON, one per specimen, photos referenced by slot.**

## 1. The tiers (the scale answer)

| tier | who gets it | what's captured | per-rock cost | count target |
|---|---|---|---|---|
| **S — survey** | every specimen | identity + 3 overview shots (scale card) + UV eye-read + one-line biography | ~5 min | thousands; lot-batched (a flat = one session) |
| **D — document** | anything interesting: display pieces, odd habits, teaching rocks | the full slot manifest (§3): ~20 named shots incl. face-on macros, micro series, contact scar | ~20–30 min | hundreds, accreting |
| **B — bench** | the W-A anchors | Tier D + measured metrics WITH error bars (A3) + grow-mapping (§2 block G) + eventual 3D | hours each | ~24 now, grows slowly |

Tier is a FIELD on the record and upgrading is additive — a Tier-S rock that turns out to
matter gets its missing slots shot later; nothing is redone. **The bench needs ~24 great
records, not 6,000 mediocre ones** — mass coverage is Tier S's job, fidelity is Tier B's, and
conflating them is how digitization projects die.

## 2. The record (the template itself)

One JSON record per specimen; catalog `id` is the join key (never the sticker). Five blocks.
**Every field carries an evidence level: `measured` | `eye_read` | `inferred` | `unknown`** —
an honest `unknown` beats a confident guess, and the gap list is simply the query for
`unknown`s worth asking about.

```jsonc
{
  "specimen_id": 812,                     // catalog join key (THE id, not sticker text)
  "lot_id": "TN557",                      // lot fields inherited, asked ONCE per flat
  "tier": "D",
  "identity": {
    "species": [{ "value": "fluorite", "source": "boss", "evidence": "eye_read" }],
    "variety": null,
    "sim_key": "fluorite"                 // via the A1 bridge table
  },
  "capture": {                            // the slot manifest (§3); per slot:
    "OV-1":  { "img": "photos/812/a3f2.jpg", "device": "iphone", "scale_ref": true, "usable": true },
    "HERO-1":{ "img": "photos/812/9c11.jpg", "device": "iphone", "scale_ref": false, "usable": true },
    "UV-365":{ "img": null, "eye_read": { "hue": "blue-white", "intensity": 2, "distribution": "even",
               "afterglow": { "hue": "green", "duration_s": 2 } } },
    "UV-310":{ "img": null, "eye_read": { "hue": "none", "intensity": 0 } },
    "UV-255":{ "img": null, "eye_read": { "hue": "cream", "intensity": 1, "distribution": "zoned" } }
    // …missing slots simply absent; completeness is computable
  },
  "measurements": {                       // block M — A3 fills this; every value + error + provenance
    "dims_mm": { "value": [42, 31, 27], "err": 1, "from": "OV-1", "evidence": "measured" },
    "cielab":  { "value": [78.2, 1.4, 9.8], "from": "CAL-1", "evidence": "measured" },
    "interfacial_angles": [ { "faces": "cube-octahedron", "deg": 125.3, "err": 2.0, "from": "FACE-2" } ],
    "fluorescence": { "365": { "hue": "blue-white", "intensity": 2 }, "255": { "hue": "cream", "intensity": 1 } },
    "flags": { "twin": false, "phantom": true, "etched": false, "contact_scar_visible": true }
  },
  "grow": {                               // block G — the sim-facing payload ("data to GROW it")
    "scenario_claim": "mvt_elmwood",      // which scenario claims this rock, or null + why
    "wulff_form_guess": { "forms": ["cube", "octahedron"], "trunc_est": 0.15, "evidence": "inferred" },
    "chromophore_hypothesis": { "value": "Y+organics purple", "evidence": "inferred" },
    "classifier_tags": ["zoned", "phantom"],
    "biography": "Grew as cubes, a purple zone mid-life, corner truncations late; one face
                  carries a neighbor's contact scar — grew crowded, freed by collapse.",
    "bench": { "is_anchor": true, "held_out_metrics": ["cielab"] }
  }
}
```

Block G is the point of the whole template — **the data you need to GROW the crystal**: which
scenario claims it, what form weights reproduce it, what colours it, what its texture flags
demand of the classifiers, and the biography paragraph — the distilled version of what those
3–4 dialogue rounds used to produce, written ONCE, kept forever. The per-wavelength UV eye-read
with afterglow is modeled on the Fluorescent Mineral Society's own specimen database (FMDB,
uvminerals.org, fetched) — **recording the human observation as the datum is the collection
standard**, not a shortcut.

## 3. The slot manifest (the "20ish pictures", named)

Tier D's full list; Tier S uses only OV + UV + CAL. Every slot has a purpose a tool consumes —
no orphan beauty shots (those are welcome; they're just not slots).

| slot | what | consumed by |
|---|---|---|
| OV-1..3 | overview front/back/top, scale card in frame | dims, CSD counts, habit |
| CAL-1 | grey card + scale card under the session's light | CIELAB truth for the whole session |
| HERO-1 | termination face-on macro | T2 form metrics, Wulff comparison |
| FACE-1..6 | face-on macro per measurable face (as available); shared edge parallel to sensor, longest focal length available | interfacial angles (~1–3° from imaging — see §4), asymmetry index |
| BASE-1 | the attachment scar / contact side | ontogeny: contact fraction, half-form truth |
| MICRO-1..4 | Andonstar surface texture (striations, hillocks, etch, inclusions); focus-stacked where depth demands (free: CombineZP/Enfuse) | W-C/W-F texture flags |
| UV-365/310/255 | photo optional, **eye-read REQUIRED** (hue, intensity 0–3, distribution, afterglow) | D4 fluorescence; the eye-read IS the datum (§5) |
| CTX-1 | lot/flat group shot | lot inheritance, W-J pocket correlation |

Session discipline (the museum lesson — Fraunhofer CultArm3D's separator between archive-grade
and hobby capture is DISCIPLINE, not optics): manual exposure + white balance locked, one CAL-1
per lighting setup (not per rock), lot fields asked once per flat, identical pose set per
specimen. A session is "shoot the list for N rocks, dump the card, done" — no naming, no
captioning; the agent pass does the sorting (slot classification from content + EXIF + order).

## 4. Measurement honesty (what photos can and cannot give)

From the morphometry sweep, so A3's expectations are set correctly from day one:

- **Aspect ratios / size / CSD: solved.** Industrial crystallization CV does exactly this
  (segment → oriented bounding box); clean silhouettes are the only hard part. For plate
  populations, 2D counts must go through stereological correction — CSDSlice (Morgan & Jerram
  2006) for the 3D habit estimate, then Higgins' CSDCorrections (mdhiggins.ca, fetched) — never
  read 2D lengths as 3D sizes.
- **Interfacial angles: ~1–3° from imaging, never arc-minutes.** Reflection goniometry owns
  precision; a photo cannot match it, and 1–3° still separates major forms. Single oblique
  photos are NOT trusted (foreshortening) — either the FACE slot discipline (shared edge
  parallel to sensor plane, long lens) or multi-view backprojection when D2 lands.
- **Colour: CIELAB off the CAL-1 grey card, RAW, fixed WB** — the same discipline as the
  optics arc's source column.

## 5. UV — the honest answer to "doesn't show up well on camera"

**Tonight: the eye-read is the datum.** FMDB records per-wavelength hue, brightness, and
afterglow as contributor observations — the template's UV fields are exactly that structure.
Your eye under the lamp in a dark room is a better instrument than an unfiltered phone camera.

**When photos are wanted, it's a filter problem, and it's solved** (Nature's Rainbows +
uvminerals.org, both fetched):

1. **Filter the LAMP (exciter):** the camera sees the source's visible violet leak far more
   strongly than your eye does — that's the washout. 365nm: Wood's glass/ZWB2 or a filtered
   Nichia-LED torch; never a bare blacklight tube. 254nm: Hg lamp + Hoya U-325c — and treat
   that filter as a CONSUMABLE (it solarizes; cheap ZWB3 loses ~50% transmission in its first
   100 hours; the U-325c holds ~84% past 2,000).
2. **Filter the LENS (barrier):** a UV/IR-cut filter blocks reflected UV fogging the sensor —
   and test the filter under your own lamp first, because some filters themselves fluoresce.
3. **Darkroom + tripod + ISO 100 + f/11 + 1–8s manual exposure**, focus locked under white
   light first, RAW with WB fixed in post, expose so green/yellow responses don't clip.
4. **Safety, which the hobby lamp pages omit:** 254nm causes photokeratitis and skin burn —
   UV-blocking eyewear, covered skin, ozone-free lamps or ventilation.
5. **Full-spectrum camera conversion is NOT step one** — visible fluorescence photographs fine
   on a stock camera once the filters are right; conversion buys reflected-UV work and deep-red
   response later, and then REQUIRES the barrier filter even more.

**The rig answer:** 🪨's Eyes solves UV structurally — dark enclosure, fixed camera, per-λ LED
cycling at locked position (the Spectral routine) → the 365/310/255 set registered
pixel-for-pixel against the visible shot: the catalog's planned 4-up viewer format, automated.

## 6. The hardware ladder (D0 → D3)

| step | what | cost | what it buys |
|---|---|---|---|
| **D0 — now** | template + slot list with current gear (iPhone + Andonstar + handheld UV lamps) | $0 | the dialogue compression, immediately; archive photos become slot-classifiable |
| **D1 — the jig** | manual turntable + phone mount + fixed lights + scale/grey card FIXED to the stage; cross-polarization pair (linear film on lights, CPL on lens, crossed to darkness) | ~$30–60 | calibration becomes constant; speculars die at capture time — the single highest-value optical upgrade for shiny specimens (pix-pro, fetched) |
| **D2 — software 3D** | turntable series → SfM photogrammetry (Meshroom/COLMAP, free) for OPAQUE anchors: uniform keyable background, ImageMasking node on EVERY frame, FeatureMatching "Minimal 2D Motion" = 2px (the documented turntable workflow, meshroom-manual fetched) | $0 | true meshes for opaque bench anchors; scale pinned by caliper/scale-bar, never the depth channel |
| **D3 — build 🪨's Eyes** | the rose engine as designed (~$220–280, most "have" items in hand) with §7's refinements | ~$250 | Tier-D capture at Tier-S cost: the Survey/Document/Investigate/Spectral routines fill the slot manifest automatically |

**The translucency truth, stated once for the whole ladder** (this collection's water-clear
species are the documented worst case for EVERY 3D modality): laser/structured-light
triangulation reads translucent surfaces displaced/blurred (subsurface scattering — Gupta et
al. CVPR 2011: phase-shifting fails on translucent, Gray codes fail on shiny interreflections;
marble is their demo case); SfM loses flat glassy faces to sliding speculars. Cross-polarization
kills the speculars but does NOT make a clear crystal reconstructable. **Coating/matting sprays
are OFF THE TABLE on specimens** — "residue-free" marketing does not clear the conservation bar
for porous/soluble species; a rock that can't be captured optically is logged `3D-deferred`,
never sprayed. Water-clear anchors get 2D metrics + eye-read geometry, honestly flagged.

## 7. The rig designs, evaluated

**🪨's Eyes (the rose engine) — build it, with four research-informed refinements.** The design
has a direct open-source precedent that validates the whole geometry: **OpenScan Mini**
(openscan-org.github.io, fetched) — specimen turntable + camera on a rocking rotor arm, Pi
camera, ~0.02mm claimed on 8–10cm objects. Refinements to fold into the build:

1. **Mount the LED ring ON the pendulum arm with the camera** (OpenScan's arrangement):
   light–camera geometry stays constant across every pose — calibration survives the swing.
2. **Trigger at the swing apex.** Machine-vision strobe practice (Advanced Illumination,
   fetched): pixel blur = tip speed × pulse width ÷ mm-per-pixel; at the pendulum's extremes
   velocity passes through ZERO — triggering there buys an order of magnitude for free, and the
   design already notes the arc "decelerates at extremes (most useful)". Keep pulses 100–500µs,
   duty cycle <1% if overdriving.
3. **Polarizer mounts rotatable and indexed, not glued:** crossed for photogrammetry passes
   (kill glints); parallel/difference if a structured-light pass is ever added for clear
   specimens (the two regimes use the SAME hardware in opposite orientations).
4. **Skip the laser line scanner** (rockbot's sketch included one): it's the weakest component
   for THIS collection — translucent minerals are its documented failure mode (§6). Photogrammetry
   + cross-pol is primary; structured light only ever with engineered pattern ensembles, later.

**rockbot's mirror/helicoid manifold — real, citable, and correctly deferred to software.**
Kaleidoscopic single-shot multi-view is established CV prior art: Reshetouski, Manakov, Seidel
& Ihrke, CVPR 2011 (fetched — hemisphere coverage in one shot, perfectly synchronized,
radiometrically identical views) through Neural Kaleidoscopic Space Sculpting, CVPR 2023 (CMU,
fetched — full-surround reconstruction from ONE kaleidoscopic image via neural surfaces). The
practical read: the optics are simple (first-surface mirrors + calibration bead); the work is
software, and the software is swappable — **captured kaleidoscope frames are the archival
asset**, reconstructable by better pipelines later. That is the progressive-refinement
philosophy in hardware form, and it composes with the rose engine rather than competing
(a mirror chamber is an attachment, not a rival rig). rockbot's three "what would actually be
new" points stand confirmed: the hardware exists; the innovations are mineral-specific
calibration, sim-parameter integration (THIS template), and the manifold-as-data-structure.

## 8. The ingest flow (where the 3–4 rounds go to die)

1. **Shoot** the slot list (or dump archive photos — the agent slots what it can).
2. **Agent batch pass** (per lot): classify images into slots, fill measurements where slots
   allow, draft block-G hypotheses, compute completeness.
3. **ONE gap list per lot**, numbered, answerable in one sitting: "812: species confirm? 817:
   which side was attached? lot: locality county?" Unanswered gaps stay `unknown` — honestly.
4. **Derived rows flow to the bench** (specimen-anchors.json) for Tier-B rocks only.
5. **Boundary** (standing privacy rule): raw photos + valuations + provenance stay
   catalog-side, LAN-only. The vugg repo receives id / species / locality / measurements /
   grow-block. Never the ledger, never the photos.

**Pilot before protocol-final:** run the agent batch pass on ONE existing lot from the
snapshot — the Thompsonite flat (ids 1200–1223, 24 rocks, already photographed) is the natural
candidate — and let its slot-fill rate and gap-list quality tune the template before any new
shooting is asked of the boss.

## 9. Risks + blind spots

1. **The boss's shooting time is the scarce resource** — everything here exists to spend less
   of it per rock. If the template ever ADDS friction, the template is wrong; Tier S must stay
   a 5-minute pass.
2. **Archive photos are heterogeneous** — the agent pass will slot maybe half; fine.
   Completeness is a field, not a gate.
3. **Anchor quality > mass quantity.** T2 lives or dies on ~24 great records; don't let the
   thousands crowd out the two dozen.
4. **Consumables are real but small**: ZWB2 film is cheap; the Hoya U-325c (SW) is the one
   real filter spend and it wears out by design.
5. **I still haven't seen the photo archive's actual quality** — the §8 pilot exists precisely
   to correct this blind spot before protocol is declared final.
6. **Digitization must not become a second catalog project** — this template is a vugg-facing
   CONTRACT; the catalog's own schema evolution (lots, assertions) proceeds on its own track,
   and the two meet only at the ingest boundary.
7. **UV safety** is the one place the hobby sources are silent and this doc is not: 254nm work
   means eyewear, covered skin, ozone-free lamps or ventilation — non-negotiable, and doubly so
   when the rig automates lamp cycling near a human loading specimens.
