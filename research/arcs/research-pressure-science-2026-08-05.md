# Research packet: pressure as a geological control

Date: 2026-08-05
Assignment: [proposals/RESEARCH-BRIEF-PRESSURE-SCIENCE.md](../../proposals/RESEARCH-BRIEF-PRESSURE-SCIENCE.md)
Method: four independent web-verified research passes (thermodynamic framework · mineral systems · volatiles/boiling · stress-vs-pressure) + a synthesis pass that spot-checked the load-bearing constants against primaries (§12 ledger). No game code was modified.

**Evidence legend** (used throughout): **[MEASURED]** experimental/standard-reference data re-verified against a primary or standards source · **[DERIVED]** computed in-session from [MEASURED] inputs, arithmetic stated · **[EMPIRICAL]** fitted/behavioral literature result, direction+magnitude verified · **[INFERENCE]** implementation/design reasoning · **⚑FLAG** could not be digit-verified — provisional, do not hard-code without a check.

Unit convention: **1 kbar = 100 MPa = 1000 bar**. Game box: **0.01–4.4 kbar, ~10–800 °C**, water-dominated fluid in a rock cavity.

---

## 0. Executive verdict

**Pressure in the current model is displayed like a universal environmental variable but is almost entirely cosmetic — and the honest fix is NOT to make it a universal multiplier.** The science supports exactly five distinct, mineral/process-specific couplings inside 0.01–4.4 kbar, and refuses everything else:

