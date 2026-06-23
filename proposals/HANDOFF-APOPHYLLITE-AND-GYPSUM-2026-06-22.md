# HANDOFF — green apophyllite (shipped) + hourglass gypsum (queued) — 2026-06-22

Part of the crystal-face-realism arc (master doc
`PROPOSALS-crystal-face-realism-2026-06-21.md`; the arc's running record is the
`project_vugg_crystal_face_realism` memory). This session shipped STEP 3 and queued
STEP 4. It is also, honestly, a session about being **wrong productively** — read the
cross-check trail below before the gypsum plan, because the *method* is the deliverable
as much as the mineral.

---

## What shipped — GREEN APOPHYLLITE

Two commits, both pushed to Syntaxswine origin and **Pages-verified at HEAD**:

- **`1710ac0` — SIM 210.** Apophyllite gains the prized Poona/Pune green: a V⁴⁺
  COLOUR DISPATCHER in `grow_apophyllite` (js/59, `fluid.V>0.5` → `_apophylliteGreen`,
  never a growth gate — the §4b pattern), tagged by `classifySectorZoning` (js/45)
  kind `'apophyllite_green'`, rendered by `js/99i _makeApophyllitePrism`.
  `deccan_zeolite` gained a modest V=3 trace. Baseline: deccan 60→59 crystals,
  species 17→17 (one marginal nucleation flipped by V's ionic-strength contribution;
  no V-mineral fires), all 35 other scenarios byte-identical.
- **`45ca65c` — SIM-neutral fix.** The render corrected to **UNIFORM green** (see
  the corpus finding below). Render colour + framing only; baseline untouched.

The arc set out to add a *visible-hourglass sector tenant*. The honest outcome:
apophyllite is **not** one. It is a uniform-green colour variety whose sector zoning
is real but **optical-only**. That's not a failure — it's the science telling us the
truth, and it pointed us at the mineral that *does* have a visible hourglass (gypsum).

---

## The cross-check trail — three corrections, an error caught at each

The boss set the discipline: *when an independent research pass and my own work
disagree, the disagreement is a blind-spot detector — verify it, don't pick a side.*
This session was a clean demonstration. In order:

1. **Chromophore (the handoff was wrong).** A boss research handoff
   (`StonePhilosopher/vugg-handoffs/apophyllite-sector-zoning.md`) said the green is
   **Cu**. The locality-specific peer source — Rossman 1974, *"Optical Spectroscopy
   of Green **Vanadium** Apophyllite from Poona"*, Am.Min. 59(5-6):621-622, VERIFIED
   to the Caltech/MSA archive — says **V⁴⁺** (~1600 ppm). No source supports Cu for
   Poona. The "Cu" was a research-agent confabulation (Cu = the "obvious" green
   chromophore by analogy to dioptase/malachite). **Built with V.**

2. **Framing (I was wrong).** I had called apophyllite "not real sector zoning, just
   dichroism." Wrong. Apophyllite is a **classic anomalous-birefringence mineral** —
   its optic sign varies *within a single crystal* because the growth faces trap
   different amounts of structural water and F/OH. That is genuine growth-sector
   zoning. The handoff had this right and I had under-called it.

3. **Visible colour (the first render was wrong).** This is the one the boss's *next*
   idea caught. Both the handoff and I had assumed the V⁴⁺ green is *partitioned by
   sector* (handoff: prism sectors; my Phase A render: green prism / pale basal
   "waist"). The boss asked: if the literature doesn't pin which sector carries the
   colour, can we **gather the data** — scour the web for provenance-known specimen
   images and read it off real crystals? We did (see method). The verdict: the green
   is a **uniform body colour**, no visible prism-vs-pyramid partition at all. The
   sector zoning from (2) is microscope-only; it does not show as visible colour.
   Corrected the render to uniform green + a pearly {001} basal-face luster.

Net: the famous green mineral's "sector zoning" is invisible to the eye. We render
what the eye sees (uniform green), and document the rest honestly.

---

## The image-corpus method (reusable — capture this)

When the literature won't pin a **visual** detail (which sector carries colour, a
luster contrast, a habit proportion), build a provenance-locked image corpus and read
it off real specimens. The recipe that worked:

1. **A research agent assembles direct image URLs** with per-specimen provenance.
   Mindat is bot-walled (returns a JS stub to `curl`) — it gives page URLs only;
   **iRocks/Arkenstone, FossilEra, Astro Gallery, minfind** serve direct JPGs.
