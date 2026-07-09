# PROPOSAL — O5 PERTURBED REGROWTH: the film, the phantom, the masking sceptre

**2026-07-08 · workstream W-F rung O5 of `PROPOSAL-ONTOGENY-2026-07-03.md` · research-first
per the O3 template · foundations in place: O4a visibility (`5260134`) + O4b coats_front
horizons (SIM 221, `08287eb`)**

---

## 1. The ask, and why now

O5 is **the originating ask** — the boss's founding phrasing for the whole ontogeny
workstream: *"how uneven mineral inclusions can alter later layers of growth"* — and it is
pinned in the roadmap as non-optional (boss, 2026-07-08: *"definitely not optional polish,
but a task for another time"*). The prerequisites that made it "another time" are now done:

- **O4a** made enclosure visible (you cannot show a perturbation inside a host you cannot
  see into — Depth-A translucency + the opaque-grain inclusion render).
- **O4b** made enclosure GEOMETRIC and classified it: `coats_front = true` guests mark the
  host's zone horizon at `enclosed_at_step` — 14 front-coating pairs fleet-wide at seed 42,
  each one a recorded "something sat on this crystal's growth front at step N" datum.

What no mechanism yet does: make a film on a growth front **change the growth that follows**.
That is O5.

## 2. The science (verified 2026-07-08; core citations adversarially verified 2026-07-03)

**The masking sceptre / ELO.** Takahashi & Sunagawa, *Epitaxial Lateral Overgrowth (ELO):
the mechanism of formation of scepter, skeletal, cathedral and related quartz morphologies*,
Eur. J. Mineral. 16(6), 2004 — verified in the ontogeny research pass; the mechanism prose
independently confirmed this session via the companion J-Stage abstract (*Origin of Scepter
Quartz*): the trunk's surfaces are **masked by precipitation of foreign minerals (clay,
chlorite, adularia)**, growth is interrupted, and the cap then grows **from a newly supplied,
purer solution, epitaxially and laterally over the masked trunk tip**. The cap is
lattice-continuous with the stem; the film survives as an internal boundary. This is a
DIFFERENT natural route from corrosion-then-regeneration — and the sim already earns the
corrosion route (see §3.1), so O5 completes the pair.

**The pinning law.** Cabrera & Vermilyea 1958: adsorbed impurities pin advancing growth
steps; a step squeezes between pinning points only if its local radius of curvature clears
the critical radius, giving a **"dead zone"** — a supersaturation band in which a dusted
face does not grow at all — whose width grows as impurity spacing shrinks (coverage rises).
Coarse-grained for the sim: **a masked face-class stalls unless σ > σ*(φ)**, σ* monotone
increasing in film coverage φ. HONESTY CLAUSE: the classic C–V recovery MICROPHYSICS is
contested (step-bunching and phase-field studies deviate; and for CALCITE specifically —
the nearest measured mineral — DeYoreo, Wasylenki & Dove 2004 found BOTH C–V and
kink-blocking fail, needing a "cooperative" adsorption model with a non-linear dead-zone
width and a sharp step-speed drop above a threshold; §8 Q1 addendum). But the dead-zone
PHENOMENON and its SHAPE (a threshold with a super-linear approach) are robust across all
three models — so O5 renders the phenomenon, not any one microphysics, via σ* ∝ φ/(1−φ)
(one calibrated constant), tuned on the sim's own σ scale by the 4a.7 recipe (probe → law
→ calibrate-on-sim-scale → sweep → ship).

**The specimen anchors already in the drawer.** The pilot-digitization shortlist names
catalog specimens **1294 / 1295 / 1300** (alpine-type quartz): *"interrupted oscillatory
striations, twin re-entrant channel healing, **chlorite phantom capture** — W-F
surface-history targets."* The chlorite phantom IS O5's product rendered by nature: a green
film line inside a clear crystal, growth continuing over it in lattice continuity. Also
**1307/1308/1309** (amethyst-citrine scepters) for the sceptre-family bench. These are T2
acceptance anchors waiting on W-A capture.

## 3. What the tree already holds (census 2026-07-08 — grep the tree before you build)

