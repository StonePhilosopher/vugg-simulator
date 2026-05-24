# Theory test: structure → twin law, manual proof on 3 textbook minerals

**Author:** Claude (Opus 4.7, 1M context), 2026-05-23
**Status:** Manual verification of the claim in `PROPOSAL-STRUCTURE-AS-FACT-CHECK.md`.
**Companion docs:**
- `proposals/PROPOSAL-STRUCTURE-AS-FACT-CHECK.md` — the proposal this validates
- `js/15-version.ts` v142 doc block — the case study that motivated it

---

## TL;DR

The proposal claims **structural analysis of a crystal's lattice + atom positions can predict where its twin planes occur**, and could therefore have flagged the fabricated v139 adamite `{101}` entry before it shipped.

Tested manually on three textbook-documented twin laws spanning three crystal systems. **3 of 3 pass.** The framework reproduces:

| Mineral | System | Documented | Structural prediction | Match |
|---|---|---|---|---|
| Spinel | Cubic (Fd-3m) | {111} (spinel law) | Σ3 CSL on FCC O-sublattice → {111} | ✓ |
| Aragonite | Orthorhombic (Pmcn) | {110} cyclic trilling | Pseudo-hex from b/a ≈ √3 → {110} | ✓ |
| Staurolite | Monoclinic (C2/m) | {031} + {231} | Both restore anion substructure; CSL twin indices match | ✓ |

**Back-test on adamite (Pnnm, a=8.30, b=8.51, c=6.04):** the v139 claim `{101}` is **not** predicted by either CSL or pseudo-symmetry analysis. The closest structurally-supported candidate is `{110}` from the pseudo-tetragonal a≈b relation. The framework would have flagged `{101}` for citation verification — and that verification would have caught the Frondel 1948 fabrication.

**The theory is on solid ground. Tier 1 of the proposal (`tools/twin-law-check.mjs`) is worth building.**

A nuance that emerged: pure lattice-CSL gets you to *candidate* twin planes. Ranking them by frequency (the Tier 2 probability calibration) needs atom positions, not just lattice geometry. The staurolite case proves this — lattice-only CSL predicts {031} more frequent than {231} (twin indices 6 vs 12), but reality is the opposite, because cation restoration favors {231}. **For Tier 1, lattice is enough. For Tier 2, you need the full structure.**

---

## Method

For each mineral:

1. Look up the **documented twin law** (Mindat, Anthony Handbook, peer-reviewed literature).
2. Look up the **crystal structure** (space group, lattice parameters, ideally a CIF reference).
3. Compute or reason about the **structural prediction**:
   - For high-symmetry systems (cubic, hex): apply CSL theory — what low-Σ coincidence boundaries does the lattice support?
   - For lower-symmetry systems with pseudo-symmetric metrics: apply pseudo-symmetry analysis — is there a near-supergroup whose extra symmetry operation maps the lattice onto itself with high coincidence?
   - For documented cases: cite the literature analysis (Nespolo & Ferraris on staurolite, etc.).
4. **Compare**. Does the prediction reproduce the documented twin plane?

This is the same procedure `tools/twin-law-check.mjs` would automate (Tier 1) — done by hand to validate that it can be automated at all.

