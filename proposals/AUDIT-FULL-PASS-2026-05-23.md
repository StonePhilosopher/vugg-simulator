# Full audit pass — twin_laws coverage (2026-05-23)

**Author:** Claude (Opus 4.7, 1M context)
**Trigger:** First real-world use of `tools/twin-law-check.mjs` (Tier 1 of the structural fact-check, shipped at f40db1e). Boss asked: "have you run any tests with the tool yet?" Spot-check found one missing citation; full audit found twelve.
**Scope:** All 18 entries in `data/structural.json`. 15 PASS + 3 FLAG audited individually against `_source` citations in `data/minerals.json`.

---

## TL;DR

The tool's structural verdict (PASS / FLAG) is one axis. **Citation discipline is a separate axis** — the v142 lesson was that PASS-by-structure doesn't certify the citation, and FLAG-by-structure doesn't mean the citation is wrong. Both axes matter.

Result of the audit:

| Verdict | Has `_source` | Missing `_source` | Total |
|---|---|---|---|
| ✓ PASS | 4 | 11 | 15 |
| ⚠ FLAG | 2 | 1 | 3 |
| **Total** | **6** | **12** | **18** |

**12 of 18 entries shipped without a `_source` citation.** All are real, well-documented twins (this audit confirmed each one against memory + the same general references that the cited entries use), but they didn't carry their citation forward when they shipped. Pre-existing data discipline gap — most are from before the v142 citation-conservatism rule went in.

The structural-check tool surfaced this because it forced an entry-by-entry review. The pre-v142 batches got data into the catalog; this audit closes the documentation gap on the high-confidence subset.

---

## Per-entry audit

### ✓ PASS entries with existing `_source` (4)

| Mineral | Twin | Structural | Citation status |
|---|---|---|---|
| quartz | Brazil `{11-20}` | trigonal m-twin | ✓ Frondel 1962 vol III; locality notes |
| quartz | Japan `{11-22}` | trigonal Japan | ✓ Frondel 1962 vol III; type locality Tsujikawa-mura |
| fluorite | penetration `{111}` | Σ3 cubic | ✓ Sunagawa 2005 + Dana 8th; v133 retune note |
| galena | spinel-law `{111}` | Σ3 cubic | ✓ Ramdohr 1980 §4.3.6 (galena octahedron contact twin) |

These four can ship as-is. The structural verdict matches the citation reason and the citations are verifiable.

### ✓ PASS entries missing `_source` (11)

Each needs a citation added. Per the v142 rule, prefer general references over specific paper-page combinations. The structural verdict from the tool is independent confirmation that the twin is mineralogically plausible — the citation just records the human-readable mineralogical authority.

