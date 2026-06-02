# RESEARCH — supergene oxidation acid front (Tsumeb 1st-stage gossan) (2026-06-02)

Grounding pass for the **Phase 3 `supergene_oxidation` pH-movement pilot** — the
SECOND geological movement (after the 4c.3b `mvt` Eh-trend), chosen to hit the
handoff's "reads true on **2 scenarios**" minimum-lovable-v1 milestone (coda
watch-item 4b). Deliberately a DIFFERENT master variable (pH) than mvt (Eh), so
the engine's generality is what's demonstrated, not a repeat.

**Citation discipline (v145 fabrication lesson):** every reference below is
either (a) independently verified to EXIST across multiple indexes, (b) textbook
chemistry with a named canonical source, or (c) an already-accepted in-repo
reference. Where I read only an abstract/index entry (not the full text), it is
flagged — I do NOT attribute specific numeric values to papers I have not read.
Provenance is marked per claim.

## The question
What is the pH / redox evolution of the meteoric oxidation fluid in a
limestone-hosted Pb-Zn-Cu sulfide gossan (Tsumeb 1st-stage oxidation zone), to
parameterize a master-variable "movement" for the 200-step `supergene_oxidation`
scenario (cold ~35°C, O₂-rich, expects wulfenite + smithsonite + adamite +
mimetite + malachite + vanadinite + cerussite + selenite + the Ca-arsenates
conichalcite / pharmacolite / haidingerite)?

## CONFIRMED findings
1. **Supergene sulfide oxidation GENERATES SULFURIC ACID → the oxidizing-zone
   fluid acidifies.** Canonical pyrite reaction (textbook, balanced):
   `4 FeS₂ + 15 O₂ + 14 H₂O → 4 Fe(OH)₃ + 8 H₂SO₄` (equivalently → 4 FeOOH +
   8 H₂SO₄ + …). Fe²⁺→Fe³⁺ oxidation is the rate-determining step and Fe³⁺ is a
   second sulfide oxidant, so acid production is autocatalytic. *Singer & Stumm
   1970, Science 167:1121-1123 (rate-determining step — verified-famous);
   pyrite-oxidation acid stoichiometry is standard AMD/supergene textbook
   chemistry.* (provenance: textbook + verified-famous primary)
2. **Tsumeb oxidation-zone hydrogeochemistry + arsenate-mineral stability is
   controlled by the pH/Eh of the supergene groundwater.** Tsumeb hosts the
   greatest As-mineral diversity known (63 arsenates incl. the Ca-arsenates the
   scenario expects); their relative stability is a function of oxidation-zone
   fluid chemistry. *Bowell, R.J. (2014), "Hydrogeochemistry of the Tsumeb
   Deposit: Implications for Arsenate Mineral Stability," Reviews in Mineralogy &
   Geochemistry 79:589-627* — VERIFIED to exist (GeoScienceWorld DOI, De Gruyter,
   MSA vol. 79, SciRP, ResearchGate). **Abstract-level read only** (full text
   paywalled, 403); cited for its documented SUBJECT, no numeric value attributed.
3. **Limestone/dolomite wall rock BUFFERS the acid → carbonate dissolves,
   releasing Ca + CO₃ (+ adsorbed/hosted metals).** The buffering reaction
   (CaCO₃ + H₂SO₄ → Ca²⁺ + SO₄²⁻ + H₂O + CO₂) is why the fluid stays mildly
   rather than extremely acidic in a carbonate host, and why Ca/CO₃ surge as the
   front advances. Standard carbonate-neutralization geochemistry. (provenance:
   textbook)
4. **Supporting analogue — Lavrion Pb-Ag-Zn supergene profile** documents the
   in-situ oxidation of a carbonate-hosted Pb-Zn sulfide body to a secondary
   oxide/carbonate/sulfate assemblage. *Skarpelis 2009, "Geology and Origin of
   Supergene Ore at the Lavrion Pb-Ag-Zn Deposit, Attica, Greece," Resource
   Geology 59(1)* — VERIFIED (Wiley DOI 10.1111/j.1751-3928.2008.00076.x).
5. **The oxidation profile is PARAGENETICALLY ZONED / time-evolving**, not a
   single static fluid: early near-neutral carbonate-stage phases (cerussite,
   smithsonite) give way to acid-stage / more-evolved phases (the arsenates,
   and vanadates such as vanadinite in the V-richer, more-evolved part of the
   profile) as oxidation deepens and acidity is sustained. (provenance: general
   oxidation-zone zonation literature + Bowell 2014; the SPECIFIC sim corroboration
   is the dark observation below. NOT pinned to a fabricated author-year.)