1. **Equilibrium shift via reaction volume** — `log K(T,P) = log K(T,P_ref) + [−ΔV°r·ΔP + ½Δκ°r·ΔP²]/(2.303·R·T)`. Magnitude: **≈ +1 log unit of Ksp per kbar for a calcite-like dissolution at 25 °C** (+0.64 at 200 °C) — a large, real, per-reaction effect [DERIVED]. It can be applied honestly **only** to the minerals that already carry real Ksp(T) (the sulfate and carbonate SI engines), on the infinite-dilution scale, with the Δκ term (omitting it is a 38 % error at 4.4 kbar).
2. **Silica via water density, not ΔV°r** — quartz solubility follows `log m = A(T) + B(T)·log ρ_H2O` (Manning 1994, coefficients digit-verified). Decompression 4.4 → 0.5 kbar cuts quartz solubility **×1.65 at 300 °C but ×~5 at 450 °C** — the near-critical asymmetry that *is* the alpine-cleft growth engine.
3. **Polymorph/phase boundaries** — Al2SiO5 triple point (recommend Pattison 1992: 550 °C/4.5 kbar — the game ceiling sits 0.1 kbar under it, all three polymorphs selectable), calcite/aragonite (Hacker's published negative-linear boundary plus its ±1 kbar uncertainty margin gives a secure aragonite field at 4.4 kbar to about 381 °C; low-P aragonite is Mg-kinetic, never P-gated), α/β quartz habit line (T = 573 + 25.5·P kbar), gypsum⇌anhydrite (T_tr ≈ 58 + ~14.7·P kbar, on top of the existing a_H2O/salinity lever).
4. **Boiling / phase separation** — the single biggest *gameplay* payoff. A fluid boils when `P < P_bubble(T, salinity, dissolved gas)`; the consequence bundle (CO2/H2S loss → pH rise 1–2 units → bladed calcite + adularia + gold drop; steam loss concentrates solutes; adiabatic cooling ~3–5 °C per % steam) is fully literature-anchored. **It requires small new state: conserved volatile pools.** Above the critical curve (e.g. Grimsel at 400–450 °C, >3 kbar) decompression must produce *no boiling* — it acts through solubility instead.
5. **What pressure does NOT do: twinning.** Twinning is driven by **differential stress** against a per-mineral CRSS (calcite ≈ 10 MPa, dolomite ≈ 100 MPa, quartz never) and is **independent of confining pressure across the game's entire band** [MEASURED, Rybacki 2013: 50–400 MPa confining, 8-fold variation, no effect]. The current Tap/Shock `P += 0.1/0.5 kbar → twin chance` is physically wrong in sign and in kind: an isotropic pressure change produces zero twinning, and a fault-valve rupture *drops* fluid pressure rather than raising it. The event system needs a stress/pressure split (§7).

**Identity correction that costs nothing:** the one scalar the game carries is honest **as fluid pressure in the cavity** — for a crystal growing free into fluid, the stress on the growth surface *is* isotropic P_f. Relabel it "fluid pressure"; add an optional scenario-level confining pressure only where fracture criteria or wall-rock stability need it. No numerical change, no baseline movement.

**The existing apophyllite gate (`P > 0.5 kbar → 0`) is not literature-supported.** No experimental P–T stability determination for apophyllite exists; it occurs in skarns and alpine fissures that formed well above 0.5 kbar. Regrade: hard T gate (≲ 300–350 °C, already present as T_max 250) + soft nucleation down-weight above ~1.5–2 kbar [INFERENCE, flagged].

**What cannot be modeled honestly with the current fluid schema** (stated per the acceptance criteria): pressure-dependent ion-pair speciation (the ppm vector has no pairs to break — the largest structural honesty gap); boiling without conserved volatile pools; internally consistent pressure-dependent pH (pH is an input); anything in the low-density corner T > 350 °C ∧ P < ~0.5 kbar (outside HKF's envelope — clamp and label, never extrapolate).

---

## 1. Current state (code census, grounded)

| Fact | Where |
|---|---|
| `pressure` is a kbar scalar on VugConditions, default 1.5 | js/25-chemistry-conditions.ts:17 |
| Only direct supersat gate: apophyllite `if (this.pressure > 0.5) return 0` | js/39-supersat-silicate.ts:548 |
| Tap: `P += 0.1`, twin prob 0.04 · Shock: `P += 0.5, T += 15`, twin prob 0.15 | js/97-ui-fortress.ts:659–670 (`_applyShockTwinning`) |
| Scenario event `event_tectonic_shock`: `P += 0.5, T += 15` | js/70-events.ts:29–33 |
| Creative setup slider = value/10 → 0.1–3.0 kbar; presets boot at 1.0 kbar | js/97-ui-fortress.ts:173, js/94-ui-menu.ts:152 |
| Zen idle clamps drift to [0.1, 5.0] kbar | js/98a-ui-zen.ts:178 |
| Fleet scenarios span 0.01 (cave/karst) – 4.4 kbar (Grimsel) | data/scenarios.json5 |
| Activity model: Davies, damped ×0.25, valid I ≲ 0.5 | js/20a-chemistry-activity.ts |
| Carbonate speciation K1/K2 (Plummer & Busenberg 1982/Millero 1995) with comment "pressure correction (<1 kbar) is small; ignore for now" | js/20b-chemistry-carbonate-system.ts:37–39 |
| Carbonate Ksp SI engine: raw physics, flag-gated per-mineral promotion pattern | js/32b-supersat-carbonate-Ksp.ts |
| Ksp(T) convention: van't Hoff `logKsp(T) = logKsp_25 − (ΔH/2.303R)(1/T − 1/298.15)`; meta notes "for pressure dependence, full Maier-Kelley extrapolation needed (Phase 2)" | data/thermo-carbonates.json, data/thermo-sulfates.json |
| Andalusite ships with T-only routing (T 400–700 °C), **no P gate; kyanite/sillimanite do not exist** (BACKLOG "Class 2 pressure-gated polymorphs") | js/39-supersat-silicate.ts:159–167, proposals/BACKLOG.md |
| No conserved volatile pools; `equilibriumPCO2(fluid)` helper exists; PROPOSAL-VOLATILE-GASES unlanded | js/20b comments |

The integration point for Stage A is already built: the pressure term slots into the existing van't Hoff Ksp(T) as **one additive per-reaction term**, exactly where `thermo-*.json`'s own meta note anticipated it.

**⚠ Pre-implementation audit (blocking):** establish whether the ppm convention is **mg/kg (mass fraction — safe)** or **mg/L (volume-based)**. Ω needs molality; water is ~15–20 % denser at 4.4 kbar than at 1 bar, so a mg/L convention would silently shift every molality by up to ~20 % under pressure — a bug the size of a real physical effect [INFERENCE, thermo pass §6.3]. Resolve and document before any ΔV°r lands.

---

## 2. Pressure-dependent mechanisms by mineral/process

Mechanism codes: **(a)** equilibrium/saturation · **(b)** aqueous speciation/gas solubility · **(c)** phase/polymorph stability · **(d)** nucleation kinetics · **(e)** growth habit · **(f)** geological process changing fluid composition.

| Mineral/process | Mechanism | Direction & magnitude in-box | Recommended treatment |
|---|---|---|---|
| Quartz/chalcedony | (a) via ρ(T,P) | solubility ×1.65 (300 °C) to ×~5 (450 °C) over 0.5→4.4 kbar | Manning 1994 density model, Ksp(T, ρ_H2O(T,P)) |
| α/β quartz | (c)+(e) | boundary T = 573 + 25.5·P(kbar); β reachable in-box at T > 573–685 °C | habit switch line |
| Opal/am. silica | (a), tiny | ΔV°r ≈ −12 cm³/mol → ≤10–25 % over 0–0.5 kbar, dwarfed by T | **no P gate** |
| Coesite, cristobalite/tridymite | (c) | out of range (>20 kbar) / metastable quench phases | none |
| Calcite/dolomite/siderite | (a) | Ksp ≈ ×2 per kbar (damped); ΔV°r ≈ −58 (per CO3 unit) | ΔV°r+Δκ on the existing SI engine |
| Aragonite (deep) | (c) | stable where cavity pressure exceeds the Hacker boundary by the stated uncertainty margin | Hacker et al. 2005 published negative-linear fit (±0.1 GPa, §12) |
| Aragonite (shallow) | (d) | Mg poisoning of calcite — **not pressure** | keep Mg-gated; never P-gate at low P |
| CO2(aq)/DIC | (b) | P raises CO2 solubility (Duan & Sun); K1/K2 shift ≈ +1.7 log units at 4.4 kbar | Millero ΔV,Δκ polys on K1/K2 (Stage A option), volatile pool (Stage B) |
| Barite/celestine/anglesite/anhydrite/gypsum dissolution | (a) | ΔV°r ≈ −50 ± 5 family; solubility ×1.5–2 per kbar (measured to 1.4 kbar for barite) | family ΔV°r+Δκ on the sulfate SI engine |
| Gypsum⇌anhydrite | (c)+(f), (d) | T_tr(1 bar, a_H2O=1) = 58 ± 2 °C (Hardie); slope ≈ +14.7 °C/kbar; salinity ladder lowers it; anhydrite never nucleates < ~80–100 °C regardless | boundary T_tr ≈ 58 + 14.7·P, composed with the existing a_H2O lever + kinetic floor (v228 gate already right) |
| Fluorite | (a) | ΔV°r ≈ −45 → modest positive P lever; T-structure dominates | optional shared correction |
| Halite | (a), negligible | ≤ 2–3 % per kbar | **explicitly none** |
| Al2SiO5 | (c) | triple point at the game ceiling; three linear boundaries | boundary routing (Stage A observable; engines per BACKLOG Class 2) |
| Apophyllite | (f), weak (c/d) | 0.5 kbar hard gate unsupported; occurs in skarn/alpine settings >0.5 kbar | T gate + soft down-weight above ~1.5–2 kbar |
| Zeolite suite | (f) mostly | zeolite facies extends to ~2–3 kbar | no new hard P gates |
| Sulfides (sphalerite, galena…) + Au | (b)+(f) via boiling | H2S loss on boiling destroys Au(HS)2⁻ → gold drops at the boiling horizon; base metals ride chloride complexes → respond to pH rise/cooling, not H2S loss | **no Ksp(P)**; couple only through the boiling event |
| Calcite/dolomite twinning | none of a–f: **σ_diff** | CRSS 10 / 100 MPa; confining P irrelevant | key to stress_pulse events (§7) |
| Fracture/permeability | P_f vs σ3 + T0 | hydrofracture when P_f > σ3 + T0; veining caps σ_diff ≤ 4·T0 ≈ 4–40 MPa | valve_rupture event (P_f drop) |
| Pressure solution | σ at grain contacts | matrix process, geologic rates | flavour text only |
| Pegmatite systems | (f) melt-side | H2O-in-melt solubility rises with P | out of aqueous scope |

---

## 3. Thermodynamic framework (sourced equations)

### 3.1 Core relation [DERIVED — exact]

```
(∂ln K/∂P)_T = −ΔV°r/(RT)          R = 83.145 cm³·bar·mol⁻¹·K⁻¹
log K(T,P) = log K(T,P_ref) + [ −ΔV°r·ΔP + ½·Δκ°r·ΔP² ] / (2.303·R·T)
ΔP in bar; ΔV°r in cm³/mol (Σν·V°products − Σν·V°reactants, aqueous V° at infinite dilution);
Δκ°r ≡ −(∂ΔV°r/∂P)_T in cm³·mol⁻¹·bar⁻¹
```

Sign convention confirmed verbatim against the CO2SYS reference implementation (`lnKfac = (-deltaV + 0.5*Kappa*Pbar)*Pbar/RT`).

Worked magnitudes (ΔV°r = −58 cm³/mol held constant) [DERIVED]:

| T | Δlog K per kbar | constant-ΔV error at this depth of extrapolation |
|---|---|---|
| 25 °C | +1.016 | 0.9 % @0.1 kbar · 8.6 % @1 kbar · 22 % @2.5 kbar · **38 % @4.4 kbar** |
| 100 °C | +0.812 | (error budget computed with |Δκ| = 10×10⁻³ cm³·mol⁻¹·bar⁻¹, Millero 1982's typical value) |
| 200 °C | +0.640 | |
| 300 °C | +0.529 | |

**Rule: ship both coefficients (ΔV°r and Δκ°r) per reaction. Constant ΔV°r alone is defensible only below ~1 kbar.** Note ΔV°r itself grows more negative with T (electrostriction tracks water compressibility), so pressure sensitivity does not decay as 1/T at high T [INFERENCE from HKF/Born].

### 3.2 Where the framework itself breaks

- **HKF envelope** (source of all tabulated aqueous V°): ρ_w > 0.35 g/cm³, 0–1000 °C, **1–5000 bar** — covers the whole game box in P, but with **high uncertainty at T > ~350 °C ∧ P < ~500 bar** (ρ_w < 0.8). That hot/shallow corner is the game's own danger zone: **clamp the correction there and label low-confidence.**
- **Near-critical singularity** (374 °C, 221 bar): V° of ions diverges (Born term); no correction is valid in a neighborhood of the critical point.
- **Ion pairing**: association reactions (CaSO4°, CaHCO3⁺, chloride complexes) have large *positive* ΔV°r — pressure breaks pairs and raises free-ion activity. A ppm vector with Davies γ has no pairs; this bias is structural and must be documented, not patched.

### 3.3 Standard-state discipline (the convention trap)

The Millero/CO2SYS lineage coefficients are **seawater-scale apparent constants** (ion pairing folded in): ΔV(calcite) there is −35.5 cm³/mol at 25 °C vs the **infinite-dilution −58 to −61** the game's Davies model requires. **Never mix the scales.** The one legitimate borrow: the *functional form* and, if pragmatism demands, the K1/K2 polynomials clearly labeled as seawater-scale approximants (they are the best available T-polynomials and the scale error on K1/K2 is smaller than on Ksp) ⚑FLAG if borrowed.

CO2SYS-verbatim polynomials (t in °C; ΔV cm³/mol; Δκ cm³·mol⁻¹·bar⁻¹; **seawater scale, 0–40 °C, ≤1 kbar**):

| Constant | ΔV(t) | Δκ(t) |
|---|---|---|
| K1 | −25.50 + 0.1271·t | (−3.08 + 0.0877·t)/1000 |
| K2 | −15.82 − 0.0219·t | (1.13 − 0.1475·t)/1000 |
| Ksp calcite | −48.76 + 0.5304·t | (−11.76 + 0.3692·t)/1000 |
| Ksp aragonite | ΔV(calcite) + 2.8 | = calcite |

### 3.4 Data sources ranked for this game

| Source | Range | Verdict |
|---|---|---|
| **SUPCRT92** (Johnson, Oelkers & Helgeson 1992) / **SUPCRTBL** (Zimmer et al. 2016; free web UI models.earth.indiana.edu/supcrtbl.php) | 1–5000 bar, 0–1000 °C | **The generator.** Covers 4.4 kbar. Produces log K(T,P) and ΔV°r per reaction — run once offline over the game grid (§8 Stage C) |
| **IAPWS-95** (Wagner & Pruß 2002) | 273–1273 K, 0–10 kbar | ρ_H2O(T,P) — covers the box; feed Manning's model |
| **IAPWS R8-97 / Fernández et al. 1997** | 238–873 K, ≤10 kbar | ε(T,ρ) + **published Debye–Hückel coefficients** (A_γ(T,P) is an output, don't re-derive) |
| **PHREEQC ≥3** (Appelo, Parkhurst & Post 2014; Appelo 2015) | **0–200 °C, 1–1000 atm** | mineable (solid −Vm values verbatim: calcite 36.9, barite 52.9, gypsum 73.9, anhydrite 46.1, quartz 22.67 cm³/mol) but its P machinery covers only ~23 % of the game's range. SupPHREEQC (Zhang, Lu & Zhu 2020) lifts the ceiling via SUPCRTBL |
| **Millero 1982 lineage** | 0–50 °C, ≤1 kbar | form + Δκ magnitudes; seawater-scale trap above |
| **DEW** (Sverjensky et al. 2014) | 100–1200 °C, **P ≥ 1 kbar**, to 60 kbar | **wrong tool** — invalid across most of the game box; cite only as HKF's ceiling marker |

### 3.5 Verdict on the ppm/Davies model (Q1 of the brief, answered)

The existing model **can** honestly carry: per-reaction ΔV°r+Δκ on SI-engine minerals (infinite-dilution scale); the Manning density model for silica; polymorph boundary routing; K1/K2 pressure shifts. It **cannot** honestly carry: pressure-dependent speciation (no solver), a pressure-consistent pH (input variable), any universal multiplier, or the near-critical corner. The Davies A(T,P) dependence is real (≈ −8–10 %/kbar → ≲0.08 log units on Ω) but is an order of magnitude below the ΔV°r effect — **defer with documentation** (implementing it *instead of* ΔV°r would be pressure theatre). Note in passing: A(T) roughly doubles from 25→250 °C; if the Davies A is currently a 25 °C constant, that T-error already exceeds anything pressure does to activities ⚑worth its own audit.

---

## 4. Mineral systems (detail)

### 4.1 Silica

**Manning (1994)** GCA 58:4831–4839, doi:10.1016/0016-7037(94)90214-3 [MEASURED+EMPIRICAL; coefficients digit-verified against two independent reproductions]:

```
log m(SiO2,aq) = 4.2620 − 5764.2/T + 1.7513e6/T² − 2.2869e8/T³
               + (2.8454 − 1006.9/T + 3.5689e5/T²)·log ρ_H2O
T in K, ρ in g/cm³, m in mol/kg. Valid 25–900 °C, 1 bar–20 kbar.
```

Cross-check correlation — **Fournier & Potter (1982)** GCA 46:1969–1973, doi:10.1016/0016-7037(82)90135-1 (V = specific volume cm³/g; T K; 25–900 °C, ≤10 kbar; σ = 0.089 over 518 measurements):

```
log m = A + B·logV + C·(logV)²
A = −4.66206 + 0.0034063·T + 2179.7/T − 1.1292e6/T² + 1.3543e8/T³
B = −0.0014180·T − 806.97/T
C = 3.9465e-4·T
```

The two independent correlations agree on the load-bearing numbers [DERIVED, NIST densities]:

| Condition | ρ_H2O | Manning | F&P |
|---|---|---|---|
| 300 °C, 0.5 kbar | 0.77648 | 727 ppm | 818 ppm |
| 300 °C, 4.4 kbar | 0.97761 | 1199 ppm | 1355 ppm |
| 450 °C, 0.5 kbar | 0.40204 | 931 ppm | 978 ppm |
| 450 °C, 4.4 kbar | 0.87877 | 4945 ppm | 4717 ppm |

Both give 6–7 ppm at 25 °C/1 bar (matches measured quartz solubility — the sanity anchor). **The 450 °C asymmetry (×~5) is the alpine-cleft engine; the 300 °C case (×1.65) shows P is only a modest lever once the fluid is liquid-like.** Generalization to other minerals: Dolejš & Manning 2010, Geofluids 10:20–40 (quartz, calcite, corundum, fluorapatite, fluorite to 1100 °C/20 kbar).

Low-T anchors at P_sat — Gunnarsson & Arnórsson (2000) GCA 64:2295–2307 [MEASURED]:
`log K(am.SiO2) = −8.476 − 485.24/T − 2.268e-6·T² + 3.068·logT`; `log K(quartz) = −34.188 + 197.47/T − 5.851e-6·T² + 12.245·logT` (T in K, 0–350 °C).

Opal: ΔV°r ≈ −12 cm³/mol → no P gate. α/β quartz: **T_tr = 573 + 25.5·P(kbar)** (Cohen & Klement 1967; the brief's "0.026 kbar/°C" had inverted units — it is ~25.5 °C/kbar). β-habit (bipyramids → α-paramorphs) is a legitimate render/habit switch at T > 573–685 °C in-box. Coesite ≥ 24 kbar — confirmed irrelevant.

### 4.2 Carbonates

- Dissociation ΔV°r(calcite) ≈ **−58 ± 3 cm³/mol** at 25 °C infinite dilution [DERIVED from conventional V°: (−17.85) + (−4.3) − 36.93; consistent with Millero 1982]. Family: siderite ≈ −56; dolomite ≈ −112 per formula unit (2 CO3) [DERIVED ±5]. Ksp ×~2 per kbar at low T after Δκ damping.
- **Calcite–aragonite boundary**: use the equation printed by Hacker et al. 2005 (JGR 110:B03205), including its **negative** linear coefficient. A previous synthesis pass changed that sign after informally comparing the polynomial to a shorthand list of older reversal points. That was not a defensible transcription: the primary paper explicitly prints the negative term in both §15 and its conclusions and assigns the fit an uncertainty of ±0.1 GPa. The authored equation, not a reconstructed alternate, is the implementation authority:

```
P(GPa) = 0.299 − 7.4e-4·(T−298) + 2.4e-6·(T−298)²      (T in K; ±0.1 GPa)
```

  Implementation consequence: the deep equilibrium field is secure only when `P_fluid > P_boundary + 1.0 kbar`; the 1 kbar margin is Hacker's stated fit uncertainty. Everywhere outside that secure field, aragonite may still be **kinetic** (Mg²⁺/SO4 poisoning of calcite — Berner 1975) — the sim's existing Mg axis, not pressure. Do not pressure-gate low-pressure kinetic aragonite.
- CO2 solubility: Duan & Sun 2003 (Chem. Geol. 193:257–271), valid **273–533 K, 0–2000 bar, 0–4.3 m NaCl**, ~7 %. Pressure holds CO2 in solution (more H2CO3, lower pH, more calcite dissolved); decompression degasses → calcite precipitates. Mechanism (b) feeding (a); the degassing event is (f) — keep them separate in code.

### 4.3 Sulfates

- **Gypsum⇌anhydrite**: equilibrium at 1 bar, a_H2O = 1: **58 ± 2 °C** (Hardie 1967 reversal; MacDonald 1953 calculated 42 °C; Innorta 1980 ~49.5 °C — adopt the reversal). Hardie's a_H2O ladder: 0.960→55 °C, 0.845→39 °C, 0.770→23 °C. Pressure slope for the fluid-pressured (vug) case: Clapeyron ≈ **+14 °C/kbar** [DERIVED: ΔV ≈ +7.4 cm³/mol, ΔS ≈ +52 J/mol·K]; independent DAC fit (Wang et al. 2012, calibrated 250–320 °C, extrapolation flagged ⚑) gives +14.7 °C/kbar. The arithmetic is `58 + 14.7·4.4 = 122.68 °C` (not 170 °C). The P_lith > P_f case (overburden on solids, hydrostatic pore fluid) *lowers* the transition — irrelevant inside a fluid-filled vug. **Composition rule: `T_tr(°C) ≈ 58 + 14.7·P(kbar)`, then lower via the existing a_H2O/salinity driver, with the v228 kinetic floor (no direct anhydrite nucleation < ~100 °C; Ossorio 2014) left untouched.** This slots directly into the fix-ladder's planned Hardie-1967 salinity-ceiling commit — pressure is a second, smaller term on the same boundary.
- **Barite**: Blount 1977 measured 22–280 °C, **1–1400 bar** (not 4 kbar — the brief's recollection corrected); isothermal solubility rises with P; model to 200 °C/1 kbar: Monnin 1999. ΔV°r family [DERIVED ±5]: barite −50.6, celestine −50.5, anglesite −49.6, anhydrite −49.8, gypsum −42.4 cm³/mol → **one shared sulfate-family treatment ≈ −50 justifiable at Stage A, per-reaction values at Stage C.**

### 4.4 Fluorite & halides

Fluorite: Richardson & Holland 1979 (solubility rises to a ~100 °C maximum in dilute solutions — T-structure dominates); ΔV°r ≈ −45 [DERIVED] → optional modest correction. **Halite: ≤ 2–3 % per kbar (Adams 1931; ΔV at saturation ≈ −4 cm³/mol) — explicitly no pressure effect.**

### 4.5 Al2SiO5 polymorphs

Triple points: Holdaway 1971 **501 °C/3.76 kbar**; Bohlen et al. 1991 **530 ± 20 °C/4.2 ± 0.3 kbar**; Pattison 1992 **550 °C/4.5 ± 0.5 kbar** (verified). **Recommend Pattison** — it reconciles the natural-aureole record (Holdaway's And/Sil boundary makes common andalusite aureoles impossible) and sits inside Bohlen's error box. Linearized boundaries about the Pattison node (T °C, P kbar) [DERIVED linearization; slopes: Ky/And +12.9 bar/°C, Ky/Sil +20.0 (entropy-based 17.7 ± 1.0), And/Sil −16 ± 3 — the And/Sil slope is genuinely uncertain, small-ΔG reaction]:

```
Ky/And:  P = 4.5 − 0.0129·(550 − T)      [T < 550]
Ky/Sil:  P = 4.5 + 0.0200·(T − 550)      [T > 550]
And/Sil: P = 4.5 − 0.0160·(T − 550)      [hits 1 bar near ~830 °C]
```

Game geometry: the 4.4 kbar ceiling sits 0.1 kbar under the triple point — an isobaric T-scan at 4.4 kbar legitimately traverses **kyanite → (~15–20 °C andalusite sliver) → sillimanite**. The Ky/And boundary reaches P = 0 near ~200 °C: kyanite is *stable* at low T at every game pressure but never *nucleates* there (sluggish reconstructive transitions — polymorph identity at low T is inherited, not re-equilibrated; encode as nucleation-T floors, not stability lies). Current andalusite (T-only, 400–700 °C) is the exact "temperature-only routing" the brief's verification target forbids — the routing function is Stage A; kyanite/sillimanite engines are the already-reserved BACKLOG Class 2 items.

### 4.6 Apophyllite / zeolite facies

**Verdict: regrade.** No experimental P–T stability determination exists (the literature is genuinely thin — stated honestly): calorimetry only (Geiger et al. 2019, no phase diagram); Deccan paragenesis 100–250 °C; verified occurrences in magnesian skarn (Pietroasa, Minerals 13:1362, 2023) and alpine fissures — settings at ~1–3 kbar lithostatic, above the current 0.5 kbar wall. Zeolite facies itself extends to ~2–3 kbar. Pressure is not what excludes apophyllite from deep assemblages; temperature and fluid chemistry are. **Replace the hard gate with: T ceiling (existing T_max 250 is fine; literature tolerates ≲ 300–350) + graded nucleation down-weight above ~1.5–2 kbar** [INFERENCE, occurrence-statistics-based — flagged as the packet's least-sourced recommendation; the honest alternative is removing the P term entirely].

### 4.7 Sulfides & oxides

**No defensible direct Ksp(P) gate in-box.** Metal-complex stability shifts with fluid density at high T (the quartz ρ-lever) but is second-order vs T, pH, ΣS, salinity [INFERENCE]. The real pressure lever is **phase separation** (§5): H2S/CO2 loss → pH rise → bisulfide destruction → Au + sulfide drop (Drummond & Ohmoto 1985) — mechanism (b)+(f), coded as a boiling event editing the fluid, never as sulfide Ksp(P). Sphalerite FeS geobarometry (Scott 1973; needs sp+py+hexagonal-po, 2.5–10 kbar; working-form digits garbled in retrievable sources ⚑) — **out of scope**.

---

## 5. Volatiles, boiling, open systems

### 5.1 The boiling criterion

`P < P_bubble(T, X_NaCl, m_CO2, m_H2S)`. Pure water: P_sat(T) from IAPWS-95 — 11-row anchor table [MEASURED, NIST WebBook]:

```
T °C : P_sat bar   (interpolate log10 P vs 1/T_K)
100:1.0142  125:2.3224  150:4.7616  175:8.9260  200:15.549  225:25.497
250:39.762  275:59.464  300:85.879  325:120.51  350:165.29
critical: 373.946 °C / 220.64 bar
```

Closed-form alternative (Wagner–Pruß auxiliary equation; coefficients verified digit-for-digit in synthesis pass): `ln(P/Pc) = (Tc/T)·(a1·τ + a2·τ^1.5 + a3·τ³ + a4·τ^3.5 + a5·τ⁴ + a6·τ^7.5)`, τ = 1 − T/647.096, a = [−7.85951783, 1.84408259, −11.7866497, 22.6807411, −15.9618719, 1.80122502], Pc = 220.64 bar.

- **Salt** lowers vapor pressure (harder to boil) and extends the liquid field along the H2O–NaCl critical curve (Driesner & Heinrich 2007, 0–1000 °C/0–5000 bar; Sourirajan & Kennedy 1962). Anchor: 3.2 wt% NaCl brine → critical point **407 °C/298.5 bar** (Bischoff & Rosenbauer 1988). Haas (1971) depth rule [MEASURED, verified]: depth to an isotherm at 5/10/15/20/25 wt% NaCl = **92/84/77/70/63 % (±2 %)** of pure-water depth. Pure-water BPD anchors [DERIVED, Haas-consistent]: 150 °C→41 m, 200→165, 250→462, 300→1086, 350→2346.
- **Dissolved gas** raises P_bubble: vapor nucleates when `P_sat(T)·f_salt + P_CO2(aq) + P_H2S(aq) > P_fluid`. Distinguish **first boiling** (water-dominated bubble curve) from **gas effervescence** (CO2-driven exsolution far above water's own P_sat). The game's existing `equilibriumPCO2(fluid)` is exactly the P_CO2(aq) input.
- Gradients: hydrostatic 0.098 kbar/km (hot column ~0.078); lithostatic 0.265 kbar/km (ρ 2700). The ratio ≈ 2.7 is the fault-valve lever: a sealed lithostatic fluid connecting to a hydrostatic column loses ~63 % of its pressure instantly.

### 5.2 What boiling does (the consequence bundle — all sourced)

Master source: **Drummond & Ohmoto 1985** (Econ. Geol. 80:126–147). Verified headline results: a few % vaporization can drop [H⁺] by orders of magnitude when CO2/H⁺ is high; chloride-complexed metals deposit mainly from the *pH rise*, not the gas loss itself.

| Effect | Direction/magnitude | Source |
|---|---|---|
| (a) solute concentration | ×1/(1−x) for steam fraction x (flash 250→100 °C: x ≈ 0.30 → ×1.42) | [DERIVED] |
| (b) gas partition to vapor | B = C_vap/C_liq ≫ 1 below ~340 °C; order B(H2) > B(CO2) > B(H2S) > B(NH3); B(CO2) ~10³@100 °C, ~10²@200, ~10@300; B(H2S) ~ B(CO2)/(2–5); all → 1 at critical ⚑exact Giggenbach fits unverified — clamp at Tc | D&O 1985; Giggenbach 1980 |
| (c) pH rise | recompute via existing DIC speciation after CO2 removal — **do not also apply an ad-hoc ΔpH**; defensible range 1–2 units (top end = high-DIC broths) | D&O; Simmons & Christenson 1994 |
| (d) boiling assemblage | calcite SI spike → **bladed calcite**; illite→**adularia** stability shift | S&C 1994; Simmons & Browne 2000 |
| (e) metal drop | Au(HS)2⁻ destroyed by H2S loss → gold at the boiling horizon; Pb-Zn-Cu (chloride) respond to pH/cooling — Buchanan zoning: base metals below, precious at/above | Cooke & Simmons 2000; Simmons, White & John 2005; Buchanan 1981 |
| (f) adiabatic cooling | x = (h_l(Ti) − h_l(Tf))/(h_g(Tf) − h_l(Tf)) on the IAPWS enthalpy table; ~3 °C per % steam near 300 °C, ~5 °C per % ≤ 200 °C | [DERIVED from MEASURED h] |
| (g) redox | H2 loss leaves residual liquid slightly oxidized; small +Eh nudge ∝ degassed fraction | D&O [DERIVED direction] |

Texture evidence (the render hooks, all cataloged): bladed/platy calcite = THE boiling indicator (14 % of 855 Guanajuato samples); lattice-bladed quartz-after-calcite; colloform/moss silica from flashing (23 %); coexisting liquid+vapor inclusions = petrographic proof — Moncada et al. 2012 (J. Geochem. Explor. 114:20–35); Dong, Morrison & Jaireth 1995 (Econ. Geol. 90:1841–1856).

### 5.3 Open vs sealed cavity — minimum honest state

The binary `open_system` flag cannot express self-limiting sealed boiling. Smallest sufficient addition [INFERENCE]:

1. `CO2_total` (and optionally `H2S_total`) as **conserved pools** (mol/kg of original liquid), split each step into dissolved vs exsolved by a solubility ceiling (Duan & Sun in its validity box; Suleimenov & Krupp 1994 for H2S, 20–320 °C at P_sat);
2. `vapor_fraction` (headspace mass fraction, 0 in single-phase runs);
3. the existing `open_system` flag deciding exsolved fate: **open → deleted** (with latent heat and solute complement); **closed → accumulates and back-pressures the bubble criterion until boiling self-limits** (the steam-cap mechanism; Sibson fault-valve cycling toggles the states and is why crustiform banding exists).

Three numbers and one rule — covers single-pass flash, sustained open boiling, self-limiting sealed boiling, and valve cycling.

### 5.4 Creative decompression event model (spec)

- **Stage 0 — bubble test**: P_bubble = P_sat(T)·f_salt + P_CO2 + P_H2S. If post-event P ≥ P_bubble → **no boiling** (report honestly; route to null case).
- **Stage 1 — flash extent**: solve isoenthalpically to T_f where P_sat(T_f) = P; x from the enthalpy table.
- **Stage 2 — bundle** in order: degas (fraction min(1, B_i·x) per pool; open=delete/closed=headspace) → recompute pH via DIC speciation → concentrate non-volatiles ×1/(1−x) → apply flash ΔT → small +Eh nudge → mineral hooks (bladed-calcite habit while ΔSI > threshold; adularia window; Au drop on H2S removal; violent flash → colloform/moss silica flag).
- **Null case (mandatory)**: at 4.4 kbar/400 °C a 1-kbar drop leaves 3.4 kbar — 400 °C is above pure water's Tc and a strong brine's two-phase boundary at 400 °C sits near ~0.3 kbar. **No boiling**; the honest consequence is quartz precipitation via the solubility drop (§4.1). The model must produce this "no" without special-casing.
- Stated validity limits: single-pass equilibrium flash; no nucleation kinetics; no Rayleigh fractionation between steps; B clamped to 1 at Tc; Duan–Sun honest only ≤260 °C/≤2 kbar/≤4.3 m; salinity as NaCl-equivalent.

---

## 6. Fluid pressure vs confining pressure vs differential stress

### 6.1 Variable separation

| Quantity | Definition | Can it live in the game's one scalar? |
|---|---|---|
| Fluid pressure P_f | pressure of the cavity fluid | **YES — this IS the scalar.** For growth into an open fluid-filled cavity, the stress on the crystal surface is isotropic P_f: solubility, Ksp, activities, ΔV°r, precipitating-phase polymorph stability, boiling all legitimately key to it |
| Lithostatic P_lith | ρ_rock·g·z (26.0–27.5 MPa/km; 3.77 km/kbar) | NO — differs from P_f by the pore-fluid factor λ_v = P_f/σ_v (0.37–0.40 hydrostatic … 1.0 lithostatic … >1 transient, Sibson) |
| Differential stress σ_diff = σ1−σ3 | deviatoric | **NEVER** — an isotropic ΔP of 0.5 kbar changes σ_diff by exactly zero |

Depth sanity [DERIVED]: 4.4 kbar lithostatic = 16.6 km; as hydrostatic head it would need 44.9 km of water column — **the game's top pressures are physically reachable only as near-lithostatic fluid pressures (λ→1)**, which is exactly what Grimsel records.

### 6.2 Twinning (the Tap/Shock correction)

- Activation depends on **differential stress only**: confining pressure varied 50–400 MPa (the game's band, 8-fold) with **no effect on twinning** [MEASURED, Rybacki et al. 2013]; "strain rate, temperature and confining pressure have negligible effects on twinning activation" [MEASURED, Parlangeau et al. 2019, open access].
- CRSS [MEASURED, Tullis 1980, verified]: **calcite ≈ 10 MPa** (spread 2–12; mm-scale single crystals 0.9 ± 0.35 — big vug crystals twin *easier* than matrix), **dolomite ≈ 100 MPa** (f-twins, principal mode 300–600 °C), clinopyroxene ≈ 140. **Quartz does not mechanically twin** (Dauphiné twinning exchanges rhombs with zero shape change — never render as morphology; bent quartz = dislocation glide, a different, legitimate mechanism).
- Twin **density** piezometer (use this; Rowe & Rutter 1990's numeric coefficients are unverified ⚑): **Δσ(MPa) = 10^1.29 · ρ_twin^0.50** ⇒ ρ_twin = (Δσ/19.5)² twins/mm, valid 20–350 °C (Rybacki et al. 2011). Twin **morphology** is a thermometer (Ferrill et al. 2004: Type I thin/straight <~200 °C; II lensoid 150–300; III curved >200; IV patchy >250) — existence keys to σ_diff, appearance keys to T: a free render axis.
- **Consistency check for the deformation arc**: saddle dolomite's curvature is a **growth** feature (calcitic ribbon laths, 3.8–6.7 % lattice mismatch → macroscopic curvature; Barber, Reeder & Smith 1985) — if the arc currently drives it from the stress event, revisit against that primary; if it is already growth-driven, this confirms it. Bent quartz stays deformational.

### 6.3 Fracture, the valve, and the σ_diff ceiling

- Hydrofracture: **P_f > σ3 + T0**, T0 ≈ 1–10 MPa crustal working range (Secor 1965; BGS OR/15/066).
- **Veining caps differential stress: mode-I failure requires σ_diff ≤ 4·T0 ≈ 4–40 MPa** (Etheridge 1983, verified; Sibson 1998's 4T–6T hybrid bands unverified ⚑ — ship 4T only). **Open-cavity growth is an intrinsically low-σ_diff environment; abundant twinning in a vug crystal therefore implies a later, higher-stress event after sealing — the literature independently endorses the game's post-growth twinning design.**
- Fault-valve (Sibson 1990): seals interseismically (P_f climbs toward lithostatic) → rupture → **P_f drops toward hydrostatic** → mineral sealing → rebuild. Crack-seal increments (Ramsay 1980) record the cycles; the sealing material derives from matrix pressure solution — a scientifically exact narrator line.
- **The current shock event has the sign backwards for fluid pressure**: `P += 0.5` is the slow *loading* phase; the *event* is the drop.

### 6.4 Recommended architecture

1. **Keep one state pressure; relabel it fluid pressure.** No numeric change, no baseline movement.
2. **`wall.confining_kbar`** — optional scenario-level context (default null → = P_f, λ=1). Derives `λ = P_f/P_conf` and `depth_km = P_conf·100/26.5` for the narrator and the valve gate. Scenario metadata on the exhumation schedule, not per-step state.
3. **σ_diff as a transient event property** `{sigma_diff_mpa, duration_steps}` — never a state variable (twinning is threshold-and-forget, recording *peak* stress — that is why paleopiezometry works; veining pins σ_diff ≤ 4·T0 most of the time; it cannot be inferred from any pressure).
4. **Split the shock into two events**:
   - `stress_pulse` — {σ_diff (default 50 MPa = the old 0.5 kbar reinterpreted), duration, ΔT +15 °C (frictional heating, defensible), **ΔP_f = 0**}. Drives twinning/bending/fracturing of existing crystals: resolved τ = schmid·σ_diff (schmid sampled per grain, max 0.5) vs per-mineral CRSS. A 50 MPa pulse twins calcite (needs 20), leaves dolomite (200) and quartz untouched — matching natural assemblages automatically.
   - `valve_rupture` — P_f drops toward hydrostatic (λ→~0.4), opens permeability, admits a fresh fluid batch, then re-seals. This is the physically correct "open a fracture, grow a new generation" event, and (composed with §5) the natural boiling trigger at shallow settings and the quartz-precipitation trigger at deep ones.
5. **Deliberately not modeled** (state in code comments so later sessions don't "fix" them): poroelasticity/Skempton; strain rate (twinning is strain-rate-independent, so nothing is lost; pressure solution needs it — the honest reason it stays flavour); stress-tensor orientation (Schmid sampled → no paleostress inversion, right trade); Hall–Petch grain-size CRSS (flat at mm scale; future lever).

---

## 7. Numerical & UX boundaries (brief Q5)

- **Units**: keep **kbar** as the stored and default display unit — every scenario, save, baseline, and doc uses it, and changing the stored unit risks the save system for zero physics gain. Convert at point of use (`ΔP_bar = 1000·P_kbar`; MPa = 100·P_kbar). A kbar/MPa display toggle is cheap UI if wanted.
- **Range/resolution**: valid simulation range **0.01–4.4 kbar** (the fleet's span; both ends sourced). Creative setup should match it (currently 0.1–3.0): low end matters for cave/evaporite honesty, high end for Grimsel. Resolution: 0.01 kbar steps below 0.5 (near-surface boiling is sensitive there — 0.01 kbar ≈ 100 m hydrostatic), 0.1 above. Zen drift clamp [0.1, 5.0] should tighten its ceiling to 4.4 (5.0 exceeds every sourced scenario) ⚑minor.
- **Extrapolation policy**: clamp at data-envelope edges and *say so* — never extrapolate: Duan–Sun outside 273–533 K/0–2 kbar/4.3 m; ΔV°r corrections in the low-density corner (T > 350 °C ∧ P < 0.5 kbar → freeze the correction at the envelope edge value and tag low-confidence); no boiling math above the (salinity-extended) critical curve; Davies stays within I ≤ 0.5.
- **The "Why did—or didn't—this mineral form?" surface should report pressure only where it is load-bearing**, one line each:
  - polymorph routing: which phase P selected and the distance to the boundary ("4.4 kbar, 520 °C — kyanite field, 30 °C below the And sliver");
  - Ksp minerals: the pressure term's size ("P adds +0.53 to log Ksp — calcite is 3.4× more soluble here than at surface pressure");
  - boiling margin: "P − P_bubble = +12 bar — 40 m more uplift and this fluid flashes" (or "supercritical: cannot boil at any P");
  - failed gates: name the graded P down-weight when it mattered (apophyllite), never a bare "pressure too high";
  - honesty tag when inside the low-confidence corner.
- **Control taxonomy**: *direct controls* — fluid pressure (setup + live), decompression/valve event, stress pulse event; *boundary conditions* — confining pressure/λ, open_system, exhumation schedule; *derived observations* — depth, P_bubble margin, polymorph field, SI pressure term; *process actions* — Tap/Shock (as stress_pulse), valve_rupture, replenish.

---

## 8. Staged implementation plan

Discipline (project law, restated): instruments-first — every stage lands its observables byte-identically before any engine flip; baseline-moving flips are their own attributable commits with calibration-aware messages; per-mineral promotion flags follow the js/32b pattern.

### Stage A — high-confidence, low-cascade

A0. **ppm-convention audit** (mg/kg vs mg/L — §1; blocking, zero-code-change outcome if mg/kg).
A1. **Relabel pressure as fluid pressure** (UI/docs). Byte-identical.
A2. **Pressure columns in thermo data**: add `deltaV_r_cm3_mol` (+ optional `deltaKappa_r`) to thermo-sulfates.json / thermo-carbonates.json for the reactions that have sourced values (§4 tables; family −50 for sulfates, −58 per CO3 unit for carbonates at Stage A precision). Extend `tools/thermo-coverage-check.mjs` to verify presence/units/provenance. Observable-only: surface the SI pressure term in the saturation-index readouts (the panel line of §7) with engines unflipped — byte-identical.
A3. **Flip per-mineral** (barite, celestine, anhydrite, gypsum, calcite… — one commit each or one small batch): apply the ΔV°r+Δκ term inside the existing Ksp(T) call. Re-anchor drifted scenarios per vugg-tune-scenario. Expected drift concentrates in the high-P scenarios (2–4.4 kbar): carbonate/sulfate Ksp up ×2–20 → mild solubility increases, later/lighter nucleation.
A4. **Quartz density model as observable**: implement Manning-1994 `Ksp_quartz(T, ρ_H2O(T,P))` with a coarse IAPWS ρ-grid (the §4.1 seed grid + interpolation); surface as an SI observable next to the existing quartz engine before any promotion decision.
A5. **α/β quartz habit line** `T = 573 + 25.5·P` — render/habit switch only.
A6. **Al2SiO5 routing function** (three Pattison-anchored lines) consumed by andalusite's gate now (replaces T-only routing with (T,P) routing; nucleation-T floor keeps low-T kyanite honesty); kyanite/sillimanite engines remain BACKLOG Class 2 and plug into the same function when built.
A7. **Apophyllite regrade**: drop the 0.5 kbar hard wall; T gate + graded down-weight >1.5–2 kbar. Deccan (0.05 kbar) unaffected; documents the INFERENCE status in the gate's `_sources`.
A8. **Gyp⇌anh boundary**: add the +14.7 °C/kbar term to whichever boundary expression the planned Hardie-1967 salinity-ceiling commit lands — same commit family, one boundary, two levers.
A9. **Aragonite deep window**: Hacker et al. published negative-linear boundary as a (c)-mechanism gate, with its ±0.1 GPa uncertainty enforced before declaring a secure deep field; low-P aragonite stays Mg-kinetic. Fleet effect: none until a deep-field scenario exists.

### Stage B — volatiles, boiling, events

B1. Conserved pools `CO2_total` (+`H2S_total`), `vapor_fraction`; Duan–Sun ceiling (+Suleimenov–Krupp); dissolved remainder feeds the existing Bjerrum/pH machinery (vugg-add-broth pattern; PROPOSAL-VOLATILE-GASES is the anticipated consumer).
B2. `P_sat` table + bubble test + flash bundle (§5.4) as the **decompression event**; open/closed rule per §5.3.
B3. **Event split**: `stress_pulse` (σ_diff, no ΔP_f) + `valve_rupture` (P_f drop toward λ≈0.4, re-seal schedule). Rewire Tap/Shock: Tap → small stress_pulse (σ_diff ~20 MPa — twins favourable calcite only); Shock → large stress_pulse (50 MPa) + optional valve_rupture. Twinning: τ = schmid·σ_diff vs CRSS table; density (Δσ/19.5)²; Ferrill type from T (render). The legacy `P += 0.5` behavior retires with a changelog note.
B4. Creative: live fluid-pressure control + "Decompress" action (the brief's missing lever) with the §5.4 staged model; boiling textures (bladed calcite habit, colloform silica flag, adularia window).

### Stage C — broader P–T thermodynamics

C1. **Generate, don't transcribe**: run SUPCRTBL (or PHREEQC via SupPHREEQC) offline over 10–800 °C × 1–4400 bar for the ~15 SI-engine reactions *exactly as the game writes them*; fit `log K(T,P) = log K(T,1 bar) + c1(T)·P + c2(T)·P²`; ship fitted c1(T), c2(T) per reaction + the generator script under tools/ (the tool is part of the deliverable). Mask ρ_w < 0.35; tag the hot/shallow corner.
C2. Davies A(T) audit, then A(T,P) from Fernández-1997's published coefficients (order: the T-dependence is the bigger miss).
C3. Brine effects on the bubble curve (Driesner & Heinrich 2007 anchors) if scenarios with >5 wt% NaCl-equivalent broths emerge.
C4. pH internal consistency pass (pressure-shifted K1/K2/Kw feeding pH as an output option) — only meaningful with B1 landed.
C5. Confining-pressure/λ narration + Grimsel exhumation schedule as scenario metadata (the Gnos P–T–t table §9.5 is the ready-made schedule).

---

## 9. Calibration & verification cases

Each case: setup → expected outcome (qualitative; quantitative where sourced).

**9.1 Near-surface cave/evaporite (0.01 kbar, 10–40 °C)** — brief target 1, "no deep-hydrothermal behavior".
ΔV°r term at 0.01 kbar vs 1-bar reference: Δlog K ≈ +0.01·1.016 ≈ **+0.01 — nil**. P_sat(25 °C) ≈ 0.03 bar ≪ 10 bar: no boiling at any plausible drop. Gyp⇌anh boundary moves +0.15 °C — nil. **PASS = byte-near-identical behavior; any visible pressure effect here is a bug.** (Effervescence remains possible if a CO2-rich karst broth is authored with P_CO2 > 10 bar — that is honest, and the panel should say "gas effervescence", not "boiling".)

**9.2 Deccan apophyllite (0.05 kbar, 100–250 °C)** — brief target 2.
The regrade (A7) leaves Deccan unchanged (0.05 kbar is far below the down-weight knee). NEW capability: a 1.5–2.5 kbar skarn/alpine broth meeting the chemical gates may now nucleate sparse apophyllite (Pietroasa-style) instead of hard zero. Quantitative check: at 2 kbar the down-weight should suppress, not forbid — expected rarity, not absence.

**9.3 Quartz decompression — solubility vs boiling separated** — brief target 3.
(i) 450 °C, 4.4 → 0.5 kbar isothermal: dissolved-SiO2 ceiling falls ~4945 → ~931 ppm (Manning) — **~80 % of silica dumped, no boiling** (supercritical); expect a massive growth pulse.
(ii) 300 °C, 4.4 → 0.5 kbar: ceiling falls 1199 → 727 ppm — modest pulse.
(iii) 250 °C, 0.05 → 0.03 kbar: crosses P_sat(250 °C) = 39.8 bar → **boiling path**: flash x ≈ 0.05–0.3 by ΔT, bladed calcite if Ca/DIC present, colloform silica if violent — the two mechanisms must fire on their own cases, never together at depth.

**9.4 Carbonate fluid, open vs closed CO2 during decompression** — brief target 4.
Same broth (DIC-rich, 150 °C), same ΔP crossing the effervescence threshold. **Open**: full CO2 escape → pH +1–2 → strong calcite pulse, bladed habit while ΔSI spikes. **Closed**: headspace back-pressure self-limits after a small degassed fraction → pH rise a fraction of a unit → thin calcite rind, no blades. The *difference* between the two runs is the verification (probe the dynamic, not just the endpoints).

**9.5 Grimsel alpine cleft (4.4 kbar, 450 °C, retrograde)** — brief target 5.
The measured path [Gnos et al. 2025, verified from full text]: Z1 **450 ± 15 °C / 440 ± 20 MPa** (14.62 ± 0.12 Ma) → Z2 ~380 °C/325 MPa → Z3 300–330 °C/230–240 MPa (→7.02 Ma); fluid lithostatic, dropping briefly to hydrostatic at each rupture; early 2–2.6 mol% NaCl, 4 mol% CO2 in Z3a; cooling 22–25 °C/Ma. **The game's 4.4 kbar setting equals the measured Z1 pressure to the digit.** PASS criteria: episodic quartz growth pulses at valve events along the descent; **zero boiling anywhere on the path**; T decline supplies the silica budget, P drops supply the triggers.

**9.6 Al2SiO5 selection from sourced boundaries** — brief target 6.
Probe points against the §4.5 lines (Pattison anchor): (4.4 kbar, 480 °C) → **kyanite**; (4.4 kbar, 545 °C) → **andalusite sliver**; (4.4 kbar, 600 °C) → **sillimanite**; (1.0 kbar, 575 °C) → **andalusite** (current andalusite T-window agrees — the fleet survives); (2.0 kbar, 700 °C) → **sillimanite** (T-only routing would have said andalusite at 700 °C edge — the discriminating case); (0.5 kbar, 150 °C) → kyanite-stable but **nothing nucleates** (kinetic floor) — the model must not mint low-T kyanite druses.

---

## 10. Do-not-implement list (shortcuts that would misrepresent the science)

1. **Any universal pressure multiplier** on growth or σ. ΔV°r spans −6 to −60 cm³/mol across reactions and is *positive* for associations.
2. **Twinning from ΔP** (the current mechanic). Isotropic pressure produces zero twins at any magnitude.
3. **`P += ` as the shock's fluid-pressure signature.** Rupture *drops* P_f. Loading is slow and belongs to the scenario schedule, not the event.
4. **Pressure-as-depth conflation.** 1 kbar is 3.8 km lithostatic but 10.2 km hydrostatic; the narrator must pick per λ, never a single conversion.
5. **Seawater-scale (Millero apparent) constants inside the infinite-dilution Davies model** — the −35.5 vs −58 gap *is* ion pairing; mixing scales double-counts or cancels it unpredictably.
6. **Extrapolating any fit beyond its envelope** (Duan–Sun >260 °C; Blount >1.4 kbar for barite *measurements*; Wang gyp-anh fit <250 °C is already an extrapolation — keep the Clapeyron cross-check; boiling above the critical curve).
7. **P-gating low-pressure aragonite.** Springs/amygdule aragonite is Mg-kinetics; a P gate there is confabulation.
8. **Davies A(P) as the headline pressure effect** — 10× smaller than ΔV°r; alone it is pressure theatre.
9. **A silent pressure-dependent pH** while pH remains an authored input — allowed only as a documented DIC-recompute (boiling bundle) or an explicit Stage C output mode.
10. **Sphalerite FeS barometry, DEW-model imports, Rowe–Rutter numeric coefficients, Sibson 4T–6T hybrid bands** — each is out-of-scope or unverified (§12); none may enter data files.
11. **Dauphiné twins as visible morphology.** Zero shape change.
12. **Choosing any ΔV°r, boundary slope, or B-coefficient to make a shipping scenario produce a desired mineral.** Anchor scenarios by re-tuning broths/events against the corrected physics, never the reverse (accuracy-over-determinism law).

---

## 11. Machine-ready appendix

### 11.1 Framework constants

| Item | Value | Units | Source · class | Validity |
|---|---|---|---|---|
| R | 83.145 | cm³·bar·mol⁻¹·K⁻¹ | CDIAC-105 erratum · [MEASURED] | — |
| Core correction | log K(T,P) = log K(T,Pref) + [−ΔV°r·ΔP + ½Δκ°r·ΔP²]/(2.303·R·T) | ΔP bar | Millero 1982 form; CO2SYS impl. · [DERIVED] | per-reaction |
| |Δκ°r| typical dissolution | ~10×10⁻³ | cm³·mol⁻¹·bar⁻¹ | Millero 1982 · [EMPIRICAL] | 0–50 °C |
| Constant-ΔV error | 8.6 % @1 kbar → 38 % @4.4 kbar | — | [DERIVED] | 25 °C |
| HKF envelope | ρ_w > 0.35 g/cm³; 0–1000 °C; 1–5000 bar | — | CHNOSZ verbatim · [EMPIRICAL] | distrust T>350 °C ∧ P<500 bar |
| IAPWS-95 | 273.16–1273 K, 0–1000 MPa | — | Wagner & Pruß 2002 | covers box |
| IAPWS R8-97 (ε, A_γ) | 238–873 K, ≤1000 MPa | — | Fernández et al. 1997 | covers box |
| PHREEQC-3 P range | 0–200 °C, 1–1000 atm | — | Appelo 2015 | bottom 23 % of box |
| SUPCRT92/BL range | 1–5000 bar, 0–1000 °C | — | Johnson et al. 1992; Zimmer et al. 2016 | covers box — the Stage C generator |
| Davies A(25 °C, 1 bar) | 0.508–0.509 | (mol/L)^−1/2 | aqion · [EMPIRICAL] | I ≤ 0.5 |
| A(P) sensitivity | −8…−10 %/kbar (≲0.08 log on Ω) | — | [INFERENCE] | defer, documented |

### 11.2 Reaction volumes (Stage A defaults; Stage C replaces with fitted c1(T), c2(T))

| Reaction (dissolution, infinite dilution, 25 °C) | ΔV°r cm³/mol | Class |
|---|---|---|
| calcite → Ca²⁺ + CO3²⁻ | −58 ± 3 | [DERIVED/EMPIRICAL] |
| aragonite | ΔV(calcite) + 2.8 | [EMPIRICAL] |
| siderite | −56 ± 5 | [DERIVED] |
| dolomite (per formula unit, 2 CO3) | −112 ± 8 | [DERIVED] |
| barite | −50.6 ± 5 | [DERIVED] |
| celestine | −50.5 ± 5 | [DERIVED] |
| anglesite | −49.6 ± 5 | [DERIVED] |
| anhydrite | −49.8 ± 5 | [DERIVED] |
| gypsum | −42.4 ± 5 | [DERIVED] |
| fluorite | −45 ± 5 | [DERIVED] |
| halite | −4 (at saturation) → ignore | [MEASURED] |
| am. silica / opal | −12 → ignore | [DERIVED] |
| quartz | use density model, not ΔV°r | — |
| Solid V (for ΔV°r assembly): calcite 36.9 · barite 52.9 · gypsum 73.9 · anhydrite 46.1 · quartz 22.67 | cm³/mol | phreeqc.dat verbatim · [MEASURED] |

### 11.3 Silica

```
Manning 1994 (T K, ρ g/cm³, m mol/kg; 25–900 °C, ≤20 kbar) [coefficients digit-verified]:
log m = 4.2620 − 5764.2/T + 1.7513e6/T² − 2.2869e8/T³
      + (2.8454 − 1006.9/T + 3.5689e5/T²)·log ρ
Fournier & Potter 1982 cross-check: §4.1. Anchors: 6–7 ppm @25 °C/1 bar;
727/1199 ppm @300 °C 0.5/4.4 kbar; 931/4945 ppm @450 °C 0.5/4.4 kbar.
ρ seed grid (IAPWS, g/cm³): 300 °C @50/180/310/440 MPa = 0.77648/0.87469/0.93341/0.97761;
                            450 °C = 0.40204/0.72440/0.81791/0.87877.
α/β: T_tr(°C) = 573 + 25.5·P(kbar)   [Cohen & Klement 1967]
Gunnarsson & Arnórsson 2000 (T K, 0–350 °C, P_sat):
log K(am) = −8.476 − 485.24/T − 2.268e-6·T² + 3.068·logT
log K(qz) = −34.188 + 197.47/T − 5.851e-6·T² + 12.245·logT
```

### 11.4 Phase boundaries

```
Calcite–aragonite (Hacker et al. 2005 published form; see §12 ledger):
  P(GPa) = 0.299 − 7.4e-4·(T−298) + 2.4e-6·(T−298)²        (T K; ±0.1 GPa)
  secure deep field: P_fluid > P_boundary + 1.0 kbar; outside it, retain the Mg-kinetic route
Al2SiO5 (Pattison anchor 550 °C / 4.5 kbar; slopes bar/°C: Ky/And +12.9, Ky/Sil +20.0, And/Sil −16±3):
  Ky/And:  P(kbar) = 4.5 − 0.0129·(550 − T°C)
  Ky/Sil:  P(kbar) = 4.5 + 0.0200·(T°C − 550)
  And/Sil: P(kbar) = 4.5 − 0.0160·(T°C − 550)
  alternates: Holdaway 501 °C/3.76 kbar; Bohlen 530±20 °C/4.2±0.3 kbar
Gypsum⇌anhydrite: T_tr(°C) ≈ 58 + 14.7·P(kbar) at a_H2O = 1  [Hardie 58±2 °C; Clapeyron +14;
  Wang 2012 DAC +14.7 ⚑extrapolated below 250 °C]; a_H2O ladder: 0.960→55, 0.845→39, 0.770→23 °C;
  kinetic floor: no direct anhydrite nucleation < ~100 °C (existing v228 gate)
```

### 11.5 Boiling / volatiles

```
P_sat table (°C:bar): 100:1.0142 125:2.3224 150:4.7616 175:8.9260 200:15.549 225:25.497
  250:39.762 275:59.464 300:85.879 325:120.51 350:165.29 · Tc 373.946 °C, Pc 220.64 bar
Wagner–Pruß closed form: ln(P/Pc) = (Tc/T)·Σ aᵢτ^nᵢ, τ=1−T/647.096,
  a = [−7.85951783, 1.84408259, −11.7866497, 22.6807411, −15.9618719, 1.80122502],
  n = [1, 1.5, 3, 3.5, 4, 7.5]   [digit-verified]
Enthalpies for flash x = (h_l(Ti)−h_l(Tf))/(h_g(Tf)−h_l(Tf)): see §5.1 source table (NIST);
  rule of thumb ~3 °C per % steam @300 °C, ~5 @≤200 °C
Haas 1971 saline depth factors (±2 %): 5/10/15/20/25 wt% → 0.92/0.84/0.77/0.70/0.63
BPD anchors (pure, hydrostatic): 150 °C:41 m · 200:165 · 250:462 · 300:1086 · 350:2346
Critical curve: pure 373.9 °C/220.6 bar; 3.2 wt% NaCl 407 °C/298.5 bar [Bischoff & Rosenbauer 1988]
Gas partition B = C_vap/C_liq ⚑order-anchors only: B_CO2 ~1e3@100 °C, ~1e2@200, ~1e1@300;
  B_H2S ~ B_CO2/(2–5); B_H2 > B_CO2; clamp B→1 at Tc
CO2 ceiling: Duan & Sun 2003 — 273–533 K, 0–2000 bar, 0–4.3 m NaCl, ~7 %
  (sanity: 0.034 mol/kg @25 °C/1 bar CO2)
H2S ceiling: Suleimenov & Krupp 1994 — 20–320 °C @ P_sat
Gradients: hydrostatic 0.098 kbar/km (hot ~0.078) · lithostatic 0.265 kbar/km (ρ 2700)
```

### 11.6 Stress / deformation

```
CRSS (MPa) [Tullis 1980, T- & strain-rate-independent]: calcite 10 (spread 2–12; mm xtals 0.9±0.35),
  dolomite 100 (f-twins 300–600 °C), clinopyroxene 140, quartz — none (Dauphiné: no shape change)
Min σ_diff to twin favourable grain = 2·CRSS: calcite 20 MPa (0.2 kbar-equivalent), dolomite 200
Twin density: ρ_twin(twins/mm) = (Δσ_MPa/19.5)²   [Rybacki 2011; 20–350 °C]
Twin morphology (Ferrill 2004, render): I <~200 °C thin/straight · II 150–300 lensoid ·
  III >200 curved · IV >250 patchy+GBM
Fracture: hydrofracture P_f > σ3 + T0, T0 = 1–10 MPa; veining ceiling σ_diff ≤ 4·T0 = 4–40 MPa
  [Secor 1965; Etheridge 1983; Sibson-1998 6T bands ⚑unverified — do not ship]
λ: hydrostatic 0.37–0.40 · lithostatic 1.0 · depth_km = P_conf(kbar)·100/26.5
Events: stress_pulse {σ_diff 50 MPa default, ΔT +15 °C, ΔP_f 0} ·
        valve_rupture {λ_target 0.40, reseal per scenario}
Grimsel path [Gnos et al. 2025, verified]: Z1 450±15 °C/440±20 MPa @14.62 Ma →
  Z2 ~380/325 → Z3a 330±10/230±20 → Z3b2 300±10/240±20 @7.02 Ma;
  peak 450±25 °C/650±10 MPa @22–17 Ma; cooling 22–25 °C/Ma; exhumation ~1.4 mm/a;
  fluid 2–2.6 mol% NaCl, Z3a 4 mol% CO2, late >99 % H2O
```

---

## 12. Synthesis cross-check ledger & open flags

Spot-checks performed against primaries/independent sources in the synthesis pass (beyond the four passes' own verification):

| Claim | Result |
|---|---|
| Manning 1994 coefficients (all seven digits) | ✅ digit-for-digit, two independent reproductions |
| Haas 1971 saline depth rule 92/84/77/70/63 ±2 % | ✅ verified |
| Wagner–Pruß a1–a6 | ✅ digit-for-digit (independent compilation) — the boiling pass's ⚑ is cleared |
| Hacker et al. 2005 cal-arag fit | ✅ rechecked against the primary paper: §15 and the conclusions both print the **negative** linear term and state ±0.1 GPa uncertainty. The earlier positive-sign reconstruction is rejected; this packet and the implementation now transcribe the published equation exactly. |
| Pattison 1992 triple point 4.5 ± 0.5 kbar / ~550 °C | ✅ verified |
| Gnos et al. 2025 Grimsel (title, Z1 450 °C/440 MPa, 14.62 Ma, lithostatic→hydrostatic) | ✅ verified from full text (PMC12162807) |
| Tullis 1980 CRSS 100/1000/1400 bars, T- & rate-independent | ✅ verified |

**Open flags carried into implementation** (each marked ⚑ in place): Giggenbach B-coefficient fits (use order-anchors + clamp); Broadlands deep-liquid pH digit; CO2 solubility-minimum T and 4-m salting-out factor; Millero 1982 full text (403 — Δκ from abstract); Strübel 1965 / Tropper & Manning 2007 contents (existence only); Macdonald & North 1974 fitted digits; sphalerite-barometer constants (garbled); Wang 2012 gyp-anh fit below 250 °C (Clapeyron cross-check mitigates); And/Sil slope ±3 bar/°C; Rowe–Rutter numeric coefficients (superseded by Rybacki 2011); Sibson 1998 6T bands; Mullis 1994 DOI; apophyllite down-weight knee (occurrence-based INFERENCE — the packet's least-sourced number); saddle-dolomite reconciliation (read Barber, Reeder & Smith 1985 before touching the deformation arc); SUPCRTBL/PHREEQC licence texts.

---

## 13. Consolidated citations

Framework: Millero 1982 GCA 46:11–22 (10.1016/0016-7037(82)90286-1) · Millero 1979 GCA 43:1651–1661 (10.1016/0016-7037(79)90184-4) · Millero 1995 GCA 59:661–677 (10.1016/0016-7037(94)00354-O) · Ingle 1975 Mar. Chem. 3:301–319 (10.1016/0304-4203(75)90010-9) · CO2SYS-MATLAB (github.com/jamesorr/CO2SYS-MATLAB) · Tanger & Helgeson 1988 Am. J. Sci. 288:19–98 · Shock et al. 1992 JCS Faraday Trans. 88:803–826 (10.1039/FT9928800803 ⚑inferred) · Johnson, Oelkers & Helgeson 1992 Comput. Geosci. 18:899–947 (10.1016/0098-3004(92)90029-Q) · Zimmer et al. 2016 Comput. Geosci. 90 (10.1016/j.cageo.2016.02.013) · Zhang, Lu & Zhu 2020 SupPHREEQC (PII S0098300420305501) · Sverjensky et al. 2014 GCA 129:125–145 (PII S0016703713007151) · Miron et al. 2019 Geofluids (10.1155/2019/5750390) · Wagner & Pruß 2002 JPCRD 31:387–535 (10.1063/1.1461829) · Fernández et al. 1997 JPCRD 26:1125–1166 (10.1063/1.555997) / IAPWS R8-97 · Johnson & Norton 1991 Am. J. Sci. 291:541–648 · Appelo, Parkhurst & Post 2014 GCA 125:49–67 (10.1016/j.gca.2013.10.003) · Appelo 2015 Appl. Geochem. 55:62–71 (10.1016/j.apgeochem.2014.11.007) · Parkhurst & Appelo 2013 USGS TM 6-A43 · Dolejš & Manning 2010 Geofluids 10:20–40 (10.1111/j.1468-8123.2010.00282.x).

Minerals: Manning 1994 GCA 58:4831–4839 (10.1016/0016-7037(94)90214-3) · Fournier & Potter 1982 GCA 46:1969–1973 (10.1016/0016-7037(82)90135-1) · Gunnarsson & Arnórsson 2000 GCA 64:2295–2307 (10.1016/S0016-7037(99)00426-3) · Cohen & Klement 1967 JGR 72:4245 · Johannes & Puhan 1971 CMP 31:28–38 (10.1007/BF00373389) · Hacker et al. 2005 JGR 110:B03205 (10.1029/2004JB003302) · Berner 1975 GCA 39:489 · Duan & Sun 2003 Chem. Geol. 193:257–271 (10.1016/S0009-2541(02)00263-2) · Hardie 1967 Am. Mineral. 52:171–200 · MacDonald 1953 Am. J. Sci. 251:884 · Innorta et al. 1980 · Ossorio et al. 2014 Chem. Geol. 386:16–21 (10.1016/j.chemgeo.2014.07.026) · Wang et al. 2012 Chin. Phys. Lett. 29:049101 (10.1088/0256-307X/29/4/049101) · Mirwald 2008 JCP 128:074502 (10.1063/1.2826321) · Blount 1977 Am. Mineral. 62:942–957 · Monnin 1999 Chem. Geol. 153:187–209 · Richardson & Holland 1979 GCA 43:1313–1325 (10.1016/0016-7037(79)90121-2) · Strübel 1965 N. Jb. Mineral. Mh. 1965:83–95 ⚑ · Tropper & Manning 2007 Chem. Geol. 242:299–306 ⚑ · Adams 1931 · Holdaway 1971 Am. J. Sci. 271:97–131 · Bohlen, Montana & Kerrick 1991 Am. Mineral. 76:677–680 · Pattison 1992 J. Geol. 100:423–446 (10.1086/629596) · Geiger et al. 2019 · Pietroasa 2023 Minerals 13:1362 (10.3390/min13111362) · Scott 1973 Econ. Geol. 68:466–474 (10.2113/gsecongeo.68.4.466) ⚑digits · Macdonald & North 1974 Can. J. Chem. 52:3181 ⚑digits.

Boiling: Haas 1971 Econ. Geol. 66:940–946 · Driesner & Heinrich 2007 GCA 71:4880–4901 (10.1016/j.gca.2006.01.033) · Driesner 2007 GCA 71:4902–4919 (10.1016/j.gca.2007.05.026) · Sourirajan & Kennedy 1962 Am. J. Sci. 260:115–141 · Bischoff & Rosenbauer 1988 GCA 52 · Drummond & Ohmoto 1985 Econ. Geol. 80:126–147 (10.2113/gsecongeo.80.1.126) · Giggenbach 1980 GCA 44:2021–2032 · Simmons & Christenson 1994 Am. J. Sci. 294:361–400 · Simmons & Browne 2000 Econ. Geol. 95 · Cooke & Simmons 2000 SEG Rev. Econ. Geol. 13:221–244 · Simmons, White & John 2005 Econ. Geol. 100th Anniv.:485–522 · Buchanan 1981 Ariz. Geol. Soc. Digest 14:237–262 · Moncada et al. 2012 J. Geochem. Explor. 114:20–35 (10.1016/j.gexplo.2011.12.001) · Dong, Morrison & Jaireth 1995 Econ. Geol. 90:1841–1856 (10.2113/gsecongeo.90.6.1841) · Suleimenov & Krupp 1994 GCA 58:2433–2444 (10.1016/0016-7037(94)90022-1) · Scott et al. 2020 JVGR (steam caps).

Stress: Hubbert & Rubey 1959 GSA Bull. 70:115–166 · Sibson 1990 GSL Spec. Pub. 54:15–28 (10.1144/GSL.SP.1990.054.01.02) · Sibson 1998 JSG 20:655–668 ⚑6T · Sibson 2020 EPS 72:31 (10.1186/s40623-020-01153-x) · Secor 1965 Am. J. Sci. 263:633–646 (10.2475/ajs.263.8.633) · Etheridge 1983 Geology 11:231–234 · Cox 2010 Geofluids 10:217–233 (10.1111/j.1468-8123.2010.00281.x) · Ramsay 1980 Nature 284:135–139 (10.1038/284135a0) · Bons, Elburg & Gomez-Rivas 2012 JSG 43:33–62 (10.1016/j.jsg.2012.07.005) · Turner, Griggs & Heard 1954 GSA Bull. 65:883–934 · Tullis 1980 JGR 85:6263–6268 (10.1029/JB085iB11p06263) · Rowe & Rutter 1990 JSG 12:1–17 (10.1016/0191-8141(90)90044-Y) ⚑coefficients · Rybacki et al. 2011 Tectonophysics 509:107–119 (10.1016/j.tecto.2011.05.014) · Rybacki et al. 2013 Tectonophysics 601:20–36 (10.1016/j.tecto.2013.04.021) · Parlangeau et al. 2019 Solid Earth 10:307–316 (10.5194/se-10-307-2019) · Lacombe 2010 OGST 65:809–838 (10.2516/ogst/2009088) · Lacombe et al. 2021 Geosciences 11:445 (10.3390/geosciences11110445) · Ferrill et al. 2004 JSG 26:1521–1529 (10.1016/j.jsg.2003.11.028) · Barber, Heard & Wenk 1981 PCM 7:271–286 (10.1007/BF00311980) · Tullis & Tullis 1972 AGU Monogr. 16:67–82 (10.1029/GM016p0067) · Barber, Reeder & Smith 1985 CMP 91:82–92 (10.1007/BF00429430) · Rutter 1983 J. Geol. Soc. 140:725–740 (10.1144/gsjgs.140.5.0725) · Gratier, Dysthe & Renard 2013 Adv. Geophys. 54:47–179 (10.1016/B978-0-12-380940-7.00002-0) · Mullis et al. 1994 GCA 58:2239–2267 ⚑DOI · Gnos et al. 2025 Swiss J. Geosci. 118:12 (10.1186/s00015-025-00484-9) · BGS OR/15/066.

---

*Packet prepared 2026-08-05. Verbatim single-pass research sections (fuller prose than this synthesis) are preserved in the session scratchpad; everything load-bearing from them is carried here. The four passes ran independently and their overlapping claims (quartz-solubility direction, boiling-vs-solubility split at Grimsel, the P_f-drop event shape) converged without coordination — treat that convergence as weak additional evidence, not proof.*