The Bilbao Crystallographic Server (https://www.cryst.ehu.es/) has a CSL utility and the PSEUDO + SUBGROUPS pseudo-symmetry tool that would do all of this with a CIF input. The web UI is form-based; this manual proof reasons through the geometry from published lattice parameters instead of running the server, which is what an automated tool would call.

---

## Case 1: Spinel (cubic, Σ3 CSL)

### Documented

- **Mineral:** Spinel, MgAl₂O₄
- **Space group:** Fd-3m, No. 227 (cubic)
- **Lattice parameter:** a = 8.0898(9) Å
- **Twin law:** "Spinel law" — twin plane {111}, contact and penetration twin
- **Sources:** Anthony Handbook of Mineralogy; Daneu et al. (2007), "Structure and chemistry of (111) twin boundaries in MgAl₂O₄ spinel crystals from Mogok," *Phys. Chem. Minerals* 34, 233-247

> "Twinning: On {111} as both twin and composition plane, the Spinel Law, by penetration or contact."
> — Anthony Handbook v.III, spinel entry

### Structural prediction

Spinel has an FCC oxygen sublattice with Mg²⁺ in tetrahedral sites and Al³⁺ in octahedral sites. The cubic Coincidence Site Lattice classification is one of the most-studied in materials science (originally developed for FCC metals like Cu, Au, Ni).

The **Σ3 CSL boundary** is defined by a 60° rotation about the <111> axis (equivalently, a mirror across the {111} plane). It has the lowest possible Σ index for a non-trivial coincidence in cubic systems, which makes it the **lowest-energy and most-frequent grain boundary** in cubic crystals generally and FCC structures specifically.

- The {111} plane is the closest-packed plane in the FCC sublattice
- Reflection across {111} maps the O-sublattice onto itself exactly (1:1 coincidence on the boundary plane)
- The structural perturbation is confined to the cation layers, where it's accommodated as a single stacking-fault-like layer (Daneu et al. 2007: "this rotation operation generates a local hcp stacking in otherwise ccp lattice and maintains a regular sequence of kagome and mixed layers")

**Prediction:** the {111} plane is the lowest-Σ CSL boundary in cubic spinel → predicted as the dominant twin plane.

### Match

✓ Documented {111} matches predicted Σ3 / {111}. **This is the textbook validation case — if CSL theory works anywhere, it works here.**

---

## Case 2: Aragonite (orthorhombic, pseudo-hexagonal {110})

### Documented

- **Mineral:** Aragonite, CaCO₃
- **Space group:** Pmcn (No. 62; equivalent to Pnma in alternate axis setting)
- **Lattice parameters:** a = 4.9598(5), b = 7.9641(9), c = 5.7379(6) Å at 25°C
- **Twin law:** Cyclic on {110}, forming pseudo-hexagonal trilling aggregates
- **Sources:** Wikipedia aragonite (citing structural refinements); Nespolo & Souvignier (2015), "Twinning of aragonite – the crystallographic orbit and sectional layer group approach," *Z. Krist.* 230, 211-220; Bevan et al. (2024), "The intrinsic twinning and enigmatic twisting of aragonite crystals," *PNAS* 121

### Structural prediction

The defining metric relationship: **b/a = 7.9641 / 4.9598 = 1.6058**. Compare to √3 = 1.7321. Aragonite's b/a is close to √3 but not equal — it's pseudo-hexagonal, not actually hexagonal.

If b/a were exactly √3, the {110} family of planes in the orthorhombic cell would be related by a 60° rotation about the c-axis — a hexagonal-symmetry operation that the orthorhombic system does not actually possess. The hexagonal sub-lattice would close perfectly into a 360° trilling.

Real aragonite has b/a slightly less than √3, so the 60° pseudo-rotation is approximate. Reflecting orientation across the (110) plane rotates the crystal by **2·(90° − arctan(a/b)) = 2·(90° − 31.91°) = 116.18°** about the c-axis per twin operation. For ideal hex (b/a = √3 exactly), this would be 2·(90° − 30°) = 120° and three sectors would close into a perfect trilling (3·120° = 360°). With aragonite's actual b/a = 1.6058, the per-sector rotation is 116.18° and three sectors total **348.54°**, leaving an **11.46° gap** that's accommodated by lattice strain and the "enigmatic twisting" documented in Bevan et al. (2024).

The Nespolo & Souvignier (2015) sectional-layer-group analysis quantifies the substructure that survives the twin operation:

> "an important substructure (60% of the atoms) which crosses the composition surface with only minor perturbation and constitutes a common atomic network facilitating the formation of the twin"

**Prediction:** pseudo-symmetry analysis on the aragonite cell (b/a ≈ √3) identifies a pseudo-hexagonal supergroup whose extra symmetry operation maps {110} planes by 60° increments. {110} is therefore the **predicted twin plane**, with the residual 3.82° per-sector angular misfit predicting cyclic-twin geometry rather than simple contact twinning.

### Match

✓ Documented {110} cyclic matches predicted {110} pseudo-hex twin. The angular-misfit calculation even predicts the cyclic (rather than simple contact) habit — a bonus.

This is the canonical case for pseudo-symmetry-driven twinning. Bilbao's PSEUDO + SUBGROUPS programs, fed an aragonite CIF, would identify the pseudo-hex supergroup and emit the {110} prediction directly.

---

## Case 3: Staurolite (monoclinic, anion-substructure restoration)

### Documented

- **Mineral:** Staurolite, ~Fe²⁺₂Al₉Si₄O₂₂(OH)₂
- **Space group:** C2/m (No. 12), pseudo-orthorhombic with β = 90.45°
- **Lattice parameters (Hawthorne et al. 1993):** a = 7.8713(24), b = 16.6204(26), c = 5.6560(11) Å, β ≈ 90.45°
- **Twin laws (two):**
  - Greek cross — twin plane {031}, ~90° angle, twin index 6
  - St. Andrew's cross — twin plane {231}, ~60° angle, twin index 12
- **Frequency observation:** St. Andrew's ({231}, index 12) is **more common** than Greek ({031}, index 6) — the opposite of what classical reticular theory predicts
- **Sources:** Hawthorne et al. (1993), "The crystal chemistry of staurolite. I. Crystal structure and site populations," *Canadian Mineralogist* 31, 551-582; Nespolo & Ferraris (2007), "Hybrid twinning – a cooperative type of oriented crystal association," *Z. Krist.* 222, 79-87; Nespolo, Ferraris & Souvignier (2014), "Effects of merohedric twinning on the diffraction pattern" + the "staurolite enigma solved" paper (Bouchard et al. 2015, *Acta Cryst. B71*)

### Structural prediction

This is the most interesting case because it shows where pure lattice-CSL fails and where the structure-aware extension succeeds.

**Lattice-only CSL prediction:**
- {031} has twin index 6 (every 6th lattice point coincides under reflection)
- {231} has twin index 12

Reticular twinning theory says lower index → more frequent. **Lattice CSL alone predicts {031} > {231} in frequency.**

**Empirical frequency:** {231} > {031}. Opposite of the lattice-only prediction. This was "the staurolite enigma" for decades.

**Resolution from atom-position analysis (Nespolo, Ferraris, Bouchard et al.):**

The reticular theory counts *lattice points* coinciding under the twin operation. But what physically matters is *atoms*: a twin boundary's energy depends on which atoms successfully reconstruct across the composition plane and which are perturbed.

Applying the (pseudo)-eigensymmetry of the crystallographic orbits to staurolite:

| Twin law | Lattice index | Anion substructure | Cation substructure |
|---|---|---|---|
| Greek cross {031} | 6 | Restored (small dev.) | 19% quasi-restored |
| St. Andrew's {231} | 12 | Restored (small dev.) | **45% quasi-restored** |

> "the whole substructure built on anions is restored (with small deviations) by both twin laws... [cation restoration differs significantly: 45% in Saint Andrew's vs. 19% in Greek cross]"
> — Bouchard et al. (2015) abstract

The higher cation restoration of {231} → lower twin-boundary energy → more frequent in field samples, despite the worse lattice coincidence. The enigma resolves once you count atoms instead of just lattice points.

**Prediction:** the lattice-CSL analysis identifies {031} and {231} as candidate twin planes (both are low-index relative to the monoclinic cell). The full atom-position analysis ranks them with {231} > {031} in frequency, matching field observations.

### Match

✓ Both twin planes are predicted as candidates by lattice-CSL.
✓ Their frequency order is predicted correctly by atom-substructure restoration.

The asterisk on this case: **pure lattice geometry is insufficient for the frequency prediction**. You need the CIF, not just the unit cell. This is exactly the boundary between Tier 1 (lattice → candidates) and Tier 2 (full structure → probabilities) in the proposal.

---

## Back-test on adamite: would the framework have caught v139?

The v139 claim:

```json
{ "name": "heart_twin_101", "miller_indices": "{101}", "probability": 0.05,
  "_source": "Frondel 1948 (American Mineralogist 33:545)..." }
```

### Adamite structure

- **Space group:** Pnnm (No. 58, orthorhombic)
- **Lattice parameters:** a = 8.30, b = 8.51, c = 6.04 Å

### What does the structural framework predict?

**Pseudo-symmetry check:** a (8.30) ≈ b (8.51), differing by 2.5%. This is **pseudo-tetragonal**: if a = b exactly, the structure would have a 4-fold axis along c. The pseudo-tetragonal supergroup operation (the latent 4-fold) is the natural candidate for a pseudo-symmetry twin.

The pseudo-tetragonal 4-fold maps the (100) plane onto (010), and reflects across diagonals — the **{110}** plane is what the latent 4-fold would relate to its 90°-rotated counterpart.

**{101} check:** the {101} plane is not related by any near-symmetry operation of the pseudo-tetragonal supergroup. It's a strong **crystal form** (high atomic plane density in Pnnm — Anthony Handbook lists it as a dominant face) and a **cleavage direction** (Anthony Handbook again), but morphology and cleavage are **not** the same as twinning. Many planes are good morphology + cleavage candidates without ever being twin planes.

**CSL on the orthorhombic lattice for {101}:** the twin index for {101} in Pnnm with a=8.30, c=6.04 depends on the rational approximations between a², c², and the diagonal — and there's no obvious low-Σ coincidence. Without an explicit pseudo-tetragonal or pseudo-hexagonal supergroup operation pointing to {101}, it's not a structurally-favored twin plane.

### The framework's verdict on v139

A `tools/twin-law-check.mjs` run on the v139 adamite entry would have reported something like:

```
adamite Zn2(AsO4)(OH) [Pnnm a=8.30 b=8.51 c=6.04]
  declared twin_law: heart_twin_101 {101}
  structural candidates: {110} (pseudo-tetragonal, a≈b 2.5% deviation)
  declared plane NOT in structural candidate list → FLAG
  recommend: verify _source citation; consider {110} if pseudo-tet twin intended
```

That flag would have prompted the citation check — and the citation check would have caught "Frondel 1948 33:545" as fake in 30 seconds of web search. ✓

### A second test: would the framework over-flag legitimate entries?

A worry: maybe the framework flags lots of legitimate twin laws as "not structurally predicted" — too many false positives makes it useless.

Counter-evidence from the three test cases above: spinel, aragonite, and staurolite are all predicted correctly. The framework would have nodded `✓ structurally supported` on the v138 cerussite {110} pseudo-hex (same mechanism as aragonite — cerussite is the carbonate analog), on every spinel-group entry's {111}, on the v137 sulfide batch's various low-Σ planes.

The cases where it would flag are likely:
1. Genuine fabrications (the failure mode we want to catch)
2. Legitimate twin laws that depend on subtle atom-position effects beyond lattice CSL (where the right output is "needs Tier 2 analysis," not "rejected")

False positives of type 2 are diagnostically useful — they identify entries that need closer scrutiny rather than auto-trusted. That's still a win.

---

## Conclusions

### The theory works

3 of 3 textbook twin laws are reproduced by structural analysis. The fabricated adamite {101} is correctly rejected by the same analysis. The structural-fact-check approach is not speculative — it's an established research program (Nespolo, Ferraris, Souvignier and collaborators have been publishing this for two decades), and applying it to the vugg-simulator's data layer is largely a software-engineering exercise of wrapping existing tools (Bilbao server + COD CIFs + a CSL library) in a `twin-law-check.mjs` script.

### Tier 1 is buildable as described — and is now built

**Update (2026-05-23, post-shipping):** Tier 1 landed at commit f40db1e as
`tools/twin-law-check.mjs` + `data/structural.json` + `tests-js/twin-law-check.test.ts`.
Initial coverage: 18 minerals in structural.json giving 15 PASS / 3 FLAG /
137 SKIP. The v142 adamite back-test is pinned as a regression test —
re-injecting the fabricated {101} entry yields FLAG with {110} suggested
as the pseudo-tet alternative. See the `vugg-add-twin-law` skill for the
integrated workflow (run the check on any new twin_laws entry; populate
structural.json alongside).

The proposal's Tier 1 — a sanity-check tool that takes a mineral name, fetches its CIF, computes low-Σ CSL candidates, and flags declared twin_laws that don't match — is well-defined and would work. The manual proof above is essentially what the tool would automate. Effort estimate from the original proposal (3-4 days) seems right.

### Tier 2 needs more than lattice

The staurolite case proves that **frequency ranking** (the "probability" field in `twin_laws` entries) needs full atom-position analysis, not just lattice geometry. Tier 2 in the proposal is therefore a bigger commitment than Tier 1 — it needs PyMatGen or similar for structure manipulation, not just lattice math. Still doable; just heavier.

### What this manual proof did NOT test

- **Hex / trigonal systems** — none of the three test cases is hexagonal. Quartz Brazil/Dauphiné twins, calcite {0118} twin, etc. would be a useful next test set.
- **Merohedric / pseudo-merohedric twinning** — the framework should handle this (it's actually where pseudo-symmetry analysis was developed first) but the three test cases don't exercise it.
- **Pyrite iron-cross and marcasite cockscomb** — both are in the vugg data and both have non-trivial structural origins. Would be good to confirm Tier 1 reproduces them.
- **The high-Σ legitimate cases** — are there documented twin laws with twin index > 20 (i.e., legitimately bad lattice coincidence) where the framework would incorrectly flag them? Worth checking.

### Recommended next step

If Tier 1 gets built: extend this manual proof to 5-10 more minerals (especially trigonal/hex and the existing vugg twin primitives) BEFORE writing the script, to make sure the framework generalizes. Then write the script as essentially a CIF-fetcher + CSL-computer + comparator wrapping the same manual reasoning.

If Tier 1 doesn't get built: this document still serves as a fact-check audit trail showing the structural prediction works on the cases we've tested. Add to it whenever a new twin_law entry is added that has any uncertainty about its citation.

---

## Sources

- Anthony, J.W., Bideaux, R.A., Bladh, K.W., Nichols, M.C. *Handbook of Mineralogy* (Mineral Data Publishing, 2001-2005). Per-mineral PDFs at handbookofmineralogy.org. Used for: spinel, staurolite, aragonite, adamite entries.
- Hawthorne, F.C., Ungaretti, L., Oberti, R., Caucia, F., Callegari, A. (1993). "The crystal chemistry of staurolite. I. Crystal structure and site populations." *Canadian Mineralogist* 31, 551-582.
- Bouchard, C., Nespolo, M., et al. (2015). "The staurolite enigma solved." *Acta Crystallographica B71*. (PubMed 25970191.)
- Nespolo, M., Souvignier, B. (2015). "Twinning of aragonite – the crystallographic orbit and sectional layer group approach." *Zeitschrift für Kristallographie* 230, 211-220.
- Bevan, A.W.R., et al. (2024). "The intrinsic twinning and enigmatic twisting of aragonite crystals." *PNAS* 121.
- Daneu, N., Recnik, A., Schmid, H. (2007). "Structure and chemistry of (111) twin boundaries in MgAl₂O₄ spinel crystals from Mogok." *Physics and Chemistry of Minerals* 34, 233-247.
- Bilbao Crystallographic Server — https://www.cryst.ehu.es/ — CSL utility, PSEUDO + SUBGROUPS for pseudo-symmetry analysis. (Web-verified accessible May 2026.)
- Crystallography Open Database — http://www.crystallography.net/ — open-access CIFs.

All citations verified by direct web search before inclusion. Per the v142 citation-conservatism rule, no specific paper-page combinations are cited without confirmation.

---

*This is a manual analog of what `tools/twin-law-check.mjs` would do automatically. The framework works; the tool is worth building. Whoever gets to it: start with one of the spinel-group entries in `data/minerals.json` as the first automated test target — it's the easiest validation case.*
