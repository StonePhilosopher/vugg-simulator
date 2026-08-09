# Roughton Gill mine-specific reconciliation

Date: 2026-08-08  
Scenario id retained for save compatibility: `roughten_gill`  
Canonical simulation seed: `42`  
Authored cavity shape seed: `1882`

## Decision

The former linarite-centered, carbonate-deficient scenario is rejected. It
generalized district specimens and an adjacent-mine interpretation over the
mine-specific evidence. SIM 257 instead treats Roughton Gill as:

1. a sustained 110–130°C quartz-dominant, calcite/dolomite-bearing primary
   stage with galena, chalcopyrite and sphalerite;
2. open meteoric replacement followed by mass-conserving oxidation of residual
   sulfide sulfur to sulfate;
3. carbonate-gangue-buffered weathering dominated by malachite and cerussite;
4. silica-rich sphalerite weathering that produces hemimorphite and the
   documented aurichalcite/rosasite association; and
5. pyromorphite followed by type-locality plumbogummite as an encrusting crust.

Linarite is genuine but fairly rare, caledonite is known from only a few
specimens, and leadhillite is very rare. They remain explicit aspirations and
are not forced into the canonical run.

## Evidence hierarchy

- Bridges, Green, Rumsey & Leppington (2011), *A review of the mineralisation at
  the Roughton Gill Mines, Caldbeck Fells, Cumbria: Part 3 — Roughton Gill
  Mine*, Journal of the Russell Society 14, 3–23, is the mine-grain authority:
  <https://russellsoc.org/wp-content/uploads/2015/11/JRS-14-Web.pdf>.
- British Geological Survey, *Mineralization in the Lake District*, supports
  the regional 110–130°C Pb–Zn deposition window and the primary
  galena–sphalerite association with minor chalcopyrite/tetrahedrite and
  quartz–baryte–carbonate gangue:
  <https://earthwise.bgs.ac.uk/index.php/Mineralization_in_the_Lake_District>.
- The Roughton Gill mine inventory transcribed in
  `citations-mindat-roughten-gill-2026-07-27.md` is used as phase-specific
  locality evidence, with uncertain entries treated weakly and without
  transferring nearby Caldbeck occurrences into the mine.
- Red Gill literature is comparison evidence only. Its carbonate-deficient
  interpretation is not imported against the Roughton Gill paper.

## Simulator mapping and mass balance

- Steps 0–59 hold the authored 130→115°C primary interval. No cold-quartz
  loophole or multi-seed search is used.
- Step 60 is an explicitly declared fluid replacement. Sulfur and carbon
  exports are booked rather than silently deleted.
- Step 100 transfers 30 ppm sulfur from the sulfide pool to the sulfate pool.
  Total aqueous sulfur is unchanged by the reaction.
- Step 140 adds 145 ppm carbonate-equivalent carbon, declared as
  calcite/dolomite-gangue wall release. A separate receipt identifies the
  simultaneous 80 ppm Cu import as carbonate-buffered upgradient drainage
  crossing weathering Cu ore; the metal is not attributed to dissolving gangue.
- Step 180 is a declared silica-rich weathering-water replacement. Its DIC and
  80 ppm Cu exports are booked as signed boundary withdrawals, and the water
  table is placed at ring 8.
- Plumbogummite has an authored step-215 Roughton nucleation window. A
  scenario-local parent-age rule requires its first Roughton crystal to grow as
  a botryoidal crust on older active pyromorphite. The global nucleator retains
  mimetite, cerussite, anglesite, dissolving galena, and wall routes.
- The engine describes that parent relationship as an encrusting overgrowth.
  It deliberately does not call it a pseudomorph or replacement because the
  parent remains active and no parent mass is debited.
- The opt-in whole-scenario sulfur and carbon ledgers must close at every
  declared transaction and at run end. Generic fluid-boundary receipts also
  reconcile every authored metal and silica addition or replacement against
  the actual signed bulk delta.

## Canonical seed-42 commissioning result

The commissioning run delivers quartz, calcite, galena, sphalerite and
chalcopyrite during the primary temperature window. It then delivers
malachite, cerussite, aurichalcite, rosasite, hemimorphite, pyromorphite and
plumbogummite. The rare linarite–caledonite–leadhillite suite is absent, as
intended. Every `expects_species` entry is therefore a result of the canonical
run, not a promise rescued by trying alternate seeds.

The mine-specific exclusion set has zero appearances. The sulfur ledger closes
after the step-60 open replacement and the step-100 internal redox transfer.
The carbon ledger separately records the step-60 replacement, step-140 wall
release, and step-180 replacement.

Reproduce with the supported Node workflow:

```text
npm run build
node tools/roughten-gill-reconciliation-observe.mjs
npx vitest run tests-js/roughten-gill.test.ts --maxWorkers=1 --minWorkers=1
```

## Limits retained honestly

- Dolomite is documented but does not clear the independently calibrated
  kinetic barrier in the canonical run; it remains aspirational.
- Mimetite/campylite is a minor component and is not promoted on dust-scale
  delivery.
- Native silver is an exceptional occurrence; most silver is represented in
  primary galena/minute inclusions rather than forced as abundant native metal.
- Absent engines for hinsdalite, hidalgoite, beudantite/corkite,
  mattheddleite, scotlandite, and several hydrated Cu sulfates remain catalog
  gaps. No available mineral is relabeled to impersonate them.
- The simulation is a causal, mass-audited educational reconstruction. It is
  not an equilibrium calculation of a measured inclusion fluid and does not
  claim quantitative modal abundance for the mine.
