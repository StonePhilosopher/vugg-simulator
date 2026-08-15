# BIF, crocidolite, and tiger's-eye origin models

Date: 2026-08-09
Scope: science basis for the Asbestos Hills scenarios, Creative controls, substrate gates, and wall rendering added in SIM 260.

## Finding

Tiger's-eye must not be represented as a settled chalcedony pseudomorph after crocidolite. The primary literature contains two materially different interpretations, and the simulator can expose the disagreement as an experiment instead of silently choosing one.

## Primary sources

1. Heaney, P. J. & Fisher, D. M. (2003), “New interpretation of the origin of tiger's-eye,” *Geology* 31(4), 323–326. DOI: `10.1130/0091-7613(2003)031<0323:NIOTOO>2.0.CO;2`.

   - Explicitly rejects pseudomorphic quartz replacement after pre-existing crocidolite.
   - Interprets quartz and crocidolite as synchronous growth in an antitaxial crack-seal vein.
   - Describes columnar quartz and crocidolite microfibre bands crossing the quartz growth fabric; later oxidation produces the familiar colour.

2. Gutzmer, J., Beukes, N. J. & Cairncross, B. (2004), “New interpretation of the origin of tiger's-eye: Comment,” *Geology* 32(1), e44. DOI: `10.1130/0091-7613-32.1.e44`. Page e45 is the separate Heaney & Fisher reply and is not attributed to the Comment.

   - Reports the Asbestos Hills field relationship: tiger's-eye is restricted to a shallow, massively silicified and goethitized zone associated with a planation surface.
   - Describes a downward transition from tiger's-eye through hawk's-eye to unaltered crocidolite; deep mine workings lack the silicified material.
   - Interprets older crocidolite seams followed by near-surface silicification and oxidation. The authors do not regard the product as a pseudomorph sensu stricto.

3. Miyano, T. & Klein, C. (1983), “Evaluation of the Stability Relations of Amphibole Asbestos in Metamorphosed Iron-Formations,” *Mining Geology* 33, 213–222. DOI: `10.11456/shigenchishitsu1951.33.213`.

   - Provides a 150–450°C low-to-medium-temperature frame for crocidolite/amosite-bearing metamorphosed iron formations.
   - Relevant invariant assemblages include riebeckite–quartz–magnetite with related grunerite/minnesotaite or hematite/acmite variants.
   - Increasing temperature and alkali escape can route crocidolite toward amosite; this supports allowing competition rather than declaring a chemically pure crocidolite-only broth.

## Executable decisions

| Question | Antitaxial crack-seal model | Surficial-alteration model |
|---|---|---|
| Precursor state | Grown, active crocidolite | Older crocidolite with a booked oxidative loss zone |
| Quartz relationship | Synchronous with crocidolite | Later silica overprint |
| Initial window | 150–450°C, pH 7–11, O₂ below 0.6 | Crocidolite first in the metamorphic window |
| Colour/alteration window | Later 5–100°C proxy, O₂ at least 0.4; fibres preserved | 5–100°C proxy, O₂ at least 0.4; oxidative crocidolite loss required |
| Nucleation exclusions | Bare wall, hematite alone, magnetite alone | Bare wall, hematite alone, magnetite alone, cosmetic `dissolved=true` flag |

The 5–100°C surface range is an openly declared kinetic/process proxy. Neither origin paper supplies a unique locality temperature-pressure path for weathering, so the game must not present 40°C or 60°C as measured Asbestos Hills thermometry. Likewise, scenario pressure of 1.0 kbar is a generic low-grade-metamorphic boundary used for the precursor stage, not a locality barometer. The exhumation events move both fluid and rock pressure to 0.001 kbar, the simulator's atmospheric floor, rather than leaving metamorphic pressure active during surface alteration.

Neither origin paper supplies the exact pH 7–11, O₂ 0.4/0.6 cutoffs, a unique oxidation rate, or the simulator's 0.9 gold-brown extent threshold. Those are disclosed simulator-calibrated process/redox proxies. The literature-constrained claims are the sequence and preserved textures, together with Miyano and Klein's 150–450°C amphibole-asbestos family.

## Mass and provenance rules

- Surficial tiger's-eye requires a negative crocidolite growth zone whose `dissolutionMode` is `oxidative`. The authoritative sequence is `_applyZoneGrowthBudget` / `applyStoichiometricGrowthBudget` followed by `Crystal.add_zone`; the budget step records positive returned Na–Fe–Si inventory in `_returned_budget_inventory`, and a direct `add_zone` call alone is not accepted evidence.
- A manually toggled `dissolved` boolean is not evidence and cannot unlock nucleation.
- Crack-seal oxidation does not generate a negative crocidolite zone. This prevents the two hypotheses from collapsing into the same hidden mechanism.
- Crack-seal oxidation records cumulative accepted zero-thickness reaction overprints. Each receipt debits O₂ against Fe already accepted as supplemental chromophore uptake in the synchronous aggregate; partial extent remains a blue-gold hawk's-eye transition and later O₂ replenishment can complete the overprint without adding SiO₂ framework.
- Both scenarios use gameplay seed 42 in tests and carry independent authored shape seeds: 2003 and 2004, chosen to document the publication year of each modeled hypothesis.

## Visual decisions

- Banded iron formation is a first-class Creative host and matrix skin, with restrained chert/jasper and hematite/magnetite laminae.
- Crocidolite and tiger's-eye use high `wall_spread` coating/fibrous habits. They represent seams and broad aligned fabrics rather than isolated floating euhedral crystals.
- The player chooses the tiger's-eye origin model in Creative mode. The label names the scientific interpretation; it is not an unexplained difficulty switch.

## Automated acceptance contract

`tests-js/bif-tigers-eye.test.ts` checks:

1. Each model's temperature, pH, and redox branch.
2. Crack-seal nucleation from grown active crocidolite.
3. Surficial nucleation only after accepted oxidative loss.
4. Rejection of bare wall, bare hematite, and a cosmetic dissolved flag.
5. Both complete Asbestos Hills scenarios at gameplay seed 42, including their authored shape seeds and BIF host.
6. Preservation versus oxidative loss of crocidolite in the appropriate model.
7. Correct primary citations and Creative/renderer wiring.

These tests are part of the ordinary local Vitest suite and therefore run through `npm run ci`; no Python environment or one-off manual harness is required.

`npm run audit:bif` is the reusable production-scenario observer. It emits a machine-readable seed-42 receipt for both models and fails closed if crocidolite/tiger's-eye disappears, an origin token is lost, the exhumation pressure transition fails, the crack-seal path consumes fibres, the alteration path lacks an oxidative loss zone, or a fluid-boundary violation appears. It is also part of `npm run ci`.