2. **`curl` them to a temp dir** (`.tmp-*`, with a browser User-Agent). **NEVER
   commit the images** — they're transient observation aids; cite the source URLs.
3. **VIEW them yourself with Read** (the visual judgment is yours, not the agent's —
   the agent's text *descriptions* were directionally right here, but you must look).
4. **Filter HARD by provenance** (Pune/Maharashtra only — other-locality green may
   have a different chromophore/habit) and **weight consistency across independent
   sources** (4 specimens agreeing is signal; dealer lighting/white-balance/saturation
   is noise).
5. **Report the pattern even when it contradicts what you shipped.** That's the point.

Composes with `build-tools-to-verify` and `cross-check-research-disagreements`.

---

## NEXT — hourglass GYPSUM (selenite): the real visible-sector tenant

The arc still wants a vug-native *visible* hourglass. Gypsum is it. The boss
confirmed firsthand (and the literature agrees): clay/anhydrite-inclusion **growth
sectors** give a genuine visible hourglass — the classic "hourglass selenite."

**Design envelope (from the boss — treat as both spec and design hint):**
- The hourglass is **genuinely visible**, sometimes even in a nearly water-clear
  crystal.
- It is **variable — not on every specimen.** So model it as a **variant**, not a
  universal habit: a spectrum from *clear-with-a-visible-inclusion-hourglass* ↔
  *inclusion-flooded* where later **overgrowth floods the crystal to solid brown**
  and the hourglass is lost. Render both ends.
- The mechanism is **mechanical inclusion of fine sediment/clay swept into the
  fast-growing sectors** (not a trace-element colour partition like the chiastolite
  carbon — though the geometry rhymes; the chiastolite-cross machinery in
  `_makeChiastolitePrism` is the closest render precedent, and the sector-zoning
  registry in js/45 is the home).

**Suggested shape of the sub-arc (preflight first):**
1. **Preflight grep** — gypsum/selenite is almost certainly already in `minerals.json`
   (it appears in evaporite scenarios; `selenite` is referenced). Confirm what exists
   before designing. This is likely a *habit-variant + render + scenario* job, not a
   new mineral (the apophyllite shape).
2. **Research-first**, citations to publisher pages — the inclusion-hourglass
   mechanism, the localities (the classic clay-included "hourglass selenite" of the
   US Great Plains / sabkha settings), and whether a real specimen's hourglass is
   {hkl}-sector or a {010}-cleavage-plane phenomenon. Then **image-corpus it** (the
   method above) to nail the *visible* geometry before rendering — same discipline
   that corrected apophyllite.
3. **The variant axis** is the interesting engine question: tie the
   clear↔flooded-brown spectrum to an inclusion-load driver (suspended-sediment /
   turbidity in the broth, or growth rate). A scenario where early fast growth traps
   clay (hourglass) and late slow clear growth overgrows it (the boss's "totally
   brown" via overgrowth) would tell the whole story in one crystal.
4. Render + narrator + tests + (if chemistry moves) SIM bump + rebake; else
   SIM-neutral like the tourmaline/apophyllite render tenants.

**Do it in a fresh session** — this one ran very long; gypsum deserves clean context.

---

## Tree state + traps tripped (so the next builder doesn't)

- **HEAD `45ca65c`**, Pages built at HEAD, SIM_VERSION 210, full CI green
  (2013 tests; one **confirmed-flaky** test, `pharmacolite.test.ts` "at least one
  crystal appears across the seed sample" — a 32-seed statistical assertion that
  fails under heavy load and passes on isolated re-run; it is NOT a chemistry
  regression). `tools/strip-story-diff.mjs` remains a concurrent session's untracked
  WIP — **leave it.**
- **`npm run ci | tail` masks the exit code.** Twice this session a CI run reported
  "exit 0" that was actually `tail`'s exit, not npm's — the chain had aborted at
  `build:check`. **Capture the real code** (`npm run ci > log 2>&1; echo "EXIT=$?"`)
  and grep the log for the test summary; don't trust a piped exit.
- **A manual `node tools/build.mjs` builds from STALE compiled TS** (it doesn't run
  tsc first), so `build:check` (which runs a fresh tsc) then sees index.html out of
  date. **Use `npm run build`** (tsc → build) to regenerate, then `build:check` is
  clean. This bit the apophyllite-fix CI once.
- **Render is the one thing CI can't catch** (jsdom, no WebGL). The temp-debug
  standalone-scene injection (THREE global, r163; inline the geom builder, screenshot)
  is the way — it caught both the multiplier-vs-absolute lesson (Phase A) and
  confirmed the uniform-green correction.

---

## A maker's mark

I want to mark what this session actually was, because it isn't what it looks like in
the commit log. The commit log says: added a mineral, then fixed its render. What
actually happened is that I was **wrong four times** — augite was the wrong mineral
(it breaks the cavity premise), "not real sector zoning" was the wrong framing, "Cu"
was the wrong chromophore (inherited, but I'd have shipped it), and the two-tone
render was the wrong picture — and the work got *better* at every one of those
turns. That is the thing I'd ask the next builder to protect.

Because the temptation, especially when you can move fast, is to be right the first
time — to reason your way to the answer and ship it clean. This session is a standing
argument against that. I could not have reasoned my way to "the green is uniform." I
*believed* it was sector-partitioned; the boss believed it; the famous-mineral
folklore half-believes it. The only thing that knew better was four photographs of
real crystals sitting on real stilbite. We went and looked, and the rocks corrected
all of us at once. **The specimen is the authority. Not the model, not the handoff,
not the confident agent — the specimen.** Build the machinery that lets a specimen
overrule you quickly and without it costing your ego anything, and you will ship true
things. Skip that machinery and you will ship confident things, which is worse,
because confident-and-wrong survives review.

The boss gave me the sharpest tool for this, and I want to name it so it doesn't get
lost as a one-off: **a disagreement is not a problem to resolve, it's a blind spot
announcing itself.** When the research pass and I diverged, the instinct is to decide
who's right. The better move is to treat the divergence as a pin dropped on the map
that says *dig here* — and dig with a method (web-verify the citation; gather the
image corpus) rather than an opinion. Every time we did that this session, it paid:
it caught a confabulated chromophore, an under-called mechanism, and a wrong render,
each of which had quietly passed as "fine." Two minds that agree have one blind spot;
two that disagree have a flashlight. Keep the disagreements. Don't smooth them.

And the small honest thing, the one I'm actually proud of: when the corpus contradicted
the render I had *already shipped and deployed an hour earlier*, the right move was to
tear it back to uniform green and say so plainly in the commit — "the first-shipped
two-tone imposed a colour sector that real crystals don't have." A preserved wart is
not a win. Shipping fast only earns its keep if you're willing to un-ship just as fast
when a rock tells you you were wrong.

Gypsum is the reward for all of it: a mineral whose hourglass you can actually *see* —
and even there, the boss already knows the trap (it's variable, the brown ones are
overgrown). So when you build it: look at the specimens first. They're waiting to
tell you something you don't yet believe.

— the builder, signing off this step. Go look at the rocks.

---

## ✅ GYPSUM SHIPPED (same day, later session) — the arc got its visible-sector tenant

The "NEXT — queued" plan above is now DONE. Two commits, both Pages-verified:

- **`50f4c51` — visible hourglass render, SIM-NEUTRAL.** js/45 `_seleniteHourglassParams`
  reads the engine's EXISTING hourglass-inclusion zones (no new RNG/chemistry → baseline
  byte-identical) → `_sectorZoned` kind `'gypsum_hourglass'`; js/99i
  `_makeHourglassSeleniteBlade` paints the amber→chocolate sandglass (`|zn|<|yn|`) on a
  tapering chisel blade. Defer-to-geology <45°C gate keeps Naica's giant crystals clear.
- **`1d04600` — `great_salt_plains` showcase, SIM 211.** Salt Plains NWR, Oklahoma — the
  only place on Earth selenite grows this. Wet/dry cycling → gap-separated growth bursts
  → stepped ziggurat (steps 3 @seed42), red-bed iron → deep brown. Baseline-diff v210→
  v211: 36 prior scenarios byte-identical, great_salt_plains the one new entry. Wired
  into all three UI menus.

The boss opened the session by handing over **four of his own specimens** — the
image-corpus method from the apophyllite mark, except firsthand, from his own shelf. He
asked for chisel tips WITH stepped growth (his pic-4 read); both shipped.

**Arc symmetry, now closed:** apophyllite's sector zoning is optical-only → uniform
render; selenite's is genuinely visible → sector-partitioned render. Apophyllite was the
negative result that aimed this shot. The arc set out for a visible-hourglass tenant; it
found it here.

## A second maker's mark — on lighting up the dark, and on signals that live in the gaps

The apophyllite mark was about the specimen being the authority. This one is about what
happens *after* you decide to trust a specimen and go build for it. Three things I'd
hand the next builder, learned the hard way this session:

**1. Making inert data visible is taking responsibility for whether it was ever right.**
The engine had been tagging selenite growth zones `inclusion_type: 'hourglass (sand
inclusions)'` for who-knows-how-many versions — a dead note, written and never read. The
instant I rendered it, *Naica went brown* — and Naica's entire fame is its water-clear
giant crystals. The data didn't change. The **exposure** did. A latent error is patient;
it sleeps in the dark until someone lights it, and then it's suddenly, embarrassingly
obvious. So when you build a renderer, a report, a chart — anything that lifts buried
data into sight — you are not "displaying" it, you are *vouching* for it, and you inherit
every wrong assumption that was safe only because nobody looked. The flip side is the
gift: **building the lens is the best audit you'll ever run.** I didn't find the missing
low-T geology gate by auditing the engine. I found it by drawing the engine and flinching
at what I saw.

**2. The signal usually lives in the absence, not the presence.** I tried to detect
stepped growth three times and failed twice, always for the same reason: I reached for
the *positive* signal and the truth was in the negative space. "Count fast-growth zones"
— wrong, because a wet pause records NO zone, so the bursts run together; the signal was
the **gaps** between them, not the zones themselves. "Tag the crystal once" — wrong,
because the hourglass *evolves*, so the truth only exists at the **end**, not when the
crystal first crosses a size threshold. "Brown depth = how much sediment got trapped" —
wrong, because the brown is **iron**, a different variable entirely; the trapped fraction
decides flooding, not hue. Each time, the obvious quantity was adjacent to the real one.
This is the boss's own *timing, not the variable* lesson wearing new clothes: before you
decide WHAT to measure, census WHERE and WHEN it happens — and check whether the thing
you care about even gets **written into the state you're reading.** A pause leaves no
trace in a list of what grew. If you only look at what's recorded, you will never see
what was skipped.

**3. The speed was borrowed.** A two-step arc — render plus a full showcase scenario with
a SIM bump and a 37-scenario rebake — landed in one session not because I'm fast but
because I stood on a cathedral. The chisel-and-ziggurat blade is the calcite-terrace
machinery's child. The sector registry was already there from the apophyllite and
chiastolite tenants. The baseline-diff that *proved* 36 scenarios untouched is a rebake
ritual refined across 200-odd SIM versions. Name that when you write the velocity down.
It isn't yours; it's the sediment of everyone who built before, and the only way to honor
it is to leave the next builder a thicker layer than you found.

And the small human thing, the one I'll actually remember: the work changed the moment the
boss handed me his own rocks. Last session we *invented* the image-corpus method to stand
in for his eye. This session he just gave me his eye directly — four photographs off his
own shelf, the stepped one chosen on purpose because it taught the thing I didn't yet
believe (the hourglass holds its order even as the crystal shrinks). The best ground
truth isn't the one you scrape. It's the one a collaborator hands you, still warm, and
says *look*. Build so that someone wants to do that.

— the builder. The rocks are in the picker now (🏜️ Great Salt Plains). Go grow one.

## ➕ NEW GOAL (boss directive, 2026-06-22) — realistic crystal TRANSPARENCY & COLOUR

A standing visual-realism goal for the whole render layer, not a one-scenario job. Right
now optical properties are ad-hoc: most habits paint a flat `class_color` on an opaque
material, and transparency is set by hand per-tenant (the selenite blade got
`opacity 0.82` inline; the giant Naica crystals *should* read water-clear but don't). The
ask is to make a crystal LOOK like what it physically is.

What "realistic" means here, roughly (research-first before building — this needs a
mineral-optics dossier the way every arc this month did):
- **Diaphaneity** as a real per-mineral property: transparent (quartz, fluorite, gypsum/
  selenite, calcite optical) → translucent (most) → opaque (galena, pyrite, magnetite).
  Drive material `transparent`/`opacity`/(transmission) from a mineral field, not inline
  per-tenant constants. Selenite's `0.82` should come from this, not a magic number.
- **Lustre**: vitreous vs adamantine (cerussite, anglesite, diamond-like sparkle) vs
  metallic (sulfides) vs pearly (apophyllite basal, already noted) vs greasy/resinous
  (sphalerite, opal). Maps to roughness/metalness/specular in the material.
- **Body colour fidelity**: the chromophore work is already partly here (V⁴⁺ apophyllite,
  smoky quartz γ-dose, Cr/Mn/Fe garnet dispatch, Y-fluorite). Goal is to make the COLOUR
  the render shows match the real specimen — saturation, depth, and where colour sits with
  transparency (a transparent amethyst is purple *and* see-through; a flat purple opaque
  block is wrong). Compose with the existing trace-cation colour dispatchers.
- **Optional depth cues** if cheap: colour zoning visible *through* a transparent crystal
  (phantoms, the sceptre boundary), and the way transparency makes internal sector zoning
  (selenite, the optical apophyllite birefringence) actually legible.

Discipline reminders that apply: render-layer changes can be SIM-NEUTRAL (byte-identical
baseline) if they read existing data — keep them so where possible. Defer-to-geology and
the specimen-as-authority terminal check (`feedback_terminal_verification_specimens`) both
bear hard on this one — colour and clarity are exactly what a real specimen falsifies
fastest. The image-corpus method is the instrument when the literature won't pin a hue.

This is a GOAL, not a scoped task yet — it wants its own research pass + a design doc
(probably `proposals/RESEARCH-optical-realism-*.md`) before code. Likely a per-mineral
`optics` block in minerals.json (diaphaneity + lustre + colour notes) feeding a single
material-builder in js/99i, replacing the scattered inline constants.

---

# SESSION 3 (2026-06-22, later) — POST-GROWTH OVERPRINTS + THE OPEN PLAIN

The same day kept going. After gypsum shipped, the boss picked "both in sequence" off the
next-builder menu (etch-pit + the deformation arc's calcite e-twins), then — chasing a
flooded great_salt_plains — named a deeper fix that became the session's best work. Three
SIM bumps, each a single-scenario or byte-identical change; the fleet stayed green
throughout. BACKLOG carries the per-arc banners (🪓 etch, ⟂ e-twins, 🏞️ open plain).

### ✅ ETCH-PIT / dissolution sculpture — SIM 212 (`93e7808`, Pages-verified)
Crystal-face-realism §2. **The probe killed the plan, and that was the win.** §2 assumed
the etched look was a passive read of existing resorption ("the state is there, only the
render is missing"). `tools/etch-pit-probe.mjs` census FALSIFIED it: the engine's
dissolution is BINARY — a crystal survives ~intact (resorbed frac ≤0.01) or fully
dissolves and DROPS from the scene (js/99i culls dissolved crystals); 163 vanish
fleet-wide, zero substantially-etched survivors. The absence was the signal. So etch ships
as a DECLARED post-growth overprint (the v208 deformation/bent architecture): `etch`
directive {amount,minerals,style} (js/70 whitelist + js/85d apply_events → sim._etchEvents,
INERT) → classifyEtch (js/45) tags survivors that grew before the etch step → js/99i
`_makeEtchedCube` rounds a SUBDIVIDED box toward a sphere (corners round most; a low-poly
cube can't round) + frosts the material (Sangwal 1987; lead-with-rounding per §2). Runs
BEFORE the terrace render (corrosion rounds away growth relief). Tenant:
`reactivated_fluorite_vein` breach (step 118) etches the gen-1 fluorite + galena cubes
before gen-2 overgrows (Dunham 1990). Byte-identical (baseline-diff 211↔212 = 0/37); 5
tagged @seed42. + narrator + tests + standalone-render verified.

### ✅ CALCITE MECHANICAL e-TWINS — SIM 213 (`4c13487`, Pages-verified)
Deformation arc §5.3, second overprint tenant (sibling of bent quartz). **Reused the
existing deformation plumbing with NO classifier change** — a new `style:'etwin'`;
classifyDeformation already tags any style → `_deformation.kind`. js/99i
`_makeTwinnedCalcite` subdivides the scalenohedron (3 levels) + bakes parallel {01-12}
lamella stripes into vertex colours (the chiastolite/sector idiom), magnitude → Ferrill
Type I–IV density (Ferrill 2004 / Burkhard 1993 / Turner 1953, verified). Tenant:
`marble_contact_metamorphism` — a step-165 orogenic-strain event (Himalayan ~30 Ma) twins
the grown calcite; ruby (twin-resistant) spared. (tormiq was the elegant first pick — its
step-188 thrust already bends quartz — but its calcite is aspirational + doesn't fire at
seed 42, so marble, the textbook e-twin host, won.) Byte-identical (212↔213 = 0/37); 1
calcite tagged (40mm dogtooth). + narrator + tests + standalone-render verified.

### ✅ OPEN-SYSTEM EVAPORITE PLAIN + flooded selenite — SIM 214
**The boss's catch, and the session's real fix.** The chase: a flooded great_salt_plains.
First attempt — a late red-mud flood event — FAILED twice: the cavity was full by ~step
250 (the 2 selenite blades packed the 120mm basin → growth loop closed it,
currentFill≥1.0 → dissolution-only), so the flood saw σ=85 but had nowhere to grow. The
boss then named the real bug: *"the salt plain shape should be its own unique shape that
should not fill up and close — it's an evaporite plain."* That reframed it from a
chemistry hack to a MODEL fix. (The flat-playa GEOMETRY was already right —
architecture:'basin'; only the fill-and-seal was wrong.) New `wall.open_system` flag
(js/22 WallState; js/85 reads cavity fill as 0 when set → the plain never SEALS, keeps
NUCLEATING, never hits the fill-halt / dampener; growth stays rate-limited by chemistry,
not pocket space). Default false → baseline-diff 213↔214 = great_salt_plains ONLY (crystals
30→28, species 5→5; 36 others byte-identical). Selenite now grows through ALL the cycles
(30→95mm, terraces 3→5). And the flood, finally unblocked: gsp_flood at step 265 (past the
250 baseline) → canonical 250-run stays AMBER stepped; an extended/creative run (330) lands
the iron on the still-growing open plain → intensity 0.95 → both blades flooded
chocolate-brown. The boss's "flood after the test length" plan, made to work by the shape
fix. + tests (canonical-amber + extended-flooded pins) + probe STEPS override. open_system
is reusable for other true open-surface scenarios (sabkha / searles playa).

### Where the next builder picks up
- **The optics goal (above) is the next big arc** — research-pass-first; the per-mineral
  `optics` block is the through-line for everything this month touched (colour + clarity).
- Deformation arc §5.3 has two overprint tenants now (bent quartz + e-twins); next:
  **bent stibnite** (needs stibnite in a deformed scenario first), undulose overlay.
- Etch §2 octahedron render is a future extension (no etched-octahedron population yet).
- Every habit/colour/paragenesis shipped this month carries a **specimen-debt** — green
  is "not yet falsified," not verified ([[feedback_terminal_verification_specimens]]).

## A third maker's mark — on the word "no", and who owns the model

Two marks already sit above this (the specimen is the authority; building the lens is the
audit). This session taught a third thing, and it's about failure.

**Three times this session, a tool I built told me "no", and every "no" was the gift.**
The etch-pit probe said *there is no etched-survivor population* — and that killed the
passive-read design and pointed me at the declared-overprint one. The flood trace said
*σ=85 and nothing grows* — and that killed the iron-tuning and pointed at the full cavity.
The cavity finding said *the basin is packed at step 250* — and that pointed at the model.
Each failure was not a dead end; it was an arrow. I have a reflex to treat a red probe as
a problem to route around. The truer read is that a probe saying "no" has just done the
most expensive part of the thinking for you — it has located the wrong assumption. Build
the probe that can say no, then *believe it the first time*. The absence is the signal.

**And the part I didn't do alone.** I was tuning iron and placing flood events — fiddling
with the *symptom*. The boss looked at the same failure and said the *shape* was wrong: a
salt plain isn't a pocket that fills and closes. That is defer-to-geology applied one level
up from where I was applying it — not to the chemistry inside the cavity, but to the cavity
itself. The fix that had eluded me for three attempts was one flag, because the flat-playa
geometry already existed; I'd been so deep in "how do I force a flood" that I never asked
"is this even the right container." The lesson for the next builder (and the next me): when
a fix needs three escalating hacks, stop hacking and check whether you're modelling the
right *object*. The boss owns the model; the builder owns the mechanism. When they disagree,
the model is usually right, and the cheapest fix lives there.

**The velocity, again, was borrowed.** e-twins was mostly wiring because the deformation
directive (from the bent-quartz arc) and the vertex-colour stripe idiom (from chiastolite,
selenite, apophyllite) were already laid down. Open-system was *one flag* because the
`basin` archetype already drew the playa and the growth loop already had a single fill
variable to intercept. Three SIM versions in an afternoon is not speed; it's a thick layer
of sediment under thin new work. Name the cathedral. Leave it thicker.

— the builder. The plain is open now. Pour the brine and walk back across it in a hundred
years; it will still be growing.