**3.1 The corrosion sceptre is EARNED, not painted — correcting a stale line.** The tenth
hand's keystone and the roadmap memory carried "the alpine arc ships DECLARED-but-painted
Grimsel sceptres waiting for their ELO mechanism." STALE: `classifyQuartzSceptre` (js/45)
is a structural classifier — it finds a real corrosion surface (grow_quartz DISSOLVES at
σ<1, negative zones → `is_phantom`) with ≥200 µm of real growth on both sides, tags
`_sceptre {boundaryStep, stemUm, capUm, capFrac}` + habit `scepter_overgrowth` + per-zone
`morph_sceptre='cap'`; grimsel's seal→breach events enact the cycle with σ targets written
relative to live eq(T). **What is genuinely missing is the MASKING route** — a sceptre (and
a phantom) with no dissolution anywhere in the record. O5 does not invent the sim's first
sceptre; it adds the second formation pathway and the film state that drives it.

**3.2 The phantom rails are dissolution-only today.** `add_zone` (js/27) flags
`zone.is_phantom` only for NEGATIVE thickness (etch), pushes `phantom_surfaces`, and notes
the regrowth zone "[phantom boundary — growing over dissolution surface]". O5's horizon is
a **positive-growth phantom**: the crystal never lost mass; a film was overgrown. New zone
flag (`masked_horizon` + `film_mineral`), same rails, distinct origin — narrators and the
Library can then distinguish "etched and healed" from "dusted and buried," which are
different stories a collector reads on real quartz.

**3.3 The face-class granularity already exists: the two axes.** Crystals grow
`c_length_mm` (termination) and `a_width_mm` (prism) — φ does not need per-face state for
primitives; it needs **per-AXIS coverage** `{phi_term, phi_prism}`. The Wulff tenants (13,
js/46 per-face d_i) can inherit the axis read in v1 (prism = equatorial faces, termination
= polar) with true per-face φ as a later refinement.

**3.4 The horizons are already recorded.** `coats_front` guests + `enclosed_at_step` give
per-host film horizons from CRYSTALS sitting on fronts (O4b). O5 adds film from CHEMISTRY
(a dusting event needs no guest crystal), but where a front-coating guest exists, its
horizon and the film horizon are the same datum — one mechanism, two writers.

**3.5 The render seam exists.** D2 in the roadmap = "zoned colour + phantoms riding the
sector-zoning vertexColors rails (amethyst phantoms, banded fluorite); the zone recorder
already exists; this is D1 × time" — M-sized, unlocked since D1a/D1b shipped. O5's phantom
band (chlorite-green / hematite-red internal line, revealed by Depth-A translucency exactly
as O4a's grains are) is a thin first slice of D2, not a new pipeline.

**3.6 The affinity table's missing diagonal** (js/26 SUBSTRATE_NUCLEATION_DISCOUNT has no
same-species entries, flagged 2026-07-04 "for the O4/O5 era"): renewal-on-self is the
strongest epitaxy there is — the cap nucleating on its own masked stem should clear at the
lowest threshold. O5b adds the self-epitaxy entry as part of the renewal mechanism.

**3.7 The splitting ladder is a habit word today.** Saddle dolomite ships as
`habit='saddle_rhomb'` + curved-face render (js/52) — the LOW rung of Shtukenberg 2012's
σ×impurity splitting series (saddle → sheaf → spherulite), with no mechanism behind the
word. DECISION: the splitting ladder is **named but deferred out of O5** (see §6) — the
film/phantom/sceptre triad is already a full SIM bump, and splitting wants its own
instruments (a curvature/branching state, not a coverage state).

## 4. The mechanism (design)

**State (per crystal):** `_film = null | { mineral, phi_term, phi_prism, step }` — set by
events, cleared when both coverages are overgrown. Serialized with the crystal (save
format is additive-tolerant; pre-v222 saves read `_film` undefined = no film).

**Writer 1 — the dusting event (scenario schema):** an event gains an optional
`film: { mineral: 'chlorite', prism: 0.85, term: 0.15 }` directive (the deformation
directive idiom — declarative, engine-agnostic). Anisotropy is the EVENT's claim (settling
+ adsorption favor prism flanks and upward faces; the termination stays cleanest — the
Takahashi/Sunagawa observation), so scenarios state it rather than the engine deriving it
in v1. Applied to active, non-enclosed crystals of the target minerals (default: all).

