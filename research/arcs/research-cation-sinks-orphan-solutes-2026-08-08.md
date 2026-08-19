# Cation sinks and orphan analytical solutes — science closure

Date: 2026-08-08  
Runtime: Node.js/TypeScript only  
Canonical gameplay seed: 42

## Question

An older SIM 228 Schneeberg audit reported 80–225 ppm Zn after wurtzite
retirement. That residual Zn was reported as reducing pharmacolite's competition
proxy and could suppress a documented Ca arsenate. Was a new Zn mineral sink required,
and do any of Creative mode's analytical solutes still lack a gameplay route?

## Finding

No new Schneeberg Zn phase is licensed. The current scenario authors no Zn
source, and SIM 259's canonical replay finds **zero Zn at every time step in
all 7,680 spatial control volumes**. The audit checks every initial/post-step
row rather than only the final grid, and fails on missing/non-finite bulk or
spatial Zn values. Pharmacolite competition clears without inventing Zn:
seed 42 grows five pharmacolite crystals and ends with a bounded dissolved-
cation molar Ca proxy of 0.618402, above the calibrated 0.3 selector.

The historical Zn was not evidence for an unmodeled mineral. It was material
created by the retired empirical dissolution-credit table: a negative zone
could return formula ions even when no accepted positive shell had booked
them. The active LIFO ledger now returns only the exact inventory in accepted
growth shells. `tests-js/mass-balance-finalization.test.ts` pins the decisive
zero-inventory case: dissolving an unbooked wurtzite nucleus returns `{}` and
leaves both Zn and sulfur at zero.

`tools/cation-sink-audit.mjs` is the durable scenario receipt. Its CI check
replays Schneeberg at seed 42, requires 7,680 finite Zn values on all 161
initial/post-step rows,
and fails on any positive or negative bulk/spatial Zn excursion, booked Zn
without a source, loss of pharmacolite, or a final molar Ca proxy below 0.3.

The pharmacolite competition selector formerly repeated the same dimensional
mistake found in köttigite: it divided raw mass ppm and called the result a
cation share. SIM 259 now converts Ca, Cu, Pb, Zn, Co, and Ni by their atomic
weights through one production helper that the audit also calls. The 0.3 gate
is retained and disclosed only as a calibrated dissolved-cation competition
proxy; it is not presented as an equilibrium arsenate allocation or crystal-
site occupancy calculation.
`tools/creative-lever-audit.mjs` separately
executes all 48 analytical Creative fluid controls through their production
consumers and verifies all 48 through the UI save/replay path. Ge and Y are not
orphans: their specialized sphalerite-partitioning and fluorite trace-budget
routes are included in that executable census.

## Köttigite correction found during the sink audit

Köttigite must not be used as a scoreboard Zn sink. The old selector instead
contained two independent scientific errors:

1. It admitted pH 6–8 and rewarded pH 6.5–7.5. Ciesielczuk et al. (2020)
   reports erythrite stability at pH 5–8 but köttigite stability only in an
   acidic environment at **pH < 3**.
2. It blocked köttigite whenever either Co or Ni exceeded 10 ppm. Type material
   contains significant Co and Ni, and structural/chemical work documents
   random M-site substitution and an extensive erythrite–köttigite series.

SIM 259 therefore uses pH < 3 and converts ppm mass to dissolved-cation moles
before identifying the modeled Zn end member. Zn must exceed half of the
Zn+Co+Ni dissolved-cation mole pool. Co substitution remains allowed across
the documented broad erythrite–köttigite series; Ni is separately limited to
5 mol%, matching Hill's type-material scale (~0.14 apfu, 4.7% of M sites) and
Ciesielczuk et al.'s finding that köttigite lacks significant Zn↔Ni
substitution. This is a bounded solution-chemistry proxy, not a crystal-site
occupancy prediction or a full solid-solution activity model; the necessary
fluid–solid partition coefficients are not available.

The locality consequence is equally important. Bowell (2014) reports
köttigite and legrandite at Tsumeb only from the third oxidation zone, Level 44
“zinc pocket,” associated with and partly replacing adamite. The shipped
`supergene_oxidation` scenario explicitly represents the first-stage,
carbonate-buffered gossan and never reaches pH < 3. Köttigite is now recorded
there as a runtime-enforced scenario exclusion rather than an actual outcome;
the global engine remains available to Creative mode and a future third-zone
scenario.

The post-molar SIM 258 → 259 seed-42 baseline changes only the authored Tsumeb
`supergene_oxidation` scenario. Köttigite falls from two crystals to none,
covellite rises from four to five, and the retained assemblage records the
resulting maximum-size changes; the other 38 scenarios remain byte-identical.
No compensating retune is used to conceal these causal effects.

## Sources

- Ciesielczuk, J., Dulski, M., Janeczek, J., Krzykawski, T., Kusz, J. &
  Szełęg, E. (2020). “Crystal Chemistry of an Erythrite–Köttigite Solid
  Solution (Co3−xZnx)(AsO4)2·8H2O.” *Minerals* 10(6), 548.
  https://doi.org/10.3390/min10060548
- Bowell, R. J. (2014). “Hydrogeochemistry of the Tsumeb Deposit.” *Reviews
  in Mineralogy and Geochemistry* 79, 589–627.
  https://triage19.com/products/REV/REV079C14.pdf
- Hill, R. J. (1979). “The crystal structure of köttigite.” *American
  Mineralogist* 64, 376–382.
  https://rruff.geo.arizona.edu/doclib/am/vol64/AM64_376.pdf
- Magalhães, M. C. F., Pedrosa de Jesus, J. D. & Williams, P. A. (1988).
  “The chemistry of formation of some secondary arsenate minerals of Cu(II),
  Zn(II) and Pb(II).” *Mineralogical Magazine* 52, 679–690.
  https://doi.org/10.1180/minmag.1988.052.368.12

## Decision

- Do not invent a Schneeberg Zn-bearing mineral or source.
- Fail CI if Zn reappears without authored or booked provenance.
- Keep every analytical Creative control live and executable.
- Use the corrected acidic, Zn-majority köttigite selector.
- Do not claim first-stage Tsumeb köttigite; a future third-zone scenario may
  author the documented zinc-pocket history explicitly.

## Verification

- `npm run audit:cations`: PASS at SIM 259, seed 42; 161 rows × 7,680 finite
  Zn control volumes, zero bulk/spatial Zn throughout, five pharmacolite
  crystals, final dissolved-cation molar Ca proxy 0.618402.
- Independent seed-1 and seed-7 receipt checks also cover 161 × 7,680 finite
  Zn control volumes with zero bulk/spatial Zn. They grow three and two
  pharmacolite crystals and end at molar Ca proxies 0.622471 and 0.624060,
  respectively.
- `npm run audit:creative`: PASS; 48/48 accepted analytical controls execute a
  production consumer and 48/48 survive UI save/replay exactly.
- `npm run audit:science`: PASS; all 39 scenario strips, 78 claim-card files,
  and the 39-scenario/226-citation manifest carry the current model identity.
- Full post-correction local `npm run ci`: PASS. Vitest passed 203/203 files and
  2,744/2,744 tests in 9,062.58 seconds after typecheck, reproducible build,
  Creative, cation, and science audits all passed in the same invocation.
- `vitest.config.ts` makes `pool: 'threads'`, `maxWorkers: 1`, and
  `fileParallelism: false` the local default, replacing the old eight-worker
  setting that was measured consuming roughly 0.7–1.3 GB per worker.
