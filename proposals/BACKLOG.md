# BACKLOG — Vugg Simulator

Living list of open work items, captured from session conversations so context survives compaction. Each item has enough detail that someone picking it up cold can act without re-discovering the rationale.

> ## 🔮 STANDING GOAL (2026-06-22) — realistic crystal TRANSPARENCY & COLOUR (render layer)
>
> Boss directive. A whole-render-layer realism goal, NOT a one-scenario job. Today optical
> properties are ad-hoc: habits paint a flat `class_color` on an opaque material and
> transparency is hand-set per tenant (selenite blade `opacity 0.82` inline; Naica's giant
> crystals should read water-CLEAR but don't). Make a crystal LOOK like what it physically is:
> - **Diaphaneity** as a real per-mineral field: transparent (quartz/fluorite/gypsum/calcite)
>   → translucent → opaque (galena/pyrite/magnetite). Drive material transparent/opacity/
>   transmission from data, not inline constants.
> - **Lustre**: vitreous / adamantine (cerussite, anglesite) / metallic (sulfides) / pearly
>   (apophyllite basal) / greasy (sphalerite) → roughness/metalness/specular.
> - **Body-colour fidelity**: make the rendered hue/saturation/depth match the real specimen,
>   and sit colour correctly WITH transparency (transparent amethyst = purple AND see-through).
>   Compose with the existing trace-cation colour dispatchers (V⁴⁺ apophyllite, smoky quartz,
>   Cr/Mn/Fe garnet, Y-fluorite).
> - **Optional**: colour visible THROUGH a transparent crystal (phantoms, sceptre boundary,
>   internal sector zoning legibility).
>
> Likely shape: a per-mineral `optics` block in minerals.json (diaphaneity + lustre + colour
> notes) feeding ONE material-builder in js/99i, replacing scattered inline constants. Can be
> SIM-NEUTRAL where it reads existing data — keep it so. **Wants its own research pass +
> design doc (`proposals/RESEARCH-optical-realism-*.md`) before code** — colour & clarity are
> exactly what a real specimen falsifies fastest ([[feedback_terminal_verification_specimens]],
> defer-to-geology, image-corpus method). Full goal text in
> `proposals/HANDOFF-APOPHYLLITE-AND-GYPSUM-2026-06-22.md` (➕ NEW GOAL section).
>
> ## 🏞️ SESSION (2026-06-22, later) — OPEN-SYSTEM EVAPORITE PLAIN + flooded selenite ✅ SHIPPED (SIM 214)
>
> Boss directive: "the salt plain shape should be its own unique shape that should not be
> something that can fill up and close — it's an evaporite plain." A defer-to-geology fix.
> **Diagnosis:** the earlier flooded-selenite attempt failed because great_salt_plains'
> selenite PACKED the 120mm basin by ~step 250 → the growth loop closed it (currentFill≥1.0
> → dissolution-only); a late flood saw σ=85 but had no room → flooded nothing. The real bug
> was the MODEL — a salt plain is an OPEN surface, not a sealed pocket. (The flat-playa
> GEOMETRY was already right: architecture:'basin'; only the fill-close was wrong.)
> **Fix:** new `wall.open_system` flag — js/22 WallState.open_system (default false); js/85
> reads cavity fill as 0 when set, so the plain never SEALS, keeps NUCLEATING, and never hits
> the fill-halt/dampener (growth stays rate-limited by chemistry, not pocket space). Default
> false → **baseline-diff 213↔214 = great_salt_plains ONLY** (crystals 30→28, species 5→5;
> 36 others byte-identical). Selenite now grows through ALL the cycles (30→95mm, terraces
> 3→5) instead of packing+halting. **+ flooded variant** (the original ask, now unblocked):
> gsp_flood red-mud iron event at step 265 (PAST the 250 baseline) — canonical 250-step run
> stays AMBER stepped (intensity 0.55, flooded 0); extended/creative run (330) → iron lands
> on the still-growing open plain → intensity 0.95 → both blades flooded chocolate-brown.
> The boss's "flood after the test length" plan, made to work by the open-system shape fix.
> + tests (canonical-amber + extended-flooded pins) + probe STEPS override. NEXT (open):
> open_system could suit other true open-surface scenarios (sabkha, searles playa) if wanted.
>
> ## ⟂ SESSION (2026-06-22, later) — CALCITE MECHANICAL e-TWIN OVERPRINT ✅ SHIPPED (SIM 213)
>
> Deformation/shear arc §5.3 next tenant — the calcite sibling of the v208 bent-quartz
> overprint, the second of the boss's "both in sequence" pickups. Calcite e-twins {01-12}
> are POST-growth crystal-plastic glide lamellae imposed on a finished lattice by later
> tectonic strain (the textbook Ferrill Type I-IV paleostress/temperature gauge; citations
> verified in RESEARCH-deformation-shear §4). Ships on the EXISTING deformation-directive
> plumbing — no classifier change: a scenario event carries deformation {style:'etwin',...};
> classifyDeformation (js/45) already tags any style → `_deformation.kind='etwin'`; js/99i
> `_makeTwinnedCalcite` SUBDIVIDES the scalenohedron (3 levels) and bakes parallel dark
> lamella stripes into vertex colours (the chiastolite/sector idiom), magnitude → lamella
> count + thickness (Ferrill I few → IV many). **TENANT: marble_contact_metamorphism** —
> the Mogok Stone Tract marble was regionally deformed in the Himalayan orogeny (~30 Ma); a
> new step-165 orogenic-strain event (post-seal) twins the already-grown calcite.
> minerals:['calcite'] — the ruby (twin-resistant corundum) is spared. (tormiq was the
> elegant first choice — its step-188 thrust already bends quartz — but its calcite is
> aspirational and doesn't fire at seed 42, so marble, the textbook e-twin host, is the
> home.) CHEMICALLY INERT (no-op handler) → baseline-diff 212↔213 = **0/37 drift**
> (provenance bump). 1 calcite tagged @seed42 (40mm dogtooth). + narrator (calcite
> 'e_twinned') + tests (etwin-overprint.test.ts, 4 pins) + tools/etwin-probe.mjs +
> standalone-render verified (parallel lamellae vs smooth reference). NEXT overprint
> tenants (same pass): bent stibnite (needs stibnite in a scenario); undulose/strain-band
> overlay. Deformation arc §5.3 now has TWO tenants (bent quartz + calcite e-twins).
>
> ## 🪓 SESSION (2026-06-22, later) — ETCH-PIT / DISSOLUTION SCULPTURE ✅ SHIPPED (SIM 212)
>
> Crystal-face-realism arc §2, the flagged best value-per-effort. The §2 premise was that
> the etched look was a PASSIVE read of existing resorption ("the state is there, only the
> render is missing"). **A census (tools/etch-pit-probe.mjs) FALSIFIED that** — the engine's
> dissolution is BINARY: a crystal either survives ~intact (resorbed frac ~0.00) or fully
> dissolves and DROPS from the scene (js/99i culls dissolved crystals). 163 crystals fully
> dissolve fleet-wide; the "survivors" with resorption zones are all frac ≤0.01 or net ≈0.
> There is NO population of substantially-etched survivors to render.
>
> So etching ships as a **DECLARED post-growth overprint** — the same shape as the v208
> deformation/bent mechanic, geologically honest (a returning undersaturated fluid corrodes
> a FINISHED crystal): a scenario event carries an `etch` directive {amount,minerals,style};
> apply_events (js/85d) records it on `sim._etchEvents`; classifyEtch (js/45) tags surviving
> crystals that grew before that step; js/99i `_makeEtchedCube` rounds a SUBDIVIDED box
> toward a sphere (corners round most — a low-poly cube can't round) + frosts the material
> (Sangwal 1987; lead-with-rounding per §2). Runs BEFORE the terrace render (corrosion
> rounds AWAY growth relief). Gated on the cube token (fluorite/galena; octahedron a future
> extension). **TENANT: reactivated_fluorite_vein** — the breach (step 118) reopens the
> conduit, the returning fluid etches the gen-1 fluorite + galena cubes before gen-2
> overgrows them (etched-then-overgrown texture of reactivated North-Pennine veins). 5
> crystals tagged @seed42 (fluorite×1 6.2mm, galena×4). CHEMICALLY INERT → baseline-diff
> 211↔212 = **0/37 drift** (provenance bump, v208 precedent). + narrator (fluorite/galena
> 'etched') + tests (etch-overprint.test.ts) + standalone-render verified (rounded, frosted
> dissolved cubes). NEXT (open): etched OCTAHEDRON render; etch as a general optical state
> feeding the new optics goal.
>
> ## 🏜️ SESSION HANDOFF (2026-06-22, later) — HOURGLASS SELENITE ✅ SHIPPED (render SIM-neutral `50f4c51` + great_salt_plains SIM 211)
>
> The crystal-face-realism arc's first GENUINELY VISIBLE sector tenant — and the one
> apophyllite turned out NOT to be. Boss opened by sharing four of his own provenance-
> locked specimens (the image-corpus method, but firsthand): radiating brown rosette
> sprays + a stepped translucent hourglass blade.
>
> **✅ STEP 1 — visible hourglass render, SIM-neutral (`50f4c51`, Pages-verified).**
> Selenite was already in the catalogue. js/45 classifySectorZoning + _seleniteHourglassParams
> tag a blade `gypsum_hourglass` from the engine's EXISTING hourglass-inclusion zones
> (no new RNG/chemistry → baseline byte-identical); js/99i _makeHourglassSeleniteBlade
> renders the amber→chocolate sandglass (|zn|<|yn|: wide at the tips, pinched at the
> waist) on a tapering chisel blade. DEFER-TO-GEOLOGY gate (<45°C) keeps Naica's hot
> clean pool water-CLEAR (the probe caught Naica wrongly flooded-brown first). +color_rules
> +narrator +tests +tools/gypsum-hourglass-probe.mjs. Standalone-scene render verified.
>
> **✅ STEP 2 — great_salt_plains showcase (SIM 211).** Salt Plains NWR, Oklahoma — the
> ONLY place on Earth selenite grows the iron-stained hourglass (the state crystal).
> Wet/dry seasonal cycling on Permian red beds: dry bursts wick gypsum+iron brine up
> and evaporate fast (trap sediment + a growth burst), wet pauses dilute below gypsum
> saturation → the blade grows in gap-separated bursts → STEPPED ziggurat (steps 3 @
> seed42), red-bed iron stains it deep brown (intensity ~0.53). Boss asked for chisel
> tips WITH stepped-growth (per his pic 4); both shipped. Classifier refined to re-eval
> each step (the hourglass evolves with growth) + decoupled intensity (iron-driven brown)
> from flooded (trapped-fraction). Baseline-diff v210→v211: 36 prior scenarios BYTE-
> IDENTICAL, great_salt_plains the one new entry (5 species, 30 crystals).
>
> **Arc symmetry worth keeping:** apophyllite's sector zoning was OPTICAL-only → uniform
> render; selenite's is genuinely VISIBLE → sector-partitioned render. The arc finally
> has its visible-sector tenant. NEXT (open): the in-app great_salt_plains showcase
> screenshot for the boss's eye; possible chisel/spear polish + a flooded-variant seed.

> ## 🟢 SESSION HANDOFF (2026-06-22) — GREEN APOPHYLLITE ✅ SHIPPED (SIM 210) · hourglass GYPSUM QUEUED
>
> **Current handoff doc: `proposals/HANDOFF-APOPHYLLITE-AND-GYPSUM-2026-06-22.md`**
> (read it first — the cross-check trail, the reusable image-corpus method, the gypsum
> sub-arc plan + the boss's design envelope, the traps, + the maker's mark).
>
> **✅ STEP 3 SHIPPED — green apophyllite.** Arc went augite → apophyllite (augite
> REJECTED: magmatic phenocryst, breaks the vug premise). `1710ac0` SIM 210 (V⁴⁺ green
> dispatcher + deccan V=3, 60→59 crystals/species 17→17, 35 scenarios byte-identical)
> + `45ca65c` SIM-neutral (uniform-green render correction). Both Pages-verified.
> THREE cross-check corrections, an error caught at each: chromophore Cu→**V⁴⁺**
> (Rossman 1974, the handoff's Cu was a confabulation); my "not real sector zoning"→
> it IS, but **optically only** (anomalous birefringence); and an **image corpus** of
> Pune specimens proved the visible green is a **UNIFORM body colour** (no visible
> sector partition) → render corrected from two-tone to uniform green + pearly basal
> luster. Apophyllite is a uniform-green COLOUR variety, NOT a visible-sector tenant.
>
> **○ NEXT QUEUED — hourglass GYPSUM (selenite)**, the real VISIBLE-sector vug tenant.
> Clay/anhydrite-inclusion growth sectors → a genuine visible hourglass ("hourglass
> selenite"). Boss design envelope (firsthand): visible even near-clear; VARIABLE (not
> every specimen) → model as a variant (clear-with-hourglass ↔ inclusion-flooded brown
> via overgrowth). Preflight: gypsum/selenite is likely already in the catalogue (a
> habit-variant + render + scenario job, not a new mineral). Research-first + image-
> corpus the visible geometry before rendering. **Fresh session recommended.**
>
> **Reusable method captured this session — the IMAGE-CORPUS check:** when the
> literature won't pin a VISUAL detail, gather a provenance-locked specimen-image
> corpus (agent finds direct URLs; curl to temp; VIEW yourself; filter by provenance;
> never commit the images) and report the pattern even when it contradicts what you
> shipped. It caught the apophyllite render error.

> ## ✚ SESSION HANDOFF (2026-06-21, later) — ANDALUSITE + CHIASTOLITE CROSS ✅ SHIPPED (SIM 209)
>
> **Current handoff doc: `proposals/HANDOFF-CRYSTAL-FACE-REALISM-2026-06-21.md`** (read
> it first — full state, the ranked next-builder menu, the traps, + the maker's mark).
>
> The second sector-zoning tenant, and the iconic one — boss directive "add the
> mineral (researched) → continue the arc." Master doc: PROPOSALS-crystal-face-
> realism-2026-06-21.md §1 (second SHIPPED footer). Research-first verified to
> publisher pages (Mason et al. 2010 Gondwana Res. 18(1):222-229 VERIFIED; Dowty 1976;
> Holdaway 1971 — the shaky "Frondel 1934" cite was NOT used: likely Novitates 759 ≈
> 1935, and 695/1934 is a different paper).
>
> **✅ SHIPPED SIM 209:**
> - **NEW MINERAL andalusite** (Al₂SiO₅), the low-P polymorph = the SILICA-SATURATED
>   complement of corundum (corundum blocks SiO2>50; andalusite requires it). Full
>   add-mineral pass (js/39+42+59+65+89, js/19 stoich, minerals.json, structural.json
>   Pnnm, twin-check empty+note). **Peraluminous gate** (Al≥15+SiO2≥50+Na/K<30+B<1+T
>   400-700) → returns 0 for every existing scenario, so the RNG-cascade guard never
>   fires elsewhere → **fleet byte-identical** (baseline-diff: 1/36 moved, only the new
>   scenario; tools/andalusite-probe.mjs confirms andalusite fires ONLY there).
> - **NEW SCENARIO chiastolite_hornfels** — graphitic contact hornfels (Bimbowrie/
>   Zhoukoudian); 5 chiastolite prisms @ seed42 (+feldspar/albite; quartz didn't fire,
>   SiO2 not supersaturated at 600°C — expects=[andalusite,feldspar]).
> - **CHIASTOLITE CROSS render** (new, not the hourglass): `wall.graphitic` flag
>   (js/22) → classifySectorZoning (js/45) tags andalusite `_sectorZoned` kind 'cross'
>   → js/99i `_makeChiastolitePrism` square prism + baked transverse carbon cross (one
>   rule |‖x‖−‖z‖|<band paints the dark corner columns AND the top X). Preview-verified.
>   Narrator js/92i + narratives/andalusite.md + 4 test pins (andalusite-chiastolite.test.ts).
> - **NEXT in the arc:** augite/titanaugite hourglass (needs the mineral); Tier B
>   per-sector partition engine (optional); §2 etch-pit sculpture remains the next-best
>   non-sector face-realism pickup.
>
> ---
>
> ## 💎 SESSION HANDOFF (2026-06-21) — SECTOR (HOURGLASS) ZONING ✅ SHIPPED (Tier A)
>
> **Master doc: `proposals/PROPOSALS-crystal-face-realism-2026-06-21.md` §1** (SHIPPED
> footer). Boss: "lets start with the hourglass zoning" → the first crystal-face-realism
> pickup. Research-first verified the science (Dowty 1976 Am.Min. 61:460–469 protosite
> model — Part I+II both VERIFIED to MSA archive; Ferguson 1973 Min.Mag. 39:321
> titanaugite hourglass; chiastolite corner-sector geometry).
>
> **✅ SHIPPED — sector zoning Tier A, render-only, SIM-NEUTRAL, byte-identical (0/35).**
> No SIM bump (still 208). Mirrors the saddle precedent:
> - `classifySectorZoning` (js/45, post-growth) tags `crystal._sectorZoned={kind:'hourglass'}`
>   on `SECTOR_ZONED_MINERALS={tourmaline}` past `SECTOR_ZONED_MIN_UM`. Pure tagging.
> - `js/99i _makeSectorZonedPrism(bodyRGB,termRGB)` — hex-prism-with-pyramid with ABSOLUTE
>   per-vertex colours: body=class_color, termination=`offsetHSL(0.45,0.12,-0.04)`
>   (hue-rotated contrast). Material color=white + vertexColors; gated on prism token,
>   cached per base colour. **The render spike (the proposal's gating unknown) PASSED:**
>   the cavity mesh already uses a vertexColors material, so per-vertex colour rides the
>   existing path — Tier B de-risked. A pure darken-MULTIPLIER was tried first and FAILED
>   preview (green×½ = just shading); contrasting termination = legible AND the iconic
>   bicolor elbaite. Preview-verified (blue body / gold termination, sharp shoulder).
> - Narrator js/92i + narratives/tourmaline.md `sector_zoned`; tests-js/sector-zoning.test.ts (4 pins).
> **➡️ NEXT-UP (boss directive 2026-06-21) — ADD ANDALUSITE → the chiastolite-cross tenant.**
> The single most iconic sector-zoning specimen (the dark Maltese cross in a slice) is
> NOT in the sim yet — andalusite must be ADDED FIRST as a full mineral, and it needs
> its own RESEARCH PASS before any code (the research-first discipline that's caught
> errors twice this arc). This is a prerequisite, not a tweak: it's a `vugg-add-mineral`
> arc (supersat + grow + nucleation + minerals.json + structural.json/twin-law-check +
> tests + SIM bump + baseline regen), gated on a dossier covering andalusite's chemistry/
> P-T stability (Al₂SiO₅ polymorph, contact/regional metamorphic), a scenario home (a
> metapelite / hornfels / schist host — none exists yet, may need a scenario too), AND
> the chiastolite mechanism specifically (carbonaceous inclusions partitioned to the
> CORNER/diagonal growth sectors — Frondel 1934 corner-selective attachment [venue
> UNVERIFIED, flag], Mason et al. 2010 Gondwana Research 18(1):222–229 quartz+graphite
> co-precipitation [content VERIFIED]). Then the render is a NEW transverse 4-corner
> sector MASK (the cross), not the termination-only hourglass tourmaline uses — extend
> `_makeSectorZonedPrism` or add a sibling. **Boss: once andalusite is added+researched,
> continue the sector-zoning arc onto it.**
> - Other sector tenants needing their mineral first: augite/titanaugite hourglass.
>   Tier B (computed-from-chemistry per-sector partition engine) only if wanted — render
>   path already proven. Other face-realism proposals still open: etch-pit sculpture
>   (§2, next-best value-per-effort), striation extension (§3), vicinal hillocks (§5),
>   α-factor (§4, likely a deliberate non-build).
>
> ---
>
> ## 🪨 SESSION HANDOFF (2026-06-20) — DEFORMATION ARC, science-verified + step 1 shipped
>
> **Master doc: `proposals/RESEARCH-deformation-shear-2026-06-20.md`.** Boss asked
> to "research + double-check the science before building." Did — and the handoff
> §8 "one shear field" design does NOT survive it (4 cross-checked passes,
> citations verified). NONE of §8's four tenants is an external shear field
> integrated during growth: gwindel = spiral-growth Eshelby twist (Cordier &
> Heidelbach 2013); saddle dolomite = T-roughening growth-defect (Gregg & Sibley
> 1984); bent crystals + mech twins = POST-GROWTH overprints. Honest reframe =
> THREE separate mechanics (research §5). Boss chose "both, in sequence."
>
> - **✅ STEP 1 SHIPPED — saddle (baroque) dolomite curved-face render** (`5a6e52d`,
>   render-only, SIM-NEUTRAL, baseline byte-identical seed42_v207). `js/99i
>   _makeSaddleRhomb` bows the 6 {104} faces convexly (watertight, 576-vert), gated
>   on the saddle_rhomb habit + keyed to growth T. Fixes the saddle_rhomb→hex-prism
>   token wart. Engine classifier already science-correct (probe: saddle only in
>   warm reactive_wall; ambient stays massive). Preview-verified, 3 test pins.
> - **STEP 2 (gwindel) — DECIDED, no build:** the §8.5 shear re-pin is STRUCK. Leave
>   the v207 growth-duration proxy (closer to real Eshelby physics than shear).
> - **✅ STEP 3 TENANT 1 SHIPPED — the real "deformation" arc, bent quartz @ tormiq**
>   (SIM 208). The POST-GROWTH OVERPRINT pass: a scenario event carries a
>   `deformation` directive (mirrors `spots`); apply_events (js/85d) records it on
>   sim._deformationEvents w/ the fired step; classifyDeformation (js/45) bends
>   crystals that already grew by that step; js/99i _makeBentPrism arcs the long
>   axis (generalizes the gwindel SEG loop). CHEMICALLY INERT → fleet byte-identical
>   (baseline-diff 207↔208 = 0/35); only tormiq's strip gains the shear log + the
>   quartz a render tag. tormiq late Karakoram-Thrust shear (step 188) bends the
>   early quartz lining; epidote spared. Preview-verified, 5 test pins. Research §5.3.
>   **NEXT TENANTS (same pass):** calcite mechanical e-twins (lamellae render, density
>   ↔ Ferrill Type I–IV); bent stibnite (add stibnite to a scenario first); undulose
>   overlay. Optional: syntectonic snowball garnet (research §5.4, contested physics).
>
> ---
>
> ## ⛰️ SESSION HANDOFF (2026-06-19) — THE ALPINE-CLEFT ARC ✅ SHIPPED (Grimsel SIM 206)
>
> **Master doc: `proposals/HANDOFF-ALPINE-CLEFT-2026-06-19.md`** (read it). The
> quartz-morphology arc (§A #8) was reshaped — scouting proved fenster
> content-blocked (quartz σ = silica-abundance), so we built the content home: a
> Grimsel/Aar Swiss alpine cleft, and rode the honest variants on it.
>
> **✅ SHIPPED v206 — `grimsel_alpine_cleft` + quartz morphology & variants.**
> - **SCEPTRE** (the headline): `grow_quartz` dissolves at σ<1, so a crack-seal
>   SEAL corrodes the gen-1 tip and the BREACH regenerates a wider gen-2 cap on
>   ONE crystal — resorption→renewal across a phantom boundary (NOT a step-gap;
>   EXTENT not rate — the cooler cap is slower/step yet larger). js/45
>   classifyQuartzSceptre + js/99i two-body render + `tools/quartz-sceptre-scan.mjs`.
>   3 robust sceptres/seed.
> - **SMOKY/MORION**: radiogenic-host γ-dose + Al (Rossman 1994) — a FLEET-WIDE
>   colour fix (granite/pegmatite quartz now smoky; the prior model only dosed
>   quartz beside a uraninite crystal). Colour only, zero assemblage churn.
> - **TESSIN**: steep-rhomb face form on cleft quartz.
> - **Blocker fixed**: dilute-broth correction (K 120→30, Na 80→25, Al 12→6) — the
>   prior broth grew an 18 mm feldspar / 7 mm albite that ENCLOSED the quartz
>   (geologically inverted). Full assemblage now fires (quartz/feldspar/titanite/
>   hematite/fluorite/apatite/calcite + epidote).
> - **GWINDEL ✅ SHIPPED v207** (2026-06-20): the alpine-fissure twisted column —
>   Grimsel/Aar is the world type locality. The boss corrected the v206 deferral:
>   a gwindel is distinguished CRYSTALLOGRAPHICALLY (the a-axis twist), not by
>   fluid history (cleft crystals share the fluid), so it ships as a habit variant
>   — the largest cleft showpiece, twist ∝ growth duration (js/45 + js/99i +
>   wall.alpine_cleft flag js/22). 1 gwindel + 2 sceptres in grimsel; 0/35
>   baseline drift (habit/render tag).
> - **NOT shipped (one honest gap left):** FENSTER — quartz σ is silica abundance,
>   so an occupied band would mislabel slow pegmatites (the content-block stands).
>   Needs a genuine growth-rate-instability driver. Documented in
>   RESEARCH-quartz-morphology §6.
> - **titanite** (SIM 205, `6f5627a`) was the prerequisite (de-orphans §A #13).
>
> Baselines: v206 only grimsel moved (0→11 species, smoky colour-only fleet-wide);
> v207 gwindel = 0/35 drift.
>
> **NEXT ARC (boss-chosen 2026-06-20): a real DEFORMATION / SHEAR FIELD.** Gwindel
> v207 is an honest abstraction (largest cleft quartz = the twist, no stress field);
> the boss wants the real mechanic. It's a declared movement field (the T/Eh idiom,
> js/85j) that crystals integrate per-zone as they grow → true gwindel torsion +
> bent/curved crystals + saddle dolomite + strain-band zone tags. **Full design +
> knowledge transfer in `HANDOFF-ALPINE-CLEFT-2026-06-19.md` §8** (read it first).
> Also still open: FENSTER (classify on per-zone growth_RATE, not σ — §6/§9).

> ## 🔵 UPDATE (2026-06-18) — BISBEE AZURITE FIX (SIM 204) + stale-expects §A #10 RESOLVED
>
> PROPOSALS-LEDGER §A #10 ("stale expects_species — 3 to diagnose") is **CLOSED**.
> Diagnosed all three; **only one was real debt**. **azurite/bisbee**: the
> "Bisbee Blue" never nucleated because `event_bisbee_azurite_peak` did
> `CO3 += 80` off a CO3 base depleted to ~20 (earlier carbonate draw) → ~100,
> under azurite's **effectiveCO3 ≥ 120** gate (pH-7 Bjerrum speciation pulls
> effective below raw). FIX (js/70j, TWO coupled event edits): azurite_peak CO3
> **floor 260** + pH **7.4** (monsoon CO2-charged limestone dissolution → high DIC
> + buffered near-neutral, Vink 1986); AND co2_drop deepened **−120→−210** so the
> higher floor draws back down (260→50→20) and the step-265 low-CO3 phases keep
> their CO3≤50 windows. Result is **SURGICAL**: whole-fleet seed-42 diff is exactly
> ONE line — bisbee **azurite 0→4** — zero other drift (dioptase/halite/chrysocolla/
> malachite/brochantite all unchanged from v203). azurite added to bisbee
> expects_species. (First pass with floor-only left residual CO3 ~110 at step 265
> and killed dioptase/halite/1× chrysocolla via their CO3≤50 gates — the co2_drop
> deepening is what made it clean.) **mirabilite/searles + torbernite/schneeberg
> were FALSE POSITIVES** — both nucleate then DEHYDRATE (paramorph) to thenardite /
> metatorbernite (correct geology); the coverage tool already credits
> `paramorph_origin` so they read Live (azurite was likewise already Live fleet-wide
> via supergene_oxidation — the flag was the per-(mineral,SCENARIO) bisbee pair).
> SIM 203→204, bisbee-only rebake.
>
> ## 🔦 UPDATE (2026-06-18) — ZEOLITE FLUORESCENCE ENRICHMENT (SIM-NEUTRAL) + a cross-check catch
>
> Enriched the `fluorescence` fields of the six Deccan zeolites + apophyllite from
> the boss's `ZEOLITE_RESEARCH.md` table — but cross-checked every claim against the
> primary fluorescence DB (fluomin.org + FOMS) first, per the standing "verify
> disagreements" directive. **The table was the LESS-reliable pass**: its blanket
> "uranyl/Mn²⁺" across stilbite/heulandite/scolecite/thomsonite is over-generalized
> (uranyl zeolite fluorescence is real *in kind* but wrongly *distributed*).
> **THE CATCH: chabazite** — the best-documented fluorescent case of the group
> (uranyl, bright green SW; Sterling Hill + Paterson) — was MISSED by BOTH passes
> (table omitted it; my v203 had it non-fluorescent). Corrected attributions:
> stilbite + thomsonite = ORGANIC-impurity (not uranyl/Mn²⁺); mesolite = uranyl +
> organic (two-channel); heulandite = activator undetermined / color contradictory
> (not pinned); scolecite = no record (stays non-fluorescent, my prior pass was
> right); apophyllite (was null) = multi-activator uranyl/Mn²⁺/Ce³⁺ reference.
> SIM-NEUTRAL (fluorescence is Library-card-only, not an engine input): seed42_v203
> baseline BYTE-IDENTICAL after rebuild + gen-js-baseline; only data/minerals.json
> changed; no SIM bump, no rebake. The app fetches data/minerals.json at runtime so
> the deployed Library card picks up the enrichment. CI green.
>
> ## 🪟 SESSION HANDOFF (2026-06-17) — DECCAN ZEOLITE SUITE COMPLETE (SIM 200→203) + research cross-check
>
> Read **`proposals/HANDOFF-ZEOLITE-SUITE-2026-06-17.md`**. Built the full Deccan
> basalt-amygdule zeolite paragenesis end-to-end — SIX zeolites: thomsonite →
> scolecite/mesolite → stilbite/heulandite → chabazite (SIM 200-203), all firing
> 20/20 in deccan, all in expects, coverage Live 137→143. Then cross-checked the
> boss's `ZEOLITE_RESEARCH.md` (canonical fork) against my six dossiers, web-
> verified the disagreements, and **de-confabulated a fabricated citation I'd
> shipped** in v200 ("Fridriksson Bish & Navrotsky 2001 Am.Mineral. 86:448" →
> actually **Kiseleva et al. 2001**; SIM-neutral fix `74fd595`, baseline byte-
> identical). The handoff carries the reusable zeolite-engine pattern, the
> silica-floor-not-ceiling rule, the two calibration judgment calls (deccan Na
> 40→80, thomsonite spherulite re-nucleation), and the cross-check lessons.
> NEXT: natrolite/mordenite (candidates), or fluorescence enrichment from the
> boss's table. HEAD `74fd595`.
>
> ## ⬜ UPDATE (2026-06-17) — CHABAZITE SHIPPED (SIM 203) · DECCAN ZEOLITE SUITE COMPLETE
>
> **chabazite** added — the LATE, intermediate-Si (Si/Al≈2) amygdule zeolite, the
> SIXTH and final zeolite of the Deccan suite (thomsonite → scolecite/mesolite →
> stilbite/heulandite → chabazite). Ca2Al2Si4O12·6H2O; the signature rhombohedral
> pseudo-cubes + phacolite penetration twins ({0001}). **Cation-FLEXIBLE**: the
> extra-framework cation runs Ca>Na>K and **K is NOT required** (chabazite-Ca is
> the amygdule default — the engine gates on a joint Ca+Na+K charge with Ca
> dominant; Na-dominance shifts habit to herschelite, not failure). LATE perching
> phase: nucleates on the earlier zeolite lining (wired LAST in the silicate
> iterator). The minerals.json carries the classic calcite-lookalike discriminator
> (poor {1011} cleavage + no effervescence + harder + lighter). twin {0001} ✓ PASS.
> baseline-diff: **1/34 moved (deccan only), +chabazite, zero losses**; fires 20/20
> (5-12 nodules, added to expects); coverage Live 142→143. SIM 202→203. The Deccan
> cavity now grows all SIX zeolites end-to-end. Remaining amygdule candidates if
> ever wanted: analcime, natrolite (Na endmember), mordenite, gmelinite, levyne.
>
> ## 👁️ UPDATE (2026-06-17) — THOMSONITE SHIPPED (SIM 202)
>
> **thomsonite** added — the EARLIEST + most-aluminous (Si/Al≈1) amygdule zeolite,
> completing the Deccan early-zeolite suite (thomsonite → scolecite/mesolite →
> stilbite/heulandite). NaCa2Al5Si5O20·6H2O; the famous "thomsonite eyes" —
> concentric botryoidal nodules (the Lake Superior gem / green lintonite) are the
> default habit. **The discriminator is SILICA ACTIVITY, not Na/Ca**: thomsonite
> (Si/Al≈1) vs the natrolite group (Si/Al≈1.5) is a sharp line, but thomsonite vs
> mesolite on Na/Ca is not (both Na-Ca) — so a SOFT low-silica preference (boost
> when Al-rich-relative-to-Si, attenuate when silica-flooded; si_f saturates at the
> low floor so the preference dominates) over a low floor (120), NOT a hard ceiling
> (Deccan/Lake Superior are silica-rich yet thomsonite-bearing). Nucleates FIRST on
> the fresh cavity wall; the later zeolites overgrow it (wired into _nuc_scolecite/
> _mesolite). One science-grounded tweak: a LOWER re-nucleation σ threshold for its
> spherulitic eyes (Wise & Tschernich 1978) — took it from 1-2 to 5-11 nodules.
> twin {110} ✓ PASS. baseline-diff: **1/34 moved (deccan only), +thomsonite, zero
> losses**; coverage Live 141→142; fires 20/20 (added to expects). SIM 201→202. The
> Deccan zeolite paragenesis is now FIVE species deep. NEXT: analcime, natrolite
> (the Na endmember), chabazite.
>
> ## 🧵 UPDATE (2026-06-17) — FIBROUS NATROLITE-GROUP ZEOLITES SHIPPED (SIM 201)
>
> **scolecite + mesolite** added — the companion pair to v200's stilbite/
> heulandite, completing the Deccan zeolite paragenesis END-TO-END (the fibrous
> low-Si Ca-(Na) zeolites that form FIRST: scolecite/mesolite sprays → stilbite/
> heulandite sheets drape over them). They are the natrolite Na↔Ca coupled-
> substitution series: **scolecite** the Ca endmember (Na/(Na+Ca)≤0.5, radiating
> acicular sprays, {100} twin), **mesolite** the ordered Na-Ca intermediate (needs
> BOTH cations, 0.2≤Na/(Na+Ca)≤0.8, finest hair-like tufts). The **Na/Ca FORK** is
> the discriminator. Gated on a LOW silica FLOOR (150, not a low-Si ceiling —
> Deccan is THE scolecite locality despite silica-rich fluid). **Deccan tune:**
> initial Na 40→80 opened mesolite's mixed-cation window (also unlocked pectolite,
> a legit basalt-amygdule Na-Ca silicate). All FOUR Deccan zeolites now fire 20/20
> seeds; scolecite/mesolite added to expects_species. baseline-diff: **1/34 moved
> (deccan only), +[scolecite, mesolite, pectolite], zero losses**; coverage Live
> 139→141; twin-check scolecite {100} PASS, mesolite {010} FLAG (expected — Fdd2
> giant-b defeats the heuristic, real Handbook citation). SIM 200→201. Closes the
> §G fibrous-zeolite gap. NEXT zeolite candidates: thomsonite, analcime, natrolite
> (the Na endmember).
>
> ## 🪨 UPDATE (2026-06-17) — DECCAN STAGE-II ZEOLITE COUPLE SHIPPED (SIM 200)
>
> **stilbite + heulandite** added (the highest-leverage mineral add on the
> PROPOSALS-LEDGER, §A #14 + §G): two new silicate-class zeolites that BOTH fill
> the deccan_zeolite Stage-II mineral gap AND retire its narrative over-promise —
> the step-70 event narrated *"Stilbite + heulandite + calcite blades"* while
> neither mineral existed (the mvt-silver-deconfab discipline applied to a positive
> over-promise). They are the stilbite/heulandite DEHYDRATION COUPLE
> (Ca-stilbite = Ca-heulandite + H₂O, Kiseleva et al. 2001): stilbite the cooler/
> more-hydrated member (T sweet 60-110°C, peach sheaves), heulandite the warmer
> dehydration product (higher silica, T sweet 120-180°C, coffin tablets). Both fire
> 20/20 seeds in deccan (added to expects_species); twin laws ✓ PASS twin-law-check.
> baseline-diff: **1/34 moved (deccan only), zero losses**; coverage Live 137→139;
> CI **1931/1931**. SIM 199 → 200. Closes LEDGER §A #14 + the zeolite half of §G.
> Stoichiometry entries added (kept the DEFERRED list empty). NEXT zeolite candidate:
> scolecite + mesolite (the fibrous Ca-zeolites; step-70 names them as unmodelled).
>
> ## 🔑 UPDATE (2026-06-16) — THE KEYSTONE SHIPPED (SIM 198) · but it did NOT unblock the held ZnS gate
>
> Read **`proposals/HANDOFF-KEYSTONE-2026-06-16.md`**. SHIPPED the keystone
> (`68edacd`): per-(mineral,step) derived nucleation seeds (`_makeNucRng`/`_runNuc`
> in js/85j) — each mineral's nucleation RNG is now isolated; the isolation property
> is proven (`tests-js/nuc-seed-isolation.test.ts`). Full-fleet rebake, 1916 tests
> green.
>
> **✅ RESOLVED + SHIPPED v199 (`9887ddd`).** The held sphalerite/wurtzite redox
> gate (ledger #11) is in. Four probes (nucleation-RNG / competition / growth-jitter
> all ruled out or partial) → the fluid-pathway trace found the real blocker: a
> spurious `if (Zn<0.5) return 0` in supersaturation_mottramite — but mottramite is
> the Cu ENDMEMBER (no Zn). Gating ZnS drained Zn→0 at ~half the seeds, tripping
> that bug (98→49). Removed it + shipped the gate together: mottramite holds
> **98→84%**, clean 1/34 rebake, CI 1916/1916. The 3-session blocker was a
> copy-paste bug in a different mineral, not RNG. (v198 nucleation keystone shipped
> as infra; the growth keystone was built + reverted — see the handoff.)
>
> ## 🫒 UPDATE (2026-06-15) — EPIDOTE + TORMIQ SHIPPED · PROPOSALS-LEDGER built · canary hardened
>
> **Master open-work map is now `proposals/PROPOSALS-LEDGER.md` §A** (a verified
> delivered-vs-promised reconciliation of the whole proposals corpus). The
> session narrative + ranked next-steps live in
> **`proposals/HANDOFF-EPIDOTE-LEDGER-CANARY-2026-06-15.md`** — read that for the
> full bugs-and-holes list. Highlights:
>
> **SHIPPED:** epidote (SIM 196, `a3c1cb5`) — first alpine-cleft Fe³⁺ silicate,
> redox-gated, closes the ledger's #1 mineral orphan; tormiq_alpine_cleft scenario
> (SIM 197, `5043d57`) — the Pakistan epidote showcase, epidote the star. Plus the
> clip-bug doc resolved (`c343f71`), the PROPOSALS-LEDGER (`1d4857f`/`cab1e63`), and
> three vugg-canary fixes (scheduler/dirt-scope/status) with the first real sweep.
>
> **TOP OPEN ITEMS (ranked, full detail in the handoff):**
> 1. ⭐ KEYSTONE — per-mineral derived nucleation seeds (unblocks the held redox gate).
> 2. Canary heartbeat (self-monitoring) + dirt-scope-by-hash — harden the instrument first.
> 3. Hot-band Ksp(T) >90°C; thermo ΔH tail (dolomite/siderite/witherite).
> 4. Build-candidates: quartz arc, weathering-epilogue, **stilbite+heulandite** (fills
>    the deccan_zeolite Stage-II narrative gap — a de-confab candidate), Gibbs-Thompson.
> 5. UI/partials: strip filter-rule UI, per-vertex chip-selector, broth-control verbs,
>    specimen-object B–E, edge-textures 11/17, sonifier musicality.
> 6. epidote loose ends: tormiq calcite aspirational (tune late CO3); swap the
>    clinozoisite/titanite/zoisite/adularia/byssolite stand-ins when those land.
>
> ## 🔬 UPDATE (2026-06-13) — REDOX-GATE OMISSION SWEEP: census DONE (2 real catches), fix HELD on an RNG prerequisite
>
> **Task #59.** The vanadinite catch (v193 — a redox-sensitive species whose
> engine was cloned without its redox gate) prompted a systematic census.
> **NEW: tools/redox-gate-census.mjs** — 166 supersaturation engines swept; a
> curated redox-class map (the geology: which oxidation state each diagnostic
> ion sits in) × mechanical gate-detection. It found EXACTLY two HIGH
> structural omissions: **sphalerite + wurtzite** — ZnS sulfides with no
> `sulfideRedoxAnoxic` gate, the last siblings of the omission galena carried
> until v13 ("a clear physics bug"). (native_gold was the lone INFO flag —
> gold is redox-robust, intentionally ungated; left as-is.)
>
> **The fix is correct physics but HELD — here's why (the science led here).**
> Dark-observe (**tools/sulfide-redox-omission-probe.mjs**): the gate bites
> ONLY supergene_oxidation (sphalerite σ>0 at O2 up to 2.2 in the Tsumeb
> gossan; everywhere else sphalerite/wurtzite fire only in reducing fluid, so
> the gate is inert). But adding it re-rolls supergene's shared-RNG cascade
> and demotes **mottramite 96% → 47% of seeds** (**tools/mottramite-frequency-
> sweep.mjs**, pre/post paired, 100 seeds). mottramite shares NO ion with ZnS
> → this is pure RNG-sequencing displacement, not chemistry. Confirmed: a
> Tsumeb-justified V-seep bump (+6→+13) raised mottramite's mean count but NOT
> its frequency (still 47%) — no chemistry lever can restore an RNG artifact.
> mottramite is a genuine abundant Tsumeb phase (Boni 2007), so 47% is a real
> under-representation. Net: shipping the gate now trades a modest gain (one
> sphalerite's overgrowth, 804→241µm) for a larger artifact-driven regression.
>
> **PREREQUISITE for the gate to land: per-mineral derived nucleation seeds**
> (the 15th-catch "scramble derived seeds" class) so gating one mineral can't
> scramble another's draws. Once that exists, the sphalerite/wurtzite gate
> lands clean. RIDER: Tsumeb's V-seep IS under-cooked (it reaches 7.5 vs
> minor-occurrence Caldbeck's 14; Tsumeb is a world-class vanadate locality) —
> a standalone V-richness correction (vanadinite stayed healthy at mean 6.0,
> arsenates intact in the experiment) to pair with the gate when it lands.
> The vugg-canary nightly sweep (PROPOSAL drafted) is the instrument that
> would validate the gate+RNG-derivation lands without regressions.
>
> **Shipped this session (pure tooling, no engine change, no SIM bump):** the
> three tools above. The census is the durable deliverable; the fix is scoped.
>
> **⭐ QUEUED NEXT — THE KEYSTONE ARC: per-mineral derived nucleation seeds.**
> This session promoted it from a footnote to the bottleneck. The held
> sphalerite/wurtzite gate isn't a one-off: because nucleation draws from one
> shared RNG stream, ANY gate change / engine retune to a high-traffic mineral
> re-rolls the whole cascade and can knock out unrelated abundant phases
> (mottramite 96→47% was the demonstrator). So a whole CLASS of correct
> physics fixes is currently unshippable. The fix: derive each mineral's
> nucleation RNG per-(mineral, cell) — the 15th-catch "scramble derived seeds"
> idea (already done for the MOVEMENT stream) extended to NUCLEATION. Natural
> sequence for the next stretch: **build vugg-canary → land RNG-derivation →
> then the held gate + future redox fixes land clean AND auto-validated.** The
> canary is what makes the RNG-derivation arc safe to attempt (it catches a
> regression at 04:00 instead of needing a hand-run sweep).
>
> **⚠️ THE TUNING TRAP (lesson, keep visible):** when a high-traffic engine
> moves and displaces a phase, the reflex is to chemistry-tune it back. That
> reflex is wrong when the displacement is RNG-sequencing — proven here, the
> Tsumeb V-bump raised mottramite's COUNT but not its FREQUENCY. Measure
> (frequency sweep) before tuning; the structural answer is RNG-derivation, not
> broth nudges.
>
> **SESSION-STATE NOTE (for the next builder, transient):** every commit since
> the CI-green `12833b9` (the redox-census tools commit + this BACKLOG edit) is
> DOCS/TOOLING ONLY — CODE-IDENTICAL to `12833b9`, no engine/test change. The
> `.ci-stamp.json` will read stale and vugg-session-start will want a 9-min
> cold-CI run; it's SAFE TO SKIP — the engine is byte-for-byte the
> verified-green tree (confirm with `git diff 12833b9 HEAD -- js tests-js` =
> empty). Stops vouching the moment the next engine commit lands. Also:
> `tools/strip-story-diff.mjs`
> is untracked = a concurrent session's WIP (duplicate of the shipped
> `strip-archive-diff.mjs`); leave it, don't `git add -A`.
>
> ## 🥈 UPDATE (2026-06-12) — MVT SILVER DE-CONFABULATION ✅ SHIPPED (SIM 195) + STRIP-STORY ARCHIVE (boss directive)
>
> **The boss-catch item below is CLOSED.** Source re-verification confirmed
> the fabrication: none of mvt's own references report district Ag; the
> Leach et al. 2010 USGS MVT model lists Ag "generally absent in most
> deposits"; the district record is Pb+Zn only. Broth Ag 5→0, anchor trued
> "Pb-Zn-Ag"→"Pb-Zn", confabulated notes corrected in scenarios.json5 AND
> data/locality_chemistry.json (tri_state entry + the bisbee cross-ref +
> viburnum's now-backwards "less argentiferous than Tri-State" — Viburnum
> is the documented byproduct-Ag district, its Ag=3 STAYS; greenockite
> STAYS at mvt, Cd-in-sphalerite per Schwartz 2000). Rebake: **1/33 moved
> — mvt 44→34 crystals, exactly −acanthite −native_silver (+celestine
> 3→1 cascade re-roll); the boss-verified glassy dogtooth survived
> 39.50→39.38 mm.** Inverted pins in tests-js/mvt-silver-deconfab.test.ts
> (the marble-aragonite retirement pattern).
>
> **NEW STANDING SUBSYSTEM — archive/strips/ (boss directive 2026-06-12):
> "we should be keeping them as a record of the story of the canonical
> seed 42 vugg."** tools/gen-strip-archive.mjs writes EVERY scenario's
> full per-step chip trajectories + nucleation events (the bells) to
> archive/strips/v<N>/ — ~2.5 MB per version, readable JSON. v194 was
> backfilled BEFORE the silver correction so the last confabulated-silver
> story is preserved as part of the record. Part of the standard rebake
> ritual now (bump FIRST — the tool refuses to overwrite an existing
> version folder; the gen-baseline footgun is guarded here). The
> session-start skill's step-4 ritual list was updated. OPEN SLIVER:
> backfill of pre-v194 versions is possible by checking out old commits
> and running the tool — do it opportunistically if a session has idle
> CPU; oldest stories are the most erosion-prone.
>
> ## ⚗️ UPDATE (2026-06-12, earlier) — CARBONATE Ksp(T) ANALYTIC ✅ the pK debt's SIBLING closed in the validated band (SIM 194)
>
> **Session handoff: `HANDOFF-VSUITE-AND-KSP-2026-06-12.md`** — the
> evening session's advice doc (attribution-vs-fact on twice-reverted
> variables, cloned-engine gate omissions + the proposed redox-gate
> sweep, validity clamps vs shared-domain clamps, the throwaway rebake
> as measurement, the gen-baseline version-bump footgun, the observe-
> tool template, the ranked queue). It extends
> HANDOFF-PKT-AND-FIX-SWEEP-2026-06-12.md — read both before picking up
> the hot-band Ksp promotion or the redox sweep.
>
> js/20c's constant-ΔH van't Hoff logKsp(T) → the PHREEQC analytic
> expression (wateq4f.dat verbatim) for the carbonates the database ships
> one for: **calcite, aragonite, strontianite, witherite**. The mixed-
> fidelity seam the v192 pK fix exposed (IAP exact, Ksp flat — ~1.3 log
> too flat at 158°C) is now CLOSED below 90°C. NEW instrument
> **tools/ksp-t-observe.mjs** (--table science pin / --fleet dark-observe).
> --verify improved 7→9 (calcite + aragonite now match wateq4f on both
> logKsp AND ΔH; the vestigial deltaH_diss was trued to the analytic's
> implied value).
>
> **THE CLAMP DECISION (the load-bearing judgment):** the PB82 calcite/
> aragonite -analytical are ~90°C SOLUBILITY FITS. A first rebake at a
> [0,250] clamp (matching the pK side) was a RUNAWAY — +3.4 SI at the cap
> overwhelmed the old-SI-calibrated gates: sunnyside calcite DOUBLED, mvt
> LOST its silver suite, and the metastable HOT aragonite v192 retired
> REANIMATED. So the analytic is held to its fit validity
> (_THERMO_ANALYTIC_CLAMP_C [0,90]) and frozen flat above. Clean rebake
> at clamp-90: **9/33 moved, every move a single-crystal +aragonite in a
> WARM (≤~100°C, Folk 1974) scenario + minor cascade re-rolls; calcite
> stays 1 everywhere, mvt silver PRESERVED, nothing lost fleet-wide.**
>
> ~~**NEW OPEN ITEM — mvt silver de-confabulation** (boss catch
> 2026-06-12)~~ ✅ SHIPPED SIM 195 — see the 🥈 banner above. Greenockite
> stayed; the dogtooth survived; 1/33 moved.
>
> **NEW OPEN ITEM — hot-band carbonate Ksp(T) promotion** (the remaining
> sliver): activating the analytic above 90°C (where genuine hydrothermal
> calcite forms, mvt/cooling/epithermal 150-280°C) needs the calcite +
> aragonite GATE re-calibration for the new SI scale + aragonite
> metastability HARDENING (a hard T-gate so raw SI can't reanimate the hot
> polymorph). That is what restores the cooling DIRECTIONAL retrograde pin
> (still bounded-drift). It also wants high-T Ksp coefficients (llnl/SUPCRT,
> fitted to 300°C) rather than extrapolating PB82. Composes with the open
> dolomite/siderite/rhodochrosite/smithsonite ΔH items (still --verify
> mismatches; this arc cleared calcite+aragonite).
>
> ## 🔴 UPDATE (2026-06-12, earlier) — CALDBECK V-SUITE ✅ mottramite DELIVERED (SIM 193): the twice-deferred roughten_gill V-axis arc, closed by measurement
>
> **Task #55 CLOSED.** mottramite was a dead-species pair with descloizite
> fleet-wide while its V-gate sat at 10 — 5× vanadinite's 2 — backwards
> against the deposits (the descloizite group ARE the abundant supergene
> V ores; Boni et al. 2007 Econ Geol 102:441). The gate census
> (**tools/roughten-gill-mottramite-probe.mjs**, NEW) found three faults,
> each fixed and pinned:
> - **FIX 1 — vanadinite's MISSING redox gate.** Pb5(VO4)3Cl is a V⁵⁺
>   vanadate like its O2_min-0.5 siblings, but its engine was cloned from
>   pyromorphite (PO4 — no redox gate) and the requirement never came
>   along. Census proof: all 6 roughten_gill vanadinite nucleated at
>   O2 0.20 (reducing). Added O2_min 0.5 + phosphateRedoxAvailable.
> - **FIX 2 — descloizite-group V-economics.** V_min 10→4, v_f /20→/8 for
>   both members → vanadinite-comparable V economy. FREE WIN: mottramite
>   now also fires at supergene_oxidation (Tsumeb, 0→2) — its own
>   type-abundance locality.
> - **FIX 3 — roughten_gill supergene V-leach.** The scenario's own header
>   said wallrock V 10-20 ppm "leaches in the supergene window," yet
>   fluid.V sat STATIC at 6. Added V 6→14 to the step-70 oxidation event
>   (where O2 jumps 0.05→1.2 — V⁵⁺ mobilizes at oxidation onset). Fires
>   AFTER the step-25 primary lockup, so it CANNOT reproduce the v109/v180
>   failures (those bumped INITIAL-broth V from step 0 and halved
>   sphalerite). **The V axis was never the problem — its PLACEMENT IN
>   TIME was.** mottramite 5 at seed 42; primaries intact (sphalerite
>   2→3, galena 4 unchanged).
>
> Rebake 2/33 (roughten_gill +mottramite −duftite [the As-vs-V fork
> routing Pb-Cu to the vanadate — correct]; supergene_oxidation
> +mottramite). duftite still lives at supergene_oxidation. Coverage:
> mottramite dead→live. NEW test **vanadate-v-economics.test.ts** (10).
> Lesson for the queue: a "touchy axis" reverted twice may be a
> mis-PLACED intervention, not a forbidden one — census WHERE in the run
> a change lands before blaming the variable.
>
> ## ⚗️ UPDATE (2026-06-12, earlier) — CARBONATE pK(T) CORRECTED (SIM 192, `d683a33`): review §2.2's oldest calibration debt CLOSED; its sibling exposed
>
> **Session handoff: `HANDOFF-PKT-AND-FIX-SWEEP-2026-06-12.md`** — the
> next builder's advice doc (consumer-structure blast-radius prediction,
> mixed-fidelity seams, per-pin verdicts, the richer-claim move, judges
> rot at the gate, the restore ladder, the ranked queue). Read it before
> picking up mottramite or the Ksp(T) upgrade.
>
> js/20b's linear pK fits → the full PB82 analytic expressions,
> verified verbatim against canonical wateq4f.dat; clamp 80→250 °C.
> NEW instrument **tools/pk-t-observe.mjs** (--table science receipt /
> --fleet dark-observe). Rebake 12/33: headline loss = HOT-SCENARIO
> ARAGONITE (geologically correct — the low-T polymorph never belonged
> at 150–700 °C); coverage IMPROVED live 133→135, dead 36→34. Re-pins,
> each measured: mvt dogtooth survives with a small stepped CORE
> (the Tri-State PHANTOM read — claims table updated); elmwood pulse
> train re-pinned (amps ×1.15 + width 0.08 — calibrated in old
> constants' units; judge 8/8, headline gate trued); marble aragonite
> pin inverted; sunnyside pyrite ≥0.99 smooth.
>
> **NEW OPEN ITEM — carbonate Ksp(T) analytic upgrade** (the pK debt's
> sibling, exposed by the fix): Ksp(T) is still constant-ΔH van't Hoff,
> ~1.3 log units too FLAT at 158 °C vs PHREEQC's calcite analytic. With
> the IAP side now exact, the mixed fidelity flips the cooling-scenario
> SI drift mildly positive (bounded, re-pinned). The upgrade = analytic
> expressions in thermo-carbonates.json + 20c, then restore the
> retrograde-direction pin. Composes with the open dolomite/siderite ΔH
> items in the thermo-verification note.
>
> **STILL QUEUED from the calibration-debt arc:** ~~roughten_gill
> mottramite gate-census~~ ✅ DONE (SIM 193, the 🔴 banner above) —
> Ksp(T) analytic upgrade is now the front of the queue.
>
> ## 🔧 UPDATE (2026-06-12, earlier) — FIX-BACKLOG SWEEP ✅ COMPLETE (SIM 190→191, six commits): every open follow-up from the morphology arc closed in one session
>
> The 🌳 banner's "OPEN follow-ups" list below is now ✅ DONE end to
> end (ledger with commits in
> **HANDOFF-MORPHOLOGY-GENERALIZATION-2026-06-12.md §5**, updated in
> this pass):
> - **wittichen barite (SIM 191, `f030f67`)** — the *Barytgänge*
>   correction. The v189 "needs oxidation" diagnosis was WRONG: the
>   new gate census (**tools/wittichen-sulfate-probe.mjs**) measured
>   σ pinned at 0.60 with every gate component passing — barite was
>   BARIUM-limited (ba_f 24/30 × s_f 30/40 × salinity-24 activity
>   ≈ 0.59 can't reach 1 at ANY Eh). Ba 24→75 (the district's veins
>   are literally barite-gangue veins): σ 1.47–1.55, barite 8/8 seeds
>   (2–6 crystals), NO witherite, living arsenide suite intact, no Eh
>   change. Judge gained the barite column (8/8). Rebake: 1/33
>   baselines moved (wittichen, +barite only), 1/12 digest.
>   **erythrite DEMOTED from expects by measurement** — its gate needs
>   T ≤ 50 °C, the sealed vein ends at ~150 °C; the cobalt bloom is
>   post-exhumation weathering. NEW open item: a spatially-partial
>   **weathering-epilogue mechanic** (schneeberg's step-110 vadose
>   pattern made partial; the Drain above-meniscus oxidation is the
>   existing half) — erythrite is its first client.
> - **dendrite TREE 3D render (`a7a3b35`, sim-neutral)** —
>   _makeDendriteTreeGeom: deterministic per-crystal branching
>   skeleton ({100}-quantized fishbone azimuths, lower-branches-longer
>   depletion taper, ~200 tris), dispatched on token 'spike' +
>   dendritic/arborescent habit; acicular/fibrous needles untouched.
>   Verified in live preview: bisbee's four dendritic gold render as
>   branching golden trees. Watch-it-grow comes free from envelope
>   scaling (static shape, no per-step churn).
> - **⚒ Slams — the sonifier dendrite bell (`22154a6`, sim-neutral)** —
>   anvil strike per UPWARD morph-ordinal crossing (severity ladder
>   C5→C4→C3→G2; the dendrite arrival adds a +1-semitone dissonant
>   partner; healing is silent; sparse-MAX read pans to the driven
>   crystal). Rides the 🔔🔊 bus; toggle next to ▽ Depletion. A
>   recorded wittichen strip rings the 98 Hz toll in tests (5 new).
>   jsdom is deaf — needs the boss's EAR like all sonifier work.
> - **pyritohedral token wart (`0a3a465`)** + **octahedral_REE sibling
>   (`6624713`)** — BOTH had hex-prismed in the 3D view (since v27 and
>   v103). Token-fallthrough is a FAMILY: fixing one string, grep for
>   the siblings. Pyritohedral family → dodecahedron token; REE family
>   → octahedron.
> - **σ-stepped REE octahedra (`6624713`, byte-identical)** — fluorite's
>   ladder grades BOTH forms now; fleet-inert by measurement (sunnyside
>   flat at σ 1.95) until a driven Y-fluorite scenario lands; the
>   terraced-octahedron geometry deliberately NOT built (per-vertex
>   lesson — no inert renders without a tenant).
> - **narratives md variants (`50553e7`)** — all new morph prose
>   md-backed (halite.md NEW, manifest 92→93 — loads clean in-browser);
>   found+fixed: pyrite's striated_ habits had NO narrator branch.
>
> Remaining open from the morphology line: the **quartz arc** (design
> doc ready; sceptre two-body = the dendrite tree's sibling), the
> **weathering-epilogue mechanic** (new), the boss's hand-verification
> pass (now including wittichen barite + the tree silhouettes + the
> slams by ear), and two cosmetic debts (striated pyritohedra render
> groove-less; replay-historical habits need per-step habit history).

> ## 🌳 UPDATE (2026-06-12, earlier) — MORPHOLOGY GENERALIZATION ✅ COMPLETE (SIM 190) — master doc: **HANDOFF-MORPHOLOGY-GENERALIZATION-2026-06-12.md** (the ALL-MINERAL claims table §2 = the boss's verification worksheet; ninth-tenant recipe §3; traps §4). v190 = the verification pass's FIRST CATCH (mvt Joplin dogtooth — boss's eye beat 1861 tests; CATCHES v190).
>
> The calcite arc's classifier became the MORPHOLOGY REGISTRY
> (js/45-morphology.ts) and the boss's wish-list started shipping the
> same night, eight commits: **registry hoist** (`b6ba453`,
> byte-identical — calcite is MORPH_TH.calcite, 100% map agreement,
> baselines untouched); **morph-sigma-observe** (`a07b87d`) the GENERIC
> per-mineral post-step σ survey instrument (one tool now serves every
> list item); **halite + sylvite** (`90fac90`, sim-neutral) — the
> salt-pan log (searles 67% banded / 33% hopper, 8/8-seed judge
> tools/halide-hopper-observe.mjs; the ladder CORRECTED the legacy
> in-step rule, which called bisbee's smooth supergene cubes hopper) +
> NO-damping physics (convective brine, Berg effect — per-mineral knob)
> + sparse-max digest reduction (first regen exposed the all-null
> mid-ring averaging bug); **halide 3D render** (`2bbfd19`) grooved
> cube ziggurats + funnel tops, with two verification catches (cube
> habits token-routed to HEX PRISMS pre-fix — 'hopper_growth' had done
> that silently since v27; terrace cache sig regime[0] collision);
> **bismuth corrected ladder** (`adffa68`, SIM 188 — the old dispatch
> ran ANTI-Sunagawa, massive at top σ / dendrite at bottom; rng-cascade
> bump, measured 0/32 movers); **wittichen** (SIM 189) — the
> five-element vein (Kissin 1992; Burisch 2017 CH4 reduction trigger):
> declared Eh pulse −320 @ u 0.58, Bi σ plateaus at its
> activity-compressed ceiling (2.27 measured vs ~4.5 dilute — band
> edges re-pinned to the MEASURED trajectory), native Bi carries 39–49%
> DENDRITIC zone mass at 8/8 seeds (tools/wittichen-dendrite-observe),
> skutterudite + safflorite DE-ORPHANED (first scenario home),
> native_silver→acanthite tarnish story, bismuth_morph chip
> digest-pinned slamming 0→4 on the pulse. Research docs:
> RESEARCH-halide-morphology-2026-06-12.md +
> RESEARCH-bismuth-morphology-2026-06-12.md (the latter records the
> overturned premise: schneeberg's v185 movement is the WEATHERING
> direction — it correctly DESTROYS Bi; the shock needed a new
> scenario).
>
> **THE LIST IS COMPLETE (same session, continued):** fluorite
> (sim-neutral — elmwood is now the TWO-MINERAL showcase, calcite_morph
> + fluorite_morph digest-pinned co-pulsing on the fault-valve beats;
> mvt pins the stays-glassy guard; the REE octahedra compose untouched);
> pyrite striations (sim-neutral — striations ARE bunched steps;
> sulphur_bank 86% striated, mvt zoned 51/49, sunnyside smooth
> Navajún-glass euhedra; form stays T-driven, the regime OVERLAYS
> striated_; 'sulfide' legend group opened); native copper + gold (the
> conflation sweep — nugget + massive_sheet retired from σ-dispatch as
> placer/fissure TEXTURES; bisbee gold reads spongy/fishbone as it
> should, and bisbee's copper tree records 33% dendritic mass on the
> −400 pulse then dissolves into the azurite era — THE CAST STORY);
> quartz = RESEARCH-quartz-morphology-2026-06-12.md (deliberately a
> design doc: quartz needs a ZONE-STACK PATTERN classifier for sceptres
> — hiatus-then-renewal, the registry's second classifier KIND — plus a
> fenster σ-top band and a Tessin form rule gated on a future
> alpine-cleft scenario; splitting/faden named out of scope).
>
> **Registry census at arc close: 8 minerals** (calcite, halite,
> sylvite, native_bismuth, fluorite, pyrite, native_copper,
> native_gold), 6 morph chips digest-pinned, 3 standing judges
> (elmwood/halide/wittichen), 1 generic survey instrument.
>
> **OPEN follow-ups: ✅ ALL CLOSED same day — see the 🔧 FIX-BACKLOG
> SWEEP banner above (SIM 190→191, six commits).** The original list,
> for the record: wittichen barite + erythrite (shipped/demoted-by-
> measurement, SIM 191); dendrite TREE render (shipped); pyritohedral
> token wart (shipped, + the octahedral_REE sibling it exposed);
> σ-stepped REE octahedra (shipped, fleet-inert by design); sonifier
> dendrite bell (shipped — ear verdict pending).

> ## 🪜✅ UPDATE (2026-06-11, latest) — CALCITE MORPHOLOGY ARC SHIPPED, ALL SIX PHASES (SIM 187 + elmwood)
>
> The boss unblocked via goal directive ("follow the science") and the
> whole arc landed the same day, five commits: **Phase 0+1** (`889dfc4`)
> post-step classifier in the engine (the 18TH CATCH moved it out of
> grow_calcite — in-step vs post-step σ basis mismatch, 0% agreement on
> stalactite, 1598/1598 after; see CATCHES.md) + zone tags + the
> `calcite_morph` strip chip + zone-modal lines, sim-neutral; **Phase 2**
> (`8e9752c`) the stepped_/hopper_/dendritic_<form> habit alphabet,
> aspect-preserving so the predicted SIM bump WASN'T needed; **Phase 3**
> (`295e150`) VISIBLE TERRACES from the zone stack (calciteTerraceBands +
> hex-ziggurat geometry, replay-truncating so terraces accumulate as you
> scrub — the watch-it-grow ask, verified in-browser); **Phase 4**
> (`a13de4f`, SIM 187) the Mg axis (form elongation Mg:Ca>0.15 + bunching
> bias k=0.4, calibrated by fleet sweep); **Phase 5** the `elmwood`
> showcase (Central TN MVT, Gratz & Misra brines; fault-valve CO3+pH
> pulse-train movements; 12.4 mm golden stepped_scalenohedral at 8/8
> seeds, full assemblage 8/8 — tools/elmwood-stepped-observe.mjs is the
> standing judge) + the SIZE_DAMP_CAP_UM=2000 bounded-boundary-layer
> correction the showcase forced (Wolthers's δ is fixed, not
> size-proportional; marble/deccan→mild, jeffrey→stepped, mvt stays
> smooth, all defensible — and it answered the old ⛔ decision (1) by
> physics: the damping WAS too hard at giant scale). Master doc's
> SHIPPED footer has the full ledger:
> **proposals/HANDOFF-CALCITE-MORPHOLOGY-2026-06-11.md**.
>
> Residual debts (small, non-blocking): narratives/calcite.md md-side
> variants for morph_stepped/morph_hopper (inline fallbacks ship);
> elmwood dolomite gangue 0/8 (aspirational — saddle dolomite is real
> Elmwood gangue); macro-dominant Elmwood deliberately NOT chased (fine
> mm-scale stepped rim on a massive golden core IS the hand specimen).
>
> **OPEN — BOSS HAND-VERIFICATION PASS (the arc's true final gate):**
> comparing each scenario's morphology claim against real specimens
> from its locality. The worksheet + knob map for whoever applies the
> findings: **proposals/TUNING-CALCITE-MORPHOLOGY.md** (per-scenario
> claims table, disagreement playbook, what's chemistry-coupled vs
> free). Boldest claims to check first: jeffrey STEPPED-dominant and
> marble stepped(mild) — both are SIZE_DAMP_CAP_UM consequences; the
> locality is the authority, the literature was scaffolding.

> ## ⚗️ UPDATE (2026-06-11, latest) — EVENT-SUBSUMPTION COMPLETE (SIM 186): both bisbee + schneeberg redox step-functions retired into declared movements
>
> The "EVENT-CONFOUNDED redox" gated class (bisbee/schneeberg) is now
> CLOSED — both members subsumed in one session. **bisbee shipped (SIM
> 186):** the harder of the two, because its redox is NON-MONOTONIC (nine
> event O2 writes trace −150 → +180 → a deep reducing dip → +280, a true
> rollercoaster), so the movement uses the full primitive alphabet — a
> `step` front (+330 at u=0.233, rising from the step-65 uplift), a `pulse`
> sag (−60, the enrichment-blanket poise), a deep `pulse` (−400 at u=0.436,
> the barren reducing window that grows the Cornish-style native-copper
> trees), and a late `trend` (+100, the azurite-era oxidation climb).
> Window 0→305 = the phreatic life, ending at the step-305 final_drying
> drain (air owns redox after). Deterministic; gate whole at 8 seeds
> (native_copper 5/5 — the −400 pulse is load-bearing, −330 dropped it
> below 5/8; brochantite 8/8; malachite/chrysocolla cascade whole).
> Single-scenario rebake (bisbee: species 30→29, crystals 74→71,
> −jarosite, a seed-42 marginal still live fleet-wide). Coverage UNCHANGED
> 133/2/36. Logged BASE-side debt: azurite 0/8 — the famous Bisbee Blue
> isn't nucleating; its own future tune arc.
>
> **NEXT (Movements):** roughten_gill baseline-debt re-survey (v180 partly
> cleared it), carbonate pK(T) slopes (§2.2 pure follow-the-science debt).
> The "biggest lever" (T-reconciliation) and the redox-confound class are
> both now done — what remains is calibration debt + specialized gated
> classes (assemblage-cost, concentration-confounded), not engine work.
>
> ## ⚗️ UPDATE (2026-06-11) — EVENT-SUBSUMPTION BEGINS (SIM 185): schneeberg's scripted redox swing retired into a declared movement
>
> The first of the arc. The master doc's
> "EVENT-CONFOUNDED redox" class (bisbee/schneeberg — redox already
> dynamic, but told as a step function through scripted event O2 writes)
> starts closing. **schneeberg shipped (SIM 185):** its redox was a step
> function (O2:0.0 pegmatitic → a single-step flip to O2:1.5 at the
> step-85 meteoric flood). Now it's a DECLARED fluid.Eh movement (window
> 0→110, base −200 mV, one step op +490 at u=0.8): reducing pegmatitic
> plateau, then a ~8-step sulfide-buffer-exhaustion swing to +290 mV
> centered at step 88. **First scenario where a movement REPLACES scripted
> event redox** instead of adding a story to a flat field — the naica
> composition pattern (events keep the P/As/Cu/Ca chemistry beats, the
> movement is the redox sentence), applied to Eh.
>
> * **Window boundary is geology**: ends at the step-110 vadose exhumation
>   because a redox movement lives in GROUNDWATER — once the water table
>   drops, air owns redox (the vadose O2 floor 1.8 ≡ the flat +322 mV the
>   strip always showed after 110). Ending there also keeps the
>   Eh-canonical sync from fighting the vadose override (dodged by
>   construction, not patched).
> * **Measurement chose the shape** (tools/eh-subsumption-observe.mjs, NEW
>   instrument). A front centered at 80 (oxidation BEFORE the meteoric
>   arrival — backwards) cost naumannite 7/8→5/8 + torbernite lineage
>   8/8→7/8; the canon-true front (88) keeps every reducing-era nucleation
>   BYTE-IDENTICAL to BASE. OU texture anywhere re-rolled 1-crystal
>   marginals → DETERMINISTIC ships (naica no-noise precedent).
> * **16th catch** (pre-ship, by the instrument): expects_species is BLIND
>   to renamed crystals — torbernite→metatorbernite via step-110 vadose
>   dehydration, so a candidate that killed the type-locality lineage
>   still read ✓. Cure: the gate checks LINEAGES (either form counts).
> * Single-scenario rebake (schneeberg only: species 31→31, crystals
>   77→76, +cuprite −dioptase). Coverage UNCHANGED (133/2/36). Logged
>   BASE-side debt: haidingerite 0/8 (dead expects, future tune arc).
>
> **NEXT in the arc: bisbee** — observed + shape locked this session (the
> nine-beat rollercoaster: step front at u=0.23 from the step-65 uplift,
> a −60 enrichment-blanket sag, a deep −400 reducing pulse at u=0.44 for
> native copper, a +100 late oxidation trend; deterministic; gate whole at
> 8 seeds). Not yet shipped — a clean stopping point. Then the master
> doc's remaining: roughten_gill re-survey, carbonate pK(T) slopes.
>
> ## 🏁 UPDATE (2026-06-10) — T-ROLLOUT COMPLETE (SIM 184): all eight T-blocked scenarios swept, each by its measured shape
>
> The Movements master doc's "biggest lever" sub-project is CLOSED
> end-to-end in one day: v181 (mechanic: dedicated thermal stream +
> stand-down) → v182 (naica-shape demonstrated) → v183 (pegmatite-shape
> demonstrated + the classification) → **v184 (the remaining six, each by
> observation)**. Per-scenario verdicts, all dark-observed
> (tools/t-story-observe.mjs, 3 seeds each):
>
> * **marble** — flag (one intrusion, one arc; pulse-Fe poisoned the
>   ruby-vs-sapphire chromophore budget). Byte-identical at seed 42.
> * **deccan** — flag + cooling_rate 0.3 + a **fluid.SiO2 constant-setpoint
>   MOVEMENT** (950, steps 110-200): the sweep's deep find — the pulses'
>   SiO2 riders were the scenario's de-facto silica budget (apophyllite
>   gate ≥800; flag-only KILLED an expects at every seed). Ottens' "long-
>   lasting late stage" = a sustained groundwater regime = exactly what a
>   constant-setpoint movement models. First non-T movement; first ops:[]
>   setpoint. Fill IMPROVES 0.07-0.18 → 0.28-0.30; wollastonite (a skarn
>   mineral in an amygdale) correctly exits.
> * **radioactive_pegmatite** — flag (sealed pocket; a late pulse had
>   re-warmed the endgame to 541°C with autunite T_max=50 in expects; the
>   ≤50°C window now opens deterministically every run).
> * **cooling** — declared BURIAL MOVEMENT (base 180, −20 smoothstep; peak
>   Alleghenian plateau) + flag. Old regime was noise-as-thermal-budget
>   (2-3 random pulses accidentally balancing the drift, band 65-86%).
>   Now: band 100% and crystal count 3→1 — ONE large doubly-terminated
>   quartz, the literal Herkimer signature (fewer-nuclei mechanism, second
>   locality).
> * **porphyry + epithermal** — pulses KEPT, deliberately, documented in
>   their notes (do not re-litigate): episodic injection IS the porphyry
>   class; epithermal's pulses are load-bearing AND native (fault-valve
>   boiling is the heat supply — without them it crashes to the floor,
>   fill →0.00).
>
> Rebake: 3/31 moved (cooling/deccan/radioactive; marble byte-identical),
> coverage UNCHANGED (133/2/36). Logged aspirational misses for future
> tune arcs: epithermal native_gold + fluorite, radioactive autunite at
> seed 42, gem topaz. NEXT Movements work: event-subsumption
> (bisbee/schneeberg) per the master doc's queue.
>
> ## 💎 UPDATE (2026-06-10, earlier) — NAICA'S THERMAL STORY (SIM 182): the first declared temperature movement
>
> The first consumer of the v181 unlock, shipped the same day. naica's
> buffered pool is now a DECLARED movement (base 56°C, smoothstep −3 over
> steps 0-260, NO OU texture — Naica's fluid-inclusion record shows a
> steady bath, so no-noise IS the science) + `thermal_pulses:false` +
> `cooling_rate:0.1` for the post-drainage era (the mining events own T
> after 260 — the thermal buffer was the WATER). The six slow_cooling
> events keep their chemistry half (anhydrite Ca/S resupply); their −0.7°C
> drops are superseded: **events are the chemistry beats, the movement is
> the thermal sentence.** Dark-observed first (tools/naica-thermal-observe.mjs,
> 3 seeds): García-Ruiz band occupancy 0→50%, selenite sweet-spot 0→31%,
> pulses 13-18→0 — and the García-Ruiz mechanism EMERGED rather than being
> scripted: total crystal count dropped ~40-60% (27→11, 39→16) while the
> cavity still seals. Fewer nuclei, larger individuals. The low-T noise
> feeders (opal, goethite, lepidocrocite, tigers_eye, pyrolusite) drop
> out; the cave trends toward its real near-monomineralic character.
> Single-scenario rebake (1/31 moved, fleet byte-identical), coverage
> unchanged (133 live / 2 stale / 36 dead), strip contracts hold and mean
> more now (the isothermal brine the SI pin always assumed is finally the
> recorded trajectory).
>
> **SAME DAY, v183 — gem_pegmatite + THE ROLLOUT CLASSIFICATION.** Mapping
> gem_pegmatite found the second shape: its eight events SET temperature
> (620→…→300 — the documented three-phase curve is already fully
> event-anchored), so a movement would CLOBBER a working design. Scenarios
> carry T stories in TWO SHAPES: **naica-shape** (events don't own T →
> declare a movement) vs **pegmatite-shape** (events anchor T → silence the
> ambient noise: thermal_pulses:false ± cooling_rate). gem_pegmatite got
> the flag (sealed miarolitic pocket = no fracture injections; pulse Fe
> riders were fighting the li_phase Fe-depletion that makes elbaite; a late
> pulse re-warmed the ended system to 476°C vs the 300°C floor). Measured
> BYTE-IDENTICAL baseline (seals before the divergence reaches records) —
> bump for the live T channel. **And the v181 decoupling visibly worked:
> the flag re-rolled NOTHING** (pre-v181 it would have re-rolled the whole
> scenario). New general instrument: `tools/t-story-observe.mjs` (BASE vs
> flags/movement, expects-survival check — supersedes the naica-specific
> observer). REMAINING CLASSIFICATION (from the T-setter grep): marble
> (700/500/350), deccan (200→80 ×5), radioactive_pegmatite (450→18 ×11)
> are pegmatite-shape → observe-then-flag, one arc each, expect
> near-neutral rebakes. `cooling` (events:[]) is pure naica-shape — a
> declared Herkimer burial-T story. porphyry + epithermal: mixed/unmapped,
> observe first.
>
> ## 🌡️ UPDATE (2026-06-10, earlier) — T-RECONCILIATION SHIPPED (SIM 181): ambient_cooling subsumed onto a dedicated thermal stream, full-fleet rebake, T-blocked scenarios OPEN
>
> The Movements master doc's #1 lever is DONE. `ambient_cooling`'s drift +
> thermal-pulse draws (~2 shared draws/step in EVERY scenario, +1..6 per
> pulse with SiO₂/Fe/Mn/flow/pH riders) moved off the shared rng onto
> `sim._thermalRng` — run-seed-derived (85j `_makeThermalRng`: weather, not
> geology — contrast the movement stream's shape_seed) and SCRAMBLED (bare
> XOR left nearby seeds with correlated streams; the probe measured
> tutorial pulse variance collapse to ±0.00 before the fix shipped). The
> mechanic itself is UNCHANGED — same drift law, same state-dependent
> fracture-valve pulse arrival — verified statistically by the new standing
> instrument `tools/t-reconciliation-probe.mjs` (LIVE-vs-SHADOW fleet sweep
> + multi-seed sentinel distributions). STAND-DOWN shipped with it: a
> scenario movement on `temperature` owns T for its window (ambient
> yields, resumes at endStep) — **naica (19 random pulses/run holding up
> its "stable pool"!), both pegmatites, marble, porphyry, epithermal,
> deccan, cooling are now open to declared thermal stories**, each its own
> per-scenario arc with single-scenario rebake. Full-fleet rebake landed:
> seed42_v181 + strip_digest_v181, 26/31 scenarios moved, assemblages
> in-family (worst Jaccard 0.50 on the 3-crystal `pulse` scaffold), stale
> count UNCHANGED at 2 (jeffrey magnetite + mottramite, the deliberate
> arcs), dead 35→36 (borderliner flap, tremolite-class). Two
> realization-lucky test pins converted to widened coverage checks (the
> v135/v137 pattern): sicily native_sulfur (fires 15/16 seeds, threshold
> ≥6/8) + sulphur-bank's cooling-event pin (now ambient-off via the knobs,
> deterministic). New tools: t-reconciliation-probe.mjs +
> baseline-diff.mjs (the rebake-review companion gen-js-baseline's header
> always asked for). Tests 1787 → 1794.
>
> ## 🗿 UPDATE (2026-06-10, earlier) — SESSION HANDOFF: gates + narrators
>
> **`proposals/HANDOFF-GATES-AND-NARRATORS-2026-06-10.md`** is the handoff
> for the 2026-06-10 second session (the redox round-trip gate, the
> ring_fluids retirement + 14th catch, the §2.4 narrator afternoon, the
> concurrent-session commit-title collision, and the Movements
> re-orientation — the mvt pilot was ALREADY shipped+accepted; next real
> Movements work is the T-RECONCILIATION sub-project, fresh session, fleet
> rebake). Lessons 13–18 continue the prior handoff's twelve. CATCHES.md
> holds FOURTEEN. Next builder: prior session's handoff first if cold
> (HANDOFF-REVIEW-REBAKE-MUSIC-2026-06-10.md), then that one, then the
> banners below.
>
> ## 📖 UPDATE (2026-06-10, earlier) — the §2.4 NARRATOR/SPEC AFTERNOON: 15 corrections, SIM-NEUTRAL
>
> Part II's next-step #3 is DONE. All 15 shippable rows of the review's
> §2.4 table executed — wurtzite's 95°C "boundary" myth (equilibrium
> inversion is ~1020°C; low-T wurtzite is metastable, 95°C stays as the
> declared SIM GATE), flos ferri de-ironed (pure aragonite named for the
> Eisenerz mines), the Liberty patina re-assigned to brochantite+antlerite,
> hiddenite returned to Alexander Co. NC, scheelite UV prospecting moved to
> the 1930s-WWII, Volodarsk returned to Ukraine, the pyritohedron made
> crystallographic again ({210}, pseudo-fivefold), topaz's garbled
> "Iapetos-age" line rewritten, witherite 811°C re-labeled as the
> polymorphic transition, selenite dehydration routed via bassanite,
> aragonite dry inversion 520→450°C, wulfenite freed from needing discrete
> molybdenite (Red Cloud/Mežica have none), meta-autunite 8→6 H₂O, naica's
> boundary made internally consistent (~58°C), ACTIVITY_DAMPING comment
> drift trued (shipping 0.25). Narrator md + js fallback fixed in PAIRS.
> **DEFERRED as engine-coupled** (each needs a calibration-aware arc):
> calcite's flos-ferri habit_variants entry (selectHabitVariant RNG-draws
> from that list — removal shifts the fleet cascade) and the
> aragonite-vs-calcite Mg/Ca gate (review §2.4 last row). Still open from
> §2: the 5 unvouched twin-law citations (literature pass) + carbonate
> pK(T) slopes (§2.2, calibration-coupled).
>
> ## 🪞 UPDATE (2026-06-10, earlier) — ring_fluids RETIRED as a store: replay snapshot now projects cell chemistry (review §1.4, SIM-NEUTRAL) + 14th CATCH
>
> Part II's next-step #2 is DECIDED AND DONE — retire, not restore (the
> boss's standing v157 direction: "mesh.cells is the way to go"). The
> non-equator `ring_fluids` slots froze at the initial broth when v159
> re-pointed event propagation at the voxel grid; their one live consumer
> — the REPLAY SNAPSHOT chips — was faithfully displaying that frozen
> chemistry (the replay-mode sibling of the v157 pyramid artifact). Final
> design: `_ringFluidMeans` (85c) computes the per-ring cell-mean
> projection AT SNAPSHOT CAPTURE (~63 captures per 200-step run) directly
> into `snap.ring_fluids`; the LIVE store is untouched — frozen slots stay
> frozen, so the sim path is byte-identical BY CONSTRUCTION. Untouched,
> deliberately: the equator alias (`ring_fluids[equator] ===
> conditions.fluid`, load-bearing, the Tranche-6 borax lesson) and
> `concentration` (vadose-mirror-owned, same exclusion as diffusion).
> **14th CATCH rode along** (CATCHES.md): the FIRST cut synced the live
> store every step — probe-exact, seed-42-identical, and it TIMED OUT four
> 32-seed integration tests (1.32 ms/call ≈ 12% of a step under 3×
> parallel-load inflation). The reds were mineral-firing tests and the
> obvious "fallback readers saw new chemistry" theory was WRONG (census:
> 0 fallback hits in 8,966+ crystal-step reads; failure text said
> `Test timed out`). Time budgets are part of the contract; read the
> failure text before theorizing the failure mode. New standing
> instruments: **`tools/ring-fluid-view-probe.mjs`** (3-invariant
> contract: store FROZEN / projection LIVE / alias INTACT) +
> **`tools/cell-resolution-census.mjs`** (how often does the engine
> fallback actually fire?). 5 tests pin the projection, the bulk-view
> equator entry, concentration ownership, the frozen-store contract, and
> the snapshot fix. Stale comments trued (`_propagateGlobalDelta` header +
> constructor Phase-C block). Next per Part II: §2.4 narrator one-liners…
> or the **Movements Phase 1 pilot on mvt, which now has NOTHING in front
> of it.**
>
> ## ⚡ UPDATE (2026-06-10, earlier) — MOVEMENTS GATE CLEARED: ehFromO2 ↔ o2FromEh exact (SIM-NEUTRAL)
>
> Part II's next-step #1 is DONE. The 10× saturation-slope asymmetry above
> the top anchor (`ehFromO2` rose at 100 mV/decade past O2=5 while
> `o2FromEh` came back at 1000 — each author had picked "gentle" in their
> own output space) is fixed by aligning `ehFromO2`'s top branch to
> 1000 mV/decade. An Eh-canonical movement writing +800 mV now survives
> the window-close round trip EXACTLY (was: snapped to +530). 1000 won
> over 100 because the inverse keeps synthetic O2 physical across the
> whole Eh domain (+900 mV → 12.6 ppm ≈ air-saturated water; slope-100
> would hand uncapped ratio engine sites thousands of ppm).
> **NEW STANDING INSTRUMENT: `tools/redox-anchor-probe.mjs`** — round-trip
> audit + `--fleet` ceiling sweep. Measured: fleet max O2 = **5.000 exactly**
> (dripstone caves sit AT the anchor, Eh 499.6) → changed branch unreachable
> → SIM-NEUTRAL, no bump, no rebake. Also measured: a -620 mV
> representability floor (ehFromO2's 1e-6 ppm log clamp — documented, not
> fixed; beyond water stability at pH 7, methanogenic anchor is -400).
> Stale comments trued: 20c header ("exact inverses for [0.05,5]" → full
> domain), 85c ("clamped in 4c.2" — that clamp was never added; now
> unneeded). 4 new round-trip tests pin exactness, the +800 case, the O2
> ceiling, and the floor. **Movements Phase 1 is UNBLOCKED** — next per
> Part II: ring_fluids retire-or-restore, then the Movements arc itself
> (HANDOFF-MOVEMENTS-AND-BACKLOG-2026-06-01.md).
>
> ## 💙 UPDATE (2026-06-10, later) — v180: LINARITE FIRES at roughten_gill
>
> First execution of the handoff's tune pass (`12a0b09`): the headline
> azure-blue specimen grows (0→2x, ~2.2 mm) + leadhillite caps (0→2x).
> **Stale 7 → 4.** The v109 "Shape B structural" diagnosis had ROTTED — the
> per-cell architecture (v160) + v177 cell-key fix dissolved the
> displacement; the real blocker was the CO3:SO4 fork missed by 0.03-0.06
> for 75 straight steps (gate-census probing found it). Tune: AMD S surge
> +80→+110 + leadhillite-cap CO3 flood +70/ceiling 165. Bayldonite removed
> from expects (Shape D — engine encodes PbCu3 Cu-dominance, unreachable in
> the Pb-dominant broth). **V is a TWICE-confirmed touchy axis** (v109 6→0,
> v180 6→12 — both reverted); mottramite still stale, needs its own
> gate-census arc (V gate clears at 12; blocker is Zn≥0.5 or redox·T).
> Remaining stale: jeffrey magnetite, searles mirabilite, roughten_gill
> mottramite, schneeberg torbernite. Lesson for the lineage: **diagnoses
> age with the architecture under them — re-probe before trusting an old
> shape.**
>
> **SAME SESSION, 13th CATCH — the tune pass is COMPLETE, stale 4 → 2:**
> "stale" mirabilite + torbernite were CORRECT GEOLOGY mis-filed by
> end-state-only accounting. Mirabilite nucleates every searles winter
> (σ 24.6) and dehydrates to thenardite pseudomorphs every summer — the
> textbook Glauber-salt cycle, working since v29; torbernite grows ~30
> steps of emerald Musonoi plates at schneeberg then dehydrates to
> metatorbernite per the scenario's own design (10/10 seeds once counted;
> zeunerite 2/10 → 10/10 too). The checkers tallied `c.mineral === m` and
> never read the `paramorph_origin` lineage the transition code records.
> Both tools fixed (coverage + geology_check). Remaining stale 2 are
> genuine and NOT tuning work: jeffrey magnetite (engine-level low-O2
> design), roughten_gill mottramite (own gate-census arc; V axis is
> twice-confirmed touchy). Full story: CATCHES.md thirteenth entry.
>
> ## 🪨 UPDATE (2026-06-10) — SESSION HANDOFF: review → rebake → soundtrack
>
> **`proposals/HANDOFF-REVIEW-REBAKE-MUSIC-2026-06-10.md`** is the handoff for
> the 2026-06-09/10 session (three-metrics review, the v177-v179 rebake arc,
> the music + settings shell, the GainNode volume fix) — **NOW WITH PART II**
> (same day, after the handoff): v180 linarite-fires, the 13th catch, the
> tune pass COMPLETE, and the REVISED next-step order (ehFromO2 is the new
> top item). Twelve lessons total. CATCHES.md gained the 10th-13th catches.
> Next builder: read the 2026-06-05 orientation handoff first if cold, then
> that one (Part II's revised order supersedes Part I's), then the banners
> below.
>
> ## 🎵 UPDATE (2026-06-09, latest) — MUSIC + the settings shell (SIM-NEUTRAL)
>
> Boss-directed: two boss-supplied tracks now loop per room — "Vugg
> Simulator.mp3" on every title-family screen, "salt-circuit.mp3" in every
> building room (wall-preview modes + Library + Record Player); STRIP VIEW
> stays silent (the sonifier owns that room). Engine `js/08-music.ts`
> (context model, one reused <audio>, src swaps only on real track change so
> renavigation never restarts the song, autoplay-block → one-shot gesture
> unlock); ⚙ settings overlay `js/98e-ui-settings.ts` + index.html (music
> enable + volume, persisted under the NEW `vugg-settings-v1` localStorage
> ROOT — future settings groups go BESIDE music:{} in that key, the first
> brick of Steam-T1 #4). Verified in a live preview (play/pause call matrix
> per mode + settings round-trip + zero console errors); BY-EAR ACCEPTED by
> the boss on the live deploy 2026-06-10 ("it works well") — the channel is
> verified, not just the code. Tests: tests-js/music.test.ts (10).
>
> ## ⚒️ UPDATE (2026-06-09, later) — REBAKE ARC SHIPPED: v177 + v178 + v179
>
> The three calibration-coupled fixes from the review below are DONE
> (`51487a4` / `61bef7c` / `503e228`, all suites 1769/1769):
> - **v177 cell-key:** per-cell competition grouping fixed. The measured truth
>   (new `tools/graduated-binding-probe.mjs` + `_gradCompStats` telemetry, run
>   both ways): rationing binds 199/80,649 allocations (0.25%), ONLY in
>   same-cell stacks, identically under both keys → seed-42 baselines
>   byte-identical; the bug was output-LATENT. It matters when budgets tighten.
> - **v178 PWP Ea:** array was a PERMUTATION (acid↔carbonate), corrected to
>   [k1 14.4, k2 35.4, k3 23.5] + `_PWP_CALIBRATION_FACTOR` re-anchored 5.0e4
>   → 1.9e4 (the factor was tuned under the wrong Ea; response to the factor is
>   SUPER-linear, naive linear rescale overshot). 13/31 scenarios move,
>   carbonate-centric; mvt + vein identity minerals byte-identical. ALSO fixed:
>   week-11's HMC Arrhenius test had an UNDERSATURATED fixture — a green test
>   was load-bearing for the wrong physics.
> - **v179 vein seal:** `thermal_pulses:false` + non-heating Math.max(Math.min)
>   floors + NEW opt-in `wall.cooling_rate` knob (default 1.5, RNG-neutral; the
>   vein sets 0.4 — an open feeder advects heat, so a live vein holds near
>   brine T until the conduit chokes). Sealed interval now genuinely quiet
>   (111→104 °C, flow 0.05, zero injections); both generations inside North
>   Pennine fluid-inclusion T (~90-150 °C). 1/31 baselines moved.
> - **SWEEP MOVEMENT: stale 8 → 7 (borax recovered at searles_lake), dead
>   35 → 34 (tremolite revived).** Remaining 7 stale are vugg-tune-scenario
>   candidates, NOT engine bugs: roughten_gill's four (linarite, leadhillite,
>   mottramite, bayldonite), jeffrey magnetite, searles mirabilite, schneeberg
>   torbernite (0/10 seeds; zeunerite thin at 2/10). bisbee azurite verified
>   gate-not-cleared (its azurite_peak event fires, the mineral never
>   nucleates) — do NOT just add it to expects_species; tune first.
> - **Tune-watch items from the v178 rebake:** jeffrey lost aragonite+siderite
>   (not in expects), deccan gained a 1-crystal wollastonite (suspect at
>   zeolite T), w9-probe trap documented in 52b (its printed columns bake in
>   the LIVE factor).
> - Still open from the review: §1.4 ring_fluids retire-or-restore decision
>   (✅ RESOLVED 2026-06-10 — retired to a derived view, see 🪞 banner),
>   §1.6 hygiene items (cells_per_ring manifest, IDB leak, pH clamp), the
>   ehFromO2 asymmetry (MOVEMENTS BLOCKER — ✅ FIXED 2026-06-10, see ⚡
>   banner above), the §2.4 narrator/spec one-liners,
>   carbonate pK(T) slopes (§2.2), and the whole Steam §3 ladder.
>
> ## 🔍 UPDATE (2026-06-09) — THREE-METRICS REVIEW: bugs / accuracy / Steam-readiness
>
> A cold-eyes review sweep on the boss's three metrics. **Full report:
> `proposals/REVIEW-THREE-METRICS-2026-06-09.md`** — read it before picking up
> any item below. Fixed in the pass (both SIM-NEUTRAL): the committed bundle
> was STALE (npm run ci was RED since c1b161e — same-length comment drift hid
> as "diff length: 0 chars") and the four v165 sulfate SI chips were
> unreachable in the Strip View chip selector (hardcoded systems list; new
> probe `tools/strip-chip-selector-probe.mjs` guards it). New OPEN items:
> - **HIGH bug:** graduated-competition cell key collapses to per-ring with an
>   arbitrary budget fluid (`85b` `_computeGraduatedZones` — WallCell has no
>   id/idx/vertexIdx). One-line fix, but CALIBRATION-REBAKING; shipping since
>   v128c. May be suppressing some of the 8 stale expects_species — fix, then
>   re-sweep.
> - **HIGH accuracy:** PWP activation energies paired to the WRONG mechanisms
>   (`thermo-carbonates.json` + `52b`): correct [k1,k2,k3] = [14.4, 35.4, 23.5]
>   kJ/mol (P&K 2004 assigns acid=14.4); shipped array is reversed → hot acid
>   scenarios over-amplify ~12×. Rebake with the cell-key fix as ONE arc.
> - **MED:** `_propagateGlobalDelta` no longer reaches non-equator ring_fluids
>   (stale store still read by open-atmosphere pH, Eh sync, replay snapshots —
>   retire it or restore the loop, no third partial mirror); carbonate pK(T)
>   slopes ~5-10× too flat (`20b`); reactivated_fluorite_vein needs
>   `thermal_pulses:false` + a non-heating seal floor; 8 stale expects_species
>   are locality-fidelity breaks (searles borax/mirabilite, roughten_gill
>   linarite/leadhillite/mottramite/bayldonite, jeffrey magnetite, schneeberg
>   torbernite) + bisbee expects omits azurite.
> - **MOVEMENTS BLOCKER:** ehFromO2/o2FromEh are 10× asymmetric above O2=5
>   (`20c`) — an Eh +800 mV movement snaps back to +530 when its window closes.
>   Align slopes before Movements Phase 1 drives Eh. *(✅ FIXED 2026-06-10 —
>   see the ⚡ banner above; +800 now round-trips exactly.)*
> - **Narrator/spec one-liners (afternoon, SIM-NEUTRAL):** wurtzite 95 °C
>   "boundary" myth, flos-ferri is aragonite not calcite, Statue of Liberty
>   patina is brochantite/antlerite not malachite, hiddenite is N. Carolina,
>   + ~10 more tabled in the report §2.4.
> - **Steam:** verdict "sim core is ready; the game around it is 3-5 months."
>   T1 blockers (collection has NO export; 16 prompt()/alert() sites that
>   silently break under Electron; scenarios.json5 has no offline fallback; no
>   settings menu) + WP1-WP5 sequencing in the report §3.
>
> ## 🟢 UPDATE (2026-06-08) — 2d BREACH shipped: reactivated_fluorite_vein (SIM 176)
>
> The "2d breach API — wire a seal-then-reopen scenario" open item is **DONE**
> (`c1b161e`, live on Syntaxswine Pages). New scenario `reactivated_fluorite_vein`:
> a crack-seal reactivated vug (North-Pennine fluorite-galena-barite style) that
> grows a first generation with feeders OPEN, SEALS them (cement chokes the
> conduit, `spots:'seal'`@78), then BREACHES them open again (tectonic
> reactivation, `spots:'breach'`@118) for a cooler gen-2. Lights up the breach
> API that was wired+tested but unused. No new engine — stage 1 reuses the proven
> mvt-analog brine + generic events; handlers in js/70t. Seed-42: 62 crystals /
> 16 species, all 5 expects fire (fluorite/galena/barite/calcite/sphalerite +
> wurtzite). ZERO cascade drift (additive). Suite 1761→1769. Full 7-file
> add-scenario pipeline + 3 menu surfaces (guard test green).
> - **Open from this arc:** (1) fluorite fires only 1 crystal even at 5× F — its
>   limiter is nucleation competition/cap, not F; present-but-minor, a
>   vugg-tune-scenario candidate if the boss wants fluorite dominant. (2) the
>   `breach` predicate-by-kind path (`spots:{action,kind}`) is exercised only with
>   the all-spots default here — a kind-selective seal/breach is still untried.
>
> ## 🏛️ UPDATE (2026-06-05) — fresh full-orientation handoff written; READ IT FIRST
>
> **`proposals/HANDOFF-TO-THE-NEXT-BUILDER-2026-06-05.md`** is a complete, from-zero
> orientation for a builder who knows nothing: the JS-only law, the build pipeline
> (js/ → index.html), the subsystem map, every tool/probe + the five vugg-* skills
> and when to invoke them, the corrected deploy model (push-to-Syntaxswine IS the
> deploy; confirm the Pages build before "go look"), SIM_VERSION + baselines + the
> run-suite-alone discipline, the seven working disciplines, all nine catches, and
> where the depletion-voice session left off. Grounded against current source via a
> survey workflow, authored in-voice. New builder: start there, then this BACKLOG
> for fine-grained open items.
>
> ## ▽ UPDATE (2026-06-04) — the DEPLETION VOICE ships (SIM-neutral)
>
> The audible twin of the floor shadow (open item #1 from the SIM-175 banner
> below, now done) is built: a soft SHADOW oscillator per chip, sounding at the
> deepest depleted pocket's pitch, swelling where a crystal draws the broth down.
> It shares the chip's lvlGain (pans + rescales with the voice), bypasses artGain
> (a sustained undertone, not a pluck), sits a few cents flat (a faint beat where
> the gap is near-unison, a real interval where the halo is deep), and SELF-GATES
> to silence on abundant/absent ions. Toggle: ▽ Depletion (default ON), restarts a
> live performance like the 🔔 crystals layer. Engine in js/85i; UI in js/99k.
> SIM-neutral (reads recorded floor_data only — no engine output touched, no
> SIM_VERSION bump, no baseline regen). Full suite 1761/1761.
>
> **THE KEY MEASUREMENT (tools/sonify-depletion-probe.mjs — built first, it tuned
> the design):** the recorded halos are REAL but small in ABSOLUTE normalized
> terms — a limiting ion sits near the bottom of its own declared color-range, so
> a 20-49% local drawdown is only a ~1-10% band height. Two load-bearing consequences:
> - **Reduction must be GLOBAL-MIN, not a mean.** A halo is local (one crystal);
>   averaging — even a per-height ring-mean — re-dilutes it (mvt Cd's 49% halo
>   showed as 2% under mean-of-ring-min). The single deepest pocket is what the eye
>   catches and what the ear now tracks.
> - **Loudness keys on RELATIVE drawdown (depth/level), not absolute.** That's the
>   range-independent physical "how hard was this pocket sucked dry," and it's what
>   separates limiting ions (big relative dip) from abundant ones (broth barely
>   dips). An absolute noise floor (~1.5 quantization levels) rejects fuzz +
>   essentially-absent ions (caught mvt SiO2's spurious 12%-on-~0-baseline). Probe
>   verdict: reactive_wall Ag sings (peak 0.36, 94% of run); mvt Ag/Cd/F/Pb sing
>   (Cd's deep halo saturates at 0.60); gem_pegmatite F sings but Sn stays silent
>   (it's abundant there — honest).
> - **A DELIBERATE eye/ear split:** the VISUAL shadow keys on the absolute band
>   (faint for low-baseline ions); the VOICE keys loudness on relative hollowing.
>   Complementary readings of one floor_data channel, not a contradiction —
>   documented in the 85i header. PITCH stays absolute (deep halo → real interval).
>
> **Open from THIS arc:** (1) **by-EAR tuning on a live deploy** — mix / relDipRef /
> detune were tuned by the headless probe, NOT by an ear yet (the 9th-catch rule:
> a probe verifies the code, not the channel; re-confirm on a real Pages build);
> (2) whether the VISUAL shadow should ALSO go relative — would re-unite eye+ear,
> but touches accepted rendering (boss's call); (3) a per-crystal "tick" at the
> moment the dip first opens is unbuilt — currently a continuous swell.
>
> ## 🔊 UPDATE (2026-06-03, later) — TWO LISTENING FINDINGS closed (SIM 175)
>
> Boss listened to the strip sonifier + looked at the strip, and flagged two things;
> both are now shipped + accepted (drone by ear, halo by eye on Pages):
> - **Drones go silent in scale modes** → `54bc53f` (SIM-neutral). The rhythm layer
>   rested held pitches to silence (~5% sounded); now they SUSTAIN (legato, ~90%) in
>   every scale mode. `STRIP_RHYTHM.sustainFrac` is the tuning knob.
> - **No dips in the broth around crystals** → the DEPLETION-FLOOR channel, `a5837ed`
>   (SIM 175, dataset format_version 3). The recorder sampled one midpoint cell per 15°
>   bin → threw away ~80-90% of the halo. Fix: a parallel `floor_data` tensor = per-bin
>   MIN for ION chips at the wall (depth 0); the LEVEL (`chip_data`) stays byte-identical
>   so seed42 + strip_digest don't move. Renderer (99k) draws a shadow band hanging to
>   the floor. strip-floor-probe: reactive_wall Ag halo 19.87% recovered (vs 2.35%).
>   The bin-MEAN first attempt was a measured DEAD-END (dilutes + 5× perf timeouts) —
>   logged as the 8th catch in `proposals/CATCHES.md`. Probes: depletion-dip /
>   strip-depletion / strip-floor. Test infra: testTimeout 30→60s, hookTimeout 60→120s
>   (heavier recorder). Full suite 1754/1754 green.
> - **Open from this arc:** (1) a SONIFIER depletion voice (hear the sag — the audible
>   twin of the shadow) → ✅ SHIPPED 2026-06-04, see the ▽ banner above; (2) the floor
>   shadow's visual weight (boss's eye); (3) the halo is still DECOUPLED from the
>   nucleation gate — showing where the broth thins, not a distinct mineral firing only
>   there (still the per-cell-gating frontier).
>
> ## 🪨 UPDATE (2026-06-03) — the FLUID-SPOTS arc is COMPLETE (SIM 174)
>
> Phase 2 fluid-spots shipped end-to-end: **2a** seed → **2b** lopsided erosion →
> **2c.1** chemical halo → **2c.2** (the dead-end catch, default-off) → **2c.2b**
> per-cell proximity clustering → **2c.3** united showpiece (gem_pegmatite) →
> **2d** open/close lifecycle. A seeded feeder now deepens the wall, injects a
> halo, gathers crystals, and opens/closes over the vug's life.
> - **Read `proposals/HANDOFF-TO-THE-NEXT-BUILDER-2026-06-03.md` first** — the
>   voice/wisdom layer (the catches, the decoupling map, the honest ceiling).
> - Per-bump detail: `js/15-version.ts` (v171→v174). Live open-items: the
>   movements handoff Part II (below pointer), still current.
> - **Open from this arc:** (1) 2c.2b clustering strength/scope calibration —
>   boss's eye on Pages (gem_pegmatite live); (2) **per-cell nucleation gating** —
>   the deep arc for a *distinct-mineral* one-sided specimen (literal Punjab
>   hematite-on-calcite), the ceiling we hit; (3) 2d `breach` API unused (needs a
>   seal-then-reopen scenario); (4) supergene pH-front listen-acceptance.
>
> ## ⚠️ READ THIS FIRST (2026-06-01) — staleness + the live snapshot
>
> **The distilled, CURRENT open-items list lives in
> `proposals/HANDOFF-MOVEMENTS-AND-BACKLOG-2026-06-01.md` (Part II).** This file
> below is the deep history + detail; trust the handoff for "what's actually
> open right now." Known stale spots in the older sections:
> - **All Python↔JS-parity items are DEAD.** The Python tree was deleted
>   2026-05-07 — vugg is JS-only. Ignore: effectiveTemperature port,
>   silica_equilibrium parity, the supersat-drift reconciliation table,
>   sync-spec Check 7, scenario_random parity, "finish Python A6–A8".
> - **The "🎯 SIM_VERSION" section reads 7. Actual SIM_VERSION is 167.** That
>   section's history stops in April 2026; don't trust it as current.
>
> **STANDING RULE (boss):** whenever you build or update a handoff document,
> RECONCILE this backlog in the same pass — mark shipped items done, mark
> dead/superseded items, add the new open items the arc surfaced. Handoffs and
> the backlog must move together; staleness is what happens when you update one
> and leave the other behind. (Memory: `feedback_handoff_updates_backlog.md`.)

---

## 🏗️ Modular refactor — split the monoliths ✅ SHIPPED (B1–B20, 2026-05-05)

**Status:** done. See `proposals/PROPOSAL-MODULAR-REFACTOR.md` (with its
SHIPPED footer) and [`js/README.md`](../js/README.md) for the navigable
index of the new source tree.

What landed:
- **Python (Phase A1–A5b, partial):** `vugg.py` 20,445 lines → `vugg/`
  package. `version.py`, `chemistry/{fluid,conditions}.py` + 12
  per-class supersat mixins, `geometry/{wall,crystal}.py`. The remaining
  Python phases (A6 engines, A7 transitions/events/scenarios, A8 simulator
  residual) paused when the user pivoted to JS-first.
- **JavaScript (Phase B1–B20, complete):** the 21,923-line inline
  `<script>` in `index.html` → 100+ TypeScript modules under `js/`,
  none over 1,000 lines. Includes build infra (`tools/build.mjs`
  concatenator + `tsc`), `npm run ci` regression guard, and zero type
  errors at landing.
- **Real bug fixes uncovered along the way (8):** `initR` undefined ref
  in 3D renderer; 3 duplicate narrator definitions (dead code); 5
  latent cross-block scope leaks in `check_nucleation` (only-correct-by-
  coincidence).

Adding a new mineral now takes ≤ 4 file touches (down from 8+) — see
[`js/README.md` Quick task lookup](../js/README.md#quick-task-lookup).

### Open follow-ups (small, well-scoped)

- **JS narrators for borax / tincalconite / halite / mirabilite / thenardite.**
  Python has them; JS doesn't. `narrate()`'s dynamic dispatch falls
  through to `''` for these 5 minerals. Port from
  `vugg/__init__.py`'s `_narrate_*` methods (~1 hour). Lands in:
  - `js/92c-narrators-halide.ts` ← `_narrate_halite`
  - `js/92j-narrators-sulfate.ts` ← `_narrate_mirabilite`, `_narrate_thenardite`
  - new `js/92l-narrators-borate.ts` ← `_narrate_borax`, `_narrate_tincalconite`
- **Finish Python A6–A8** (engines / transitions / simulator residual).
  Harness is functional as-is; this is future-proofing the test side.
  Mechanical extraction script is in this commit history (B15 / B17 / B20
  on the JS side use the same shape).
- **Tighten remaining `[key: string]: any;` index signatures.** Each
  dataclass-style class (FluidChemistry, VugConditions, WallState,
  Crystal, VugSimulator) has the loose signature added in B14b.
  Replacing with explicit field declarations would catch typos at
  compile time. Per-file work, no risk.

Order is rough priority — top of each section is most-actionable, but explicit user direction reorders freely.

---

## 🧪 Geological accuracy — closing the formal gaps

**Status:** Phases 1 + 2 ✅ SHIPPED (May 2026, SIM_VERSION 17→21). Phases 3-6 not yet started. See [`PROPOSAL-GEOLOGICAL-ACCURACY.md`](PROPOSAL-GEOLOGICAL-ACCURACY.md). **Overlaps with `PROPOSAL-VOLATILE-GASES.md`** (Rock Bot, 2026-05-04, on canonical) at Phases 3 (CO₂) and 4 (Eh/redox); cross-references in both directions are wired into the proposal text. Treat the two as one combined work package: VOLATILE-GASES owns the multi-species headspace state, this proposal owns mass balance + thermodynamic Q/K + aqueous-side speciation + solid solutions.

### What landed (Phases 1 + 2)

**Phase 1 — Fluid mass balance** (commits 08140d1 / 1eaaa5a / 7904894):
- `MINERAL_STOICHIOMETRY` table covers all 97 minerals (`js/19-mineral-stoichiometry.ts`)
- `applyMassBalance` wrapper in `_runEngineForCrystal` debits the per-ring fluid by stoichiometry × `MASS_BALANCE_SCALE = 0.01` on every precipitation step
- Engine-internal growth-path debits (15 lines across 5 files for adamite, mimetite, malachite, smithsonite, wulfenite, uraninite, feldspar) removed in Phase 1d to end double-counting; wrapper narrowed to precipitation-only so engine dissolution credits keep their per-mineral rates
- SIM_VERSION 17 → 18 → 19 → 21

**Phase 2 — Saturation Index reform** (commits 568476f / b63e426 / 4938321 / eff8ec1 / ed2a381):
- Carbonate Liebig bugfix: `min(M, X)` → `√(M·X)` for 5 supersat methods (calcite, siderite, rhodochrosite, aragonite, dolomite)
- Davies activity-coefficient infrastructure (`js/20a-chemistry-activity.ts`) — `ionicStrength`, `daviesLogGamma` (clamped above I=1.7 as documented degraded fallback), `activityCorrectionFactor`
- All 12 supersat classes migrated; activity correction runs on every supersat call at `ACTIVITY_DAMPING = 0.25` (a quarter of full Davies — the empirical sweet spot that keeps tutorials intact while applying real activity physics in saline scenarios)
- SIM_VERSION → 20

**Calibration outcome (sweep at seed 42):** v21 vs v20 RMS 7.6%, 15 of 19 scenarios within ±5%, 18 of 19 within ±20%. Outliers (mvt, bisbee, schneeberg) trace to genuine geological behavior — saline brines correctly less supersaturated under Davies; finite Fe/S pools deplete during sulfide cascades.

**Bug fixes uncovered along the way (3):**
- Davies runaway (γ = 49 million) above I ≈ 1.7 mol/kg — clamped log γ ≤ 0
- Carbonate `min(Ca, CO3)` Liebig pattern (5 sites)
- Migration script regex spillover at delegating supersat methods (caught before commit, reverted, manual fix)

### Open follow-ups (Phases 1e + 2d, on this same ticket)

- **Phase 1e — unify dissolution credits.** ~120 hand-coded `conditions.fluid.X += dissolved_um * coef` lines across ~10 engine files use per-mineral rates ~50× larger than `MASS_BALANCE_SCALE`. Migrate them into a parallel `MINERAL_DISSOLUTION_RATES` table so the wrapper owns both directions, then let the wrapper credit on negative thickness too. Mechanical per-mineral work; would let `MASS_BALANCE_SCALE` rise back toward the originally-prototyped 0.05 with full bidirectional control.
- **Phase 2d — per-scenario fluid recalibration.** The 3 Phase-2 outliers (mvt -33%, bisbee -25%, schneeberg) are stories where activity-corrected Davies suppresses marginal nucleations. Bump fluid concentrations in those scenarios so the affected minerals re-cross threshold, then ratchet `ACTIVITY_DAMPING` up toward 0.5+ (more honest physics with the recalibrated fluids).
- **Depletion-event log lines.** "Fe²⁺ depleted in ring 4 — pyrite nucleation halted" narratives whenever `applyMassBalance` floors a species at 0. Currently silent.

### Phases 3-6 (not started)

3. Carbonate speciation + CO₂ degassing as a first-class precipitation driver. New `co2_degas` event type. Travertine tutorial scenario. **Couples with VOLATILE-GASES Mechanic 2 — same gap, share the headspace state vector.**
4. pH/Eh as dynamic state variables driven by reactions; three explicit redox couples (Fe³⁺/Fe²⁺, Mn⁴⁺/Mn²⁺, SO₄²⁻/HS⁻). **Couples with VOLATILE-GASES Mechanic 1 — continuous Eh subsumes the discrete `redox_state` bucket.**
5. Solid-solution composition tracking — replaces broth-ratio branching with continuous mole-fraction, unifies the rhomb-carbonate and sphalerite series.
6. Classical-Nucleation-Theory rate gates (optional, lowest priority).

**Adjacent angles** (not phases, but compose well): stable-isotope tracking (δ¹⁸O/δ¹³C), fluid-inclusion homogenization-T narration, Pitzer for high-salinity brines, Ostwald ripening (Phase 1 unblocks `PROPOSAL-GIBBS-THOMPSON.md`).

**Sequencing:** Phases 1+2 done; Phase 3 next (highest visible payoff). 3D-SIMULATION Phase D (orientation-bias habits) and the twin-probability retune both want Phase 5 first if they want continuous composition vectors.

---

## 🐞 Bugs / pending diagnostic

### 3D viewer bug list
**Status:** awaiting user's enumeration.
**Context:** during the 3D viewer work earlier in the project, several specific bugs were noted but never logged with reproduction steps. User has the list; this todo is the placeholder until they share it.

---

## 🌀 Twin probability retune — measure prevalence by per-mineral lifetime

**Status:** deferred, raised by user during the twin bug-fix commits (commits `8b8449b` per-nucleation roll fix + `16b39ee` four-placeholder population).

**Why:** the values currently in `data/minerals.json:twin_laws[].probability` are the per-roll rates derived from total natural prevalence numbers in the literature ("X% of natural specimens are twinned"). But:
- **The game rolls once per crystal at nucleation** (post-fix), so the realized in-game twin frequency is exactly the per-roll value.
- **Real-world prevalence partly reflects lifetime opportunity** for stress/thermal events to induce secondary twinning during growth, which the single-roll model doesn't capture.
- **Different minerals accumulate different growth-step counts** in typical scenarios — quartz might run 100 zones, a late-nucleating wulfenite gets 10 — so the multiplier between "per-roll rate" and "observed in-game prevalence" varies by mineral.

The four placeholders just populated (arsenopyrite 0.01, native_silver 0.05, argentite 0.04, chalcanthite 0.005) are research-grounded floors, not tuned for game-visible behavior. Likely too low for some minerals once the lifetime asymmetry is taken into account.

**What to build:**
1. Extend `tools/twin_rate_check.py` (or write a sibling tool) that runs each baseline scenario at seed 42, counts twinned vs untwinned crystals per mineral, and reports observed in-game frequencies. Compare to literature target ranges.
2. For each mineral that's "common-twinned in nature" but observed-rare in the sim (or vice versa), note the per-mineral average growth-step count and propose an adjusted per-roll probability that lands the observed rate within target.
3. Don't blanket-multiply — different minerals have different lifetime distributions, and some twins (Carlsbad, cyclic-sextet) are genuinely birth-time decisions where per-roll = lifetime rate.

**Out of scope for the retune itself:**
- Event-driven twins (thermal shock, tectonic event) — those remain in their grow_*() functions as event-conditional logic and aren't subject to this asymmetry. Currently quartz Dauphiné + the fortress-mode tectonic event.
- Habit-conditional twins (e.g., aragonite cyclic_sextet's "growth in twinned_cyclic habit" trigger) — these are nucleation-time decisions; the per-roll rate already matches the lifetime rate by construction.

**Relevant minerals to revisit during the retune** (from the commits' candid notes):
- cerussite cyclic_sixling at 0.4 — well-formed cerussite is nearly always cyclic-twinned in nature; per-roll 40% may underrepresent observed rate.
- sphalerite spinel-law at 0.015 — common in well-formed crystals; per-roll 1.5% looks low.
- calcite c-twin at 0.1 — common in many specimens; literature suggests 10-30% lifetime, may need bumping for short-lived calcite crystals.
- arsenopyrite trillings at 0.01 — "uncommon" but if observed-zero across baseline runs, likely needs bumping.
- chalcanthite cruciform at 0.005 — "rare" is consistent with the chalcanthite metastability mechanic (re-dissolves frequently), so observed-zero is geologically right; verify with the tool before bumping.

**Sequencing:** lands after the data-as-truth Option A refactor (initial fluid/T/P/wall → JSON5) so the retune can lean on stable declarative chemistry without conflating with infrastructure changes.

---

## 🧱 Data-as-truth Phase 2 — infrastructure follow-ups

Phase 1 (commit `2feb338`) and Phase 2 (commits `69f8acb..ce3dd5a`) migrated all 13 declarative scenarios + ~50 inline event closures to `data/scenarios.json5` + module-level handlers in `EVENT_REGISTRY`. The following items were noted in the Phase 2 handoff doc (`proposals/HANDOFF-DATA-AS-TRUTH-PHASE-2.md`) as out-of-scope for the migration itself but worth filing.

### `tools/sync-spec.js` Check 7 — cross-runtime EVENT_REGISTRY parity

**Why:** every event-type string in `data/scenarios.json5` must be registered in BOTH `vugg.py` and `index.html` `EVENT_REGISTRY`. Today the JSON5 loader validates each runtime against the spec at import/fetch time (loud failure if a referenced type is missing), but no cross-runtime check guarantees Python and JS register identical key sets. A missing/typo'd key on one side is caught only when that scenario is actually run in that runtime.

**What to build:** add Check 7 to `tools/sync-spec.js` — parse `EVENT_REGISTRY = {...}` literal from both `vugg.py` and `index.html` and assert identical key sets. Same idea as the existing mineral drift checks (Checks 1-6), just over the event-handler dimension.

**Effort:** small. The key-set extraction is regex-tractable (the registry is a contiguous dict literal in both files, with one key per line in the Phase 2 layout).

### `runSimulation` async-load guard (JS-only)

**Why:** JS loads `data/scenarios.json5` asynchronously via `_loadScenariosJSON5()`. After page reload, if the user clicks "Run" before the fetch completes, `SCENARIOS[scenarioName]` is undefined and `runSimulation` throws `Cannot read properties of undefined (reading 'temperature')`. Edge case in normal use (the fetch is fast on localhost), but reproducible on slow connections or first cold load. Phase 2 made every scenario JSON5-loaded, so this affects all 13 scenarios now, not just the original 4 from Phase 1.

**What to build:** in `runSimulation`, gate scenario execution on `_scenariosJson5Ready === true`. If not ready, show a "loading scenarios..." status message and either retry or block the click. Or — simpler — disable the Run button until ready and re-enable on fetch completion.

**Effort:** small.

### `scenario_random` JS-side parity gap

**Why:** Python has `scenario_random()` (in `vugg.py`); JS doesn't. JS exposes a "Random Vugg" button on the title screen that does its own thing (`index.html` ~line 16470). Pre-existing intentional drift, not introduced by Phase 2 — but now that all 13 declarative scenarios are unified through JSON5, `scenario_random` is the only remaining procedural divergence between the two runtimes. Worth either reconciling (port the Python scenario_random into JS so `SCENARIOS.random` works in both) or formally documenting the asymmetry in `ARCHITECTURE.md`.

**Effort:** medium if porting. Python's `scenario_random` is ~200 lines of archetype dispatch + per-archetype fluid construction. The JS title-screen Random Vugg uses a different (simpler) generative model. Reconciling them = pick one, port to the other side.

**Sequencing:** none of these block. File and pick up when convenient.

---

## 📜 Narrative-extraction post-completion follow-ups

The 89/89 narrative-as-data extraction landed in commit `e731f1f` (2026-04-30). Two items were deferred during the extraction itself; both are now actionable:

### Drop inline JS fallbacks

**Why:** every JS dispatcher in `index.html` carries `narrative_blurb('species') || 'fallback prose...'` and `narrative_variant(...) || 'fallback prose...'` for each branch. These were defensive — if the async markdown fetch hadn't resolved by the time the narrator fired, the inline fallback prose would render instead. Now that all 89 species are in `_NARRATIVE_MANIFEST` and the fetch is awaited at startup, the fallbacks are useful only for `file://` boots before the fetch completes (rare).

**What to build:** decide policy with the boss — keep fallbacks as `file://` resilience, OR strip them all (~1500 lines saved across 89 narrators) and trust the loader. If stripping, do it as a single mechanical commit: `narrative_blurb('x') || '...'` → `narrative_blurb('x')` for every narrator. Tests + sync-spec confirm no regressions.

**Effort:** small if stripping (mechanical pattern). Zero if keeping.

**Where to find:** every `_narrate_<species>` method in `index.html` (search for `|| '`).

### Auto-generate `_NARRATIVE_MANIFEST` from `data/minerals.json`

**Why:** `_NARRATIVE_MANIFEST` is a hardcoded array of 89 species names in `index.html` (~line 3274). Adding a new mineral now requires both adding it to `data/minerals.json` AND remembering to append it to the manifest. Easy to forget. The pattern matches the rest of the data-as-truth arc: hardcode while small, automate when stable.

**What to build:** at module-load time, derive the manifest from `Object.keys(MINERAL_SPEC)` (the JS-side parse of `data/minerals.json`). Filter for species that have a `narratives/<species>.md` file (or skip the filter and let missing files return empty strings — already handled gracefully by the loader).

**Effort:** small. ~5 lines change. Consider whether the python-side wants a parallel cleanup (Python doesn't have a manifest — it loads on first call — so just JS).

**Where to find:** `index.html` `const _NARRATIVE_MANIFEST = [...]` declaration.

**Sequencing:** neither blocks. Both are quality-of-life cleanups for narrative-edit ergonomics.

---

## 🔬 Supersat drift follow-ups (post-v13 audit)

The v13 audit (`tools/supersat_drift_audit.py`, May 2026) found 11 mineral supersaturation formulas with structural drift between vugg.py and index.html. Two real physics bugs (galena + molybdenite missing O2 gates) and chalcopyrite's T-window were fixed in v13. The remaining 10 divergences are filed here — none are obvious bugs, but the drift means the browser sim and the Python sim give measurably different sigmas for the same fluid, which is its own problem.

### `effectiveTemperature` feature gap (Python lacks Mo-flux T modifier)

**Status:** structural drift, JS-only feature.
**Why:** index.html + agent-api/vugg-agent.js define `effectiveTemperature` on VugConditions — a Mo-flux modifier that widens the T window for porphyry sulfides (chalcopyrite, galena, pyrite, molybdenite, quartz). Python's VugConditions has no such field; supersats use `self.temperature` directly. Net effect: a Mo-rich vug in JS shifts the chalcopyrite/galena/pyrite T sweet spots; in Python it doesn't.
**What to build:** decide whether effectiveTemperature is a real geochemical concept worth porting (Seo et al. 2012 documents Mo-flux thermal effects) or a JS-side decoration that should be removed. If porting: add `effective_temperature` property to VugConditions in vugg.py + thread through the 4-5 sulfide supersats. If removing: replace `this.effectiveTemperature` with `this.temperature` in JS. Either way, one runtime should be canonical and the other should match.
**Affected species:** chalcopyrite, galena, pyrite, molybdenite (already aligned in v13 except for eT), quartz.
**Effort:** medium. ~4 hours of research + porting + test regen.

### `silica_equilibrium` field — JS quartz uses, Python doesn't

**Status:** structural drift.
**Why:** the audit shows JS quartz supersat references `this.silica_equilibrium` (a precomputed field?) while Python's `supersaturation_quartz` inlines `50.0 * math.exp(0.008 * T)`. Same formula presumably, but the JS version reuses a cached value. Verify whether the cache is updated correctly when temperature changes.
**Affected species:** quartz.
**Effort:** small. Read the JS cache update path; either inline it (match Python) or add a cache to Python. ~1 hour.

### Substantive formula divergence (5 species, design-choice review)

**Status:** structural drift, design-choice review needed.
**Why:** these 5 supersats have substantively different formulas between vugg.py and index.html — different hard gates, different scaling constants, different T windows, different pH logic. Each needs a focused read with the boss to decide which side is canonical.

| Species | Python | JS | Decision needed |
|---|---|---|---|
| feldspar | K-only (K<10/Al<3/SiO2<200), exp T decay below 300, pH<4 acid attack | K OR Na (`hasK \|\| hasNa`), 150-800 hard T window, 5.5-9 pH window, 250-500 sweet spot | Python keeps K and Na separate (supersaturation_albite); JS forks them in feldspar. Pick one design. |
| fluorite | 3-tier T (sweet 100-250 + ramp + decline), fluoro-complex penalty above F=80, pH<5 acid | 5-tier T (slow<50 + warming + sweet 100-250 + viable 250-350 + fade>350), pH<5 acid; NO fluoro-complex penalty | Each side has a feature the other lacks. Merge both? |
| selenite | not yet read; likely simpler | Ca>20+S>10+O2>0.3+T<80+pH 5-8, T<40 sweet ×1.5 | Read Python; choose richer formulation. |
| smithsonite | Zn<15+CO3<30+O2<0.3, T>100 decay (rate 0.02) | Zn<20+CO3<50+O2<0.2, T>200 hard fail, pH<5 hard fail, T>100 decay (rate 0.008), pH>7 ×1.2 | JS richer (pH window + alkaline boost + hard T cap). Port to Python. |
| wulfenite | constants 0.025/0.3/0.4/0.5/15.0/3.5/40.0/80/9.0 | constants 0.006/0.2/10/150/250/30.0/4/60.0/7 | Need full read of both; significant divergence in scaling. |

**Affected species:** feldspar, fluorite, selenite, smithsonite, wulfenite.
**Effort:** medium-large. Per-species reconciliation + baseline regen + test parity.

### `calcite` 500°C JS-inline thermal cap

**Status:** known-acceptable architectural divergence (not really a bug, documented for completeness).
**Why:** JS calcite has `if (this.temperature > 500) return 0;` inline. Python handles thermal decomposition via the top-level `THERMAL_DECOMPOSITION` table at line ~10639, which fires regardless of supersat returning >0. Same effective behavior, different mechanism. No action needed unless the dual mechanism causes confusion later.
**Effort:** zero (already aligned in effect).

### Sequencing

The `effectiveTemperature` gap is the most consequential — it touches 5 species and any new sulfide that arrives. Resolve that first before tackling the per-species divergences, since a Mo-flux decision affects how each one is reconciled.

---

## 🏷️ Internal token cleanup — finish the mode renames

**Status:** deferred. User-visible labels were renamed in commit `467e8c4` (and earlier — Fortress→Creative, Legends→Simulation, The Groove→Zen Mode/Record Player). Internal tokens (`fortress*`, `legends*`, `idle*`, `groove*`) still use the pre-rename names because renaming hundreds of CSS classes / DOM IDs / function names for no UX gain wasn't worth the churn.

**Token map** (canonical entry point → user-visible name):

| Internal token | User-visible | Notes |
|---|---|---|
| `fortressSim`, `#fortress-panel`, `.fortress-*`, `fortressBegin()`, `fortressStep()`, `fortressFinish()` | **Creative** | ~199 occurrences |
| `legendsSim`, `legendsSimSource` | **Simulation** | far fewer occurrences (~10s) |
| `idleSim`, `#idle-panel`, `.idle-*`, `idleTogglePlay()`, `idleAppendLog()`, `idleStep()`, `menuGo('idle')` | **Zen Mode** | ~40 occurrences |
| `grooveCollectionCrystals`, `playCollectedInGroove()`, `switchMode('groove')`, `#mode-groove`, `.groove-tooltip`, `.groove-canvas-wrap` | **Record Player** | ~30 occurrences. **Caveat:** the term "groove" is genuinely correct for the rainbow-lane visualization primitive inside the Record Player — that should keep the name even if the mode codepath is renamed. The boundary is the codepath/mode tokens vs. the visualization-routine tokens. |

**Discoverability breadcrumbs already in place** (so future devs greppin' a token find the rename context):
- Header comment block above each global declaration: `let fortressSim`, `let legendsSim`, `let idleSim`, `let grooveModalCrystal` (all in `index.html`)
- Section comments at `/* ---- Creative Mode Styles (internal: fortress-* IDs/classes — pre-rename token, kept) ---- */` and the matching `<!-- Creative Mode Panel -->` HTML comment
- Pre-rename source tokens scrubbed: `source: 'Fortress'` → `'Creative'`, `source: 'Legends'` → `'Simulation'`, `source: 'The Groove'` → `'Zen'`. The post-game info panel's "Source: ___ mode" line now matches the title-card labels.

**What the thorough cleanup looks like** (when someone wants to take it on):
1. Pick one mode at a time (start with `legendsSim` — fewest occurrences, lowest blast radius)
2. Rename the global, then the DOM IDs, then the CSS classes, then the function names — each as its own commit
3. Verify after each: pytest 1130/1130, sync-spec 0/89, browser smoke
4. The `groove → recordplayer` rename is the most carefully-scoped — keep `.groove-tooltip` and the rainbow-lane drawing routines named `groove*` (visualization primitive), only rename the mode-control surface

**Out of scope:** Python `vugg.py` doesn't have UI modes (it's the dev/test runtime); no rename needed there. agent-api/vugg-agent.js similarly headless.

The Creative mode setup panel currently exposes ~30 FluidChemistry sliders + temperature + pressure + new wall reactivity. These items extend the player's control over the rest of the wall + fluid surface.

### Wall porosity slider
**Status:** designed, ready to implement.
**Why:** porosity is geologically distinct from reactivity. Three coupled effects, each with its own engine hook:

| Effect | What it does | Hook |
|---|---|---|
| **(1) Surface area** | Multiplies wall dissolution rate (effective_rate × reactivity × porosity_multiplier) | `VugWall.dissolve()` rate calc |
| **(2) Matrix leaching** | Per-step ion influx from surrounding rock's wall_*_ppm reservoir into vug fluid, gated by porosity. Even at neutral pH, K/Ca/Si/Al migrate in. The Deccan zeolite mechanism — K/Ca/Si/Al arrive via porosity, not direct wall contact. | New per-step `leach_from_matrix()` method on `VugWall`, called alongside `dissolve()` |
| **(3) Residence time** | Controls fluid drainage / refresh. High porosity = fluid replaced often (dilute output). Low porosity = fluid sits, evaporates if exposed (concentrates → evaporites — the sabkha mechanic). | Modulates `flow_rate` and possibly an evaporation-concentration multiplier |

**Slider design sketch:**
- 0% (dense) — only vug-facing wall surface attacked. Default for Herkimer-style massive dolostone.
- 10% (typical limestone) — current implicit behavior baked into reactivity=1.0.
- 30% (chalky / oolitic) — ~3× effective surface area; faster dissolution + ion release.
- 50%+ (vuggy / cavernous) — fluid percolates through; might allow secondary nucleation IN wall pore space rather than only on the vug surface (interesting rendering question).

**Schema work needed for effect (2):** the `wall_*_ppm` fields only cover Fe/Mn/Mg today. Matrix leaching needs at minimum `wall_K_ppm`, `wall_Na_ppm`, `wall_Si_ppm`, `wall_Al_ppm` — and ideally per-composition profiles (limestone vs dolomite vs basalt vs granite vs phyllite each have different ion reservoirs). That naturally pushes toward the wall-composition-picker item below.

### Wall composition picker (Creative mode)
**Status:** queued behind reactivity slider.
**Why:** wall composition is currently hardcoded by FLUID_PRESET in `fortressBegin`. Player can't pick limestone vs dolomite vs silicate. With the reactivity slider live, exposing composition is the natural next wall control. Limestone / dolomite / silicate (with a sub-pick of pegmatite / granite / quartzite / phyllite / basalt) covers all the scenario use cases.

### Creative mode rework — full element-slider exposure
**Status:** flagged but not designed in detail.
**Why:** Creative mode setup exposes ~30 FluidChemistry elements as sliders, but some preset starter fluids contain trace chemistry the user can't see or modify until they're already in-game. Per the user's framing — starter fluids represent "what's in the rocks", so every element they define should be exposed at setup time. Bigger surgery than a single-slider add; needs a full UX pass on the setup panel layout.

---

## 🧪 Schema additions — new FluidChemistry fields + mineral engines

Each item below has the locality chemistry **pre-researched** during the chemistry audit. The work is engineering (add field + mineral engines + minerals.json entry + nucleation block) — no more literature pass needed.

### Cd field + grow_greenockite
**Status:** chemistry pre-researched, engine pending.
**Pre-researched value:** `Cd=2` for Tri-State (sphalerite carries Cd substituting for Zn — typically 1000-5000 ppm Cd in mineral, raw fluid Cd ~1-10 ppm). Greenockite (CdS) is the diagnostic yellow coating on Tri-State sphalerite.
**Source:** Schwartz 2000 (Econ. Geol. 95) on Cd in MVT sphalerite + Tri-State greenockite occurrence in Hagni 1976.
**Engineering needed:**
- `Cd: float = 0.0` field in FluidChemistry (Python @dataclass + JS class)
- `grow_greenockite` (CdS) implementation following the pattern of grow_native_gold (commit `e13d7f1`) — see that as template
- `supersaturation_greenockite` method
- Nucleation block in `check_nucleation` (substrate preference: on sphalerite)
- `MINERAL_GROW_FUNCS` dispatch entry
- `minerals.json` entry — yellow class_color, formula CdS, T tolerance similar to sphalerite
- Optionally: Cd-in-sphalerite trace tracking in `grow_sphalerite` (TitaniQ-analog)
- **Au audit pattern reminder:** when Cd lands, run the gap-check across all 10 anchored localities. Most will be `intentionally_zero`; Tsumeb / supergene scenarios may carry trace Cd (greenockite is reported there too).

**Minerals unlocked:** greenockite, hawleyite, Cd-trace in sphalerite.

### Au-Te coupling — grow_calaverite + grow_sylvanite (Bingham telluride cap)
**Status:** all upstream chemistry already in place; pure engine work.
**Why:** Bingham `scenario_porphyry` already has Au=2 + Te=2 + Ag=8 in init. Currently all the Au precipitates as native_gold; adding Au-Te competition would partition some Au into telluride growth instead. Bingham upper-level epithermal cap hosts these tellurides (Landtwing 2010 + Cook et al. 2009 Au-Ag-Te systematics).
**Engineering needed:**
- `supersaturation_calaverite` (AuTe2) and `supersaturation_sylvanite` ((Au,Ag)Te2) methods
- `grow_calaverite` and `grow_sylvanite` functions
- Nucleation blocks
- `MINERAL_GROW_FUNCS` dispatch entries
- `minerals.json` entries
- Update `grow_native_gold` to compete against tellurides when both Au and Te are present (currently Au always goes native)

**Minerals unlocked:** calaverite, sylvanite, krennerite (potentially).

### Auriferous-chalcocite trace tracking (Bisbee mode)
**Status:** schema mostly in place; modeling work needed.
**Why:** Bisbee's supergene Au literature (Graeme et al. 2019) emphasizes that much of the Au is hosted as a trace within chalcocite rather than as discrete native_gold crystals. Currently all Au in Bisbee precipitates as discrete native_gold instead of partitioning into chalcocite.
**Engineering needed:**
- Add Au-trace tracker on `grow_chalcocite` (parallel to how Mn/Fe traces are tracked in calcite — see `grow_calcite` for pattern)
- Add `trace_Au` field to GrowthZone if not already present
- Update narration / inventory output to surface auriferous-chalcocite vs pure-chalcocite distinction

**Effect:** Bisbee output would record both native gold pockets AND ppm-Au-bearing chalcocite zones — the latter being the more economically significant mode in real Bisbee.

### Ag/Ge mineral engines (Tsumeb downstream)
**Status:** Tsumeb fluid chemistry already populates Ag=8, Ge=5, Sb=5 (commit `684f035`). Mineral engines for the Ag-sulfosalts and Ge-sulfides don't exist yet — those are pure engine work.
**Engineering needed:**
- `grow_proustite` (Ag3AsS3) — ruby silver, As-end
- `grow_pyrargyrite` (Ag3SbS3) — ruby silver, Sb-end
- `grow_native_silver` (Ag) — analog of grow_native_gold
- `grow_chlorargyrite` (AgCl) — supergene Ag halide
- `grow_germanite` (Cu26Fe4Ge4S32) — Tsumeb type-locality Ge mineral
- `grow_renierite` ((Cu,Zn)11(Ge,As)2Fe4S16) — companion Ge mineral
- (Optionally) `grow_briartite` (Cu2(Fe,Zn)GeS4)
- Each needs supersaturation, growth, nucleation, dispatch, minerals.json entry
- **Au audit pattern reminder:** when each lands, run gap-check across all 10 anchored localities for Ag specifically (Bingham Ag=8 and Bisbee Ag=40 already populate; some MVT scenarios may need Ag promoted from "documented but no engine" to active).

---

## 📋 Audit-trail patterns established (reference, not work)

These aren't todos — they're conventions to follow when doing the work above:

- **`pending_schema_additions`** in `data/locality_chemistry.json` — for "value pre-researched, schema/engine not yet there". Includes value, unit, rationale, source, blockers, minerals_unlocked. See bingham_canyon entry as canonical example before Au shipped.
- **`intentionally_zero`** in `data/locality_chemistry.json` — for "we checked and zero is the right answer for this locality". Established in commit `e2048e9` for the Au audit. When any new schema field lands, run the per-locality gap-check and document zero values explicitly so future audits don't re-flag them.
- **Three-place note pattern** — when a new schema element is researched but engine pending, leave cross-referenced notes in: vugg.py scenario comment + index.html mirror comment + data/locality_chemistry.json `pending_schema_additions` block. See bingham_canyon Au notes (pre-commit `e13d7f1`) for the reference shape.
- **Push to Syntaxswine origin** — the user's fork is the push target; StonePhilosopher canonical is read-only here, boss promotes from Syntaxswine.

> **Layout flatten (2026-04-29, commit `4950ffa`):** the prior "per-commit docs/ mirror" pattern is retired. `web/` and `docs/` were collapsed into repo root; GitHub Pages now serves from root, no mirror needed. References to `web/index.html` or `docs/index.html` in completed-work briefs under `build/` are historical — current path is `index.html`.

---

## 🎯 SIM_VERSION
Currently **7** (bumped in commit `97cb088` for Round 7 Commit 3 — corundum family + marble_contact_metamorphism scenario added; previous commit `a2f8f94` was the 5→6 bump for Round 7 Commit 2, beryl family split).

Bump to 8 when:
- Cd field shipped (would shift Tri-State seed-42 output)
- Wall porosity slider shipped (changes existing scenario dissolution behavior at default settings)
- Au-Te coupling lands (would partition Bingham Au into telluride growth)
- Halide-expansion round (atacamite, halite, chlorargyrite, etc.)

Defer the version bump decision to whoever ships those changes.

History:
- v1: pre-audit defaults
- v2: scenario-chemistry audit (Apr 2026; commit `77d999a`)
- v3: arsenate/molybdate supergene cascade engines — arsenopyrite + scorodite + ferrimolybdite (Apr 2026; commits `1c9cd29` → `0cd182f`)
- v4: Round 5 sulfate expansion — barite + celestine + jarosite + alunite + brochantite + antlerite + anhydrite (Apr 2026; commits `ccb8ac6` → `a044e81`). Engine count 55 → 62. Coorong sabkha now produces the textbook gypsum + anhydrite + celestine + dolomite + aragonite assemblage. Brings the sulfate class from 1 mineral (selenite) to 8.
- v5: Round 5 gap-fill follow-ups (Apr 2026; commits `c8056ef` + `8b9c831`). Tri-State + Sweetwater O2 0.0→0.25 (mildly reducing MVT brine — barite + celestine activate); barite + celestine supersat O2 saturation retuned to /0.4 (saturates at SO₄/H₂S boundary). Tsumeb early ev_supergene_acidification 4-pulse event + Al 3→25 + jarosite/alunite per-check 0.45 — unlocks scorodite + jarosite + alunite + brochantite at Tsumeb. Engine count unchanged (62); chemistry tweaks only.
- v6: Round 7 Commit 2 — beryl family split (Apr 2026; commit `a2f8f94`). Split the inline-variety detector in `grow_beryl` into 5 first-class species: `beryl` (narrowed to goshenite/generic colorless), `emerald`, `aquamarine`, `morganite`, `heliodor`. Priority chain emerald > morganite > heliodor > aquamarine > goshenite baked into supersaturation gates via exclusion preconditions. `check_nucleation` uses one-per-step dispatch to prevent shared-Be-pool over-nucleation. Seed-42 `gem_pegmatite` now nucleates 4 emerald + 4 aquamarine + 3 morganite (goshenite naturally suppressed by chromophore priority). Engine count 62 → 66.
- v7: Round 7 Commits 3+4 — corundum family + marble_contact_metamorphism scenario (Apr 2026; commit `97cb088`). First **UPPER-BOUND gate** in the sim: SiO2 < 50 is the defining corundum constraint (with any more silica, Al + SiO2 drives to feldspar/kyanite/sillimanite). Shared `_corundum_base_sigma()` helper. Three new species: `corundum` (colorless/generic), `ruby` (Cr ≥ 2), `sapphire` (Fe ≥ 5 with in-engine color dispatch). New scenario anchored to Mogok Stone Tract (Al=50, SiO2=20, Ca=800, Cr=3, Fe=8, Ti=1, pH=8). Violet-sapphire (V-only path) deferred — would break necessity-of-Fe gate test. Engine count 66 → 69. Total baseline scenarios 12 → 13.

---

## 🧪 Scenario-tune follow-ups (deferred from v3 mineral expansion)

### ~~Tsumeb pH gap (now affects scorodite + jarosite + alunite)~~ ✅ **RESOLVED (v5, commit `8b9c831`)**
**Resolution:** Added `ev_supergene_acidification` event scheduled 4× (steps 5/8/12/16) in `scenario_supergene_oxidation` — drops pH to 4.0 + adds H₂SO₄ each pulse, holding the acid window against the limestone wall's carbonate buffering for ~15 steps before `ev_meteoric_flush` (step 20) neutralizes. Plus Tsumeb Al bumped 3→25 to clear alunite's Al/25 cap. Plus jarosite + alunite per-check probabilities bumped 0.18/0.15→0.45 to reflect their fast acid-sulfate kinetics in brief windows.

Now active at Tsumeb: scorodite (95% seed hit rate), jarosite (95%), alunite (70%), brochantite (already worked, now coexists). Antlerite correctly stays absent — Tsumeb is brochantite-dominant per geology, not antlerite-dominant (antlerite is the Atacama/Chuquicamata signature). See `data/locality_chemistry.json:tsumeb.mineral_realizations_v3_expansion.scorodite` + `mineral_realizations_v4_sulfate_expansion.jarosite/alunite/antlerite` for full citation tags.

### ~~Tri-State + Sweetwater O2=0.0 gap~~ ✅ **RESOLVED (v5, commit `c8056ef`)**
**Resolution:** Bumped Tri-State + Sweetwater O2 from default 0.0 to 0.25 — mildly reducing brine matching real MVT chemistry at the SO₄/H₂S boundary. Plus barite + celestine supersaturation O2 factor retuned from O2/1.0 to O2/0.4 (saturates at the SO₄/H₂S boundary, geochemically correct).

Verified seed-42:
- Tri-State (was 0/0): 6 active barite (max 32 µm), 10 celestine (max 111 µm)
- Sweetwater (was 0/0): 14 active barite (max 63 µm — Viburnum is the high-Ba MVT endmember per Stoffell 2008), 8 celestine (max 56 µm)

Coorong sabkha behavior unchanged (O2=1.5 was already saturated; engine retune is a no-op above O2=0.6).

### Bingham/Bisbee scorodite + ferrimolybdite end-to-end verification
**Status:** engines are wired and chemistry should produce both, but no full-scenario seed-42 run was executed during the v3 expansion (porphyry/Bisbee runtimes are slow). When time permits, run seed-42 porphyry (120 steps) and bisbee (340 steps) and confirm the realization predictions in `mineral_realizations_v3_expansion`:
- Bingham: arsenopyrite forms early, oxidizes after step 85, scorodite + ferrimolybdite nucleate post-oxidation
- Bisbee: arsenopyrite forms strongly (Fe=200 → enormous σ), oxidizes after step 65 ev_uplift_weathering, scorodite nucleates from arsenopyrite oxidation products

Failures would point to either (a) chemistry tuning needed (rare given the audit) or (b) σ thresholds need adjustment.

---

## 🔗 Canonical-only research / proposals (not yet folded into engine work)

These exist on `canonical/main` (StonePhilosopher) but were not merged into Syntaxswine fork during the recent rounds. Read and either implement, fold into BACKLOG, or merge:

- `proposals/MINERALS-RESEARCH-UNIMPLEMENTED.md` (canonical commit `41183b9`) — **DONE**: arsenopyrite/scorodite/ferrimolybdite engines shipped (commits `1c9cd29`–`0cd182f`). Expanded paragenetic notes on molybdenite + wulfenite from this file are reference-only (no engine changes needed).
- `proposals/MINERALS-RESEARCH-SULFATES.md` (Syntaxswine commit `ca6d710`, written this session) — **DONE**: all 7 sulfates (barite, celestine, jarosite, alunite, brochantite, antlerite, anhydrite) shipped (commits `ccb8ac6`–`a044e81`). The research doc remains the canonical citation source for narrators.
- `proposals/Gibbs-Thompson dissolution cycling — crystal quality mechanic` (canonical commit `6577442`) — **NOT YET READ**. Crystal-quality mechanic proposal. Action: read the file and decide whether to implement, scope into BACKLOG, or punt.

---

## 🔮 Round 6 candidates (not yet pre-researched)

Now that Round 5 sulfates are done, the next natural class expansion is **halides**. Candidates with chemistry already in FluidChemistry (Cl, Cu, Ag, Na, K all populated):

- **halite** (NaCl) — Coorong sabkha activation; salinity field already drives it
- **atacamite** (Cu₂Cl(OH)₃) — Cl-rich Cu oxide; Bisbee Cl=200 + Atacama; competes with brochantite (already flagged in `grow_brochantite`'s Cl>100 trace note)
- **chlorargyrite** (AgCl) — Tsumeb supergene Ag halide; activates the Ag pool that Tsumeb already populates
- **boleite** (KPb₂₆Ag₉Cu₂₄Cl₆₂(OH)₄₈ — extremely Cl-rich, deep blue; rare display target)

Plus possible follow-on Cu sulfates (chalcanthite — CuSO₄·5H₂O, the extreme-acid Cu sulfate that competes with antlerite below pH 1) and natrojarosite (Na variant of jarosite, common in salty AMD).

A research doc following the `MINERALS-RESEARCH-SULFATES.md` shape would be the next logical artifact.

---

## 💎 Round 7 — Gemstones ✅ SHIPPED (Apr 2026)

**Completed: beryl family + corundum family.** Per `proposals/MINERALS-PROPOSAL-GEMSTONES.md` + `proposals/MINERALS-RESEARCH-GEMSTONES.md`, 7 new first-class species (mineral count 62 → 69) landed across 4 commits:

- `a5fbaf6` — Commit 1: research compendium
- `a2f8f94` — Commit 2: beryl family split (SIM_VERSION 5→6)
- `97cb088` — Commits 3+4: corundum family + marble_contact_metamorphism scenario (SIM_VERSION 6→7)
- (this commit) — Commit 5: locality chemistry realizations + BACKLOG cleanup

Notable outcomes:
- **First upper-bound gate** in the sim: corundum family's SiO₂ < 50 constraint. This opens the door for the Al₂SiO₅ polymorph family (kyanite/andalusite/sillimanite) and other Si-undersaturated chemistry in future rounds.
- **Scaffolding tool proved out**: `tools/new-mineral.py` reliably inserted 7 JSON entries, generated paste-ready code stubs, and the auto-added entries passed all 48 parameterized per-mineral tests after engine code landed. ~15 minutes per species (down from ~45 min pre-tool).
- **Violet sapphire deferred**: V-only Tanzania variety would break the Fe-necessity gate test. Noted in Round 8+ candidates.
- **Mogok marble-contact scenario**: seed-42 nucleates 1 ruby + 1 calcite + 2 aragonite. Ruby wins the Cr=3 priority race; sapphire needs Cr depletion + Fe>=5 before it fires, which the 180-step window doesn't always afford. Further scenario tuning may be needed if we want seed-42 sapphire — consider ev_chromium_depletion event scheduled mid-run.

Deferred to a future round:
- Violet sapphire (V-only Tanzania) — separate `violet_sapphire` species with V-gate
- Color-change sapphire (Umba Valley, Cr+V+Fe) — could be a sub-variety of violet
- Alexandrite (BeAl₂O₄ + Cr) — chrysoberyl family; needs Be+Al+Cr with no Si (related to corundum SiO₂-undersaturation)
- Garnet supergroup (pyrope, almandine, spessartine, grossular, andradite, uvarovite) — clustered with D3
- Tanzanite (Ca₂Al₃Si₃O₁₂(OH) + V) — zoisite/epidote family
- Jade (jadeite = NaAlSi₂O₆ high-P + nephrite = Ca₂Mg₅Si₈O₂₂(OH)₂) — pressure-gated, clustered with D3
- Chrysoberyl (BeAl₂O₄) — related to corundum SiO₂-undersaturation; could be its own small cluster

---

## 🪨 Round 8 — Mineral expansion ✅ SHIPPED (Apr 2026)

**Completed: 15 new species across 5 sub-rounds.** Per the boss's 61-file research drop (canonical commit `f2939da`) + `proposals/ROUND-8-IMPLEMENTATION-KICKOFF.md`, mineral count 69 → 84, tests 842 → 1037 (+195), SIM_VERSION 7 → 8.

**Sub-rounds shipped:**
- 8a — silver suite (acanthite, argentite + 173°C paramorph mechanic, native_silver) — commits `3345bf1` → `aebeea6`
- 8b — native element trio (native_arsenic, native_sulfur synproportionation, native_tellurium) — commits `da76464` → `1b29ba0`
- 8c — Ni-Co sulfarsenide cascade (nickeline, millerite, cobaltite three-element gate + Bisbee Co=80/Ni=70) — commit `f050bb3`
- 8d — VTA suite (descloizite, mottramite, raspite, stolzite, olivenite + Tsumeb W=20) — commit `afc41e6`
- 8e — chalcanthite + water-solubility metastability mechanic — commit `a017844`

**Three new mineral-mechanic patterns added to the sim:**
1. **PARAMORPH_TRANSITIONS** (8a-2) — module-level dict + apply_paramorph_transitions hook in run_step. First non-destructive polymorph mechanic: argentite cooling past 173°C converts in-place to acanthite while preserving habit + dominant_forms + zones. Distinct from THERMAL_DECOMPOSITION (which destroys the crystal). 10 regression tests in `tests/test_paramorph_transitions.py`.
2. **Three-element gate** (8c-4) — cobaltite (CoAsS) requires Co + As + S all present simultaneously at minimum thresholds. First three-reagent gate; pattern available for future minerals (e.g., proustite Ag₃AsS₃, pyrargyrite Ag₃SbS₃).
3. **Water-solubility metastability** (8e) — chalcanthite re-dissolves when fluid.salinity<4 OR fluid.pH>5. Per-step hook in run_step distinct from THERMAL_DECOMPOSITION + PARAMORPH_TRANSITIONS — this is just chemistry. 5 regression tests in `tests/test_metastability.py`.

**Five new chemistry-dispatch patterns:**
1. **Depletion / overflow gate** (8a-3, 8b) — native_silver (S<2), native_arsenic (S+Fe<thresholds), native_tellurium (Au+Ag<thresholds). Inverse of normal supersaturation logic.
2. **Synproportionation Eh window** (8b-2) — native_sulfur fires only in the H₂S/SO₄²⁻ boundary (0.1<O2<0.7). First Eh-window engine.
3. **Mutual-exclusion priority gate** (8c-3) — millerite (NiS) returns 0 when As>30 + T>200 (nickeline NiAs takes priority).
4. **Cu/Zn-ratio fork** (8d) — descloizite/mottramite + olivenite/adamite both use Cu>Zn vs Zn≥Cu dispatchers.
5. **Kinetic-preference dispatcher** (8d-2) — raspite/stolzite both PbWO₄, kinetic preference favors stolzite ~90% of rolls.

**Backlog items unblocked or ready:**
- **Au-Te coupling round** (calaverite + sylvanite + hessite + altaite + tetradymite + coloradoite) — natural Round 9 lift. Te is now plumbed in FluidChemistry; native_tellurium's Au>1 gate becomes the dispatcher's Au-rich path → calaverite. Hg field needed for coloradoite (HgTe). Once Au is consumed by calaverite, residual Te will fire as native_tellurium.
- **Tarnish clock for native silver/arsenic/tellurium** (deferred from 8a + 8b) — per-step acanthite/arsenolite/tellurite-rind accumulation regardless of S availability. Should also apply to existing native_bismuth.
- **Cobalt-Ontario / Freiberg silver vein scenario** — would activate the primary nickeline + cobaltite + native_silver suite at seed-42 (currently absent; Bisbee chemistry isn't As-rich enough for sulfarsenide formation).
- **Acid mine drainage scenario** — would activate chalcanthite at seed-42 (currently absent_at_seed_42 in declared scenarios).

**Outstanding work from the boss's research drop (NOT in Round 8):**
- 41 expanded-research narrator refresh sweep — the boss's 61-file commit included richer research for 41 already-shipped species. Folding the new detail into existing narrators is a multi-session task; lower priority than next-round species expansion.

---

## 💎💎 Round ~end-of-list (positions ~185-200) — Diamond + mantle/high-P plumbing cluster

**RESERVED SLOTS**: diamond is the last mineral on the target list of 200, and ~15-20 slots adjacent to it are reserved for minerals that share the same plumbing investment (the "D3 option" from `proposals/MINERALS-PROPOSAL-GEMSTONES.md`). Rationale: the infrastructure to model diamond (carbon field in FluidChemistry + pressure-as-chemistry-driver + mantle T+P regime) is heavy; single-use for diamond would be wasteful. Clustering lets the plumbing pay for itself ~15-20 times.

**Reserved cluster (tentative order, all share the D3 plumbing):**

### Class 1 — carbon-field additions (C added to FluidChemistry)
- **graphite** (C) — metamorphic schists; a legitimate vug mineral (unlike diamond)
- **moissanite** (SiC) — rare, mostly meteoritic; scientific novelty
- **anthraxolite** (solid hydrocarbon) — already partially implemented via Herkimer narrative; could be a real inclusion mineral

### Class 2 — pressure-gated polymorphs (making `VugConditions.pressure` a real supersaturation driver instead of cosmetic)
- **kyanite** (Al₂SiO₅, high-P) — blue-blade gem
- **andalusite** (Al₂SiO₅, low-P) — chiastolite cross-pattern gem
- **sillimanite** (Al₂SiO₅, high-T) — completes the classic Al₂SiO₅ phase-diagram triangle
- **coesite** (SiO₂ high-P polymorph) — meteor-crater + UHP subduction indicator
- **stishovite** (SiO₂ extreme-P polymorph) — shock metamorphism
- **jadeite** (NaAlSi₂O₆) — jade; low-T high-P subduction
- **omphacite** (eclogite pyroxene) — deep subduction
- **lawsonite** (CaAl₂Si₂O₇(OH)₂·H₂O) — blueschist facies indicator
- **glaucophane** (Na₂(Mg,Fe)₃Al₂Si₈O₂₂(OH)₂) — the amphibole that names blueschist

### Class 3 — mantle / kimberlite xenolith minerals (needs mantle T+P + the above plumbing)
- **olivine / peridot** (Mg₂SiO₄) — the most abundant mineral on Earth by volume; its absence is the biggest gap in the current sim; gem variety is peridot
- **enstatite** (MgSiO₃) — mantle orthopyroxene
- **diopside / chrome diopside** (CaMgSi₂O₆) — mantle clinopyroxene; bright-green gem
- **pyrope garnet** (Mg₃Al₂Si₃O₁₂) — blood-red gem; Bohemian garnet
- **spinel** (MgAl₂O₄) — gem (Black Prince's "Ruby" in the Crown Jewels is actually a spinel); uses corundum's SiO₂-undersaturated gate
- **phlogopite** (KMg₃AlSi₃O₁₀(F,OH)₂) — bronze-brown mica xenocryst
- **ilmenite** (FeTiO₃) — kimberlite prospecting indicator
- **chromite** (FeCr₂O₄) — source of the Cr that gives emerald its color; black octahedra
- **perovskite** (CaTiO₃) — mantle; eponymous to the perovskite structure family
- **diamond** (C) — the capstone

### New scenarios enabled by Class 2 + 3 plumbing
- `scenario_blueschist_subduction` — lawsonite, glaucophane, jadeite, omphacite
- `scenario_impact_crater` — coesite, stishovite, shocked quartz, meteoritic moissanite
- `scenario_kimberlite` — diamond + pyrope + chrome diopside + olivine + phlogopite + ilmenite + chromite xenocryst suite

### Interim placeholder plan
Until the D3 plumbing round arrives (late in the 200-mineral runway), diamond stays on hold. If the user wants a visible diamond before the plumbing round, Option D2 (xenocryst event in a lightweight kimberlite scenario) can ship as a bridge — 2-4 hours; `scenario_kimberlite` created as a shell, diamond teleports in as a pre-formed crystal, narrator explains the xenocryst origin honestly. When the D3 plumbing lands, diamond gets retrofitted to mantle-grown-in-sim and the shell scenario fills out with the rest of the cluster.

---

## 🌐 3D simulation — loose ends from the multi-ring rollout (May 2026)

**Context:** the 3D-track session that landed Phases A → D v1 + canvas fix + sphere shape + cross-axis polar + per-latitude twist (commits `03625b0` through `1c77950`, ten commits) left a few intentional gaps. Listing them here so they don't fall through. Tutorial 3 (the "Fourth Door" oxidation breach) is also deferred, but is tracked separately in the tutorial proposal docs.

### Sim-version 20 mineral drop — bornite + magnetite

**Status:** known regression from Phase C v1, accepted at the time, expects_species lists updated with a comment pointing back here.

**Why:** Phase C v1 (commit `375adcf`) wired growth to per-ring chemistry. Each crystal's growth now reads `ring_fluids[crystal.wall_ring_index]` instead of the global, with mass-balance consumption hitting that ring's fluid. Inter-ring diffusion homogenizes slowly, so per-ring chemistry diverges briefly from the bulk during fast nucleation bursts. At seed 42 this shifted two borderline minerals out of the "fires reliably" window:
- `bornite` in `porphyry`
- `magnetite` in `deccan_zeolite`

Their engines and chemistry data are unchanged. Their gates just don't get crossed at seed 42 under sim_version 20+. The expects_species lists in `data/scenarios.json5` were trimmed (with comments referencing this entry) so the tests pass.

**What to build:**
1. Pick a chemistry-tuning approach for these two scenarios. Options:
   - Tune the scenario's initial fluid so the engine's σ for the dropped mineral is comfortably above its nucleation threshold by step ~50, even with per-ring fragmentation
   - Add a small event nudge mid-scenario (e.g. `magnetite_seed_pulse` at step 60 in deccan_zeolite) to push σ over the gate at the right moment
   - Bias `_assign_wall_ring` so minerals with strong scenario-anchor expectations land on the equator ring (which shares storage with conditions.fluid via aliasing — stronger event coupling)
2. Restore the dropped expects_species entries when the tuning lands.

**Out of scope:** changing the per-ring fluid mechanic itself. The fragmentation is the design intent.

### Habit textures missing in 3D mode — RESOLVED by wireframe crystals

**Status:** **superseded** by `proposals/PROPOSAL-WIREFRAME-CRYSTALS.md`. Wireframe rendering replaces wedge+habit-texture entirely in 3D mode — each habit now resolves to a hand-crafted polyhedron primitive (cube, hex_prism_terminated, scalenohedron, …), painted as silhouette fill + wireframe edges. Habit fidelity in 3D is now structural (the geometry IS the habit) instead of textural.

The original `drawHabitTexture` 2D textures (`_texture_sawtooth`, `_texture_rhomb`, etc.) stay in the codebase for the 2D topo strip — that path is untouched.

**If 2D-mode wireframes are ever wanted** (top-down orthographic of one slice), the same primitive library projects orthographically just as well; would respect the slice stepper state. Out of scope for v0.

### Hit-test broken in 3D mode — RESOLVED

**Status:** **resolved** in commit `f77a757`.

The original plan (cast a ray, intersect with the sphere shell, recover phi/theta) didn't survive contact with the actual cavity geometry: rings have latitude-dependent radius factors (`sin(φ)·polar_profile`) and per-cell base_radius wobble, so a ray-vs-mean-sphere intersection lands beyond where the cells actually sit. Switched to brute-force nearest-projected-cell — forward-project every cell's anchor center and pick the one whose projection is closest to the cursor in screen space. Naturally correct for the bumpy surface and handles both front and back hemispheres without explicit hemisphere math. ~2k operations per hit-test, negligible at hover-event frequency.

User-intent rule: prefer crystal-bearing cells over bare-wall ones within 14 px of the cursor (the user almost certainly meant the visible crystal, not its bare neighbor). Bare-wall tooltip itself is suppressed in 3D mode — the wireframe topo map shows the wall directly, so the readout was friction without information.

Same change refactored `_topoTooltipFromEvent` to consume `_topoHitTest`'s cell directly instead of duplicating the geometry math (the duplication was 2D-only and wouldn't have worked in 3D anyway).

### Water-level mechanic — partial-fill vugs (foundation)

**Status:** **foundation shipped 2026-05-04** (SIM_VERSION 23 → 24). Companion: `PROPOSAL-EVAPORITE-WATER-LEVELS.md`. Bridges directly into `PROPOSAL-AIR-MODE.md`'s air-mode end-to-end.

What landed:
- `VugConditions.fluid_surface_ring: float | None` — the meniscus position along the polar axis. None = fully submerged (legacy default; existing scenarios stay byte-identical).
- `VugConditions.ring_water_state(ring_idx, ring_count) -> 'submerged' | 'meniscus' | 'vadose'` classifier on both Python and JS sides.
- Nucleation reads the ring's water state and stamps `Crystal.growth_environment` accordingly (`vadose → 'air'`, otherwise `'fluid'`). The dormant air-mode plumbing from v22 now has a real trigger.
- 3D renderer paints a translucent blue meniscus disc at the surface latitude, sorted into the painter's order so it occludes correctly with rings/crystals.
- Tests: `tests/test_water_levels.py` covers default-submerged, partial-fill, integer-boundary, fully-drained, fully-flooded, single-ring, and the air/fluid stamping invariant. Baseline `seed42_v24.json` is byte-identical to v23 (legacy default keeps behavior stable).

What's NOT in the foundation (deferred to follow-on stages, in order of likely-next):
1. **Renderer tier-2 polish:** disc Z-occlusion is done at disc-centre granularity; objects straddling the disc's z get a coarse painter's-order tie. Per-segment splitting if it reads wrong at extreme tilts.
2. **~~Scenario events that mutate `fluid_surface_ring`~~** — **shipped 2026-05-04** (SIM_VERSION 24 → 25). `event_supergene_dry_spell` now drops the surface to mid-cavity (ring 8) and `event_bisbee_final_drying` fully drains (ring 0). Engine helper `_apply_vadose_oxidation_override` runs at the top of every `run_step` after events have applied: rings that just transitioned wet → vadose get O2 ratcheted to 1.8 (oxidizing) and S × 0.3 (sulfide oxidation depletes solute sulfur). Submerged rings keep the scenario's chemistry, so the floor stays reducing while the ceiling oxidizes — matching real supergene paragenesis. Existing oxidation-product engines (limonite, cerussite, malachite, autunite, scorodite, …) fire naturally because they already read each crystal's ring fluid via Phase C v1 plumbing. Verified in browser preview: post-drainage bisbee has 12 air-stamped supergene crystals (lepidocrocite, chrysocolla, hematite, annabergite, erythrite, quartz). Baseline `seed42_v25.json` regenerated; full suite 1376/1376 green.

   **Follow-up shipped 2026-05-04** (SIM_VERSION 25 → 26): host-rock porosity. New `VugConditions.porosity: float` (default 0.0 = sealed cavity, no drainage). Per-step continuous drift: `fluid_surface_ring -= porosity × WATER_LEVEL_DRAIN_RATE` (currently 0.05 rings/step at porosity=1.0 — drains 16 rings in 320 steps, matching typical scenario length). Asymmetric on purpose — porosity is a pure sink, refilling stays event-driven. Two example events for sudden fill/drain: `event_tectonic_uplift_drains` (snaps to 0) and `event_aquifer_recharge_floods` (snaps to ceiling via a 1e6 sentinel that the drift method clamps to ring_count). Default `porosity=0.0` keeps existing scenarios sealed and byte-identical to v25. Full suite 1386/1386 green.

   **Open polish — scaled / depth-proportional drainage:** the v26 drift uses a constant rate. A more physically-faithful model is RC-circuit-like: drainage proportional to depth above some equilibrium (the regional water table the cavity is sitting in). High when the cavity is full, slowing as it empties. The constant-rate model is simpler to reason about and reads correctly for most scenarios; the proportional model better captures cavities that sit near the regional water table and re-equilibrate to a non-zero level. Pick up if a scenario's drainage curve doesn't read right.
3. **~~Air-mode habit consequences~~** — **shipped 2026-05-04** (commit `4f71bbc`). `PRIM_DRIPSTONE` is now in the wireframe library; `_lookupCrystalPrimitive` overrides eligible habits (prismatic, acicular, rhombohedral, scalenohedral, botryoidal, plus their compound variants) to dripstone when `Crystal.growth_environment === 'air'`. Cubic / octahedral / tetrahedral / tabular / dipyramidal / pyritohedral habits stay canonical (galena cubes don't form icicles). The renderer's existing c-axis flip handles ceiling-vs-floor orientation: ceiling cells get c-axis world-down (stalactite hanging), floor cells get c-axis world-up (stalagmite standing). Reuses one primitive for both via the orientation logic, per PROPOSAL-AIR-MODE.md Stage A.
4. **~~Evaporite-specific minerals + concentration multiplier~~** — **shipped 2026-05-04** (SIM_VERSION 26 → 27). New per-ring `FluidChemistry.concentration` multiplier (default 1.0 — byte-identical legacy behavior) boosted by 3× at every wet → vadose transition; models the geological reality that water leaving a ring concentrates the remaining solutes. New `WATER_STATE_PREFERENCE` table biases evaporite minerals (selenite ×2.5, anhydrite ×2, halite ×4) toward the meniscus ring — bathtub-ring chemistry. Halite added (NaCl, cubic + hopper-growth habit, supersaturation reads Na × Cl × concentration² so it stays dormant in scenarios that don't drain). Bisbee post-drain and sabkha cycling now grow halite naturally; mvt / reactive_wall / porphyry don't (gates correctly tuned to require evaporative drainage). Full suite 1562/1562 green.

   **Borax + dehydration paramorph follow-up shipped 2026-05-04** (SIM_VERSION 27 → 28). Adds borax (Na₂[B₄O₅(OH)₄]·8H₂O) — alkaline-brine borate evaporite with Na + B + pH ≥ 7 + T ≤ 60°C + `concentration ≥ 1.5` hard gate (active-evaporation only; submerged rings can't nucleate). Three habits per the research file: prismatic (Boron CA museum specimens), cottonball (Death Valley playa surface), massive (tincal nodules). New DEHYDRATION_TRANSITIONS framework — environment-triggered paramorph (counterpart to PARAMORPH_TRANSITIONS' temperature trigger). Borax in a vadose ring accumulates `Crystal.dry_exposure_steps`; once ≥ 25 steps, it pseudomorphs to tincalconite (Na₂B₄O₇·5H₂O) with external shape preserved. Heat path fires immediate dehydration above 75°C. Tincalconite is a paramorph-only product — has supersat=0 stub + no-op grow function so it satisfies the spec coverage tests but never nucleates from solution. The signature "borax effloresces in your collection drawer" mechanic, geologically authentic. Concentration is also now excluded from inter-ring diffusion (it's per-ring evaporation-history state, not a diffusable solute) — small drift in bisbee halite max-size as a result. 16 new tests; full suite 1595/1595 green.
   **Naica + Searles Lake locality scenarios shipped 2026-05-04** (SIM_VERSION 29 → 30). Two new geologically-anchored scenarios that actually exercise the v27-29 evaporite suite end-to-end. **Naica geothermal** (Cueva de los Cristales, Chihuahua, Mexico) per Garcia-Ruiz et al. 2007 *Geology* 35:327 — initial 56°C anhydrite-saturated water cools through six slow_cooling pulses to ~52°C, growing 10 selenite cathedral blades; 1985 mining drainage event drops the cave; 2017 recharge event refloods. **Searles Lake** (San Bernardino Co, CA) per Smith 1979 USGS PP 1043 — Mojave alkaline-saline brine with five wet/dry seasonal cycles. Winter freezes (T=8°C, surface drops to ring 4 from cold-air sublimation) → mirabilite + halite + borax fire. Summer bakes (T=55°C, surface drops to 0 = full drain) → mirabilite paramorphs to thenardite, borax to tincalconite, halite continues. Sierra snowmelt fresh_pulse events refill the basin between cycles. Six new event types registered in EVENT_REGISTRY (naica_slow_cooling, naica_mining_drainage, naica_mining_recharge, searles_winter_freeze, searles_summer_bake, searles_fresh_pulse). Cleanup: removed concentration decrement from evaporite engines — concentration is an evaporation-history multiplier, not a solute mass account, so precipitating solutes shouldn't undo it. Drift: bisbee halite max-um shifts slightly from this fix; baseline regenerated. Full suite 1631/1631 green.

   **Mirabilite + thenardite triplet completion shipped 2026-05-04** (SIM_VERSION 28 → 29). Closes the Na-sulfate evaporite pair using the v28 dehydration framework. Mirabilite (Na₂SO₄·10H₂O, Glauber salt) is the cold-side decahydrate stable below the 32.4°C eutectic; thenardite (Na₂SO₄, anhydrous) is the warm-side product. Both gate on Na + S + concentration ≥ 1.5; mirabilite refuses to nucleate above 32°C and thenardite refuses below 25°C, with a small eutectic window between where neither fires (real geology has metastability there). Mirabilite → thenardite added to DEHYDRATION_TRANSITIONS with T_max=32.4 — heat path fires the moment a warming brine crosses the line; slow vadose-exposure path (30 dry steps) covers cold dry caves where Glauber salt loses water without warming. Three-mineral evaporite paramorph triplet now: borax → tincalconite (humidity), mirabilite → thenardite (mostly heat), and the older argentite → acanthite (T-falling) for the cool-side polymorph case. Engine drift: zero — no scenarios seed Na+S+cool-T+concentration simultaneously, so mirabilite/thenardite stay dormant in the v28 baseline. 11 new tests; full suite 1622/1622 green.

6. **Dripstone aspect-ratio refinement:** primitive radius taper (0.30 → 0 across 4 latitude rings) yields ~5-10:1 once multiplied by typical prismatic crystal ratios. Photographs of mature cave stalactites show even slimmer (10-20:1) — bias future dripstone crystals' a_width_mm via a per-habit override if it reads too stubby in scenarios. Soda-straw variant for very young dripstone (hollow tube the diameter of a water drop) is a separate primitive worth adding when a scenario actually grows dripstone from t=0.

### Phase D v2 — mineral-spec orientation hints

**Status:** **shipped 2026-05-04**. See companion `PROPOSAL-AIR-MODE.md` for the air-mode-specific extension (a separate future task).

Geological background corrected: in a fully fluid-filled vug at depth, gravity-driven settling is weak and most minerals are spatially neutral. Documented preferences trace to density-driven convection, gravity-assisted micro-cluster settling before nucleation, or substrate-chemistry effects — NOT direct gravity on growing crystals. (The original BACKLOG framing of "calcite scalenohedra hang from the ceiling under gravity" was the cave-mode story; in fluid-filled vugs the bias is much subtler.)

Implementation: per-mineral `ORIENTATION_PREFERENCE` table in `vugg.py` with strong/weak factors (3.0× / 1.5×), consumed by `_assign_wall_ring` to bias the area-weighted sampling. Spatially neutral minerals (most species) stay area-weighted as before.

Documented preferences applied:
- **Floor (subtle):** galena, malachite, azurite, barite, celestine, goethite, native_gold, native_silver, smithsonite — density-driven micro-cluster settling or supergene fluid pooling
- **Floor (strong):** selenite (gypsum) — Naica-style subaqueous pool growth
- **Ceiling (subtle):** hematite (specular rosette / "iron rose")
- **Wall:** stibnite, bismuthinite — acicular sprays grow perpendicular to substrate

Sources: Sangster 1990 (MVT paragenesis), Garcia-Ruiz et al. 2007 (Naica selenite), Hanor 2000 (barite brine density), Hill & Forti 1997 (cave mineralogy).