**Writer 2 — the front-coating guest (O4b's data):** when a `coats_front` enclosure fires,
the host gains film at the guest's expense: a small φ increment on the axis the guest sat
on (v1: prism if the guest's anchor ring differs from the host tip's orientation, else
term — declared approximation). This makes O4b's 14 fleet-wide front-coatings O5's first
organic writers, no new scenario content required.

**The gate (the bump, in the growth loop):** for a crystal with `_film`, each axis's zone
growth is scaled by the dead-zone rule — **form settled by the two-pass reconciliation
(§8 Q1); this is rockbot's baseline-anchored version, adopted:**

```
sigma_star(phi) = sigma_star_0 * (1 + SIGMA_STAR_K * phi / (1 - phi))   // 4a.7-calibrated K
axis grows iff sigma_axis > sigma_star(phi_axis); else that axis's increment = 0
```

where `sigma_star_0` is the crystal's EXISTING clean-surface threshold (the per-mineral
`sigma_crit` the sim already carries). At φ=0 this reduces EXACTLY to `sigma_star_0` — an
unfilmed crystal behaves bit-for-bit as today, so the census-bounded blast radius falls out
of the arithmetic (no `if (!_film)` guard needed; only film-writing scenarios can move). At
φ→1 the barrier diverges — a complete film fully arrests growth (Ehrenberg 1993 chlorite
coats; the divergence is honored, NOT clamped to a modest cap — a heavy blanket is a heavy
barrier). Numerical guard only: φ is held just below 1 (a real film always leaves gaps —
Ehrenberg's micro-overgrowths-through-gaps — so φ=1 exactly = full burial = an inclusion,
handled by O4 not O5).

- Both axes stalled = the hiatus (the crystal is alive, unetched, waiting — distinct from
  O3 burial and from dissolution).
- σ rises past σ*(φ) (fresh pulse) → growth resumes THROUGH the film: the first resuming
  zone is tagged `masked_horizon` + `film_mineral`, `_film` clears, the phantom is in the
  record forever.
- **The masking sceptre falls out**: prism dusted hard (φ_prism 0.8+) + termination clean →
  c grows while a stalls (the stem thins relatively); the renewal pulse regrows both axes
  from the free tip and the cap's a_width outruns the stem's frozen width. The EXISTING
  sceptre classifier generalizes: accept a masked_horizon (positive phantom) as the
  boundary where it now requires negative zones — stem/cap measurement and render
  (`capFrac` widening, `scepter_overgrowth`) are reused as-is.

**Render rider (with the bump, the O4a idiom):** the masked_horizon renders as a thin
internal band in the film mineral's colour at the horizon's fractional height (zone-record
→ band position), visible through Depth-A translucency; opaque hosts honestly hide it. One
band per horizon; multiple dustings = multiple phantoms (the real Alpine stack).

**Module grain (settled in review, 2026-07-08 — rockbot's placement question, the
builder's answer).** The review asked whether "the coats_front writer" belongs in js/27
(zones) or js/85c (enclosure) — and the question dissolves once two nouns sharing a name
are separated. (1) `coats_front` the FIELD is enclosure bookkeeping: set at the swallow,
cleared at liberation — its lifecycle IS the enclosure lifecycle, it stays in 85c
(shipped, SIM 221). (2) The FILM WRITE that a front-coating enclosure triggers
(`host._film` increment) is event-driven and fires where its event fires: one line at the
swallow site in 85c, atomic with `enclosed_at_step` — same for the scenario `film:`
directive, which lives in the event applier. Writers live with their triggers. (3) The
READER/TAGGER — the σ*(φ) gate in the growth path, and the `masked_horizon` tag on the
first resuming zone — lives in js/27 `add_zone`, DIRECTLY beside the existing `is_phantom`
detection: add_zone already tags the dissolution phantom and notes "[phantom boundary —
growing over dissolution surface]"; the masked horizon is its positive-growth sibling, and
the zone module owns the crystal's biography. Rockbot's zone-module instinct is right for
the biography half; the enclosure pipeline keeps the trigger half; the precedent for both
already sits in the file.

## 5. Tranches (the two-commit discipline, O3a/O3b idiom)

| tranche | ships | confinement |
|---|---|---|
| **O5a — record, unread** | event `film:` directive parsed + `_film` state written + coats_front writer + `masked_horizon` tagging OFF behind `O5_MASKING_ENABLED=false`; census instrument `tools/o5-film-census.mjs` (which scenarios/events would write film; φ distributions); baseline 0/38 REQUIRED | byte-identical by construction (state recorded, never read) |
| **O5b — the gate (SIM bump)** | flag flips; σ*(φ) live in the growth loop; classifier generalized; self-epitaxy diagonal entry; movers pre-registered by the O5a census (ONLY scenarios with film writers move — everything else must hold byte-identical, the O4b certificate pattern) | census-bounded blast radius; per-scenario justification |
| **O5c — the band (render rider)** | masked_horizon internal band via the D2 vertexColors seam; preview kernel-truth + eye-check | render-only, byte-identical |

