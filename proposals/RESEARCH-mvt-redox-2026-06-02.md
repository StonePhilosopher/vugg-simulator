# RESEARCH — MVT (Tri-State) redox evolution during sulfide deposition (2026-06-02)

Grounding pass for the **4c.3b `mvt` Eh-movement pilot**. Run via the deep-research
harness (102 agents; 20 sources fetched, 85 claims extracted, 25 adversarially
verified → 18 confirmed / 7 killed). **All citations below survived the verify
pass; do NOT add any not listed here without re-verifying (v145 fabrication
lesson).** Refuted claims are kept on purpose — they're what NOT to model.

## The question
What is the redox (Eh / fO2) evolution of MVT Pb-Zn ore fluids during sulfide
deposition (Tri-State / Joplin), to parameterize a reducing redox "movement" for
the 120-step `mvt` scenario (basinal NaCl-CaCl2 brine, ~150-180°C, pH 5-6;
sphalerite + galena + barite + fluorite + calcite)?

## CONFIRMED findings (verified)
1. **The ore fluid is strongly REDUCING throughout sulfide deposition** — in the
   H2S(aq)/HS⁻ field, **≥2 log fO2 units below** the sulfate/sulfide boundary;
   sulfur travels + precipitates as sulfide, not sulfate (sulfate not Raman-
   detected). *Wenz, Appold, Shelton & Tesfaye 2012, Am. J. Sci. 312:22-80;
   Appold 2009 USGS 06HQGR0178.* (3-0)
2. **Absolute anchors (log fO2):** ≈ **−52 to −53** at 120°C (Wenz 2012, from
   inclusion CH4+CO2); ≈ **−54 to −55** at 100°C (Appold 2009, ~0.02 m CH4);
   **−60** is citable but is an *assumed modeling input* (Stoffell et al. 2008,
   Econ. Geol. 103:1411), not measured. QFM ≈ −57 at 120°C (also in the sulfide
   field). The measurement-grounded −52…−55 are the defensible anchors. (3-0)
3. **Model envelope:** 100°C MVT ore fluids span log fO2 ≈ −48 to −60 by pH/model
   (Anderson −48…−51; Sverjensky −50.5…−51.5 @125°C; Giordano & Barnes −54…−58).
   *Giordano 2002, Geochem. Trans. 3:56-72 (PMC1475621), Table 1.* (3-0)
4. **Tri-State mechanism = MIXING — of TWO RELATIVELY REDUCING fluids** (a Pb-/
   metal-rich, S-poor brine + a metal-poor, reduced-S-rich brine). High Pb
   (100s-1000s ppm) precludes co-transporting metals + reduced S → forces two
   fluids. *Wenz 2012; Stoffell et al. 2008.* **NOT** an oxidized-meets-reduced
   swap — the "relatively oxidizing metal brine" reading was **refuted 0-3**. (3-0)
5. **District-specific:** Tri-State = mixing; Northern Arkansas (same study) =
   in-situ carbonate dissolution + fluid neutralization/reduction, no district-
   scale mixing. So parameterize Tri-State as mixing-driven. *Stoffell 2008.* (3-0)
6. **TSR is a viable secondary H2S source** (fast enough at upper-range rate
   constants; ~10⁴-10⁶ yr) and the Anderson/Thom lineage nests "TSR-during-mixing"
   *under* the mixing hypothesis. *Thom & Anderson 2008, Geofluids 8:16-26;
   Anderson & Thom 2008, Geofluids 8:27-34.* (3-0) Caveat: TSR favorable only at
   the upper end of a 4-order rate range.
7. **Spatial control = the mixing front**, not bulk reduction: reactive transport
   gives carbonate dissolution above the fracture, calcite between cavity + host,
   sulfide localized near the fracture in a sub-cavity volume. *Corbella, Ayora &
   Cardellach 2004, Mineralium Deposita 39:344-357.* (2-1; generic MVT, not
   Tri-State; no absolute redox numbers.)
8. **Redox/fluid change is EPISODIC, not monotonic:** zoned sphalerite records
   repeated metal-fluid influxes mixing with a separate reduced-S fluid. *Nayongzhi,
   S. China — Mineralogical Magazine.* (2-1; off-target deposit, conceptually
   transferable.)

## REFUTED (do NOT model these)
- "Fluids sit NEAR the sulfate/sulfide boundary / at the transition." **0-3** — they
  sit *deep* in the reduced field.
- "The metal brine is relatively OXIDIZING (reduced externally by mixing)." **0-3** —
  both mixing fluids are reducing.
- "Regular annual 'varve'-like rhythmic sphalerite banding." **0-3** — episodic, NOT
  periodic. (So no fixed-period pulse train is defensible.)
- Botryoidal-δ34S systematic co-variation with banding: **1-2** (killed).

## NOT FOUND (→ modeler's choice, label as such)
- A defensible Tri-State **band/pulse COUNT**.
- A quantified **per-pulse Eh excursion in mV**.
- Any **Eh-in-mV** literature value (sources report log fO2). Eh ≈ −200…−350 mV at
  pH 5-6 / 150°C is a *rough derived* figure, not a literature number.

## PARAMETERIZATION GUIDANCE → corrects the pilot design
- **Baseline:** the fluid is reducing the WHOLE time (deep in the sulfide field).
  The current `mvt` sits at O2≈0.25 → Eh≈+24 mV — **too oxidizing** for the
  sulfide stage. The dominant "movement" is therefore: establish a **reducing
  baseline**, not an oscillation.
- **My earlier "+25 → −150 mV oscillating pulse-train" was WRONG** — it implies the
  fluid swings oxidizing↔reducing, which it does not. Discard it.
- **Pulses = sulfur-SUPPLY influxes at ~constant (reducing) redox**, i.e. the
  existing `fluid_mixing` (step 20) + `fluid_pulse` (step 60) events already model
  the mechanism (they deliver S/Zn). A redox movement adds, at most, **modest
  episodic deeper-reducing dips** + OU texture synced to those events — small, not
  dramatic. Open question (lit-unresolved): does mixing two reducing fluids move
  Eh appreciably at all, or is it S-supply at ~constant redox?
- **BARITE TENSION (check before baking):** `mvt` expects barite (a SULFATE).
  A strongly-reducing fluid suppresses sulfate → barite likely belongs to an
  earlier/separate (less-reducing) stage, not the reduced sulfide stage. A naive
  "reducing throughout" movement may wipe barite. → **dark-observe the shape on
  `mvt` first** and confirm the full assemblage (esp. barite) survives before any
  baseline bake. A gentle oxidized→reduced *trend* (barite/fluorite early →
  sulfides late) is a defensible paragenetic reading that preserves barite; a
  flat-reducing baseline may not.

## Sources (verified, primary)
- Wenz et al. 2012, Am. J. Sci. 312:22-80 — mospace.umsystem.edu/handle/10355/14564
- Appold 2009, USGS 06HQGR0178 (PDF, d9-wret.s3)
- Stoffell et al. 2008, Econ. Geol. 103:1411 — eps.mcgill.ca/~courses/c561/Stoffell%20et%20al.%202008.pdf
- Giordano 2002, Geochem. Trans. 3:56-72 — PMC1475621
- Thom & Anderson 2008 (Geofluids 8:16-26) + Anderson & Thom 2008 (8:27-34)
- Corbella, Ayora & Cardellach 2004, Mineralium Deposita 39:344-357
- Nayongzhi sphalerite zoning — Mineralogical Magazine (Cambridge)