## DARK OBSERVATION (the empirical oracle — tools/movement-assemblage-observe.mjs)
Built the geological oracle FROM observation (handoff lesson #1), not from prose.
Injected candidate pH movements on `supergene_oxidation` at RUNTIME (no commit),
swept trend depth, compared BASE / FLAT / TREND assemblage survival (seed 42):

- **The static baseline currently FAILS to grow vanadinite** (a declared
  `expects_species`) — a real faithfulness gap in the shipped scenario.
- A **pH 6.8 → 4.3 smoothstep TREND + OU(σ0.12, clampMin 3.5), startStep 20**
  grows **40 species, ZERO expects_species lost** — it RECOVERS vanadinite
  (a baseline MISS), keeps the full acid-sulfate suite, boosts wulfenite/mimetite/
  pharmacolite. A strict faithfulness WIN.
- **CLOBBER FINDING (startStep is load-bearing).** run_step applies movements
  AFTER apply_events (85-sim:184), and a same-field movement OVERWRITES the field
  each step. So a pH movement at startStep 0 ERASES the early acid-window EVENTS
  (steps 5-16, which dip pH to ~4.7 to nucleate jarosite+alunite+scorodite):
  start0 → 38 species but jarosite+alunite GONE, pH stuck ~6.7 through the window.
  startStep 20 (just after meteoric_flush) makes the movement COMPOSE: events own
  the early sharp acid spike, the movement owns the slow sustained front →
  40 species, acid-sulfate suite kept AND vanadinite recovered. Same-field
  movements must start after any same-field event window. (mvt avoided this — its
  movement drove Eh while events drove S/Zn/Pb, no collision.)
- **TREND ≫ FLAT** is the load-bearing result: a fluid held acidic the WHOLE run
  (FLAT) WIPES the early carbonate-stage phases (smithsonite, conichalcite,
  pharmacolite, haidingerite → GONE; 32 species). The TREND grows the
  carbonate-stage phases FIRST (while still near-neutral) THEN acidifies to mobilize
  the acid/vanadate stage — exactly the documented paragenetic zonation (finding 5).
  **This is the movements thesis demonstrated:** the SHAPE (a trend) encodes
  mineral TIMING that a flat regime cannot.
- **Correlated element pulses (CV, BASE→TREND), elements never randomized:** Mn
  **UNFROZEN** 0.04→0.33; Ca 0.13→0.67 and CO₃ 0.11→0.58 (limestone dissolving —
  finding 3); S 0.64→0.81, Fe 0.14→0.26, Zn 0.13→0.17 (metal mobilization —
  finding 1). Drive ONE master variable (pH) → the SI engines emit a
  geologically-correct, coupled metal+carbonate response.
- Depth sweep: amp −1.0 / −1.5 lose haidingerite; **amp −2.5 keeps the full
  assemblage** (haidingerite has a lower-pH stability window in-engine, recovered
  only by the deeper front). pH→4.3 setpoint is consistent with the scenario's
  OWN documented acid-window design ("the acid handler fires 4× to hold pH near 4")
  and is buffered in-run to an actual min ≈ 4.7 / mean ≈ 5.7 by the limestone wall.

## PARAMETERIZATION (the baked shape)
```
movements: [{ field:"fluid.pH", startStep:20, endStep:200, base:6.8,
              ops:[{kind:"trend", amp:-2.5, ease:true}],
              texture:{theta:0.3, sigma:0.12}, clampMin:3.5 }]
```
- **startStep 20** = after the meteoric flush, so the early acid-window events
  (5-16) are preserved (see CLOBBER FINDING). Same-field movements start after
  same-field event windows.
- **base 6.8** = the scenario's initial pH (the movement re-establishes it as the
  setpoint at step 20, then drives the front).
- **trend −2.5 → setpoint 4.3**, smoothstep (gentle start/finish). The early near-
  neutral window is what lets the carbonate-stage minerals grow before the acid
  stage — do NOT replace with a FLAT/step shape (wipes them).
- **OU σ0.12** = the validated pH texture scale from the prior dark observation
  (visible at sim resolution, bounded, mean-reverting per Holten 1997).
- **clampMin 3.5** = physical floor (a limestone-hosted gossan does not run away to
  AMD pH 2; the buffer holds it). Actual in-run pH stays ≥ 4.7.
- Layered ON TOP of the existing acid EVENTS (steps 5-16) exactly as mvt's movement
  coexists with its mixing events: the events are discrete early spikes; the
  movement is the slow sustained front. (Subsuming the events into the movement is
  a later refactor, not this opt-in.)

## NOT FOUND / modeler's choice (label as such)
- A measured Tsumeb oxidation-zone pH-vs-time curve (Bowell 2014 full text not
  read; the pH-4 target is the scenario's own design value + textbook acid range,
  not a quoted measurement).
- The exact trend timescale ("how fast") — unquantified by the science; calibrated
  to assemblage survival + sim readability (the handoff's standing open knob).

## CONTRAST CASE (verified knowledge for the backlog, NOT a pilot)
`colorado_plateau` (roll-front U-V; expects carnotite + tyuyamunite) was tested
with a reducing Eh trend and a flat-reducing Eh: **both WIPE carnotite +
tyuyamunite.** Those are OXIDIZED U(VI) uranyl-vanadates — a reducing fluid
reduces U(VI)→U(IV) and destroys them. A roll-front *primary*-ore (reduced
uraninite/coffinite) movement would need a different scenario whose expects_species
are the reduced phases. So roll-front U is NOT a reducing-Eh pilot — its target
assemblage is the oxidized expression. Documented so the next builder doesn't
re-attempt the naive reduction. (tools/movement-assemblage-observe.mjs
colorado_plateau Eh 200 -350 15)

## Sources
- Singer & Stumm 1970, Science 167:1121-1123 — rate-determining step of pyrite oxidation (verified-famous)
- Bowell, R.J. 2014, Rev. Mineral. Geochem. 79:589-627 — Tsumeb hydrogeochemistry + arsenate stability (verified exists; abstract-level read)
- Skarpelis 2009, Resource Geology 59(1), DOI 10.1111/j.1751-3928.2008.00076.x — Lavrion supergene Pb-Zn analogue (verified)
- In-repo accepted: Pinch & Wilson 1977 (Tsumeb monograph), Lombaard et al. 1986 (geology), Melcher 2003 (Ge geochemistry)
- Pyrite-oxidation acid stoichiometry + carbonate neutralization — standard AMD/supergene textbook chemistry