**First content (with O5b) — SWEETWATER (boss decision, 2026-07-08 review: "Sweetwater it
is").** The future-scenario slate's snowball barite becomes O5's first consumer — the
strongest possible test, because the film mechanic is LOAD-BEARING for the scenario's
signature texture (inclusion-dusted growth generations stacked inside one crystal), not a
decoration on an existing look. CONSEQUENCE, priced in: the scenario does not exist yet,
so O5b's first content commit = authoring it (vugg-add-scenario pipeline + a locality
dossier). Disambiguation for the dossier: mindat lists TWO Sweetwaters — the [Sweetwater
Barite Mining District, Monroe Co., **Tennessee**](https://www.mindat.org/loc-64654.html)
(the barite one, per the boss's slate note) and [Sweetwater Mine, Reynolds Co.,
**Missouri**](https://www.mindat.org/loc-3866.html) (Viburnum Trend Pb-Zn — the
calcite-with-sulfide-inclusions locality the enclosure mechanic's "Sweetwater-style"
nickname comes from); the dossier pins which snowball the boss means before the broth is
authored. BONUS of this choice: grimsel AND tormiq both stay undusted — the corrosion
route keeps two clean references, and the route-distinction bench claim (the sim grows
both sceptre kinds by different mechanisms) gets its cleanest possible form.

## 6. Named, not built (deferred out of O5)

- **The splitting ladder** (Shtukenberg 2012 σ×impurity: saddle→sheaf→spherulite) — its own
  rung with its own state (branching/curvature, not coverage); saddle dolomite stays the
  habit-word rung until then.
- **Chemistry-derived film deposition** (film from broth state without an event — needs
  particulate/colloid state the fluid model doesn't carry).
- **Per-face φ on Wulff tenants** (v1 inherits the axis read).
- **O5.0 face striations** (`e68e7e3` spec) — sibling rung, unchanged by this design;
  shares the zone-record-as-biography principle.

## 7. Acceptance (pre-registered)

1. O5a: baseline 0/38 with the flag off; census names every would-be writer.
2. O5b: movers == the census's writer list exactly; the new Sweetwater scenario grows
   masked_horizon generations (barite snowball texture); `classifyQuartzSceptre` (and its
   family) find the masking route where a dusted-then-renewed crystal exists, distinct from
   grimsel's corrosion sceptre (which stays untouched — the sim carries BOTH routes by
   different mechanisms, the bench claim); no dissolution anywhere in a masked phantom's
   record (the invariant test). If a quartz cleft is dusted later, the sceptre classifier
   is the same-mechanism witness.
3. O5c: band visible through a translucent host in preview kernel-truth; opaque host hides.
4. Bench (when W-A capture lands): 1294/1295/1300 chlorite phantoms as T2 anchors; the
   sceptre pair 1307–1309.

## 8. Open questions for boss / rockbot review — STATUS after first review round (2026-07-08)

1. **RESOLVED — σ*(φ) curve shape (two independent passes reconciled 2026-07-08;
   `RESEARCH-SIGMA-STAR-PHI-2026-07-08.md` = rockbot's, this doc's addendum = the
   builder's). ADOPTED FORM (rockbot's, baseline-anchored):**
   `σ*(φ) = σ*₀·(1 + k·φ/(1−φ))`, σ*₀ = the mineral's existing clean-surface threshold,
   k the one calibrated constant. See §4 for the reduced-to-today-at-φ=0 property.

   **▸ THE RECONCILIATION (boss: "pay special attention to where they disagree").**
   *Convergence (the big one):* both passes independently landed on the **hyperbolic
   φ/(1−φ) form, diverging at φ=1, one calibrated constant**, and both concluded **no
   published closed-form σ*(φ) exists** (the molecular-adsorption literature is θ~10⁻⁶,
   not macroscopic film φ). Independent convergence on the shape = the shape is settled.
   *Cross-check on citations (the fabrication guard, [[feedback_cross_check_research_disagreements]]):*
   the builder web-verified rockbot's two load-bearing refs — **Ehrenberg 1993** (AAPG
   Bull., Norwegian-Shelf grain-coating chlorite inhibits quartz cementation) is REAL and
   exact; **Ranganathan & Weeks 2013** is REAL and is *the same paper* the builder's pass
   cited as "PRL 110 055503" (Ranganathan IIT-Kanpur + Weeks Maryland) — the two passes
   cross-confirm rather than contradict. No fabricated citations found.

   **Two real DISAGREEMENTS, both resolved in rockbot's favor:**
   - **The baseline (rockbot right; the builder was sloppy).** The builder's draft form
     `K·φ/(1−φ)` gives σ*(0)=0 — i.e. a clean crystal with NO threshold, which is wrong
     (every face has its clean-surface σ_crit) and would have perturbed unfilmed crystals.
     Rockbot's `σ*₀·(1 + k·φ/(1−φ))` correctly reduces to the clean threshold at φ=0. This
     is not just more correct — it makes O5 byte-identical for unfilmed crystals *for free*
     (the census-bounded blast radius becomes a property of the equation, not a guard).
     **Adopted wholesale.**
   - **Divergence vs clamp (rockbot right).** The builder's `min(φ,0.95)` capped the barrier
     at ~19·K; rockbot honors the divergence (φ→1 = infinite = complete arrest). Ehrenberg
     1993 is the decider: continuous chlorite coats do fully quench overgrowth coalescence —
     BUT the same paper notes micro-overgrowths still nucleate through gaps, so real films
     sit at φ<1 (always gaps) and the divergence is the correct φ→1 *limit*, not a value any
     real film reaches. **Adopted:** keep the divergence, drop the 0.95 cap, guard φ only
     numerically just below 1.

   **Complementary evidence (merge, not conflict):** rockbot brought the DIAGENETIC /
   reservoir macroscopic-film literature (Ehrenberg 1993, Zhang 2020 — literally
   "chlorite coat stops quartz overgrowth," the O5 mechanism at field scale, the regime
   closest to our φ); the builder brought the AFM step-kinetics literature (DeYoreo 2004
   calcite — CV *and* kink-blocking both fail, the approach is sharp/super-linear not
   linear; barite AFM for the Sweetwater tie-in). rockbot's anchor justifies the
   *divergence and the macroscopic-film regime*; the builder's justifies the *super-linear
   shape and the rejection of the linear alternative*. Together the recommendation is
   over-determined. **k still calibrated on the sim's own σ scale by the 4a.7 recipe;
   the phantom specimens (1294/1295/1300) are the T2 acceptance anchor.**

   *(Original builder addendum retained below for the record.)*

   **▸ BUILDER'S PARALLEL RESEARCH PASS (2026-07-08) — the phenomenology settles the shape,
   even though the microphysics stays contested.** Three models, read for the FORM they
   give (not the microphysics they argue about):
   - **Cabrera–Vermilyea (Gibbs–Thomson step-curvature):** dead-zone width ∝ 1/(impurity
     separation L); near roughening ∝ 1/L². Since 2-D density n ∝ 1/L², that is σ_d ∝ √n
     at low T → σ_d ∝ n hotter. σ* rises with coverage — SUPER-linear at the warm end.
   - **Kubota–Mullin (kink blocking):** step speed drops LINEARLY in coverage,
     v/v₀ = 1 − α·θ_eq, dead when α·θ ≥ 1; θ_eq from a Langmuir isotherm, so σ_d(c) is
     non-linear via θ(c). This is the "gentle ramp then cliff at α·θ=1" alternative.
   - **DeYoreo, Wasylenki, Dove, Wilson & Han 2004 (LLNL/Virginia Tech, ACCGE-19,
     UCRL-CONF-204243) — CALCITE, the geologically closest measured system, in-situ AFM
     with Sr²⁺ + Asp polypeptides:** BOTH Cabrera–Vermilyea AND kink-blocking **fail** to
     fit measured calcite step kinetics; the data show a **non-linear dead-zone-width vs
     impurity content AND a SHARP DROP in step speed above a threshold coverage** (their
     "cooperative adsorption at adjacent kinks"). No closed quantitative form as of 2004.

   **Reconciliation → the hyperbolic default is now EMPIRICALLY BACKED, not a guess.** All
   three converge on the shape that matters for a coarse-grained sim: **a threshold, with a
   steepening (super-linear / sharp) approach to it — NOT a gentle linear fade.** DeYoreo's
   calcite result specifically kills the plain-linear (Kubota–Mullin) ramp for the mineral
   family we care about. So σ* ∝ φ/(1−φ) (flat-ish at low φ, diverging as φ→1 = the sharp
   cutoff) is the right coarse render; if anything the literature licenses going *sharper*
   (a sigmoid threshold), not gentler. TWO SIM-SPECIFIC SIMPLIFICATIONS we get for free:
   (a) our φ is set by an EVENT (an instantaneous dusting), so we sidestep the
   adsorption-KINETICS complication (non-equilibrium θ(t), exposure time) that dominates
   the lab literature — φ is a state, not a rate-limited accumulation; (b) barite-specific
   AFM ([Jiménez / Ruiz-Agudo, phosphonate inhibition of barite (001)](https://www.sciencedirect.com/science/article/abs/pii/S0039602804000524);
   [in-situ AFM SI 1.1–4.1](https://www.mdpi.com/2075-163X/6/4/117)) confirms inhibition is
   a **kink-site** effect with a supersaturation-dependent recovery — same threshold shape,
   and directly relevant since Sweetwater is barite. **Recommendation UNCHANGED and now
   grounded:** hyperbolic σ*(φ), one calibrated constant (SIGMA_STAR_K), the constant
   tuned on the sim's own σ scale by the 4a.7 recipe; if rockbot's pass surfaces a
   published closed-form φ→σ* (unlikely — DeYoreo says none existed in 2004), adopt it, else
   this. If the two passes DISAGREE on the shape, web-verify the disagreement before O5a.
2. **RESOLVED — module grain** (see §4 "Module grain"): writers live with their triggers
   (the `film:` directive in the event applier; the coats_front increment at the 85c
   swallow site), the σ*(φ) gate + `masked_horizon` tagging live in js/27 add_zone beside
   the existing is_phantom detection. Timing (the original question): O5a records, O5b
   reads — unchanged.
3. **RESOLVED — Sweetwater first (boss).** See §5 "First content"; the scenario-authoring
   consequence is priced in, and both alpine clefts stay clean corrosion references.

**Sources (this session's verification):**
- [Takahashi & Sunagawa 2004, EJM 16(6) — ELO mechanism](https://www.schweizerbart.de//papers/ejm/detail/16/56152/Epitaxial_Lateral_Overgrowth_ELO_The_mechanism_of_formation_of_scepter_skeletal_cathedral_and_related_quartz_morphologies)
- [Origin of Scepter Quartz (J-Stage) — masked trunk + purer renewal prose](https://www.jstage.jst.go.jp/article/gsjapan/28/1-4/28_KJ00004949074/_article)
- [The Quartz Page — growth forms; chlorite/adularia coatings on crystal ends](http://www.quartzpage.de/gro_text.html)
- [Does impurity-induced step-bunching invalidate key assumptions of the Cabrera−Vermilyea model? (Cryst. Growth Des.)](https://pubs.acs.org/doi/10.1021/cg7010474)
- [Crystal growth cessation revisited: the physical basis of step pinning](https://www.academia.edu/22050346/Crystal_Growth_Cessation_Revisited_The_Physical_Basis_of_Step_Pinning)
- **[DeYoreo, Wasylenki, Dove, Wilson & Han 2004 — Kinetic model of impurity poisoning during growth of calcite (UCRL-CONF-204243, ACCGE-19)](https://www.osti.gov/servlets/purl/15014168)** — the geologically-nearest measured system: CV + kink-blocking both fail for calcite; non-linear dead-zone width + sharp step-speed drop above threshold coverage (read in full, the σ*(φ) shape anchor)
- [Kinetic model of impurity poisoning (Kubota–Mullin lineage)](https://www.semanticscholar.org/paper/A-kinetic-model-for-crystal-growth-from-aqueous-in-Kubota-Mullin/a77a35eaaab71fec5dfb0bab1a5aa429c0873104) — linear v/v₀ = 1 − αθ, the "gentle ramp then cliff" alternative DeYoreo's calcite data reject
- [Theory of Impurity-Induced Step Pinning and Recovery (PRL 110, 055503)](https://link.aps.org/accepted/10.1103/PhysRevLett.110.055503); [Sangwal — combined supersaturation × impurity](https://www.sciencedirect.com/science/article/abs/pii/S0022024800003390)
- [Jiménez/Ruiz-Agudo — AFM + MD: phosphonate inhibition of barite (kink-site)](https://www.sciencedirect.com/science/article/abs/pii/S0039602804000524); [in-situ AFM of barite (001), SI 1.1–4.1](https://www.mdpi.com/2075-163X/6/4/117) — Sweetwater is barite; inhibition is a kink effect with σ-dependent recovery

— the builder, twelfth hand, opening the door the eleventh cut the key for · 2026-07-08