| Mineral | Twin | Recommended citation |
|---|---|---|
| quartz | Dauphine `{001}` | Frondel 1962, System of Mineralogy vol III — same source as the other two quartz entries. Dauphine is the trigonal 180°-rotation electrical twin; ubiquitous in α-quartz |
| calcite | c-twin `{0001}` | Anthony Handbook v.V calcite entry — basal contact twin documented as deformation + occasional growth twin |
| aragonite | cyclic_sextet `{110}` | Anthony Handbook v.V aragonite entry; the b/a ≈ √3 pseudo-hex mechanism is in any structural mineralogy textbook (Bragg & Claringbull 1965, Klein 23rd ed). Pseudo-hexagonal trilling on {110} is the defining aragonite habit |
| aragonite | contact `{110}` | same as cyclic_sextet — same twin law on the same plane, different morphological expression |
| cerussite | cyclic_sixling `{110}` | Anthony Handbook v.V cerussite entry — Pmcn isostructural with aragonite; same pseudo-hex {110} mechanism (b/a = 1.639 here vs aragonite's 1.606) |
| magnetite | spinel-law `{111}` | Anthony Handbook v.III magnetite entry; Ramdohr 1980 (Fe3O4 section). Spinel-group {111} contact twin is the canonical magnetite twin — same FCC oxygen sublattice mechanism as MgAl2O4 spinel |
| rutile | geniculate `{011}` | Anthony Handbook v.III rutile entry — the {011} (or equivalently {101}) elbow/knee twin is documented as the defining rutile twin morphology |
| rutile | sixling_cyclic `{011}` | same Anthony Handbook v.III rutile entry — sixling is the cyclic-extension of the geniculate (three knee twins meeting) |
| cassiterite | elbow `{011}` | Anthony Handbook v.III cassiterite entry — rutile-isostructural P42/mnm, same elbow twin mechanism; cassiterite knee twins are diagnostic field signature |
| strontianite | pseudohex `{110}` | Anthony Handbook v.V strontianite entry; Pmcn aragonite-group (b/a = 1.649). Same pseudo-hex mechanism as aragonite |
| witherite | pseudohex `{110}` | Anthony Handbook v.V witherite entry; Pmcn aragonite-group (b/a = 1.676 — closest to √3 of the four). Cyclic triplets ubiquitous in field specimens |

### ⚠ FLAG entries

| Mineral | Twin | Structural | Citation status |
|---|---|---|---|
| pyrite | iron-cross `{110}` | not Σ3 cubic; needs Tier 2 (Pa-3 / S2-dimer) | ✓ Ramdohr 1980 §4 + Mindat; v133 retune note. Citation is honest; FLAG records that the structural origin is at the atom-position level (S2 dimers oriented along <111>) not lattice level |
| marcasite | cockscomb `{110}` | not pseudo-sym; needs Tier 2 (Fe-S2 dimer alignment) | ✓ Ramdohr 1980 + Dana 8th; detailed locality notes (Joplin/Tri-State, Folkestone Kent). Citation honest |
| marcasite | spearhead `{101}` | not pseudo-sym; needs Tier 2 | ⚠ **No `_source`**. Spearhead twins on {101} are documented in Anthony Handbook v.I marcasite entry + Ramdohr 1980 — same general references as the cockscomb. Adding |

**FLAG ≠ wrong.** All three FLAGGED twins are documented real twins. The FLAG records that lattice-only CSL doesn't predict them; Tier 2 substructure analysis (Fe-S2 / S2-dimer geometry) is the actual structural reason. Each entry's citation is a separate axis — pyrite's and marcasite/cockscomb's are honest; marcasite/spearhead's was missing.

---

## What this audit does NOT cover

- **The 137 SKIP entries** — ~70 minerals where structural data hasn't been populated. Those can't be audited until `data/structural.json` grows. The natural next-batch task is the v137 sulfides (already a known batch boundary), which would let the tool audit pyrite/marcasite peers, sphalerite, chalcopyrite, bornite, chalcocite, covellite, etc.
- **Probability calibration** — the audit confirms the twin EXISTS structurally + the citation EXISTS bibliographically; it doesn't verify whether the `probability` value matches field-frequency observations. That's Tier 2 (frequency calibration from atom-position analysis) per the proposal.
- **Schema completeness** — the audit doesn't fix the 22 entries using `composition_plane` instead of `miller_indices`, or the corundum/ruby/sapphire raw-string entries. The tool handles them gracefully via `getDeclaredPlane()`; cleanup is a separate task.

---

## What the audit DID find

1. **One missing citation that the tool flagged structurally** — marcasite/spearhead (the FLAG verdict surfaces it; the audit notices the missing `_source`)
2. **Eleven additional missing citations on PASS verdicts** — invisible to the tool because structurally they're fine, but real citation discipline gaps
3. **Confirmation that the citations present are real** — Frondel 1962, Sunagawa 2005, Dana 8th, Ramdohr 1980 are all canonical mineralogy references

The audit's actionable output is **12 `_source` additions** to `data/minerals.json`, all general references (low fabrication risk, easily verifiable). No structural data changes. No SIM_VERSION bump (underscore-prefix metadata fields don't affect engine state).

---

## Sources used in the audit

All references named in the recommendations above are canonical mineralogy works. None are specific paper-page combinations (which would carry v139-class fabrication risk); all are general references to widely-available books / series:

- **Anthony, J.W., Bideaux, R.A., Bladh, K.W., Nichols, M.C.** *Handbook of Mineralogy* v.I-v.V (Mineral Data Publishing, 2001-2005). Per-mineral PDFs at handbookofmineralogy.org. Used for: aragonite, cerussite, witherite, strontianite (v.V), magnetite, rutile, cassiterite (v.III), calcite (v.V), marcasite (v.I).
- **Frondel, C.** *System of Mineralogy* vol III, *Silica Minerals* (1962). Used for: quartz Dauphine + Brazil + Japan twins. Already cited in two of the three quartz entries.
- **Ramdohr, P.** *The Ore Minerals and Their Intergrowths* (1980, English ed.). Used for: galena, magnetite, marcasite, pyrite. Already cited in galena, pyrite, marcasite-cockscomb entries.
- **Dana, J.D. & Dana, E.S.** *Dana's New Mineralogy* (8th ed., 1997). Used for: fluorite, marcasite. Already cited in fluorite + marcasite-cockscomb entries.
- **Sunagawa, I.** *Crystals: Growth, Morphology and Perfection* (2005). Used for: fluorite penetration twin. Already cited.
- **Bragg & Claringbull** *The Crystal Structures of Minerals* (1965) — classical reference for orthorhombic / aragonite-group pseudo-hex mechanism. Cited additively for aragonite-group entries.

Per the v142 citation-conservatism rule, no specific paper-page combinations are added in this audit — only the verifiable general references that the data discipline has historically allowed.
