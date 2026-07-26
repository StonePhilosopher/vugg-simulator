# Broth-Ratio Branching Research — Descloizite vs Mottramite

**Pair:** Pb-vanadates competing for Pb + V + (Zn or Cu) in supergene oxidation zones
**Purpose:** Determine retrofit thresholds matching the rosasite/aurichalcite pattern.
**Reference:** `vugg.py:supersaturation_rosasite` (Round 9a).
**Verdict at the end:** **Retrofit recommended.** Same upgrade path as adamite/olivenite.

---

## Identity

| Mineral | Formula | Color | Habit |
|---|---|---|---|
| **Descloizite** | PbZn(VO₄)(OH) | Red-brown to orange-brown | Pyramidal/dipyramidal crystals, drusy crusts |
| **Mottramite** | PbCu(VO₄)(OH) | Olive green / yellowish green / black | Botryoidal crusts, rare prisms |

**Same orthorhombic structure** (space group Pnma). Cu²⁺ and Zn²⁺ swap on the M²⁺ site. Color difference is the cleanest visual signal — descloizite has no Cu chromophore, so the V⁵⁺ alone gives red-brown; mottramite gets the green from Cu²⁺.

**Complete solid solution series** is documented (this is the textbook example after rosasite/aurichalcite). Specimens at every Cu:Zn ratio occur in nature, with the dominant metal determining which name applies.

## Branching Condition

**Primary control: Cu:Zn ratio in the parent fluid.**

Pure ratio play, exactly like adamite/olivenite. The structure is indifferent to which metal occupies the M²⁺ site — whichever the fluid delivers more of is what the crystal incorporates. Color follows compositionally.

**Solid solution evidence:**
- Schwartz, G.M. 1942. "Mottramite-descloizite series." *American Mineralogist* 27:736–742 — first systematic compositional survey, established the continuous series.
- Oyman, T. et al. 2003. *Chem. Erde-Geochemistry* 63:113–120 — modern XRD + microprobe, confirms continuous lattice-parameter trend across the series, with bimodal preference (Cu-rich and Zn-rich modes more common than 50:50, but intermediate "cuprian descloizite" / "zincian mottramite" common at Tsumeb and Berg Aukas).
- Strunz, H. 1959. *Tsumeb mineralogy* — both type minerals from Tsumeb (descloizite Berg Aukas 1854; mottramite Mottram St Andrew, Cheshire 1876, but Tsumeb produced the best examples of both).

**Secondary controls (none differentiate the pair):**
- **Temperature:** Both supergene, both stable to ~80°C. Doesn't differentiate.
- **pH:** Both stable in 4–8 range with optimum near-neutral. Doesn't differentiate.
- **V⁵⁺:** Required by both; vanadinite (Pb₅(VO₄)₃Cl) is the V-only competitor that takes over at high Cl with no significant Zn/Cu — different paragenesis.
- **Pb floor:** Both need significant Pb (>40 ppm in current sim, ~50–500 ppm raw in real supergene fluids).

**Why the ratio is dispositive:** The crystal site holding Cu/Zn is a single octahedron in the structure. It can accept either metal but accepts whichever is locally available. There's no kinetic or thermodynamic reason to discriminate — the choice is statistical based on activity ratio.

## Current Sim Implementation (Round 8d)

```python
# descloizite (line 3186)
if self.fluid.Cu > self.fluid.Zn:
    return 0
# mottramite (line 3226)
if self.fluid.Zn >= self.fluid.Cu:
    return 0
```

Same strict-comparison pattern as adamite/olivenite. Floor thresholds:
- Descloizite: Pb ≥ 40, Zn ≥ 50, V ≥ 10, O₂ ≥ 0.5
- Mottramite: Pb ≥ 40, Cu ≥ 50, V ≥ 10, O₂ ≥ 0.5

Symmetric Cu/Zn floors (both ≥50) — appropriate since neither is more "active" than the other in real supergene fluids.

## Proposed Retrofit

Match adamite/olivenite retrofit exactly:

```python
# supersaturation_descloizite — after floor + T + pH checks:
cu_zn_total = self.fluid.Cu + self.fluid.Zn
zn_fraction = self.fluid.Zn / cu_zn_total
if zn_fraction < 0.5:
    return 0
if 0.55 <= zn_fraction <= 0.85:
    sigma *= 1.3
elif zn_fraction > 0.95:
    sigma *= 0.5  # pure-Zn — Pb-vanadates compete with willemite/hemimorphite
```

```python
# supersaturation_mottramite — mirror:
cu_zn_total = self.fluid.Cu + self.fluid.Zn
cu_fraction = self.fluid.Cu / cu_zn_total
if cu_fraction < 0.5:
    return 0
if 0.55 <= cu_fraction <= 0.85:
    sigma *= 1.3
elif cu_fraction > 0.95:
    sigma *= 0.5  # pure-Cu — competes with vanadinite/malachite
```

**Trace-element minimum on the recessive side:** Add a low Cu floor (≥0.5) to descloizite and a low Zn floor (≥0.5) to mottramite, so the ratio is meaningful. Real specimens always have at least trace amounts of the recessive metal — pure end-members basically don't exist in nature.

**Floor minimum on the dominant side:** Keep ≥50. Real supergene Pb-vanadate occurrences need significant Pb-Zn-Cu sulfide-host weathering above + V-bearing groundwater (red-bed roll-front signature) below; both metals at the 50-ppm sim scale reflect this.

## Decision: Retrofit Recommended

**Why:**
1. Solid solution is THE textbook competition in this group; sim should reflect it cleanly.
2. Sweet-spot bonus rewards intermediate compositions (which match the most-collected real specimens — Tsumeb's olive-green mottramite with detectable Zn, Berg Aukas's red-brown descloizite with detectable Cu).
3. Single canonical broth-ratio idiom across all retrofitted pairs.

**Sequencing:** Same commit cadence as adamite/olivenite — one commit, mirroring the supersat changes. The supergene_oxidation scenario already has both Cu (55) and Zn (90) plus V (1.5 → 7.5 after `event_supergene_v_bearing_seep`); the Zn-dominant chemistry should still produce descloizite-leaning behavior. Vanadinite (no Cu/Zn at all) will continue to nucleate from pure-Pb-V-Cl fluid as today.
